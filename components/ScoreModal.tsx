
import React, { useState, useEffect } from 'react';
import { Match } from '../types';
import CloseIcon from './icons/CloseIcon';

interface ScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchId: string, homeScore: number, awayScore: number) => void;
  match: Match | null;
}

const ScoreModal: React.FC<ScoreModalProps> = ({ isOpen, onClose, onSave, match }) => {
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && match) {
      setHomeScore(match.homeScore?.toString() || '');
      setAwayScore(match.awayScore?.toString() || '');
      setError('');
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const handleSave = () => {
    const home = parseInt(homeScore, 10);
    const away = parseInt(awayScore, 10);

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setError('Veuillez entrer des scores valides (nombres positifs).');
      return;
    }
    
    setError('');
    onSave(match.id, home, away);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Saisir le score</h2>
            <p className="text-sm text-gray-400">{match.homeTeam.name} vs {match.awayTeam.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
          <div className="flex items-center justify-center space-x-4">
            <div className="text-center">
              <label htmlFor="homeScore" className="block text-sm font-medium text-gray-300 mb-1">{match.homeTeam.name}</label>
              <input
                id="homeScore"
                type="number"
                min="0"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-24 text-center text-2xl font-bold bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                autoFocus
              />
            </div>
            <span className="text-2xl text-gray-400 mt-6">-</span>
            <div className="text-center">
              <label htmlFor="awayScore" className="block text-sm font-medium text-gray-300 mb-1">{match.awayTeam.name}</label>
              <input
                id="awayScore"
                type="number"
                min="0"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-24 text-center text-2xl font-bold bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">
            Annuler
          </button>
          <button type="button" onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
            Enregistrer et Marquer comme Joué
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreModal;