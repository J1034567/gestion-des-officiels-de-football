import React, { useState, useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';

interface SeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (seasonName: string) => void;
  existingSeasons: string[];
}

const SeasonModal: React.FC<SeasonModalProps> = ({ isOpen, onClose, onSave, existingSeasons }) => {
  const [startYear, setStartYear] = useState<string>(String(new Date().getFullYear()));
  const [error, setError] = useState('');

  const seasonName = startYear && /^\d{4}$/.test(startYear) ? `${startYear}-${Number(startYear) + 1}` : '';
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (isOpen) {
      setStartYear(String(new Date().getFullYear()));
      setError('');
    }
  }, [isOpen]);

  const validateYear = (year: string) => {
    const yearNum = Number(year);
    if (!/^\d{4}$/.test(year)) {
      setError('L\'année doit être un nombre à 4 chiffres.');
      return false;
    }
    if (yearNum < 2000 || yearNum > currentYear + 5) {
      setError(`L'année doit être comprise entre 2000 et ${currentYear + 5}.`);
      return false;
    }
    if (existingSeasons.includes(`${year}-${yearNum + 1}`)) {
      setError('Cette saison existe déjà.');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateYear(startYear)) {
      return;
    }
    onSave(seasonName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            Ajouter une saison
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            <div>
              <label htmlFor="start-year" className="block text-sm font-medium text-gray-300">Année de début de saison</label>
              <input 
                type="number" 
                id="start-year" 
                value={startYear} 
                onChange={e => {
                    setStartYear(e.target.value);
                    setError('');
                }}
                className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" 
                placeholder="Ex: 2024"
                autoFocus
              />
              {seasonName && (
                <p className="mt-2 text-sm text-gray-400">
                  La saison sera créée sous le nom : <span className="font-semibold text-white">{seasonName}</span>
                </p>
              )}
            </div>
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SeasonModal;
