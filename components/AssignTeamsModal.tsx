

import React, { useState, useEffect, useMemo } from 'react';
import { LeagueGroup, Team } from '../types';
import CloseIcon from './icons/CloseIcon';
import SearchIcon from './icons/SearchIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface AssignTeamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (groupId: string, teamIds: string[]) => void;
  leagueGroup: LeagueGroup;
  allTeams: Team[];
  assignedTeamIds: string[];
  leagueGroups: LeagueGroup[];
}

const AssignTeamsModal: React.FC<AssignTeamsModalProps> = ({ isOpen, onClose, onSave, leagueGroup, allTeams, assignedTeamIds, leagueGroups }) => {
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedTeamIds(new Set(assignedTeamIds));
      setSearchTerm(''); // Reset search on open
    }
  }, [isOpen, assignedTeamIds]);
  
  const otherGroupAssignments = useMemo(() => {
    const assignmentsMap = new Map<string, string[]>();
    if (!isOpen) return assignmentsMap;

    const otherGroupsInSeason = leagueGroups.filter(
      (g) => g.season === leagueGroup.season && g.id !== leagueGroup.id
    );

    for (const group of otherGroupsInSeason) {
      for (const teamId of group.teamIds) {
        if (!assignmentsMap.has(teamId)) {
          assignmentsMap.set(teamId, []);
        }
        assignmentsMap.get(teamId)!.push(group.name);
      }
    }

    return assignmentsMap;
  }, [isOpen, leagueGroups, leagueGroup]);

  const handleToggleTeam = (teamId: string) => {
    const newSelection = new Set(selectedTeamIds);
    if (newSelection.has(teamId)) {
      newSelection.delete(teamId);
    } else {
      // Prevent assigning a team that is already assigned to another group in the same season
      if (otherGroupAssignments.has(teamId)) {
        return;
      }
      newSelection.add(teamId);
    }
    setSelectedTeamIds(newSelection);
  };

  const handleSave = () => {
    onSave(leagueGroup.id, Array.from(selectedTeamIds));
    onClose();
  };
  
  const filteredTeams = useMemo(() => {
    const normalize = (str: string | null | undefined): string =>
      (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    
    const searchKeywords = normalize(searchTerm).split(' ').filter(Boolean);

    return allTeams
        .filter(t => !t.isArchived)
        .filter(team => {
            if (searchKeywords.length === 0) return true;
            const searchableText = [normalize(team.name), normalize(team.fullName)].join(' ');
            return searchKeywords.every(keyword => searchableText.includes(keyword));
        })
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTeams, searchTerm]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300 flex flex-col">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-white">Assigner les Équipes</h2>
                <p className="text-sm text-gray-400">Pour {leagueGroup.name} - Saison {leagueGroup.season}</p>
            </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-grow max-h-[60vh]">
            <p className="text-sm text-gray-300">Sélectionnez les équipes qui participeront à ce groupe.</p>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Rechercher par nom court ou complet..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                    aria-label="Rechercher une équipe"
                />
            </div>
            {filteredTeams.length > 0 ? (
                <div className="space-y-2">
                    {filteredTeams.map(team => {
                        const otherAssignments = otherGroupAssignments.get(team.id);
                        const isAssignedElsewhere = otherAssignments && otherAssignments.length > 0;
                        const isCurrentlySelected = selectedTeamIds.has(team.id);
                        // A team cannot be selected if it's already in another group for the same season.
                        // However, if it's already part of the current group (isCurrentlySelected), it should be possible to un-assign it.
                        // So we only disable it if it's assigned elsewhere AND not currently selected in this modal.
                        const isDisabled = isAssignedElsewhere && !isCurrentlySelected;

                        return (
                            <label key={team.id} className={`flex items-center justify-between bg-gray-700/50 p-3 rounded-md transition-colors ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-700'}`}>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        className={`h-5 w-5 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-secondary ${isDisabled ? 'cursor-not-allowed' : ''}`}
                                        checked={isCurrentlySelected}
                                        onChange={() => handleToggleTeam(team.id)}
                                        disabled={isDisabled}
                                    />
                                    <div>
                                        <span className="text-white font-medium text-sm">{team.name}</span>
                                        {team.fullName && <p className="text-xs text-gray-400">{team.fullName}</p>}
                                    </div>
                                </div>
                                {isAssignedElsewhere && (
                                    <div className="relative group flex items-center">
                                        <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                            Déjà assignée à : {otherAssignments.join(', ')}
                                            <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                                                <polygon className="fill-current" points="0,0 127.5,127.5 255,0"/>
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </label>
                        )
                    })}
                </div>
            ) : (
                 <p className="text-center text-gray-400 py-4">Aucune équipe ne correspond à votre recherche.</p>
            )}
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-between items-center">
            <span className="text-sm font-medium text-gray-300">{selectedTeamIds.size} équipe(s) sélectionnée(s)</span>
            <div>
                <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
                <button type="button" onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
                    Sauvegarder
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTeamsModal;