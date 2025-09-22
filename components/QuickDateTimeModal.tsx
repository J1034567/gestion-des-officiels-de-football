
import React, { useState, useEffect } from 'react';
import { Match } from '../types';
import CloseIcon from './icons/CloseIcon';
import DatePicker from './DatePicker';
import ClockIcon from './icons/ClockIcon';

interface QuickDateTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchId: string, date: string, time: string) => void;
  match: Match | null;
}

const QuickDateTimeModal: React.FC<QuickDateTimeModalProps> = ({ isOpen, onClose, onSave, match }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && match) {
      setDate(match.matchDate || '');
      setTime(match.matchTime || '');
      setError('');
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const handleSave = () => {
    if (!date) {
      setError('La date est obligatoire.');
      return;
    }
    setError('');
    onSave(match.id, date, time);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Modifier Date & Heure</h2>
            <p className="text-sm text-gray-400">{match.homeTeam.name} vs {match.awayTeam.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quick-date" className="block text-sm font-medium text-gray-300">Date</label>
              <DatePicker id="quick-date" value={date} onChange={setDate} />
            </div>
            <div>
              <label htmlFor="quick-time" className="block text-sm font-medium text-gray-300">Heure</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ClockIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="time"
                  id="quick-time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">
            Annuler
          </button>
          <button type="button" onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickDateTimeModal;
