// components/StadiumAssignmentModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Match, Stadium, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import SearchIcon from './icons/SearchIcon';
import XMarkIcon from './icons/XMarkIcon';
import PencilIcon from './icons/PencilIcon';
import CheckIcon from './icons/CheckIcon';
import { Permissions } from '../hooks/usePermissions';

interface StadiumAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAssignment: (matchId: string, stadiumId: string | null) => void;
  onSaveStadium: (stadium: Stadium) => void;
  match: Match | null;
  stadiums: Stadium[];
  locations: Location[];
  permissions: Permissions;
}

const StadiumAssignmentModal: React.FC<StadiumAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSaveAssignment,
  onSaveStadium,
  match,
  stadiums,
  locations,
  permissions,
}) => {
  const [stadiumSearch, setStadiumSearch] = useState('');
  const [editingStadiumId, setEditingStadiumId] = useState<string | null>(null);
  const [editingStadiumName, setEditingStadiumName] = useState('');
  const [editingStadiumNameAr, setEditingStadiumNameAr] = useState('');
  const [editError, setEditError] = useState('');
  const stadiumRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const canEditStadiumName = permissions.can('edit', 'club_or_stadium');

  useEffect(() => {
    if (isOpen && match?.stadium?.id) {
      const stadiumElement = stadiumRefs.current.get(match.stadium.id);
      // Timeout ensures the element is rendered and positioned before scrolling
      setTimeout(() => {
        stadiumElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [isOpen, match]);


  const locationMap = useMemo(() => new Map(locations.map(loc => [loc.id, loc])), [locations]);
  const formatLocation = (locationId: string | null): string => {
      if (!locationId) return 'Non spécifiée';
      const location = locationMap.get(locationId);
      if (!location) return 'Inconnue';
      if (location.wilaya_ar && location.commune_ar) {
          return `${location.wilaya_ar} - ${location.commune_ar}`;
      }
      return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
  };


  const groupedStadiums = useMemo(() => {
    const normalize = (str: string | null): string => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const searchTermNormalized = normalize(stadiumSearch);
    
    const filtered = stadiums.filter(stadium => 
        !stadium.isArchived &&
        (normalize(stadium.name).includes(searchTermNormalized) || normalize(stadium.nameAr).includes(searchTermNormalized) || normalize(formatLocation(stadium.locationId)).includes(searchTermNormalized))
    );

    return filtered.reduce((acc, stadium) => {
        const location = stadium.locationId ? locationMap.get(stadium.locationId) : null;
        const wilaya = location?.wilaya_ar?.trim() || location?.wilaya?.trim() || 'Non spécifié';
        if (!acc[wilaya]) acc[wilaya] = [];
        acc[wilaya].push(stadium);
        return acc;
    }, {} as Record<string, Stadium[]>);
  }, [stadiums, stadiumSearch, locationMap, formatLocation]);

  const handleSelect = (stadiumId: string | null) => {
    if (match) {
      onSaveAssignment(match.id, stadiumId);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, stadium: Stadium) => {
    e.stopPropagation();
    setEditingStadiumId(stadium.id);
    setEditingStadiumName(stadium.name);
    setEditingStadiumNameAr(stadium.nameAr || '');
    setEditError('');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStadiumId(null);
    setEditError('');
  };
  
  const handleSaveName = async (e: React.MouseEvent, stadium: Stadium) => {
      e.stopPropagation();
      const newName = editingStadiumName.trim();
      const newNameAr = editingStadiumNameAr.trim();

      if (!newName) {
          setEditError("Le nom du stade ne peut pas être vide.");
          return;
      }
      if (stadiums.some(s => s.name.toLowerCase() === newName.toLowerCase() && s.id !== stadium.id)) {
          setEditError("Un autre stade porte déjà ce nom.");
          return;
      }
      
      await onSaveStadium({ ...stadium, name: newName, nameAr: newNameAr || null });
      setEditingStadiumId(null);
      setEditError('');
  };


  if (!isOpen || !match) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl flex flex-col">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Changer le Stade</h2>
            <p className="text-sm text-gray-400">{match.homeTeam.name} vs {match.awayTeam.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6" /></button>
        </div>
        <div className="p-6">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Rechercher un stade..."
                    value={stadiumSearch}
                    onChange={(e) => setStadiumSearch(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white"
                    autoFocus
                />
            </div>
             {editingStadiumId && editError && <p className="text-xs text-red-400 mt-2 pl-1">{editError}</p>}
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-grow max-h-[50vh]">
            <div className="space-y-2">
                <button
                    onClick={() => handleSelect(null)}
                    className="w-full text-left p-3 rounded-md flex items-center gap-2 bg-gray-700 hover:bg-red-900/50 text-red-300 transition-colors"
                >
                    <XMarkIcon className="h-5 w-5" />
                    <span>Désassigner le stade (Aucun)</span>
                </button>
                {Object.entries(groupedStadiums).sort(([a], [b]) => a.localeCompare(b)).map(([wilaya, stadia]) => (
                    <div key={wilaya}>
                        <div className="px-1 py-1 text-xs font-bold text-gray-400 uppercase">{wilaya}</div>
                        {stadia.map(stadium => {
                            const isEditingThis = editingStadiumId === stadium.id;
                            return (
                                <div
                                    key={stadium.id}
                                    ref={(el) => {
                                      if (el) {
                                        stadiumRefs.current.set(stadium.id, el);
                                      } else {
                                        stadiumRefs.current.delete(stadium.id);
                                      }
                                    }}
                                    onClick={() => !isEditingThis && handleSelect(stadium.id)}
                                    className={`w-full text-left p-3 rounded-md flex justify-between items-center transition-colors ${
                                        !isEditingThis ? 'cursor-pointer' : ''
                                    } ${
                                        match.stadium?.id === stadium.id && !isEditingThis
                                        ? 'bg-brand-primary/20 ring-2 ring-brand-primary/50'
                                        : 'bg-gray-700/50 hover:bg-gray-700'
                                    }`}
                                >
                                    {isEditingThis ? (
                                        <div className="w-full flex-grow flex flex-col sm:flex-row items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="text" 
                                                value={editingStadiumName} 
                                                onChange={e => setEditingStadiumName(e.target.value)} 
                                                autoFocus
                                                placeholder="Nom (Français)"
                                                onKeyDown={e => e.key === 'Enter' && handleSaveName(e as any, stadium)}
                                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white" 
                                            />
                                            <input 
                                                type="text" 
                                                dir="rtl"
                                                value={editingStadiumNameAr} 
                                                onChange={e => setEditingStadiumNameAr(e.target.value)} 
                                                placeholder="الاسم (عربية)"
                                                onKeyDown={e => e.key === 'Enter' && handleSaveName(e as any, stadium)}
                                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white" 
                                            />
                                            <div className="flex-shrink-0 flex items-center self-end sm:self-center">
                                                <button onClick={(e) => handleSaveName(e, stadium)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-full" aria-label="Sauvegarder le nom"><CheckIcon className="h-5 w-5"/></button>
                                                <button onClick={handleCancelEdit} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-full" aria-label="Annuler la modification"><XMarkIcon className="h-5 w-5"/></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <span className={match.stadium?.id === stadium.id ? 'text-brand-primary font-semibold' : 'text-white'}>
                                                {stadium.nameAr ? `${stadium.name} - ${stadium.nameAr}` : stadium.name} 
                                                <span className="text-gray-400 text-xs ml-2">({formatLocation(stadium.locationId)})</span>
                                            </span>
                                            {canEditStadiumName && (
                                                <button onClick={(e) => handleStartEdit(e, stadium)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full flex-shrink-0" aria-label="Modifier le nom du stade">
                                                    <PencilIcon className="h-4 w-4"/>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default StadiumAssignmentModal;