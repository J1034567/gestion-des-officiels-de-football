
import React, { useState, useMemo, useCallback } from 'react';
import { Official, Match, Location } from '../types';
import SearchIcon from './icons/SearchIcon';
import CalendarIcon from './icons/CalendarIcon';
import LocationPinIcon from './icons/LocationPinIcon';
import WhistleIcon from './icons/WhistleIcon';
import UsersIcon from './icons/UsersIcon';

interface OfficialPlanningViewProps {
  officials: Official[];
  matches: Match[];
  onEditMatch: (match: Match) => void;
  locations: Location[];
}

const OfficialPlanningView: React.FC<OfficialPlanningViewProps> = ({ officials, matches, onEditMatch, locations }) => {
  const [selectedOfficialId, setSelectedOfficialId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const activeOfficials = useMemo(() => officials.filter(o => o.isActive && !o.isArchived), [officials]);

  const locationMap = useMemo(() => new Map(locations.map(loc => [loc.id, loc])), [locations]);
  const formatLocation = useCallback((locationId: string | null): string => {
      if (!locationId) return 'N/A';
      const location = locationMap.get(locationId);
      if (!location) return 'Inconnue';
      if (location.wilaya_ar && location.commune_ar) {
          return `${location.wilaya_ar} - ${location.commune_ar}`;
      }
      return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
  }, [locationMap]);

  const filteredOfficials = useMemo(() => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const searchKeywords = normalize(searchTerm).split(' ').filter(Boolean);
    if (searchKeywords.length === 0) return activeOfficials.sort((a,b) => a.fullName.localeCompare(b.fullName));
    return activeOfficials.filter(o => {
      const searchableText = [normalize(o.fullName), normalize(o.category), normalize(formatLocation(o.locationId))].join(' ');
      return searchKeywords.every(keyword => searchableText.includes(keyword));
    }).sort((a,b) => a.fullName.localeCompare(b.fullName));
  }, [activeOfficials, searchTerm, formatLocation]);

  const assignmentsForSelectedOfficial = useMemo(() => {
    if (!selectedOfficialId) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignments: { match: Match; role: string }[] = [];
    matches.forEach(match => {
      if (match.isArchived || !match.matchDate || new Date(match.matchDate) < today) return;

      match.assignments.forEach(assignment => {
        if (assignment.officialId === selectedOfficialId) {
          assignments.push({ match, role: assignment.role });
        }
      });
    });

    return assignments.sort((a, b) => new Date(a.match.matchDate!).getTime() - new Date(b.match.matchDate!).getTime());
  }, [selectedOfficialId, matches]);

  const selectedOfficial = useMemo(() => {
      return officials.find(o => o.id === selectedOfficialId);
  }, [selectedOfficialId, officials]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {/* Officials List */}
      <div className="md:col-span-1 lg:col-span-1 bg-gray-800 p-4 rounded-lg flex flex-col">
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un officiel..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white"
          />
        </div>
        <div className="space-y-2 overflow-y-auto flex-grow" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
          {filteredOfficials.map(official => (
            <button
              key={official.id}
              onClick={() => setSelectedOfficialId(official.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors flex items-center ${
                selectedOfficialId === official.id ? 'bg-brand-primary/20' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white text-sm">
                {official.firstName.charAt(0)}{official.lastName.charAt(0)}
              </div>
              <div className="ml-3 min-w-0">
                <p className={`font-semibold truncate ${selectedOfficialId === official.id ? 'text-brand-primary' : 'text-white'}`}>{official.fullName}</p>
                <p className="text-xs text-gray-400 truncate">{official.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule View */}
      <div className="md:col-span-2 lg:col-span-3 bg-gray-800 p-4 rounded-lg">
        {selectedOfficial ? (
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Planning de {selectedOfficial.fullName}</h3>
            {assignmentsForSelectedOfficial.length > 0 ? (
              <div className="space-y-4">
                {assignmentsForSelectedOfficial.map(({ match, role }, index) => (
                  <div key={`${match.id}-${index}`} className="bg-gray-900/50 p-4 rounded-lg cursor-pointer hover:bg-gray-900 transition-shadow hover:shadow-lg" onClick={() => onEditMatch(match)}>
                    <p className="font-semibold text-brand-primary">{role}</p>
                    <p className="text-lg font-bold text-white">{match.homeTeam.name} vs {match.awayTeam.name}</p>
                    <div className="mt-2 pt-2 border-t border-gray-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-400">
                        <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            {new Date(match.matchDate!).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} @ {match.matchTime || 'N/A'}
                        </div>
                        <div className="flex items-center">
                            <LocationPinIcon className="h-4 w-4 mr-2" />
                            {match.stadium?.name}, {formatLocation(match.stadium?.locationId || null)}
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 h-full flex flex-col items-center justify-center">
                <WhistleIcon className="h-12 w-12 text-gray-500 mx-auto" />
                <p className="mt-4 text-gray-400">Aucune désignation à venir pour cet officiel.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <UsersIcon className="h-16 w-16 text-gray-600" />
            <h3 className="mt-4 text-xl font-semibold text-white">Sélectionnez un officiel</h3>
            <p className="mt-1 text-gray-400">Choisissez un officiel dans la liste de gauche pour voir ses désignations à venir.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficialPlanningView;