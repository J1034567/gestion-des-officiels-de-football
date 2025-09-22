

import React, { useState, useMemo } from 'react';
import { Official, User } from '../types';
import UsersIcon from './icons/UsersIcon';
import PencilIcon from './icons/PencilIcon';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import ConfirmationModal from './ConfirmationModal';
import TrashIcon from './icons/TrashIcon';
import { Permissions } from '../hooks/usePermissions';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface OfficialCardProps {
  official: Official;
  officialLocation: string;
  onManageAvailability: (official: Official) => void;
  onEdit: (official: Official) => void;
  onArchive: (officialId: string) => void;
  onViewDetails: (official: Official) => void;
  permissions: Permissions;
  currentUser: User;
  nextUpcomingMatchDate: Date | null;
  isSelected: boolean;
  onSelect: (officialId: string) => void;
  isProfileComplete: boolean;
  incompleteProfileFields: string[];
}

const isUnavailableOnDate = (official: Official, date: Date | null): boolean => {
    if (!date) {
        return false; // If no upcoming matches, assume available
    }
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0);

    return official.unavailabilities.some(unavailability => {
        const startDate = new Date(unavailability.startDate);
        const endDate = new Date(unavailability.endDate);
        startDate.setHours(12, 0, 0, 0);
        endDate.setHours(12, 0, 0, 0);
        return checkDate >= startDate && checkDate <= endDate;
    });
};

const OfficialCard: React.FC<OfficialCardProps> = ({ official, officialLocation, onManageAvailability, onEdit, onArchive, onViewDetails, permissions, currentUser, nextUpcomingMatchDate, isSelected, onSelect, isProfileComplete, incompleteProfileFields }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const isAvailable = !isUnavailableOnDate(official, nextUpcomingMatchDate);

  const canEdit = permissions.can('edit', 'official');
  const canArchive = permissions.can('archive', 'official');
  const canManageAvailability = permissions.can('edit', 'availability', official);

  const availabilityTitle = useMemo(() => {
    if (!nextUpcomingMatchDate) {
      return "Disponibilité non vérifiée (aucun match à venir)";
    }
    const dateString = nextUpcomingMatchDate.toLocaleDateString('fr-FR');
    return isAvailable ? `Disponible le ${dateString}` : `Indisponible le ${dateString}`;
  }, [isAvailable, nextUpcomingMatchDate]);


  const handleConfirmArchive = () => {
    onArchive(official.id);
    setIsArchiveModalOpen(false);
  };
  
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Prevent toggling selection when clicking on interactive elements
    if (target.closest('button, input, a, select')) {
      return;
    }
    onViewDetails(official);
  };

  return (
    <>
      <div 
        onClick={handleCardClick}
        className={`bg-gray-900/50 rounded-lg shadow-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 cursor-pointer ${isSelected ? 'border-2 border-brand-primary ring-2 ring-brand-primary/20' : `border-2 ${isProfileComplete ? 'border-transparent' : 'border-yellow-500/30'} hover:border-gray-700`}`}
      >
        <div className="flex items-center w-full sm:w-auto">
           <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(official.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 rounded bg-gray-900 border-gray-600 text-brand-primary focus:ring-brand-secondary flex-shrink-0"
            aria-label={`Sélectionner ${official.fullName}`}
          />
          <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center relative ml-4">
            <UsersIcon className="h-6 w-6 text-gray-400" />
            <span
              className={`absolute -bottom-1 -right-1 block h-4 w-4 rounded-full border-2 border-gray-800 ${
                isAvailable ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={availabilityTitle}
            ></span>
          </div>
          <div className="ml-4">
            <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-white">{official.fullName}</p>
                {!isProfileComplete && (
                  <div className="group relative flex items-center">
                    <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        Infos manquantes: {incompleteProfileFields.join(', ')}
                        <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                            <polygon className="fill-current" points="0,0 127.5,127.5 255,0"/>
                        </svg>
                    </div>
                  </div>
                )}
                {official.position != null && (
                  <span className="text-xs font-bold text-cyan-300 bg-cyan-900/50 px-2 py-1 rounded-full" title={`Position: ${official.position}`}>
                    #{official.position}
                  </span>
                )}
            </div>
            <p className="text-sm text-gray-400">{official.category} - {officialLocation || <span className="italic text-yellow-500">Localisation non spécifiée</span>}</p>
            {official.address && <p className="text-sm text-gray-500">{official.address}</p>}
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                {official.email && <span>{official.email}</span>}
                {official.phone && <span>{official.phone}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button 
            onClick={(e) => { e.stopPropagation(); onManageAvailability(official); }}
            disabled={!canManageAvailability}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Gérer les disponibilités"
          >
            <CalendarDaysIcon className="h-5 w-5" />
          </button>
          
          {(canEdit || canArchive) && (
            <div className="relative">
                <button
                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                    onBlur={() => setTimeout(() => setIsMenuOpen(false), 150)}
                    className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-10">
                        {canEdit && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(official); setIsMenuOpen(false); }}
                                className={`w-full text-left flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 ${!canArchive ? 'rounded-md' : 'rounded-t-md'}`}
                            >
                                <PencilIcon className="h-4 w-4 mr-2" />
                                Modifier le profil
                            </button>
                        )}
                        {canArchive && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsArchiveModalOpen(true); setIsMenuOpen(false); }}
                            className={`w-full text-left flex items-center px-4 py-2 text-sm text-red-300 hover:bg-red-500 hover:text-white ${!canEdit ? 'rounded-md' : 'rounded-b-md'}`}
                        >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Archiver
                        </button>
                        )}
                    </div>
                )}
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        title={`Archiver ${official.fullName}`}
        message="Êtes-vous sûr de vouloir archiver cet officiel ? Il ne sera plus disponible pour les désignations, mais son historique sera conservé."
      />
    </>
  );
};

export default OfficialCard;