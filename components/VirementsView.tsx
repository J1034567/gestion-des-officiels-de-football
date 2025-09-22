import React, { useState, useMemo } from 'react';
import { Payment, Official, AccountingStatus, AccountingPeriod, PaymentBatch, User } from '../types';
import { Permissions } from '../hooks/usePermissions';
import CreditCardIcon from './icons/CreditCardIcon';
import DatePicker from './DatePicker';
import { generateEdiFile } from '../services/exportService';
import CloseIcon from './icons/CloseIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import ConfirmationModal from './ConfirmationModal';
import LockClosedIcon from './icons/LockClosedIcon';
import UndoIcon from './icons/UndoIcon';
import ProofOfPaymentModal from './ProofOfPaymentModal';
import PencilIcon from './icons/PencilIcon';
import AlertModal from './AlertModal';

interface VirementsViewProps {
    payments: Payment[];
    officials: Official[];
    permissions: Permissions;
    onCreatePaymentBatch: (paymentIds: string[], batchDetails: { batchReference: string; batchDate: string; debitAccountNumber: string; }, ediFile?: { content: string, name: string }) => void;
    accountingPeriods: (AccountingPeriod | PaymentBatch)[];
    onCancelPaymentBatch: (batchId: string) => void;
    onSaveProofOfPayment: (batchId: string, proof: { transactionId?: string; file?: File }) => void;
    users: User[];
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

const GenerateConfirmModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerateAndClose: () => void;
    count: number;
    total: string;
}> = ({ isOpen, onClose, onGenerateAndClose, count, total }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Confirmer la Génération du Lot</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                     <div className="flex items-start">
                        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-brand-primary/20">
                            <CreditCardIcon className="h-6 w-6 text-brand-primary" />
                        </div>
                        <div className="ml-4">
                            <p className="text-gray-300">
                                Vous allez générer un fichier de virement pour <strong>{count} paiement(s)</strong>, pour un total de <strong>{total}</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="p-3 bg-yellow-900/30 text-yellow-300 text-sm rounded-lg flex items-start gap-2">
                        <AlertTriangleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <span>Après le téléchargement, les matchs correspondants seront marqués comme <strong>"Payé et Clôturé"</strong>. Cette action est irréversible.</span>
                     </div>
                </div>
                <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500">
                        Annuler
                    </button>
                    <button type="button" onClick={onGenerateAndClose} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
                        Générer et Clôturer
                    </button>
                </div>
            </div>
        </div>
    );
};


const VirementsView: React.FC<VirementsViewProps> = ({ payments, officials, permissions, onCreatePaymentBatch, accountingPeriods, onCancelPaymentBatch, onSaveProofOfPayment, users, showNotification }) => {
    const [view, setView] = useState<'pending' | 'history'>('pending');
    const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [batchDetails, setBatchDetails] = useState({ 
        reference: '', 
        date: new Date().toISOString().split('T')[0], 
        debitAccount: '',
        organizationName: 'Ligue Inter-RÈgions de Football',
        organizationAddress: 'Maison des ligues du foot'
    });
    const [alertModalInfo, setAlertModalInfo] = useState<{ title: string, message: string } | null>(null);
    const [batchToCancel, setBatchToCancel] = useState<PaymentBatch | null>(null);
    const [batchForProof, setBatchForProof] = useState<PaymentBatch | null>(null);

    const officialsMap = useMemo(() => new Map(officials.map(o => [o.id, o])), [officials]);
    
    const pendingPayments = useMemo(() => {
        return payments.filter(p => {
            const official = officialsMap.get(p.officialId);
            return p.accountingStatus === AccountingStatus.VALIDATED && official && official.bankAccountNumber;
        });
    }, [payments, officialsMap]);
    
    const paymentBatches = useMemo(() => {
        return (accountingPeriods.filter(p => p.type === 'payment_batch') as PaymentBatch[])
            .sort((a, b) => new Date(b.periodDate).getTime() - new Date(a.periodDate).getTime());
    }, [accountingPeriods]);

    const { selectedTotal, isAllSelected } = useMemo(() => {
        const selected = pendingPayments.filter(p => selectedPaymentIds.has(p.id));
        const total = selected.reduce((sum, p) => sum + p.total, 0);
        return {
            selectedTotal: total,
            isAllSelected: pendingPayments.length > 0 && selected.length === pendingPayments.length,
        };
    }, [selectedPaymentIds, pendingPayments]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedPaymentIds(new Set(pendingPayments.map(p => p.id)));
        } else {
            setSelectedPaymentIds(new Set());
        }
    };
    
    const handleGenerateClick = () => {
        if (!batchDetails.reference.trim() || !batchDetails.debitAccount.trim()) {
            setAlertModalInfo({ title: "Champs Requis", message: "La référence du lot et le compte à débiter sont obligatoires." });
            return;
        }
        setIsGenerateModalOpen(true);
    };

    const handleConfirmGeneration = () => {
        setIsGenerateModalOpen(false);
        const selected = pendingPayments.filter(p => selectedPaymentIds.has(p.id));
        const result = generateEdiFile(
            selected,
            officials,
            { 
                batchReference: batchDetails.reference, 
                batchDate: batchDetails.date, 
                debitAccountNumber: batchDetails.debitAccount,
                organizationName: batchDetails.organizationName,
                organizationAddress: batchDetails.organizationAddress,
            }
        );
        
        if (result.success && result.content && result.fileName) {
            onCreatePaymentBatch(
                Array.from(selectedPaymentIds), 
                {
                    batchReference: batchDetails.reference,
                    batchDate: batchDetails.date,
                    debitAccountNumber: batchDetails.debitAccount,
                },
                {
                    content: result.content,
                    name: result.fileName,
                }
            );
            setSelectedPaymentIds(new Set());
            setBatchDetails({ 
                reference: '', 
                date: new Date().toISOString().split('T')[0], 
                debitAccount: '',
                organizationName: 'Ligue Inter-RÈgions de Football',
                organizationAddress: 'Maison des ligues du foot'
            });
        } else {
            setAlertModalInfo({ title: "Erreur de Génération", message: result.error! });
        }
    };
    
    const handleConfirmCancel = () => {
        if (batchToCancel) {
            onCancelPaymentBatch(batchToCancel.id);
            setBatchToCancel(null);
        }
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'DZD' }).format(amount);
    
    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.full_name])), [users]);

    return (
        <>
            <main className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center mb-6">
                    <CreditCardIcon className="h-8 w-8 text-brand-primary mr-3" />
                    <h2 className="text-3xl font-bold text-white">Gestion des Virements</h2>
                </div>

                <div className="border-b border-gray-700 mb-6">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setView('pending')} className={`${view === 'pending' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                            Paiements en Attente
                        </button>
                        <button onClick={() => setView('history')} className={`${view === 'history' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                            Historique des Lots
                        </button>
                    </nav>
                </div>

                {view === 'pending' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                             <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead className="bg-gray-700">
                                            <tr>
                                                <th scope="col" className="p-4"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary"/></th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Officiel</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Match</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {pendingPayments.map(p => (
                                                <tr key={p.id} className={`${selectedPaymentIds.has(p.id) ? 'bg-brand-primary/10' : 'hover:bg-gray-700/50'}`}>
                                                    <td className="p-4"><input type="checkbox" checked={selectedPaymentIds.has(p.id)} onChange={() => { const newSet = new Set(selectedPaymentIds); if(newSet.has(p.id)) newSet.delete(p.id); else newSet.add(p.id); setSelectedPaymentIds(newSet); }} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary"/></td>
                                                    <td className="px-6 py-4"><div className="text-sm font-medium text-white">{p.officialName}</div><div className="text-xs text-gray-400">{p.role}</div></td>
                                                    <td className="px-6 py-4 text-sm text-gray-300">{p.matchDescription}</td>
                                                    <td className="px-6 py-4 text-right font-semibold text-brand-primary">{formatCurrency(p.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        </div>
                        <div className="lg:col-span-1">
                             <div className="bg-gray-800 p-6 rounded-lg sticky top-8">
                                <h3 className="text-xl font-bold text-white mb-4">Créer un Lot de Virement</h3>
                                <div className="space-y-4">
                                     <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Référence du lot</label>
                                        <input type="text" value={batchDetails.reference} onChange={e => setBatchDetails(p => ({...p, reference: e.target.value}))} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Date du lot</label>
                                        <DatePicker value={batchDetails.date} onChange={d => setBatchDetails(p => ({...p, date: d}))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Compte à débiter</label>
                                        <input type="text" value={batchDetails.debitAccount} onChange={e => setBatchDetails(p => ({...p, debitAccount: e.target.value}))} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" />
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Nom de l'organisation</label>
                                        <input type="text" value={batchDetails.organizationName} onChange={e => setBatchDetails(p => ({...p, organizationName: e.target.value}))} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Adresse de l'organisation</label>
                                        <input type="text" value={batchDetails.organizationAddress} onChange={e => setBatchDetails(p => ({...p, organizationAddress: e.target.value}))} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white" />
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-gray-700">
                                    <div className="flex justify-between items-center text-lg">
                                        <span className="font-medium text-gray-300">Total Sélectionné:</span>
                                        <span className="font-bold text-brand-primary">{formatCurrency(selectedTotal)}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">{selectedPaymentIds.size} paiement(s) sélectionné(s)</p>
                                    <button onClick={handleGenerateClick} disabled={selectedPaymentIds.size === 0} className="w-full mt-4 bg-brand-primary text-white font-bold py-2.5 px-4 rounded-lg hover:bg-brand-secondary disabled:bg-gray-600 disabled:cursor-not-allowed">Générer Fichier & Clôturer</button>
                                </div>
                             </div>
                        </div>
                    </div>
                )}
                {view === 'history' && (
                    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Référence</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Date</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Montant</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Paiements</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Statut</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Preuve de Paiement</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {paymentBatches.map(batch => {
                                        const isCancelled = batch.status === 'open';
                                        return(
                                        <tr key={batch.id} className={`hover:bg-gray-700/50 ${isCancelled ? 'opacity-60 bg-gray-900/50' : ''}`}>
                                            <td className="px-6 py-4 font-medium text-white">{batch.reference}</td>
                                            <td className="px-6 py-4 text-sm text-gray-300">{new Date(batch.periodDate).toLocaleDateString('fr-FR')}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-brand-primary">{formatCurrency(batch.totalAmount)}</td>
                                            <td className="px-6 py-4 text-center text-sm text-gray-300">{batch.paymentCount}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isCancelled ? 'bg-red-900 text-red-300' : 'bg-purple-900 text-purple-300'}`}>
                                                    {isCancelled ? 'Annulé' : 'Clôturé'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-300">
                                                {batch.proofOfPaymentUrl ? (
                                                    <a href={batch.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{batch.proofOfPaymentFilename}</a>
                                                ) : batch.transactionId ? (
                                                    <span>ID: {batch.transactionId}</span>
                                                ) : <span className="text-gray-500 italic">Non fournie</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {!isCancelled && (
                                                    <>
                                                        <button onClick={() => setBatchForProof(batch)} className="p-1.5 text-gray-300 hover:text-brand-primary rounded-full hover:bg-gray-700" title="Ajouter/Modifier Preuve"><PencilIcon className="h-4 w-4"/></button>
                                                        <button onClick={() => setBatchToCancel(batch)} className="p-1.5 ml-2 text-red-400 hover:text-red-300 rounded-full hover:bg-red-900/50" title="Annuler le Lot"><UndoIcon className="h-4 w-4"/></button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            <GenerateConfirmModal 
                isOpen={isGenerateModalOpen}
                onClose={() => setIsGenerateModalOpen(false)}
                onGenerateAndClose={handleConfirmGeneration}
                count={selectedPaymentIds.size}
                total={formatCurrency(selectedTotal)}
            />
            <ConfirmationModal
                isOpen={!!batchToCancel}
                onClose={() => setBatchToCancel(null)}
                onConfirm={handleConfirmCancel}
                title="Annuler le Lot de Virement"
                message={`Êtes-vous sûr de vouloir annuler le lot "${batchToCancel?.reference}"? Les paiements associés redeviendront "Prêt à payer". Cette action est irréversible.`}
            />
            <ProofOfPaymentModal
                isOpen={!!batchForProof}
                onClose={() => setBatchForProof(null)}
                onSave={onSaveProofOfPayment}
                batch={batchForProof}
            />
            <AlertModal
                isOpen={!!alertModalInfo}
                onClose={() => setAlertModalInfo(null)}
                title={alertModalInfo?.title || ''}
                message={alertModalInfo?.message || ''}
            />
        </>
    );
};
export default VirementsView;