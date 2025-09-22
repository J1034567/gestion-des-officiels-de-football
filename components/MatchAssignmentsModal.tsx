import React, { useState, useMemo, useCallback } from "react";
import {
  Match,
  Official,
  User,
  OfficialRole,
  AccountingStatus,
  MatchStatus,
} from "../types";
import { Permissions } from "../hooks/usePermissions";
import CloseIcon from "./icons/CloseIcon";
import OfficialAssignment from "./OfficialAssignment";
import PlusIcon from "./icons/PlusIcon";
import WhistleIcon from "./icons/WhistleIcon";
import UsersIcon from "./icons/UsersIcon";
import PaperAirplaneIcon from "./icons/PaperAirplaneIcon";

interface MatchAssignmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  officials: Official[];
  users: User[];
  officialRoles: OfficialRole[];
  onAssign: (matchId: string, assignmentId: string, role: OfficialRole) => void;
  onAddAssignment: (matchId: string, role: OfficialRole) => Promise<void>;
  onRemoveAssignment: (matchId: string, assignmentId: string) => void;
  onMarkOfficialAbsent: (matchId: string, assignmentId: string) => void;
  onUpdateAssignment: (
    matchId: string,
    assignmentId: string,
    officialId: string | null
  ) => void;
  permissions: Permissions;
  onPrintIndividualMissionOrder: (matchId: string, officialId: string) => void;
  onSendIndividualMissionOrder: (matchId: string, officialId: string) => void;
  onSendAllMissionOrders: (matchId: string) => void;
}

const PlaceholderAssignmentSlot: React.FC<{
  role: OfficialRole;
  onAdd: () => Promise<void>;
  canEdit: boolean;
}> = ({ role, onAdd, canEdit }) => {
  const [isAdding, setIsAdding] = useState(false);
  const isDelegate = role.toLowerCase().includes("délégué");
  const Icon = isDelegate ? UsersIcon : WhistleIcon;

  if (!canEdit) {
    return null; // Don't show placeholders if user can't edit
  }

  const handleClick = async () => {
    if (isAdding) return;
    setIsAdding(true);
    await onAdd();
    // No need to set isAdding to false, as the component will be unmounted and replaced.
  };

  return (
    <button
      onClick={handleClick}
      disabled={isAdding}
      className="group w-full flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-800/80 rounded-lg min-h-[72px] transition-colors border-2 border-dashed border-gray-700 hover:border-brand-primary disabled:opacity-50 disabled:cursor-wait"
      aria-label={`Créer le créneau pour ${role}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
          <Icon className={`h-5 w-5 text-gray-500`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-300">{role}</p>
          <p className="text-sm text-gray-400 italic">Créneau non créé</p>
        </div>
      </div>
      <span className="px-4 py-2 text-sm font-semibold text-white bg-gray-600 group-hover:bg-gray-500 transition-colors rounded-full flex items-center">
        {isAdding && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {isAdding ? "Création..." : "Créer"}
      </span>
    </button>
  );
};

const MatchAssignmentsModal: React.FC<MatchAssignmentsModalProps> = ({
  isOpen,
  onClose,
  match,
  officials,
  users,
  officialRoles,
  onAssign,
  onAddAssignment,
  onRemoveAssignment,
  onMarkOfficialAbsent,
  onUpdateAssignment,
  permissions,
  onPrintIndividualMissionOrder,
  onSendIndividualMissionOrder,
  onSendAllMissionOrders,
}) => {
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const getOfficialUser = useCallback(
    (officialId: string | null): User | undefined => {
      if (!officialId) return undefined;
      const official = officials.find((o) => o.id === officialId);
      if (!official?.userId) return undefined;
      return userMap.get(official.userId);
    },
    [officials, userMap]
  );

  const isMatchLockedForAccounting = useMemo(() => {
    if (!match) return true; // Default to locked if no match is provided
    return (
      match.accountingStatus === AccountingStatus.VALIDATED ||
      match.accountingStatus === AccountingStatus.CLOSED
    );
  }, [match]);

  const assignedOfficialsWithEmail = useMemo(() => {
    if (!match) return [];
    return match.assignments
      .map((a) => officials.find((o) => o.id === a.officialId))
      .filter((o): o is Official => !!o && !!o.email);
  }, [match, officials]);

  const { existingAssignments, placeholderRoles } = useMemo(() => {
    if (!match) return { existingAssignments: [], placeholderRoles: [] };

    const existing = [...match.assignments];
    const existingRoles = new Set(existing.map((a) => a.role));
    const placeholders = officialRoles.filter(
      (role) => !existingRoles.has(role)
    );

    return {
      existingAssignments: existing.sort(
        (a, b) => officialRoles.indexOf(a.role) - officialRoles.indexOf(b.role)
      ),
      placeholderRoles: placeholders.sort(
        (a, b) => officialRoles.indexOf(a) - officialRoles.indexOf(b)
      ),
    };
  }, [match, officialRoles]);

  if (!isOpen || !match) return null;

  const isMatchStateEditableForAssignments =
    match.status === MatchStatus.SCHEDULED && !isMatchLockedForAccounting;

  const canAssignOfficial =
    permissions.can("assign", "official") && isMatchStateEditableForAssignments;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Gérer les Désignations
            </h2>
            <p className="text-sm text-gray-400">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-3">
          {existingAssignments.map((assignment) => {
            const isRemovable = onRemoveAssignment && !assignment.officialId;
            return (
              <OfficialAssignment
                key={assignment.id}
                assignment={assignment}
                official={officials.find((o) => o.id === assignment.officialId)}
                officialUser={getOfficialUser(assignment.officialId)}
                originalOfficial={officials.find(
                  (o) => o.id === (assignment.originalOfficialId || null)
                )}
                onAssign={() =>
                  onAssign(match.id, assignment.id, assignment.role)
                }
                onRemove={
                  isRemovable
                    ? () => onRemoveAssignment(match.id, assignment.id)
                    : undefined
                }
                onUnassign={
                  assignment.officialId
                    ? () => onRemoveAssignment(match.id, assignment.id)
                    : undefined
                }
                // FIX: Changed prop name from onMarkAbsent to onMarkOfficialAbsent to match the component's props interface.
                onMarkOfficialAbsent={
                  onMarkOfficialAbsent
                    ? () => onMarkOfficialAbsent(match.id, assignment.id)
                    : undefined
                }
                canEdit={canAssignOfficial}
                onPrintMissionOrder={
                  assignment.officialId
                    ? () =>
                        onPrintIndividualMissionOrder(
                          match.id,
                          assignment.officialId!
                        )
                    : undefined
                }
                onSendMissionOrder={
                  assignment.officialId
                    ? () =>
                        onSendIndividualMissionOrder(
                          match.id,
                          assignment.officialId!
                        )
                    : undefined
                }
              />
            );
          })}
          {placeholderRoles.map((role) => (
            <PlaceholderAssignmentSlot
              key={role}
              role={role}
              onAdd={() => onAddAssignment(match.id, role)}
              canEdit={canAssignOfficial}
            />
          ))}
        </div>

        <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-between items-center">
          <button
            onClick={() => onSendAllMissionOrders(match.id)}
            disabled={assignedOfficialsWithEmail.length === 0}
            title={
              assignedOfficialsWithEmail.length === 0
                ? "Aucun officiel avec email assigné"
                : "Envoyer les ordres de mission à tous les officiels assignés"
            }
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5 mr-2" />
            Tout Envoyer
          </button>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchAssignmentsModal;
