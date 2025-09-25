import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Match,
  Assignment,
  Official,
  Location,
  IndemnityRates,
  AccountingStatus,
  OfficialRole,
  MatchStatus,
} from "../types";
import { useDistance } from "../hooks/useDistance";
import CloseIcon from "./icons/CloseIcon";
import AccountingOfficialSelectModal from "./AccountingOfficialSelectModal";
import PlusIcon from "./icons/PlusIcon";
import TrashIcon from "./icons/TrashIcon";
import PencilIcon from "./icons/PencilIcon";
import InformationCircleIcon from "./icons/InformationCircleIcon";

// (Removed inline haversine helpers; replaced by shared util)

// --- TYPE DEFINITIONS ---
interface EditableAssignment extends Assignment {
  rateIndemnity: number;
  distanceBonus: number;
  adjustment: number;
  originalTravelDistance: number;
}

// --- SUB-COMPONENTS ---

interface OfficialCardProps {
  assignment: EditableAssignment;
  official: Official | undefined;
  readOnly: boolean;
  onAssignmentChange: (
    assignmentId: string,
    field: "travelDistanceInKm" | "adjustment" | "notes",
    value: string | number
  ) => void;
  onSelectOfficial: () => void;
  onRemoveOfficial: () => void;
}

const OfficialCard: React.FC<OfficialCardProps> = ({
  assignment,
  official,
  readOnly,
  onAssignmentChange,
  onSelectOfficial,
  onRemoveOfficial,
}) => {
  const total = assignment.indemnityAmount || 0;
  const travelOverridden =
    assignment.travelDistanceInKm !== assignment.originalTravelDistance;
  const indemnityOverridden = assignment.adjustment !== 0;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR").format(amount);

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-white">
            {official?.fullName || (
              <span className="text-gray-500 italic">Non assigné</span>
            )}
          </p>
          <p className="text-xs text-gray-400">{assignment.role}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {official && (
              <button
                type="button"
                onClick={onRemoveOfficial}
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-full"
                title="Retirer l'officiel"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onSelectOfficial}
              className="text-xs font-semibold bg-gray-700 text-white py-1 px-3 rounded-full hover:bg-gray-600"
            >
              {official ? "Modifier" : "Désigner"}
            </button>
          </div>
        )}
      </div>

      {official && (
        <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Indemnity Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Indemnité de base:</span>
              <span className="font-mono text-gray-200">
                {formatCurrency(assignment.rateIndemnity)} DZD
              </span>
            </div>
            {assignment.distanceBonus > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">
                  Bonus distance &gt; 1000km:
                </span>
                <span className="font-mono text-green-400">
                  {formatCurrency(assignment.distanceBonus)} DZD
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <label
                htmlFor={`adjustment-${assignment.id}`}
                className="text-gray-400 flex items-center"
              >
                Ajustement (+/-):
                {indemnityOverridden && !readOnly && (
                  <PencilIcon
                    className="h-3 w-3 text-yellow-400 ml-1.5"
                    title="Valeur manuelle"
                  />
                )}
              </label>
              {readOnly ? (
                <span className="font-mono text-gray-200">
                  {formatCurrency(assignment.adjustment)} DZD
                </span>
              ) : (
                <input
                  id={`adjustment-${assignment.id}`}
                  type="number"
                  value={assignment.adjustment}
                  onChange={(e) =>
                    onAssignmentChange(
                      assignment.id,
                      "adjustment",
                      e.target.value
                    )
                  }
                  className="w-28 bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white text-right font-mono"
                />
              )}
            </div>
            <div className="flex justify-between items-center text-md font-bold border-t border-gray-600 pt-2">
              <span className="text-white">TOTAL OFFICIEL:</span>
              <span className="font-mono text-brand-primary text-lg">
                {formatCurrency(total)} DZD
              </span>
            </div>
            <div className="mt-2">
              <label
                htmlFor={`notes-${assignment.id}`}
                className="text-xs text-gray-400"
              >
                Justification de l'ajustement{" "}
                {indemnityOverridden && <span className="text-red-400">*</span>}
              </label>
              <textarea
                id={`notes-${assignment.id}`}
                value={assignment.notes || ""}
                onChange={(e) =>
                  onAssignmentChange(assignment.id, "notes", e.target.value)
                }
                disabled={readOnly}
                required={indemnityOverridden}
                rows={2}
                className="w-full mt-1 bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white text-sm disabled:opacity-60"
              />
            </div>
          </div>

          {/* Travel Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <label
                htmlFor={`distance-${assignment.id}`}
                className="text-gray-400 flex items-center"
              >
                Distance A/R (km):
                <div className="group relative flex items-center">
                  <InformationCircleIcon className="h-4 w-4 text-gray-500 ml-1.5 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    Distance aller-retour calculée automatiquement, incluant une
                    marge de 20%.
                  </div>
                </div>
                {travelOverridden && !readOnly && (
                  <PencilIcon
                    className="h-3 w-3 text-yellow-400 ml-1.5"
                    title="Valeur manuelle"
                  />
                )}
              </label>
              {readOnly ? (
                <span className="font-mono text-gray-200">
                  {assignment.travelDistanceInKm || 0}
                </span>
              ) : (
                <input
                  id={`distance-${assignment.id}`}
                  type="number"
                  value={assignment.travelDistanceInKm || ""}
                  onChange={(e) =>
                    onAssignmentChange(
                      assignment.id,
                      "travelDistanceInKm",
                      e.target.value
                    )
                  }
                  className="w-28 bg-gray-900 border border-gray-600 rounded-md py-1 px-2 text-white text-right font-mono"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
interface AccountingEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    matchId: string,
    scores: { home: number; away: number } | null,
    updatedAssignments: Assignment[]
  ) => void;
  match: Match | null;
  allMatches: Match[];
  officials: Official[];
  locations: Location[];
  indemnityRates: IndemnityRates;
  officialRoles: OfficialRole[];
  readOnly?: boolean;
}

const AccountingEntryModal: React.FC<AccountingEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match,
  allMatches,
  officials,
  locations,
  indemnityRates,
  officialRoles,
  readOnly = false,
}) => {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [editedAssignments, setEditedAssignments] = useState<
    EditableAssignment[]
  >([]);
  const [error, setError] = useState("");
  const [selectingOfficialFor, setSelectingOfficialFor] =
    useState<Assignment | null>(null);
  const [isAddRoleMenuOpen, setIsAddRoleMenuOpen] = useState(false);

  const locationMap = useMemo(() => {
    return new Map(locations.map((loc) => [loc.id, loc]));
  }, [isOpen, locations]);

  const { getRoundTripBufferedKm } = useDistance({
    supabase: null,
    enqueueMissing: true,
  });

  const calculateAssignmentDetails = useCallback(
    async (
      assignment: Assignment,
      official: Official | undefined,
      match: Match
    ): Promise<Partial<Assignment>> => {
      const newDetails: Partial<Assignment> = {};
      if (!official) return { indemnityAmount: 0, travelDistanceInKm: 0 };

      const rate =
        indemnityRates[match.leagueGroup.league.id]?.[assignment.role];
      newDetails.indemnityAmount = rate || 0;

      if (official.locationId && match.stadium?.locationId) {
        const officialLocation = locationMap.get(official.locationId);
        const stadiumLocation = locationMap.get(match.stadium.locationId);
        if (officialLocation && stadiumLocation) {
          const buffered = await getRoundTripBufferedKm(
            officialLocation,
            stadiumLocation
          );
          newDetails.travelDistanceInKm = buffered ?? 0;
        } else {
          newDetails.travelDistanceInKm = 0;
        }
      } else {
        newDetails.travelDistanceInKm = 0;
      }
      return newDetails;
    },
    [indemnityRates, locationMap, getRoundTripBufferedKm]
  );

  useEffect(() => {
    if (isOpen && match) {
      setHomeScore(match.homeScore?.toString() ?? "");
      setAwayScore(match.awayScore?.toString() ?? "");

      (async () => {
        const prefilled: EditableAssignment[] = [];
        for (const assignment of match.assignments) {
          const official = officials.find(
            (o) => o.id === assignment.officialId
          );
          const rateIndemnity = official
            ? indemnityRates[match.leagueGroup.league.id]?.[assignment.role] ??
              0
            : 0;
          const freshCalculatedDistance = readOnly
            ? assignment.travelDistanceInKm ?? 0
            : (await calculateAssignmentDetails(assignment, official, match))
                .travelDistanceInKm ?? 0;
          let travelDistanceInKm: number = freshCalculatedDistance;
          if (readOnly) {
            travelDistanceInKm =
              assignment.travelDistanceInKm ?? travelDistanceInKm;
          }
          const distanceBonus = travelDistanceInKm > 1000 ? 10000 : 0;
          const baseIndemnityWithBonus = rateIndemnity + distanceBonus;
          let adjustment: number;
          let finalIndemnityAmount: number;
          if (readOnly) {
            finalIndemnityAmount =
              assignment.indemnityAmount ?? baseIndemnityWithBonus;
            adjustment = finalIndemnityAmount - baseIndemnityWithBonus;
          } else {
            const oldAdjustment =
              (assignment.indemnityAmount ?? rateIndemnity) - rateIndemnity;
            if (match.accountingStatus === AccountingStatus.NOT_ENTERED) {
              adjustment = 0;
              finalIndemnityAmount = baseIndemnityWithBonus;
            } else {
              adjustment = oldAdjustment;
              finalIndemnityAmount = baseIndemnityWithBonus + adjustment;
            }
          }
          prefilled.push({
            ...assignment,
            travelDistanceInKm,
            indemnityAmount: finalIndemnityAmount,
            notes: assignment.notes || "",
            rateIndemnity: rateIndemnity,
            distanceBonus: distanceBonus,
            adjustment: adjustment,
            originalTravelDistance: freshCalculatedDistance,
          } as EditableAssignment);
        }
        setEditedAssignments(prefilled);
      })();
      setError("");
    }
  }, [
    isOpen,
    match,
    officials,
    indemnityRates,
    readOnly,
    calculateAssignmentDetails,
  ]);

  const handleAssignmentChange = (
    assignmentId: string,
    field: "travelDistanceInKm" | "adjustment" | "notes",
    value: string | number
  ) => {
    setEditedAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          const updatedAssignment = { ...a };
          if (field === "travelDistanceInKm") {
            const newDistance = Number(value) || 0;
            updatedAssignment.travelDistanceInKm = newDistance;
            updatedAssignment.distanceBonus = newDistance > 1000 ? 10000 : 0;
          } else if (field === "adjustment") {
            updatedAssignment.adjustment = Number(value) || 0;
          } else if (field === "notes") {
            updatedAssignment.notes = String(value);
          }
          updatedAssignment.indemnityAmount =
            updatedAssignment.rateIndemnity +
            updatedAssignment.distanceBonus +
            updatedAssignment.adjustment;
          return updatedAssignment;
        }
        return a;
      })
    );
  };

  const handleRemoveOfficial = (assignmentId: string) => {
    setEditedAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            officialId: null,
            indemnityAmount: 0,
            travelDistanceInKm: 0,
            adjustment: 0,
            rateIndemnity: 0,
            distanceBonus: 0,
            originalTravelDistance: 0,
          };
        }
        return a;
      })
    );
  };

  const handleOfficialSelect = async (officialId: string) => {
    if (!selectingOfficialFor || !match) return;

    const official = officials.find((o) => o.id === officialId);
    const calculatedDetails = await calculateAssignmentDetails(
      selectingOfficialFor,
      official,
      match
    );

    setEditedAssignments((prev) =>
      prev.map((a) => {
        if (a.id === selectingOfficialFor.id) {
          const rateIndemnity = official
            ? indemnityRates[match.leagueGroup.league.id]?.[a.role] ?? 0
            : 0;
          const originalTravelDistance =
            calculatedDetails.travelDistanceInKm ?? 0;
          const distanceBonus = originalTravelDistance > 1000 ? 10000 : 0;

          return {
            ...a,
            officialId,
            indemnityAmount: rateIndemnity + distanceBonus,
            travelDistanceInKm: originalTravelDistance,
            rateIndemnity,
            distanceBonus,
            adjustment: 0,
            originalTravelDistance,
            notes: "",
          };
        }
        return a;
      })
    );

    setSelectingOfficialFor(null);
  };

  const handleAddAssignment = (role: OfficialRole) => {
    if (!match) return;

    const newAssignment: EditableAssignment = {
      id: crypto.randomUUID(),
      matchId: match.id,
      role,
      officialId: null,
      isConfirmed: false,
      confirmedAt: null,
      travelDistanceInKm: 0,
      indemnityAmount: 0,
      notes: null,
      isNew: true,
      rateIndemnity: 0,
      distanceBonus: 0,
      adjustment: 0,
      originalTravelDistance: 0,
    };

    setEditedAssignments((prev) => [...prev, newAssignment]);
    setIsAddRoleMenuOpen(false);
  };

  const needsScore = useMemo(
    () =>
      match?.status === MatchStatus.SCHEDULED ||
      match?.status === MatchStatus.COMPLETED,
    [match]
  );

  const handleSave = () => {
    if (!match) return;

    let scores: { home: number; away: number } | null = null;

    if (needsScore) {
      const home = parseInt(homeScore, 10);
      const away = parseInt(awayScore, 10);
      if (
        homeScore === "" ||
        awayScore === "" ||
        isNaN(home) ||
        isNaN(away) ||
        home < 0 ||
        away < 0
      ) {
        setError("Les scores doivent être des nombres positifs.");
        return;
      }
      scores = { home, away };
    }

    const missingJustification = editedAssignments.some(
      (a) => a.adjustment !== 0 && (!a.notes || a.notes.trim() === "")
    );
    if (missingJustification) {
      setError(
        "Une justification est requise pour tout ajustement d'indemnité non nul."
      );
      return;
    }

    const assignmentsToSave: Assignment[] = editedAssignments.map(
      ({
        rateIndemnity,
        distanceBonus,
        adjustment,
        originalTravelDistance,
        ...rest
      }) => rest
    );

    onSave(match.id, scores, assignmentsToSave);
    onClose();
  };

  const availableOfficialsForSelection = useMemo(() => {
    if (!match) return [];
    const assignedIds = new Set(
      editedAssignments.map((a) => a.officialId).filter(Boolean)
    );
    return officials.filter(
      (o) => o.isActive && !o.isArchived && !assignedIds.has(o.id)
    );
  }, [officials, editedAssignments, match]);

  if (!isOpen || !match) return null;

  const modalTitle = readOnly ? "Détails Comptables" : "Saisie Comptable";
  const totalMatchAmount = editedAssignments.reduce(
    (sum, a) => sum + (a.indemnityAmount || 0),
    0
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl transform transition-all duration-300">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">{modalTitle}</h2>
              <p className="text-sm text-gray-400">
                {match.homeTeam.name} vs {match.awayTeam.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">
                {error}
              </p>
            )}

            {needsScore && (
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Score du match
                </h3>
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {match.homeTeam.name}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      disabled={readOnly}
                      className="w-24 text-center text-2xl font-bold bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white disabled:opacity-50 disabled:bg-gray-700"
                    />
                  </div>
                  <span className="text-2xl text-gray-400 mt-6">-</span>
                  <div className="text-center">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {match.awayTeam.name}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      disabled={readOnly}
                      className="w-24 text-center text-2xl font-bold bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white disabled:opacity-50 disabled:bg-gray-700"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-900/50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-white">
                  Désignations & Indemnités
                </h3>
                <span className="font-bold text-xl text-brand-primary">
                  {new Intl.NumberFormat("fr-FR").format(totalMatchAmount)} DZD
                </span>
              </div>
              <div className="space-y-4">
                {editedAssignments.map((a) => (
                  <OfficialCard
                    key={a.id}
                    assignment={a}
                    official={officials.find((o) => o.id === a.officialId)}
                    readOnly={readOnly}
                    onAssignmentChange={handleAssignmentChange}
                    onSelectOfficial={() => setSelectingOfficialFor(a)}
                    onRemoveOfficial={() => handleRemoveOfficial(a.id)}
                  />
                ))}
              </div>
              {!readOnly && (
                <div className="mt-4 text-right">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setIsAddRoleMenuOpen((prev) => !prev)}
                      onBlur={() =>
                        setTimeout(() => setIsAddRoleMenuOpen(false), 200)
                      }
                      className="text-sm flex items-center text-brand-primary hover:text-brand-secondary font-semibold py-1 px-2 rounded-md hover:bg-brand-primary/10 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Ajouter une ligne
                    </button>
                    {isAddRoleMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-2 w-56 bg-gray-700 rounded-md shadow-lg z-20">
                        <div className="py-1">
                          {officialRoles.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => handleAddAssignment(role)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600"
                            >
                              Ajouter: {role}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            {readOnly ? (
              <button
                onClick={onClose}
                className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg"
              >
                Fermer
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg"
                >
                  Soumettre pour Validation
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AccountingOfficialSelectModal
        isOpen={!!selectingOfficialFor}
        onClose={() => setSelectingOfficialFor(null)}
        onSelect={handleOfficialSelect}
        availableOfficials={availableOfficialsForSelection}
        matchDate={match.matchDate}
        allMatches={allMatches}
        locations={locations}
      />
    </>
  );
};

export default AccountingEntryModal;
