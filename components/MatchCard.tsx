





import React, { useState, useMemo, useCallback } from 'react';
import { Match, Official, OfficialRole, Assignment, MatchStatus, User, AccountingStatus, Location } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import LocationPinIcon from './icons/LocationPinIcon';
import OfficialAssignment from './OfficialAssignment';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import PlusIcon from './icons/PlusIcon';
import ConfirmationModal from './ConfirmationModal';
import { Permissions } from '../hooks/usePermissions';

interface MatchCardProps {
  match: Match;
  officials: Official[];
  users: User[];
  officialRoles: OfficialRole[];
  locations: Location[];
  onAssign?: (matchId: string, assignmentId: string, role: OfficialRole) => void;
  onEdit?: (match: Match) => void;
  onSendSheet?: (match: Match) => Promise<void>;
  onNotifyChanges?: (match: Match) => Promise<void>;
  onAddAssignment?: (matchId: string, role: OfficialRole) => void;
  onRemoveAssignment?: (matchId: string, assignmentId: string) => void;
  onUpdateMatchStatus: (matchId: string, status: MatchStatus) => void;
  onOpenScoreModal: (match: Match) => void;
  onMarkOfficialAbsent?: (matchId: string, assignmentId: string) => void;
  onArchiveMatch: (matchId: string) => void;
  onOpenStadiumModal?: (match: Match) => void;
  currentUser: User;
  permissions: Permissions;
  viewContext: 'assignments' | 'matches';
  isSelected: boolean;
  onSelect: (matchId: string) => void;
}

const statusColors: { [key in MatchStatus]: { bg: string, text: string, border: string } } = {
  [MatchStatus.COMPLETED]: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-500' },
  [MatchStatus.SCHEDULED]: { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-transparent' },
  [MatchStatus.POSTPONED]: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-500' },
  [MatchStatus.CANCELLED]: { bg: 'bg-red-900/50', text: 'text-red-300', border: 'border-red-500' },
  [MatchStatus.IN_PROGRESS]: { bg: 'bg-amber-900/50', text: 'text-amber-300', border: 'border-amber-500' },
};


const MatchCard: React.FC<MatchCardProps> = ({ match, officials, users, officialRoles, locations, onAssign, onEdit, onSendSheet, onNotifyChanges, onAddAssignment, onRemoveAssignment, onUpdateMatchStatus, onOpenScoreModal, onMarkOfficialAbsent, onArchiveMatch, onOpenStadiumModal, currentUser, permissions, viewContext, isSelected, onSelect }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const canEditMatchDetails = permissions.can('edit', 'match');
  const canAssignOfficial = permissions.can('assign', 'official');
  const canArchiveMatch = permissions.can('archive', 'match');

  const isMatchLockedForAccounting = useMemo(() => 
    match.accountingStatus === AccountingStatus.VALIDATED || 
    match.accountingStatus === AccountingStatus.CLOSED, 
  [match.accountingStatus]);

  const isAccountingInProgress = useMemo(() => 
      match.accountingStatus !== AccountingStatus.NOT_ENTERED,
  [match.accountingStatus]);
  
  const isMatchStateEditableForAssignments = match.status === MatchStatus.SCHEDULED && !isMatchLockedForAccounting;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matchDate = match.matchDate ? new Date(match.matchDate) : null;
  if (matchDate) {
      matchDate.setHours(0,0,0,0);
  }

  const canMarkAsPlayed = matchDate ? matchDate <= today : false;
  const canEditStadium = onOpenStadiumModal && isMatchStateEditableForAssignments;

  const getOfficialById = (id: string | null) => officials.find(o => o.id === id);

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const locationMap = useMemo(() => new Map(locations.map(loc => [loc.id, loc])), [locations]);

  const formatLocation = (location: Location | undefined) => {
    if (!location) return 'Localisation non spécifiée';
    if (location.wilaya_ar && location.commune_ar) {
        return `${location.wilaya_ar} - ${location.commune_ar}`;
    }
    return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
  }

  const getOfficialUser = useCallback((officialId: string | null): User | undefined => {
    if (!officialId) return undefined;
    const official = officials.find(o => o.id === officialId);
    if (!official?.userId) return undefined;
    return userMap.get(official.userId);
  }, [officials, userMap]);

  const assignedCount = useMemo(() => match.assignments.filter(a => a.officialId).length, [match.assignments]);
  const totalSlots = match.assignments.length;
  
  const communicationEligibility = useMemo(() => {
    if (match.status !== MatchStatus.SCHEDULED || isMatchLockedForAccounting) {
        return { canCommunicate: false, reason: "Communication impossible (statut de match invalide ou comptabilité verrouillée)." };
    }

    const hasAssignments = match.assignments.some(a => a.officialId);
    if (!hasAssignments) {
        return { canCommunicate: false, reason: "Communication impossible: Aucun officiel n'est désigné." };
    }

    const hasAtLeastOneEmail = match.assignments.some(a => {
        if (a.officialId) {
            const official = officials.find(o => o.id === a.officialId);
            return !!official?.email?.trim();
        }
        return false;
    });
    if (!hasAtLeastOneEmail) {
        return { canCommunicate: false, reason: "Communication impossible: Aucun officiel désigné n'a d'e-mail valide." };
    }

    const isStadiumLocationValid = !!(match.stadium?.locationId);
    if (!isStadiumLocationValid) {
        return { canCommunicate: false, reason: "Communication impossible: La localisation du stade est manquante." };
    }

    return { canCommunicate: true, reason: '' };
  }, [match, officials, isMatchLockedForAccounting]);


  const handleSendSheetClick = async () => {
    if (isSending || !onSendSheet) return;
    setIsSending(true);
    try {
        await onSendSheet(match);
    } catch (error) {
        console.error("Failed to send sheet:", error);
    } finally {
        setIsSending(false);
    }
  };

  const handleNotifyChangesClick = async () => {
    if (isSending || !onNotifyChanges) return;
    setIsSending(true);
    try {
        await onNotifyChanges(match);
    } catch (error) {
        console.error("Failed to notify changes:", error);
    } finally {
        setIsSending(false);
    }
  };

  const CommunicationStatus = () => {
    if (match.isSheetSent && !match.hasUnsentChanges) {
      return (
        <div className="flex items-center text-xs text-green-400">
          <CheckCircleIcon className="h-4 w-4 mr-1.5" />
          <span>Feuille de route envoyée</span>
        </div>
      );
    }
    if (match.hasUnsentChanges) {
        return (
            <div className="flex items-center text-xs text-yellow-400">
                <AlertTriangleIcon className="h-4 w-4 mr-1.5" />
                <span>Changements non notifiés</span>
            </div>
        )
    }
    return null;
  }
  
  const sortedAssignments = [...match.assignments].sort((a, b) => {
    return officialRoles.indexOf(a.role) - officialRoles.indexOf(b.role);
  });

  const handleStatusChange = (status: MatchStatus) => {
    if (status === MatchStatus.COMPLETED) {
        onOpenScoreModal(match);
        setIsMenuOpen(false);
    } else {
        onUpdateMatchStatus(match.id, status);
        setIsMenuOpen(false);
    }
  }

  const handleConfirmArchive = () => {
    onArchiveMatch(match.id);
    setIsArchiveModalOpen(false);
  };

  const handleAddRole = (role: OfficialRole) => {
    if (onAddAssignment) {
      onAddAssignment(match.id, role);
    }
    setIsAddMenuOpen(false);
  }

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Prevent triggering when clicking on buttons, inputs, or other interactive elements
    if (target.closest('button, input, a, select')) {
      return;
    }
    
    // Check for permissions and if the onEdit function is available
    if (onEdit && canEditMatchDetails) {
      onEdit(match);
    }
  };
  
  const stadiumLocationString = formatLocation(match.stadium?.locationId ? locationMap.get(match.stadium.locationId) : undefined);
  const stadiumDisplayName = match.stadium ? (match.stadium.nameAr ? `${match.stadium.name} (${match.stadium.nameAr})` : match.stadium.name) : '';

  return (
    <>
    <div 
      onClick={handleCardClick}
      className={`relative bg-gray-800 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl flex flex-col ${isSelected ? 'border-2 border-brand-primary' : `border ${statusColors[match.status].border}`} ${onEdit && canEditMatchDetails ? 'cursor-pointer' : ''}`}>
      {canAssignOfficial && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(match.id)}
            className="h-5 w-5 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-primary focus:ring-offset-gray-800 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Sélectionner le match ${match.homeTeam.name} vs ${match.awayTeam.name}`}
          />
        </div>
      )}
      <div className="p-6 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-4">
            <div className={`flex-grow ${canAssignOfficial ? 'ml-8' : ''}`}>
                 <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[match.status].bg} ${statusColors[match.status].text}`}>{match.status}</span>
                    <p className="text-sm text-brand-primary font-semibold">{match.leagueGroup.league.name} - J{match.gameDay} - {match.leagueGroup.name}</p>
                 </div>
                 <div className="mt-2 h-4">
                    {viewContext === 'assignments' && <CommunicationStatus />}
                 </div>
            </div>
            {canEditMatchDetails && (
                 <div className="relative">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        onBlur={() => setTimeout(() => setIsMenuOpen(false), 150)}
                        disabled={isMatchLockedForAccounting}
                        title={isMatchLockedForAccounting ? "Actions verrouillées car la comptabilité est validée ou clôturée." : ""}
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-md shadow-lg z-10">
                            <div className="py-1">
                                <button 
                                    onClick={() => { onEdit?.(match); setIsMenuOpen(false); }} 
                                    disabled={!isMatchStateEditableForAssignments}
                                    title={isMatchLockedForAccounting ? "Impossible de modifier, la comptabilité est verrouillée." : !isMatchStateEditableForAssignments ? "Impossible de modifier un match qui n'est pas au statut 'Prévu'." : "Modifier les détails du match"}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Modifier le match
                                </button>
                                <div className="border-t border-gray-600 my-1"></div>
                                <p className="px-4 pt-2 pb-1 text-xs text-gray-400">Changer le statut</p>
                                {match.status !== MatchStatus.COMPLETED && (
                                    <button 
                                        onClick={() => handleStatusChange(MatchStatus.COMPLETED)} 
                                        disabled={!canMarkAsPlayed || isMatchLockedForAccounting}
                                        title={isMatchLockedForAccounting ? "Impossible de modifier, la comptabilité est verrouillée." : !canMarkAsPlayed ? "Un match ne peut être marqué comme 'Joué' avant sa date." : ""}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Marquer comme Joué
                                    </button>
                                )}
                                {match.status !== MatchStatus.SCHEDULED && (
                                    <button onClick={() => handleStatusChange(MatchStatus.SCHEDULED)} disabled={isAccountingInProgress} title={isAccountingInProgress ? "Impossible de revenir à 'Prévu' car le processus comptable est engagé." : ""} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">Marquer comme Prévu</button>
                                )}
                                {match.status !== MatchStatus.POSTPONED && (
                                    <button onClick={() => handleStatusChange(MatchStatus.POSTPONED)} disabled={isAccountingInProgress} title={isAccountingInProgress ? "Impossible de reporter car le processus comptable est engagé." : ""} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">Reporter le match</button>
                                )}
                                {match.status !== MatchStatus.CANCELLED && (
                                    <button onClick={() => handleStatusChange(MatchStatus.CANCELLED)} disabled={isAccountingInProgress} title={isAccountingInProgress ? "Impossible d'annuler car le processus comptable est engagé." : ""} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">Annuler le match</button>
                                )}
                                {canArchiveMatch && (
                                  <>
                                  <div className="border-t border-gray-600 my-1"></div>
                                  <button 
                                      onClick={() => { setIsArchiveModalOpen(true); setIsMenuOpen(false); }}
                                      disabled={isMatchLockedForAccounting}
                                      title={isMatchLockedForAccounting ? "Impossible d'archiver, la comptabilité est verrouillée." : ""}
                                      className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-500 hover:text-white rounded-b-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                      Archiver le match
                                  </button>
                                  </>
                                )}
                            </div>
                        </div>
                    )}
                 </div>
            )}
        </div>
        
        <div className="flex items-center justify-center space-x-4 my-4">
            <div className="flex items-center space-x-2 text-right w-2/5 justify-end">
              <span className="font-bold text-lg text-white text-right">{match.homeTeam.name}</span>
              <img src={match.homeTeam.logoUrl || ''} alt={match.homeTeam.name} className="w-8 h-8 rounded-full"/>
            </div>
            
            {match.status === MatchStatus.COMPLETED && match.homeScore !== null && match.awayScore !== null ? (
                <span className="text-gray-200 font-mono text-3xl font-bold w-1/5 text-center">{match.homeScore} - {match.awayScore}</span>
            ) : (
                <span className="text-gray-400 font-mono text-2xl w-1/5 text-center">VS</span>
            )}
            
            <div className="flex items-center space-x-2 w-2/5">
              <img src={match.awayTeam.logoUrl || ''} alt={match.awayTeam.name} className="w-8 h-8 rounded-full"/>
              <span className="font-bold text-lg text-white">{match.awayTeam.name}</span>
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-gray-400 text-sm border-t border-b border-gray-700 py-3 mb-4 gap-2">
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            {match.matchDate ? (
              <span>{new Date(match.matchDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} {match.matchTime ? `@ ${match.matchTime}`: ''}</span>
            ) : (
               <span className="text-yellow-400 italic flex items-center">
                <AlertTriangleIcon className="h-4 w-4 mr-1.5" />
                Date/Heure non définies
              </span>
            )}
          </div>
          <button 
            className={`flex items-center ${canEditStadium ? 'cursor-pointer hover:text-brand-primary' : ''}`}
            onClick={(e) => { e.stopPropagation(); if (canEditStadium) onOpenStadiumModal(match); }}
            disabled={!canEditStadium}
            title={canEditStadium ? "Cliquer pour changer le stade" : "Le stade ne peut être modifié que si le match est 'Prévu' et non verrouillé."}
          >
            <LocationPinIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            {match.stadium ? (
              match.stadium.locationId ? (
                <span>{stadiumDisplayName}, {stadiumLocationString}</span>
              ) : (
                <span className="text-yellow-400 italic flex items-center" title="La localisation de ce stade n'est pas définie.">
                  <AlertTriangleIcon className="h-4 w-4 mr-1.5" />
                  {`${stadiumDisplayName} (Localisation non spécifiée)`}
                </span>
              )
            ) : (
              <span className="text-yellow-400 italic flex items-center">
                <AlertTriangleIcon className="h-4 w-4 mr-1.5" />
                Stade non défini
              </span>
            )}
          </button>
        </div>
        
        {viewContext === 'assignments' && (
          <>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold text-gray-200">Désignations</h3>
                {totalSlots > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${assignedCount} sur ${totalSlots} officiels désignés`}>
                    <span className="mr-2 font-mono">
                        {assignedCount}/{totalSlots}
                    </span>
                    <div className="w-24 h-2 bg-gray-600 rounded-full overflow-hidden">
                        <div className="h-2 bg-brand-primary rounded-full transition-all duration-300" style={{ width: `${(assignedCount / totalSlots) * 100}%` }}></div>
                    </div>
                    </div>
                )}
            </div>
            <div className="space-y-2 flex-grow">
              {sortedAssignments.map(assignment => {
                const isRemovable = onRemoveAssignment && !assignment.officialId;
                return (
                  <OfficialAssignment
                    key={assignment.id}
                    assignment={assignment}
                    official={getOfficialById(assignment.officialId)}
                    officialUser={getOfficialUser(assignment.officialId)}
                    originalOfficial={getOfficialById(assignment.originalOfficialId || null)}
                    onAssign={() => onAssign?.(match.id, assignment.id, assignment.role)}
                    onRemove={isRemovable ? () => onRemoveAssignment(match.id, assignment.id) : undefined}
// FIX: Changed prop name from onMarkAbsent to onMarkOfficialAbsent to match the updated OfficialAssignmentProps interface.
                    onMarkOfficialAbsent={() => onMarkOfficialAbsent?.(match.id, assignment.id)}
                    canEdit={canAssignOfficial && isMatchStateEditableForAssignments}
                  />
                );
              })}
            </div>
            
            <div className="mt-4 flex justify-end">
              {onAddAssignment && canAssignOfficial && (
                  <div className="relative">
                      <button
                          onClick={() => setIsAddMenuOpen(prev => !prev)}
                          onBlur={() => setTimeout(() => setIsAddMenuOpen(false), 200)}
                          disabled={!isMatchStateEditableForAssignments}
                          title={!isMatchStateEditableForAssignments ? "Les désignations sont verrouillées car le match n'est pas 'Prévu' ou la comptabilité est validée." : "Ajouter un créneau d'officiel"}
                          className="text-sm flex items-center text-brand-primary hover:text-brand-secondary font-semibold py-1 px-2 rounded-md hover:bg-brand-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:text-gray-500 disabled:hover:bg-transparent"
                          aria-haspopup="true"
                          aria-expanded={isAddMenuOpen}
                      >
                          <PlusIcon className="h-4 w-4 mr-1" />
                          Ajouter un Officiel
                      </button>
                      {isAddMenuOpen && (
                          <div className="absolute right-0 bottom-full mb-2 w-56 bg-gray-700 rounded-md shadow-lg z-10">
                              <div className="py-1" role="menu" aria-orientation="vertical">
                                  {officialRoles.map(role => (
                                      <button
                                          key={role}
                                          onClick={() => handleAddRole(role)}
                                          className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
                                          role="menuitem"
                                      >
                                          Ajouter: {role}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}
            </div>

            {onSendSheet && onNotifyChanges && permissions.can('send', 'match_sheet') && (
                <div className="mt-6">
                    {match.hasUnsentChanges ? (
                         <button 
                            onClick={handleNotifyChangesClick}
                            disabled={!communicationEligibility.canCommunicate || isSending}
                            title={!communicationEligibility.canCommunicate ? communicationEligibility.reason : 'Notifier les officiels des derniers changements'}
                            className="w-full flex items-center justify-center bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                         >
                           {isSending ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <AlertTriangleIcon className="h-5 w-5 mr-2" />
                            )}
                            {isSending ? 'Envoi en cours...' : 'Notifier des Changements'}
                        </button>
                    ) : (
                        <button 
                            onClick={handleSendSheetClick} 
                            disabled={!communicationEligibility.canCommunicate || isSending}
                            title={!communicationEligibility.canCommunicate ? communicationEligibility.reason : (match.isSheetSent ? 'Renvoyer la feuille de route' : 'Envoyer la feuille de route')}
                            className={`w-full flex items-center justify-center font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed ${match.isSheetSent ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-brand-primary hover:bg-brand-secondary text-white'}`}
                        >
                           {isSending ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                            )}
                            {isSending ? 'Envoi en cours...' : (match.isSheetSent ? 'Renvoyer la Feuille de Route' : 'Envoyer la Feuille de Route')}
                        </button>
                    )}
                </div>
            )}
          </>
        )}

      </div>
    </div>
    <ConfirmationModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        title="Archiver le Match"
        message={`Êtes-vous sûr de vouloir archiver le match ${match.homeTeam.name} vs ${match.awayTeam.name} ? Le match sera masqué des listes actives mais son historique sera conservé.`}
    />
    </>
  );
};

export default MatchCard;
