

import React, { useState } from 'react';
import { Official, Assignment, User } from '../types';
import WhistleIcon from './icons/WhistleIcon';
import UsersIcon from './icons/UsersIcon';
import TrashIcon from './icons/TrashIcon';
import UserMinusIcon from './icons/UserMinusIcon';
import PencilIcon from './icons/PencilIcon';
import LocationPinIcon from './icons/LocationPinIcon';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import PrinterIcon from './icons/PrinterIcon';
import CloseIcon from './icons/CloseIcon';

interface OfficialAssignmentProps {
  assignment: Assignment;
  official: Official | undefined;
  officialUser?: User | undefined;
  originalOfficial?: Official | undefined;
  onAssign: () => void;
  onRemove?: () => void;
  onUnassign?: () => void;
// FIX: Rename prop for consistency.
  onMarkOfficialAbsent?: () => void;
  canEdit: boolean;
  onSendMissionOrder?: () => void;
  onPrintMissionOrder?: () => void;
}

const OfficialAssignment: React.FC<OfficialAssignmentProps> = ({ assignment, official, officialUser, originalOfficial, onAssign, onRemove, onUnassign, onMarkOfficialAbsent, canEdit, onSendMissionOrder, onPrintMissionOrder }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { role, officialId, originalOfficialId } = assignment;
  const isDelegate = role.toLowerCase().includes('délégué');
  const Icon = isDelegate ? UsersIcon : WhistleIcon;

  const handleMarkAbsent = () => {
    if (onMarkOfficialAbsent) {
      onMarkOfficialAbsent();
    }
    setIsMenuOpen(false);
  }

  const handleChangeAssignment = () => {
    onAssign();
    setIsMenuOpen(false);
  };
  
  // State 1: Unassigned (empty slot)
  if (!officialId && !originalOfficialId) {
    if (canEdit) {
      return (
        <button
          onClick={onAssign}
          className="group w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-800/80 rounded-lg min-h-[72px] transition-colors border-2 border-dashed border-gray-700 hover:border-brand-primary"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
              <Icon className={`h-5 w-5 text-gray-500`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-300">{role}</p>
              <p className="text-sm text-gray-400 italic">Position ouverte</p>
            </div>
          </div>
          <span className="px-4 py-2 text-sm font-semibold text-white bg-brand-primary rounded-full group-hover:bg-brand-secondary transition-colors">
            Assigner
          </span>
        </button>
      );
    }
    // Unassigned and not editable
    return (
        <div className="flex items-center p-3 bg-gray-900 rounded-lg min-h-[72px] opacity-60">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <Icon className={`h-5 w-5 text-gray-500`} />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-400">{role}</p>
                    <p className="text-sm text-gray-500 italic">Non assigné</p>
                </div>
            </div>
        </div>
    );
  }

  // State 2 & 3: Assigned or Absent
  return (
    <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg min-h-[72px]">
      <div className="flex items-center gap-3">
        {official ? (
          officialUser?.avatar_url ? (
            <img src={officialUser.avatar_url} alt={official.fullName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white text-sm">
              {official.firstName.charAt(0)}{official.lastName.charAt(0)}
            </div>
          )
        ) : (
          <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
              <Icon className={`h-5 w-5 text-gray-500`} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-300">{role}</p>
          {official ? (
            <div>
              <div className="flex items-center gap-2">
                <p className="text-md text-white">{official.fullName}</p>
                {canEdit && onUnassign && (
                  <button
                    onClick={onUnassign}
                    className="p-1 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-700"
                    title="Désassigner l'officiel"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {assignment.travelDistanceInKm != null && (
                <div className="flex items-center text-xs text-gray-400 mt-0.5">
                    <LocationPinIcon className="h-3 w-3 mr-1.5" />
                    <span>~{assignment.travelDistanceInKm} km (A/R)</span>
                </div>
              )}
            </div>
          ) : (
            // This is the "Absent" case
            <div>
                <p className="text-sm text-gray-400 italic">Non assigné</p>
                <p className="text-xs text-red-400 italic">Absent: {originalOfficial?.fullName || 'ID inconnu'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {onRemove && canEdit && (
            <button
              onClick={onRemove}
              className="p-1 text-gray-500 hover:text-red-500 transition-colors"
              title="Supprimer ce créneau"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
        )}
        {/* 'Remplacer' button for 'Absent' state */}
        {!officialId && originalOfficialId && canEdit && (
          <button
            onClick={onAssign}
            className="px-3 py-1 text-xs font-semibold text-white bg-brand-primary rounded-full hover:bg-brand-secondary transition-colors duration-200"
          >
            Remplacer
          </button>
        )}
        {officialId && canEdit && (
          <div className="relative">
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                onBlur={() => setTimeout(() => setIsMenuOpen(false), 150)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-gray-700"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
            </button>
            {isMenuOpen && (
                 <div className="absolute right-0 mt-2 w-56 bg-gray-700 rounded-md shadow-lg z-10 py-1">
                    <button
                        onClick={handleChangeAssignment}
                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
                    >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Modifier la désignation
                    </button>
                    {onMarkOfficialAbsent && (
                        <button
                            onClick={handleMarkAbsent}
                            className="w-full text-left flex items-center px-4 py-2 text-sm text-red-300 hover:bg-red-500 hover:text-white"
                        >
                            <UserMinusIcon className="h-4 w-4 mr-2" />
                            Marquer comme absent
                        </button>
                    )}
                    {(onSendMissionOrder || onPrintMissionOrder) && <div className="border-t border-gray-600 my-1"></div>}
                    {onSendMissionOrder && (
                        <button
                            onClick={() => { onSendMissionOrder(); setIsMenuOpen(false); }}
                            disabled={!official?.email}
                            title={!official?.email ? "Aucun email pour cet officiel" : "Envoyer l'ordre de mission par email"}
                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                            Envoyer Ordre de Mission
                        </button>
                    )}
                    {onPrintMissionOrder && (
                        <button
                            onClick={() => { onPrintMissionOrder(); setIsMenuOpen(false); }}
                            className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
                        >
                            <PrinterIcon className="h-4 w-4 mr-2" />
                            Imprimer Ordre de Mission
                        </button>
                    )}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficialAssignment;
