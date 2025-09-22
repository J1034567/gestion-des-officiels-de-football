import React, { useMemo } from 'react';
import { Official, Match } from '../types';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import PencilIcon from './icons/PencilIcon';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import EnvelopeIcon from './icons/EnvelopeIcon';
import UsersIcon from './icons/UsersIcon';
import TrendingUpIcon from './icons/TrendingUpIcon';
import ListBulletIcon from './icons/ListBulletIcon';
import WhistleIcon from './icons/WhistleIcon';
import CalendarIcon from './icons/CalendarIcon';

interface OfficialDetailViewProps {
  official: Official;
  matches: Match[];
  onClose: () => void;
  onEdit: (official: Official) => void;
  onManageAvailability: (official: Official) => void;
  onSendMessage: (official: Official) => void;
}

const isUnavailableOnDate = (official: Official, date: Date | null): boolean => {
    if (!date) return false;
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0);
    return official.unavailabilities.some(unavailability => {
        const startDate = new Date(unavailability.startDate);
        const endDate = new Date(unavailability.endDate);
        startDate.setHours(12, 0, 0, 0);
        endDate.setHours(12, 0, 0, 0);
        return checkDate >= startDate && checkDate <= endDate;
    });
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg flex items-center">
        <div className="p-3 rounded-full bg-gray-700 mr-4">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const ActivityItem: React.FC<{ date: string, type: 'assignment' | 'unavailability', description: string, details?: string }> = ({ date, type, description, details }) => {
    const isAssignment = type === 'assignment';
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAssignment ? 'bg-brand-primary/20 text-brand-primary' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {isAssignment ? <WhistleIcon className="h-4 w-4" /> : <CalendarDaysIcon className="h-4 w-4" />}
                </div>
                <div className="w-px h-full bg-gray-700"></div>
            </div>
            <div className="pb-8">
                <p className="text-sm text-gray-400">{new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="font-semibold text-white">{description}</p>
                {details && <p className="text-sm text-gray-300">{details}</p>}
            </div>
        </div>
    );
};

const OfficialDetailView: React.FC<OfficialDetailViewProps> = ({ official, matches, onClose, onEdit, onManageAvailability, onSendMessage }) => {

    const metrics = useMemo(() => {
        const currentSeason = new Date().getFullYear().toString(); // Simplified for now
        const assignmentsThisSeason = matches
            .filter(m => !m.isArchived && m.season.startsWith(currentSeason))
            .flatMap(m => m.assignments.map(a => ({ ...a, match: m })))
            .filter(a => a.officialId === official.id);

        const roleCounts = assignmentsThisSeason.reduce((acc, a) => {
            acc[a.role] = (acc[a.role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const mostFrequentRole = Object.keys(roleCounts).length > 0
            ? Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0][0]
            : 'N/A';

        const leagueDistribution = assignmentsThisSeason.reduce((acc, a) => {
            const leagueName = a.match.leagueGroup.league.name;
            acc[leagueName] = (acc[leagueName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            matchesOfficiated: assignmentsThisSeason.length,
            mostFrequentRole,
            leagueDistribution
        };
    }, [official, matches]);
    
    const activities = useMemo(() => {
        const assignmentActivities = matches
            .flatMap(m => m.assignments.map(a => ({ ...a, match: m })))
            .filter(a => a.officialId === official.id && a.match.matchDate)
            .map(a => ({
                date: a.match.matchDate!,
                type: 'assignment' as const,
                description: `Désigné(e) comme ${a.role}`,
                details: `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`
            }));
            
        const unavailabilityActivities = official.unavailabilities.map(u => ({
            date: u.startDate,
            type: 'unavailability' as const,
            description: 'Période d\'indisponibilité',
            details: `Du ${new Date(u.startDate).toLocaleDateString('fr-FR')} au ${new Date(u.endDate).toLocaleDateString('fr-FR')}`
        }));
        
        return [...assignmentActivities, ...unavailabilityActivities]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10); // Limit to last 10 activities
    }, [official, matches]);
    
    const upcomingSchedule = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        const upcomingAssignments = matches
            .flatMap(m => m.assignments.map(a => ({ ...a, match: m })))
            .filter(a => a.officialId === official.id && a.match.matchDate && new Date(a.match.matchDate) >= today)
            .map(a => ({
                date: a.match.matchDate!,
                type: 'assignment' as const,
                description: `Match: ${a.role}`,
                details: `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`
            }));
            
        const upcomingUnavailabilities = official.unavailabilities
            .filter(u => new Date(u.endDate) >= today)
            .map(u => ({
                date: u.startDate,
                type: 'unavailability' as const,
                description: 'Indisponible',
                details: u.reason || `Jusqu'au ${new Date(u.endDate).toLocaleDateString('fr-FR')}`
            }));
        
        return [...upcomingAssignments, ...upcomingUnavailabilities]
            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [official, matches]);

    const isAvailableToday = !isUnavailableOnDate(official, new Date());

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
            <div className="mb-6">
                <button onClick={onClose} className="flex items-center text-sm font-semibold text-gray-300 hover:text-white">
                    <ArrowLeftIcon className="h-5 w-5 mr-2" />
                    Retour à la liste
                </button>
            </div>

            <header className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center">
                        <UsersIcon className="h-10 w-10 text-gray-400" />
                    </div>
                    <div className="ml-6">
                        <h2 className="text-3xl font-bold text-white">{official.fullName}</h2>
                        <p className="text-lg text-brand-primary font-semibold">{official.category}</p>
                        <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isAvailableToday ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                            {isAvailableToday ? 'Disponible aujourd\'hui' : 'Indisponible aujourd\'hui'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button onClick={() => onEdit(official)} className="flex-1 md:flex-none flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"><PencilIcon className="h-5 w-5 md:mr-2" /><span className="hidden md:inline">Modifier</span></button>
                    <button onClick={() => onManageAvailability(official)} className="flex-1 md:flex-none flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"><CalendarDaysIcon className="h-5 w-5 md:mr-2" /><span className="hidden md:inline">Disponibilités</span></button>
                    <button onClick={() => onSendMessage(official)} className="flex-1 md:flex-none flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"><EnvelopeIcon className="h-5 w-5 md:mr-2" /><span className="hidden md:inline">Message</span></button>
                </div>
            </header>
            
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center"><TrendingUpIcon className="h-6 w-6 mr-2 text-gray-400"/>Performances (Saison Actuelle)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard title="Matchs Officiés" value={metrics.matchesOfficiated} icon={<WhistleIcon className="h-6 w-6 text-yellow-400"/>} />
                            <StatCard title="Rôle le plus fréquent" value={metrics.mostFrequentRole} icon={<UsersIcon className="h-6 w-6 text-blue-400"/>} />
                            <StatCard title="Ligues" value={Object.keys(metrics.leagueDistribution).length} icon={<ListBulletIcon className="h-6 w-6 text-purple-400"/>} />
                        </div>
                    </section>
                    <section>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center"><ListBulletIcon className="h-6 w-6 mr-2 text-gray-400"/>Activité Récente</h3>
                        <div className="bg-gray-800 p-4 rounded-lg">
                            {activities.length > 0 ? (
                                activities.map((activity, index) => (
                                    <ActivityItem key={index} {...activity} />
                                ))
                            ) : (
                                <p className="text-gray-400 text-center py-4">Aucune activité récente.</p>
                            )}
                        </div>
                    </section>
                </div>
                <div className="lg:col-span-1">
                    <section>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center"><CalendarIcon className="h-6 w-6 mr-2 text-gray-400"/>Planning à venir</h3>
                        <div className="bg-gray-800 p-4 rounded-lg space-y-3">
                            {upcomingSchedule.length > 0 ? (
                                upcomingSchedule.map((item, index) => (
                                    <div key={index} className="bg-gray-900/50 p-3 rounded-md">
                                        <p className="text-sm font-semibold text-white">{new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                        <div className="flex items-start mt-1">
                                            <div className={`w-2 h-2 rounded-full mr-2 mt-1.5 flex-shrink-0 ${item.type === 'assignment' ? 'bg-brand-primary' : 'bg-yellow-400'}`}></div>
                                            <div>
                                                <p className="text-sm text-gray-200">{item.description}</p>
                                                <p className="text-xs text-gray-400">{item.details}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 text-center py-4">Aucun événement à venir.</p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
};

export default OfficialDetailView;
