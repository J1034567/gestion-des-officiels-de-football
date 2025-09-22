import React, { useState, useMemo } from 'react';
import { League, LeagueGroup } from '../types';
import CloseIcon from './icons/CloseIcon';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: { leagueGroupIds: string[]; gameDays: number[] }) => void;
  leagues: League[];
  leagueGroups: LeagueGroup[];
  currentSeason: string;
}

const OptimizationModal: React.FC<OptimizationModalProps> = ({ isOpen, onClose, onConfirm, leagues, leagueGroups, currentSeason }) => {
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedGameDays, setSelectedGameDays] = useState<Set<number>>(new Set());

  const seasonalGroups = useMemo(() => leagueGroups.filter(lg => lg.season === currentSeason), [leagueGroups, currentSeason]);
  
  const allGameDays = useMemo(() => {
    // This is a placeholder; a real app would get this from match data.
    // Let's assume game days 1 through 30 for selection purposes.
    return Array.from({ length: 30 }, (_, i) => i + 1);
  }, []);

  if (!isOpen) return null;
  
  const handleToggleGroup = (groupId: string) => {
    const newSelection = new Set(selectedGroupIds);
    if (newSelection.has(groupId)) {
        newSelection.delete(groupId);
    } else {
        newSelection.add(groupId);
    }
    setSelectedGroupIds(newSelection);
  };
  
  const handleToggleGameDay = (day: number) => {
    const newSelection = new Set(selectedGameDays);
    if (newSelection.has(day)) {
        newSelection.delete(day);
    } else {
        newSelection.add(day);
    }
    setSelectedGameDays(newSelection);
  };

  const handleConfirmClick = () => {
    onConfirm({
        leagueGroupIds: Array.from(selectedGroupIds),
        gameDays: Array.from(selectedGameDays),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300 flex flex-col">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Lancer une Optimisation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6" /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-grow max-h-[60vh]">
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-3">1. Sélectionner les Groupes</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto bg-gray-900/50 p-3 rounded-md">
              {leagues.map(league => (
                <div key={league.id}>
                  <h4 className="font-bold text-brand-primary text-sm mb-1">{league.name}</h4>
                  {seasonalGroups.filter(lg => lg.league_id === league.id).map(group => (
                    <label key={group.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
                      <input type="checkbox"
                        checked={selectedGroupIds.has(group.id)}
                        onChange={() => handleToggleGroup(group.id)}
                        className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-secondary"
                      />
                      <span className="text-white text-sm">{group.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-3">2. Sélectionner les Journées</h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 bg-gray-900/50 p-3 rounded-md">
              {allGameDays.map(day => (
                 <label key={day} className={`flex items-center justify-center p-2 rounded-md h-10 w-10 text-sm font-mono transition-colors cursor-pointer ${selectedGameDays.has(day) ? 'bg-brand-primary text-white font-bold' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}>
                    <input type="checkbox"
                        checked={selectedGameDays.has(day)}
                        onChange={() => handleToggleGameDay(day)}
                        className="sr-only"
                    />
                    {day}
                 </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button
                type="button"
                onClick={handleConfirmClick}
                disabled={selectedGroupIds.size === 0 || selectedGameDays.size === 0}
                className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Générer les Fichiers
            </button>
        </div>
      </div>
    </div>
  );
};

export default OptimizationModal;
