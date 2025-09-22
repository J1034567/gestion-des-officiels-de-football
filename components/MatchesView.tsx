




import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Match, Official, OfficialRole, Team, Stadium, User, MatchStatus, Assignment, League, LeagueGroup, TeamSeasonStadium, Location } from '../types';
import MatchCard from './MatchCard';
import AssignmentModal from './AssignmentModal';
import CreateMatchModal from './CreateMatchModal';
import MatchSheetModal from './MatchSheetModal';
import PlusIcon from './icons/PlusIcon';
import SearchIcon from './icons/SearchIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { Permissions } from '../hooks/usePermissions';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ExclamationCircleIcon from './icons/ExclamationCircleIcon';
import GameDaySchedulerModal from './GameDaySchedulerModal';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import ScoreModal from './ScoreModal';
import AlertTriangleIcon from './icons/AlertTriangleIcon';


interface MatchesViewProps {
    matches: Match[];
    officials: Official[];
    officialRoles: OfficialRole[];
    teams: Team[];
    stadiums: Stadium[];
    leagues: League[];
    leagueGroups: LeagueGroup[];
    teamStadiums: TeamSeasonStadium[];
    locations: Location[];
    users: User[];
    onSaveMatch: (matchData: Omit<Match, 'status' | 'assignments' | 'isSheetSent' | 'hasUnsentChanges' | 'isArchived'> & { id?: string }) => void;
    onUpdateAssignment: (matchId: string, assignmentId: string, officialId: string) => void;
    onSendMatchSheet: (matchId: string) => void;
    onNotifyChanges: (matchId: string) => void;
    onAddAssignment: (matchId: string, role: OfficialRole) => void;
    onRemoveAssignment: (matchId: string, assignmentId: string) => void;
    onUpdateMatchStatus: (matchId: string, status: MatchStatus) => void;
    onUpdateMatchScoreAndStatus: (matchId: string, homeScore: number, awayScore: number) => void;
    onMarkOfficialAbsent: (matchId: string, assignmentId: string) => void;
    onArchiveMatch: (matchId: string) => void;
    onUpdateGameDaySchedule: (leagueGroupId: string, gameDay: number, date: string, time: string) => void;
    currentUser: User;
    seasons: string[];
    currentSeason: string;
    permissions: Permissions;
}

// Data structures for the hierarchical view
interface GameDayData {
    matches: Match[];
    stats: { complete: number; total: number; };
}
interface GameDayGroup {
  [gameDay: number]: GameDayData;
}
interface GroupData {
  group: LeagueGroup;
  stats: { complete: number; total: number; };
  gameDays: GameDayGroup;
  sortedGameDays: number[];
}
interface LeagueData {
  league: League;
  groups: { [groupId: string]: GroupData };
}
interface HierarchicalMatches {
  [leagueId: string]: LeagueData;
}


const MatchesView: React.FC<MatchesViewProps> = ({ matches, officials, officialRoles, teams, stadiums, leagues, leagueGroups, teamStadiums, locations, users, onSaveMatch, onUpdateAssignment, onSendMatchSheet, onNotifyChanges, onAddAssignment, onRemoveAssignment, onUpdateMatchStatus, onUpdateMatchScoreAndStatus, onMarkOfficialAbsent, onArchiveMatch, onUpdateGameDaySchedule, currentUser, seasons, currentSeason, permissions }) => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchForSheet, setMatchForSheet] = useState<Match | null>(null);
  const [assignmentContext, setAssignmentContext] = useState<{ matchId: string; assignmentId: string; role: OfficialRole } | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'all'>('all');
  const [selectedLeagueId, setSelectedLeagueId] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('all');


  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeGameDayTabs, setActiveGameDayTabs] = useState<Record<string, number>>({});
  const [isGameDayModalOpen, setIsGameDayModalOpen] = useState<boolean>(false);
  const [gameDayContext, setGameDayContext] = useState<{ leagueGroup: LeagueGroup; gameDay: number; matches: Match[] } | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [matchForScore, setMatchForScore] = useState<Match | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

  const handleSelectMatch = useCallback((matchId: string) => {
    setSelectedMatchIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(matchId)) {
            newSet.delete(matchId);
        } else {
            newSet.add(matchId);
        }
        return newSet;
    });
  }, []);

  const availableGroups = useMemo(() => {
    if (selectedLeagueId === 'all') return [];
    return leagueGroups.filter(g => g.league_id === selectedLeagueId && g.season === currentSeason);
  }, [leagueGroups, selectedLeagueId, currentSeason]);

  const smartSummary = useMemo(() => {
    const unscored = matches.filter(m => m.status === MatchStatus.COMPLETED && (m.homeScore === null || m.awayScore === null)).length;
    const unscheduled = matches.filter(m => m.status === MatchStatus.SCHEDULED && !m.matchDate).length;
    return { unscored, unscheduled };
  }, [matches]);

  const { hierarchicalData, sortedLeagueIds } = useMemo(() => {
    const normalize = (str: string | null | undefined): string =>
      (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    
    const locationMap = new Map(locations.map(loc => [loc.id, loc]));
    const formatLocation = (locationId: string | null): string => {
        if (!locationId) return '';
        const location = locationMap.get(locationId);
        if (!location) return '';
        return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
    };

    const searchKeywords = normalize(searchTerm).split(' ').filter(Boolean);
    
    const filteredMatches = matches.filter(match => {
        if (statusFilter !== 'all' && match.status !== statusFilter) return false;
        if (selectedLeagueId !== 'all' && match.leagueGroup.league.id !== selectedLeagueId) return false;
        if (selectedLeagueId !== 'all' && selectedGroupId !== 'all' && match.leagueGroup.id !== selectedGroupId) return false;

        if (searchKeywords.length > 0) {
            const searchableText = [
                normalize(match.homeTeam.name),
                normalize(match.awayTeam.name),
                normalize(match.stadium?.name),
                normalize(formatLocation(match.stadium?.locationId || null)),
                normalize(match.leagueGroup.league.name),
                normalize(match.leagueGroup.name)
            ].join(' ');
            return searchKeywords.every(keyword => searchableText.includes(keyword));
        }
        
        return true;
      });

    const data: HierarchicalMatches = {};

    // Pass 1: Build structure
    for (const match of filteredMatches) {
        const leagueId = match.leagueGroup.league.id;
        const groupId = match.leagueGroup.id;
        const gameDay = match.gameDay;

        const league = leagues.find(l => l.id === leagueId);
        if (!league) continue;

        if (!data[leagueId]) {
            data[leagueId] = { league, groups: {} };
        }
        
        const group = leagueGroups.find(g => g.id === groupId);
        if (!group) continue;
        
        if (!data[leagueId].groups[groupId]) {
            data[leagueId].groups[groupId] = {
                group,
                stats: { complete: 0, total: 0 },
                gameDays: {},
                sortedGameDays: [],
            };
        }
        if (!data[leagueId].groups[groupId].gameDays[gameDay]) {
            data[leagueId].groups[groupId].gameDays[gameDay] = { matches: [], stats: { complete: 0, total: 0 } };
        }
        data[leagueId].groups[groupId].gameDays[gameDay].matches.push(match);
    }

    // Pass 2: Calculate stats and sort
    for (const leagueId in data) {
        for (const groupId in data[leagueId].groups) {
            const groupData = data[leagueId].groups[groupId];
            let groupTotal = 0;
            let groupComplete = 0;

            for (const day in groupData.gameDays) {
                const dayData = groupData.gameDays[day];
                
                const dayComplete = dayData.matches.filter(m => m.assignments.length > 0 && m.assignments.every(a => !!a.officialId)).length;

                dayData.stats.complete = dayComplete;
                dayData.stats.total = dayData.matches.length;

                groupTotal += dayData.stats.total;
                groupComplete += dayData.stats.complete;

                dayData.matches.sort((a, b) => (a.matchDate && b.matchDate) ? new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() : 0);
            }

            groupData.stats = {
                complete: groupComplete,
                total: groupTotal,
            };
            groupData.sortedGameDays = Object.keys(groupData.gameDays).map(Number).sort((a, b) => a - b);
        }
    }
    
    const sortedIds = Object.keys(data).sort((a, b) => data[a].league.name.localeCompare(data[b].league.name));

    return { hierarchicalData: data, sortedLeagueIds: sortedIds };
}, [matches, searchTerm, statusFilter, leagues, leagueGroups, selectedLeagueId, selectedGroupId, locations]);

  useEffect(() => {
    const shouldExpandAll = searchTerm.trim() !== '' || statusFilter !== 'all' || selectedLeagueId !== 'all';
    const newExpandedLeagues: Record<string, boolean> = {};
    const newExpandedGroups: Record<string, boolean> = {};

    sortedLeagueIds.forEach((leagueId, index) => {
        newExpandedLeagues[leagueId] = shouldExpandAll || index === 0;
        if (hierarchicalData[leagueId]) {
            Object.keys(hierarchicalData[leagueId].groups).forEach(groupId => {
                newExpandedGroups[groupId] = true; // Expand all groups by default
            });
        }
    });
    setExpandedLeagues(newExpandedLeagues);
    // Initialize groups, but respect user's previous toggles if they exist
    setExpandedGroups(prev => ({ ...newExpandedGroups, ...prev }));
  }, [searchTerm, statusFilter, sortedLeagueIds, selectedLeagueId]);

  useEffect(() => {
    const initialTabs: Record<string, number> = {};
    for (const leagueId in hierarchicalData) {
        for (const groupId in hierarchicalData[leagueId].groups) {
            if (!activeGameDayTabs[groupId]) {
                const firstGameDay = hierarchicalData[leagueId].groups[groupId].sortedGameDays[0];
                if (firstGameDay) {
                    initialTabs[groupId] = firstGameDay;
                }
            }
        }
    }
    setActiveGameDayTabs(prev => ({ ...initialTabs, ...prev }));
  }, [hierarchicalData]); // Only depends on hierarchicalData to set initial state

  const handleOpenAssignModal = useCallback((matchId: string, assignmentId: string, role: OfficialRole) => {
    setAssignmentContext({ matchId, assignmentId, role });
    setIsAssignModalOpen(true);
  }, []);

  const handleCloseAssignModal = useCallback(() => {
    setIsAssignModalOpen(false);
    setAssignmentContext(null);
  }, []);

  const handleConfirmAssignment = useCallback((officialId: string) => {
    if (!assignmentContext) return;
    onUpdateAssignment(assignmentContext.matchId, assignmentContext.assignmentId, officialId);
    handleCloseAssignModal();
  }, [assignmentContext, handleCloseAssignModal, onUpdateAssignment]);
  
  const handleEditMatch = useCallback((match: Match) => {
      setEditingMatch(match);
      setIsCreateModalOpen(true);
  }, []);

  const handleAddMatch = useCallback(() => {
      setEditingMatch(null);
      setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
      setIsCreateModalOpen(false);
      setEditingMatch(null);
  }, []);
  
  const handleOpenSheetModal = useCallback((match: Match) => {
    setMatchForSheet(match);
    setIsSheetModalOpen(true);
  }, []);

  const handleCloseSheetModal = useCallback(() => {
    setIsSheetModalOpen(false);
    setMatchForSheet(null);
  }, []);

  const handleOpenGameDayModal = (leagueGroup: LeagueGroup, gameDay: number, matches: Match[]) => {
    setGameDayContext({ leagueGroup, gameDay, matches });
    setIsGameDayModalOpen(true);
  };
  
  const handleOpenScoreModal = (match: Match) => {
    setMatchForScore(match);
    setIsScoreModalOpen(true);
  };

  const handleCloseScoreModal = useCallback(() => {
    setMatchForScore(null);
    setIsScoreModalOpen(false);
  }, []);

  const toggleLeague = (leagueId: string) => {
    setExpandedLeagues(prev => ({ ...prev, [leagueId]: !prev[leagueId] }));
  };
  
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !(prev[groupId] ?? true) }));
  };

  const currentMatch = assignmentContext ? matches.find(m => m.id === assignmentContext.matchId) : null;
  
  const availableOfficials = currentMatch && currentMatch.matchDate
    ? officials.filter(official => {
        if (!official.isActive || official.isArchived) return false;

        const isAlreadyAssignedInThisMatch = currentMatch.assignments.some(a => a.officialId === official.id);
        if (isAlreadyAssignedInThisMatch) return false;

        const matchDate = new Date(currentMatch.matchDate);
        matchDate.setHours(12, 0, 0, 0);
        const hasDeclaredUnavailability = official.unavailabilities.some(unavailability => {
            const startDate = new Date(unavailability.startDate);
            const endDate = new Date(unavailability.endDate);
            startDate.setHours(12, 0, 0, 0);
            endDate.setHours(12, 0, 0, 0);
            return matchDate >= startDate && matchDate <= endDate;
        });
        if (hasDeclaredUnavailability) return false;

        const isAssignedOnSameDay = matches.some(m =>
            m.id !== currentMatch.id &&
            m.matchDate === currentMatch.matchDate &&
            !m.isArchived &&
            m.assignments.some(a => a.officialId === official.id)
        );
        if (isAssignedOnSameDay) return false;

        return true;
    })
    : [];


  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-white">Gestion des Matchs</h2>
         {permissions.can('create', 'match') && (
            <div className="flex items-center space-x-2">
                <button onClick={handleAddMatch} className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200">
                    <PlusIcon className="h-5 w-5 mr-2"/>
                    Créer un match
                </button>
            </div>
         )}
      </div>
      
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg flex items-center">
                <ExclamationCircleIcon className="h-8 w-8 text-blue-400 mr-4 flex-shrink-0" />
                <div>
                    <div className="text-2xl font-bold text-white">{smartSummary.unscheduled}</div>
                    <div className="text-sm text-gray-400">Matchs sans date programmée</div>
                </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg flex items-center">
                <AlertTriangleIcon className="h-8 w-8 text-orange-400 mr-4 flex-shrink-0" />
                <div>
                    <div className="text-2xl font-bold text-white">{smartSummary.unscored}</div>
                    <div className="text-sm text-gray-400">Matchs joués sans score enregistré</div>
                </div>
            </div>
        </div>

       <div className="bg-gray-800 p-4 rounded-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="relative xl:col-span-1">
                <label htmlFor="search-term-matches" className="sr-only">Rechercher</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    id="search-term-matches"
                    type="text"
                    placeholder="Rechercher par équipe, stade..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                />
            </div>
            <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as MatchStatus | 'all')} className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary text-sm">
                    <option value="all">Tous les statuts</option>
                    {Object.values(MatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedLeagueId} onChange={e => { setSelectedLeagueId(e.target.value); setSelectedGroupId('all'); }} className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary">
                    <option value="all">Toutes les ligues</option>
                    {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} disabled={selectedLeagueId === 'all'} className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50">
                    <option value="all">Tous les groupes</option>
                    {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>
          </div>
      </div>
      
      <div className="space-y-4">
        {sortedLeagueIds.length > 0 ? (
          sortedLeagueIds.map(leagueId => {
            const { league, groups } = hierarchicalData[leagueId];
            const isExpanded = expandedLeagues[leagueId] ?? false;
            return (
              <div key={leagueId} className="bg-gray-800 rounded-lg overflow-hidden transition-all duration-300 border border-gray-700/50">
                <button
                  onClick={() => toggleLeague(leagueId)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-700/50 hover:bg-gray-700 focus:outline-none"
                  aria-expanded={isExpanded}
                >
                  <h3 className="text-xl font-semibold text-white">{league.name}</h3>
                  <ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="p-4 space-y-6">
                    {Object.values(groups).map(({ group, gameDays, sortedGameDays, stats }) => {
                      const activeDay = activeGameDayTabs[group.id] || sortedGameDays[0];
                      const isGroupExpanded = expandedGroups[group.id] ?? true;
                      return (
                        <div key={group.id} className="bg-gray-900/50 p-4 rounded-lg">
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between text-left mb-3 gap-2"
                                aria-expanded={isGroupExpanded}
                            >
                                <div className="flex items-center">
                                    <h4 className="text-lg font-semibold text-brand-primary">{group.name}</h4>
                                    <ChevronDownIcon className={`h-5 w-5 text-gray-400 ml-2 transition-transform duration-200 ${isGroupExpanded ? 'rotate-180' : ''}`} />
                                </div>
                                <div className="flex items-center space-x-3 text-xs text-gray-400">
                                    <span title="Désignations complètes">
                                        <CheckCircleIcon className="h-4 w-4 text-green-500 inline mr-1"/>
                                        {stats.complete}/{stats.total}
                                    </span>
                                    <span title="Désignations restantes">
                                        <ExclamationCircleIcon className="h-4 w-4 text-yellow-500 inline mr-1"/>
                                        {stats.total - stats.complete}
                                    </span>
                                </div>
                            </button>

                            {isGroupExpanded && (
                                <>
                                    <div className="border-b border-gray-700">
                                        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                                            {sortedGameDays.map(day => {
                                                const dayData = gameDays[day];
                                                const { stats: dayStats } = dayData;
                                                const isDayComplete = dayStats.total > 0 && dayStats.complete === dayStats.total;
                                                const dayIndicatorColor = isDayComplete ? 'text-green-400' : (dayStats.complete > 0 ? 'text-yellow-400' : 'text-gray-500');

                                                return (
                                                    <button
                                                        key={day}
                                                        onClick={() => setActiveGameDayTabs(prev => ({ ...prev, [group.id]: day }))}
                                                        className={`${activeDay === day ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                                                    >
                                                        <span>Journée {day}</span>
                                                        {dayStats.total > 0 && (
                                                            <span className={`font-mono text-xs ${dayIndicatorColor}`}>
                                                                ({dayStats.complete}/{dayStats.total})
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </nav>
                                    </div>
                                    <div className="pt-4">
                                        {permissions.can('edit', 'match') && (
                                            <div className="mb-4 text-right">
                                                <button
                                                    onClick={() => handleOpenGameDayModal(group, activeDay, gameDays[activeDay]?.matches || [])}
                                                    className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
                                                >
                                                    <CalendarDaysIcon className="h-4 w-4 mr-2" />
                                                    Planifier la journée
                                                </button>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {(gameDays[activeDay]?.matches || []).map(match => (
                                                <MatchCard 
                                                    key={match.id} 
                                                    viewContext="matches"
                                                    match={match} 
                                                    officials={officials} 
                                                    users={users}
                                                    officialRoles={officialRoles} 
                                                    locations={locations}
                                                    onEdit={handleEditMatch} 
                                                    onUpdateMatchStatus={onUpdateMatchStatus} 
                                                    onOpenScoreModal={handleOpenScoreModal}
                                                    onArchiveMatch={onArchiveMatch} 
                                                    currentUser={currentUser} 
                                                    permissions={permissions}
                                                    isSelected={selectedMatchIds.has(match.id)}
                                                    onSelect={handleSelectMatch} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center bg-gray-800 p-12 rounded-lg">
            <h3 className="text-xl font-bold text-white">Aucun match trouvé</h3>
            <p className="mt-2 text-gray-400">Essayez d'ajuster vos filtres de recherche ou de créer de nouveaux matchs.</p>
          </div>
        )}
      </div>

      <AssignmentModal
        isOpen={isAssignModalOpen}
        onClose={handleCloseAssignModal}
        match={currentMatch || null}
        role={assignmentContext?.role || null}
        availableOfficials={availableOfficials}
        onConfirmAssignment={handleConfirmAssignment}
        locations={locations}
      />
      <CreateMatchModal 
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSaveMatch={onSaveMatch}
        matchToEdit={editingMatch}
        teams={teams}
        stadiums={stadiums}
        leagues={leagues}
        leagueGroups={leagueGroups}
        matches={matches}
        isEditable={editingMatch ? editingMatch.status === MatchStatus.SCHEDULED : true}
        seasons={seasons}
        currentSeason={currentSeason}
        teamStadiums={teamStadiums}
        locations={locations}
      />
      <MatchSheetModal
        isOpen={isSheetModalOpen}
        onClose={handleCloseSheetModal}
        match={matchForSheet}
        officials={officials}
        onConfirmSend={onSendMatchSheet}
        onConfirmNotify={onNotifyChanges}
        locations={locations}
      />
      <GameDaySchedulerModal
        isOpen={isGameDayModalOpen}
        onClose={() => setIsGameDayModalOpen(false)}
        onSave={onUpdateGameDaySchedule}
        context={gameDayContext}
      />
      <ScoreModal
        isOpen={isScoreModalOpen}
        onClose={handleCloseScoreModal}
        onSave={onUpdateMatchScoreAndStatus}
        match={matchForScore}
      />
    </main>
  );
};

export default MatchesView;