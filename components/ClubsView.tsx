import React, { useState, useMemo, useCallback, useRef } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Team,
  Stadium,
  User,
  Location,
  League,
  LeagueGroup,
  TeamHistoryEntry,
  TeamSeasonStadium,
} from "../types";
import PlusIcon from "./icons/PlusIcon";
import PencilIcon from "./icons/PencilIcon";
import TeamModal from "./TeamModal";
import StadiumModal from "./StadiumModal";
import ConfirmationModal from "./ConfirmationModal";
import TrashIcon from "./icons/TrashIcon";
import { Permissions } from "../hooks/usePermissions";
import SearchIcon from "./icons/SearchIcon";
import ChevronDownIcon from "./icons/ChevronDownIcon";
import AlertTriangleIcon from "./icons/AlertTriangleIcon";
import QuickStadiumAssignModal from "./QuickStadiumAssignModal";

interface ClubsViewProps {
  teams: Team[];
  stadiums: Stadium[];
  leagues: League[];
  leagueGroups: LeagueGroup[];
  teamStadiums: TeamSeasonStadium[];
  onSaveTeam: (team: Team) => void;
  onSaveStadium: (stadium: Stadium) => void;
  onSetTeamHomeStadium: (data: {
    teamId: string;
    stadiumId: string | null;
    season: string;
  }) => void;
  onArchiveTeam: (teamId: string) => void;
  onArchiveStadium: (stadiumId: string) => void;
  currentUser: User;
  permissions: Permissions;
  localisations: Location[];
  currentSeason: string;
}

interface TeamStructure {
  [leagueId: string]: {
    league: League;
    groups: {
      [groupId: string]: {
        group: LeagueGroup;
        teams: Team[];
      };
    };
  };
}

const VirtualStadiumList: React.FC<{
  stadiums: Stadium[];
  canArchive: boolean;
  onEdit: (stadium: Stadium) => void;
  onArchive: (stadium: Stadium) => void;
  formatLocation: (locationId: string | null) => string;
}> = ({ stadiums, canArchive, onEdit, onArchive, formatLocation }) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: stadiums.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 8,
  });

  if (stadiums.length === 0) {
    return <div className="text-center py-4 text-gray-400">Aucun stade</div>;
  }

  return (
    <div
      ref={parentRef}
      className="h-[400px] overflow-auto rounded-md bg-transparent"
    >
      <div
        style={{ height: rowVirtualizer.getTotalSize() }}
        className="relative"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const stadium = stadiums[virtualRow.index];
          return (
            <div
              key={stadium.id}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div className="p-2 flex items-center justify-between bg-gray-900/50 hover:bg-gray-900 rounded-md mb-2">
                <div
                  className="flex-grow cursor-pointer"
                  onClick={() => onEdit(stadium)}
                >
                  <p className="font-medium text-white">{stadium.name}</p>
                  <p className="text-sm text-gray-400">
                    {formatLocation(stadium.locationId)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {canArchive && (
                    <button
                      onClick={() => onArchive(stadium)}
                      className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-gray-700 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ClubsView: React.FC<ClubsViewProps> = (props) => {
  const {
    teams,
    stadiums,
    leagues,
    leagueGroups,
    teamStadiums,
    onSaveTeam,
    onSaveStadium,
    onSetTeamHomeStadium,
    onArchiveTeam,
    onArchiveStadium,
    currentUser,
    permissions,
    localisations,
    currentSeason,
  } = props;

  const [activeTab, setActiveTab] = useState<"teams" | "stadiums">("teams");
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isStadiumModalOpen, setIsStadiumModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingStadium, setEditingStadium] = useState<Stadium | null>(null);
  const [itemToArchive, setItemToArchive] = useState<{
    type: "team" | "stadium";
    item: Team | Stadium;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedTeamSearch = useDebounce(searchTerm, 300);
  const [stadiumSearchTerm, setStadiumSearchTerm] = useState("");
  const debouncedStadiumSearch = useDebounce(stadiumSearchTerm, 300);
  const [expandedLeagues, setExpandedLeagues] = useState<
    Record<string, boolean>
  >({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(false);
  const [stadiumAssignTeam, setStadiumAssignTeam] = useState<Team | null>(null);
  const [expandedWilayas, setExpandedWilayas] = useState<
    Record<string, boolean>
  >({});

  const canEdit = permissions.can("edit", "club_or_stadium");
  const canArchive = permissions.can("archive", "club_or_stadium");

  const locationMap = useMemo(
    () => new Map(localisations.map((loc) => [loc.id, loc])),
    [localisations]
  );
  const formatLocation = useCallback(
    (locationId: string | null): string => {
      if (!locationId) return "Non spécifiée";
      const location = locationMap.get(locationId);
      if (!location) return "Inconnue";
      if (location.wilaya_ar && location.commune_ar) {
        return `${location.wilaya_ar} - ${location.commune_ar}`;
      }
      return [location.wilaya, location.daira, location.commune]
        .filter(Boolean)
        .join(" / ");
    },
    [locationMap]
  );

  const teamHasStadium = useCallback(
    (teamId: string) => {
      return teamStadiums.some(
        (ts) => ts.teamId === teamId && ts.season === currentSeason
      );
    },
    [teamStadiums, currentSeason]
  );

  const { teamStructure, teamHistory, unassignedTeams } = useMemo(() => {
    const history: Record<string, TeamHistoryEntry[]> = {};
    teams.forEach((t) => (history[t.id] = []));

    const leagueMap = new Map(leagues.map((l) => [l.id, l]));

    leagueGroups.forEach((group) => {
      const league = leagueMap.get(group.league_id);
      if (league) {
        (group.teamIds || []).forEach((teamId) => {
          if (history[teamId]) {
            history[teamId].push({
              season: group.season,
              leagueName: league.name,
              groupName: group.name,
            });
          }
        });
      }
    });

    Object.values(history).forEach((h) =>
      h.sort((a, b) => b.season.localeCompare(a.season))
    );

    const structure: TeamStructure = {};
    const groupsForSeason = leagueGroups.filter(
      (g) => g.season === currentSeason
    );
    const assignedTeamIdsInSeason = new Set<string>();

    groupsForSeason.forEach((group) => {
      const league = leagueMap.get(group.league_id);
      if (league) {
        if (!structure[league.id]) {
          structure[league.id] = { league, groups: {} };
        }

        const groupTeams = (group.teamIds || [])
          .map((id) => {
            assignedTeamIdsInSeason.add(id);
            return teams.find((t) => t.id === id);
          })
          .filter((t): t is Team => !!t && !t.isArchived);

        if (groupTeams.length > 0) {
          structure[league.id].groups[group.id] = {
            group,
            teams: groupTeams.sort((a, b) => a.name.localeCompare(b.name)),
          };
        }
      }
    });

    const unassigned = teams.filter(
      (t) => !t.isArchived && !assignedTeamIdsInSeason.has(t.id)
    );

    return {
      teamStructure: structure,
      teamHistory: history,
      unassignedTeams: unassigned,
    };
  }, [teams, leagues, leagueGroups, currentSeason]);

  const filteredStructure = useMemo(() => {
    const normalize = (str: string | null | undefined): string =>
      (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const searchKeywords = normalize(debouncedTeamSearch)
      .split(" ")
      .filter(Boolean);

    if (searchKeywords.length === 0) return teamStructure;

    const newStructure: TeamStructure = {};

    for (const leagueId in teamStructure) {
      const { league, groups } = teamStructure[leagueId];
      const newGroups: typeof groups = {};
      let leagueHasMatch = false;

      for (const groupId in groups) {
        const { group, teams: groupTeams } = groups[groupId];
        const filteredTeams = groupTeams.filter((t) => {
          const searchableText = [
            normalize(t.name),
            normalize(t.fullName),
          ].join(" ");
          return searchKeywords.every((keyword) =>
            searchableText.includes(keyword)
          );
        });
        if (filteredTeams.length > 0) {
          newGroups[groupId] = { group, teams: filteredTeams };
          leagueHasMatch = true;
        }
      }

      if (leagueHasMatch) {
        newStructure[leagueId] = { league, groups: newGroups };
      }
    }
    return newStructure;
  }, [teamStructure, debouncedTeamSearch]);

  const filteredUnassignedTeams = useMemo(() => {
    const normalize = (str: string | null | undefined): string =>
      (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const searchKeywords = normalize(debouncedTeamSearch)
      .split(" ")
      .filter(Boolean);
    if (searchKeywords.length === 0) return unassignedTeams;

    return unassignedTeams.filter((t) => {
      const searchableText = [normalize(t.name), normalize(t.fullName)].join(
        " "
      );
      return searchKeywords.every((keyword) =>
        searchableText.includes(keyword)
      );
    });
  }, [unassignedTeams, debouncedTeamSearch]);

  const sortedLeagueIds = useMemo(
    () =>
      Object.keys(filteredStructure).sort((a, b) =>
        filteredStructure[a].league.name.localeCompare(
          filteredStructure[b].league.name
        )
      ),
    [filteredStructure]
  );

  const handleEditTeam = useCallback((team: Team) => {
    setEditingTeam(team);
    setIsTeamModalOpen(true);
  }, []);

  const handleAddTeam = useCallback(() => {
    setEditingTeam(null);
    setIsTeamModalOpen(true);
  }, []);

  const handleEditStadium = useCallback((stadium: Stadium) => {
    setEditingStadium(stadium);
    setIsStadiumModalOpen(true);
  }, []);

  const handleAddStadium = useCallback(() => {
    setEditingStadium(null);
    setIsStadiumModalOpen(true);
  }, []);

  const handleConfirmArchive = () => {
    if (!itemToArchive) return;
    if (itemToArchive.type === "team") {
      onArchiveTeam(itemToArchive.item.id);
    } else {
      onArchiveStadium(itemToArchive.item.id);
    }
    setItemToArchive(null);
  };

  const filteredStadiums = useMemo(() => {
    const normalize = (str: string | null | undefined): string =>
      (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const searchKeywords = normalize(debouncedStadiumSearch)
      .split(" ")
      .filter(Boolean);

    return stadiums
      .filter((s) => !s.isArchived)
      .filter((stadium) => {
        if (searchKeywords.length === 0) return true;

        const searchableText = [
          normalize(stadium.name),
          normalize(formatLocation(stadium.locationId)),
        ].join(" ");

        return searchKeywords.every((keyword) =>
          searchableText.includes(keyword)
        );
      });
  }, [stadiums, debouncedStadiumSearch, formatLocation]);

  const groupedStadiums = useMemo(() => {
    return filteredStadiums.reduce((acc, stadium) => {
      const location = stadium.locationId
        ? locationMap.get(stadium.locationId)
        : null;
      const wilaya =
        location?.wilaya_ar?.trim() ||
        location?.wilaya?.trim() ||
        "Non spécifié";
      if (!acc[wilaya]) {
        acc[wilaya] = [];
      }
      acc[wilaya].push(stadium);
      return acc;
    }, {} as Record<string, Stadium[]>);
  }, [filteredStadiums, locationMap]);

  const sortedWilayas = useMemo(() => {
    return Object.keys(groupedStadiums).sort((a, b) => a.localeCompare(b));
  }, [groupedStadiums]);

  const handleOpenStadiumAssignModal = useCallback((team: Team) => {
    setStadiumAssignTeam(team);
  }, []);

  const handleCloseStadiumAssignModal = useCallback(() => {
    setStadiumAssignTeam(null);
  }, []);

  const handleSaveStadiumAssignment = useCallback(
    (stadiumId: string | null) => {
      if (stadiumAssignTeam) {
        onSetTeamHomeStadium({
          teamId: stadiumAssignTeam.id,
          stadiumId,
          season: currentSeason,
        });
      }
      handleCloseStadiumAssignModal();
    },
    [
      stadiumAssignTeam,
      onSetTeamHomeStadium,
      currentSeason,
      handleCloseStadiumAssignModal,
    ]
  );

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-white mb-6">Clubs & Stades</h2>
      <div className="border-b border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("teams")}
            className={`${
              activeTab === "teams"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
          >
            Équipes par ligue
          </button>
          <button
            onClick={() => setActiveTab("stadiums")}
            className={`${
              activeTab === "stadiums"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
          >
            Stades
          </button>
        </nav>
      </div>

      {activeTab === "teams" && (
        <div>
          <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-grow w-full sm:w-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher une équipe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            {canEdit && (
              <button
                onClick={handleAddTeam}
                className="flex-shrink-0 flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                <PlusIcon className="h-5 w-5 mr-2" /> Ajouter une Équipe
              </button>
            )}
          </div>
          <div className="space-y-4">
            {sortedLeagueIds.length === 0 &&
            filteredUnassignedTeams.length === 0 ? (
              <div className="text-center py-8 bg-gray-800 rounded-lg">
                <p className="text-gray-400">
                  {searchTerm
                    ? "Aucune équipe ne correspond à votre recherche."
                    : "Aucune équipe n'a été ajoutée."}
                </p>
              </div>
            ) : (
              <>
                {sortedLeagueIds.map((leagueId) => {
                  const { league, groups } = filteredStructure[leagueId];
                  const isExpanded =
                    expandedLeagues[leagueId] ?? sortedLeagueIds.length === 1;
                  const sortedGroupIds = Object.keys(groups).sort((a, b) =>
                    groups[a].group.name.localeCompare(groups[b].group.name)
                  );
                  return (
                    <div key={leagueId} className="bg-gray-800 rounded-lg">
                      <button
                        onClick={() =>
                          setExpandedLeagues((p) => ({
                            ...p,
                            [leagueId]: !isExpanded,
                          }))
                        }
                        className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/80 rounded-t-lg"
                      >
                        <h3 className="text-xl font-semibold text-white">
                          {league.name}
                        </h3>
                        <ChevronDownIcon
                          className={`h-6 w-6 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {sortedGroupIds.map((groupId) => {
                            const { group, teams: groupTeams } =
                              groups[groupId];
                            const isGroupExpanded =
                              expandedGroups[groupId] ??
                              sortedGroupIds.length === 1;

                            return (
                              <div
                                key={groupId}
                                className="bg-gray-900/50 rounded-lg p-3"
                              >
                                <button
                                  onClick={() =>
                                    setExpandedGroups((p) => ({
                                      ...p,
                                      [groupId]: !isGroupExpanded,
                                    }))
                                  }
                                  className="w-full flex items-center justify-between text-left p-1 -m-1 rounded-md hover:bg-gray-700/50 transition-colors"
                                >
                                  <h4 className="text-md font-semibold text-brand-primary">
                                    {group.name} ({groupTeams.length})
                                  </h4>
                                  <ChevronDownIcon
                                    className={`h-5 w-5 text-gray-400 transition-transform ${
                                      isGroupExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                                {isGroupExpanded && (
                                  <ul className="space-y-2 mt-3">
                                    {groupTeams.map((team) => {
                                      const hasStadium = teamHasStadium(
                                        team.id
                                      );
                                      return (
                                        <li
                                          key={team.id}
                                          className="p-2 flex items-center justify-between bg-gray-900/70 hover:bg-gray-900 rounded-md"
                                        >
                                          <div
                                            className="flex items-center text-left flex-grow"
                                            onClick={() => handleEditTeam(team)}
                                          >
                                            <img
                                              src={team.logoUrl || undefined}
                                              alt={team.name}
                                              className="w-8 h-8 rounded-full bg-gray-600 object-cover cursor-pointer"
                                            />
                                            <div className="ml-3 cursor-pointer">
                                              <span className="font-medium text-white text-sm">
                                                {team.name}
                                              </span>
                                              {team.fullName && (
                                                <p className="text-xs text-gray-400">
                                                  {team.fullName}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center flex-shrink-0">
                                            {!hasStadium && (
                                              <button
                                                onClick={() =>
                                                  handleOpenStadiumAssignModal(
                                                    team
                                                  )
                                                }
                                                className="group relative p-1.5 rounded-full hover:bg-yellow-500/10 transition-colors"
                                              >
                                                <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                                  Aucun stade à domicile.
                                                  Cliquez pour assigner.
                                                </div>
                                              </button>
                                            )}
                                            {canArchive && (
                                              <button
                                                onClick={() =>
                                                  setItemToArchive({
                                                    type: "team",
                                                    item: team,
                                                  })
                                                }
                                                className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-gray-700 transition-colors"
                                              >
                                                <TrashIcon className="h-4 w-4" />
                                              </button>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredUnassignedTeams.length > 0 && (
                  <div className="bg-gray-800 rounded-lg">
                    <button
                      onClick={() => setIsUnassignedExpanded((p) => !p)}
                      className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/80 rounded-t-lg"
                    >
                      <h3 className="text-xl font-semibold text-white">
                        Équipes sans groupe ({filteredUnassignedTeams.length})
                      </h3>
                      <ChevronDownIcon
                        className={`h-6 w-6 text-gray-400 transition-transform ${
                          isUnassignedExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isUnassignedExpanded && (
                      <div className="p-4">
                        <ul className="space-y-2">
                          {filteredUnassignedTeams.map((team) => {
                            const hasStadium = teamHasStadium(team.id);
                            return (
                              <li
                                key={team.id}
                                className="p-2 flex items-center justify-between bg-gray-900/50 hover:bg-gray-900 rounded-md"
                              >
                                <div
                                  className="flex items-center text-left flex-grow"
                                  onClick={() => handleEditTeam(team)}
                                >
                                  <img
                                    src={team.logoUrl || undefined}
                                    alt={team.name}
                                    className="w-8 h-8 rounded-full bg-gray-600 object-cover cursor-pointer"
                                  />
                                  <div className="ml-3 cursor-pointer">
                                    <span className="font-medium text-white text-sm">
                                      {team.name}
                                    </span>
                                    {team.fullName && (
                                      <p className="text-xs text-gray-400">
                                        {team.fullName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center flex-shrink-0">
                                  {!hasStadium && (
                                    <button
                                      onClick={() =>
                                        handleOpenStadiumAssignModal(team)
                                      }
                                      className="group relative p-1.5 rounded-full hover:bg-yellow-500/10 transition-colors"
                                    >
                                      <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                        Aucun stade à domicile. Cliquez pour
                                        assigner.
                                      </div>
                                    </button>
                                  )}
                                  {canArchive && (
                                    <button
                                      onClick={() =>
                                        setItemToArchive({
                                          type: "team",
                                          item: team,
                                        })
                                      }
                                      className="text-red-400 hover:text-red-300 p-2 rounded-full hover:bg-gray-700 transition-colors"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "stadiums" && (
        <div>
          <div className="bg-gray-800 p-4 rounded-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-grow w-full sm:w-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher par nom ou localité..."
                value={stadiumSearchTerm}
                onChange={(e) => setStadiumSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            {canEdit && (
              <button
                onClick={handleAddStadium}
                className="flex-shrink-0 flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                <PlusIcon className="h-5 w-5 mr-2" /> Ajouter un Stade
              </button>
            )}
          </div>
          <div className="space-y-4">
            {sortedWilayas.length > 0 ? (
              sortedWilayas.map((wilaya) => {
                const isExpanded = expandedWilayas[wilaya] ?? true;
                const stadiumsInWilaya = (groupedStadiums[wilaya] || []).sort(
                  (a, b) => a.name.localeCompare(b.name)
                );
                return (
                  <div key={wilaya} className="bg-gray-800 rounded-lg">
                    <button
                      onClick={() =>
                        setExpandedWilayas((p) => ({
                          ...p,
                          [wilaya]: !isExpanded,
                        }))
                      }
                      className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/80 rounded-t-lg"
                    >
                      <h3 className="text-xl font-semibold text-white">
                        {wilaya}{" "}
                        <span className="text-sm font-normal text-gray-400">
                          ({stadiumsInWilaya.length})
                        </span>
                      </h3>
                      <ChevronDownIcon
                        className={`h-6 w-6 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="p-4">
                        <VirtualStadiumList
                          stadiums={stadiumsInWilaya}
                          canArchive={canArchive}
                          onEdit={handleEditStadium}
                          onArchive={(stadium) =>
                            setItemToArchive({ type: "stadium", item: stadium })
                          }
                          formatLocation={formatLocation}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 bg-gray-800 rounded-lg">
                <p className="text-gray-400">
                  {stadiumSearchTerm
                    ? "Aucun stade ne correspond à votre recherche."
                    : "Aucun stade n'a été ajouté."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        onSave={onSaveTeam}
        teamToEdit={editingTeam}
        teams={teams}
        history={editingTeam ? teamHistory[editingTeam.id] || [] : []}
        stadiums={stadiums}
        currentSeason={currentSeason}
        teamStadiums={teamStadiums}
        onSetTeamHomeStadium={onSetTeamHomeStadium}
        localisations={localisations}
      />
      <StadiumModal
        isOpen={isStadiumModalOpen}
        onClose={() => setIsStadiumModalOpen(false)}
        onSave={onSaveStadium}
        stadiumToEdit={editingStadium}
        localisations={localisations}
        stadiums={stadiums}
      />
      <ConfirmationModal
        isOpen={!!itemToArchive}
        onClose={() => setItemToArchive(null)}
        onConfirm={handleConfirmArchive}
        title={`Archiver ${itemToArchive?.item.name}`}
        message={`Êtes-vous sûr de vouloir archiver ${
          itemToArchive?.type === "team" ? "cette équipe" : "ce stade"
        } ? ${
          itemToArchive?.type === "team"
            ? "Elle ne pourra plus être sélectionnée pour des matchs."
            : "Il ne pourra plus être sélectionné pour des matchs."
        }`}
      />
      <QuickStadiumAssignModal
        isOpen={!!stadiumAssignTeam}
        onClose={handleCloseStadiumAssignModal}
        onSave={handleSaveStadiumAssignment}
        team={stadiumAssignTeam}
        stadiums={stadiums}
        localisations={localisations}
      />
    </main>
  );
};
export default ClubsView;
