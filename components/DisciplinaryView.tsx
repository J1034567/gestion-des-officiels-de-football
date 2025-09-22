
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Player, Sanction, Team, Match, mapSanctionTypeToDisplay, SanctionType, DisciplinarySettings } from '../types';
import { Permissions } from '../hooks/usePermissions';
import ShieldExclamationIcon from './icons/ShieldExclamationIcon';
import SearchIcon from './icons/SearchIcon';
import UserPlusIcon from './icons/UserPlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import ConfirmationModal from './ConfirmationModal';
import PlayerModal from './PlayerModal';
import SanctionModal from './SanctionModal';
import PlusIcon from './icons/PlusIcon';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import { getSuspensionStatusForMatch, getCurrentSuspensionStatus } from '../services/suspensionService';
import XMarkIcon from './icons/XMarkIcon';

interface DisciplinaryViewProps {
  players: Player[];
  sanctions: Sanction[];
  teams: Team[];
  matches: Match[];
  permissions: Permissions;
  onSavePlayer: (player: Partial<Player>) => void;
  onArchivePlayer: (playerId: string) => void;
  onSaveSanction: (sanction: Partial<Sanction>) => void;
  onCancelSanction: (sanctionId: string) => void;
  disciplinarySettings: DisciplinarySettings | null;
}

const DisciplinaryView: React.FC<DisciplinaryViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'players' | 'sanctions' | 'entryByMatch'>('players');
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerToArchive, setPlayerToArchive] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sanctionSearchTerm, setSanctionSearchTerm] = useState('');
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [editingSanction, setEditingSanction] = useState<Sanction | null>(null);
  const [sanctionToCancel, setSanctionToCancel] = useState<Sanction | null>(null);
  
  // State for Entry by Match view
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchFilter, setMatchFilter] = useState<'recent' | 'all'>('recent');
  const [matchSearch, setMatchSearch] = useState('');
  const [newPlayerTeamContext, setNewPlayerTeamContext] = useState<string | null>(null);


  const {
      players, sanctions, teams, matches, permissions, onSavePlayer,
      onArchivePlayer, onSaveSanction, onCancelSanction, disciplinarySettings
  } = props;
  
  const canCreatePlayer = permissions.can('create', 'disciplinary');
  const canEditPlayer = permissions.can('edit', 'disciplinary');
  const canArchivePlayer = permissions.can('archive', 'disciplinary');
  const canCreateSanction = permissions.can('create', 'disciplinary');
  const canEditSanction = permissions.can('edit', 'disciplinary');
  const canCancelSanction = permissions.can('archive', 'disciplinary');

  const activePlayers = useMemo(() => players.filter(p => !p.isArchived), [players]);
  const teamsMap = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);
  const playersMap = useMemo(() => new Map(players.map(p => [p.id, p.fullName])), [players]);
  const matchesMap = useMemo(() => new Map(matches.map(m => [m.id, `${m.homeTeam.name} vs ${m.awayTeam.name}`])), [matches]);

  const playerHasSanctions = useMemo(() => {
    const sanctionMap = new Map<string, boolean>();
    for (const sanction of sanctions) {
        if (!sanction.isCancelled) {
            sanctionMap.set(sanction.playerId, true);
        }
    }
    return sanctionMap;
  }, [sanctions]);

  const filteredPlayers = useMemo(() => {
    if (!searchTerm) return activePlayers.sort((a,b) => a.fullName.localeCompare(b.fullName));
    const lowercasedFilter = searchTerm.toLowerCase();
    return activePlayers.filter(player =>
      player.fullName.toLowerCase().includes(lowercasedFilter) ||
      player.licenseNumber?.toLowerCase().includes(lowercasedFilter)
    ).sort((a,b) => a.fullName.localeCompare(b.fullName));
  }, [activePlayers, searchTerm]);

  const filteredSanctions = useMemo(() => {
    return sanctions
      .filter(sanction => {
        if (!sanctionSearchTerm) return true;
        const playerName = playersMap.get(sanction.playerId)?.toLowerCase() || '';
        return playerName.includes(sanctionSearchTerm.toLowerCase());
      })
      .sort((a,b) => new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime());
  }, [sanctions, sanctionSearchTerm, playersMap]);
  
  const completedMatches = useMemo(() => {
    return matches
        .filter(m => m.status === 'Joué') // MatchStatus.COMPLETED
        .sort((a,b) => new Date(b.matchDate!).getTime() - new Date(a.matchDate!).getTime())
  }, [matches]);
  
  const filteredMatchesForEntry = useMemo(() => {
      let displayMatches = completedMatches;
      if (matchFilter === 'recent') {
          const fourWeeksAgo = new Date();
          fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
          displayMatches = displayMatches.filter(m => new Date(m.matchDate!) >= fourWeeksAgo);
      }
      if (matchSearch) {
          const lowerSearch = matchSearch.toLowerCase();
          displayMatches = displayMatches.filter(m => 
              m.homeTeam.name.toLowerCase().includes(lowerSearch) ||
              m.awayTeam.name.toLowerCase().includes(lowerSearch) ||
              m.leagueGroup.name.toLowerCase().includes(lowerSearch)
          );
      }
      return displayMatches;
  }, [completedMatches, matchFilter, matchSearch]);


  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setNewPlayerTeamContext(null);
    setIsPlayerModalOpen(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setIsPlayerModalOpen(true);
  };
  
  const handleConfirmArchive = () => {
      if (playerToArchive) {
          onArchivePlayer(playerToArchive.id);
          setPlayerToArchive(null);
      }
  };
  
  const handleAddSanction = () => {
    setEditingSanction(null);
    setIsSanctionModalOpen(true);
  };

  const handleEditSanction = (sanction: Sanction) => {
    setEditingSanction(sanction);
    setIsSanctionModalOpen(true);
  };
  
  const handleConfirmCancel = () => {
      if (sanctionToCancel) {
          onCancelSanction(sanctionToCancel.id);
          setSanctionToCancel(null);
      }
  };

  const handleOpenPlayerModalForTeam = (teamId: string) => {
    setNewPlayerTeamContext(teamId);
    setEditingPlayer(null); // Ensure we are in "create" mode
    setIsPlayerModalOpen(true);
  };
  
  const handleSaveAndClosePlayerModal = async (player: Partial<Player>) => {
    if (newPlayerTeamContext && !player.id) {
        player.currentTeamId = newPlayerTeamContext;
    }
    await onSavePlayer(player);
    setIsPlayerModalOpen(false);
    setNewPlayerTeamContext(null);
    setEditingPlayer(null);
  };


  return (
    <>
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-6">
          <ShieldExclamationIcon className="h-8 w-8 text-brand-primary mr-3" />
          <h2 className="text-3xl font-bold text-white">Gestion Disciplinaire</h2>
        </div>

        <div className="border-b border-gray-700 mb-6">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button onClick={() => setActiveTab('players')} className={`${activeTab === 'players' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                    Joueurs
                </button>
                <button onClick={() => setActiveTab('sanctions')} className={`${activeTab === 'sanctions' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                    Sanctions
                </button>
                 <button onClick={() => setActiveTab('entryByMatch')} className={`${activeTab === 'entryByMatch' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                    Saisie par Match
                </button>
            </nav>
        </div>

        {activeTab === 'players' && (
            <div>
                <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative flex-grow w-full sm:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input type="text" placeholder="Rechercher par nom ou licence..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary" />
                    </div>
                    {canCreatePlayer && (
                        <button onClick={handleAddPlayer} className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                            <UserPlusIcon className="h-5 w-5 mr-2" /> Ajouter un Joueur
                        </button>
                    )}
                </div>
                <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nom Complet</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Date de Naissance</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">N° Licence</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Équipe Actuelle</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Statut Suspension</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-700">
                                {filteredPlayers.map(player => {
                                    const suspensionStatus = disciplinarySettings 
                                        ? getCurrentSuspensionStatus(player, sanctions, matches, disciplinarySettings)
                                        : { isSuspended: false, remainingMatches: 0 };
                                    const hasSanctions = playerHasSanctions.get(player.id) || false;
                                    return (
                                        <tr key={player.id} className="hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{player.fullName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{player.dateOfBirth ? new Date(`${player.dateOfBirth}T12:00:00`).toLocaleDateString('fr-FR') : 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">{player.licenseNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{player.currentTeamId ? teamsMap.get(player.currentTeamId) : 'Aucune'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {suspensionStatus.isSuspended ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                                                        Suspendu ({suspensionStatus.remainingMatches} match(s) restant(s))
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                                                        Disponible
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                                {canEditPlayer && <button onClick={() => handleEditPlayer(player)} className="p-2 text-gray-400 hover:text-brand-primary rounded-full hover:bg-gray-700/50" title="Modifier"><PencilIcon className="h-4 w-4"/></button>}
                                                {canArchivePlayer && (
                                                    <button 
                                                        onClick={() => setPlayerToArchive(player)} 
                                                        disabled={hasSanctions}
                                                        className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700/50 disabled:text-gray-600 disabled:cursor-not-allowed" 
                                                        title={hasSanctions ? "Impossible d'archiver un joueur avec des sanctions actives." : "Archiver"}
                                                    >
                                                        <TrashIcon className="h-4 w-4"/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        {activeTab === 'sanctions' && (
             <div>
                <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative flex-grow w-full sm:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input type="text" placeholder="Rechercher par nom de joueur..." value={sanctionSearchTerm} onChange={e => setSanctionSearchTerm(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary" />
                    </div>
                    {canCreateSanction && (
                        <button onClick={handleAddSanction} className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                            <PlusIcon className="h-5 w-5 mr-2" /> Ajouter une Sanction
                        </button>
                    )}
                </div>
                <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                             <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Joueur</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Match</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Date Décision</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Suspension</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Statut</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-700">
                                {filteredSanctions.length > 0 ? filteredSanctions.map(sanction => (
                                     <tr key={sanction.id} className={`hover:bg-gray-700/50 ${sanction.isCancelled ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{playersMap.get(sanction.playerId) || 'Joueur Inconnu'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{mapSanctionTypeToDisplay(sanction.type)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{sanction.matchId ? matchesMap.get(sanction.matchId) : <span className="italic text-gray-500">Hors Match</span>}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(`${sanction.decisionDate}T12:00:00`).toLocaleDateString('fr-FR')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{sanction.suspensionMatches} match(s)</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sanction.isCancelled ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                                                {sanction.isCancelled ? 'Annulée' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                            {canEditSanction && !sanction.isCancelled && <button onClick={() => handleEditSanction(sanction)} className="p-2 text-gray-400 hover:text-brand-primary rounded-full hover:bg-gray-700/50" title="Modifier"><PencilIcon className="h-4 w-4"/></button>}
                                            {canCancelSanction && !sanction.isCancelled && <button onClick={() => setSanctionToCancel(sanction)} className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700/50" title="Annuler la sanction"><TrashIcon className="h-4 w-4"/></button>}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-400">Aucune sanction ne correspond à votre recherche.</td>
                                    </tr>
                                )}
                             </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        {activeTab === 'entryByMatch' && (
            <div>
                {!selectedMatch ? (
                    <div>
                        <div className="bg-gray-800 p-4 rounded-lg mb-6 space-y-4">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input type="text" placeholder="Rechercher par équipe, groupe..." value={matchSearch} onChange={e => setMatchSearch(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white" />
                            </div>
                             <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-400">Afficher:</span>
                                <button onClick={() => setMatchFilter('recent')} className={`px-3 py-1 text-sm rounded-full transition-colors ${matchFilter === 'recent' ? 'bg-brand-primary text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Matchs Récents</button>
                                <button onClick={() => setMatchFilter('all')} className={`px-3 py-1 text-sm rounded-full transition-colors ${matchFilter === 'all' ? 'bg-brand-primary text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Tous les Matchs Joués</button>
                            </div>
                        </div>
                         <div className="space-y-3">
                            {filteredMatchesForEntry.map(match => (
                                <button key={match.id} onClick={() => setSelectedMatch(match)} className="w-full text-left bg-gray-800 p-4 rounded-lg hover:bg-gray-700/50 transition-colors">
                                    <p className="font-semibold text-white">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                                    <p className="text-sm text-gray-400">{match.leagueGroup.name} - {new Date(`${match.matchDate}T12:00:00`).toLocaleDateString('fr-FR')}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <MatchSanctionEditor 
                        match={selectedMatch}
                        onBack={() => setSelectedMatch(null)}
                        allPlayers={players}
                        teams={teams}
                        allSanctions={sanctions}
                        allMatches={matches}
                        disciplinarySettings={disciplinarySettings!}
                        onSaveSanction={onSaveSanction}
                        onAddPlayer={handleOpenPlayerModalForTeam}
                        onSetSanctionToCancel={setSanctionToCancel}
                    />
                )}
            </div>
        )}
      </main>
      <PlayerModal
        isOpen={isPlayerModalOpen}
        onClose={() => { setIsPlayerModalOpen(false); setNewPlayerTeamContext(null); }}
        onSave={handleSaveAndClosePlayerModal}
        playerToEdit={editingPlayer}
        teams={teams}
        players={players}
        teamContextId={newPlayerTeamContext}
      />
       <ConfirmationModal
        isOpen={!!playerToArchive}
        onClose={() => setPlayerToArchive(null)}
        onConfirm={handleConfirmArchive}
        title={`Archiver ${playerToArchive?.fullName}`}
        message="Êtes-vous sûr de vouloir archiver ce joueur ? Il ne pourra plus être sélectionné pour de nouvelles sanctions."
      />
      <SanctionModal
        isOpen={isSanctionModalOpen}
        onClose={() => setIsSanctionModalOpen(false)}
        onSave={onSaveSanction}
        sanctionToEdit={editingSanction}
        players={activePlayers}
        matches={matches}
        disciplinarySettings={disciplinarySettings}
      />
       <ConfirmationModal
        isOpen={!!sanctionToCancel}
        onClose={() => setSanctionToCancel(null)}
        onConfirm={handleConfirmCancel}
        title={`Annuler la Sanction`}
        message={`Êtes-vous sûr de vouloir annuler cette sanction pour ${sanctionToCancel ? playersMap.get(sanctionToCancel.playerId) : ''} ? Cette action est irréversible.`}
      />
    </>
  );
};


// --- MatchSanctionEditor Component ---
interface MatchSanctionEditorProps {
    match: Match;
    onBack: () => void;
    allPlayers: Player[];
    teams: Team[];
    allSanctions: Sanction[];
    allMatches: Match[];
    disciplinarySettings: DisciplinarySettings;
    onSaveSanction: (sanction: Partial<Sanction>) => void;
    onAddPlayer: (teamId: string) => void;
    onSetSanctionToCancel: (sanction: Sanction) => void;
}

const PlayerSanctionRow: React.FC<{
    player: Player;
    suspensionReason: string | null;
    sanctionsInMatch: Sanction[];
    onAddSanction: (type: SanctionType) => void;
    onSetSanctionToCancel: (sanction: Sanction) => void;
}> = ({ player, suspensionReason, sanctionsInMatch, onAddSanction, onSetSanctionToCancel }) => {
    
    const yellowCard = sanctionsInMatch.find(s => s.type === SanctionType.YELLOW_CARD);
    const redCard = sanctionsInMatch.find(s => s.type.includes('RED_CARD'));
    const directRedCard = sanctionsInMatch.find(s => s.type === SanctionType.RED_CARD_DIRECT);

    const hasYellow = !!yellowCard;
    const hasRed = !!redCard;
    
    const isSuspendedForMatch = !!suspensionReason;
    const isDisabled = isSuspendedForMatch;

    const handleYellowClick = () => {
        if (hasYellow) {
            onSetSanctionToCancel(yellowCard!);
        } else {
            onAddSanction(SanctionType.YELLOW_CARD);
        }
    };
    
    const handleRedClick = () => {
        if (hasRed) {
            onSetSanctionToCancel(redCard!);
        } else {
            const redType = hasYellow ? SanctionType.RED_CARD_TWO_YELLOWS : SanctionType.RED_CARD_DIRECT;
            onAddSanction(redType);
        }
    };

    return (
        <div className={`flex items-center justify-between p-2 rounded-md ${isSuspendedForMatch ? 'bg-gray-700/50 opacity-60' : 'bg-gray-800'}`}>
            <div className="flex items-center gap-2">
                {isSuspendedForMatch && (
                    <div className="group relative">
                        <ShieldExclamationIcon className="h-5 w-5 text-red-400" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                           {suspensionReason}
                        </div>
                    </div>
                )}
                <span className="text-sm text-white">{player.fullName}</span>
            </div>
            <div className="flex items-center gap-2">
                {/* Yellow Card */}
                <button
                    onClick={handleYellowClick}
                    disabled={isDisabled || !!directRedCard}
                    title={hasYellow ? "Annuler le carton jaune" : "Ajouter un carton jaune"}
                    className={`w-5 h-7 rounded-sm transition-all duration-200 transform ${
                        isDisabled || !!directRedCard
                            ? 'bg-gray-600 opacity-30 cursor-not-allowed'
                            : hasYellow
                            ? 'bg-yellow-400 hover:scale-105 shadow-lg shadow-yellow-500/30'
                            : 'bg-gray-600 opacity-50 hover:opacity-100 hover:bg-yellow-400/80 hover:scale-110'
                    }`}
                />
                
                {/* Red Card */}
                <button
                    onClick={handleRedClick}
                    disabled={isDisabled}
                    title={hasRed ? "Annuler le carton rouge" : hasYellow ? "Ajouter un 2ème carton jaune (Rouge)" : "Ajouter un carton rouge direct"}
                    className={`w-5 h-7 rounded-sm transition-all duration-200 transform ${
                        isDisabled
                            ? 'bg-gray-600 opacity-30 cursor-not-allowed'
                            : hasRed
                            ? 'bg-red-500 hover:scale-105 shadow-lg shadow-red-500/30'
                            : 'bg-gray-600 opacity-50 hover:opacity-100 hover:bg-red-500/80 hover:scale-110'
                    }`}
                />
            </div>
        </div>
    );
};


const MatchSanctionEditor: React.FC<MatchSanctionEditorProps> = ({ match, onBack, allPlayers, allSanctions, allMatches, disciplinarySettings, onSaveSanction, onAddPlayer, onSetSanctionToCancel }) => {
    
    const suspendedPlayers = useMemo(() => {
        if (!disciplinarySettings) return new Map<string, string>();

        const suspensionMap = new Map<string, string>();
        const teamPlayerIds = allPlayers
            .filter(p => p.currentTeamId === match.homeTeam.id || p.currentTeamId === match.awayTeam.id)
            .map(p => p.id);
        
        teamPlayerIds.forEach(playerId => {
            const player = allPlayers.find(p => p.id === playerId);
            if(player) {
                const status = getSuspensionStatusForMatch(player, match, allSanctions, allMatches, disciplinarySettings);
                if (status.isSuspended) {
                    suspensionMap.set(playerId, status.reason!);
                }
            }
        });
        return suspensionMap;
    }, [match, allPlayers, allSanctions, allMatches, disciplinarySettings]);
    
    const localSanctions = useMemo(() => allSanctions.filter(s => s.matchId === match.id && !s.isCancelled), [match.id, allSanctions]);

    const handleQuickAddSanction = (playerId: string, type: SanctionType) => {
        let suspension = 0;
        if (type === SanctionType.RED_CARD_DIRECT && disciplinarySettings) {
            suspension = disciplinarySettings.directRedCardSuspension;
        } else if (type === SanctionType.RED_CARD_TWO_YELLOWS && disciplinarySettings) {
            suspension = disciplinarySettings.twoYellowsRedCardSuspension;
        }

        onSaveSanction({
            playerId,
            type,
            matchId: match.id,
            decisionDate: match.matchDate!,
            suspensionMatches: suspension,
        });
    };

    const TeamRoster: React.FC<{ team: Team }> = ({ team }) => {
        const teamPlayers = useMemo(() => allPlayers.filter(p => p.currentTeamId === team.id && !p.isArchived).sort((a,b)=>a.fullName.localeCompare(b.fullName)), [allPlayers, team.id]);
        
        return (
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                    <img src={team.logoUrl || ''} alt={team.name} className="w-8 h-8 rounded-full" />
                    <h4 className="font-bold text-xl text-white">{team.name}</h4>
                </div>
                <div className="space-y-2">
                    {teamPlayers.map(player => (
                        <PlayerSanctionRow 
                            key={player.id}
                            player={player}
                            suspensionReason={suspendedPlayers.get(player.id) || null}
                            sanctionsInMatch={localSanctions.filter(s => s.playerId === player.id)}
                            onAddSanction={(type) => handleQuickAddSanction(player.id, type)}
                            onSetSanctionToCancel={onSetSanctionToCancel}
                        />
                    ))}
                </div>
                <button onClick={() => onAddPlayer(team.id)} className="w-full mt-4 text-sm flex items-center justify-center bg-brand-primary/10 text-brand-primary font-semibold py-2 rounded-md hover:bg-brand-primary/20">
                    <UserPlusIcon className="h-4 w-4 mr-2"/> Ajouter un joueur à l'effectif
                </button>
            </div>
        );
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg animate-fade-in-up">
            <button onClick={onBack} className="flex items-center text-sm font-semibold text-gray-300 hover:text-white mb-4">
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Retour à la sélection des matchs
            </button>
            <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-white">{match.homeTeam.name} vs {match.awayTeam.name}</h3>
                <p className="text-gray-400">{new Date(`${match.matchDate}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TeamRoster team={match.homeTeam} />
                <TeamRoster team={match.awayTeam} />
            </div>
        </div>
    )
}


export default DisciplinaryView;
