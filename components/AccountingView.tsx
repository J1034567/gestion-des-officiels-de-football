import React, { useState, useMemo, useEffect } from 'react';
import { Match, AccountingPeriod, User, AccountingStatus, MatchStatus, Assignment, Official, Location, League, LeagueGroup, AccountingPeriodType, IndemnityRates, OfficialRole, FinancialSettings } from '../types';
import { Permissions } from '../hooks/usePermissions';
import AccountingIcon from './icons/AccountingIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import CheckIcon from './icons/CheckIcon';
import XMarkIcon from './icons/XMarkIcon';
import LockClosedIcon from './icons/LockClosedIcon';
import CloseIcon from './icons/CloseIcon';
import UndoIcon from './icons/UndoIcon';
import ConfirmationModal from './ConfirmationModal';
import CheckCircleIcon from './icons/CheckCircleIcon';
import SearchIcon from './icons/SearchIcon';
import AccountingEntryModal from './AccountingEntryModal';
import DownloadIcon from './icons/DownloadIcon';
import { exportMonthlySummaryToExcel } from '../services/exportService';
import PencilIcon from './icons/PencilIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

// --- TYPE DEFINITIONS ---

interface AccountingViewProps {
    matches: Match[];
    officials: Official[];
    accountingPeriods: AccountingPeriod[];
    currentUser: User;
    permissions: Permissions;
    locations: Location[];
    leagues: League[];
    leagueGroups: LeagueGroup[];
    indemnityRates: IndemnityRates;
    financialSettings: FinancialSettings | null;
    rejectionReasons: string[];
    officialRoles: OfficialRole[];
    onSubmit: (matchId: string, scores: { home: number, away: number } | null, updatedAssignments: Assignment[]) => void;
    onValidate: (matchId: string) => void;
    onReject: (matchId: string, reason: string, comment: string) => void;
    onReopenGameDay: (periodId: string) => Promise<void>;
    onCloseMonth: (month: string) => Promise<void>;
    onReopenMonth: (periodId: string) => Promise<void>;
}

type GameDayKey = string; // e.g., `${league.id}-${group.id}-${match.gameDay}`
interface ValidatedGameDayGroup {
    key: GameDayKey;
    leagueName: string;
    groupName: string;
    gameDay: number;
    matchDate: string | null;
    matches: Match[];
    totalMatchesInGameDay: number;
}

interface MonthGroup {
    month: string; // YYYY-MM
    dailyPeriods: AccountingPeriod[];
    monthlyPeriod: AccountingPeriod | null;
    totalMatchesInMonth: number;
    closedMatchesInMonth: number;
}

// --- KANBAN VIEW COMPONENTS ---

const KanbanColumn: React.FC<{ title: string; count: number; children: React.ReactNode; status: AccountingStatus }> = ({ title, count, children, status }) => {
    const statusColors: Record<AccountingStatus, string> = {
        [AccountingStatus.NOT_ENTERED]: 'border-gray-500',
        [AccountingStatus.REJECTED]: 'border-red-500',
        [AccountingStatus.PENDING_VALIDATION]: 'border-blue-500',
        [AccountingStatus.VALIDATED]: 'border-green-500',
        [AccountingStatus.CLOSED]: 'border-purple-500',
    };

    return (
        <div className="flex-1 min-w-[320px] bg-gray-900/50 rounded-lg flex flex-col">
            <div className={`p-4 border-b-2 ${statusColors[status]}`}>
                <h3 className="font-semibold text-white">{title} <span className="text-sm font-normal text-gray-400">({count})</span></h3>
            </div>
            <div className="p-4 space-y-4 flex-grow overflow-y-auto" style={{maxHeight: 'calc(100vh - 20rem)'}}>
                {children}
            </div>
        </div>
    );
};

interface KanbanCardProps {
    match: Match;
    onClick: () => void;
    permissions: Permissions;
    officials: Official[];
    officialRoles: OfficialRole[];
}

const KanbanCard: React.FC<KanbanCardProps> = ({ match, onClick, permissions, officials, officialRoles }) => {
    
    const canTakeAction = 
        permissions.can('submit_accounting', 'accounting', match) ||
        permissions.can('validate_accounting', 'accounting', match) ||
        permissions.can('reject_accounting', 'accounting', match);

    const getActionText = () => {
        if (match.status === MatchStatus.SCHEDULED) {
            return 'Saisir le score';
        }
        switch (match.accountingStatus) {
            case AccountingStatus.NOT_ENTERED: return 'Saisir les informations';
            case AccountingStatus.REJECTED: return 'Corriger les informations';
            case AccountingStatus.PENDING_VALIDATION: return 'Valider / Rejeter';
            case AccountingStatus.VALIDATED: return 'Voir les détails';
            case AccountingStatus.CLOSED: return 'Voir les détails';
            default: return 'Gérer';
        }
    }
    
    const getOfficialById = (id: string | null) => officials.find(o => o.id === id);

    const sortedAssignments = [...match.assignments].sort((a, b) => {
        return officialRoles.indexOf(a.role) - officialRoles.indexOf(b.role);
    });


    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-700/50 transition-colors" onClick={onClick}>
            <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex-grow min-w-0">
                    <p className="font-semibold text-white truncate">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                    <p className="text-xs text-gray-400">{new Date(match.matchDate!).toLocaleDateString('fr-FR')}</p>
                </div>
                {(match.homeScore !== null && match.awayScore !== null) && (
                    <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-brand-primary whitespace-nowrap">{match.homeScore} - {match.awayScore}</p>
                    </div>
                )}
            </div>
            
            <div className="border-t border-gray-700 my-3"></div>

            <div className="space-y-1 text-sm">
                {sortedAssignments.length > 0 ? sortedAssignments.map(assignment => {
                    const official = getOfficialById(assignment.officialId);
                    return (
                        <div key={assignment.id} className="flex justify-between items-center gap-2">
                            <span className="text-gray-400 flex-shrink-0">{assignment.role}:</span>
                            <span className="font-medium text-white text-right truncate" title={official?.fullName}>{official ? official.fullName : <span className="text-gray-500 italic">Non assigné</span>}</span>
                        </div>
                    );
                }) : (
                     <p className="text-xs text-gray-500 italic text-center">Aucun officiel assigné.</p>
                )}
            </div>

             {match.accountingStatus === AccountingStatus.REJECTED && (
                <div className="mt-3 p-2 bg-red-900/50 rounded-md text-red-300 text-xs">
                    <p><strong>Rejeté :</strong> {match.rejectionReason}</p>
                    {match.rejectionComment && <p className="italic pl-2">- {match.rejectionComment}</p>}
                </div>
            )}
            {match.accountingStatus === AccountingStatus.VALIDATED && match.validatedByName && (
                <div className="mt-3 p-2 bg-green-900/50 rounded-md text-green-300 text-xs flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>Validé par {match.validatedByName}</span>
                </div>
            )}

            <div className="mt-4 text-right">
                <span className={`text-sm font-medium py-1 px-2 rounded-md ${canTakeAction || match.accountingStatus === AccountingStatus.VALIDATED || match.accountingStatus === AccountingStatus.CLOSED ? 'bg-brand-primary/20 text-brand-primary' : 'bg-gray-700 text-gray-300'}`}>
                    {getActionText()}
                </span>
            </div>
        </div>
    );
};

// --- MODAL COMPONENTS ---

interface ValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidate: (matchId: string) => void;
    onReject: (matchId: string, reason: string, comment: string) => void;
    match: Match | null;
    rejectionReasons: string[];
    officials: Official[];
    indemnityRates: IndemnityRates;
    financialSettings: FinancialSettings | null;
}


const ValidationModal: React.FC<ValidationModalProps> = ({ isOpen, onClose, onValidate, onReject, match, rejectionReasons, officials, indemnityRates, financialSettings }) => {
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectionComment, setRejectionComment] = useState('');
    const [error, setError] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            setRejectionReason('');
            setRejectionComment('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen || !match) return null;
    
    const handleReject = () => {
        if (!rejectionReason.trim()) {
            setError('Un motif de rejet doit être sélectionné.');
            return;
        }
        onReject(match.id, rejectionReason.trim(), rejectionComment.trim());
        onClose();
    };
    
    const handleValidate = () => {
        onValidate(match.id);
        onClose();
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount);
    
    const totalMatchNet = match.assignments.reduce((sum, a) => {
        const rateIndemnity = indemnityRates[match.leagueGroup.league.id]?.[a.role] ?? 0;
        const irgRate = (financialSettings?.irgRatePercent ?? 0) / 100;
        const irgAmount = Math.round(rateIndemnity * irgRate);
        return sum + (a.indemnityAmount || 0) - irgAmount;
    }, 0);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Validation Comptable</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6"/></button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                     <p className="text-sm text-gray-300">Vérifiez les informations saisies avant de valider ou rejeter.</p>
                     
                     {match.rejectionReason && (
                        <div className="bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-300 p-4 rounded-r-lg" role="alert">
                            <div className="flex">
                                <div className="py-1"><AlertTriangleIcon className="h-5 w-5 mr-3"/></div>
                                <div>
                                    <p className="font-bold">Ce match a été rejeté précédemment.</p>
                                    <p className="text-sm mt-1"><strong>Motif :</strong> {match.rejectionReason}</p>
                                    {match.rejectionComment && <p className="text-sm mt-1"><strong>Commentaire :</strong> <em>"{match.rejectionComment}"</em></p>}
                                    <p className="text-xs mt-2 text-yellow-400">Veuillez vérifier que les corrections demandées ont été apportées.</p>
                                </div>
                            </div>
                        </div>
                     )}

                     <div className="bg-gray-900/50 p-4 rounded-lg space-y-2">
                        <p className="font-semibold text-white">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                        <p className="text-lg font-mono text-center">{match.homeScore} - {match.awayScore}</p>
                     </div>
                     
                     <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-white">Détail des Paiements ({formatCurrency(totalMatchNet)} DZD Net)</h4>
                        {match.assignments.map(a => {
                            const official = officials.find(o => o.id === a.officialId);
                            if (!official) return null;
                            
                            const rateIndemnity = indemnityRates[match.leagueGroup.league.id]?.[a.role] ?? 0;
                            const irgRate = (financialSettings?.irgRatePercent ?? 0) / 100;
                            const irgAmount = Math.round(rateIndemnity * irgRate);
                            const netAmount = (a.indemnityAmount || 0) - irgAmount;

                            return (
                                <div key={a.id} className="bg-gray-800 p-3 rounded-md border-l-2 border-gray-700">
                                    <p className="font-semibold text-white flex items-center">{official.fullName} <span className="text-xs text-gray-400 ml-2">({a.role})</span>
                                     {(a.notes && a.notes.trim() !== '') && <PencilIcon className="h-4 w-4 text-yellow-400 ml-2" title="Note ajoutée"/>}
                                    </p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                                        <span className="font-bold text-gray-300 border-t border-gray-700 pt-1 mt-1 col-span-1">Total Brut:</span>
                                        <span className="text-right font-bold text-gray-200 border-t border-gray-700 pt-1 mt-1 col-span-1">{formatCurrency(a.indemnityAmount || 0)} DZD</span>
                                        
                                        <div className="col-span-2 flex justify-between items-center text-red-400">
                                            <span>Déduction IRG ({formatCurrency(rateIndemnity)} x {financialSettings?.irgRatePercent ?? 0}%)</span>
                                            <span className="font-mono">-{formatCurrency(irgAmount)} DZD</span>
                                        </div>

                                        <span className="font-bold text-gray-300 border-t border-gray-600 pt-1 mt-1 col-span-1">Total Net:</span>
                                        <span className="text-right font-bold text-brand-primary border-t border-gray-600 pt-1 mt-1 col-span-1">{formatCurrency(netAmount)} DZD</span>
                                    </div>
                                    {a.notes && <p className="text-xs italic text-yellow-300 mt-2 bg-yellow-900/30 p-1.5 rounded-md">Note: {a.notes}</p>}
                                </div>
                            )
                        })}
                    </div>
                     
                     <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Motif du rejet <span className="text-red-400">*</span></label>
                        <select
                            value={rejectionReason}
                            onChange={e => { setRejectionReason(e.target.value); if(e.target.value) setError(''); }}
                            className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                        >
                            <option value="">Sélectionner un motif pour rejeter...</option>
                            {rejectionReasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {error && !rejectionReason && <p className="text-red-400 text-xs mt-1">{error}</p>}
                     </div>
                     <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Commentaire additionnel (optionnel)</label>
                        <textarea value={rejectionComment} onChange={e => setRejectionComment(e.target.value)} placeholder="Ajouter des précisions..." rows={3} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary" />
                     </div>
                </div>
                <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Annuler</button>
                    <button 
                        onClick={handleReject} 
                        disabled={!rejectionReason.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed">
                        <XMarkIcon className="h-5 w-5"/> Rejeter
                    </button>
                    {!rejectionReason.trim() && (
                         <button 
                            onClick={handleValidate} 
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                            <CheckIcon className="h-5 w-5"/> Valider
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const AccountingView: React.FC<AccountingViewProps> = (props) => {
    const [view, setView] = useState<'kanban' | 'closure'>('kanban');
    
    // Modal states
    const [entryModalMatch, setEntryModalMatch] = useState<Match | null>(null);
    const [validationModalMatch, setValidationModalMatch] = useState<Match | null>(null);
    
    // Filter states
    const [teamSearchTerm, setTeamSearchTerm] = useState('');
    const [monthFilter, setMonthFilter] = useState('all');
    const [gameDayFilter, setGameDayFilter] = useState('');

    // UI states
    const [processingId, setProcessingId] = useState<string | null>(null);

    const {
        matches, accountingPeriods, permissions, leagues, leagueGroups, officials,
        onReopenGameDay, onCloseMonth, onReopenMonth
    } = props;

    const allRelevantMatches = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return matches.filter(m => {
            if (m.isArchived) return false;
            
            // If a match is already in the accounting workflow (e.g. REJECTED), it must be displayed
            // so it can be corrected.
            if (m.accountingStatus !== AccountingStatus.NOT_ENTERED) return true;
            
            // For matches NOT YET in the accounting workflow:
            
            // 1. It must have a date to be considered. Unscheduled matches are ignored.
            if (!m.matchDate) {
                return false;
            }
            
            const matchDate = new Date(m.matchDate);
            
            // 2. If it's scheduled for the future, it's not ready for accounting yet.
            if (m.status === MatchStatus.SCHEDULED && matchDate > today) {
                return false;
            }
            
            // 3. Cancelled matches should not enter the accounting workflow.
            if (m.status === MatchStatus.CANCELLED) {
                return false;
            }

            return true;
        });
    }, [matches]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        allRelevantMatches.forEach(match => {
            if (match.matchDate) {
                months.add(match.matchDate.substring(0, 7)); // YYYY-MM
            }
        });
        return Array.from(months).sort().reverse();
    }, [allRelevantMatches]);

    const filteredMatches = useMemo(() => {
        return allRelevantMatches.filter(m => {
            if (teamSearchTerm) {
                const lowerTerm = teamSearchTerm.toLowerCase();
                if (!m.homeTeam.name.toLowerCase().includes(lowerTerm) && !m.awayTeam.name.toLowerCase().includes(lowerTerm)) {
                    return false;
                }
            }
            return true;
        })
    }, [allRelevantMatches, teamSearchTerm]);

    const kanbanMatches = useMemo(() => {
        const columns: Record<AccountingStatus, Match[]> = {
            [AccountingStatus.NOT_ENTERED]: [],
            [AccountingStatus.REJECTED]: [],
            [AccountingStatus.PENDING_VALIDATION]: [],
            [AccountingStatus.VALIDATED]: [],
            [AccountingStatus.CLOSED]: [],
        };
        filteredMatches.forEach(m => {
            if (columns[m.accountingStatus]) {
                columns[m.accountingStatus].push(m);
            }
        });
        return columns;
    }, [filteredMatches]);

    const validatedGameDays = useMemo(() => {
        return [];
    }, [filteredMatches, leagues, leagueGroups, accountingPeriods]);

    const monthGroups = useMemo(() => {
        const monthsMap = new Map<string, MonthGroup>();

        // Initialize with all matches to get total counts
        allRelevantMatches.forEach(match => {
            if (match.matchDate) {
                const month = match.matchDate.substring(0, 7);
                if (!monthsMap.has(month)) {
                    monthsMap.set(month, { month, dailyPeriods: [], monthlyPeriod: null, totalMatchesInMonth: 0, closedMatchesInMonth: 0 });
                }
                const group = monthsMap.get(month)!;
                group.totalMatchesInMonth++;
                if (match.accountingStatus === AccountingStatus.CLOSED) {
                    group.closedMatchesInMonth++;
                }
            }
        });

        // Add period info
        accountingPeriods.forEach(period => {
            const month = period.periodDate.substring(0, 7);
            if (monthsMap.has(month)) {
                if (period.type === AccountingPeriodType.DAILY) {
                    monthsMap.get(month)!.dailyPeriods.push(period);
                } else if (period.type === AccountingPeriodType.MONTHLY) {
                    monthsMap.get(month)!.monthlyPeriod = period;
                }
            }
        });

        return Array.from(monthsMap.values()).sort((a, b) => b.month.localeCompare(a.month));
    }, [allRelevantMatches, accountingPeriods]);

    const handleOpenModal = (match: Match) => {
        const canValidate = permissions.can('validate_accounting', 'accounting', match);
        const canSubmit = permissions.can('submit_accounting', 'accounting', match);

        switch (match.accountingStatus) {
            case AccountingStatus.NOT_ENTERED:
            case AccountingStatus.REJECTED:
                // Users who can submit should get the entry modal.
                // Others will see a read-only view. The entry modal handles this via its `readOnly` prop.
                setEntryModalMatch(match);
                break;

            case AccountingStatus.PENDING_VALIDATION:
                if (canValidate) {
                    // Users who can validate get the validation modal.
                    setValidationModalMatch(match);
                } else {
                    // Others see a read-only view. The entry modal is best for this.
                    setEntryModalMatch(match);
                }
                break;
            
            case AccountingStatus.VALIDATED:
            case AccountingStatus.CLOSED:
                // For validated or closed, always show a read-only view of the details.
                // The Entry modal is designed for this with its readOnly prop.
                setEntryModalMatch(match);
                break;
                
            default:
                // Fallback, should not happen
                console.warn(`Unhandled accounting status: ${match.accountingStatus}`);
                break;
        }
    };
    
    return (
    <>
        <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center mb-6">
                <AccountingIcon className="h-8 w-8 text-brand-primary mr-3" />
                <h2 className="text-3xl font-bold text-white">Gestion de la Comptabilité</h2>
            </div>
            <div className="border-b border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setView('kanban')} className={`${view === 'kanban' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                        Tableau de Saisie (Kanban)
                    </button>
                    <button onClick={() => setView('closure')} className={`${view === 'closure' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                        Clôtures Périodiques
                    </button>
                </nav>
            </div>

            {view === 'kanban' && (
                <div className="space-y-6">
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input 
                                type="text" 
                                value={teamSearchTerm}
                                onChange={e => setTeamSearchTerm(e.target.value)}
                                placeholder="Rechercher par nom d'équipe..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white"
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-6 overflow-x-auto pb-4">
                        <KanbanColumn title="À Saisir" count={kanbanMatches[AccountingStatus.NOT_ENTERED].length} status={AccountingStatus.NOT_ENTERED}>
                            {kanbanMatches[AccountingStatus.NOT_ENTERED].map(match => (
                                <KanbanCard key={match.id} match={match} onClick={() => handleOpenModal(match)} permissions={permissions} officials={officials} officialRoles={props.officialRoles} />
                            ))}
                        </KanbanColumn>
                        <KanbanColumn title="Rejeté (à corriger)" count={kanbanMatches[AccountingStatus.REJECTED].length} status={AccountingStatus.REJECTED}>
                            {kanbanMatches[AccountingStatus.REJECTED].map(match => (
                                <KanbanCard key={match.id} match={match} onClick={() => handleOpenModal(match)} permissions={permissions} officials={officials} officialRoles={props.officialRoles} />
                            ))}
                        </KanbanColumn>
                         <KanbanColumn title="En Attente de Validation" count={kanbanMatches[AccountingStatus.PENDING_VALIDATION].length} status={AccountingStatus.PENDING_VALIDATION}>
                            {kanbanMatches[AccountingStatus.PENDING_VALIDATION].map(match => (
                                <KanbanCard key={match.id} match={match} onClick={() => handleOpenModal(match)} permissions={permissions} officials={officials} officialRoles={props.officialRoles} />
                            ))}
                        </KanbanColumn>
                         <KanbanColumn title="Validé (Prêt à Payer)" count={kanbanMatches[AccountingStatus.VALIDATED].length} status={AccountingStatus.VALIDATED}>
                           {kanbanMatches[AccountingStatus.VALIDATED].map(match => (
                                <KanbanCard key={match.id} match={match} onClick={() => handleOpenModal(match)} permissions={permissions} officials={officials} officialRoles={props.officialRoles} />
                            ))}
                        </KanbanColumn>
                    </div>
                </div>
            )}
             {view === 'closure' && (
                <p className="text-gray-400">Vue de clôture en cours de développement.</p>
             )}
        </main>
        
        <AccountingEntryModal
            isOpen={!!entryModalMatch}
            onClose={() => setEntryModalMatch(null)}
            onSave={props.onSubmit}
            match={entryModalMatch}
            allMatches={props.matches}
            officials={props.officials}
            locations={props.locations}
            indemnityRates={props.indemnityRates}
            officialRoles={props.officialRoles}
            readOnly={!entryModalMatch || !(permissions.can('submit_accounting', 'accounting', entryModalMatch)) || entryModalMatch.accountingStatus === AccountingStatus.VALIDATED || entryModalMatch.accountingStatus === AccountingStatus.CLOSED}
        />

        <ValidationModal
            isOpen={!!validationModalMatch}
            onClose={() => setValidationModalMatch(null)}
            onValidate={props.onValidate}
            onReject={props.onReject}
            match={validationModalMatch}
            rejectionReasons={props.rejectionReasons}
            officials={props.officials}
            indemnityRates={props.indemnityRates}
            financialSettings={props.financialSettings}
        />
    </>
    );
};
export default AccountingView;