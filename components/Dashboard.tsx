import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  Match,
  Official,
  OfficialRole,
  MatchStatus,
  User,
  Team,
  Stadium,
  League,
  LeagueGroup,
  TeamSeasonStadium,
  Location,
  AccountingStatus,
} from "../types";
import MatchCard from "./MatchCard";
import AssignmentModal from "./AssignmentModal";
import { Permissions } from "../hooks/usePermissions";
import CheckCircleIcon from "./icons/CheckCircleIcon";
import PaperAirplaneIcon from "./icons/PaperAirplaneIcon";
import ExclamationCircleIcon from "./icons/ExclamationCircleIcon";
import GameDaySchedulerModal from "./GameDaySchedulerModal";
import CalendarDaysIcon from "./icons/CalendarDaysIcon";
import ScoreModal from "./ScoreModal";
import AlertTriangleIcon from "./icons/AlertTriangleIcon";
import CreateMatchModal from "./CreateMatchModal";
import PlusIcon from "./icons/PlusIcon";
import LayoutDashboardIcon from "./icons/LayoutDashboardIcon";
import CalendarIcon from "./icons/CalendarIcon";
import ClipboardListIcon from "./icons/ClipboardListIcon";
import CalendarView from "./CalendarView";
import { GameDayFocusView } from "./GameDayFocusView";
import FilterIcon from "./icons/FilterIcon";
import FilterPanel, { Filters } from "./FilterPanel";
import ChevronDownIcon from "./icons/ChevronDownIcon";
import TrendingUpIcon from "./icons/TrendingUpIcon";
import WhistleIcon from "./icons/WhistleIcon";
import SearchIcon from "./icons/SearchIcon";
import CloseIcon from "./icons/CloseIcon";
import TrashIcon from "./icons/TrashIcon";
import ConfirmationModal from "./ConfirmationModal";
import OfficialPlanningView from "./OfficialPlanningView";
import UsersIcon from "./icons/UsersIcon";
import ListBulletIcon from "./icons/ListBulletIcon";
import ChevronLeftIcon from "./icons/ChevronLeftIcon";
import ChevronRightIcon from "./icons/ChevronRightIcon";
import PencilIcon from "./icons/PencilIcon";
import XMarkIcon from "./icons/XMarkIcon";
import ClockIcon from "./icons/ClockIcon";
import LockClosedIcon from "./icons/LockClosedIcon";
import StadiumAssignmentModal from "./StadiumAssignmentModal";
import MatchAssignmentsModal from "./MatchAssignmentsModal";
import QuickDateTimeModal from "./QuickDateTimeModal";

interface DashboardProps {
  matches: Match[];
  officials: Official[];
  officialRoles: OfficialRole[];
  teams: Team[];
  stadiums: Stadium[];
  leagues: League[];
  leagueGroups: LeagueGroup[];
  locations: Location[];
  users: User[];
  onUpdateAssignment: (
    matchId: string,
    assignmentId: string,
    officialId: string | null
  ) => void;
  onUpdateMatchStatus: (matchId: string, status: MatchStatus) => void;
  onUpdateMatchScoreAndStatus: (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => void;
  onMarkOfficialAbsent: (matchId: string, assignmentId: string) => void;
  onArchiveMatch: (matchId: string) => void;
  onSendMatchSheet: (matchId: string) => Promise<void>;
  onNotifyChanges: (matchId: string) => Promise<void>;
  onAddAssignment: (matchId: string, role: OfficialRole) => Promise<void>;
  onRemoveAssignment: (matchId: string, assignmentId: string) => void;
  onUpdateGameDaySchedule: (
    leagueGroupId: string,
    gameDay: number,
    date: string,
    time: string
  ) => void;
  currentUser: User;
  permissions: Permissions;
  onSaveMatch: (
    matchData: Omit<
      Match,
      | "status"
      | "assignments"
      | "isSheetSent"
      | "hasUnsentChanges"
      | "isArchived"
      | "createdAt"
      | "createdByName"
      | "updatedAt"
      | "updatedBy"
      | "updatedByName"
    > & { id?: string }
  ) => void;
  onSaveStadium: (stadium: Stadium) => void;
  seasons: string[];
  currentSeason: string;
  teamStadiums: TeamSeasonStadium[];
  onUpdateOfficialEmail: (officialId: string, email: string) => void;
  onPrintIndividualMissionOrder: (matchId: string, officialId: string) => void;
  onSendIndividualMissionOrder: (matchId: string, officialId: string) => void;
  onSendAllMissionOrders: (matchId: string) => void;
}

// Data for the planning view
interface PlanningGameDay {
  matches: Match[];
  count: number;
  isScheduled: boolean;
}
interface PlanningGroup {
  group: LeagueGroup;
  gameDays: Record<number, PlanningGameDay>;
  sortedGameDays: number[];
}
interface PlanningLeague {
  league: League;
  groups: Record<string, PlanningGroup>;
}

const initialFilters: Filters = {
  searchTerm: "",
  assignmentStatus: "all",
  commStatus: "all",
  matchStatus: "all",
  teamId: "all",
  stadiumId: "all",
  dateRange: { start: "", end: "" },
};

type ActiveView =
  | { type: "toPlan" }
  | { type: "urgent" }
  | { type: "week" }
  | { type: "all" }
  | { type: "league"; id: string }
  | { type: "group"; id: string };

interface MainContentProps {
  activeView: ActiveView;
  viewContent: any;
  permissions: Permissions;
  appliedFilters: Filters;
  setAppliedFilters: React.Dispatch<React.SetStateAction<Filters>>;
  isFilterActive: boolean;
  setIsFilterPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddMatch: () => void;
  handleEditMatch: (match: Match) => void;
  handleManageDay: (date: Date) => void;
  handleOpenGameDayFocus: (leagueGroupId: string, gameDay: number) => void;
  selectedMatchIds: Set<string>;
  setSelectedMatchIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleSelectMatch: (matchId: string) => void;
  sortedPlanningLeagueIds: string[];
  planningData: Record<string, PlanningLeague>;
  expandedPlanningLeagues: Record<string, boolean>;
  togglePlanningLeague: (leagueId: string) => void;
  expandedPlanningGroups: Record<string, boolean>;
  togglePlanningGroup: (groupId: string) => void;
  handleOpenGameDayModal: (
    leagueGroup: LeagueGroup,
    gameDay: number,
    matches: Match[]
  ) => void;
  handleOpenAssignModalFromCard: (
    matchId: string,
    assignmentId: string,
    role: OfficialRole
  ) => void;
  handleOpenScoreModal: (match: Match) => void;
  handleOpenStadiumModal: (match: Match) => void;
  handleOpenAssignmentsModal: (match: Match) => void;
  handleOpenQuickDateTimeModal: (match: Match) => void;
  dashboardProps: DashboardProps;
  /**
   * When returning to the planning list view we restore the previous scroll position
   * instead of auto-scrolling to today. If null, we auto-scroll as before.
   */
  initialListScroll: number | null;
  /** Persist the latest scroll position when unmounting / navigating away */
  onPersistListScroll: (y: number | null) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeView,
  viewContent,
  permissions,
  appliedFilters,
  setAppliedFilters,
  isFilterActive,
  setIsFilterPanelOpen,
  handleAddMatch,
  handleEditMatch,
  handleManageDay,
  handleOpenGameDayFocus,
  selectedMatchIds,
  setSelectedMatchIds,
  handleSelectMatch,
  sortedPlanningLeagueIds,
  planningData,
  expandedPlanningLeagues,
  togglePlanningLeague,
  expandedPlanningGroups,
  togglePlanningGroup,
  handleOpenGameDayModal,
  handleOpenAssignModalFromCard,
  handleOpenScoreModal,
  handleOpenStadiumModal,
  handleOpenAssignmentsModal,
  handleOpenQuickDateTimeModal,
  dashboardProps,
  initialListScroll,
  onPersistListScroll,
}) => {
  const [contentView, setContentView] = useState<"card" | "list">("list");

  const [openMenuMatchId, setOpenMenuMatchId] = useState<string | null>(null);
  const [matchToArchive, setMatchToArchive] = useState<Match | null>(null);

  const locationMap = useMemo(
    () => new Map(dashboardProps.locations.map((loc) => [loc.id, loc])),
    [dashboardProps.locations]
  );
  const formatLocation = useCallback(
    (locationId: string | null): string => {
      if (!locationId) return "";
      const location = locationMap.get(locationId);
      if (!location) return "";
      if (location.wilaya_ar && location.commune_ar) {
        return `${location.wilaya_ar} - ${location.commune_ar}`;
      }
      return [location.wilaya, location.daira, location.commune]
        .filter(Boolean)
        .join(" / ");
    },
    [locationMap]
  );

  const handleConfirmArchive = () => {
    if (matchToArchive) {
      dashboardProps.onArchiveMatch(matchToArchive.id);
      setMatchToArchive(null);
    }
  };

  const displayMatches = useMemo(() => {
    if (viewContent?.isGroupView && Array.isArray(viewContent.gameDaysData)) {
      return viewContent.gameDaysData.flatMap((g: any) =>
        Array.isArray(g?.matches) ? g.matches : []
      );
    }
    if (Array.isArray(viewContent?.matches)) {
      return viewContent.matches as Match[];
    }
    return [] as Match[];
  }, [viewContent]);

  const matchesByDay = useMemo(() => {
    return displayMatches.reduce((acc, match) => {
      const dateKey = match.matchDate || "Unscheduled";
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(match);
      return acc;
    }, {} as Record<string, Match[]>);
  }, [displayMatches]);

  const sortedDays = useMemo(() => {
    return Object.keys(matchesByDay).sort((a, b) => {
      if (a === "Unscheduled") return 1;
      if (b === "Unscheduled") return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [matchesByDay]);

  // Sticky header total height offset (nav tabs + internal toolbar)
  const SCROLL_HEADER_OFFSET = 160; // was 140, adjusted for better alignment

  // The list view uses an internal scroll container (overflow-auto). We keep a ref to it.
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  // Helper to scroll to today's row (reused by effect + manual button)
  const scrollToToday = useCallback(
    (opts?: { highlight?: boolean }) => {
      try {
        const scroller = listScrollRef.current;
        if (!scroller) return; // Not in list view yet
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const localKey = `${y}-${m}-${d}`;

        // Query only within the scroll container
        let target: HTMLElement | null = scroller.querySelector(
          `tr[data-day-row='${localKey}']`
        );

        if (!target) {
          const validDayKeys = sortedDays.filter((k) => k !== "Unscheduled");
          const todayDate = new Date(`${localKey}T00:00:00`);
          let futureCandidate: string | undefined = validDayKeys.find(
            (k) => new Date(`${k}T00:00:00`) >= todayDate
          );
          if (!futureCandidate && validDayKeys.length > 0) {
            futureCandidate = validDayKeys[validDayKeys.length - 1];
          }
          if (futureCandidate) {
            target = scroller.querySelector(
              `tr[data-day-row='${futureCandidate}']`
            ) as HTMLElement | null;
          }
        }

        if (target) {
          // Position inside scroller
          const targetTopRelative =
            target.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top;
          // Adjust for sticky headers inside the scroll container
          const scrollTop = targetTopRelative - 10; // small padding
          scroller.scrollTo({ top: scrollTop, behavior: "smooth" });

          if (opts?.highlight) {
            target.classList.add(
              "ring-2",
              "ring-brand-primary",
              "ring-offset-2",
              "ring-offset-gray-800"
            );
            setTimeout(() => {
              target?.classList.remove(
                "ring-2",
                "ring-brand-primary",
                "ring-offset-2",
                "ring-offset-gray-800"
              );
            }, 1600);
          }
        }
      } catch (_) {}
    },
    [sortedDays]
  );

  // Restore previous scroll position (if any) otherwise auto-scroll to today
  useEffect(() => {
    if (contentView !== "list") return;
    if (!displayMatches || displayMatches.length === 0) return;
    const scroller = listScrollRef.current;
    if (!scroller) return;
    if (initialListScroll != null) {
      const handle = requestAnimationFrame(() => {
        scroller.scrollTo({ top: initialListScroll });
      });
      return () => cancelAnimationFrame(handle);
    }
    const handle = requestAnimationFrame(() => scrollToToday());
    return () => cancelAnimationFrame(handle);
  }, [contentView, displayMatches, scrollToToday, initialListScroll]);

  // Track latest scroll position while in list view
  const latestScrollRef = useRef<number>(0);
  useEffect(() => {
    if (contentView !== "list") return;
    const scroller = listScrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      latestScrollRef.current = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [contentView]);

  // Persist scroll position when MainContent unmounts (or dependencies change triggering unmount)
  useEffect(() => {
    return () => {
      try {
        onPersistListScroll(latestScrollRef.current);
      } catch (_) {}
    };
  }, [onPersistListScroll]);

  const matchStatusColors: {
    [key in MatchStatus]: { bg: string; text: string };
  } = {
    [MatchStatus.COMPLETED]: { bg: "bg-green-900/50", text: "text-green-300" },
    [MatchStatus.SCHEDULED]: { bg: "bg-blue-900/50", text: "text-blue-300" },
    [MatchStatus.POSTPONED]: {
      bg: "bg-yellow-900/50",
      text: "text-yellow-300",
    },
    [MatchStatus.CANCELLED]: { bg: "bg-red-900/50", text: "text-red-300" },
    [MatchStatus.IN_PROGRESS]: {
      bg: "bg-amber-900/50",
      text: "text-amber-300",
    },
  };

  const accountingStatusConfig: Record<
    AccountingStatus,
    { text: string; color: string; icon: React.ReactNode }
  > = {
    [AccountingStatus.NOT_ENTERED]: {
      text: "Non saisi",
      color: "bg-gray-700 text-gray-300",
      icon: <PencilIcon className="w-4 h-4 mr-1.5" />,
    },
    [AccountingStatus.REJECTED]: {
      text: "Rejeté",
      color: "bg-red-900 text-red-300",
      icon: <XMarkIcon className="w-4 h-4 mr-1.5" />,
    },
    [AccountingStatus.PENDING_VALIDATION]: {
      text: "En validation",
      color: "bg-blue-900 text-blue-300",
      icon: <ClockIcon className="w-4 h-4 mr-1.5" />,
    },
    [AccountingStatus.VALIDATED]: {
      text: "Validé",
      color: "bg-green-900 text-green-300",
      icon: <CheckCircleIcon className="w-4 h-4 mr-1.5" />,
    },
    [AccountingStatus.CLOSED]: {
      text: "Clôturé",
      color: "bg-purple-900 text-purple-300",
      icon: <LockClosedIcon className="w-4 h-4 mr-1.5" />,
    },
  };

  if (activeView.type === "toPlan") {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">
          Matchs à Planifier
        </h2>
        <div className="space-y-4">
          {sortedPlanningLeagueIds.length > 0 ? (
            sortedPlanningLeagueIds.map((leagueId, leagueIndex) => {
              const { league, groups } = planningData[leagueId];
              const isLeagueExpanded =
                expandedPlanningLeagues[leagueId] ?? leagueIndex === 0;
              return (
                <div
                  key={leagueId}
                  className="bg-gray-800 rounded-lg p-4 border border-yellow-500/30"
                >
                  <button
                    onClick={() => togglePlanningLeague(leagueId)}
                    className="w-full flex justify-between items-center text-left p-1 -m-1 rounded-md hover:bg-gray-700/50 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-white">
                      {league.name}
                    </h3>
                    <ChevronDownIcon
                      className={`h-6 w-6 text-gray-400 transition-transform duration-200 ${
                        isLeagueExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isLeagueExpanded && (
                    <div className="space-y-3 mt-3">
                      {(Object.values(groups) as PlanningGroup[])
                        .sort((a, b) =>
                          a.group.name.localeCompare(b.group.name)
                        )
                        .map(({ group, gameDays, sortedGameDays }) => {
                          const isGroupExpanded =
                            expandedPlanningGroups[group.id] ?? false;
                          return (
                            <div
                              key={group.id}
                              className="bg-gray-900/50 p-3 rounded-lg"
                            >
                              <button
                                onClick={() => togglePlanningGroup(group.id)}
                                className="w-full flex justify-between items-center text-left p-1 -m-1 rounded-md hover:bg-gray-700/50 transition-colors"
                              >
                                <h4 className="text-md font-semibold text-brand-primary">
                                  {group.name}
                                </h4>
                                <ChevronDownIcon
                                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                                    isGroupExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                              {isGroupExpanded && (
                                <div className="space-y-2 mt-2">
                                  {sortedGameDays.map((day) => {
                                    const dayMatches = gameDays[day].matches;
                                    const { isScheduled, count } =
                                      gameDays[day];
                                    return (
                                      <div
                                        key={day}
                                        className={`flex justify-between items-center bg-gray-700/50 p-2 rounded-md text-sm transition-all ${
                                          isScheduled
                                            ? "border-l-4 border-green-500"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {isScheduled && (
                                            <CheckCircleIcon
                                              className="h-5 w-5 text-green-400"
                                              title="Planifié"
                                            />
                                          )}
                                          <span className="text-white">
                                            Journée {day} ({count} matchs)
                                          </span>
                                        </div>
                                        <button
                                          onClick={() =>
                                            handleOpenGameDayModal(
                                              group,
                                              day,
                                              dayMatches
                                            )
                                          }
                                          className={`text-xs font-semibold py-1 px-2 rounded-full transition-colors ${
                                            isScheduled
                                              ? "text-green-300 hover:text-green-200 hover:bg-green-500/10"
                                              : "text-brand-primary hover:text-brand-secondary hover:bg-brand-primary/10"
                                          }`}
                                        >
                                          {isScheduled
                                            ? "Modifier"
                                            : "Planifier"}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-gray-800 rounded-lg">
              <p className="text-gray-400">Aucun match à planifier.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewContent.isGroupView) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">
          {viewContent.title}
        </h2>
        {viewContent.gameDaysData && viewContent.gameDaysData.length > 0 ? (
          <div className="space-y-6">
            {viewContent.gameDaysData.map(({ day, matches: dayMatches }) => (
              <div key={day} className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Journée {day}
                  </h3>
                  <button
                    onClick={() =>
                      handleOpenGameDayFocus(viewContent.groupId!, day)
                    }
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
                  >
                    <WhistleIcon className="h-4 w-4 mr-2" />
                    Gérer la journée
                  </button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {dayMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      {...dashboardProps}
                      match={match}
                      onAssign={handleOpenAssignModalFromCard}
                      onEdit={handleEditMatch}
                      onSendSheet={(match) =>
                        dashboardProps.onSendMatchSheet(match.id)
                      }
                      onNotifyChanges={(match) =>
                        dashboardProps.onNotifyChanges(match.id)
                      }
                      onOpenScoreModal={handleOpenScoreModal}
                      viewContext="assignments"
                      isSelected={selectedMatchIds.has(match.id)}
                      onSelect={handleSelectMatch}
                      onOpenStadiumModal={handleOpenStadiumModal}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-800 rounded-lg">
            <p className="text-gray-400">
              Aucun match programmé trouvé pour ce groupe.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-32 bg-gray-900 z-10 py-4 flex flex-wrap justify-between items-center mb-4 gap-4">
        <h2 className="text-2xl font-bold text-white">{viewContent.title}</h2>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Recherche générale..."
              value={appliedFilters.searchTerm}
              onChange={(e) =>
                setAppliedFilters({
                  ...appliedFilters,
                  searchTerm: e.target.value,
                })
              }
              className="w-full sm:w-64 bg-gray-700 border border-gray-600 rounded-lg shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              aria-label="Recherche générale"
            />
          </div>
          <button
            onClick={() => setIsFilterPanelOpen(true)}
            className={`flex items-center text-sm font-semibold py-2 px-3 rounded-lg transition-colors ${
              isFilterActive
                ? "bg-brand-primary text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <FilterIcon className="h-4 w-4 mr-2" />
            Filtres{" "}
            {isFilterActive && (
              <span className="ml-2 bg-white/20 h-5 w-5 text-xs rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
          <div className="bg-gray-700 p-1 rounded-lg flex items-center">
            <button
              onClick={() => setContentView("card")}
              className={`p-1.5 rounded-md transition-colors ${
                contentView === "card"
                  ? "bg-brand-primary text-white"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Vue Cartes"
            >
              <LayoutDashboardIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setContentView("list")}
              className={`p-1.5 rounded-md transition-colors ${
                contentView === "list"
                  ? "bg-brand-primary text-white"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Vue Liste"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
            {contentView === "list" && (
              <button
                onClick={() => scrollToToday({ highlight: true })}
                className="ml-2 px-2 py-1.5 text-xs font-semibold rounded-md flex items-center bg-gray-600 text-gray-200 hover:bg-brand-primary/30 hover:text-white transition-colors"
                title="Recentrer sur aujourd'hui"
              >
                Aujourd'hui
              </button>
            )}
          </div>
          {permissions.can("create", "match") && (
            <button
              onClick={handleAddMatch}
              className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Créer un match
            </button>
          )}
        </div>
      </div>

      {contentView === "card" &&
        (viewContent.matches && viewContent.matches.length > 0 ? (
          <div className="space-y-8">
            {sortedDays.map((day) => {
              const dayMatches = matchesByDay[day];
              const date =
                day !== "Unscheduled" ? new Date(`${day}T12:00:00`) : null;
              const dayTitle = date
                ? date.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })
                : "Date non définie";

              return (
                <div key={day}>
                  <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <h3 className="text-xl font-bold text-white">{dayTitle}</h3>
                    {date &&
                      dayMatches.length > 1 &&
                      permissions.can("assign", "official") && (
                        <button
                          onClick={() => handleManageDay(date)}
                          className="flex items-center text-sm bg-brand-primary/20 text-brand-primary font-semibold py-2 px-3 rounded-lg hover:bg-brand-primary/30 transition-colors"
                        >
                          ⚡ Gérer ces {dayMatches.length} matchs en mode focus
                        </button>
                      )}
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {dayMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        {...dashboardProps}
                        match={match}
                        onAssign={handleOpenAssignModalFromCard}
                        onEdit={handleEditMatch}
                        onSendSheet={(match) =>
                          dashboardProps.onSendMatchSheet(match.id)
                        }
                        onNotifyChanges={(match) =>
                          dashboardProps.onNotifyChanges(match.id)
                        }
                        onOpenScoreModal={handleOpenScoreModal}
                        viewContext="assignments"
                        isSelected={selectedMatchIds.has(match.id)}
                        onSelect={handleSelectMatch}
                        onOpenStadiumModal={handleOpenStadiumModal}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-800 rounded-lg">
            <p className="text-gray-400">
              Aucun match ne correspond aux critères.
            </p>
          </div>
        ))}

      {contentView === "list" &&
        (displayMatches.length > 0 ? (
          <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div
              className="overflow-auto h-[calc(100vh-240px)]"
              ref={listScrollRef}
            >
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th scope="col" className="p-4 w-12">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          e.target.checked
                            ? setSelectedMatchIds(
                                new Set(displayMatches.map((m) => m.id))
                              )
                            : setSelectedMatchIds(new Set());
                        }}
                        checked={
                          displayMatches.length > 0 &&
                          selectedMatchIds.size === displayMatches.length
                        }
                        className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary"
                      />
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Match
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Date & Heure
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Stade
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Score
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Désignations
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Communication
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Statut Match
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Statut Comptable
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                {sortedDays.map((day) => {
                  const dayMatches = matchesByDay[day];
                  const date =
                    day !== "Unscheduled" ? new Date(`${day}T12:00:00`) : null;
                  const dayTitle = date
                    ? date.toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "Date non définie";

                  const matchesByGroup = dayMatches.reduce((acc, match) => {
                    const groupId = match.leagueGroup.id;
                    if (!acc[groupId]) {
                      acc[groupId] = {
                        groupName: `${match.leagueGroup.league.name} - ${match.leagueGroup.name}`,
                        matches: [],
                      };
                    }
                    acc[groupId].matches.push(match);
                    return acc;
                  }, {} as Record<string, { groupName: string; matches: Match[] }>);

                  const sortedGroupIds = Object.keys(matchesByGroup).sort(
                    (a, b) =>
                      matchesByGroup[a].groupName.localeCompare(
                        matchesByGroup[b].groupName
                      )
                  );

                  return (
                    <tbody key={day} className="border-t-4 border-gray-900">
                      <tr
                        className="sticky top-0 z-20 bg-gray-700"
                        data-day-row={day !== "Unscheduled" ? day : undefined}
                      >
                        <td colSpan={10} className="px-4 py-2">
                          <div className="flex justify-between items-center">
                            <h3 className="text-md font-bold text-white">
                              {dayTitle}
                            </h3>
                            {date &&
                              dayMatches.length > 0 &&
                              permissions.can("assign", "official") && (
                                <button
                                  onClick={() => handleManageDay(date)}
                                  className="flex items-center text-sm bg-brand-primary/20 text-brand-primary font-semibold py-1 px-2 rounded-lg hover:bg-brand-primary/30 transition-colors"
                                >
                                  <WhistleIcon className="h-4 w-4 mr-2" />
                                  Gérer la journée en mode focus
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                      {sortedGroupIds.map((groupId) => {
                        const groupData = matchesByGroup[groupId];
                        return (
                          <React.Fragment key={groupId}>
                            <tr className="sticky top-[44px] z-20 bg-gray-800">
                              <td
                                colSpan={10}
                                className="px-6 py-1.5 text-sm font-semibold text-brand-primary"
                              >
                                {groupData.groupName}
                              </td>
                            </tr>
                            {groupData.matches.map((match) => {
                              const assignedCount = match.assignments.filter(
                                (a) => a.officialId
                              ).length;
                              const totalSlots = match.assignments.length;
                              const accountingStatusStyle =
                                accountingStatusConfig[
                                  match.accountingStatus
                                ] || {
                                  text: String(match.accountingStatus),
                                  color: "bg-gray-700 text-gray-300",
                                  icon: null,
                                };

                              const isMatchLockedForAccounting =
                                match.accountingStatus ===
                                  AccountingStatus.VALIDATED ||
                                match.accountingStatus ===
                                  AccountingStatus.CLOSED;
                              const isAccountingInProgress =
                                match.accountingStatus !==
                                AccountingStatus.NOT_ENTERED;
                              const isMatchStateEditableForAssignments =
                                match.status === MatchStatus.SCHEDULED &&
                                !isMatchLockedForAccounting;

                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const matchDateObj = match.matchDate
                                ? new Date(match.matchDate + "T00:00:00")
                                : null;
                              const canMarkAsPlayed = matchDateObj
                                ? matchDateObj <= today
                                : false;
                              const canEnterScore =
                                (canMarkAsPlayed ||
                                  match.status === MatchStatus.COMPLETED) &&
                                !isMatchLockedForAccounting;

                              const canEditMatchDetails = permissions.can(
                                "edit",
                                "match"
                              );
                              const canEditStadium =
                                canEditMatchDetails &&
                                isMatchStateEditableForAssignments;
                              const canEditDateTime =
                                canEditMatchDetails &&
                                isMatchStateEditableForAssignments;
                              const canArchiveMatch = permissions.can(
                                "archive",
                                "match"
                              );

                              const handleStatusChange = (
                                status: MatchStatus
                              ) => {
                                if (status === MatchStatus.COMPLETED) {
                                  handleOpenScoreModal(match);
                                } else {
                                  dashboardProps.onUpdateMatchStatus(
                                    match.id,
                                    status
                                  );
                                }
                                setOpenMenuMatchId(null);
                              };

                              const stadiumDisplayName = match.stadium ? (
                                match.stadium.nameAr ? (
                                  `${match.stadium.name} (${match.stadium.nameAr})`
                                ) : (
                                  match.stadium.name
                                )
                              ) : (
                                <span className="italic text-yellow-500">
                                  Non défini
                                </span>
                              );

                              return (
                                <tr
                                  key={match.id}
                                  className={`transition-colors ${
                                    selectedMatchIds.has(match.id)
                                      ? "bg-brand-primary/10"
                                      : "hover:bg-gray-700/50"
                                  }`}
                                >
                                  <td className="p-4">
                                    <input
                                      type="checkbox"
                                      checked={selectedMatchIds.has(match.id)}
                                      onChange={() =>
                                        handleSelectMatch(match.id)
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-brand-primary"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 h-8 w-8">
                                        <img
                                          className="h-8 w-8 rounded-full"
                                          src={match.homeTeam.logoUrl || ""}
                                          alt=""
                                        />
                                      </div>
                                      <div className="ml-4">
                                        <div className="text-sm font-medium text-white">
                                          {match.homeTeam.name} vs{" "}
                                          {match.awayTeam.name}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {match.leagueGroup.league.name} - J
                                          {match.gameDay}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td
                                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300 ${
                                      canEditDateTime
                                        ? "cursor-pointer hover:bg-brand-primary/20"
                                        : ""
                                    }`}
                                    onClick={(e) => {
                                      if (canEditDateTime) {
                                        e.stopPropagation();
                                        handleOpenQuickDateTimeModal(match);
                                      }
                                    }}
                                    title={
                                      canEditDateTime
                                        ? "Cliquer pour modifier la date/heure"
                                        : "La date/heure ne peut être modifiée que si le match est 'Prévu' et non verrouillé."
                                    }
                                  >
                                    {match.matchDate ? (
                                      <>
                                        <div>
                                          {new Date(
                                            `${match.matchDate}T00:00:00`
                                          ).toLocaleDateString("fr-FR", {
                                            weekday: "short",
                                            day: "numeric",
                                            month: "short",
                                          })}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {match.matchTime || "Heure non déf."}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="italic text-yellow-500">
                                        Non défini
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className={`px-6 py-4 text-sm text-gray-300 max-w-48 ${
                                      canEditStadium
                                        ? "cursor-pointer hover:bg-brand-primary/20"
                                        : ""
                                    }`}
                                    onClick={(e) => {
                                      if (canEditStadium) {
                                        e.stopPropagation();
                                        handleOpenStadiumModal(match);
                                      }
                                    }}
                                    title={
                                      `${
                                        match.stadium
                                          ? `${stadiumDisplayName}, ${formatLocation(
                                              match.stadium.locationId
                                            )}`
                                          : "Stade non défini"
                                      }` +
                                      `\n${
                                        canEditStadium
                                          ? "Cliquer pour modifier"
                                          : "Modification verouillée"
                                      }`
                                    }
                                  >
                                    <div className="truncate font-medium text-white">
                                      {stadiumDisplayName}
                                    </div>
                                    {match.stadium?.locationId && (
                                      <div className="text-xs text-gray-400 truncate">
                                        {formatLocation(
                                          match.stadium.locationId
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td
                                    className={`px-6 py-4 whitespace-nowrap text-center text-lg font-mono font-bold ${
                                      canEnterScore
                                        ? "cursor-pointer hover:bg-brand-primary/20 rounded-md"
                                        : "cursor-default"
                                    }`}
                                    onClick={(e) => {
                                      if (canEnterScore) {
                                        e.stopPropagation();
                                        handleOpenScoreModal(match);
                                      }
                                    }}
                                    title={
                                      canEnterScore
                                        ? "Cliquer pour saisir/modifier le score"
                                        : isMatchLockedForAccounting
                                        ? "Score verrouillé (comptabilité)"
                                        : "Le score ne peut être saisi qu'après la date du match"
                                    }
                                  >
                                    {match.status === MatchStatus.COMPLETED &&
                                    match.homeScore !== null
                                      ? `${match.homeScore} - ${match.awayScore}`
                                      : "-"}
                                  </td>
                                  <td
                                    className={`px-6 py-4 whitespace-nowrap ${
                                      isMatchStateEditableForAssignments
                                        ? "cursor-pointer hover:bg-brand-primary/20"
                                        : ""
                                    }`}
                                    onClick={(e) => {
                                      if (isMatchStateEditableForAssignments) {
                                        e.stopPropagation();
                                        handleOpenAssignmentsModal(match);
                                      }
                                    }}
                                    title={
                                      isMatchStateEditableForAssignments
                                        ? "Gérer les désignations"
                                        : "Désignations verrouillées"
                                    }
                                  >
                                    <div className="flex items-center">
                                      <span className="text-sm text-white mr-2">
                                        {assignedCount}/{totalSlots}
                                      </span>
                                      {totalSlots > 0 && (
                                        <div className="w-20 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-brand-primary rounded-full"
                                            style={{
                                              width: `${
                                                (assignedCount / totalSlots) *
                                                100
                                              }%`,
                                            }}
                                          ></div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {(() => {
                                      if (
                                        match.isSheetSent &&
                                        !match.hasUnsentChanges
                                      ) {
                                        return (
                                          <div
                                            className="flex items-center text-xs text-green-400"
                                            title="Feuille de route envoyée"
                                          >
                                            <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                                            Envoyée
                                          </div>
                                        );
                                      }
                                      if (match.hasUnsentChanges) {
                                        return (
                                          <div
                                            className="flex items-center text-xs text-yellow-400"
                                            title="Changements non notifiés"
                                          >
                                            <AlertTriangleIcon className="h-4 w-4 mr-1.5" />
                                            Changements
                                          </div>
                                        );
                                      }
                                      return (
                                        <span className="text-xs text-gray-500">
                                          Non Envoyée
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span
                                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        (matchStatusColors as any)[match.status]
                                          ?.bg || "bg-gray-700"
                                      } ${
                                        (matchStatusColors as any)[match.status]
                                          ?.text || "text-gray-300"
                                      }`}
                                    >
                                      {match.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accountingStatusStyle.color}`}
                                    >
                                      {accountingStatusStyle.icon}
                                      {accountingStatusStyle.text}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="relative inline-block text-left">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMenuMatchId(
                                            openMenuMatchId === match.id
                                              ? null
                                              : match.id
                                          );
                                        }}
                                        onBlur={() =>
                                          setTimeout(() => {
                                            if (openMenuMatchId === match.id)
                                              setOpenMenuMatchId(null);
                                          }, 150)
                                        }
                                        disabled={isMatchLockedForAccounting}
                                        title={
                                          isMatchLockedForAccounting
                                            ? "Actions verrouillées car la comptabilité est validée ou clôturée."
                                            : "Actions"
                                        }
                                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-5 w-5"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                      </button>
                                      {openMenuMatchId === match.id && (
                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                          className="origin-top-right absolute right-0 mt-2 w-56 bg-gray-700 rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5 focus:outline-none"
                                        >
                                          <div className="py-1">
                                            <button
                                              onClick={() => {
                                                handleEditMatch(match);
                                                setOpenMenuMatchId(null);
                                              }}
                                              disabled={
                                                !isMatchStateEditableForAssignments
                                              }
                                              title={
                                                isMatchLockedForAccounting
                                                  ? "Impossible de modifier, la comptabilité est verrouillée."
                                                  : !isMatchStateEditableForAssignments
                                                  ? "Impossible de modifier un match qui n'est pas au statut 'Prévu'."
                                                  : "Modifier les détails du match"
                                              }
                                              className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              Modifier le match
                                            </button>
                                            <div className="border-t border-gray-600 my-1"></div>
                                            <p className="px-4 pt-2 pb-1 text-xs text-gray-400">
                                              Changer le statut
                                            </p>
                                            {match.status !==
                                              MatchStatus.COMPLETED && (
                                              <button
                                                onClick={() =>
                                                  handleStatusChange(
                                                    MatchStatus.COMPLETED
                                                  )
                                                }
                                                disabled={
                                                  !canMarkAsPlayed ||
                                                  isMatchLockedForAccounting
                                                }
                                                title={
                                                  isMatchLockedForAccounting
                                                    ? "Impossible de modifier, la comptabilité est verrouillée."
                                                    : !canMarkAsPlayed
                                                    ? "Un match ne peut être marqué comme 'Joué' avant sa date."
                                                    : ""
                                                }
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                Marquer comme Joué
                                              </button>
                                            )}
                                            {match.status !==
                                              MatchStatus.SCHEDULED && (
                                              <button
                                                onClick={() =>
                                                  handleStatusChange(
                                                    MatchStatus.SCHEDULED
                                                  )
                                                }
                                                disabled={
                                                  isAccountingInProgress
                                                }
                                                title={
                                                  isAccountingInProgress
                                                    ? "Impossible de revenir à 'Prévu' car le processus comptable est engagé."
                                                    : ""
                                                }
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                Marquer comme Prévu
                                              </button>
                                            )}
                                            {match.status !==
                                              MatchStatus.POSTPONED && (
                                              <button
                                                onClick={() =>
                                                  handleStatusChange(
                                                    MatchStatus.POSTPONED
                                                  )
                                                }
                                                disabled={
                                                  isAccountingInProgress
                                                }
                                                title={
                                                  isAccountingInProgress
                                                    ? "Impossible de reporter car le processus comptable est engagé."
                                                    : ""
                                                }
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                Reporter le match
                                              </button>
                                            )}
                                            {match.status !==
                                              MatchStatus.CANCELLED && (
                                              <button
                                                onClick={() =>
                                                  handleStatusChange(
                                                    MatchStatus.CANCELLED
                                                  )
                                                }
                                                disabled={
                                                  isAccountingInProgress
                                                }
                                                title={
                                                  isAccountingInProgress
                                                    ? "Impossible d'annuler car le processus comptable est engagé."
                                                    : ""
                                                }
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                Annuler le match
                                              </button>
                                            )}
                                            {canArchiveMatch && (
                                              <>
                                                <div className="border-t border-gray-600 my-1"></div>
                                                <button
                                                  onClick={() => {
                                                    setMatchToArchive(match);
                                                    setOpenMenuMatchId(null);
                                                  }}
                                                  disabled={
                                                    isMatchLockedForAccounting
                                                  }
                                                  title={
                                                    isMatchLockedForAccounting
                                                      ? "Impossible d'archiver, la comptabilité est verrouillée."
                                                      : ""
                                                  }
                                                  className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-500 hover:text-white rounded-b-md disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  Archiver le match
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-800 rounded-lg">
            <p className="text-gray-400">
              Aucun match ne correspond aux critères.
            </p>
          </div>
        ))}
      <ConfirmationModal
        isOpen={!!matchToArchive}
        onClose={() => setMatchToArchive(null)}
        onConfirm={handleConfirmArchive}
        title="Archiver le Match"
        message={`Êtes-vous sûr de vouloir archiver le match ${matchToArchive?.homeTeam.name} vs ${matchToArchive?.awayTeam.name} ? Le match sera masqué des listes actives mais son historique sera conservé.`}
      />
    </div>
  );
};

type ModalState =
  | { view: "closed" }
  | { view: "assignments"; matchId: string }
  | {
      view: "selection";
      matchId: string;
      assignmentId: string;
      role: OfficialRole;
      from: "assignments" | "card";
    };

const Dashboard: React.FC<DashboardProps> = (props) => {
  const {
    matches,
    officials,
    officialRoles,
    teams,
    stadiums,
    leagues,
    leagueGroups,
    locations,
    users,
    onUpdateAssignment,
    onUpdateMatchStatus,
    onUpdateMatchScoreAndStatus,
    onMarkOfficialAbsent,
    onArchiveMatch,
    onSendMatchSheet,
    onNotifyChanges,
    onAddAssignment,
    onRemoveAssignment,
    onUpdateGameDaySchedule,
    currentUser,
    permissions,
    onSaveMatch,
    onSaveStadium,
    seasons,
    currentSeason,
    teamStadiums,
    onUpdateOfficialEmail,
    onPrintIndividualMissionOrder,
    onSendIndividualMissionOrder,
    onSendAllMissionOrders,
  } = props;

  const [currentView, setCurrentView] = useState<
    "dashboard" | "calendar" | "official" | "gameDay" | "dayFocus"
  >("dashboard");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [gameDayFocusContext, setGameDayFocusContext] = useState<{
    leagueGroupId: string;
    gameDay: number;
  } | null>(null);
  const [dayFocusContext, setDayFocusContext] = useState<{ date: Date } | null>(
    null
  );
  const [dayFocusOrigin, setDayFocusOrigin] = useState<
    "dashboard" | "calendar"
  >("dashboard");

  const [modalState, setModalState] = useState<ModalState>({ view: "closed" });

  const [isGameDayModalOpen, setIsGameDayModalOpen] = useState<boolean>(false);
  const [gameDayContext, setGameDayContext] = useState<{
    leagueGroup: LeagueGroup;
    gameDay: number;
    matches: Match[];
  } | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [matchForScore, setMatchForScore] = useState<Match | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [stadiumModalMatch, setStadiumModalMatch] = useState<Match | null>(
    null
  );
  const [quickDateTimeMatch, setQuickDateTimeMatch] = useState<Match | null>(
    null
  );

  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [activeView, setActiveView] = useState<ActiveView>({ type: "week" });
  // Persist planning list scroll position when navigating away
  const [savedPlanningListScroll, setSavedPlanningListScroll] = useState<
    number | null
  >(null);
  const [expandedLeaguesNav, setExpandedLeaguesNav] = useState<
    Record<string, boolean>
  >({});
  const [expandedPlanningLeagues, setExpandedPlanningLeagues] = useState<
    Record<string, boolean>
  >({});
  const [expandedPlanningGroups, setExpandedPlanningGroups] = useState<
    Record<string, boolean>
  >({});

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    new Set()
  );
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<
    "send" | "notify" | "archive" | null
  >(null);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const isFilterActive = useMemo(() => {
    const { searchTerm, ...restOfFilters } = appliedFilters;
    const { searchTerm: initialSearchTerm, ...restOfInitialFilters } =
      initialFilters;
    return (
      JSON.stringify(restOfFilters) !== JSON.stringify(restOfInitialFilters)
    );
  }, [appliedFilters]);

  const smartSummary = useMemo(() => {
    const relevantMatches = matches.filter(
      (m) =>
        m.status === MatchStatus.SCHEDULED &&
        m.assignments.length > 0 &&
        !m.isArchived
    );
    let notStarted = 0;
    let inProgress = 0;
    relevantMatches.forEach((m) => {
      const assignedCount = m.assignments.filter((a) => a.officialId).length;
      if (assignedCount === 0) notStarted++;
      else if (assignedCount < m.assignments.length) inProgress++;
    });
    const unsent = matches.filter((m) => m.hasUnsentChanges && !m.isArchived);
    return { notStarted, inProgress, unsent };
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const {
        assignmentStatus,
        commStatus,
        searchTerm,
        dateRange,
        matchStatus,
        stadiumId,
        teamId,
      } = appliedFilters;
      if (
        assignmentStatus === "complete" &&
        (match.assignments.length === 0 ||
          match.assignments.filter((a) => a.officialId).length !==
            match.assignments.length)
      )
        return false;
      if (
        assignmentStatus === "partial" &&
        (match.assignments.filter((a) => a.officialId).length === 0 ||
          match.assignments.filter((a) => a.officialId).length ===
            match.assignments.length)
      )
        return false;
      if (
        assignmentStatus === "empty" &&
        match.assignments.filter((a) => a.officialId).length > 0
      )
        return false;
      if (
        commStatus === "sent" &&
        (!match.isSheetSent || match.hasUnsentChanges)
      )
        return false;
      if (commStatus === "unsent" && !match.hasUnsentChanges) return false;
      if (commStatus === "not_sent" && match.isSheetSent) return false;
      if (matchStatus !== "all" && match.status !== matchStatus) return false;
      if (
        dateRange.start &&
        (!match.matchDate || match.matchDate < dateRange.start)
      )
        return false;
      if (
        dateRange.end &&
        (!match.matchDate || match.matchDate > dateRange.end)
      )
        return false;
      if (
        teamId !== "all" &&
        match.homeTeam.id !== teamId &&
        match.awayTeam.id !== teamId
      )
        return false;
      if (stadiumId !== "all" && match.stadium?.id !== stadiumId) return false;
      if (searchTerm) {
        const normalize = (str: string | null | undefined) =>
          (str || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "");
        const searchKeywords = normalize(searchTerm).split(" ").filter(Boolean);
        const searchableText = [
          normalize(match.homeTeam.name),
          normalize(match.awayTeam.name),
          normalize(match.leagueGroup.league.name),
          normalize(match.leagueGroup.name),
          normalize(match.stadium?.name),
          normalize(match.stadium?.nameAr),
        ].join(" ");
        if (!searchKeywords.every((k) => searchableText.includes(k)))
          return false;
      }
      return true;
    });
  }, [matches, appliedFilters]);

  // --- Memos for different match categories ---
  const { planningData, sortedPlanningLeagueIds, totalUnscheduledGameDays } =
    useMemo(() => {
      const data: Record<string, PlanningLeague> = {};
      const planningMatches = filteredMatches.filter(
        (match) => !match.isArchived
      );

      for (const match of planningMatches) {
        const leagueId = match.leagueGroup.league.id;
        const groupId = match.leagueGroup.id;
        const gameDay = Number(match.gameDay);
        if (!Number.isFinite(gameDay)) {
          continue;
        }
        const leagueInfo = leagues.find((l) => l.id === leagueId);
        if (!leagueInfo) continue;
        if (!data[leagueId])
          data[leagueId] = { league: leagueInfo, groups: {} };
        const groupInfo = leagueGroups.find((g) => g.id === groupId);
        if (!groupInfo) continue;
        if (!data[leagueId].groups[groupId])
          data[leagueId].groups[groupId] = {
            group: groupInfo,
            gameDays: {},
            sortedGameDays: [],
          };
        if (!data[leagueId].groups[groupId].gameDays[gameDay]) {
          data[leagueId].groups[groupId].gameDays[gameDay] = {
            matches: [],
            count: 0,
            isScheduled: false,
          };
        }
        data[leagueId].groups[groupId].gameDays[gameDay].matches.push(match);
        data[leagueId].groups[groupId].gameDays[gameDay].count++;
      }

      let unscheduledCount = 0;
      for (const leagueId in data) {
        for (const groupId in data[leagueId].groups) {
          const groupData = data[leagueId].groups[groupId];
          const gameDayKeys = Object.keys(groupData.gameDays);

          for (const day of gameDayKeys) {
            const gameDayData = groupData.gameDays[Number(day)];
            const matchesArr = Array.isArray(gameDayData.matches)
              ? gameDayData.matches
              : [];
            gameDayData.isScheduled = matchesArr.some((m) => !!m.matchDate);
            if (!gameDayData.isScheduled) {
              unscheduledCount++;
            }
          }
          groupData.sortedGameDays = gameDayKeys
            .map(Number)
            .sort((a, b) => a - b);
        }
      }
      const sortedIds = Object.keys(data).sort((a, b) =>
        data[a].league.name.localeCompare(data[b].league.name)
      );
      return {
        planningData: data,
        sortedPlanningLeagueIds: sortedIds,
        totalUnscheduledGameDays: unscheduledCount,
      };
    }, [filteredMatches, leagues, leagueGroups]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const oneWeekFromNow = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    return d;
  }, [today]);
  const twoWeeksFromNow = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + 14);
    return d;
  }, [today]);

  const thisWeekMatches = useMemo(
    () =>
      filteredMatches
        .filter((match) => {
          const matchDate = match.matchDate ? new Date(match.matchDate) : null;
          return (
            matchDate &&
            matchDate >= today &&
            matchDate <= oneWeekFromNow &&
            !match.isArchived
          );
        })
        .sort(
          (a, b) =>
            new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime()
        ),
    [filteredMatches, today, oneWeekFromNow]
  );

  const urgentMatches = useMemo(
    () =>
      filteredMatches
        .filter((m) => {
          const matchDate = m.matchDate ? new Date(m.matchDate) : null;
          if (!matchDate || matchDate < today || matchDate > twoWeeksFromNow)
            return false;
          const isIncomplete =
            m.assignments.some((a) => !a.officialId) &&
            m.assignments.length > 0;
          return isIncomplete || m.hasUnsentChanges;
        })
        .sort(
          (a, b) =>
            new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime()
        ),
    [filteredMatches, today, twoWeeksFromNow]
  );

  const leagueProgress = useMemo(() => {
    return leagues
      .map((league) => {
        const leagueMatches = matches.filter(
          (m) =>
            m.leagueGroup.league.id === league.id &&
            !m.isArchived &&
            m.season === currentSeason
        );
        if (leagueMatches.length === 0)
          return { name: league.name, progress: 0 };
        const playedMatches = leagueMatches.filter(
          (m) => m.status === MatchStatus.COMPLETED
        ).length;
        return {
          name: league.name,
          progress: Math.round((playedMatches / leagueMatches.length) * 100),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches, leagues, currentSeason]);

  const viewContentData = useMemo(() => {
    switch (activeView.type) {
      case "toPlan":
        return { title: "Matchs à Planifier", matches: [], isGroupView: false };
      case "urgent":
        return { title: "Urgents", matches: urgentMatches, isGroupView: false };
      case "week": {
        const weekSet = thisWeekMatches;
        if (weekSet.length === 0 && filteredMatches.length > 0) {
          return {
            title: "Tous les Matchs",
            matches: filteredMatches,
            isGroupView: false,
          };
        }
        return {
          title: "Matchs de la Semaine",
          matches: weekSet,
          isGroupView: false,
        };
      }
      case "all":
        const sortedMatches = [...filteredMatches].sort((a, b) => {
          if (a.matchDate && b.matchDate) {
            return (
              new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
            );
          }
          if (a.matchDate) return -1;
          if (b.matchDate) return 1;
          return 0;
        });
        return {
          title: "Tous les Matchs",
          matches: sortedMatches,
          isGroupView: false,
        };
      case "league":
        const leagueMatches = filteredMatches
          .filter(
            (m) =>
              m.leagueGroup.league.id === activeView.id &&
              m.matchDate &&
              new Date(m.matchDate) >= today
          )
          .sort(
            (a, b) =>
              new Date(a.matchDate!).getTime() -
              new Date(b.matchDate!).getTime()
          );
        const leagueName =
          leagues.find((l) => l.id === activeView.id)?.name || "";
        return {
          title: `Ligue: ${leagueName}`,
          matches: leagueMatches,
          isGroupView: false,
        };
      case "group":
        const groupMatches = filteredMatches.filter(
          (m) =>
            m.leagueGroup.id === activeView.id &&
            m.matchDate &&
            new Date(m.matchDate) >= today
        );
        const groupName =
          leagueGroups.find((g) => g.id === activeView.id)?.name || "";
        const gameDays = groupMatches.reduce((acc, match) => {
          const day = match.gameDay;
          if (!acc[day]) acc[day] = [];
          acc[day].push(match);
          return acc;
        }, {} as Record<number, Match[]>);
        const sortedGameDays = Object.keys(gameDays)
          .map(Number)
          .sort((a, b) => a - b);
        return {
          title: `Groupe: ${groupName}`,
          isGroupView: true,
          groupId: activeView.id,
          gameDaysData: sortedGameDays.map((day) => ({
            day,
            matches: gameDays[day].sort(
              (a, b) =>
                new Date(a.matchDate!).getTime() -
                new Date(b.matchDate!).getTime()
            ),
          })),
        };
      default:
        return {
          title: "Matchs de la Semaine",
          matches: thisWeekMatches,
          isGroupView: false,
        };
    }
  }, [
    activeView,
    filteredMatches,
    urgentMatches,
    thisWeekMatches,
    leagues,
    leagueGroups,
    today,
  ]);

  // --- Modal Handlers ---
  const handleCloseModals = useCallback(() => {
    setModalState({ view: "closed" });
  }, []);

  const handleBackToAssignments = useCallback(
    (matchId: string) => {
      const match = matches.find((m) => m.id === matchId);
      if (match) {
        setModalState({ view: "assignments", matchId: match.id });
      } else {
        handleCloseModals();
      }
    },
    [matches, handleCloseModals]
  );

  const handleConfirmAssignment = useCallback(
    (officialId: string) => {
      if (modalState.view === "selection") {
        onUpdateAssignment(
          modalState.matchId,
          modalState.assignmentId,
          officialId
        );
        if (modalState.from === "assignments") {
          handleBackToAssignments(modalState.matchId);
        } else {
          handleCloseModals();
        }
      }
    },
    [modalState, onUpdateAssignment, handleBackToAssignments, handleCloseModals]
  );

  const handleOpenAssignModalFromCard = useCallback(
    (matchId: string, assignmentId: string, role: OfficialRole) => {
      setModalState({
        view: "selection",
        matchId,
        assignmentId,
        role,
        from: "card",
      });
    },
    []
  );

  const handleNavigateToSelection = useCallback(
    (matchId: string, assignmentId: string, role: OfficialRole) => {
      setModalState({
        view: "selection",
        matchId,
        assignmentId,
        role,
        from: "assignments",
      });
    },
    []
  );

  const handleOpenAssignmentsModal = (match: Match) => {
    setModalState({ view: "assignments", matchId: match.id });
  };

  // Other handlers
  const handleOpenGameDayModal = (
    leagueGroup: LeagueGroup,
    gameDay: number,
    matches: Match[]
  ) => {
    setGameDayContext({ leagueGroup, gameDay, matches });
    setIsGameDayModalOpen(true);
  };
  const handleOpenScoreModal = (match: Match) => {
    setMatchForScore(match);
    setIsScoreModalOpen(true);
  };
  const handleCloseScoreModal = () => {
    setMatchForScore(null);
    setIsScoreModalOpen(false);
  };
  const handleEditMatch = useCallback((match: Match) => {
    setEditingMatch(match);
    setIsCreateModalOpen(true);
  }, []);
  const handleAddMatch = useCallback(() => {
    setEditingMatch(null);
    setIsCreateModalOpen(true);
  }, []);
  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingMatch(null);
  }, []);
  const handleOpenGameDayFocus = (leagueGroupId: string, gameDay: number) => {
    setGameDayFocusContext({ leagueGroupId, gameDay });
    setCurrentView("gameDay");
  };
  const handleManageDay = (date: Date) => {
    setDayFocusOrigin(currentView === "calendar" ? "calendar" : "dashboard");
    setDayFocusContext({ date });
    setCurrentView("dayFocus");
  };
  const handleSelectMatch = (matchId: string) => {
    setSelectedMatchIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const handleOpenStadiumModal = (match: Match) => {
    setStadiumModalMatch(match);
  };

  const handleCloseStadiumModal = () => {
    setStadiumModalMatch(null);
  };

  const handleOpenQuickDateTimeModal = (match: Match) => {
    setQuickDateTimeMatch(match);
  };

  const handleCloseQuickDateTimeModal = () => {
    setQuickDateTimeMatch(null);
  };

  const handleSaveQuickDateTime = (
    matchId: string,
    date: string,
    time: string
  ) => {
    const matchToUpdate = props.matches.find((m) => m.id === matchId);

    if (matchToUpdate) {
      const matchDataForSave = {
        ...matchToUpdate,
        matchDate: date || null,
        matchTime: time || null,
      };
      const {
        status,
        assignments,
        isSheetSent,
        hasUnsentChanges,
        isArchived,
        createdAt,
        createdByName,
        updatedAt,
        updatedBy,
        updatedByName,
        ...rest
      } = matchDataForSave;

      props.onSaveMatch(rest);
    }
    handleCloseQuickDateTimeModal();
  };

  const handleSaveStadiumForMatch = (
    matchId: string,
    stadiumId: string | null
  ) => {
    const matchToUpdate = props.matches.find((m) => m.id === matchId);
    const stadiumToSet = props.stadiums.find((s) => s.id === stadiumId) || null;

    if (matchToUpdate) {
      const matchDataForSave = {
        ...matchToUpdate,
        stadium: stadiumToSet,
      };
      const {
        status,
        assignments,
        isSheetSent,
        hasUnsentChanges,
        isArchived,
        createdAt,
        createdByName,
        updatedAt,
        updatedBy,
        updatedByName,
        ...rest
      } = matchDataForSave;

      props.onSaveMatch(rest);
    }
    handleCloseStadiumModal();
  };

  const togglePlanningLeague = (leagueId: string) => {
    setExpandedPlanningLeagues((prev) => ({
      ...prev,
      [leagueId]: !(
        prev[leagueId] ?? sortedPlanningLeagueIds.indexOf(leagueId) === 0
      ),
    }));
  };

  const togglePlanningGroup = (groupId: string) => {
    setExpandedPlanningGroups((prev) => ({
      ...prev,
      [groupId]: !(prev[groupId] ?? true),
    }));
  };

  const currentMatchForSelectionModal = useMemo(() => {
    if (modalState.view === "selection") {
      return matches.find((m) => m.id === modalState.matchId) || null;
    }
    return null;
  }, [modalState, matches]);

  const currentMatchForAssignmentsModal = useMemo(() => {
    if (modalState.view === "assignments") {
      return matches.find((m) => m.id === modalState.matchId) || null;
    }
    return null;
  }, [modalState, matches]);

  const availableOfficials = useMemo(() => {
    if (
      !currentMatchForSelectionModal ||
      !currentMatchForSelectionModal.matchDate
    )
      return [];
    return officials.filter((official) => {
      if (!official.isActive || official.isArchived) return false;
      if (
        currentMatchForSelectionModal.assignments.some(
          (a) => a.officialId === official.id
        )
      )
        return false;
      const matchDate = new Date(currentMatchForSelectionModal.matchDate);
      if (
        official.unavailabilities.some((u) => {
          const start = new Date(u.startDate);
          const end = new Date(u.endDate);
          return matchDate >= start && matchDate <= end;
        })
      )
        return false;
      if (
        matches.some(
          (m) =>
            m.id !== currentMatchForSelectionModal.id &&
            m.matchDate === currentMatchForSelectionModal.matchDate &&
            !m.isArchived &&
            m.assignments.some((a) => a.officialId === official.id)
        )
      )
        return false;
      return true;
    });
  }, [currentMatchForSelectionModal, officials, matches]);

  // --- Bulk Actions Logic ---
  const selectedMatches = useMemo(
    () =>
      Array.from(selectedMatchIds)
        .map((id) => matches.find((m) => m.id === id))
        .filter((m): m is Match => !!m),
    [selectedMatchIds, matches]
  );

  const getMatchEligibility = useCallback(
    (match: Match) => {
      const isLocked =
        match.accountingStatus === AccountingStatus.VALIDATED ||
        match.accountingStatus === AccountingStatus.CLOSED;
      const isMatchStateEditableForAssignments =
        match.status === MatchStatus.SCHEDULED && !isLocked;

      const areAllEmailsPresent = (() => {
        if (match.assignments.length === 0) return false;
        for (const assignment of match.assignments) {
          if (assignment.officialId) {
            const official = officials.find(
              (o) => o.id === assignment.officialId
            );
            if (
              !official ||
              typeof official.email !== "string" ||
              official.email.trim() === ""
            )
              return false;
          } else {
            return false;
          }
        }
        return true;
      })();

      const isStadiumLocationValid = !!(
        match.stadium && match.stadium.locationId
      );

      return {
        canSend:
          isMatchStateEditableForAssignments &&
          !match.isSheetSent &&
          areAllEmailsPresent &&
          isStadiumLocationValid,
        canNotify:
          isMatchStateEditableForAssignments &&
          match.hasUnsentChanges &&
          areAllEmailsPresent &&
          isStadiumLocationValid,
        canArchive: !isLocked,
      };
    },
    [officials]
  );

  const { canBulkSend, canBulkNotify, canBulkArchive } = useMemo(() => {
    if (selectedMatches.length === 0) {
      return {
        canBulkSend: false,
        canBulkNotify: false,
        canBulkArchive: false,
      };
    }
    const eligibilities = selectedMatches.map(getMatchEligibility);
    return {
      canBulkSend: eligibilities.every((e) => e.canSend),
      canBulkNotify: eligibilities.every((e) => e.canNotify),
      canBulkArchive: eligibilities.every((e) => e.canArchive),
    };
  }, [selectedMatches, getMatchEligibility]);

  const handleBulkActionTrigger = (action: "send" | "notify" | "archive") => {
    setBulkAction(action);
    setIsBulkConfirmOpen(true);
  };

  const handleBulkConfirm = () => {
    if (!bulkAction) return;
    const idsToProcess = Array.from(selectedMatchIds);
    if (bulkAction === "send") idsToProcess.forEach(onSendMatchSheet);
    else if (bulkAction === "notify") idsToProcess.forEach(onNotifyChanges);
    else if (bulkAction === "archive") idsToProcess.forEach(onArchiveMatch);
    setSelectedMatchIds(new Set());
    setIsBulkConfirmOpen(false);
    setBulkAction(null);
  };

  const bulkActionMessage = useMemo(() => {
    const count = selectedMatchIds.size;
    switch (bulkAction) {
      case "send":
        return `envoyer les feuilles de route pour ${count} matchs`;
      case "notify":
        return `notifier les changements pour ${count} matchs`;
      case "archive":
        return `archiver ${count} matchs`;
      default:
        return "";
    }
  }, [bulkAction, selectedMatchIds.size]);

  // --- Render ---
  const viewOptions = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
    { id: "calendar", label: "Calendrier", icon: CalendarIcon },
    { id: "official", label: "Par Officiel", icon: UsersIcon },
  ];

  let currentViewComponent;

  if (currentView === "gameDay" && gameDayFocusContext) {
    const gameDayMatches = matches.filter(
      (m) =>
        m.leagueGroup.id === gameDayFocusContext.leagueGroupId &&
        m.gameDay === gameDayFocusContext.gameDay
    );
    currentViewComponent = (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <GameDayFocusView
          matches={gameDayMatches}
          officials={officials}
          officialRoles={officialRoles}
          onUpdateAssignment={onUpdateAssignment}
          onAddAssignment={onAddAssignment}
          onGoBack={() => setCurrentView("dashboard")}
          permissions={permissions}
          onUpdateOfficialEmail={onUpdateOfficialEmail}
          onSendMatchSheet={onSendMatchSheet}
          locations={locations}
          onOpenStadiumModal={handleOpenStadiumModal}
        />
      </div>
    );
  } else if (currentView === "dayFocus" && dayFocusContext) {
    const formatDateKey = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d_ = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d_}`;
    };
    const dayMatches = filteredMatches.filter(
      (m) => m.matchDate === formatDateKey(dayFocusContext.date)
    );
    const formattedDate = dayFocusContext.date.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    currentViewComponent = (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <GameDayFocusView
          matches={dayMatches}
          title={formattedDate}
          officials={officials}
          officialRoles={officialRoles}
          onUpdateAssignment={onUpdateAssignment}
          onAddAssignment={onAddAssignment}
          onGoBack={() => setCurrentView(dayFocusOrigin)}
          permissions={permissions}
          onUpdateOfficialEmail={onUpdateOfficialEmail}
          onSendMatchSheet={onSendMatchSheet}
          locations={locations}
          onOpenStadiumModal={handleOpenStadiumModal}
        />
      </div>
    );
  } else {
    // This block now handles all three tabbed views
    let viewContentElement;

    if (currentView === "official") {
      viewContentElement = (
        <OfficialPlanningView
          officials={officials}
          matches={matches}
          onEditMatch={handleEditMatch}
          locations={locations}
        />
      );
    } else if (currentView === "calendar") {
      viewContentElement = (
        <CalendarView
          matches={matches}
          onEditMatch={handleEditMatch}
          onManageDay={handleManageDay}
        />
      );
    } else {
      // 'dashboard'
      // The original dashboard content, minus the tabs
      viewContentElement = (
        <div className="flex gap-6">
          <aside
            onMouseEnter={() => setIsSidebarExpanded(true)}
            onMouseLeave={() => setIsSidebarExpanded(false)}
            className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
              isSidebarExpanded ? "w-72" : "w-20"
            }`}
          >
            <div className="bg-gray-800 p-2 rounded-lg sticky top-52 h-[calc(100vh-240px)] overflow-y-auto">
              <div className="space-y-1">
                {isSidebarExpanded && (
                  <div className="p-2">
                    <h3 className="text-lg font-bold text-white mb-3">
                      Statistiques Rapides
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded-md">
                        <span className="text-sm text-gray-300">
                          À commencer
                        </span>
                        <span className="font-bold text-lg text-yellow-400">
                          {smartSummary.notStarted}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded-md">
                        <span className="text-sm text-gray-300">En cours</span>
                        <span className="font-bold text-lg text-orange-400">
                          {smartSummary.inProgress}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded-md">
                        <span className="text-sm text-gray-300">
                          Non notifiés
                        </span>
                        <span className="font-bold text-lg text-red-400">
                          {smartSummary.unsent.length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={
                    isSidebarExpanded
                      ? "pt-4 mt-4 border-t border-gray-700/50"
                      : "mt-2"
                  }
                >
                  {isSidebarExpanded && (
                    <h4 className="text-xs font-bold text-gray-500 uppercase px-2 pb-2">
                      Actions Requises
                    </h4>
                  )}
                  <button
                    title={
                      !isSidebarExpanded
                        ? `À Planifier (${totalUnscheduledGameDays})`
                        : ""
                    }
                    onClick={() => setActiveView({ type: "toPlan" })}
                    className={`w-full flex items-center p-3 rounded-md text-left font-semibold transition-colors ${
                      isSidebarExpanded ? "justify-between" : "justify-center"
                    } ${
                      activeView.type === "toPlan"
                        ? "bg-brand-primary/20 text-brand-primary"
                        : "hover:bg-gray-700/50 text-gray-200"
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="relative">
                        <ClipboardListIcon className="h-8 w-8 flex-shrink-0" />
                        {!isSidebarExpanded && totalUnscheduledGameDays > 0 && (
                          <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 min-w-[1.25rem] h-5 flex items-center justify-center text-xs bg-yellow-500 text-white px-1.5 rounded-full border-2 border-gray-800">
                            {totalUnscheduledGameDays}
                          </span>
                        )}
                      </div>
                      <span
                        className={`whitespace-nowrap transition-all duration-300 ${
                          isSidebarExpanded
                            ? "ml-3 opacity-100"
                            : "ml-0 w-0 opacity-0 overflow-hidden"
                        }`}
                      >
                        À Planifier
                      </span>
                    </div>
                    {isSidebarExpanded && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                        {totalUnscheduledGameDays}
                      </span>
                    )}
                  </button>
                  <button
                    title={
                      !isSidebarExpanded
                        ? `Urgents (${urgentMatches.length})`
                        : ""
                    }
                    onClick={() => setActiveView({ type: "urgent" })}
                    className={`w-full flex items-center p-3 rounded-md text-left font-semibold transition-colors ${
                      isSidebarExpanded ? "justify-between" : "justify-center"
                    } ${
                      activeView.type === "urgent"
                        ? "bg-brand-primary/20 text-brand-primary"
                        : "hover:bg-gray-700/50 text-gray-200"
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="relative">
                        <AlertTriangleIcon className="h-8 w-8 flex-shrink-0" />
                        {!isSidebarExpanded && urgentMatches.length > 0 && (
                          <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 min-w-[1.25rem] h-5 flex items-center justify-center text-xs bg-red-500 text-white px-1.5 rounded-full border-2 border-gray-800">
                            {urgentMatches.length}
                          </span>
                        )}
                      </div>
                      <span
                        className={`whitespace-nowrap transition-all duration-300 ${
                          isSidebarExpanded
                            ? "ml-3 opacity-100"
                            : "ml-0 w-0 opacity-0 overflow-hidden"
                        }`}
                      >
                        Urgents
                      </span>
                    </div>
                    {isSidebarExpanded && (
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                        {urgentMatches.length}
                      </span>
                    )}
                  </button>
                </div>

                <div
                  className={
                    isSidebarExpanded
                      ? "pt-4 mt-4 border-t border-gray-700/50"
                      : "mt-2"
                  }
                >
                  {isSidebarExpanded && (
                    <h4 className="text-xs font-bold text-gray-500 uppercase px-2 pb-2">
                      Vues Temporelles
                    </h4>
                  )}
                  <button
                    title={
                      !isSidebarExpanded
                        ? `Tous les Matchs (${filteredMatches.length})`
                        : ""
                    }
                    onClick={() => setActiveView({ type: "all" })}
                    className={`w-full flex items-center p-3 rounded-md text-left font-semibold transition-colors ${
                      isSidebarExpanded ? "justify-between" : "justify-center"
                    } ${
                      activeView.type === "all"
                        ? "bg-brand-primary/20 text-brand-primary"
                        : "hover:bg-gray-700/50 text-gray-200"
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="relative">
                        <CalendarIcon className="h-8 w-8 flex-shrink-0" />
                      </div>
                      <span
                        className={`whitespace-nowrap transition-all duration-300 ${
                          isSidebarExpanded
                            ? "ml-3 opacity-100"
                            : "ml-0 w-0 opacity-0 overflow-hidden"
                        }`}
                      >
                        Tous les Matchs
                      </span>
                    </div>
                    {isSidebarExpanded && (
                      <span
                        className={`text-xs bg-gray-600 px-2 py-0.5 rounded-full`}
                      >
                        {filteredMatches.length}
                      </span>
                    )}
                  </button>
                  <button
                    title={
                      !isSidebarExpanded
                        ? `Cette Semaine (${thisWeekMatches.length})`
                        : ""
                    }
                    onClick={() => setActiveView({ type: "week" })}
                    className={`w-full flex items-center p-3 rounded-md text-left font-semibold transition-colors ${
                      isSidebarExpanded ? "justify-between" : "justify-center"
                    } ${
                      activeView.type === "week"
                        ? "bg-brand-primary/20 text-brand-primary"
                        : "hover:bg-gray-700/50 text-gray-200"
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="relative">
                        <CalendarIcon className="h-8 w-8 flex-shrink-0" />
                        {!isSidebarExpanded && thisWeekMatches.length > 0 && (
                          <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 min-w-[1.25rem] h-5 flex items-center justify-center text-xs bg-blue-500 text-white px-1.5 rounded-full border-2 border-gray-800">
                            {thisWeekMatches.length}
                          </span>
                        )}
                      </div>
                      <span
                        className={`whitespace-nowrap transition-all duration-300 ${
                          isSidebarExpanded
                            ? "ml-3 opacity-100"
                            : "ml-0 w-0 opacity-0 overflow-hidden"
                        }`}
                      >
                        Cette Semaine
                      </span>
                    </div>
                    {isSidebarExpanded && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                        {thisWeekMatches.length}
                      </span>
                    )}
                  </button>
                </div>

                {isSidebarExpanded && (
                  <>
                    <div className="pt-4 mt-4 border-t border-gray-700/50">
                      <h4 className="text-xs font-bold text-gray-500 uppercase px-2 pb-2">
                        Parcourir
                      </h4>
                      <div className="space-y-1">
                        {leagues
                          .filter((l) => !l.parent_league_id)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((league) => (
                            <div key={league.id}>
                              <button
                                onClick={() => {
                                  setActiveView({
                                    type: "league",
                                    id: league.id,
                                  });
                                  setExpandedLeaguesNav((p) => ({
                                    ...p,
                                    [league.id]: !p[league.id],
                                  }));
                                }}
                                className={`w-full flex justify-between items-center p-3 rounded-md text-left font-semibold transition-colors ${
                                  activeView.type === "league" &&
                                  activeView.id === league.id
                                    ? "bg-brand-primary/20 text-brand-primary"
                                    : "hover:bg-gray-700/50 text-gray-200"
                                }`}
                              >
                                <span>{league.name}</span>
                                <ChevronDownIcon
                                  className={`h-5 w-5 transition-transform ${
                                    expandedLeaguesNav[league.id]
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>
                              {expandedLeaguesNav[league.id] && (
                                <div className="pl-4 py-1 space-y-1">
                                  {leagueGroups
                                    .filter(
                                      (g) =>
                                        g.league_id === league.id &&
                                        g.season === currentSeason
                                    )
                                    .sort((a, b) =>
                                      a.name.localeCompare(b.name)
                                    )
                                    .map((group) => (
                                      <button
                                        key={group.id}
                                        onClick={() =>
                                          setActiveView({
                                            type: "group",
                                            id: group.id,
                                          })
                                        }
                                        className={`w-full p-2 text-left text-sm rounded-md transition-colors ${
                                          activeView.type === "group" &&
                                          activeView.id === group.id
                                            ? "bg-brand-primary/20 text-brand-primary font-medium"
                                            : "hover:bg-gray-700/50 text-gray-300"
                                        }`}
                                      >
                                        {group.name}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-gray-700/50 p-2">
                      <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                        <TrendingUpIcon className="h-5 w-5 mr-2" />
                        Vue d'ensemble
                      </h3>
                      <div className="space-y-3">
                        {leagueProgress.map((l) => (
                          <div key={l.name}>
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span className="text-gray-300">{l.name}</span>
                              <span className="font-mono text-gray-400">
                                {l.progress}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-2 bg-brand-primary rounded-full transition-all duration-500"
                                style={{ width: `${l.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
          <main className="flex-grow">
            <MainContent
              activeView={activeView}
              viewContent={viewContentData}
              permissions={permissions}
              appliedFilters={appliedFilters}
              setAppliedFilters={setAppliedFilters}
              isFilterActive={isFilterActive}
              setIsFilterPanelOpen={setIsFilterPanelOpen}
              handleAddMatch={handleAddMatch}
              handleEditMatch={handleEditMatch}
              handleManageDay={handleManageDay}
              handleOpenGameDayFocus={handleOpenGameDayFocus}
              selectedMatchIds={selectedMatchIds}
              setSelectedMatchIds={setSelectedMatchIds}
              handleSelectMatch={handleSelectMatch}
              sortedPlanningLeagueIds={sortedPlanningLeagueIds}
              planningData={planningData}
              expandedPlanningLeagues={expandedPlanningLeagues}
              togglePlanningLeague={togglePlanningLeague}
              expandedPlanningGroups={expandedPlanningGroups}
              togglePlanningGroup={togglePlanningGroup}
              handleOpenGameDayModal={handleOpenGameDayModal}
              handleOpenAssignModalFromCard={handleOpenAssignModalFromCard}
              handleOpenScoreModal={handleOpenScoreModal}
              handleOpenStadiumModal={handleOpenStadiumModal}
              handleOpenAssignmentsModal={handleOpenAssignmentsModal}
              handleOpenQuickDateTimeModal={handleOpenQuickDateTimeModal}
              dashboardProps={props}
              initialListScroll={savedPlanningListScroll}
              onPersistListScroll={(y) => setSavedPlanningListScroll(y)}
            />
          </main>
        </div>
      );
    }

    currentViewComponent = (
      <>
        <div className="sticky top-16 bg-gray-900 z-20">
          <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-700">
            <div className="bg-gray-800 p-1 rounded-lg flex items-center">
              {viewOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setCurrentView(option.id as any)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center transition-colors ${
                    currentView === option.id
                      ? "bg-brand-primary text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <option.icon className="h-4 w-4 mr-2" />
                  {option.label}
                </button>
              ))}
              {/* Aujourd'hui button moved into MainContent toolbar */}
            </div>
          </div>
        </div>
        <div className="px-4 sm:px-6 lg:px-8 py-8">{viewContentElement}</div>
      </>
    );
  }

  // (Removed duplicated misplaced auto-scroll effect - logic resides in MainContent now)

  return (
    <>
      {currentViewComponent}
      {/* Modals */}
      <AssignmentModal
        isOpen={modalState.view === "selection"}
        onClose={handleCloseModals}
        onBack={
          modalState.view === "selection" && modalState.from === "assignments"
            ? () => handleBackToAssignments(modalState.matchId)
            : undefined
        }
        match={currentMatchForSelectionModal}
        role={modalState.view === "selection" ? modalState.role : null}
        availableOfficials={availableOfficials}
        onConfirmAssignment={handleConfirmAssignment}
        locations={locations}
      />
      <GameDaySchedulerModal
        isOpen={isGameDayModalOpen}
        onClose={() => setIsGameDayModalOpen(false)}
        onSave={onUpdateGameDaySchedule}
        context={gameDayContext}
      />
      <ScoreModal
        isOpen={isScoreModalOpen}
        onClose={handleCloseScoreModal}
        onSave={onUpdateMatchScoreAndStatus}
        match={matchForScore}
      />
      <CreateMatchModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSaveMatch={onSaveMatch}
        matchToEdit={editingMatch}
        teams={teams}
        stadiums={stadiums}
        leagues={leagues}
        leagueGroups={leagueGroups}
        matches={matches}
        isEditable={
          editingMatch
            ? editingMatch.status === MatchStatus.SCHEDULED &&
              editingMatch.accountingStatus === AccountingStatus.NOT_ENTERED
            : true
        }
        seasons={seasons}
        currentSeason={currentSeason}
        teamStadiums={teamStadiums}
        locations={locations}
      />
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        stadiums={stadiums}
        teams={teams}
        appliedFilters={appliedFilters}
        onApplyFilters={setAppliedFilters}
        onClearFilters={() => setAppliedFilters(initialFilters)}
      />
      <StadiumAssignmentModal
        isOpen={!!stadiumModalMatch}
        onClose={handleCloseStadiumModal}
        onSaveAssignment={handleSaveStadiumForMatch}
        onSaveStadium={onSaveStadium}
        match={stadiumModalMatch}
        stadiums={props.stadiums}
        locations={locations}
        permissions={permissions}
      />
      <MatchAssignmentsModal
        isOpen={modalState.view === "assignments"}
        onClose={handleCloseModals}
        match={currentMatchForAssignmentsModal}
        officials={officials}
        users={users}
        officialRoles={officialRoles}
        onAssign={handleNavigateToSelection}
        onAddAssignment={onAddAssignment}
        onRemoveAssignment={onRemoveAssignment}
        onMarkOfficialAbsent={onMarkOfficialAbsent}
        permissions={permissions}
        onPrintIndividualMissionOrder={onPrintIndividualMissionOrder}
        onSendIndividualMissionOrder={onSendIndividualMissionOrder}
        onSendAllMissionOrders={onSendAllMissionOrders}
        onUpdateAssignment={onUpdateAssignment}
      />
      <QuickDateTimeModal
        isOpen={!!quickDateTimeMatch}
        onClose={handleCloseQuickDateTimeModal}
        onSave={handleSaveQuickDateTime}
        match={quickDateTimeMatch}
      />

      {/* Bulk Action Bar */}
      {selectedMatchIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 shadow-lg z-20 animate-fade-in-up">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <p className="text-white font-medium">
              {selectedMatchIds.size} match(s) sélectionné(s)
            </p>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
              {canBulkSend && (
                <button
                  onClick={() => handleBulkActionTrigger("send")}
                  className="flex items-center text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                >
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" /> Envoyer les
                  Feuilles
                </button>
              )}
              {canBulkNotify && (
                <button
                  onClick={() => handleBulkActionTrigger("notify")}
                  className="flex items-center text-sm bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                >
                  <ExclamationCircleIcon className="h-5 w-5 mr-2" /> Notifier
                  des Changements
                </button>
              )}
              {canBulkArchive && (
                <button
                  onClick={() => handleBulkActionTrigger("archive")}
                  className="flex items-center text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
                >
                  <TrashIcon className="h-5 w-5 mr-2" /> Archiver
                </button>
              )}

              <button
                onClick={() => setSelectedMatchIds(new Set())}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
                title="Désélectionner tout"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isBulkConfirmOpen}
        onClose={() => setIsBulkConfirmOpen(false)}
        onConfirm={handleBulkConfirm}
        title="Confirmer l'Action en Masse"
        message={`Êtes-vous sûr de vouloir ${bulkActionMessage} ? Cette action est irréversible.`}
      />
    </>
  );
};

export default Dashboard;
