import React, { useState, useEffect } from 'react';
import { Official, Unavailability } from '../types';
import CloseIcon from './icons/CloseIcon';
import TrashIcon from './icons/TrashIcon';
import DatePicker from './DatePicker';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  official: Official | null;
  onSave: (officialId: string, unavailabilities: Unavailability[]) => void;
}

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ isOpen, onClose, official, onSave }) => {
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && official) {
      setUnavailabilities(official.unavailabilities);
      setError('');
      setStartDate('');
      setEndDate('');
      setReason('');
    }
  }, [isOpen, official]);

  const handleAdd = () => {
    if (!startDate || !endDate) {
      setError('Les dates de début et de fin sont requises.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('La date de début ne peut pas être après la date de fin.');
      return;
    }
    setError('');

    const newUnavailability: Unavailability = {
      id: crypto.randomUUID(),
      startDate,
      endDate,
      reason,
      isApproved: false, // Default to not approved
    };
    setUnavailabilities([...unavailabilities, newUnavailability]);
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleDelete = (id: string) => {
    setUnavailabilities(unavailabilities.filter(u => u.id !== id));
  };
  
  const handleSave = () => {
    if (official) {
        onSave(official.id, unavailabilities);
        onClose();
    }
  }

  if (!isOpen || !official) return null;
  
  const sortedUnavailabilities = [...unavailabilities].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Gérer les Indisponibilités</h2>
            <p className="text-sm text-gray-400">Pour {official.fullName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Form to add unavailability */}
          <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-lg text-white">Ajouter une période</h3>
            {error && <p className="text-red-400 bg-red-900/50 p-2 rounded-md text-sm">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-300">Date de début</label>
                <DatePicker id="start-date" value={startDate} onChange={setStartDate} />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-300">Date de fin</label>
                <DatePicker id="end-date" value={endDate} onChange={setEndDate} />
              </div>
            </div>
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-300">Raison (optionnel)</label>
              <input type="text" id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Vacances, Blessure..." className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
            </div>
            <div className="text-right">
                <button onClick={handleAdd} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
                    Ajouter
                </button>
            </div>
          </div>

          {/* List of unavailabilities */}
          <div>
            <h3 className="font-semibold text-lg text-white mb-2">Périodes enregistrées</h3>
            {sortedUnavailabilities.length > 0 ? (
                <ul className="space-y-2">
                    {sortedUnavailabilities.map(u => (
                        <li key={u.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                            <div>
                                <p className="font-medium text-white">
                                    Du {new Date(u.startDate).toLocaleDateString('fr-FR')} au {new Date(u.endDate).toLocaleDateString('fr-FR')}
                                </p>
                                {u.reason && <p className="text-sm text-gray-400">{u.reason}</p>}
                            </div>
                            <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-400 p-1">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-400 text-center py-4">Aucune période d'indisponibilité enregistrée.</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
          <button type="button" onClick={handleSave} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
            Sauvegarder les modifications
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityModal;