
import React, { useState, useMemo } from 'react';
import { Team, Stadium, Location } from '../types';
import CloseIcon from './icons/CloseIcon';

interface QuickStadiumAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stadiumId: string | null) => void;
  team: Team | null;
  stadiums: Stadium[];
  localisations: Location[];
}

const QuickStadiumAssignModal: React.FC<QuickStadiumAssignModalProps> = ({
  isOpen,
  onClose,
  onSave,
  team,
  stadiums,
  localisations,
}) => {
  const [selectedStadiumId, setSelectedStadiumId] = useState<string>('');
  const [stadiumSearch, setStadiumSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedStadium = useMemo(() => stadiums.find(s => s.id === selectedStadiumId), [selectedStadiumId, stadiums]);

  const locationMap = useMemo(() => new Map(localisations.map(loc => [loc.id, loc])), [localisations]);
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
        (normalize(stadium.name).includes(searchTermNormalized) || normalize(formatLocation(stadium.locationId)).includes(searchTermNormalized))
    );

    return filtered.reduce((acc, stadium) => {
        const location = stadium.locationId ? locationMap.get(stadium.locationId) : null;
        const wilaya = location?.wilaya_ar?.trim() || location?.wilaya?.trim() || 'Non spécifié';
        if (!acc[wilaya]) acc[wilaya] = [];
        acc[wilaya].push(stadium);
        return acc;
    }, {} as Record<string, Stadium[]>);
  }, [stadiums, stadiumSearch, locationMap, formatLocation]);

  const handleStadiumSelect = (stadium: Stadium) => {
    setSelectedStadiumId(stadium.id);
    setStadiumSearch('');
    setIsDropdownOpen(false);
  };

  const handleSubmit = () => {
    onSave(selectedStadiumId || null);
  };

  if (!isOpen || !team) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Assigner un Stade</h2>
            <p className="text-sm text-gray-400">Pour l'équipe {team.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          <div className="relative">
            <label htmlFor="stadium-search-quick" className="block text-sm font-medium text-gray-300">Stade</label>
            <div className="relative mt-1">
              <input id="stadium-search-quick" type="text"
                placeholder={selectedStadiumId ? (selectedStadium?.name || '') : "Rechercher un stade..."}
                value={stadiumSearch}
                onChange={(e) => { setStadiumSearch(e.target.value); setIsDropdownOpen(true); if (selectedStadiumId) setSelectedStadiumId(''); }}
                onFocus={() => { setIsDropdownOpen(true); setStadiumSearch(''); }}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
              />
              {selectedStadiumId && (
                <button type="button" onClick={() => { setSelectedStadiumId(''); setStadiumSearch(''); }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white" aria-label="Effacer la sélection">
                    <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                {Object.keys(groupedStadiums).length === 0 && (
                    <div className="px-4 py-2 text-sm text-gray-400">Aucun stade trouvé.</div>
                )}
                {Object.entries(groupedStadiums).sort(([a], [b]) => a.localeCompare(b)).map(([wilaya, stadia]) => (
                    <div key={wilaya}>
                        <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase">{wilaya}</div>
                        {stadia.map(stadium => (
                            <button type="button" key={stadium.id} onClick={() => handleStadiumSelect(stadium)}
                                className="text-left w-full px-4 py-2 text-sm text-white hover:bg-brand-primary/20">
                                {stadium.name} <span className="text-gray-400 text-xs">({formatLocation(stadium.locationId)})</span>
                            </button>
                        ))}
                    </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
          <button onClick={handleSubmit} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickStadiumAssignModal;
