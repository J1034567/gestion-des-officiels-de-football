
import React, { useState, useEffect, useMemo } from 'react';
import { Official, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import { Permissions } from '../hooks/usePermissions';
import EyeIcon from './icons/EyeIcon';
import EyeSlashIcon from './icons/EyeSlashIcon';
import PencilIcon from './icons/PencilIcon';
import SearchableSelect from './SearchableSelect';

interface OfficialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (official: Official) => Promise<void>;
  officialToEdit?: Official | null;
  officialCategories: string[];
  localisations: Location[];
  officials: Official[];
  permissions: Permissions;
  logAction: (action: string, details?: {tableName?: string, recordId?: string | null}) => Promise<void>;
}

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors focus:outline-none ${
      isActive
        ? 'border-b-2 border-brand-primary text-brand-primary'
        : 'text-gray-400 hover:text-white hover:border-gray-500 border-b-2 border-transparent'
    }`}
  >
    {label}
  </button>
);


const OfficialModal: React.FC<OfficialModalProps> = ({ isOpen, onClose, onSave, officialToEdit, officialCategories, localisations, officials, permissions, logAction }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'contact' | 'financial' | 'meta'>('info');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameAr, setFirstNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [category, setCategory] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState<number | ''>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [error, setError] = useState('');
  
  const [isBankAccountVisible, setIsBankAccountVisible] = useState(false);
  const [isBankAccountEditing, setIsBankAccountEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const canManageFinancials = useMemo(() => permissions.can('manage', 'official_financials'), [permissions]);

  const isEditing = !!officialToEdit;

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
      setActiveTab('info');
      if (isEditing) {
        setFirstName(officialToEdit.firstName);
        setLastName(officialToEdit.lastName);
        setFirstNameAr(officialToEdit.firstNameAr || '');
        setLastNameAr(officialToEdit.lastNameAr || '');
        setCategory(officialToEdit.category);
        setLocationId(officialToEdit.locationId);
        setAddress(officialToEdit.address || '');
        setPosition(officialToEdit.position ?? '');
        setEmail(officialToEdit.email || '');
        setPhone(officialToEdit.phone || '');
        setBankAccountNumber(officialToEdit.bankAccountNumber || '');
      } else {
        setFirstName('');
        setLastName('');
        setFirstNameAr('');
        setLastNameAr('');
        setCategory(officialCategories[0] || '');
        setLocationId(null);
        setAddress('');
        setPosition('');
        setEmail('');
        setPhone('');
        setBankAccountNumber('');
      }
      setError('');
      setIsBankAccountVisible(false);
      setIsBankAccountEditing(false);
      setIsSaving(false);
    }
  }, [isOpen, isEditing, officialToEdit, officialCategories]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!firstName || !lastName || !category) {
      setError('Le prénom, le nom et la catégorie sont obligatoires.');
      setActiveTab('info');
      return;
    }

    if (!locationId) {
      setError('La localisation est obligatoire.');
      setActiveTab('contact');
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !validateEmail(trimmedEmail)) {
        setError('Veuillez entrer une adresse e-mail valide.');
        setActiveTab('contact');
        return;
    }

    if (trimmedEmail) {
      const lowercasedEmail = trimmedEmail.toLowerCase();
      if (officials.some(o => o.email?.trim().toLowerCase() === lowercasedEmail && o.id !== officialToEdit?.id)) {
        setError('Un officiel avec cette adresse e-mail existe déjà.');
        setActiveTab('contact');
        return;
      }
    }
    
    const normalize = (str: string | null | undefined) => (str || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const normalizedFirstName = normalize(firstName);
    const normalizedLastName = normalize(lastName);
    const normalizedFirstNameAr = normalize(firstNameAr);
    const normalizedLastNameAr = normalize(lastNameAr);

    // A name pair is considered non-empty if both parts are non-empty
    const hasWesternPair = normalizedFirstName && normalizedLastName;
    const hasArabicPair = normalizedFirstNameAr && normalizedLastNameAr;

    // Check for duplicates
    const isDuplicate = officials.some(o => {
      // Skip self when editing
      if (isEditing && o.id === officialToEdit.id) return false;

      const existingNormalizedFirstName = normalize(o.firstName);
      const existingNormalizedLastName = normalize(o.lastName);
      const existingNormalizedFirstNameAr = normalize(o.firstNameAr);
      const existingNormalizedLastNameAr = normalize(o.lastNameAr);

      // Check if the new western name pair matches an existing western name pair
      if (hasWesternPair && existingNormalizedFirstName === normalizedFirstName && existingNormalizedLastName === normalizedLastName) {
          return true;
      }

      // Check if the new western name pair matches an existing arabic name pair
      if (hasWesternPair && existingNormalizedFirstNameAr === normalizedFirstName && existingNormalizedLastNameAr === normalizedLastName) {
          return true;
      }

      // Check if the new arabic name pair matches an existing western name pair
      if (hasArabicPair && existingNormalizedFirstName === normalizedFirstNameAr && existingNormalizedLastName === normalizedLastNameAr) {
          return true;
      }

      // Check if the new arabic name pair matches an existing arabic name pair
      if (hasArabicPair && existingNormalizedFirstNameAr === normalizedFirstNameAr && existingNormalizedLastNameAr === normalizedLastNameAr) {
          return true;
      }

      return false;
    });

    if (isDuplicate) {
      setError("Un officiel avec cette combinaison de prénom et nom (en français ou en arabe) existe déjà.");
      setActiveTab('info');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    
    setError('');
    setIsSaving(true);
    try {
        await onSave({
          ...(isEditing && officialToEdit ? officialToEdit : {}),
          id: isEditing ? officialToEdit!.id : crypto.randomUUID(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          firstNameAr: firstNameAr.trim() || null,
          lastNameAr: lastNameAr.trim() || null,
          fullName,
          category,
          locationId: locationId,
          address: address.trim() || null,
          position: position === '' ? null : Number(position),
          email: trimmedEmail || null,
          phone: phone.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          unavailabilities: isEditing ? officialToEdit!.unavailabilities : [],
          isArchived: isEditing ? officialToEdit!.isArchived : false,
          isActive: isEditing ? officialToEdit!.isActive : true,
        } as Official);
        onClose();
    } catch (e) {
        console.error("Failed to save official:", e);
        setError("Une erreur est survenue lors de la sauvegarde.");
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleToggleBankAccountVisibility = async () => {
    if (!isBankAccountVisible && officialToEdit) {
        await logAction(`Viewed bank account number for ${officialToEdit.fullName}`, { recordId: officialToEdit.id, tableName: 'officials' });
    }
    setIsBankAccountVisible(!isBankAccountVisible);
  };

  const handleEditBankAccount = () => {
    setIsBankAccountEditing(true);
    setIsBankAccountVisible(true);
  };

  const maskBankAccount = (number: string | null): string => {
    if (!number || number.length < 4) return '••••';
    const visiblePart = number.slice(-4);
    return `•••• •••• •••• ${visiblePart}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Modifier l\'officiel' : 'Ajouter un officiel'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-2 px-6" aria-label="Tabs">
              <TabButton label="Informations" isActive={activeTab === 'info'} onClick={() => setActiveTab('info')} />
              <TabButton label="Contact & Localisation" isActive={activeTab === 'contact'} onClick={() => setActiveTab('contact')} />
              <TabButton label="Données Financières" isActive={activeTab === 'financial'} onClick={() => setActiveTab('financial')} />
              {isEditing && officialToEdit.createdAt && (
                <TabButton label="Métadonnées" isActive={activeTab === 'meta'} onClick={() => setActiveTab('meta')} />
              )}
            </nav>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            
            {activeTab === 'info' && (
              <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">Prénom <span className="text-red-400">*</span></label>
                      <input type="text" id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">Nom <span className="text-red-400">*</span></label>
                      <input type="text" id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstNameAr" className="block text-sm font-medium text-gray-300 text-right" dir="rtl">الاسم الأول (Prénom Arabe)</label>
                      <input type="text" id="firstNameAr" value={firstNameAr} onChange={e => setFirstNameAr(e.target.value)} dir="rtl" className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm text-right" />
                    </div>
                    <div>
                      <label htmlFor="lastNameAr" className="block text-sm font-medium text-gray-300 text-right" dir="rtl">اللقب (Nom Arabe)</label>
                      <input type="text" id="lastNameAr" value={lastNameAr} onChange={e => setLastNameAr(e.target.value)} dir="rtl" className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm text-right" />
                    </div>
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-300">Catégorie <span className="text-red-400">*</span></label>
                    <select id="category" value={category} onChange={e => setCategory(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm">
                        <option value="" disabled>Sélectionner une catégorie</option>
                        {officialCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                    </select>
                </div>
                <div>
                    <label htmlFor="position" className="block text-sm font-medium text-gray-300">Position</label>
                    <input type="number" id="position" value={position} onChange={e => setPosition(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-4">
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
                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-300">Adresse</label>
                    <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-300">Téléphone</label>
                        <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'financial' && (
               <div>
                  <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-300 mb-1">N° CCP / RIP</label>
                  <div className="relative flex items-center gap-2">
                    {isBankAccountEditing ? (
                       <input 
                         type="text" 
                         id="bankAccountNumber" 
                         value={bankAccountNumber} 
                         onChange={e => setBankAccountNumber(e.target.value)} 
                         className="flex-grow bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" 
                         autoFocus
                       />
                    ) : (
                       <div className="flex-grow bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white h-10 flex items-center font-mono">
                           {isBankAccountVisible ? (bankAccountNumber || <span className="italic text-gray-500">Non défini</span>) : maskBankAccount(bankAccountNumber)}
                       </div>
                    )}
                    
                    {canManageFinancials && !isBankAccountEditing && (
                        <>
                            <button type="button" onClick={handleToggleBankAccountVisibility} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors" title={isBankAccountVisible ? "Cacher" : "Afficher"}>
                                {isBankAccountVisible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                            <button type="button" onClick={handleEditBankAccount} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors" title="Modifier">
                                <PencilIcon className="h-5 w-5" />
                            </button>
                        </>
                    )}
                  </div>
               </div>
            )}
            
            {activeTab === 'meta' && isEditing && officialToEdit.createdAt && (
                <div className="text-xs text-gray-400 space-y-2 bg-gray-900/50 p-4 rounded-md">
                    <p><strong>Créé le:</strong> {new Date(officialToEdit.createdAt).toLocaleString('fr-FR')} par {officialToEdit.createdByName}</p>
                    {officialToEdit.updatedAt && officialToEdit.updatedByName && (
                        <p><strong>Dernière modification:</strong> {new Date(officialToEdit.updatedAt).toLocaleString('fr-FR')} par {officialToEdit.updatedByName}</p>
                    )}
                </div>
            )}
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button type="submit" disabled={isSaving} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center">
              {isSaving && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isSaving ? 'Sauvegarde...' : isEditing ? 'Sauvegarder' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OfficialModal;
