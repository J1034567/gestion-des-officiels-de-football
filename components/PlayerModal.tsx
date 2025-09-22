
import React, { useState, useEffect, useCallback } from 'react';
import { Player, Team } from '../types';
import CloseIcon from './icons/CloseIcon';
import DatePicker from './DatePicker';
import SearchableSelect from './SearchableSelect';
import UserIcon from './icons/UserIcon';
import IdentificationIcon from './icons/IdentificationIcon';
import CalendarIcon from './icons/CalendarIcon';
import UsersIcon from './icons/UsersIcon';

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Partial<Player>) => void;
  playerToEdit: Player | null;
  teams: Team[];
  players: Player[];
  teamContextId?: string | null;
}

const initialFormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  licenseNumber: '',
  currentTeamId: '',
};

// This is a pure function for validation, making it predictable and easier to test.
const validate = (formData: typeof initialFormData, players: Player[], playerToEdit: Player | null): Partial<typeof initialFormData> => {
    const newErrors: Partial<typeof initialFormData> = {};
    const { firstName, lastName, dateOfBirth, licenseNumber } = formData;

    // Required fields
    if (!firstName.trim()) newErrors.firstName = "Le prénom est requis.";
    if (!lastName.trim()) newErrors.lastName = "Le nom est requis.";

    const fNameLower = firstName.trim().toLowerCase();
    const lNameLower = lastName.trim().toLowerCase();
    const licenseTrimmed = licenseNumber.trim();

    // License Number uniqueness
    if (!licenseTrimmed) {
        newErrors.licenseNumber = "Le numéro de licence est requis.";
    } else if (players.some(p => (p.licenseNumber || '').trim().toLowerCase() === licenseTrimmed.toLowerCase() && p.id !== playerToEdit?.id)) {
        newErrors.licenseNumber = "Ce numéro de licence est déjà utilisé.";
    }

    // Name + DOB uniqueness
    if (fNameLower && lNameLower && dateOfBirth) {
        if (players.some(p =>
            p.id !== playerToEdit?.id &&
            p.dateOfBirth === dateOfBirth &&
            (
                (p.firstName.trim().toLowerCase() === fNameLower && p.lastName.trim().toLowerCase() === lNameLower) ||
                (p.firstName.trim().toLowerCase() === lNameLower && p.lastName.trim().toLowerCase() === fNameLower)
            )
        )) {
            newErrors.dateOfBirth = "Un joueur avec ce nom et cette date de naissance existe déjà.";
        }
    }
    
    return newErrors;
};


const PlayerModal: React.FC<PlayerModalProps> = ({ isOpen, onClose, onSave, playerToEdit, teams, players, teamContextId }) => {
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Partial<typeof formData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!playerToEdit;

  useEffect(() => {
    if (isOpen) {
      if (playerToEdit) {
        setFormData({
          firstName: playerToEdit.firstName,
          lastName: playerToEdit.lastName,
          dateOfBirth: playerToEdit.dateOfBirth || '',
          licenseNumber: playerToEdit.licenseNumber || '',
          currentTeamId: playerToEdit.currentTeamId || '',
        });
      } else {
        setFormData({
          ...initialFormData,
          currentTeamId: teamContextId || '',
        });
      }
      setErrors({});
      setIsSaving(false);
    }
  }, [isOpen, playerToEdit, teamContextId]);

  // Real-time validation effect
  useEffect(() => {
      if (isOpen) {
          const validationErrors = validate(formData, players, playerToEdit);
          setErrors(validationErrors);
      }
  }, [formData, players, playerToEdit, isOpen]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, dateOfBirth: date }));
  }
  
  const handleTeamChange = (teamId: string | null) => {
    setFormData(prev => ({ ...prev, currentTeamId: teamId || '' }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Run validation one last time on submit to be sure.
    const validationErrors = validate(formData, players, playerToEdit);
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
        return;
    }

    setIsSaving(true);
    await onSave({
      id: playerToEdit?.id,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      dateOfBirth: formData.dateOfBirth || null,
      licenseNumber: formData.licenseNumber.trim(),
      currentTeamId: formData.currentTeamId || null,
      isArchived: playerToEdit?.isArchived || false,
    });
  };

  if (!isOpen) return null;
  
  const teamOptions = teams
    .filter(t => !t.isArchived)
    .sort((a,b) => a.name.localeCompare(b.name))
    .map(team => ({ value: team.id, label: team.name }));

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{isEditing ? 'Modifier le Joueur' : 'Ajouter un Joueur'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">Prénom <span className="text-red-400">*</span></label>
                 <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-gray-400" /></div>
                    <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleInputChange} required className={`pl-10 block w-full bg-gray-900 border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-1 sm:text-sm ${errors.firstName ? 'border-red-500 ring-red-500' : 'border-gray-700 focus:ring-brand-primary focus:border-brand-primary'}`} />
                 </div>
                 {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">Nom <span className="text-red-400">*</span></label>
                 <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-gray-400" /></div>
                    <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleInputChange} required className={`pl-10 block w-full bg-gray-900 border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-1 sm:text-sm ${errors.lastName ? 'border-red-500 ring-red-500' : 'border-gray-700 focus:ring-brand-primary focus:border-brand-primary'}`} />
                 </div>
                 {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>}
              </div>
            </div>
             <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-300">Date de Naissance</label>
                <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><CalendarIcon className="h-5 w-5 text-gray-400" /></div>
                     <div className={`pl-10 ${errors.dateOfBirth ? 'ring-1 ring-red-500 rounded-md' : ''}`}>
                        <DatePicker id="dob" value={formData.dateOfBirth} onChange={handleDateChange} />
                     </div>
                </div>
                 {errors.dateOfBirth && <p className="mt-1 text-xs text-red-400">{errors.dateOfBirth}</p>}
            </div>
             <div>
                <label htmlFor="licenseNumber" className="block text-sm font-medium text-gray-300">N° de Licence <span className="text-red-400">*</span></label>
                <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IdentificationIcon className="h-5 w-5 text-gray-400" /></div>
                    <input type="text" name="licenseNumber" id="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} required className={`pl-10 block w-full bg-gray-900 border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-1 sm:text-sm ${errors.licenseNumber ? 'border-red-500 ring-red-500' : 'border-gray-700 focus:ring-brand-primary focus:border-brand-primary'}`} />
                </div>
                 {errors.licenseNumber && <p className="mt-1 text-xs text-red-400">{errors.licenseNumber}</p>}
            </div>
             <div>
                <label htmlFor="team" className="block text-sm font-medium text-gray-300">Équipe Actuelle</label>
                <div className="relative mt-1">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10"><UsersIcon className="h-5 w-5 text-gray-400" /></div>
                     <div className="pl-10">
                        <SearchableSelect
                            options={teamOptions}
                            value={formData.currentTeamId}
                            onChange={handleTeamChange}
                            placeholder="Sélectionner une équipe..."
                            disabled={!isEditing && !!teamContextId}
                        />
                     </div>
                </div>
            </div>
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button type="submit" disabled={hasErrors || isSaving} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center">
              {isSaving && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isSaving ? 'Sauvegarde...' : isEditing ? 'Sauvegarder' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerModal;
