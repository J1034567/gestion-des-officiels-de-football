
import React, { useState, useMemo } from 'react';
import { Official, Match, Location } from '../types';
import CloseIcon from './icons/CloseIcon';
import SearchIcon from './icons/SearchIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface AccountingOfficialSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (officialId: string) => void;
    availableOfficials: Official[];
    matchDate: string | null;
    allMatches: Match[];
    locations: Location[];
}

const AccountingOfficialSelectModal: React.FC<AccountingOfficialSelectModalProps> = ({ isOpen, onClose, onSelect, availableOfficials, matchDate, allMatches, locations }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const locationMap = useMemo(() => new Map(locations.map(loc => [loc.id, loc])), [locations]);
    const formatLocation = (locationId: string | null): string => {
        if (!locationId) return '';
        const location = locationMap.get(locationId);
        if (!location) return 'Inconnue';
        return [location.wilaya, location.daira, location.commune].filter(Boolean).join(' / ');
    };

    const sameDayAssignments = useMemo(() => {
        if (!matchDate) return new Map();
        const assignments = new Map<string, string[]>();
        const sameDayMatches = allMatches.filter(m => m.matchDate === matchDate);
        for (const match of sameDayMatches) {
            for (const assignment of match.assignments) {
                if (assignment.officialId) {
                    if (!assignments.has(assignment.officialId)) {
                        assignments.set(assignment.officialId, []);
                    }
                    assignments.get(assignment.officialId)!.push(`${match.homeTeam.name} vs ${match.awayTeam.name}`);
                }
            }
        }
        return assignments;
    }, [matchDate, allMatches]);

    const filteredOfficials = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return availableOfficials.filter(o => 
            o.fullName.toLowerCase().includes(lowerSearch) ||
            o.category.toLowerCase().includes(lowerSearch) ||
            formatLocation(o.locationId).toLowerCase().includes(lowerSearch)
        );
    }, [availableOfficials, searchTerm, formatLocation]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Sélectionner un Officiel</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><CloseIcon className="h-6 w-6" /></button>
                </div>
                <div className="p-4">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Rechercher par nom, catégorie, lieu..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
                    {filteredOfficials.map(official => {
                        const otherAssignments = sameDayAssignments.get(official.id);
                        return (
                            <button key={official.id} onClick={() => onSelect(official.id)} className="w-full text-left p-3 rounded-md cursor-pointer bg-gray-700 hover:bg-gray-600 transition-colors">
                                <div>
                                    <p className="font-semibold text-white">{official.fullName}</p>
                                    <p className="text-sm text-gray-400">{official.category} - {formatLocation(official.locationId) || 'Lieu non spécifié'}</p>
                                </div>
                                {otherAssignments && (
                                    <div className="mt-2 flex items-start text-xs text-yellow-300 bg-yellow-900/40 p-2 rounded-md border-l-2 border-yellow-500">
                                        <AlertTriangleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <span>Déjà assigné ce jour à : {otherAssignments.join(', ')}</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AccountingOfficialSelectModal;