
import React, { useState, useEffect, useMemo } from 'react';
import { Official, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import SearchableSelect from './SearchableSelect';

interface BulkLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (officialIds: string[], newLocationId: string) => void;
  officialsToUpdate: Official[];
  localisations: Location[];
}

const BulkLocationModal: React.FC<BulkLocationModalProps> = ({ isOpen, onClose, onSave, officialsToUpdate, localisations }) => {
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const locationOptions = useMemo(() => localisations.map(loc => {
    const arabicLabel = (loc.wilaya_ar && loc.commune_ar) ? `${loc.wilaya_ar} - ${loc.commune_ar}` : null;
    const frenchLabel = [loc.wilaya, loc.daira, loc.commune].filter(Boolean).join(' / ');
    
    let displayLabel = '';
    if (arabicLabel && frenchLabel) {
        displayLabel = `${arabicLabel} (${frenchLabel})`;
    } else {
        displayLabel = arabicLabel || frenchLabel || 'Localisation Inconnue';
    }

    return {
        value: loc.id,
        label: displayLabel
    }
  }).sort((a,b) => a.label.localeCompare(b.label)), [localisations]);

  useEffect(() => {
    if (isOpen) {
      // Reset form on open
      setLocationId(null);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      setError('Veuillez sélectionner une localisation.');
      return;
    }
    setError('');

    const officialIds = officialsToUpdate.map(o => o.id);
    onSave(officialIds, locationId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Modifier la Localisation en Masse</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh]">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            <p className="text-sm text-gray-300">
              Vous allez modifier la localisation pour <strong className="text-white">{officialsToUpdate.length} officiel(s)</strong>.
              La nouvelle localisation sélectionnée ci-dessous écrasera leur localisation actuelle.
            </p>
             <div>
                <label htmlFor="location-bulk" className="block text-sm font-medium text-gray-300">Nouvelle Localisation <span className="text-red-400">*</span></label>
                 <div className="mt-1">
                    <SearchableSelect
                        options={locationOptions}
                        value={locationId}
                        onChange={setLocationId}
                        placeholder="Rechercher une localisation..."
                    />
                 </div>
            </div>
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
              Appliquer la Modification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkLocationModal;