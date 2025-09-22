
import React, { useState, useMemo, useCallback } from 'react';
import { Payment, User, Match, Official, Location, League, LeagueGroup, AccountingStatus, IndemnityRates } from '../types';
import CurrencyIcon from './icons/CurrencyIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ClockIcon from './icons/ClockIcon';
import PencilIcon from './icons/PencilIcon';
import DownloadIcon from './icons/DownloadIcon';
import PaymentDetailsModal from './PaymentDetailsModal';
import { exportPaymentsToExcel } from '../services/exportService';
import { Permissions } from '../hooks/usePermissions';
import SearchIcon from './icons/SearchIcon';
import CloseIcon from './icons/CloseIcon';
import DatePicker from './DatePicker';
import LockClosedIcon from './icons/LockClosedIcon';
import XMarkIcon from './icons/XMarkIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import AlertModal from './AlertModal';

interface FinancesViewProps {
    payments: Payment[];
    matches: Match[];
    officials: Official[];
    onUpdatePaymentNotes: (assignmentId: string, notes: string | null) => void;
    onBulkUpdatePaymentNotes: (updates: {id: string, notes: string | null}[]) => void;
    currentUser: User;
    users: User[];
    permissions: Permissions;
    locations: Location[];
    leagues: League[];
    leagueGroups: LeagueGroup[];
    indemnityRates: IndemnityRates;
}

type SortKey = keyof Payment | 'validator';

const BulkNotesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    note: string;
    setNote: (note: string) => void;
    count: number;
}> = ({ isOpen, onClose, onSave, note, setNote, count }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Ajouter une note de paiement</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6"/></button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-300">Cette note sera ajoutée ou remplacera la note existante pour les {count} paiements sélectionnés.</p>
                    <textarea 
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={4}
                        className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                        placeholder="Ex: Payé par virement bancaire le 25/10/2024, Ref: #12345"
                    />
                </div>
                <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500">Annuler</button>
                    <button onClick={onSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Appliquer</button>
                </div>
            </div>
        </div>
    );
};


const FinancesView: React.FC<FinancesViewProps> = (props) => {
    const { payments, matches, officials, onUpdatePaymentNotes, onBulkUpdatePaymentNotes, currentUser, users, permissions, locations, leagues, leagueGroups, indemnityRates } = props;
    const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'matchDate', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<AccountingStatus | 'all'>('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [paymentForDetails, setPaymentForDetails] = useState<Payment | null>(null);
    const [isBulkNotesModalOpen, setIsBulkNotesModalOpen] = useState(false);
    const [bulkNote, setBulkNote] = useState('');
    const [alertModalInfo, setAlertModalInfo] = useState<{title: string, message: string} | null>(null);

    const canEditNotes = permissions.can('edit', 'payment');

    const filteredPayments = useMemo(() => {
        return payments.filter(payment => {
            if (statusFilter !== 'all' && payment.accountingStatus !== statusFilter) return false;
            if (dateRange.start && payment.matchDate < dateRange.start) return false;
            if (dateRange.end && payment.matchDate > dateRange.end) return false;
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                if (!payment.officialName.toLowerCase().includes(lowerTerm) && !payment.matchDescription.toLowerCase().includes(lowerTerm)) {
                    return false;
                }
            }
            return true;
        });
    }, [payments, statusFilter, dateRange, searchTerm]);

    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.full_name])), [users]);

    const sortedPayments = useMemo(() => {
        let sortableItems = [...filteredPayments];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'validator') {
                    aValue = a.validatedByUserId ? userMap.get(a.validatedByUserId) || '' : '';
                    bValue = b.validatedByUserId ? userMap.get(b.validatedByUserId) || '' : '';
                } else {
                    aValue = a[sortConfig.key as keyof Payment];
                    bValue = b[sortConfig.key as keyof Payment];
                }

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                } else {
                    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
            });
        }
        return sortableItems;
    }, [filteredPayments, sortConfig, userMap]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedPaymentIds(new Set(sortedPayments.map(p => p.id)));
        } else {
            setSelectedPaymentIds(new Set());
        }
    };

    const handleSelectOne = (id: string) => {
        const newSelection = new Set(selectedPaymentIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedPaymentIds(newSelection);
    };
    
    const handleSaveBulkNotes = () => {
        const updates = Array.from(selectedPaymentIds).map(id => ({ id, notes: bulkNote }));
        onBulkUpdatePaymentNotes(updates);
        setIsBulkNotesModalOpen(false);
        setSelectedPaymentIds(new Set());
        setBulkNote('');
    };
    
    const handleExport = () => {
        const result = exportPaymentsToExcel(sortedPayments, users);
        if (!result.success) {
            setAlertModalInfo({title: "Exportation Impossible", message: result.error!});
        }
    }

    const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'DZD' }).format(amount);

    const stats = useMemo(() => {
        return payments.reduce((acc, p) => {
            acc.totalGross += p.indemnity;
            acc.totalIrg += p.irgAmount;
            acc.totalNet += p.total;
            if(p.accountingStatus === AccountingStatus.VALIDATED) acc.readyToPayCount++;
            return acc;
        }, { totalGross: 0, totalIrg: 0, totalNet: 0, readyToPayCount: 0 });
    }, [payments]);
    
    const accountingStatusConfig: Record<AccountingStatus, { text: string; color: string; icon: React.ReactNode }> = {
        [AccountingStatus.NOT_ENTERED]: { text: 'Non saisi', color: 'bg-gray-700 text-gray-300', icon: <PencilIcon className="w-4 h-4 mr-1.5"/> },
        [AccountingStatus.REJECTED]: { text: 'Rejeté', color: 'bg-red-900 text-red-300', icon: <XMarkIcon className="w-4 h-4 mr-1.5"/> },
        [AccountingStatus.PENDING_VALIDATION]: { text: 'En validation', color: 'bg-blue-900 text-blue-300', icon: <ClockIcon className="w-4 h-4 mr-1.5"/> },
        [AccountingStatus.VALIDATED]: { text: 'Prêt à payer', color: 'bg-green-900 text-green-300', icon: <CheckCircleIcon className="w-4 h-4 mr-1.5"/> },
        [AccountingStatus.CLOSED]: { text: 'Clôturé', color: 'bg-purple-900 text-purple-300', icon: <LockClosedIcon className="w-4 h-4 mr-1.5"/> },
    };


    return (
        <>
            <main className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center mb-6">
                    <CurrencyIcon className="h-8 w-8 text-brand-primary mr-3" />
                    <h2 className="text-3xl font-bold text-white">Finances</h2>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Total Indemnités Brutes</p><p className="text-2xl font-bold text-white">{formatCurrency(stats.totalGross)}</p></div>
                    <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Total IRG Retenu</p><p className="text-2xl font-bold text-white">{formatCurrency(stats.totalIrg)}</p></div>
                    <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Total Net à Payer</p><p className="text-2xl font-bold text-brand-primary">{formatCurrency(stats.totalNet)}</p></div>
                    <div className="bg-gray-800 p-4 rounded-lg"><p className="text-sm text-gray-400">Paiements Prêts</p><p className="text-2xl font-bold text-white">{stats.readyToPayCount}</p></div>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div className="relative flex-grow w-full sm:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="h-5 w-5 text-gray-400" /></div>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher par officiel ou match..." className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white"/>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="w-full sm:w-auto bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white">
                            <option value="all">Tous les statuts</option>
                            {Object.entries(accountingStatusConfig).map(([key, {text}]) => <option key={key} value={key}>{text}</option>)}
                        </select>
                        <div className="w-full sm:w-auto"><DatePicker value={dateRange.start} onChange={d => setDateRange(p => ({...p, start: d}))} /></div>
                        <div className="w-full sm:w-auto"><DatePicker value={dateRange.end} onChange={d => setDateRange(p => ({...p, end: d}))} /></div>
                        <button onClick={handleExport} className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-700"><DownloadIcon className="h-5 w-5 mr-2" /> Exporter</button>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="p-4"><input type="checkbox" checked={selectedPaymentIds.size === sortedPayments.length && sortedPayments.length > 0} onChange={handleSelectAll} disabled={!canEditNotes} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary"/></th>
                                    <th onClick={() => handleSort('officialName')} className="cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Officiel</th>
                                    <th onClick={() => handleSort('matchDescription')} className="cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Match</th>
                                    <th onClick={() => handleSort('total')} className="cursor-pointer px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Total Net</th>
                                    <th onClick={() => handleSort('accountingStatus')} className="cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Statut</th>
                                    <th onClick={() => handleSort('validator')} className="cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Validé par</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {sortedPayments.map(p => {
                                    const statusStyle = accountingStatusConfig[p.accountingStatus];
                                    return (
                                        <tr key={p.id} className={`transition-colors ${selectedPaymentIds.has(p.id) ? 'bg-brand-primary/10' : 'hover:bg-gray-700/50'}`}>
                                            <td className="p-4"><input type="checkbox" checked={selectedPaymentIds.has(p.id)} onChange={() => handleSelectOne(p.id)} disabled={!canEditNotes} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary"/></td>
                                            <td className="px-6 py-4"><div className="text-sm font-medium text-white">{p.officialName}</div><div className="text-xs text-gray-400">{p.role}</div></td>
                                            <td className="px-6 py-4"><div className="text-sm text-gray-300">{p.matchDescription}</div><div className="text-xs text-gray-400">{new Date(p.matchDate).toLocaleDateString('fr-FR')}</div></td>
                                            <td className="px-6 py-4 text-right font-semibold text-brand-primary">{formatCurrency(p.total)}</td>
                                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.color}`}>{statusStyle.icon}{statusStyle.text}</span></td>
                                            <td className="px-6 py-4 text-sm text-gray-300">{p.validatedByUserId ? userMap.get(p.validatedByUserId) : 'N/A'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-400 italic">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate" title={p.notes || ''}>{p.notes || 'Aucune note'}</span>
                                                    <button onClick={() => setPaymentForDetails(p)} className="p-1 text-gray-500 hover:text-white"><PencilIcon className="h-4 w-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {selectedPaymentIds.size > 0 && canEditNotes && (
                <div className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-20 animate-fade-in-up">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <p className="text-white font-medium">{selectedPaymentIds.size} paiement(s) sélectionné(s)</p>
                        <div className="flex items-center gap-x-4">
                            <button onClick={() => setIsBulkNotesModalOpen(true)} className="flex items-center text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg"><PencilIcon className="h-4 w-4 mr-2"/> Ajouter une note</button>
                            <button onClick={() => setSelectedPaymentIds(new Set())} className="p-2 text-gray-400 hover:text-white rounded-full"><CloseIcon className="h-5 w-5"/></button>
                        </div>
                    </div>
                </div>
            )}

            <PaymentDetailsModal 
                isOpen={!!paymentForDetails}
                onClose={() => setPaymentForDetails(null)}
                onSaveNotes={onUpdatePaymentNotes}
                payment={paymentForDetails}
                currentUser={currentUser}
                users={users}
                permissions={permissions}
                matches={matches}
                officials={officials}
                locations={locations}
                indemnityRates={indemnityRates}
            />
             <BulkNotesModal
                isOpen={isBulkNotesModalOpen}
                onClose={() => setIsBulkNotesModalOpen(false)}
                onSave={handleSaveBulkNotes}
                note={bulkNote}
                setNote={setBulkNote}
                count={selectedPaymentIds.size}
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

export default FinancesView;
