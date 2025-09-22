import React, { useState, useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';

interface DivisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (divisionName: string) => void;
  existingDivisions: string[];
}

const DivisionModal: React.FC<DivisionModalProps> = ({ isOpen, onClose, onSave, existingDivisions }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom de la division est obligatoire.');
      return;
    }
    if (existingDivisions.some(d => d.trim().toLowerCase() === name.trim().toLowerCase())) {
        setError("Une division avec ce nom existe déjà.");
        return;
    }
    onSave(name.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            Ajouter une division
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            <div>
              <label htmlFor="division-name" className="block text-sm font-medium text-gray-300">Nom de la division</label>
              <input 
                type="text" 
                id="division-name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" 
                autoFocus
              />
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

export default DivisionModal;
