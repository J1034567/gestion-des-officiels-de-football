





import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Match, Official, OfficialRole, MatchStatus, User, Team, Stadium, League, LeagueGroup, TeamSeasonStadium, Location } from '../types';
import MatchCard from './MatchCard';
import AssignmentModal from './AssignmentModal';
import MatchSheetModal from './MatchSheetModal';
import { Permissions } from '../hooks/usePermissions';
import ChevronDownIcon from './icons/ChevronDownIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import ExclamationCircleIcon from './icons/ExclamationCircleIcon';
import GameDaySchedulerModal from './GameDaySchedulerModal';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import ScoreModal from './ScoreModal';


interface AssignmentsViewProps {
    matches: Match[];
    officials: Official[];
    officialRoles: OfficialRole[];
    teams: Team[];
    stadiums: Stadium[];
    leagues: League[];
    leagueGroups: LeagueGroup[];
    locations: Location[];
    // FIX: Added missing users prop
    users: User[];
    onUpdateAssignment: (matchId: string, assignmentId: string, officialId: string) => void;
    onUpdateMatchStatus: (matchId: string, status: MatchStatus) => void;
    onUpdateMatchScoreAndStatus: (matchId: string, homeScore: number, awayScore: number) => void;
    onMarkOfficialAbsent: (matchId: string, assignmentId: string) => void;
    onArchiveMatch: (matchId: string) => void;
    // FIX: Update prop types to return Promise<void> to match implementation and MatchCard props.
    onSendMatchSheet: (matchId: string) => Promise<void>;
    onNotifyChanges: (matchId: string) => Promise<void>;
    onAddAssignment: (matchId: string, role: OfficialRole) => void;
    onRemoveAssignment: (matchId: string, assignmentId: string) => void;
    onUpdateGameDaySchedule: (leagueGroupId: string, gameDay: number, date: string, time: string) => void;
    currentUser: User;
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
  stats: { complete: number; sent: number; remaining: number; total: number; };
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

const AssignmentsView: React.FC<AssignmentsViewProps> = (props) => {
  const { 
    matches, officials, officialRoles, leagues, leagueGroups, locations, users,
    onUpdateAssignment, onUpdateMatchStatus, onUpdateMatchScoreAndStatus, onMarkOfficialAbsent, 
    onArchiveMatch, onSendMatchSheet, onNotifyChanges, onAddAssignment, onRemoveAssignment, 
    onUpdateGameDaySchedule, currentUser, permissions 
  } = props;
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [assignmentContext, setAssignmentContext] = useState<{ matchId: string; assignmentId: string; role: OfficialRole } | null>(null);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [matchForSheet, setMatchForSheet] = useState<Match | null>(null);
  const [isGameDayModalOpen, setIsGameDayModalOpen] = useState<boolean>(false);
  const [gameDayContext, setGameDayContext] = useState<{ leagueGroup: LeagueGroup; gameDay: number; matches: Match[] } | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [matchForScore, setMatchForScore] = useState<Match | null>(null);


  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    recent: false,
    week: true,
    upcoming: false,
  });
  
  // State for upcoming matches hierarchy
  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeGameDayTabs, setActiveGameDayTabs] = useState<Record<string, number>>({});
// FIX: Add state and handler for match selection to satisfy MatchCardProps
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


  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const oneWeekAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 7);
    return d;
  }, [today]);

  const oneWeekFromNow = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    return d;
  }, [today]);
  
  const recentMatchesToCheck = useMemo(() => {
    return matches
      .filter(match => {
        const matchDate = match.matchDate ? new Date(match.matchDate) : null;
        return matchDate && matchDate >= oneWeekAgo && matchDate < today && match.status !== MatchStatus.COMPLETED && !match.isArchived;
      })
      .sort((a, b) => new Date(b.matchDate!).getTime() - new Date(a.matchDate!).getTime());
  }, [matches, today, oneWeekAgo]);

  const thisWeekMatches = useMemo(() => {
    return matches
      .filter(match => {
        const matchDate = match.matchDate ? new Date(match.matchDate) : null;
        return matchDate && matchDate >= today && matchDate <= oneWeekFromNow && !match.isArchived;
      })
      .sort((a, b) => new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime());
  }, [matches, today, oneWeekFromNow]);

  const { upcomingMatchesData, sortedUpcomingLeagueIds } = useMemo(() => {
    const upcoming = matches.filter(match => {
        const matchDate = match.matchDate ? new Date(match.matchDate) : null;
        return matchDate && matchDate > oneWeekFromNow && !match.isArchived;
    });

    const data: HierarchicalMatches = {};

    // Pass 1: Build structure
    for (const match of upcoming) {
        const leagueId = match.leagueGroup.league.id;
        const groupId = match.leagueGroup.id;
        const gameDay = match.gameDay;
        
        const leagueInfo = leagues.find(l => l.id === leagueId);
        if (!leagueInfo) continue;

        if (!data[leagueId]) {
            data[leagueId] = { league: leagueInfo, groups: {} };
        }
        
        const groupInfo = leagueGroups.find(g => g.id === groupId);
        if (!groupInfo) continue;

        if (!data[leagueId].groups[groupId]) {
            data[leagueId].groups[groupId] = {
                group: groupInfo,
                stats: { complete: 0, sent: 0, remaining: 0, total: 0 },
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
          let groupSent = 0;

          for (const day in groupData.gameDays) {
              const dayData = groupData.gameDays[day];
              let dayComplete = 0;
              
              dayData.matches.forEach(m => {
                  const allAssigned = m.assignments.length > 0 && m.assignments.every(a => !!a.officialId);
                  if (allAssigned) {
                      dayComplete++;
                      if (m.isSheetSent) {
                          groupSent++;
                      }
                  }
              });

              dayData.stats.complete = dayComplete;
              dayData.stats.total = dayData.matches.length;

              groupTotal += dayData.stats.total;
              groupComplete += dayData.stats.complete;
              
              dayData.matches.sort((a, b) => (a.matchDate && b.matchDate) ? new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() : 0);
          }
          
          groupData.stats = {
              complete: groupComplete,
              sent: groupSent,
              total: groupTotal,
              remaining: groupTotal - groupComplete,
          };
          groupData.sortedGameDays = Object.keys(groupData.gameDays).map(Number).sort((a, b) => a - b);
      }
    }
    
    // FIX: Correctly access the league name for sorting.
    const sortedIds = Object.keys(data).sort((a, b) => (data[a]?.league?.name || '').localeCompare(data[b]?.league?.name || ''));
    
    return { upcomingMatchesData: data, sortedUpcomingLeagueIds: sortedIds };
  }, [matches, leagues, leagueGroups, oneWeekFromNow, today]);
  
  useEffect(() => {
    const newExpandedLeagues: Record<string, boolean> = {};
    const newExpandedGroups: Record<string, boolean> = {};

    sortedUpcomingLeagueIds.forEach((leagueId, index) => {
        // Expand the first league by default
        newExpandedLeagues[leagueId] = index === 0;
        if (upcomingMatchesData[leagueId]) {
            Object.keys(upcomingMatchesData[leagueId].groups).forEach(groupId => {
                // By default, all groups start expanded for better discoverability
                newExpandedGroups[groupId] = false;
            });
        }
    });

    setExpandedLeagues(newExpandedLeagues);
    // Initialize group states, respecting any existing user toggles
    setExpandedGroups(prev => ({ ...newExpandedGroups, ...prev }));
}, [sortedUpcomingLeagueIds]);

  useEffect(() => {
    const initialTabs: Record<string, number> = {};
    for (const leagueId in upcomingMatchesData) {
        for (const groupId in upcomingMatchesData[leagueId].groups) {
            if (!activeGameDayTabs[groupId]) {
                const firstGameDay = upcomingMatchesData[leagueId].groups[groupId].sortedGameDays[0];
                if (firstGameDay) {
                    initialTabs[groupId] = firstGameDay;
                }
            }
        }
    }
    setActiveGameDayTabs(prev => ({ ...initialTabs, ...prev }));
  }, [upcomingMatchesData]);

  const handleOpenAssignModal = useCallback((matchId: string, assignmentId: string, role: OfficialRole) => {
    setAssignmentContext({ matchId, assignmentId, role });
    setIsModalOpen(true);
  }, []);

  const handleCloseAssignModal = useCallback(() => {
    setIsModalOpen(false);
    setAssignmentContext(null);
  }, []);

  const handleConfirmAssignment = useCallback((officialId: string) => {
    if (!assignmentContext) return;
    onUpdateAssignment(assignmentContext.matchId, assignmentContext.assignmentId, officialId);
    handleCloseAssignModal();
  }, [assignmentContext, onUpdateAssignment, handleCloseAssignModal]);
  
// FIX: Make the function async to satisfy the MatchCard prop type which expects a Promise.
  const handleOpenSheetModal = useCallback(async (match: Match) => {
    setMatchForSheet(match);
    setIsSheetModalOpen(true);
  }, []);

  const handleCloseSheetModal = useCallback(() => {
    setMatchForSheet(null);
    setIsSheetModalOpen(false);
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };
  
  const toggleLeague = (leagueId: string) => {
    setExpandedLeagues(prev => ({ ...prev, [leagueId]: !prev[leagueId] }));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !(prev[groupId] ?? true) }));
  };

  const currentMatchForModal = assignmentContext ? matches.find(m => m.id === assignmentContext.matchId) : null;
  
  const availableOfficials = currentMatchForModal && currentMatchForModal.matchDate
    ? officials.filter(official => {
        if (!official.isActive || official.isArchived) return false;

        const isAlreadyAssignedInThisMatch = currentMatchForModal.assignments.some(a => a.officialId === official.id);
        if (isAlreadyAssignedInThisMatch) return false;

        const matchDate = new Date(currentMatchForModal.matchDate);
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
            m.id !== currentMatchForModal.id &&
            m.matchDate === currentMatchForModal.matchDate &&
            !m.isArchived &&
            m.assignments.some(a => a.officialId === official.id)
        );
        if (isAssignedOnSameDay) return false;

        return true;
    })
    : [];


  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Désignations des Officiels</h2>
        </div>
        
        <div className="space-y-8">
            <section>
                <button onClick={() => toggleSection('recent')} className="flex items-center text-xl font-bold text-white mb-4 w-full text-left">
                    <ChevronDownIcon className={`h-6 w-6 mr-2 transition-transform duration-200 ${expandedSections.recent ? 'rotate-180' : ''}`} />
                    Matchs Récents à Vérifier ({recentMatchesToCheck.length})
                </button>
                {expandedSections.recent && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {recentMatchesToCheck.map(match => (
                        <MatchCard key={match.id} viewContext="assignments" {...props} match={match} onAssign={handleOpenAssignModal} onSendSheet={handleOpenSheetModal} onNotifyChanges={handleOpenSheetModal} onOpenScoreModal={handleOpenScoreModal} isSelected={selectedMatchIds.has(match.id)} onSelect={handleSelectMatch} />
                        ))}
                    </div>
                )}
            </section>
            
            <section>
                <button onClick={() => toggleSection('week')} className="flex items-center text-xl font-bold text-white mb-4 w-full text-left">
                    <ChevronDownIcon className={`h-6 w-6 mr-2 transition-transform duration-200 ${expandedSections.week ? 'rotate-180' : ''}`} />
                    Matchs de la Semaine ({thisWeekMatches.length})
                </button>
                {expandedSections.week && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {thisWeekMatches.map(match => (
                        <MatchCard key={match.id} viewContext="assignments" {...props} match={match} onAssign={handleOpenAssignModal} onSendSheet={handleOpenSheetModal} onNotifyChanges={handleOpenSheetModal} onOpenScoreModal={handleOpenScoreModal} isSelected={selectedMatchIds.has(match.id)} onSelect={handleSelectMatch} />
                        ))}
                    </div>
                )}
            </section>

             <section>
                <button onClick={() => toggleSection('upcoming')} className="flex items-center text-xl font-bold text-white mb-4 w-full text-left">
                    <ChevronDownIcon className={`h-6 w-6 mr-2 transition-transform duration-200 ${expandedSections.upcoming ? 'rotate-180' : ''}`} />
                    Prochaines Journées
                </button>
                {expandedSections.upcoming && (
                    <div className="space-y-4">
                        {sortedUpcomingLeagueIds.map(leagueId => {
                            const { league, groups } = upcomingMatchesData[leagueId];
                            const isLeagueExpanded = expandedLeagues[leagueId] ?? false;
                            return (
                                <div key={leagueId} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50">
                                    <button onClick={() => toggleLeague(leagueId)} className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/80 rounded-t-lg">
                                        <h3 className="text-xl font-semibold text-white">{league.name}</h3>
                                        <ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform ${isLeagueExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isLeagueExpanded && (
                                        <div className="p-4 space-y-6">
                                            {Object.values(groups).map(({ group, gameDays, sortedGameDays, stats }) => {
                                                const activeDay = activeGameDayTabs[group.id] || sortedGameDays[0];
                                                const isGroupExpanded = expandedGroups[group.id] ?? false;
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
                                                                <span title="Désignations complètes"><CheckCircleIcon className="h-4 w-4 text-green-500 inline mr-1"/>{stats.complete}/{stats.total}</span>
                                                                <span title="Feuilles envoyées"><PaperAirplaneIcon className="h-4 w-4 text-blue-400 inline mr-1"/>{stats.sent}/{stats.complete}</span>
                                                                <span title="Désignations restantes"><ExclamationCircleIcon className="h-4 w-4 text-yellow-500 inline mr-1"/>{stats.remaining}</span>
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
                                                                    {(gameDays[activeDay]?.matches || []).map(match => {
                                                                        const matchCardProps = {
                                                                            viewContext: "assignments" as const,
                                                                            match,
                                                                            officials,
                                                                            users,
                                                                            officialRoles,
                                                                            // FIX: Property 'locations' is missing in type '{...}' but required in type 'MatchCardProps'.
                                                                            locations,
                                                                            onAssign: handleOpenAssignModal,
                                                                            onSendSheet: handleOpenSheetModal,
                                                                            onNotifyChanges: handleOpenSheetModal,
                                                                            onOpenScoreModal: handleOpenScoreModal,
                                                                            onUpdateMatchStatus,
                                                                            onArchiveMatch,
                                                                            currentUser,
                                                                            permissions,
                                                                            isSelected: selectedMatchIds.has(match.id),
                                                                            onSelect: handleSelectMatch,
                                                                            onAddAssignment,
                                                                            onRemoveAssignment,
                                                                            onMarkOfficialAbsent,
                                                                        };
                                                                        return <MatchCard key={match.id} {...matchCardProps} />;
                                                                    })}
                                                                </div>
                                                            </div>
                                                          </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
      </main>
      
      <AssignmentModal
        isOpen={isModalOpen}
        onClose={handleCloseAssignModal}
        match={currentMatchForModal}
        role={assignmentContext?.role || null}
        availableOfficials={availableOfficials}
        onConfirmAssignment={handleConfirmAssignment}
        locations={locations}
      />
      <MatchSheetModal
        isOpen={isSheetModalOpen}
        onClose={handleCloseSheetModal}
        match={matchForSheet}
        officials={officials}
        onConfirmSend={onSendMatchSheet}
        onConfirmNotify={onNotifyChanges}
        // FIX: Property 'locations' is missing in type '{...}' but required in type 'MatchSheetModalProps'.
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
    </>
  );
};

export default AssignmentsView;
