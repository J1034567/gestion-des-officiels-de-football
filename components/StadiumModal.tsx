

import React, { useState, useEffect, useMemo } from 'react';
import { Stadium, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import SearchableSelect from './SearchableSelect';

interface StadiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stadium: Stadium) => void;
  stadiumToEdit?: Stadium | null;
  localisations: Location[];
  stadiums: Stadium[];
}

const StadiumModal: React.FC<StadiumModalProps> = ({ isOpen, onClose, onSave, stadiumToEdit, localisations, stadiums }) => {
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isEditing = !!stadiumToEdit;
  
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
      if (isEditing) {
        setName(stadiumToEdit.name);
        setNameAr(stadiumToEdit.nameAr || '');
        setLocationId(stadiumToEdit.locationId);
      } else {
        setName('');
        setNameAr('');
        setLocationId(null);
      }
      setError('');
    }
  }, [isOpen, isEditing, stadiumToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du stade est obligatoire.');
      return;
    }

    if (!locationId) {
      setError('La localisation est obligatoire.');
      return;
    }

    if (stadiums.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase() && s.id !== stadiumToEdit?.id)) {
        setError("Un stade avec ce nom existe déjà.");
        return;
    }

    setError('');
    
    onSave({
      ...(isEditing && stadiumToEdit ? stadiumToEdit : {}),
      id: isEditing ? stadiumToEdit!.id : crypto.randomUUID(),
      name,
      nameAr: nameAr.trim() || null,
      locationId: locationId,
      isArchived: isEditing ? stadiumToEdit!.isArchived : false,
    } as Stadium);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? "Modifier le stade" : 'Ajouter un stade'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="stadium-name" className="block text-sm font-medium text-gray-300">Nom du stade <span className="text-red-400">*</span></label>
                  <input type="text" id="stadium-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                </div>
                <div>
                  <label htmlFor="stadium-name-ar" className="block text-sm font-medium text-gray-300 text-right" dir="rtl">اسم الملعب (Nom en Arabe)</label>
                  <input type="text" id="stadium-name-ar" value={nameAr} onChange={e => setNameAr(e.target.value)} dir="rtl" className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm text-right" />
                </div>
            </div>
            <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-300">Localisation <span className="text-red-400">*</span></label>
                <div className="mt-1">
                    <SearchableSelect
                        options={locationOptions}
                        value={locationId}
                        onChange={setLocationId}
                        placeholder="Rechercher une localisation..."
                    />
                </div>
            </div>
             {isEditing && stadiumToEdit.createdAt && (
                <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 space-y-1">
                    <p>Créé le: {new Date(stadiumToEdit.createdAt).toLocaleString('fr-FR')} par {stadiumToEdit.createdByName}</p>
                    {stadiumToEdit.updatedAt && stadiumToEdit.updatedByName && (
                        <p>Dernière modification: {new Date(stadiumToEdit.updatedAt).toLocaleString('fr-FR')} par {stadiumToEdit.updatedByName}</p>
                    )}
                </div>
            )}
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

export default StadiumModal;