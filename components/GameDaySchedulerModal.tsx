import React, { useState, useEffect } from 'react';
import { Match, LeagueGroup } from '../types';
import CloseIcon from './icons/CloseIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import DatePicker from './DatePicker';
import ClockIcon from './icons/ClockIcon';

interface GameDaySchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leagueGroupId: string, gameDay: number, date: string, time: string) => void;
  context: {
    leagueGroup: LeagueGroup;
    gameDay: number;
    matches: Match[];
  } | null;
}

const GameDaySchedulerModal: React.FC<GameDaySchedulerModalProps> = ({ isOpen, onClose, onSave, context }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && context) {
      // Find if there's a common date/time already, otherwise leave blank
      const firstMatchWithDate = context.matches.find(m => m.matchDate);
      setDate(firstMatchWithDate?.matchDate || '');
      setTime(firstMatchWithDate?.matchTime || '');
      setError('');
    }
  }, [isOpen, context]);

  if (!isOpen || !context) return null;

  const { leagueGroup, gameDay, matches } = context;

  const handleSubmit = () => {
    if (!date) {
      setError('Veuillez sélectionner une date.');
      return;
    }
    setError('');
    onSave(leagueGroup.id, gameDay, date, time);
    onClose();
  };

  const hasExistingDates = matches.some(m => m.matchDate || m.matchTime);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Planifier la Journée {gameDay}</h2>
            <p className="text-sm text-gray-400">{leagueGroup.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6"/>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-gray-300">
            Définissez une date et une heure communes pour tous les matchs de cette journée.
            Les dates et heures individuelles des matchs peuvent toujours être modifiées par la suite.
          </p>
          {hasExistingDates && (
            <div className="flex items-start bg-yellow-900/50 text-yellow-300 p-3 rounded-md text-sm">
              <AlertTriangleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>Attention : Cette action écrasera les dates et heures déjà définies pour les matchs de cette journée.</span>
            </div>
          )}
          {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gameday-date" className="block text-sm font-medium text-gray-300">Date</label>
              <DatePicker id="gameday-date" value={date} onChange={setDate} />
            </div>
            <div>
              <label htmlFor="gameday-time" className="block text-sm font-medium text-gray-300">Heure (Optionnel)</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input type="time" id="gameday-time" value={time} onChange={e => setTime(e.target.value)} className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-md font-semibold text-gray-200 mb-2">Matchs concernés ({matches.length}) :</h4>
            <ul className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-md max-h-40 overflow-y-auto space-y-1">
              {matches.map(match => (
                <li key={match.id}>{match.homeTeam.name} vs {match.awayTeam.name}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
            Appliquer à la journée
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameDaySchedulerModal;