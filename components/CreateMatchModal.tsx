import React, { useState, useEffect, useMemo } from "react";
import {
  Match,
  Team,
  Stadium,
  League,
  LeagueGroup,
  TeamSeasonStadium,
  AccountingStatus,
  Location,
} from "../types";
import CloseIcon from "./icons/CloseIcon";
import DatePicker from "./DatePicker";
import ClockIcon from "./icons/ClockIcon";

interface CreateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  matchToEdit?: Match | null;
  teams: Team[];
  stadiums: Stadium[];
  leagues: League[];
  leagueGroups: LeagueGroup[];
  matches: Match[];
  isEditable: boolean;
  seasons: string[];
  currentSeason: string;
  teamStadiums: TeamSeasonStadium[];
  locations: Location[];
}

const CreateMatchModal: React.FC<CreateMatchModalProps> = ({
  isOpen,
  onClose,
  onSaveMatch,
  matchToEdit,
  teams,
  stadiums,
  leagues,
  leagueGroups,
  matches,
  isEditable,
  seasons,
  currentSeason,
  teamStadiums,
  locations,
}) => {
  const [season, setSeason] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [gameDay, setGameDay] = useState<number | "">(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [stadiumId, setStadiumId] = useState("");
  const [stadiumSearch, setStadiumSearch] = useState("");
  const [isStadiumDropdownOpen, setIsStadiumDropdownOpen] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!matchToEdit;

  const locationMap = useMemo(
    () => new Map(locations.map((loc) => [loc.id, loc])),
    [locations]
  );
  const formatLocation = (locationId: string | null): string => {
    if (!locationId) return "";
    const location = locationMap.get(locationId);
    if (!location) return "Inconnue";
    if (location.wilaya_ar && location.commune_ar) {
      return `${location.wilaya_ar} - ${location.commune_ar}`;
    }
    return [location.wilaya, location.daira, location.commune]
      .filter(Boolean)
      .join(" / ");
  };

  const availableGroups = useMemo(() => {
    return leagueGroups.filter(
      (g) => g.league_id === selectedLeagueId && g.season === season
    );
  }, [leagueGroups, selectedLeagueId, season]);

  const availableTeams = useMemo(() => {
    const activeTeams = teams.filter((t) => !t.isArchived);
    if (!selectedGroupId) {
      return activeTeams; // Return all teams if no group is selected
    }
    const selectedGroup = leagueGroups.find((g) => g.id === selectedGroupId);
    if (
      !selectedGroup ||
      !selectedGroup.teamIds ||
      selectedGroup.teamIds.length === 0
    ) {
      return activeTeams; // Return all teams if group has no teams assigned
    }
    const groupTeamIds = new Set(selectedGroup.teamIds);
    return activeTeams.filter((team) => groupTeamIds.has(team.id));
  }, [teams, selectedGroupId, leagueGroups]);

  const availableHomeTeams = useMemo(() => {
    if (!awayTeamId) return availableTeams;
    return availableTeams.filter((team) => team.id !== awayTeamId);
  }, [availableTeams, awayTeamId]);

  const availableAwayTeams = useMemo(() => {
    if (!homeTeamId) return availableTeams;
    return availableTeams.filter((team) => team.id !== homeTeamId);
  }, [availableTeams, homeTeamId]);

  const selectedStadium = useMemo(
    () => stadiums.find((s) => s.id === stadiumId),
    [stadiumId, stadiums]
  );

  const groupedStadiums = useMemo(() => {
    const normalize = (str: string | null): string =>
      (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const searchTermNormalized = normalize(stadiumSearch);

    const filtered = stadiums.filter(
      (stadium) =>
        !stadium.isArchived &&
        (normalize(stadium.name).includes(searchTermNormalized) ||
          normalize(formatLocation(stadium.locationId)).includes(
            searchTermNormalized
          ))
    );

    return filtered.reduce((acc, stadium) => {
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
  }, [stadiums, stadiumSearch, locationMap, formatLocation]);

  const handleStadiumSelect = (stadium: Stadium) => {
    setStadiumId(stadium.id);
    setStadiumSearch("");
    setIsStadiumDropdownOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        setSeason(matchToEdit.season);
        setSelectedLeagueId(matchToEdit.leagueGroup.league.id);
        setSelectedGroupId(matchToEdit.leagueGroup.id);
        setGameDay(matchToEdit.gameDay);
        setDate(matchToEdit.matchDate || "");
        setTime(matchToEdit.matchTime || "");
        setHomeTeamId(matchToEdit.homeTeam.id);
        setAwayTeamId(matchToEdit.awayTeam.id);
        setStadiumId(matchToEdit.stadium?.id || "");
      } else {
        // Reset form for creation
        setSeason(currentSeason);
        const firstLeagueId = leagues[0]?.id || "";
        setSelectedLeagueId(firstLeagueId);
        const firstGroup = leagueGroups.find(
          (g) => g.league_id === firstLeagueId && g.season === currentSeason
        );
        setSelectedGroupId(firstGroup?.id || "");
        setGameDay(1);
        setDate("");
        setTime("");
        setHomeTeamId("");
        setAwayTeamId("");
        setStadiumId("");
      }
      setError("");
    }
  }, [
    matchToEdit,
    isEditing,
    isOpen,
    stadiums,
    leagues,
    leagueGroups,
    currentSeason,
  ]);

  useEffect(() => {
    if (homeTeamId && season) {
      const association = teamStadiums.find(
        (ts) => ts.teamId === homeTeamId && ts.season === season
      );
      if (association && stadiums.some((s) => s.id === association.stadiumId)) {
        setStadiumId(association.stadiumId);
      } else {
        setStadiumId("");
      }
    } else if (!homeTeamId) {
      setStadiumId("");
    }
  }, [homeTeamId, season, teamStadiums, stadiums]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;

    if (
      !season ||
      !selectedLeagueId ||
      !selectedGroupId ||
      !gameDay ||
      !homeTeamId ||
      !awayTeamId
    ) {
      setError(
        "Veuillez remplir au minimum: Saison, Journée, Ligue, Groupe et les deux Équipes."
      );
      return;
    }
    if (gameDay < 1) {
      setError("La journée doit être un nombre positif.");
      return;
    }
    if (homeTeamId === awayTeamId) {
      setError(
        "Les équipes à domicile et à l'extérieur doivent être différentes."
      );
      return;
    }
    if (
      date &&
      matches.some(
        (m) =>
          m.homeTeam.id === homeTeamId &&
          m.awayTeam.id === awayTeamId &&
          m.matchDate === date &&
          m.id !== matchToEdit?.id
      )
    ) {
      setError("Un match identique (mêmes équipes, même date) existe déjà.");
      return;
    }
    setError("");

    const leagueGroup = leagueGroups.find((lg) => lg.id === selectedGroupId)!;
    const league = leagues.find((l) => l.id === leagueGroup.league_id)!;
    const homeTeam = teams.find((t) => t.id === homeTeamId)!;
    const awayTeam = teams.find((t) => t.id === awayTeamId)!;
    const stadium = stadiumId ? stadiums.find((s) => s.id === stadiumId) : null;

    if (!homeTeam || !awayTeam || !leagueGroup || !league) {
      setError(
        "Données de base invalides (équipe, ligue ou groupe non trouvé)."
      );
      return;
    }

    const matchData = {
      id: isEditing ? matchToEdit.id : undefined,
      season,
      leagueGroup: {
        id: leagueGroup.id,
        name: leagueGroup.name,
        // FIX: Add missing name_ar property to align with Match type
        name_ar: leagueGroup.name_ar,
        league: {
          id: league.id,
          name: league.name,
          // FIX: Add missing name_ar property to align with Match type
          name_ar: league.name_ar,
        },
      },
      gameDay: Number(gameDay),
      matchDate: date || null,
      matchTime: time || null,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      stadium: stadium,
      homeScore: matchToEdit?.homeScore ?? null,
      awayScore: matchToEdit?.awayScore ?? null,
      accountingStatus:
        matchToEdit?.accountingStatus || AccountingStatus.NOT_ENTERED,
      rejectionReason: matchToEdit?.rejectionReason || null,
      rejectionComment: matchToEdit?.rejectionComment || null,
      validatedBy: matchToEdit?.validatedBy || null,
      validatedByName: matchToEdit?.validatedByName,
      validatedAt: matchToEdit?.validatedAt || null,
      accountingPeriodId: matchToEdit?.accountingPeriodId || null,
      createdBy: isEditing ? matchToEdit.createdBy : undefined,
    };

    onSaveMatch(matchData);
    onClose();
  };

  if (!isOpen) return null;

  const formDisabled = isEditing && !isEditable;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all duration-300">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? "Détails du match" : "Créer un nouveau match"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {formDisabled && (
              <p className="text-yellow-300 bg-yellow-900/50 p-3 rounded-md text-sm">
                Les modifications sont désactivées car le statut du match n'est
                pas "Prévu".
              </p>
            )}
            {error && (
              <p className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="season"
                  className="block text-sm font-medium text-gray-300"
                >
                  Saison
                </label>
                <select
                  id="season"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  disabled={formDisabled}
                  className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="gameDay"
                  className="block text-sm font-medium text-gray-300"
                >
                  Journée
                </label>
                <input
                  type="number"
                  id="gameDay"
                  value={gameDay}
                  onChange={(e) =>
                    setGameDay(e.target.value ? parseInt(e.target.value) : "")
                  }
                  disabled={formDisabled}
                  min="1"
                  className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="league"
                  className="block text-sm font-medium text-gray-300"
                >
                  Ligue
                </label>
                <select
                  id="league"
                  value={selectedLeagueId}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  disabled={formDisabled}
                  className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                >
                  <option value="">Sélectionner une ligue</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="group"
                  className="block text-sm font-medium text-gray-300"
                >
                  Groupe
                </label>
                <select
                  id="group"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  disabled={formDisabled || !selectedLeagueId}
                  className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                >
                  <option value="">Sélectionner un groupe</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-300"
                >
                  Date
                </label>
                <DatePicker
                  id="date"
                  value={date}
                  onChange={setDate}
                  disabled={formDisabled}
                />
              </div>
              <div>
                <label
                  htmlFor="time"
                  className="block text-sm font-medium text-gray-300"
                >
                  Heure
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="time"
                    id="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={formDisabled}
                    className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 pl-10 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="homeTeam"
                  className="block text-sm font-medium text-gray-300"
                >
                  Équipe Domicile
                </label>
                <select
                  id="homeTeam"
                  value={homeTeamId}
                  onChange={(e) => setHomeTeamId(e.target.value)}
                  disabled={formDisabled}
                  className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                >
                  <option value="">Sélectionner une équipe</option>
                  {availableHomeTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="awayTeam"
                  className="block text-sm font-medium text-gray-300"
                >
                  Équipe Extérieur
                </label>
                <select
                  id="awayTeam"
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  disabled={formDisabled}
                  className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                >
                  <option value="">Sélectionner une équipe</option>
                  {availableAwayTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <label
                htmlFor="stadium-search"
                className="block text-sm font-medium text-gray-300"
              >
                Stade
              </label>
              <div className="relative mt-1">
                <input
                  id="stadium-search"
                  type="text"
                  placeholder={
                    stadiumId
                      ? selectedStadium?.name || ""
                      : "Rechercher un stade..."
                  }
                  value={stadiumSearch}
                  onChange={(e) => {
                    setStadiumSearch(e.target.value);
                    setIsStadiumDropdownOpen(true);
                    if (stadiumId) setStadiumId("");
                  }}
                  onFocus={() => {
                    setIsStadiumDropdownOpen(true);
                    setStadiumSearch("");
                  }}
                  onBlur={() =>
                    setTimeout(() => setIsStadiumDropdownOpen(false), 200)
                  }
                  disabled={formDisabled}
                  className="block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-700"
                />
                {stadiumId && (
                  <button
                    type="button"
                    onClick={() => {
                      setStadiumId("");
                      setStadiumSearch("");
                    }}
                    disabled={formDisabled}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white disabled:cursor-not-allowed"
                    aria-label="Effacer la sélection"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {isStadiumDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                  {Object.keys(groupedStadiums).length === 0 && (
                    <div className="px-4 py-2 text-sm text-gray-400">
                      Aucun stade trouvé.
                    </div>
                  )}
                  {Object.entries(groupedStadiums)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([wilaya, stadia]) => (
                      <div key={wilaya}>
                        <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase">
                          {wilaya}
                        </div>
                        {stadia.map((stadium) => (
                          <button
                            type="button"
                            key={stadium.id}
                            onClick={() => handleStadiumSelect(stadium)}
                            className="text-left w-full px-4 py-2 text-sm text-white hover:bg-brand-primary/20"
                          >
                            {stadium.name}{" "}
                            <span className="text-gray-400 text-xs">
                              ({formatLocation(stadium.locationId)})
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
            {isEditing && matchToEdit.createdAt && (
              <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 space-y-1">
                <p>
                  Créé le:{" "}
                  {new Date(matchToEdit.createdAt).toLocaleString("fr-FR")} par{" "}
                  {matchToEdit.createdByName}
                </p>
                {matchToEdit.updatedAt && matchToEdit.updatedByName && (
                  <p>
                    Dernière modification:{" "}
                    {new Date(matchToEdit.updatedAt).toLocaleString("fr-FR")}{" "}
                    par {matchToEdit.updatedByName}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="p-6 bg-gray-900/50 rounded-b-lg flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg mr-2 hover:bg-gray-500"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={formDisabled}
              className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isEditing ? "Sauvegarder" : "Créer le match"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMatchModal;
