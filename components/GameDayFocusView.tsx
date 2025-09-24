import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Match,
  Official,
  Assignment,
  OfficialRole,
  MatchStatus,
  AccountingStatus,
  Location,
} from "../types";
import { Permissions } from "../hooks/usePermissions";
import SearchIcon from "./icons/SearchIcon";
import ArrowLeftIcon from "./icons/ArrowLeftIcon";
import WhistleIcon from "./icons/WhistleIcon";
import UsersIcon from "./icons/UsersIcon";
import PlusIcon from "./icons/PlusIcon";
import CloseIcon from "./icons/CloseIcon";
import EnvelopeIcon from "./icons/EnvelopeIcon";
import QuickEmailModal from "./QuickEmailModal";
import PaperAirplaneIcon from "./icons/PaperAirplaneIcon";
import PrinterIcon from "./icons/PrinterIcon";
import {
  generateBulkMissionOrdersPDF,
  downloadBlob,
} from "../services/pdfService";
import AlertModal from "./AlertModal";
import DownloadIcon from "./icons/DownloadIcon";
import { exportGameDaySummaryToExcel } from "../services/exportService";
import LocationPinIcon from "./icons/LocationPinIcon";

// --- UTILS & HOOKS ---

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function getDistanceFromLatLonInKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// --- Interfaces ---
interface GameDayFocusViewProps {
  matches: Match[];
  officials: Official[];
  officialRoles: OfficialRole[];
  locations: Location[];
  onUpdateAssignment: (
    matchId: string,
    assignmentId: string,
    officialId: string | null
  ) => void;
  onAddAssignment: (matchId: string, role: OfficialRole) => Promise<void>;
  onGoBack: () => void;
  permissions: Permissions;
  title?: string;
  onUpdateOfficialEmail: (officialId: string, email: string) => void;
  onSendMatchSheet: (matchId: string) => Promise<void>;
  onOpenStadiumModal: (match: Match) => void;
}

interface DraggableOfficialCardProps {
  official: Official;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, official: Official) => void;
  onDragEnd: () => void;
  style: React.CSSProperties;
  locationString: string;
}

interface AssignmentSlotProps {
  assignment: Partial<Assignment> & { role: OfficialRole };
  official: Official | undefined;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onRemove?: () => void;
  canEdit: boolean;
  onMissingEmailClick?: () => void;
  isDragOver: boolean;
  travelDistancePreview?: number | null;
  "data-match-id": string;
  "data-assignment-id"?: string;
  "data-role": string;
}

// --- Memoized Sub-components ---

const DraggableOfficialCard = React.memo<DraggableOfficialCardProps>(
  ({ official, onDragStart, onDragEnd, style, locationString }) => {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, official)}
        onDragEnd={onDragEnd}
        style={style}
        className="bg-gray-700 p-3 rounded-lg flex items-center cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors h-[56px] box-border"
      >
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white text-sm">
          {official.firstName.charAt(0)}
          {official.lastName.charAt(0)}
        </div>
        <div className="ml-3 min-w-0">
          <p className="font-semibold text-white truncate official-name">
            {official.fullName}
          </p>
          <p className="text-xs text-gray-400 truncate official-details">
            {official.category} - {locationString}
          </p>
        </div>
      </div>
    );
  }
);

const AssignmentSlot = React.memo<AssignmentSlotProps>(
  ({
    assignment,
    official,
    onDrop,
    onDragOver,
    onDragLeave,
    onRemove,
    canEdit,
    onMissingEmailClick,
    isDragOver,
    travelDistancePreview,
    ...dataProps
  }) => {
    const isDelegate = assignment.role.toLowerCase().includes("délégué");
    const Icon = isDelegate ? UsersIcon : WhistleIcon;
    const isMissingEmail =
      official && (!official.email || official.email.trim() === "");

    return (
      <div
        onDrop={canEdit ? onDrop : undefined}
        onDragOver={canEdit ? onDragOver : undefined}
        onDragLeave={canEdit ? onDragLeave : undefined}
        {...dataProps}
        className={`flex items-center justify-between p-3 bg-gray-900/50 rounded-lg min-h-[72px] border-2 border-dashed transition-colors ${
          canEdit ? "" : "cursor-not-allowed"
        } ${
          isDragOver
            ? "bg-brand-primary/20 border-brand-primary"
            : "border-transparent"
        }`}
      >
        <div className="flex items-center">
          <Icon
            className={`h-5 w-5 mr-3 flex-shrink-0 ${
              isDelegate ? "text-blue-400" : "text-yellow-400"
            }`}
          />
          <div>
            <p className="text-sm font-semibold text-gray-300">
              {assignment.role}
            </p>
            {official ? (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-md text-white">{official.fullName}</p>
                  {isMissingEmail && canEdit && (
                    <button
                      onClick={onMissingEmailClick}
                      className="group relative"
                      title="Email manquant. Cliquez pour ajouter."
                    >
                      <EnvelopeIcon className="h-4 w-4 text-yellow-400" />
                      <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"></div>
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
              <p className="text-sm text-gray-400 italic">
                {isDragOver && travelDistancePreview != null
                  ? `Assigner (~${travelDistancePreview} km A/R)`
                  : "Glisser un officiel ici"}
              </p>
            )}
          </div>
        </div>
        {official && canEdit && onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-500 hover:text-red-400"
            title="Retirer l'officiel"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

const VIRTUAL_ITEM_HEIGHT = 60; // 56px height + 4px gap

const VirtualizedOfficialsList: React.FC<{
  officials: Official[];
  onDragStart: (e: React.DragEvent<HTMLDivElement>, official: Official) => void;
  onDragEnd: () => void;
  formatLocation: (locationId: string | null) => string;
}> = ({ officials, onDragStart, onDragEnd, formatLocation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use ResizeObserver to handle container resizes
    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(container.clientHeight);
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight); // Set initial height

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const totalHeight = officials.length * VIRTUAL_ITEM_HEIGHT;

  const startIndex = Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT);
  const endIndex = Math.min(
    officials.length - 1,
    Math.floor((scrollTop + containerHeight) / VIRTUAL_ITEM_HEIGHT) + 1
  );

  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (officials[i]) {
        items.push(
          <DraggableOfficialCard
            key={officials[i].id}
            official={officials[i]}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            locationString={formatLocation(officials[i].locationId)}
            style={{
              position: "absolute",
              top: `${i * VIRTUAL_ITEM_HEIGHT}px`,
              height: `${VIRTUAL_ITEM_HEIGHT - 4}px`, // 4px for gap
              width: "100%",
            }}
          />
        );
      }
    }
    return items;
  }, [startIndex, endIndex, officials, onDragStart, onDragEnd, formatLocation]);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="overflow-y-auto flex-grow relative"
      style={{ maxHeight: "calc(100vh - 30rem)", height: "100%" }}
    >
      <div style={{ height: `${totalHeight}px`, position: "relative" }}>
        {visibleItems}
      </div>
    </div>
  );
};

// --- Main Component ---
export const GameDayFocusView: React.FC<GameDayFocusViewProps> = ({
  matches,
  officials,
  officialRoles,
  locations,
  onUpdateAssignment,
  onAddAssignment,
  onGoBack,
  permissions,
  title,
  onUpdateOfficialEmail,
  onSendMatchSheet,
  onOpenStadiumModal,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [draggingOfficialId, setDraggingOfficialId] = useState<string | null>(
    null
  );
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [hoveredDistance, setHoveredDistance] = useState<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const distanceCache = useRef<Map<string, number | null>>(new Map());
  const [pendingDrop, setPendingDrop] = useState<{
    matchId: string;
    role: OfficialRole;
    officialId: string;
  } | null>(null);
  const [emailModalOfficial, setEmailModalOfficial] = useState<Official | null>(
    null
  );
  const [sendingMatchIds, setSendingMatchIds] = useState<Set<string>>(
    new Set()
  );
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingScope, setPrintingScope] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [addingSlot, setAddingSlot] = useState<{
    matchId: string;
    role: OfficialRole;
  } | null>(null);

  useEffect(() => {
    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    ghost.style.pointerEvents = "none";
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;

    return () => {
      if (dragGhostRef.current) {
        document.body.removeChild(dragGhostRef.current);
      }
    };
  }, []);

  const locationIdMap = useMemo(
    () => new Map(locations.map((loc) => [loc.id, loc])),
    [locations]
  );

  const formatLocation = useCallback(
    (locationId: string | null): string => {
      if (!locationId) return "N/A";
      const location = locationIdMap.get(locationId);
      if (!location) return "Inconnue";
      if (location.wilaya_ar && location.commune_ar) {
        return `${location.wilaya_ar} - ${location.commune_ar}`;
      }
      return [location.wilaya, location.daira, location.commune]
        .filter(Boolean)
        .join(" / ");
    },
    [locationIdMap]
  );

  const officialsById = useMemo(
    () => new Map(officials.map((o) => [o.id, o])),
    [officials]
  );

  const assignedOfficialIds = useMemo(
    () =>
      new Set(
        matches
          .flatMap((m) => m.assignments)
          .map((a) => a.officialId)
          .filter(Boolean)
      ),
    [matches]
  );

  const availableOfficials = useMemo(() => {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const searchKeywords = normalize(debouncedSearchTerm)
      .split(" ")
      .filter(Boolean);

    const filtered = officials
      .filter(
        (o) => o.isActive && !o.isArchived && !assignedOfficialIds.has(o.id)
      )
      .filter((o) => {
        if (searchKeywords.length === 0) return true;
        const searchableText = [
          normalize(o.fullName),
          normalize(o.category),
          normalize(formatLocation(o.locationId)),
        ].join(" ");
        return searchKeywords.every((keyword) =>
          searchableText.includes(keyword)
        );
      });

    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [officials, assignedOfficialIds, debouncedSearchTerm, formatLocation]);

  const headerInfo = useMemo(() => {
    if (title)
      return { main: title, sub: `${matches.length} match(s) trouvé(s)` };
    if (matches.length > 0) {
      const match = matches[0];
      return {
        main: `${match.leagueGroup.league.name} - ${match.leagueGroup.name}`,
        sub: `Journée ${match.gameDay}`,
      };
    }
    return { main: "Focus Journée", sub: "Aucun match" };
  }, [matches, title]);

  const eligibleForSendingMatches = useMemo(
    () =>
      matches.filter((match) => {
        const isMatchLockedForAccounting =
          match.accountingStatus === AccountingStatus.VALIDATED ||
          match.accountingStatus === AccountingStatus.CLOSED;
        const isMatchStateEditable =
          match.status === MatchStatus.SCHEDULED && !isMatchLockedForAccounting;
        if (
          !isMatchStateEditable ||
          !match.assignments.some((a) => a.officialId)
        )
          return false;
        const hasAtLeastOneEmail = match.assignments.some((a) => {
          if (!a.officialId) return false;
          const official = officialsById.get(a.officialId);
          return official && official.email && official.email.trim() !== "";
        });
        if (!hasAtLeastOneEmail) return false;
        return !!(match.stadium && match.stadium.locationId);
      }),
    [matches, officialsById]
  );

  const eligibleMatchIds = useMemo(
    () => eligibleForSendingMatches.map((m) => m.id),
    [eligibleForSendingMatches]
  );

  const groupedMatches = useMemo(
    () =>
      matches.reduce((acc, match) => {
        const groupId = match.leagueGroup.id;
        if (!acc[groupId]) {
          acc[groupId] = {
            leagueName: match.leagueGroup.league.name,
            groupName: match.leagueGroup.name,
            matches: [],
          };
        }
        acc[groupId].matches.push(match);
        return acc;
      }, {} as Record<string, { leagueName: string; groupName: string; matches: Match[] }>),
    [matches]
  );

  const sortedGroupIds = useMemo(
    () =>
      Object.keys(groupedMatches).sort((a, b) => {
        const groupA = groupedMatches[a];
        const groupB = groupedMatches[b];
        const leagueCompare = groupA.leagueName.localeCompare(
          groupB.leagueName
        );
        if (leagueCompare !== 0) return leagueCompare;
        return groupA.groupName.localeCompare(groupB.groupName);
      }),
    [groupedMatches]
  );

  useEffect(() => {
    if (pendingDrop) {
      const { matchId, role, officialId } = pendingDrop;
      const match = matches.find((m) => m.id === matchId);
      const newAssignment = match?.assignments.find(
        (a) => a.role === role && a.officialId === null
      );
      if (newAssignment) {
        onUpdateAssignment(matchId, newAssignment.id, officialId);
        setPendingDrop(null);
      }
    }
  }, [matches, pendingDrop, onUpdateAssignment]);

  const handlePrintOrders = useCallback(
    async (scope: "all" | string) => {
      setIsPrinting(true);
      setPrintingScope(scope);
      let ordersToGenerate: { matchId: string; officialId: string }[] = [];
      let fileName = "Ordres_de_Mission.pdf";

      if (scope === "all") {
        fileName = `Ordres_de_Mission_${headerInfo.sub.replace(
          /\s/g,
          "_"
        )}.pdf`;
        matches.forEach((match) =>
          match.assignments.forEach((a) => {
            if (a.officialId)
              ordersToGenerate.push({
                matchId: match.id,
                officialId: a.officialId,
              });
          })
        );
      } else {
        const match = matches.find((m) => m.id === scope);
        if (match) {
          fileName = `Ordres_de_Mission_${match.homeTeam.name}_vs_${match.awayTeam.name}.pdf`;
          match.assignments.forEach((a) => {
            if (a.officialId)
              ordersToGenerate.push({
                matchId: match.id,
                officialId: a.officialId,
              });
          });
        }
      }
      if (ordersToGenerate.length === 0) {
        setAlertInfo({
          title: "Aucun Ordre à Générer",
          message: "Aucun officiel n'est assigné pour la sélection choisie.",
        });
      } else {
        try {
          const pdfBlob = await generateBulkMissionOrdersPDF(ordersToGenerate);
          if (pdfBlob) downloadBlob(pdfBlob, fileName);
          else throw new Error("Le fichier PDF généré est vide.");
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Une erreur inconnue est survenue.";
          setAlertInfo({
            title: "Erreur de Génération",
            message: `Impossible de générer le PDF. Détails: ${errorMessage}`,
          });
        }
      }
      setIsPrinting(false);
      setPrintingScope(null);
    },
    [matches, headerInfo.sub]
  );

  const handleExportSummary = useCallback(() => {
    setIsExporting(true);
    exportGameDaySummaryToExcel(matches, officials)
      .then((result) => {
        if (!result.success)
          setAlertInfo({
            title: "Exportation Impossible",
            message: result.error!,
          });
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Une erreur inconnue est survenue.";
        setAlertInfo({
          title: "Erreur d'Exportation",
          message: `Impossible de générer le fichier Excel. Détails: ${errorMessage}`,
        });
      })
      .finally(() => setIsExporting(false));
  }, [matches, officials]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, official: Official) => {
      e.dataTransfer.setData("officialId", official.id);
      setDraggingOfficialId(official.id);

      if (dragGhostRef.current) {
        const ghost = dragGhostRef.current;
        ghost.innerHTML = e.currentTarget.innerHTML;
        ghost.style.width = `${e.currentTarget.offsetWidth}px`;
        ghost.className =
          "bg-brand-primary p-3 rounded-lg flex items-center shadow-lg text-white";
        ghost.style.transform = "rotate(-3deg)";
        ghost.style.opacity = "0.95";
        e.dataTransfer.setDragImage(
          ghost,
          e.currentTarget.offsetWidth / 2,
          e.currentTarget.offsetHeight / 2
        );
      }
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingOfficialId(null);
    distanceCache.current.clear();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverSlot(null);
      setHoveredDistance(null);
      const officialId = e.dataTransfer.getData("officialId");
      const { matchId, assignmentId, role } = e.currentTarget.dataset;
      if (officialId && matchId && role) {
        if (assignmentId) {
          onUpdateAssignment(matchId, assignmentId, officialId);
        } else {
          setPendingDrop({ matchId, role, officialId });
          onAddAssignment(matchId, role);
        }
      }
    },
    [onUpdateAssignment, onAddAssignment]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!draggingOfficialId) return;

      const { matchId, assignmentId, role } = e.currentTarget.dataset;
      if (!matchId || !role) return;

      const slotKey = `${matchId}-${assignmentId || role}`;

      if (slotKey !== dragOverSlot) {
        setDragOverSlot(slotKey);

        let distance: number | null = null;
        const cacheKey = `${draggingOfficialId}-${matchId}`;

        if (distanceCache.current.has(cacheKey)) {
          distance = distanceCache.current.get(cacheKey)!;
        } else {
          const match = matches.find((m) => m.id === matchId);
          const official = officialsById.get(draggingOfficialId);

          if (match?.stadium?.locationId && official?.locationId) {
            const stadiumLocation = locationIdMap.get(match.stadium.locationId);
            const officialLocation = locationIdMap.get(official.locationId);
            if (stadiumLocation && officialLocation) {
              const calculated = getDistanceFromLatLonInKm(
                officialLocation.latitude,
                officialLocation.longitude,
                stadiumLocation.latitude,
                stadiumLocation.longitude
              );
              distance =
                calculated != null ? Math.round(calculated * 2 * 1.2) : null;
            }
          }
          distanceCache.current.set(cacheKey, distance);
        }
        setHoveredDistance(distance);
      }
    },
    [draggingOfficialId, dragOverSlot, matches, officialsById, locationIdMap]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
    setHoveredDistance(null);
  }, []);

  const handleSendSheet = useCallback(
    async (matchId: string) => {
      setSendingMatchIds((prev) => new Set(prev).add(matchId));
      try {
        await onSendMatchSheet(matchId);
      } finally {
        setSendingMatchIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(matchId);
          return newSet;
        });
      }
    },
    [onSendMatchSheet]
  );

  const handleBulkSend = useCallback(async () => {
    setIsBulkSending(true);
    setSendingMatchIds((prev) => new Set([...prev, ...eligibleMatchIds]));
    try {
      await Promise.all(eligibleMatchIds.map((id) => onSendMatchSheet(id)));
    } finally {
      setIsBulkSending(false);
      setSendingMatchIds((prev) => {
        const newSet = new Set(prev);
        eligibleMatchIds.forEach((id) => newSet.delete(id));
        return newSet;
      });
    }
  }, [eligibleMatchIds, onSendMatchSheet]);

  const handleAddSlot = useCallback(
    async (matchId: string, role: OfficialRole) => {
      if (addingSlot) return; // Prevent concurrent adds
      setAddingSlot({ matchId, role });
      try {
        await onAddAssignment(matchId, role);
      } catch (e) {
        console.error("Failed to add slot", e);
        setAddingSlot(null);
      }
      // No need to reset state on success. Component re-renders.
    },
    [onAddAssignment, addingSlot]
  );

  const canEdit = permissions.can("assign", "official");

  if (matches.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-400">Aucun match trouvé pour cette journée.</p>
        <button
          onClick={onGoBack}
          className="mt-4 text-brand-primary hover:text-brand-secondary"
        >
          &larr; Retour au tableau de bord
        </button>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="sticky top-16 bg-gray-900 z-20 py-4 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onGoBack}
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              >
                <ArrowLeftIcon className="h-6 w-6 text-white" />
              </button>
              <div>
                <h2 className="text-3xl font-bold text-white">
                  {headerInfo.main}
                </h2>
                <p className="text-lg text-brand-primary font-semibold">
                  {headerInfo.sub}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportSummary}
                disabled={isExporting}
                className="inline-flex items-center justify-center bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      opacity="0.25"
                    ></circle>
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      opacity="0.75"
                    ></path>
                  </svg>
                ) : (
                  <DownloadIcon className="h-5 w-5 mr-2" />
                )}
                {isExporting ? "Exportation..." : "Exporter Résumé"}
              </button>
              <button
                onClick={() => handlePrintOrders("all")}
                disabled={isPrinting}
                className="inline-flex items-center justify-center bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                {isPrinting && printingScope === "all" ? (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      opacity="0.25"
                    ></circle>
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      opacity="0.75"
                    ></path>
                  </svg>
                ) : (
                  <PrinterIcon className="h-5 w-5 mr-2" />
                )}
                {isPrinting && printingScope === "all"
                  ? "Génération..."
                  : "Imprimer Ordres"}
              </button>
              {permissions.can("send", "match_sheet") && (
                <button
                  onClick={handleBulkSend}
                  disabled={eligibleMatchIds.length === 0 || isBulkSending}
                  className="inline-flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isBulkSending ? (
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        opacity="0.25"
                      ></circle>
                      <path
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        opacity="0.75"
                      ></path>
                    </svg>
                  ) : (
                    <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                  )}
                  {isBulkSending
                    ? "Envoi..."
                    : `Envoyer ${eligibleMatchIds.length} Feuilles`}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <aside className="lg:col-span-1 bg-gray-800 p-4 rounded-lg flex flex-col sticky top-40">
            <h3 className="text-xl font-bold text-white mb-4">
              Officiels Disponibles
            </h3>
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un officiel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-3 text-white"
              />
            </div>
            {availableOfficials.length > 0 ? (
              <VirtualizedOfficialsList
                officials={availableOfficials}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                formatLocation={formatLocation}
              />
            ) : (
              <p className="text-center text-gray-400 p-4">
                Aucun officiel disponible.
              </p>
            )}
          </aside>
          <section className="lg:col-span-2 space-y-8">
            {sortedGroupIds.map((groupId) => {
              const groupData = groupedMatches[groupId];
              return (
                <div key={groupId}>
                  <h3 className="text-xl font-bold text-white mb-4">
                    {groupData.leagueName} - {groupData.groupName}
                  </h3>
                  <div className="space-y-6">
                    {groupData.matches
                      .sort((a, b) =>
                        a.matchDate && b.matchDate
                          ? `${a.matchDate}${a.matchTime}`.localeCompare(
                              `${b.matchDate}${b.matchTime}`
                            )
                          : 0
                      )
                      .map((match) => {
                        const isMatchLockedForAccounting =
                          match.accountingStatus ===
                            AccountingStatus.VALIDATED ||
                          match.accountingStatus === AccountingStatus.CLOSED;
                        const isMatchStateEditable =
                          match.status === MatchStatus.SCHEDULED &&
                          !isMatchLockedForAccounting;

                        const assignmentsCopy = [...match.assignments];
                        const matchedAssignmentIds = new Set<string>();

                        const allSlots = officialRoles.map((role) => {
                          const matchingAssignment = assignmentsCopy.find(
                            (a) =>
                              a.role === role && !matchedAssignmentIds.has(a.id)
                          );
                          if (matchingAssignment) {
                            matchedAssignmentIds.add(matchingAssignment.id);
                            return matchingAssignment;
                          }
                          return { role }; // Placeholder
                        });

                        assignmentsCopy.forEach((assignment) => {
                          if (!matchedAssignmentIds.has(assignment.id)) {
                            allSlots.push(assignment);
                          }
                        });

                        const refereeSlots = allSlots.filter(
                          (s) => !s.role.toLowerCase().includes("délégué")
                        );
                        const delegateSlots = allSlots.filter((s) =>
                          s.role.toLowerCase().includes("délégué")
                        );

                        const hasAtLeastOneEmail = match.assignments.some(
                          (a) => {
                            if (!a.officialId) return false;
                            const official = officialsById.get(a.officialId);
                            return !!official?.email?.trim();
                          }
                        );
                        const isStadiumLocationValid =
                          !!match.stadium?.locationId;
                        const canSendSheet =
                          isMatchStateEditable &&
                          hasAtLeastOneEmail &&
                          match.assignments.some((a) => a.officialId) &&
                          isStadiumLocationValid;
                        const isSending = sendingMatchIds.has(match.id);
                        const sendButtonText = match.isSheetSent
                          ? "Renvoyer"
                          : "Envoyer";

                        const isComplete =
                          match.assignments.length > 0 &&
                          match.assignments.every((a) => !!a.officialId);
                        const hasChanges = match.hasUnsentChanges;

                        const cardBorderColor = hasChanges
                          ? "border-yellow-500"
                          : isComplete
                          ? "border-green-500"
                          : "border-gray-700/50";

                        return (
                          <div
                            key={match.id}
                            className={`bg-gray-800 p-4 rounded-lg border-2 ${cardBorderColor}`}
                          >
                            <div className="flex justify-between items-start border-b border-gray-700 pb-3 mb-3">
                              <div>
                                <p className="font-semibold text-white">
                                  {match.homeTeam.name} vs {match.awayTeam.name}
                                </p>
                                <p className="text-sm text-gray-400">
                                  {match.matchDate
                                    ? new Date(
                                        match.matchDate + "T00:00:00"
                                      ).toLocaleDateString("fr-FR")
                                    : "Date TBC"}{" "}
                                  @ {match.matchTime || "Heure TBC"}
                                </p>
                                <button
                                  onClick={() =>
                                    isMatchStateEditable &&
                                    onOpenStadiumModal(match)
                                  }
                                  disabled={!isMatchStateEditable}
                                  className={`flex items-center text-sm mt-1 ${
                                    isMatchStateEditable
                                      ? "text-gray-400 hover:text-brand-primary"
                                      : "text-gray-500 cursor-not-allowed"
                                  }`}
                                  title={
                                    isMatchStateEditable
                                      ? "Changer le stade"
                                      : "Le stade ne peut être modifié que si le match est 'Prévu' et non verrouillé."
                                  }
                                >
                                  <LocationPinIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                  <span>
                                    {match.stadium?.name || (
                                      <span className="italic">
                                        Stade non défini
                                      </span>
                                    )}
                                    {match.stadium?.locationId &&
                                      `, ${formatLocation(
                                        match.stadium.locationId
                                      )}`}
                                  </span>
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6">
                              <div className="flex-1 space-y-3">
                                <h4 className="text-md font-semibold text-gray-300 border-b border-gray-700 pb-2">
                                  Arbitres
                                </h4>
                                {refereeSlots.map((slot) => {
                                  const assignment =
                                    "id" in slot
                                      ? (slot as Assignment)
                                      : undefined;
                                  const slotKey = `${match.id}-${
                                    assignment?.id || slot.role
                                  }`;
                                  const isDragOver = dragOverSlot === slotKey;
                                  return (
                                    <AssignmentSlot
                                      key={slotKey}
                                      assignment={slot}
                                      official={
                                        assignment
                                          ? officialsById.get(
                                              assignment.officialId!
                                            )
                                          : undefined
                                      }
                                      onDrop={handleDrop}
                                      onDragOver={handleDragOver}
                                      onDragLeave={handleDragLeave}
                                      onRemove={
                                        assignment?.officialId
                                          ? () =>
                                              onUpdateAssignment(
                                                match.id,
                                                assignment.id!,
                                                null
                                              )
                                          : undefined
                                      }
                                      canEdit={canEdit && isMatchStateEditable}
                                      onMissingEmailClick={() =>
                                        setEmailModalOfficial(
                                          officialsById.get(
                                            assignment?.officialId!
                                          ) || null
                                        )
                                      }
                                      isDragOver={isDragOver}
                                      travelDistancePreview={
                                        isDragOver ? hoveredDistance : null
                                      }
                                      data-match-id={match.id}
                                      data-assignment-id={assignment?.id}
                                      data-role={slot.role}
                                    />
                                  );
                                })}
                              </div>
                              <div className="flex-1 space-y-3">
                                <h4 className="text-md font-semibold text-gray-300 border-b border-gray-700 pb-2">
                                  Délégués
                                </h4>
                                {delegateSlots.map((slot) => {
                                  const assignment =
                                    "id" in slot
                                      ? (slot as Assignment)
                                      : undefined;
                                  const slotKey = `${match.id}-${
                                    assignment?.id || slot.role
                                  }`;
                                  const isDragOver = dragOverSlot === slotKey;
                                  return (
                                    <AssignmentSlot
                                      key={slotKey}
                                      assignment={slot}
                                      official={
                                        assignment
                                          ? officialsById.get(
                                              assignment.officialId!
                                            )
                                          : undefined
                                      }
                                      onDrop={handleDrop}
                                      onDragOver={handleDragOver}
                                      onDragLeave={handleDragLeave}
                                      onRemove={
                                        assignment?.officialId
                                          ? () =>
                                              onUpdateAssignment(
                                                match.id,
                                                assignment.id!,
                                                null
                                              )
                                          : undefined
                                      }
                                      canEdit={canEdit && isMatchStateEditable}
                                      onMissingEmailClick={() =>
                                        setEmailModalOfficial(
                                          officialsById.get(
                                            assignment?.officialId!
                                          ) || null
                                        )
                                      }
                                      isDragOver={isDragOver}
                                      travelDistancePreview={
                                        isDragOver ? hoveredDistance : null
                                      }
                                      data-match-id={match.id}
                                      data-assignment-id={assignment?.id}
                                      data-role={slot.role}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            {permissions.can("send", "match_sheet") && (
                              <div className="mt-4 border-t border-gray-700 pt-3 flex justify-end gap-2">
                                <button
                                  onClick={() => handlePrintOrders(match.id)}
                                  disabled={
                                    isPrinting ||
                                    match.assignments.every(
                                      (a) => !a.officialId
                                    )
                                  }
                                  title={
                                    match.assignments.every(
                                      (a) => !a.officialId
                                    )
                                      ? "Aucun officiel désigné"
                                      : "Imprimer les ordres de mission"
                                  }
                                  className="inline-flex items-center justify-center bg-gray-600 text-white font-bold py-1 px-3 rounded-lg disabled:bg-gray-700 disabled:cursor-not-allowed text-sm transition-colors hover:bg-gray-500"
                                >
                                  {isPrinting && printingScope === match.id ? (
                                    <svg
                                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        opacity="0.25"
                                      ></circle>
                                      <path
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        opacity="0.75"
                                      ></path>
                                    </svg>
                                  ) : (
                                    <PrinterIcon className="h-4 w-4 mr-1.5" />
                                  )}
                                  {isPrinting && printingScope === match.id
                                    ? "Gén..."
                                    : "Imprimer"}
                                </button>
                                <button
                                  onClick={() => handleSendSheet(match.id)}
                                  disabled={!canSendSheet || isSending}
                                  title={
                                    !canSendSheet
                                      ? "Envoi impossible: au moins un officiel avec un e-mail valide doit être assigné et le stade doit avoir une localisation."
                                      : sendButtonText
                                  }
                                  className={`inline-flex items-center justify-center text-white font-bold py-1 px-3 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed text-sm transition-colors ${
                                    match.isSheetSent
                                      ? "bg-blue-600 hover:bg-blue-700"
                                      : "bg-brand-primary hover:bg-brand-secondary"
                                  }`}
                                >
                                  {isSending ? (
                                    <>
                                      <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          opacity="0.25"
                                        ></circle>
                                        <path
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                          opacity="0.75"
                                        ></path>
                                      </svg>
                                      Envoi...
                                    </>
                                  ) : (
                                    <>
                                      <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                                      {sendButtonText}
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
      <QuickEmailModal
        isOpen={!!emailModalOfficial}
        onClose={() => setEmailModalOfficial(null)}
        official={emailModalOfficial}
        onSave={onUpdateOfficialEmail}
      />
      <AlertModal
        isOpen={!!alertInfo}
        onClose={() => setAlertInfo(null)}
        title={alertInfo?.title || ""}
        message={alertInfo?.message || ""}
      />
    </>
  );
};
