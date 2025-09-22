
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { IndemnityRates, OfficialRole, Official, Match, User, Team, Stadium, League, LeagueGroup, Location, OptimizationSettings as OptimizationSettingsType, FinancialSettings, DisciplinarySettings } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';
import CurrencyIcon from './icons/CurrencyIcon';
import ConfirmationModal from './ConfirmationModal';
import SeasonModal from './SeasonModal';
import SitemapIcon from './icons/SitemapIcon';
import PencilIcon from './icons/PencilIcon';
import LeagueModal from './LeagueModal';
import LeagueGroupModal from './LeagueGroupModal';
import AssignTeamsModal from './AssignTeamsModal';
import UsersGroupIcon from './icons/UsersGroupIcon';
import { Permissions } from '../hooks/usePermissions';
import { importOfficials, importTeams, importStadiums, importMatches, importAssignments, importOptimizedDelegateAssignments } from '../services/importService';
import ImportCard from './ImportCard';
import CalculatorIcon from './icons/CalculatorIcon';
import OptimizationModal from './OptimizationModal';
import UserSettings from './UserSettings';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CloseIcon from './icons/CloseIcon';
import ShieldExclamationIcon from './icons/ShieldExclamationIcon';


interface SettingsViewProps {
  indemnityRates: IndemnityRates;
  officialCategories: string[];
  officialRoles: OfficialRole[];
  rejectionReasons: string[];
  leagues: League[];
  leagueGroups: LeagueGroup[];
  officials: Official[];
  matches: Match[];
  teams: Team[];
  stadiums: Stadium[];
  locations: Location[];
  seasons: string[];
  currentSeason: string;
  optimizationSettings: OptimizationSettingsType | null;
  financialSettings: FinancialSettings | null;
  disciplinarySettings: DisciplinarySettings | null;
  users: User[];
  allRoles: { id: string, name: string }[];
  onUpdateSettings: (newSettings: any) => void;
  onSaveLeague: (league: Partial<League>) => void;
  onSaveLeagueGroup: (group: Partial<LeagueGroup>) => void;
  onSaveGroupTeams: (groupId: string, teamIds: string[]) => void;
  onDeleteLeague: (leagueId: string) => void;
  onDeleteLeagueGroup: (groupId: string) => void;
  onUpdateUserRole: (userId: string, roleName: string) => void;
  onRestoreOfficial: (officialId: string) => void;
  onRestoreTeam: (teamId: string) => void;
  onRestoreStadium: (stadiumId: string) => void;
  onRestoreMatch: (matchId: string) => void;
  onGenerateTemplate: (headers: string[], sheetName: string, fileName: string) => void;
  onImportOfficials: (data: any[]) => Promise<void>;
  onImportTeams: (data: any[]) => Promise<void>;
  onImportStadiums: (data: any[]) => Promise<void>;
  onImportMatches: (data: any[]) => Promise<void>;
  onImportAssignments: (data: any[]) => Promise<void>;
  onImportOptimizedAssignments: (data: any[]) => Promise<void>;
  onLaunchOptimization: (scope: { leagueGroupIds: string[]; gameDays: number[] }) => void;
  currentUser: User;
  permissions: Permissions;
  isDirty: boolean;
  setIsDirty: (isDirty: boolean) => void;
}

type InternalSettingsViewProps = Omit<SettingsViewProps, 'indemnityRates' | 'officialCategories' | 'officialRoles' | 'rejectionReasons' | 'seasons' | 'optimizationSettings' | 'financialSettings' | 'disciplinarySettings' | 'isDirty' | 'setIsDirty'> & {
    indemnityRates: IndemnityRates;
    setIndemnityRates: (rates: IndemnityRates) => void;
    officialCategories: string[];
    setOfficialCategories: (cats: string[]) => void;
    officialRoles: OfficialRole[];
    setOfficialRoles: (roles: OfficialRole[]) => void;
    rejectionReasons: string[];
    setRejectionReasons: (reasons: string[]) => void;
    seasons: string[];
    setSeasons: (seasons: string[]) => void;
    optimizationSettings: OptimizationSettingsType | null;
    setOptimizationSettings: (settings: OptimizationSettingsType | null) => void;
    financialSettings: FinancialSettings | null;
    setFinancialSettings: (settings: FinancialSettings | null) => void;
    disciplinarySettings: DisciplinarySettings | null;
    setDisciplinarySettings: (settings: DisciplinarySettings | null) => void;
    isDirty: boolean;
    setIsDirty: (isDirty: boolean) => void;
    openLeagueModal: (league?: League) => void;
    openLeagueGroupModal: (league: League, group?: LeagueGroup) => void;
    openDeletionModal: (type: DeletionType, id: string, name: string) => void;
};


type SettingsTab = 'finances' | 'structure' | 'optimisation' | 'users' | 'corbeille' | 'discipline';
type ArchiveType = 'officials' | 'teams' | 'stadiums' | 'matches';
type DeletionType = 'league' | 'league_group' | 'season' | 'category' | 'role' | 'rejection_reason';

const CorbeilleSettings: React.FC<SettingsViewProps> = ({
    officials, teams, stadiums, matches,
    onRestoreOfficial, onRestoreTeam, onRestoreStadium, onRestoreMatch
}) => {
    const [archiveType, setArchiveType] = useState<ArchiveType>('officials');
    
    const archivedOfficials = useMemo(() => officials.filter(o => o.isArchived), [officials]);
    const archivedTeams = useMemo(() => teams.filter(t => t.isArchived), [teams]);
    const archivedStadiums = useMemo(() => stadiums.filter(s => s.isArchived), [stadiums]);
    const archivedMatches = useMemo(() => matches.filter(m => m.isArchived), [matches]);

    const tabs: { id: ArchiveType, label: string, count: number }[] = [
        { id: 'officials', label: 'Officiels', count: archivedOfficials.length },
        { id: 'teams', label: 'Équipes', count: archivedTeams.length },
        { id: 'stadiums', label: 'Stades', count: archivedStadiums.length },
        { id: 'matches', label: 'Matchs', count: archivedMatches.length },
    ];

    const renderList = () => {
        switch (archiveType) {
            case 'officials':
                return (
                    <ul className="divide-y divide-gray-700">
                        {archivedOfficials.map(o => (
                            <li key={o.id} className="py-2 flex justify-between items-center">
                                <span>{o.fullName} ({o.category})</span>
                                <button onClick={() => onRestoreOfficial(o.id)} className="text-sm text-brand-primary hover:underline">Restaurer</button>
                            </li>
                        ))}
                    </ul>
                );
            case 'teams':
                 return (
                     <ul className="divide-y divide-gray-700">
                        {archivedTeams.map(t => (
                            <li key={t.id} className="py-2 flex justify-between items-center">
                                <span>{t.name}</span>
                                <button onClick={() => onRestoreTeam(t.id)} className="text-sm text-brand-primary hover:underline">Restaurer</button>
                            </li>
                        ))}
                    </ul>
                );
            case 'stadiums':
                 return (
                     <ul className="divide-y divide-gray-700">
                        {archivedStadiums.map(s => (
                            <li key={s.id} className="py-2 flex justify-between items-center">
                                <span>{s.name}</span>
                                <button onClick={() => onRestoreStadium(s.id)} className="text-sm text-brand-primary hover:underline">Restaurer</button>
                            </li>
                        ))}
                    </ul>
                );
            case 'matches':
                 return (
                     <ul className="divide-y divide-gray-700">
                        {archivedMatches.map(m => (
                            <li key={m.id} className="py-2 flex justify-between items-center">
                                <span>{m.homeTeam.name} vs {m.awayTeam.name} ({m.matchDate})</span>
                                <button onClick={() => onRestoreMatch(m.id)} className="text-sm text-brand-primary hover:underline">Restaurer</button>
                            </li>
                        ))}
                    </ul>
                );
            default:
                return null;
        }
    };
    
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Corbeille</h3>
            <p className="text-sm text-gray-400 mb-6">Restaurez les éléments archivés. Les éléments restaurés redeviendront actifs dans l'application.</p>
            <div className="border-b border-gray-700 mb-4">
                <nav className="-mb-px flex space-x-4">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setArchiveType(tab.id)}
                            className={`${archiveType === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-white'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                        >
                            {tab.label} <span className="ml-2 bg-gray-700 text-gray-300 rounded-full px-2 py-0.5 text-xs">{tab.count}</span>
                        </button>
                    ))}
                </nav>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {renderList()}
            </div>
        </div>
    );
};


const SettingsView: React.FC<SettingsViewProps> = (props) => {
  const { onUpdateSettings, indemnityRates, officialCategories, officialRoles, seasons, rejectionReasons, isDirty, setIsDirty, optimizationSettings, financialSettings, disciplinarySettings, permissions, ...restProps } = props;
  const [activeTab, setActiveTab] = useState<SettingsTab>('finances');
  
  const [localRates, setLocalRates] = useState(indemnityRates);
  const [localCategories, setLocalCategories] = useState(officialCategories);
  const [localRoles, setLocalRoles] = useState(officialRoles);
  const [localSeasons, setLocalSeasons] = useState(seasons);
  const [localRejectionReasons, setLocalRejectionReasons] = useState(rejectionReasons);
  const [localOptimizationSettings, setLocalOptimizationSettings] = useState(optimizationSettings);
  const [localFinancialSettings, setLocalFinancialSettings] = useState(financialSettings);
  const [localDisciplinarySettings, setLocalDisciplinarySettings] = useState(disciplinarySettings);
  
  // Centralized Modal State
  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LeagueGroup | null>(null);
  const [groupModalContext, setGroupModalContext] = useState<League | null>(null);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [itemForDeletion, setItemForDeletion] = useState<{ type: DeletionType; id: string; name: string } | null>(null);
  const [isAssignTeamsModalOpen, setIsAssignTeamsModalOpen] = useState(false);
  const [groupForTeamAssignment, setGroupForTeamAssignment] = useState<LeagueGroup | null>(null);


  useEffect(() => {
    setLocalRates(props.indemnityRates);
    setLocalCategories(props.officialCategories);
    setLocalRoles(props.officialRoles);
    setLocalSeasons(props.seasons);
    setLocalRejectionReasons(props.rejectionReasons);
    setLocalOptimizationSettings(props.optimizationSettings);
    setLocalFinancialSettings(props.financialSettings);
    setLocalDisciplinarySettings(props.disciplinarySettings);
  }, [props.indemnityRates, props.officialCategories, props.officialRoles, props.seasons, props.rejectionReasons, props.optimizationSettings, props.financialSettings, props.disciplinarySettings]);
  
  useEffect(() => {
    const dirty = JSON.stringify(localRates) !== JSON.stringify(props.indemnityRates) ||
           JSON.stringify(localCategories.sort()) !== JSON.stringify([...props.officialCategories].sort()) ||
           JSON.stringify(localRoles.sort()) !== JSON.stringify([...props.officialRoles].sort()) ||
           JSON.stringify(localSeasons.sort()) !== JSON.stringify([...props.seasons].sort()) ||
           JSON.stringify(localRejectionReasons.sort()) !== JSON.stringify([...props.rejectionReasons].sort()) ||
           JSON.stringify(localOptimizationSettings) !== JSON.stringify(props.optimizationSettings) ||
           JSON.stringify(localFinancialSettings) !== JSON.stringify(props.financialSettings) ||
           JSON.stringify(localDisciplinarySettings) !== JSON.stringify(props.disciplinarySettings);
    setIsDirty(dirty);
  }, [localRates, localCategories, localRoles, localSeasons, localRejectionReasons, localOptimizationSettings, localFinancialSettings, localDisciplinarySettings, props.indemnityRates, props.officialCategories, props.officialRoles, props.seasons, props.rejectionReasons, props.optimizationSettings, props.financialSettings, props.disciplinarySettings, setIsDirty]);


  const handleSave = () => {
    onUpdateSettings({
        indemnity_rates: localRates,
        official_categories: localCategories,
        roles: localRoles,
        seasons: localSeasons,
        rejection_reasons: localRejectionReasons,
        optimization_settings: localOptimizationSettings,
        financial_settings: localFinancialSettings,
        disciplinary_settings: localDisciplinarySettings,
    });
  };

  const handleReset = () => {
    setLocalRates(props.indemnityRates);
    setLocalCategories(props.officialCategories);
    setLocalRoles(props.officialRoles);
    setLocalSeasons(props.seasons);
    setLocalRejectionReasons(props.rejectionReasons);
    setLocalOptimizationSettings(props.optimizationSettings);
    setLocalFinancialSettings(props.financialSettings);
    setLocalDisciplinarySettings(props.disciplinarySettings);
  };
  
  const openLeagueModal = (league?: League) => {
    setEditingLeague(league || null);
    setIsLeagueModalOpen(true);
  };

  const openLeagueGroupModal = (league: League, group?: LeagueGroup) => {
    setGroupModalContext(league);
    setEditingGroup(group || null);
    setIsGroupModalOpen(true);
  };
  
  const openDeletionModal = (type: DeletionType, id: string, name: string) => {
    setItemForDeletion({ type, id, name });
  };
  
  const openAssignTeamsModal = (group: LeagueGroup) => {
    setGroupForTeamAssignment(group);
    setIsAssignTeamsModalOpen(true);
  };
  
  const handleConfirmDelete = () => {
    if (!itemForDeletion) return;
    const { type, id } = itemForDeletion;
    switch (type) {
        case 'league': props.onDeleteLeague(id); break;
        case 'league_group': props.onDeleteLeagueGroup(id); break;
        case 'season': setLocalSeasons(prev => prev.filter(s => s !== id)); break;
        case 'category': setLocalCategories(prev => prev.filter(c => c !== id)); break;
        case 'role': setLocalRoles(prev => prev.filter(r => r !== id)); break;
        case 'rejection_reason': setLocalRejectionReasons(prev => prev.filter(r => r !== id)); break;
    }
    setItemForDeletion(null);
  };
  
  const handleAddSeason = (seasonName: string) => {
    if (seasonName && !localSeasons.includes(seasonName)) {
        setLocalSeasons([...localSeasons, seasonName]);
    }
  };


  const childProps: InternalSettingsViewProps = {
    ...restProps,
    indemnityRates: localRates,
    setIndemnityRates: setLocalRates,
    officialCategories: localCategories,
    setOfficialCategories: setLocalCategories,
    officialRoles: localRoles,
    setOfficialRoles: setLocalRoles,
    rejectionReasons: localRejectionReasons,
    setRejectionReasons: setLocalRejectionReasons,
    seasons: localSeasons,
    setSeasons: setLocalSeasons,
    financialSettings: localFinancialSettings,
    setFinancialSettings: setLocalFinancialSettings,
    disciplinarySettings: localDisciplinarySettings,
    setDisciplinarySettings: setLocalDisciplinarySettings,
    optimizationSettings: localOptimizationSettings,
    setOptimizationSettings: setLocalOptimizationSettings,
    onUpdateSettings: handleSave,
    openLeagueModal,
    openLeagueGroupModal,
    openDeletionModal,
    isDirty,
    setIsDirty,
    permissions,
  };

  const renderContent = () => {
    switch(activeTab) {
        case 'finances': return <FinancesSettings {...childProps} />;
        case 'discipline': return <DisciplineSettings {...childProps} />;
        case 'structure': return <StructureSettings {...childProps} openSeasonModal={() => setIsSeasonModalOpen(true)} openAssignTeamsModal={openAssignTeamsModal}/>;
        case 'optimisation': return <OptimizationSettings {...childProps} />;
        case 'users': return <UserSettings users={props.users} allRoles={props.allRoles} onUpdateUserRole={props.onUpdateUserRole} currentUser={props.currentUser} permissions={props.permissions} />;
        case 'corbeille': return <CorbeilleSettings {...props} />;
        default: return null;
    }
  }

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-white mb-8">Paramètres de l'Application</h2>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-1/4 lg:w-1/5">
            <nav className="flex flex-col space-y-2">
                <TabButton icon={<CurrencyIcon className="h-5 w-5 mr-3"/>} label="Finances" isActive={activeTab === 'finances'} onClick={() => setActiveTab('finances')} />
                <TabButton icon={<ShieldExclamationIcon className="h-5 w-5 mr-3"/>} label="Discipline" isActive={activeTab === 'discipline'} onClick={() => setActiveTab('discipline')} />
                <TabButton icon={<SitemapIcon className="h-5 w-5 mr-3"/>} label="Structure & Données" isActive={activeTab === 'structure'} onClick={() => setActiveTab('structure')} />
                <TabButton icon={<CalculatorIcon className="h-5 w-5 mr-3"/>} label="Optimisation" isActive={activeTab === 'optimisation'} onClick={() => setActiveTab('optimisation')} />
                {permissions.can('view', 'users') && <TabButton icon={<UsersGroupIcon className="h-5 w-5 mr-3"/>} label="Utilisateurs" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />}
                <TabButton icon={<TrashIcon className="h-5 w-5 mr-3"/>} label="Corbeille" isActive={activeTab === 'corbeille'} onClick={() => setActiveTab('corbeille')} />
            </nav>
        </aside>
        <div className="flex-1">
            {renderContent()}
        </div>
      </div>
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-50 animate-fade-in-up">
            <div className="max-w-7xl mx-auto flex justify-end items-center gap-4">
                <p className="text-white font-medium mr-4">Vous avez des modifications non enregistrées.</p>
                <button onClick={handleReset} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500">
                    Annuler
                </button>
                <button onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
                    Enregistrer les Modifications
                </button>
            </div>
        </div>
      )}
      
      {/* Centralized Modals */}
      <LeagueModal 
          isOpen={isLeagueModalOpen}
          onClose={() => setIsLeagueModalOpen(false)}
          onSave={props.onSaveLeague}
          leagueToEdit={editingLeague}
          leagues={props.leagues}
      />
      {groupModalContext && <LeagueGroupModal 
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          onSave={props.onSaveLeagueGroup}
          groupToEdit={editingGroup}
          league={groupModalContext}
          season={props.currentSeason}
      />}
      {groupForTeamAssignment && <AssignTeamsModal 
          isOpen={isAssignTeamsModalOpen}
          onClose={() => setIsAssignTeamsModalOpen(false)}
          onSave={props.onSaveGroupTeams}
          leagueGroup={groupForTeamAssignment}
          allTeams={props.teams}
          assignedTeamIds={groupForTeamAssignment.teamIds}
          leagueGroups={props.leagueGroups}
      />}
      <SeasonModal
          isOpen={isSeasonModalOpen}
          onClose={() => setIsSeasonModalOpen(false)}
          onSave={handleAddSeason}
          existingSeasons={localSeasons}
      />
      <ConfirmationModal
          isOpen={!!itemForDeletion}
          onClose={() => setItemForDeletion(null)}
          onConfirm={handleConfirmDelete}
          title={`Supprimer "${itemForDeletion?.name}"`}
          message="Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible."
      />

    </main>
  );
};

const TabButton: React.FC<{icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void}> = ({ icon, label, isActive, onClick}) => (
    <button onClick={onClick} className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
        {icon}
        {label}
    </button>
)

const FinancesSettings: React.FC<InternalSettingsViewProps> = ({ indemnityRates, setIndemnityRates, leagues, officialRoles, setOfficialRoles, matches, openLeagueModal, openDeletionModal, rejectionReasons, setRejectionReasons, financialSettings, setFinancialSettings }) => {
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [activeRoleMenu, setActiveRoleMenu] = useState<string | null>(null);

    const isRoleInUse = (role: string) => matches.some(m => !m.isArchived && m.assignments.some(a => a.role === role));
    const isRejectionReasonInUse = (reason: string) => matches.some(m => m.rejectionReason === reason);

    const handleRateChange = (leagueId: string, role: OfficialRole, value: string) => {
        const newRates = JSON.parse(JSON.stringify(indemnityRates));
        if (!newRates[leagueId]) newRates[leagueId] = {};
        newRates[leagueId][role] = Number(value) || 0;
        setIndemnityRates(newRates);
    };

    const handleAddNewRole = () => {
        const trimmedName = newRoleName.trim();
        if (trimmedName && !officialRoles.includes(trimmedName)) {
            setOfficialRoles([...officialRoles, trimmedName]);
        }
        setNewRoleName('');
        setIsAddingRole(false);
    }

    return (
        <div className="space-y-8">
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Paramètres Financiers</h3>
                <div>
                    <label htmlFor="irg-rate" className="block text-sm font-medium text-gray-300">Taux d'IRG (Impôt sur le Revenu Global) en %</label>
                    <input
                        type="number"
                        id="irg-rate"
                        min="0"
                        step="0.1"
                        value={financialSettings?.irgRatePercent ?? 0}
                        onChange={(e) => setFinancialSettings({ irgRatePercent: Number(e.target.value) })}
                        className="mt-1 w-full md:w-1/3 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">Ce taux s'applique sur l'indemnité de base de l'officiel (hors bonus et ajustements).</p>
                </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <h3 className="text-xl font-bold text-white">Grille des Indemnités</h3>
                    <button onClick={() => openLeagueModal()} className="flex items-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-3 text-sm rounded-lg transition-colors">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Ajouter une ligue
                    </button>
                </div>
                {leagues.length === 0 ? (
                    <div className="text-center py-8">
                        <CurrencyIcon className="mx-auto h-12 w-12 text-gray-500" />
                        <h4 className="mt-4 text-lg font-semibold text-white">Aucune ligue définie</h4>
                        <p className="text-gray-400">Ajoutez une ligue pour commencer à définir les indemnités.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ligue</th>
                                {officialRoles.map(role => (
                                    <th key={role} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider group relative">
                                        <div className="flex items-center justify-between">
                                            <span>{role}</span>
                                            <div className="relative">
                                                <button onClick={() => setActiveRoleMenu(activeRoleMenu === role ? null : role)} onBlur={() => setTimeout(() => setActiveRoleMenu(null), 150)} className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                                </button>
                                                {activeRoleMenu === role && (
                                                    <div className="absolute right-0 mt-2 w-40 bg-gray-600 rounded-md shadow-lg z-20">
                                                        <button
                                                            onClick={() => openDeletionModal('role', role, role)}
                                                            disabled={isRoleInUse(role)}
                                                            title={isRoleInUse(role) ? "Ce rôle est utilisé et ne peut être supprimé." : "Supprimer le rôle"}
                                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-red-300 hover:bg-red-500 hover:text-white rounded-md disabled:text-gray-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                                        >
                                                            <TrashIcon className="h-4 w-4 mr-2" />
                                                            Supprimer
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-left">
                                    {isAddingRole ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newRoleName}
                                                onChange={e => setNewRoleName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddNewRole()}
                                                autoFocus
                                                className="w-32 bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white text-sm"
                                            />
                                            <button onClick={handleAddNewRole} className="p-1 text-green-400 hover:text-green-300"><CheckCircleIcon className="h-5 w-5"/></button>
                                            <button onClick={() => setIsAddingRole(false)} className="p-1 text-red-400 hover:text-red-300"><CloseIcon className="h-5 w-5"/></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setIsAddingRole(true)} className="flex items-center text-xs font-semibold text-brand-primary hover:text-brand-secondary">
                                            <PlusIcon className="h-4 w-4 mr-1"/> Ajouter Rôle
                                        </button>
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {leagues.sort((a,b) => a.name.localeCompare(b.name)).map(league => (
                            <tr key={league.id} className="odd:bg-gray-800 even:bg-gray-900/50 hover:bg-gray-700/50">
                                <td className="px-4 py-4 whitespace-nowrap font-medium text-white">{league.name}</td>
                                {officialRoles.map(role => (
                                <td key={role} className="px-4 py-4 whitespace-nowrap">
                                    <input
                                    type="number"
                                    className="w-24 bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white focus:ring-brand-primary focus:border-brand-primary"
                                    value={indemnityRates[league.id]?.[role] || ''}
                                    onChange={(e) => handleRateChange(league.id, role, e.target.value)}
                                    />
                                </td>
                                ))}
                                <td></td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                )}
            </div>
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <NomenclatureListManager
                    title="Motifs de Rejet Prédéfinis"
                    items={rejectionReasons}
                    onAdd={(value) => setRejectionReasons([...rejectionReasons, value])}
                    onDelete={(value) => openDeletionModal('rejection_reason', value, value)}
                    isInUse={isRejectionReasonInUse}
                />
            </div>
        </div>
    )
}

const DisciplineSettings: React.FC<InternalSettingsViewProps> = ({ disciplinarySettings, setDisciplinarySettings }) => {
    if (!disciplinarySettings) return null;

    const handleChange = (field: keyof DisciplinarySettings, value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0) {
            setDisciplinarySettings({ ...disciplinarySettings, [field]: numValue });
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
            <h3 className="text-xl font-bold text-white">Règles de Suspension Automatique</h3>
            <div>
                <label htmlFor="yellowCardThreshold" className="block text-sm font-medium text-gray-300">
                    Suspension après accumulation de cartons jaunes
                </label>
                <div className="mt-1 flex items-center gap-2 text-gray-200">
                    <span>Après</span>
                    <input
                        type="number"
                        id="yellowCardThreshold"
                        min="1"
                        value={disciplinarySettings.yellowCardThreshold}
                        onChange={(e) => handleChange('yellowCardThreshold', e.target.value)}
                        className="w-20 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white text-center"
                    />
                    <span>cartons jaunes, suspendre pour</span>
                     <input
                        type="number"
                        id="yellowCardSuspension"
                        min="1"
                        value={disciplinarySettings.yellowCardSuspension}
                        onChange={(e) => handleChange('yellowCardSuspension', e.target.value)}
                        className="w-20 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white text-center"
                    />
                    <span>match(s).</span>
                </div>
            </div>
             <div>
                <label htmlFor="directRedCardSuspension" className="block text-sm font-medium text-gray-300">
                    Suspension par défaut pour un Carton Rouge Direct
                </label>
                 <div className="mt-1 flex items-center gap-2 text-gray-200">
                     <input
                        type="number"
                        id="directRedCardSuspension"
                        min="1"
                        value={disciplinarySettings.directRedCardSuspension}
                        onChange={(e) => handleChange('directRedCardSuspension', e.target.value)}
                        className="w-20 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white text-center"
                    />
                    <span>match(s) de suspension.</span>
                </div>
                 <p className="text-xs text-gray-400 mt-1">Cette valeur sera pré-remplie lors de la saisie d'une sanction, mais pourra être modifiée.</p>
            </div>
             <div>
                <label htmlFor="twoYellowsRedCardSuspension" className="block text-sm font-medium text-gray-300">
                    Suspension par défaut pour un Carton Rouge (2 Avert.)
                </label>
                 <div className="mt-1 flex items-center gap-2 text-gray-200">
                     <input
                        type="number"
                        id="twoYellowsRedCardSuspension"
                        min="1"
                        value={disciplinarySettings.twoYellowsRedCardSuspension}
                        onChange={(e) => handleChange('twoYellowsRedCardSuspension', e.target.value)}
                        className="w-20 bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white text-center"
                    />
                    <span>match(s) de suspension.</span>
                </div>
            </div>
        </div>
    );
};

const StructureSettings: React.FC<InternalSettingsViewProps & { openSeasonModal: () => void; openAssignTeamsModal: (group: LeagueGroup) => void }> = (props) => {
    const { 
        leagues, openLeagueModal, officialRoles,
        onGenerateTemplate, onImportOfficials, onImportTeams, onImportStadiums, onImportMatches, onImportAssignments, onImportOptimizedAssignments,
        officialCategories, teams, stadiums, leagueGroups, locations,
    } = props;

    const leagueTree = leagues.reduce((acc, league) => {
        acc[league.id] = { ...league, children: [] };
        return acc;
    }, {} as Record<string, League & { children: League[] }>);

    leagues.forEach(league => {
        if (league.parent_league_id && leagueTree[league.parent_league_id]) {
            leagueTree[league.parent_league_id].children.push(leagueTree[league.id]);
        }
    });

    const rootLeagues = Object.values(leagueTree).filter(league => !league.parent_league_id);

    return (
         <>
            <div className="space-y-8">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4">Importation de Données</h3>
                    <p className="text-sm text-gray-400 mb-6">Importez des données en masse via des fichiers Excel. Téléchargez un modèle pour voir le format requis.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ImportCard 
                            title="Importer des Officiels"
                            templateHeaders={['id', 'name', 'category', 'location', 'address', 'position', 'email', 'phone', 'bankAccountNumber']}
                            templateFileName="modele_officiels.xlsx"
                            onGenerateTemplate={onGenerateTemplate}
                            onFileProcess={(file) => importOfficials(file, officialCategories, locations)}
                            onConfirmImport={onImportOfficials}
                        />
                         <ImportCard 
                            title="Importer des Équipes"
                            templateHeaders={['id', 'name', 'fullName', 'logoUrl', 'primaryColor', 'secondaryColor', 'foundedYear']}
                            templateFileName="modele_equipes.xlsx"
                            onGenerateTemplate={onGenerateTemplate}
                            onFileProcess={importTeams}
                            onConfirmImport={onImportTeams}
                        />
                         <ImportCard 
                            title="Importer des Stades"
                            templateHeaders={['id', 'name', 'location']}
                            templateFileName="modele_stades.xlsx"
                            onGenerateTemplate={onGenerateTemplate}
                            onFileProcess={(file) => importStadiums(file, locations)}
                            onConfirmImport={onImportStadiums}
                        />
                         <ImportCard 
                            title="Importer des Matchs"
                            templateHeaders={['id', 'saison', 'journee', 'groupName', 'date', 'time', 'homeTeamName', 'awayTeamName', 'stadiumName']}
                            templateFileName="modele_matchs.xlsx"
                            onGenerateTemplate={onGenerateTemplate}
                            onFileProcess={(file) => importMatches(file, teams, stadiums, leagues, leagueGroups)}
                            onConfirmImport={onImportMatches}
                        />
                         <ImportCard 
                            title="Importer des Désignations"
                            templateHeaders={['match_id', 'role', 'official_id']}
                            templateFileName="modele_designations.xlsx"
                            onGenerateTemplate={onGenerateTemplate}
                            onFileProcess={(file) => importAssignments(file, props.matches, props.officials, officialRoles)}
                            onConfirmImport={onImportAssignments}
                        />
                    </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">Hiérarchie des Ligues</h3>
                        <button onClick={() => openLeagueModal()} className="flex items-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-3 text-sm rounded-lg transition-colors">
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Ajouter une ligue
                        </button>
                    </div>
                    <div className="space-y-4">
                        {rootLeagues.map(league => (
                            <LeagueNode key={league.id} league={league} allLeagues={leagues} level={0} {...props} />
                        ))}
                    </div>
                </div>
                <NomenclaturesManager {...props} />
            </div>
        </>
    )
};

const LeagueNode: React.FC<InternalSettingsViewProps & { league: League & { children?: League[] }, allLeagues: League[], level: number, openAssignTeamsModal: (group: LeagueGroup) => void }> = ({ league, allLeagues, level, ...props }) => {
    const { leagueGroups, currentSeason, matches, permissions, openLeagueModal, openLeagueGroupModal, openDeletionModal, openAssignTeamsModal } = props;
    
    const groupsForCurrentSeason = leagueGroups.filter(g => g.league_id === league.id && g.season === currentSeason);
    
    const isLeagueInUse = (league.children && league.children.length > 0) || leagueGroups.some(g => g.league_id === league.id && matches.some(m => m.leagueGroup.id === g.id));
    const canDeleteLeague = permissions.can('delete', 'league');

    return (
        <>
            <div className="bg-gray-900/50 rounded-lg p-4" style={{ marginLeft: `${level * 20}px` }}>
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-white">{league.name}</h4>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => openLeagueModal(league)} className="p-1 text-gray-400 hover:text-white"><PencilIcon className="h-4 w-4"/></button>
                        {canDeleteLeague && (
                             <button 
                                onClick={() => openDeletionModal('league', league.id, league.name)}
                                disabled={isLeagueInUse}
                                title={isLeagueInUse ? "Cette ligue a des sous-ligues ou des matchs et ne peut être supprimée." : "Supprimer la ligue"}
                                className="p-1 text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                             >
                                <TrashIcon className="h-4 w-4"/>
                             </button>
                        )}
                        <button onClick={() => openLeagueGroupModal(league)} className="text-xs flex items-center bg-brand-primary/20 text-brand-primary font-semibold py-1 px-2 rounded-md hover:bg-brand-primary/40">
                        <PlusIcon className="h-4 w-4 mr-1"/> Ajouter Groupe
                        </button>
                    </div>
                </div>

                <div className="pl-4 mt-3 border-l-2 border-gray-700 space-y-2">
                    {groupsForCurrentSeason.length > 0 ? groupsForCurrentSeason.map(group => {
                        const isGroupInUse = matches.some(m => m.leagueGroup.id === group.id);
                        const canDeleteGroup = permissions.can('delete', 'league_group');
                        return (
                            <div key={group.id} className="flex justify-between items-center bg-gray-800/60 p-2 rounded-md">
                                <div>
                                <p className="text-sm font-medium text-gray-200">{group.name}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => openAssignTeamsModal(group)} className="text-xs flex items-center bg-gray-700 text-gray-200 font-semibold py-1 px-2 rounded-md hover:bg-gray-600">
                                      <UsersGroupIcon className="h-4 w-4 mr-1"/>Équipes ({group.teamIds.length})
                                    </button>
                                    <button onClick={() => openLeagueGroupModal(league, group)} className="p-1 text-gray-400 hover:text-white"><PencilIcon className="h-4 w-4"/></button>
                                    {canDeleteGroup && (
                                        <button
                                            onClick={() => openDeletionModal('league_group', group.id, group.name)}
                                            disabled={isGroupInUse}
                                            title={isGroupInUse ? "Ce groupe a des matchs et ne peut être supprimé." : "Supprimer le groupe"}
                                            className="p-1 text-red-400 hover:text-red-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                                        >
                                            <TrashIcon className="h-4 w-4"/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    }) : <p className="text-xs text-gray-500 italic px-2">Aucun groupe pour la saison {currentSeason}.</p>}
                </div>

                {league.children && league.children.length > 0 && (
                    <div className="mt-4 space-y-4">
                        {league.children.map(child => (
                            <LeagueNode key={child.id} league={child} allLeagues={allLeagues} level={level + 1} {...props} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};


const NomenclaturesManager: React.FC<InternalSettingsViewProps & { openSeasonModal: () => void }> = ({ seasons, openSeasonModal, officialCategories, setOfficialCategories, officialRoles, setOfficialRoles, officials, matches, openDeletionModal }) => {

    const isSeasonInUse = (season: string) => matches.some(m => m.season === season);
    const isCategoryInUse = (category: string) => officials.some(o => o.category === category && !o.isArchived);
    const isRoleInUse = (role: string) => matches.some(m => !m.isArchived && m.assignments.some(a => a.role === role));
    
    const handleAdd = useCallback((type: 'categories' | 'roles', value: string) => {
        if (type === 'categories') {
            if (value && !officialCategories.includes(value)) setOfficialCategories([...officialCategories, value]);
        } else {
            if (value && !officialRoles.includes(value)) setOfficialRoles([...officialRoles, value]);
        }
    }, [officialCategories, officialRoles, setOfficialCategories, setOfficialRoles]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Nomenclatures Générales</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-white">Saisons</h4>
                        <button onClick={openSeasonModal} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-1 px-3 text-sm rounded-lg transition-colors">
                            Ajouter
                        </button>
                    </div>
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {[...seasons].sort((a,b) => b.localeCompare(a)).map(item => (
                            <li key={item} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-md">
                                <span className="text-white text-sm">{item}</span>
                                <button 
                                    onClick={() => openDeletionModal('season', item, item)}
                                    disabled={isSeasonInUse(item)}
                                    className="text-red-500 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                                    title={isSeasonInUse(item) ? "Cette saison est utilisée et ne peut pas être supprimée." : "Supprimer"}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <NomenclatureListManager title="Catégories d'Officiels" items={officialCategories} onAdd={(v) => handleAdd('categories', v)} onDelete={(v) => openDeletionModal('category', v, v)} isInUse={isCategoryInUse} />
                <NomenclatureListManager title="Rôles des Officiels" items={officialRoles} onAdd={(v) => handleAdd('roles', v)} onDelete={(v) => openDeletionModal('role', v, v)} isInUse={isRoleInUse} />
            </div>
        </div>
    )
}

interface NomenclatureListManagerProps {
    title: string;
    items: string[];
    onAdd: (item: string) => void;
    onDelete: (item: string) => void;
    isInUse: (item: string) => boolean;
}

const NomenclatureListManager: React.FC<NomenclatureListManagerProps> = ({ title, items, onAdd, onDelete, isInUse }) => {
    const [newItem, setNewItem] = useState('');
    
    const handleAdd = () => {
        if (newItem.trim() && !items.some(i => i.toLowerCase() === newItem.trim().toLowerCase())) {
            onAdd(newItem.trim());
            setNewItem('');
        }
    };
    
    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-semibold text-white mb-3">{title}</h4>
            <div className="flex items-center gap-2 mb-3">
                <input
                    type="text"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm"
                    placeholder="Ajouter un nouvel élément..."
                />
                <button type="button" onClick={handleAdd} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold p-2 rounded-lg">
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {[...items].sort((a, b) => a.localeCompare(b)).map(item => (
                    <li key={item} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-md">
                        <span className="text-white text-sm">{item}</span>
                        <button
                            onClick={() => onDelete(item)}
                            disabled={isInUse(item)}
                            className="text-red-500 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                            title={isInUse(item) ? "Cet élément est utilisé et ne peut pas être supprimé." : "Supprimer"}
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const OptimizationSettings: React.FC<InternalSettingsViewProps> = ({ 
    optimizationSettings, setOptimizationSettings, onLaunchOptimization, 
    onImportOptimizedAssignments, onGenerateTemplate, matches, officials, 
    leagues, leagueGroups, currentSeason, officialCategories, locations
}) => {
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);

    if (!optimizationSettings) return null;

    const handleChange = (field: keyof OptimizationSettingsType, value: any) => {
        setOptimizationSettings({ ...optimizationSettings, [field]: value });
    };
    
    const handleMapChange = (map: 'categoryGradeMap' | 'categoryCapacityMap', category: string, value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            setOptimizationSettings({
                ...optimizationSettings,
                [map]: {
                    ...optimizationSettings[map],
                    [category]: numValue
                }
            });
        } else if (value === '') {
            const newMap = { ...optimizationSettings[map] };
            delete newMap[category];
            setOptimizationSettings({ ...optimizationSettings, [map]: newMap });
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Paramètres de l'Optimiseur</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="travelSpeed" className="block text-sm font-medium text-gray-300">Vitesse de déplacement (km/h)</label>
                        <input type="number" id="travelSpeed" value={optimizationSettings.travelSpeedKmph} onChange={e => handleChange('travelSpeedKmph', Number(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="bufferMin" className="block text-sm font-medium text-gray-300">Temps tampon entre matchs (min)</label>
                        <input type="number" id="bufferMin" value={optimizationSettings.bufferMin} onChange={e => handleChange('bufferMin', Number(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="matchDuration" className="block text-sm font-medium text-gray-300">Durée d'un match (min)</label>
                        <input type="number" id="matchDuration" value={optimizationSettings.matchDurationMin} onChange={e => handleChange('matchDurationMin', Number(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="defaultRisk" className="block text-sm font-medium text-gray-300">Risque par défaut d'un match</label>
                        <input type="number" id="defaultRisk" value={optimizationSettings.defaultMatchRisk} onChange={e => handleChange('defaultMatchRisk', Number(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"/>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Paramètres par Catégorie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-lg font-semibold text-white mb-2">Note par Catégorie</h4>
                        <div className="space-y-2">
                            {officialCategories.map(cat => (
                                <div key={cat} className="flex items-center justify-between">
                                    <label className="text-sm text-gray-300">{cat}</label>
                                    <input type="number" value={optimizationSettings.categoryGradeMap[cat] || ''} onChange={e => handleMapChange('categoryGradeMap', cat, e.target.value)} placeholder="-" className="w-24 bg-gray-900 border border-gray-700 rounded-md py-1 px-2 text-white text-right"/>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-lg font-semibold text-white mb-2">Capacité par Catégorie</h4>
                        <div className="space-y-2">
                            {officialCategories.map(cat => (
                                <div key={cat} className="flex items-center justify-between">
                                    <label className="text-sm text-gray-300">{cat}</label>
                                    <input type="number" value={optimizationSettings.categoryCapacityMap[cat] || ''} onChange={e => handleMapChange('categoryCapacityMap', cat, e.target.value)} placeholder="-" className="w-24 bg-gray-900 border border-gray-700 rounded-md py-1 px-2 text-white text-right"/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Actions</h3>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-2">Lancer une Optimisation</h4>
                        <p className="text-sm text-gray-400 mb-4">Lancer l'optimiseur pour assigner les délégués pour une sélection de journées et de groupes.</p>
                        <button onClick={() => setIsOptimizationModalOpen(true)} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
                            Lancer l'Optimiseur
                        </button>
                    </div>
                    <div className="flex-1">
                         <ImportCard 
                            title="Importer Désignations (Délégués)"
                            templateHeaders={['match_id', 'official_id', 'assigned']}
                            templateFileName="modele_optimisation_delegues.csv"
                            onGenerateTemplate={onGenerateTemplate}
                            onFileProcess={(file) => importOptimizedDelegateAssignments(file, matches, officials)}
                            onConfirmImport={onImportOptimizedAssignments}
                            fileType="csv"
                        />
                    </div>
                </div>
            </div>
            
            <OptimizationModal 
                isOpen={isOptimizationModalOpen}
                onClose={() => setIsOptimizationModalOpen(false)}
                onConfirm={onLaunchOptimization}
                leagues={leagues}
                leagueGroups={leagueGroups}
                currentSeason={currentSeason}
            />
        </div>
    );
};

export default SettingsView;
