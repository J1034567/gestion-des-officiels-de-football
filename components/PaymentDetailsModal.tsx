import React, { useState, useEffect, useMemo } from 'react';
import { Payment, User, Match, Official, Location, AccountingStatus, IndemnityRates } from '../types';
import CloseIcon from './icons/CloseIcon';
import { Permissions } from '../hooks/usePermissions';
import CurrencyIcon from './icons/CurrencyIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ClockIcon from './icons/ClockIcon';
import XMarkIcon from './icons/XMarkIcon';
import LockClosedIcon from './icons/LockClosedIcon';
import PencilIcon from './icons/PencilIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNotes: (assignmentId: string, notes: string | null) => void;
  payment: Payment | null;
  currentUser: User;
  users: User[];
  permissions: Permissions;
  matches: Match[];
  officials: Official[];
  locations: Location[];
  indemnityRates: IndemnityRates;
}

const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = (props) => {
  const { 
      isOpen, onClose, onSaveNotes, payment, 
      currentUser, users, permissions, matches, officials, locations, indemnityRates
  } = props;
  
  const [notes, setNotes] = useState('');

  const canEditNotes = permissions.can('edit', 'payment');

  useEffect(() => {
    if (isOpen && payment) {
      setNotes(payment.notes || '');
    } else {
      setNotes('');
    }
  }, [isOpen, payment]);
  
  const handleSave = () => {
    if (payment) {
        onSaveNotes(payment.id, notes);
        onClose();
    }
  };


  const match = useMemo(() => matches.find(m => m.id === payment?.matchId), [matches, payment]);
  const official = useMemo(() => officials.find(o => o.id === payment?.officialId), [officials, payment]);
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'DZD' }).format(amount);

  const indemnityBreakdown = useMemo(() => {
    if (!payment || !match) return null;
    
    const rateIndemnity = indemnityRates[match.leagueGroup.league.id]?.[payment.role] ?? 0;
    const distanceBonus = (payment.travelDistanceInKm > 1000) ? 10000 : 0;
    const adjustment = payment.indemnity - rateIndemnity - distanceBonus;
    
    return { rateIndemnity, distanceBonus, adjustment };
  }, [payment, match, indemnityRates]);


  if (!isOpen || !payment) return null;


  const StatusInfo: React.FC<{ status: AccountingStatus, validatedByName?: string, validatedAt?: string, match: Match | undefined }> = ({ status, validatedByName, validatedAt, match }) => {
    const statusConfig: Record<AccountingStatus, { text: string; color: string; icon: React.ReactNode; description: string }> = {
        [AccountingStatus.NOT_ENTERED]: { text: 'En attente de saisie', color: 'text-gray-300', icon: <PencilIcon className="w-5 h-5"/>, description: "Les informations financières n'ont pas encore été saisies dans le module de comptabilité." },
        [AccountingStatus.REJECTED]: { text: 'Rejeté', color: 'text-red-400', icon: <XMarkIcon className="w-5 h-5"/>, description: "La saisie a été rejetée et doit être corrigée par le service de saisie." },
        [AccountingStatus.PENDING_VALIDATION]: { text: 'En attente de validation', color: 'text-blue-400', icon: <ClockIcon className="w-5 h-5"/>, description: "Les informations ont été saisies et sont en attente de validation par un comptable validateur." },
        [AccountingStatus.VALIDATED]: { text: 'Prêt à payer', color: 'text-green-400', icon: <CheckCircleIcon className="w-5 h-5"/>, description: `Validé par ${validatedByName || 'N/A'} le ${validatedAt ? new Date(validatedAt).toLocaleDateString('fr-FR') : 'N/A'}. Ce paiement peut être exécuté.` },
        [AccountingStatus.CLOSED]: { text: 'Payé et Clôturé', color: 'text-purple-400', icon: <LockClosedIcon className="w-5 h-5"/>, description: "Ce paiement a été exécuté et la période comptable a été clôturée. Aucune autre action n'est requise." },
    };

    const config = statusConfig[status];

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <div className={`flex items-center gap-3 font-semibold text-lg ${config.color}`}>
                {config.icon}
                <span>{config.text}</span>
            </div>
            <p className="text-sm text-gray-400 mt-2 pl-8">{config.description}</p>
            {status === AccountingStatus.REJECTED && match && (
                <div className="mt-2 pl-8 text-sm text-red-300 bg-red-900/30 p-2 rounded-md border-l-2 border-red-500">
                    <p><strong>Motif:</strong> {match.rejectionReason}</p>
                    {match.rejectionComment && <p className="italic">"{match.rejectionComment}"</p>}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Détails du Paiement</h2>
            <p className="text-sm text-gray-400">Suivi et notes pour le paiement de {payment.officialName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6"/>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <StatusInfo status={payment.accountingStatus} validatedByName={payment.validatedByName} validatedAt={payment.validatedAt} match={match} />
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center"><CurrencyIcon className="h-6 w-6 mr-2 text-brand-primary"/>Résumé Financier</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-800 p-3 rounded-md space-y-2 sm:col-span-2">
                        <p className="text-gray-400 font-semibold">Détail Indemnité</p>
                        <div className="flex justify-between"><span className="text-gray-400">Base:</span> <span className="font-mono">{formatCurrency(indemnityBreakdown?.rateIndemnity ?? 0)}</span></div>
                        {indemnityBreakdown?.distanceBonus > 0 && (
                            <div className="flex justify-between"><span className="text-gray-400">Bonus Dist.:</span> <span className="font-mono text-green-400">{formatCurrency(indemnityBreakdown.distanceBonus)}</span></div>
                        )}
                        {indemnityBreakdown?.adjustment !== 0 && (
                            <div className="flex justify-between"><span className="text-gray-400">Ajustement:</span> <span className={`font-mono ${indemnityBreakdown.adjustment > 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(indemnityBreakdown.adjustment)}</span></div>
                        )}
                        <div className="flex justify-between border-t border-gray-700 pt-2 mt-2 font-semibold">
                            <span className="text-gray-300">Total Brut:</span>
                            <span className="text-white">{formatCurrency(payment.indemnity)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-red-400">Déduction IRG:</span>
                            <span className="font-mono text-red-400">-{formatCurrency(payment.irgAmount)}</span>
                        </div>
                    </div>
                </div>
                 <div className="mt-4 text-right bg-gray-800 p-3 rounded-md">
                    <p className="text-gray-400 text-md">Total Net à Payer</p>
                    <p className="text-brand-primary font-bold text-2xl">{formatCurrency(payment.total)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Les montants sont finaux et ne peuvent être modifiés que via le module de comptabilité avant validation.</p>
            </div>
            
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <label htmlFor="payment-notes" className="block text-lg font-semibold text-white mb-2">Notes de Paiement</label>
                <textarea
                    id="payment-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    disabled={!canEditNotes}
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary disabled:opacity-60"
                    placeholder={canEditNotes ? "Ajouter une note (ex: Virement du 25/10, Réf #12345)" : "Aucune note."}
                />
                {!canEditNotes && <p className="text-xs text-gray-500 mt-1">Vous n'avez pas la permission de modifier les notes.</p>}
            </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">
            Fermer
          </button>
          {canEditNotes && (
             <button
                type="button"
                onClick={handleSave}
                className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg"
             >
                Sauvegarder les notes
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsModal;