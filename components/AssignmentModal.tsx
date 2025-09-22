import React, { useState, useMemo } from 'react';
import { Match, Official, OfficialRole, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import LocationPinIcon from './icons/LocationPinIcon';
import SearchIcon from './icons/SearchIcon';
import ArrowLeftIcon from './icons/ArrowLeftIcon';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  match: Match | null;
  role: OfficialRole | null;
  availableOfficials: Official[];
  onConfirmAssignment: (officialId: string) => void;
  locations: Location[];
}

// Helper functions for distance calculation
function getDistanceFromLatLonInKm(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}


const AssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, onBack, match, role, availableOfficials, onConfirmAssignment, locations }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const locationMap = useMemo(() => {
    return new Map<string, Location>(locations.map(loc => [loc.id, loc]));
  }, [locations]);

  const formatLocation = (location: Location | undefined) => {
    if (!location) return 'Lieu non spécifié';
    if (location.wilaya_ar && location.commune_ar) {
        return `${location.wilaya_ar} - ${location.commune_ar}`;
    }
    return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
  }

  const distances = useMemo(() => {
    const distancesMap = new Map<string, number | null>();
    if (!match?.stadium?.locationId) return distancesMap;

    const stadiumLocation = locationMap.get(match.stadium.locationId);
    if (!stadiumLocation) return distancesMap;

    availableOfficials.forEach(official => {
        if (official.locationId) {
            const officialLocation = locationMap.get(official.locationId);
            if (officialLocation) {
                const calculated = getDistanceFromLatLonInKm(officialLocation.latitude, officialLocation.longitude, stadiumLocation.latitude, stadiumLocation.longitude);
                if (calculated !== null) {
                    // Round trip with 20% buffer, as in Finances
                    distancesMap.set(official.id, Math.round(calculated * 2 * 1.2));
                } else {
                    distancesMap.set(official.id, null);
                }
            } else {
                 distancesMap.set(official.id, null);
            }
        } else {
            distancesMap.set(official.id, null);
        }
    });

    return distancesMap;
  }, [match, availableOfficials, locationMap]);
  
  const filteredOfficials = useMemo(() => {
    if (!searchTerm) {
      return availableOfficials;
    }
    const lowercasedFilter = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return availableOfficials.filter(official =>
      official.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowercasedFilter)
    );
  }, [availableOfficials, searchTerm]);


  if (!isOpen || !match || !role) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100 animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="text-gray-400 hover:text-white p-2 -ml-2 rounded-full hover:bg-gray-700" title="Retour">
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
            )}
            <div>
               <h2 className="text-2xl font-bold text-white">Désigner pour: {role}</h2>
               <p className="text-sm text-gray-400">{match.homeTeam.name} vs {match.awayTeam.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" title="Fermer">
            <CloseIcon className="h-6 w-6"/>
          </button>
        </div>
        
        <div className="p-6 flex-shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
                type="text"
                placeholder="Rechercher un officiel par nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                autoFocus
            />
          </div>
        </div>
        
        <div className="px-6 pb-6 overflow-y-auto flex-grow">
          <ul className="space-y-3">
            {filteredOfficials.length > 0 ? filteredOfficials.map((official) => {
              const distance = distances.get(official.id);
              const locationString = formatLocation(official.locationId ? locationMap.get(official.locationId) : undefined);
              return (
                <li
                  key={official.id}
                  className="flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all duration-200 bg-gray-700 hover:bg-gray-600 border-2 border-transparent"
                  onClick={() => onConfirmAssignment(official.id)}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white">
                        {official.firstName.charAt(0)}{official.lastName.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <p className="font-semibold text-white">{official.fullName}</p>
                      <p className="text-sm text-gray-400">{official.category} - {locationString}</p>
                    </div>
                  </div>
                   <div className="flex items-center space-x-4">
                        {distance !== null && typeof distance !== 'undefined' && (
                          <div className="flex items-center text-sm text-gray-300" title="Distance aller-retour estimée (incl. 20% de marge)">
                              <LocationPinIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                              ~{distance} km (A/R)
                          </div>
                        )}
                   </div>
                </li>
              );
            }) : (
              <p className="text-center text-gray-400 py-8">Aucun officiel disponible ne correspond à votre recherche.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AssignmentModal;