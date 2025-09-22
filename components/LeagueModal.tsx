import React, { useState, useEffect } from 'react';
import { League } from '../types';
import CloseIcon from './icons/CloseIcon';

interface LeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (league: Partial<League>) => void;
  leagueToEdit?: League | null;
  leagues: League[];
}

const LeagueModal: React.FC<LeagueModalProps> = ({ isOpen, onClose, onSave, leagueToEdit, leagues }) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isEditing = !!leagueToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        setName(leagueToEdit.name);
        setParentId(leagueToEdit.parent_league_id);
      } else {
        setName('');
        setParentId(null);
      }
      setError('');
    }
  }, [isOpen, isEditing, leagueToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom de la ligue est obligatoire.');
      return;
    }
    if (leagues.some(l => l.name.trim().toLowerCase() === name.trim().toLowerCase() && l.id !== leagueToEdit?.id)) {
      setError("Une ligue avec ce nom existe déjà.");
      return;
    }

    const parentLevel = parentId ? leagues.find(l => l.id === parentId)?.level ?? 0 : 0;

    onSave({
      id: leagueToEdit?.id,
      name: name.trim(),
      parent_league_id: parentId,
      level: parentLevel + 1
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Modifier la ligue' : 'Ajouter une ligue'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            <div>
              <label htmlFor="league-name" className="block text-sm font-medium text-gray-300">Nom de la ligue</label>
              <input 
                type="text" 
                id="league-name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" 
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="parent-league" className="block text-sm font-medium text-gray-300">Ligue Parente (Optionnel)</label>
              <select 
                id="parent-league" 
                value={parentId || ''}
                onChange={e => setParentId(e.target.value || null)} 
                className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              >
                  <option value="">Aucune (Ligue principale)</option>
                  {leagues.filter(l => l.id !== leagueToEdit?.id).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
              {isEditing ? 'Sauvegarder' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeagueModal;
