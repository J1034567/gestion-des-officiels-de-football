
import React, { useState, useEffect, useMemo } from 'react';
import { Team, TeamHistoryEntry, Stadium, TeamSeasonStadium, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import PencilIcon from './icons/PencilIcon';
import ListBulletIcon from './icons/ListBulletIcon';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (team: Team) => void;
  teamToEdit?: Team | null;
  teams: Team[];
  history: TeamHistoryEntry[];
  stadiums: Stadium[];
  currentSeason: string;
  teamStadiums: TeamSeasonStadium[];
  onSetTeamHomeStadium: (data: { teamId: string, stadiumId: string | null, season: string }) => void;
  localisations: Location[];
}

const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, onSave, teamToEdit, teams, history, stadiums, currentSeason, teamStadiums, onSetTeamHomeStadium, localisations }) => {
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [foundedYear, setFoundedYear] = useState<number | ''>('');
  const [primaryColor, setPrimaryColor] = useState('#ffffff');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [homeStadiumId, setHomeStadiumId] = useState<string>('');
  const [stadiumSearch, setStadiumSearch] = useState('');
  const [isStadiumDropdownOpen, setIsStadiumDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  const isNewTeam = !teamToEdit;

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

  useEffect(() => {
    if (isOpen) {
      if (teamToEdit) {
        setName(teamToEdit.name);
        setFullName(teamToEdit.fullName || '');
        setLogoUrl(teamToEdit.logoUrl || '');
        setFoundedYear(teamToEdit.foundedYear || '');
        setPrimaryColor(teamToEdit.primaryColor || '#ffffff');
        setSecondaryColor(teamToEdit.secondaryColor || '#000000');
        const stadiumLink = teamStadiums.find(ts => ts.teamId === teamToEdit.id && ts.season === currentSeason);
        setHomeStadiumId(stadiumLink?.stadiumId || '');
        setIsEditMode(false); // Start in view mode
      } else {
        setName('');
        setFullName('');
        setLogoUrl('');
        setFoundedYear('');
        setPrimaryColor('#ffffff');
        setSecondaryColor('#000000');
        setHomeStadiumId('');
        setIsEditMode(true); // Start in edit mode for new team
      }
      setError('');
    }
  }, [isOpen, teamToEdit, currentSeason, teamStadiums]);

  const selectedStadium = useMemo(() => stadiums.find(s => s.id === homeStadiumId), [homeStadiumId, stadiums]);

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
        if (!acc[wilaya]) {
            acc[wilaya] = [];
        }
        acc[wilaya].push(stadium);
        return acc;
    }, {} as Record<string, Stadium[]>);

  }, [stadiums, stadiumSearch, locationMap, formatLocation]);

  const handleStadiumSelect = (stadium: Stadium) => {
    setHomeStadiumId(stadium.id);
    setStadiumSearch('');
    setIsStadiumDropdownOpen(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !fullName.trim()) {
      setError('Le nom court et le nom complet sont obligatoires.');
      return;
    }

    if (teams.some(t => t.name.trim().toLowerCase() === name.trim().toLowerCase() && t.id !== teamToEdit?.id)) {
        setError("Une équipe avec ce nom existe déjà.");
        return;
    }

    onSave({
      ...(teamToEdit ? teamToEdit : {}),
      id: isNewTeam ? crypto.randomUUID() : teamToEdit!.id,
      name: name.trim(),
      fullName: fullName.trim(),
      logoUrl: logoUrl.trim() || null,
      foundedYear: foundedYear ? Number(foundedYear) : null,
      primaryColor,
      secondaryColor,
      isArchived: teamToEdit ? teamToEdit.isArchived : false,
      code: teamToEdit?.code || '',
    } as Team);
    
    if (!isNewTeam) {
        onSetTeamHomeStadium({
            teamId: teamToEdit.id,
            stadiumId: homeStadiumId || null,
            season: currentSeason
        });
    }

    if (isNewTeam) {
        onClose();
    } else {
        setIsEditMode(false);
    }
  };
  
  const handleCancelEdit = () => {
      if(isNewTeam) {
          onClose();
      } else if (teamToEdit) {
          // Reset fields to original values and switch to view mode
          setName(teamToEdit.name);
          setFullName(teamToEdit.fullName || '');
          setLogoUrl(teamToEdit.logoUrl || '');
          setFoundedYear(teamToEdit.foundedYear || '');
          setPrimaryColor(teamToEdit.primaryColor || '#ffffff');
          setSecondaryColor(teamToEdit.secondaryColor || '#000000');
          const stadiumLink = teamStadiums.find(ts => ts.teamId === teamToEdit.id && ts.season === currentSeason);
          setHomeStadiumId(stadiumLink?.stadiumId || '');
          setError('');
          setIsEditMode(false);
      }
  };

  if (!isOpen) return null;
  
  const renderContent = () => {
    if (isEditMode) {
      return (
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label htmlFor="team-name" className="block text-sm font-medium text-gray-300">Nom <span className="text-red-400">*</span></label>
                  <input type="text" id="team-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                </div>
                <div>
                  <label htmlFor="founded-year" className="block text-sm font-medium text-gray-300">Année de fondation</label>
                  <input type="number" id="founded-year" value={foundedYear} onChange={e => setFoundedYear(e.target.value ? parseInt(e.target.value) : '')} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                </div>
            </div>
            <div>
              <label htmlFor="team-fullName" className="block text-sm font-medium text-gray-300">Nom Complet <span className="text-red-400">*</span></label>
              <input type="text" id="team-fullName" value={fullName} onChange={e => setFullName(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
            </div>
            <div>
              <label htmlFor="team-logoUrl" className="block text-sm font-medium text-gray-300">URL du Logo</label>
              <input type="text" id="team-logoUrl" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="primary-color" className="block text-sm font-medium text-gray-300">Couleur Primaire</label>
                <input type="color" id="primary-color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="mt-1 block w-full h-10 bg-gray-900 border border-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
              </div>
              <div>
                <label htmlFor="secondary-color" className="block text-sm font-medium text-gray-300">Couleur Secondaire</label>
                <input type="color" id="secondary-color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="mt-1 block w-full h-10 bg-gray-900 border border-gray-700 rounded-md shadow-sm text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
              </div>
            </div>
            <div className="relative">
                <label htmlFor="stadium-search" className="block text-sm font-medium text-gray-300">Stade à Domicile ({currentSeason})</label>
                <div className="relative mt-1">
                    <input id="stadium-search" type="text"
                        placeholder={homeStadiumId ? (selectedStadium?.name || '') : "Rechercher un stade..."}
                        value={stadiumSearch}
                        onChange={(e) => { setStadiumSearch(e.target.value); setIsStadiumDropdownOpen(true); if (homeStadiumId) setHomeStadiumId(''); }}
                        onFocus={() => { setIsStadiumDropdownOpen(true); setStadiumSearch(''); }}
                        onBlur={() => setTimeout(() => setIsStadiumDropdownOpen(false), 200)}
                        className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    />
                     {homeStadiumId && (
                        <button type="button" onClick={() => { setHomeStadiumId(''); setStadiumSearch(''); }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white" aria-label="Effacer la sélection">
                            <CloseIcon className="h-4 w-4" />
                        </button>
                     )}
                </div>

                {isStadiumDropdownOpen && (
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
            {!isNewTeam && (
                <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 space-y-1">
                    <p>Créé le: {new Date(teamToEdit.createdAt).toLocaleString('fr-FR')} par {teamToEdit.createdByName}</p>
                    {teamToEdit.updatedAt && teamToEdit.updatedByName && (
                        <p>Dernière modification: {new Date(teamToEdit.updatedAt).toLocaleString('fr-FR')} par {teamToEdit.updatedByName}</p>
                    )}
                </div>
            )}
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button type="button" onClick={handleCancelEdit} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500">Annuler</button>
            <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
              {isNewTeam ? 'Ajouter' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      );
    }
    
    return (
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start">
                <div className="flex items-center">
                    <img src={logoUrl || undefined} alt={name} className="w-16 h-16 rounded-full bg-gray-700 object-cover mr-4" />
                    <div>
                        <h3 className="text-xl font-bold text-white">{name}</h3>
                        <p className="text-gray-300">{fullName}</p>
                        <div className="flex items-center mt-2">
                           <div className="w-6 h-6 rounded-full border-2 border-gray-600" style={{ backgroundColor: primaryColor }}></div>
                           <div className="w-6 h-6 -ml-2 rounded-full border-2 border-gray-600" style={{ backgroundColor: secondaryColor }}></div>
                        </div>
                    </div>
                </div>
                <button onClick={() => setIsEditMode(true)} className="flex items-center text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-3 rounded-lg transition-colors duration-200">
                    <PencilIcon className="h-4 w-4 mr-2" /> Modifier
                </button>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-300 mb-2">Informations</h4>
                <div className="text-sm text-gray-400 space-y-1">
                    <p><strong>Fondé en:</strong> {foundedYear || 'N/A'}</p>
                    <p><strong>Stade à domicile ({currentSeason}):</strong> {selectedStadium ? `${selectedStadium.name} (${formatLocation(selectedStadium.locationId)})` : 'Non défini'}</p>
                </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg">
                 <h4 className="font-semibold text-gray-300 mb-2 flex items-center"><ListBulletIcon className="h-5 w-5 mr-2" /> Historique</h4>
                 {history.length > 0 ? (
                    <ul className="space-y-1 text-sm text-gray-400">
                        {history.map((h, i) => (
                           <li key={i}><strong>{h.season}:</strong> {h.leagueName} - {h.groupName}</li>
                        ))}
                    </ul>
                 ) : <p className="text-sm text-gray-500 italic">Aucun historique disponible.</p>}
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isNewTeam ? 'Ajouter une Équipe' : 'Détails de l\'Équipe'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default TeamModal;
