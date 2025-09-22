
import React, { useState, useMemo, useEffect } from 'react';
import { Match, Team, League, LeagueGroup, User, MatchStatus, Ranking } from '../types';
import TableCellsIcon from './icons/TableCellsIcon';

// --- Ranking Calculation Logic ---
const calculateRankings = (matches: Match[], teams: Team[]): Ranking[] => {
    const stats: { [teamId: string]: Omit<Ranking, 'team' | 'rank'> } = {};

    teams.forEach(team => {
        stats[team.id] = {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
        };
    });

    matches
        .filter(m => m.status === MatchStatus.COMPLETED && m.homeScore !== null && m.awayScore !== null)
        .forEach(match => {
            const homeStats = stats[match.homeTeam.id];
            const awayStats = stats[match.awayTeam.id];
            const homeScore = match.homeScore!;
            const awayScore = match.awayScore!;

            if (homeStats) {
                homeStats.played++;
                homeStats.goalsFor += homeScore;
                homeStats.goalsAgainst += awayScore;
            }
            if (awayStats) {
                awayStats.played++;
                awayStats.goalsFor += awayScore;
                awayStats.goalsAgainst += homeScore;
            }

            if (homeScore > awayScore) {
                if (homeStats) { homeStats.wins++; homeStats.points += 3; }
                if (awayStats) { awayStats.losses++; }
            } else if (awayScore > homeScore) {
                if (awayStats) { awayStats.wins++; awayStats.points += 3; }
                if (homeStats) { homeStats.losses++; }
            } else {
                if (homeStats) { homeStats.draws++; homeStats.points += 1; }
                if (awayStats) { awayStats.draws++; awayStats.points += 1; }
            }
        });
        
    const rankedList = teams
        .filter(team => stats[team.id]?.played > 0)
        .map(team => {
            const teamStats = stats[team.id];
            teamStats.goalDifference = teamStats.goalsFor - teamStats.goalsAgainst;
            return {
                team: team,
                ...teamStats,
            };
        })
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            return a.team.name.localeCompare(b.team.name);
        })
        .map((item, index) => ({ ...item, rank: index + 1 }));

    return rankedList as Ranking[];
};

interface RankingsViewProps {
    matches: Match[];
    teams: Team[];
    leagues: League[];
    leagueGroups: LeagueGroup[];
    currentUser: User;
}

const RankingsView: React.FC<RankingsViewProps> = ({ matches, teams, leagues, leagueGroups, currentUser }) => {
    const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');

    // Set default selections
    useEffect(() => {
        if (leagues.length > 0 && !selectedLeagueId) {
            setSelectedLeagueId(leagues[0].id);
        }
    }, [leagues, selectedLeagueId]);
    
    useEffect(() => {
        if (selectedLeagueId) {
            const groupsInLeague = leagueGroups.filter(g => g.league_id === selectedLeagueId);
            if (groupsInLeague.length > 0) {
                 setSelectedGroupId(groupsInLeague[0].id);
            } else {
                 setSelectedGroupId('');
            }
        }
    }, [selectedLeagueId, leagueGroups]);

    const availableGroups = useMemo(() => {
        if (!selectedLeagueId) return [];
        return leagueGroups.filter(g => g.league_id === selectedLeagueId).sort((a,b) => a.name.localeCompare(b.name));
    }, [selectedLeagueId, leagueGroups]);

    const rankings = useMemo(() => {
        if (!selectedGroupId) return [];
        const group = leagueGroups.find(g => g.id === selectedGroupId);
        if (!group) return [];
        
        const groupTeamIds = new Set(group.teamIds);
        const groupTeams = teams.filter(t => groupTeamIds.has(t.id));
        const groupMatches = matches.filter(m => m.leagueGroup.id === selectedGroupId);

        return calculateRankings(groupMatches, groupTeams);
    }, [selectedGroupId, matches, teams, leagueGroups]);
    
    const handleLeagueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLeagueId = e.target.value;
        setSelectedLeagueId(newLeagueId);
        // Automatically select the first group of the new league
        const groupsInNewLeague = leagueGroups.filter(g => g.league_id === newLeagueId).sort((a,b) => a.name.localeCompare(b.name));
        setSelectedGroupId(groupsInNewLeague[0]?.id || '');
    };

    return (
        <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center mb-6">
                <TableCellsIcon className="h-8 w-8 text-brand-primary mr-3" />
                <h2 className="text-3xl font-bold text-white">Classements</h2>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
                <div>
                    <label htmlFor="league-select-ranking" className="block text-sm font-medium text-gray-400 mb-1">Ligue</label>
                    <select
                        id="league-select-ranking"
                        value={selectedLeagueId}
                        onChange={handleLeagueChange}
                        className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                    >
                        {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="group-select-ranking" className="block text-sm font-medium text-gray-400 mb-1">Groupe</label>
                    <select
                        id="group-select-ranking"
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        disabled={availableGroups.length === 0}
                        className="bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50"
                    >
                         {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider w-12">#</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Équipe</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Joués">J</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Gagnés">G</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Nuls">N</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Perdus">P</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Buts Pour">BP</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Buts Contre">BC</th>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Différence de Buts">DB</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Points">Pts</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-700">
                            {rankings.map(r => (
                                <tr key={r.team.id} className={currentUser.teamId === r.team.id ? 'bg-brand-primary/10' : 'hover:bg-gray-700/50'}>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.rank}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img className="h-6 w-6 rounded-full mr-3" src={r.team.logoUrl || ''} alt="" />
                                            <div className="text-sm font-medium text-white">{r.team.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.played}</td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.wins}</td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.draws}</td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.losses}</td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.goalsFor}</td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.goalsAgainst}</td>
                                    <td className="px-2 py-4 text-center text-sm text-gray-300">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                                    <td className="px-4 py-4 text-center text-sm font-bold text-white">{r.points}</td>
                                </tr>
                            ))}
                         </tbody>
                    </table>
                     {rankings.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            Aucun match joué pour ce groupe.
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default RankingsView;
