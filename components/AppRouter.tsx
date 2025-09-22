// components/AppRouter.tsx

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./Header";
import Dashboard from "./Dashboard";
import OfficialsView from "./OfficialsView";
import FinancesView from "./FinancesView";
import ClubsView from "./ClubsView";
import SettingsView from "./SettingsView";
import AuditLogView from "./AuditLogView";
import AccountingView from "./AccountingView";
import VirementsView from "./VirementsView";
import EtatsView from "./EtatsView";
import DisciplinaryView from "./DisciplinaryView";
import RankingsView from "./RankingsView";
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../hooks/useAppSettings";
import { useLeagues, useCreateLeague } from "../hooks/useLeagues";
import { useLeagueGroups } from "../hooks/useLeagueGroups";
import { useTeams } from "../hooks/useTeams";
import {
  useOfficials,
  useCreateOfficial,
  useUpdateOfficial,
} from "../hooks/useOfficials";
import {
  useMatches,
  useUpdateMatch,
  useCreateMatch,
  useBulkUpdateMatchSchedule,
  useArchiveMatch,
} from "../hooks/useMatches";
import {
  useStadiums,
  useCreateStadium,
  useUpdateStadium,
} from "../hooks/useStadiums";
import { useUsers } from "../hooks/useUsers";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { useTeamStadiums } from "../hooks/useTeamStadiums";
import { useAccountingPeriods } from "../hooks/useAccountingPeriods";
import { useSanctions, useCreateSanction } from "../hooks/useSanctions";
import { usePlayers, useCreatePlayer } from "../hooks/usePlayers";
import {
  useUpdateAssignment,
  useCreateAssignment,
  useDeleteAssignment,
  useMarkOfficialAbsent,
} from "../hooks/useAssignments";
import { useNotification } from "../hooks/useNotification";
import {
  UserRole,
  MatchStatus,
  Match,
  Official,
  Player,
  Payment,
  AuditLog,
  OfficialRole,
  Team,
  Stadium,
  League,
  LeagueGroup,
} from "../types";
import { usePayments } from "../hooks/usePayments";
import {
  useSendMatchSheet,
  useSendIndividualMissionOrder,
} from "../hooks/useCommunication";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { logAudit } from "../lib/audit";

// A simple protected route component
const ProtectedRoute = ({
  isAllowed,
  children,
}: {
  isAllowed: boolean;
  children: React.ReactNode;
}) => {
  if (!isAllowed) {
    return <Navigate to="/planning" replace />;
  }
  return <>{children}</>;
};

export const AppRouter = () => {
  const { user, permissions } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const { data: leagues, isLoading: leaguesLoading } = useLeagues();
  const [, showNotification] = useNotification();
  const queryClient = useQueryClient();

  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("all");

  useEffect(() => {
    if (settings?.seasons && settings.seasons.length > 0) {
      const sortedSeasons = [...settings.seasons].sort((a, b) =>
        b.localeCompare(a)
      );
      setCurrentSeason(sortedSeasons[0]);
    }
  }, [settings]);

  const handleSetCurrentSeason = useCallback(
    (season: string) => setCurrentSeason(season),
    []
  );
  const handleSetCurrentLeagueId = useCallback(
    (leagueId: string) => setCurrentLeagueId(leagueId),
    []
  );

  // Data fetching
  const { data: leagueGroupsData, isLoading: lgLoading } = useLeagueGroups({
    season: currentSeason,
  });
  const { data: teamsData, isLoading: teamsLoading } = useTeams({
    pagination: { page: 1, pageSize: 1000 },
  });
  const { data: officialsData, isLoading: officialsLoading } = useOfficials({
    pagination: { page: 1, pageSize: 1000 },
  });
  const { data: matchesData, isLoading: matchesLoading } = useMatches({
    filters: {
      season: currentSeason,
      leagueId: currentLeagueId === "all" ? undefined : currentLeagueId,
    },
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: stadiumsData, isLoading: stadiumsLoading } = useStadiums({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: auditLogsData, isLoading: auditLogsLoading } = useAuditLogs({
    pagination: { page: 1, pageSize: 100 },
  });
  const { data: teamStadiums, isLoading: tsLoading } = useTeamStadiums({
    season: currentSeason,
  });
  const { data: accountingPeriods, isLoading: apLoading } =
    useAccountingPeriods();
  const { data: sanctions, isLoading: sanctionsLoading } = useSanctions();
  const { data: playersData, isLoading: playersLoading } = usePlayers();
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({
    pagination: { page: 1, pageSize: 5000 },
  });

  const matches = useMemo(() => matchesData?.data || [], [matchesData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);
  const teams = useMemo(() => teamsData?.data || [], [teamsData]);
  const stadiums = useMemo(() => stadiumsData?.data || [], [stadiumsData]);
  const leagueGroups = useMemo(
    () => leagueGroupsData || [],
    [leagueGroupsData]
  );
  const auditLogs = useMemo(() => auditLogsData?.data || [], [auditLogsData]);
  const players = useMemo(() => playersData?.data || [], [playersData]);
  const payments = useMemo(() => paymentsData?.data || [], [paymentsData]);

  // Mutations
  const { mutate: updateAssignmentMutate } = useUpdateAssignment();
  const onUpdateAssignment = (
    matchId: string,
    assignmentId: string,
    officialId: string | null
  ) => {
    updateAssignmentMutate({
      id: assignmentId,
      officialId: officialId,
      matchId,
    });
    logAudit({
      action: "update_assignment",
      table: "match_assignments",
      recordId: assignmentId,
      newValues: { official_id: officialId },
      userId: user?.id || null,
      userName: user?.user_metadata?.full_name || null,
      userEmail: user?.email || null,
    });
  };
  const { mutate: markOfficialAbsentMutate } = useMarkOfficialAbsent();
  const onMarkOfficialAbsent = (matchId: string, assignmentId: string) => {
    const match = matches.find((m) => m.id === matchId);
    const assignment = match?.assignments.find((a) => a.id === assignmentId);
    if (assignment?.officialId) {
      markOfficialAbsentMutate({
        assignmentId,
        officialId: assignment.officialId,
      });
    }
  };
  const { mutateAsync: addAssignmentMutate } = useCreateAssignment();
  const { mutate: removeAssignmentMutate } = useDeleteAssignment();
  const onRemoveAssignment = (matchId: string, assignmentId: string) => {
    removeAssignmentMutate(assignmentId);
    logAudit({
      action: "delete_assignment",
      table: "match_assignments",
      recordId: assignmentId,
      userId: user?.id || null,
      userName: user?.user_metadata?.full_name || null,
      userEmail: user?.email || null,
    });
  };
  const { mutate: updateMatchMutate } = useUpdateMatch();
  // Map UI status labels to DB enum values
  const mapUiStatusToDb = (status: MatchStatus): string => {
    switch (status) {
      case MatchStatus.SCHEDULED:
        return "scheduled";
      case MatchStatus.IN_PROGRESS:
        return "in_progress";
      case MatchStatus.COMPLETED:
        return "completed";
      case MatchStatus.POSTPONED:
        return "postponed";
      case MatchStatus.CANCELLED:
        return "cancelled";
      default:
        return "scheduled";
    }
  };
  const onUpdateMatchStatus = (matchId: string, status: MatchStatus) =>
    updateMatchMutate({ id: matchId, status: mapUiStatusToDb(status) as any });

  useEffect(() => {
    // No-op: just keeping file structure consistent
  }, []);
  const { mutate: archiveMatchMutate } = useArchiveMatch();
  const onArchiveMatch = (matchId: string) => archiveMatchMutate(matchId);

  // FIX: Address incompatible 'onUpdateGameDaySchedule' prop type. The useBulkUpdateMatchSchedule hook
  // expects an object with 'matchIds', but the Dashboard component provides 'leagueGroupId' and 'gameDay'.
  // This new handler bridges the two by finding the relevant match IDs based on the group and game day,
  // then calling the mutation with the correct arguments.
  const { mutate: bulkUpdateMatchScheduleMutate } =
    useBulkUpdateMatchSchedule();
  const onUpdateGameDaySchedule = (
    leagueGroupId: string,
    gameDay: number,
    date: string,
    time: string
  ) => {
    const matchIds = matches
      .filter(
        (m) => m.leagueGroup.id === leagueGroupId && m.gameDay === gameDay
      )
      .map((m) => m.id);

    if (matchIds.length > 0) {
      bulkUpdateMatchScheduleMutate({
        matchIds,
        matchDate: date,
        matchTime: time,
      });
    }
  };

  const { mutate: onUpdateMatchScoreAndStatusMutate } = useMutation({
    mutationFn: async ({
      matchId,
      homeScore,
      awayScore,
    }: {
      matchId: string;
      homeScore: number;
      awayScore: number;
    }) => {
      // Set DB enum value for completed
      const { data, error } = await supabase
        .from("matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: "completed",
        })
        .eq("id", matchId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Score enregistré avec succès.", "success");
    },
    onError: (error) => showNotification(`Erreur: ${error.message}`, "error"),
  });

  const onUpdateMatchScoreAndStatus = (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    onUpdateMatchScoreAndStatusMutate({ matchId, homeScore, awayScore });
    logAudit({
      action: "update_match_score",
      table: "matches",
      recordId: matchId,
      newValues: {
        home_score: homeScore,
        away_score: awayScore,
        status: "completed",
      },
      userId: user?.id || null,
      userName: user?.user_metadata?.full_name || null,
      userEmail: user?.email || null,
    });
  };

  const { mutate: onSaveMatch } = useMutation({
    mutationFn: async (
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
    ) => {
      const { id, ...rest } = matchData;
      // Map camelCase UI fields to DB snake_case
      const upsertData: any = {
        season: rest.season,
        game_day: rest.gameDay,
        match_date: rest.matchDate,
        match_time: rest.matchTime,
        home_team_id: rest.homeTeam.id,
        away_team_id: rest.awayTeam.id,
        stadium_id: rest.stadium?.id || null,
        league_group_id: rest.leagueGroup.id,
        has_unsent_changes: true,
      };

      if (id) {
        const { data, error } = await supabase
          .from("matches")
          .update(upsertData)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        logAudit({
          action: "update_match",
          table: "matches",
          recordId: id,
          newValues: upsertData,
          userId: user?.id || null,
          userName: user?.user_metadata?.full_name || null,
          userEmail: user?.email || null,
        });
        return data;
      } else {
        const { data, error } = await supabase
          .from("matches")
          .insert(upsertData)
          .select()
          .single();
        if (error) throw error;
        logAudit({
          action: "create_match",
          table: "matches",
          recordId: data.id,
          newValues: upsertData,
          userId: user?.id || null,
          userName: user?.user_metadata?.full_name || null,
          userEmail: user?.email || null,
        });
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Match sauvegardé avec succès.", "success");
    },
    onError: (error) => showNotification(`Erreur: ${error.message}`, "error"),
  });

  const { mutate: onUpdateOfficial } = useUpdateOfficial();
  const { mutateAsync: onSaveStadiumMutation } = useUpdateStadium();

  const { mutateAsync: sendMatchSheetMutation } = useSendMatchSheet();
  const { mutateAsync: sendIndividualMissionOrderMutation } =
    useSendIndividualMissionOrder();

  const handleSendMatchSheet = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    await sendMatchSheetMutation({
      match,
      officials,
      locations: settings?.locations || [],
    });
  };

  // --- Clubs & Stadiums handlers ---
  const normalizeCode = (name: string) =>
    name
      .toUpperCase()
      .normalize("NFD")
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 10);

  const onSaveTeam = async (team: Team) => {
    try {
      // Build DB payload
      const code =
        team.code && team.code.trim().length > 0
          ? team.code
          : normalizeCode(team.name);
      const payload: any = {
        code,
        name: team.name,
        full_name: team.fullName,
        logo_url: team.logoUrl,
        founded_year: team.foundedYear,
        primary_color: team.primaryColor,
        secondary_color: team.secondaryColor,
      };

      if (team.id) {
        const { error } = await supabase
          .from("teams")
          .update(payload)
          .eq("id", team.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("teams").insert(payload);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      showNotification("Équipe sauvegardée.", "success");
    } catch (e: any) {
      showNotification(`Erreur sauvegarde équipe: ${e.message}`, "error");
    }
  };

  const onArchiveTeam = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ is_archived: true })
        .eq("id", teamId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      showNotification("Équipe archivée.", "success");
    } catch (e: any) {
      showNotification(`Erreur archivage équipe: ${e.message}`, "error");
    }
  };

  const onSaveStadium = async (stadium: Stadium) => {
    try {
      const payload: any = {
        name: stadium.name,
        name_ar: stadium.nameAr,
        location_id: stadium.locationId,
      };
      if (stadium.id) {
        const { error } = await supabase
          .from("stadiums")
          .update(payload)
          .eq("id", stadium.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stadiums").insert(payload);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      showNotification("Stade sauvegardé.", "success");
    } catch (e: any) {
      showNotification(`Erreur sauvegarde stade: ${e.message}`, "error");
    }
  };

  const onArchiveStadium = async (stadiumId: string) => {
    try {
      const { error } = await supabase
        .from("stadiums")
        .update({ is_archived: true })
        .eq("id", stadiumId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      showNotification("Stade archivé.", "success");
    } catch (e: any) {
      showNotification(`Erreur archivage stade: ${e.message}`, "error");
    }
  };

  const onSetTeamHomeStadium = async ({
    teamId,
    stadiumId,
    season,
  }: {
    teamId: string;
    stadiumId: string | null;
    season: string;
  }) => {
    try {
      // Ensure single record per team+season
      const { error: delErr } = await supabase
        .from("team_stadiums")
        .delete()
        .eq("team_id", teamId)
        .eq("season", season);
      if (delErr) throw delErr;
      if (stadiumId) {
        const { error: insErr } = await supabase
          .from("team_stadiums")
          .insert({ team_id: teamId, stadium_id: stadiumId, season });
        if (insErr) throw insErr;
      }
      await queryClient.invalidateQueries({ queryKey: ["teamStadiums"] });
      showNotification("Stade à domicile mis à jour.", "success");
    } catch (e: any) {
      showNotification(
        `Erreur mise à jour stade domicile: ${e.message}`,
        "error"
      );
    }
  };

  const handleSendIndividualMissionOrder = async (
    matchId: string,
    officialId: string
  ) => {
    const match = matches.find((m) => m.id === matchId);
    const official = officials.find((o) => o.id === officialId);
    if (!match || !official) return;
    await sendIndividualMissionOrderMutation({
      match,
      official,
      allOfficials: officials,
      allLocations: settings?.locations || [],
    });
  };

  // --- Settings & Leagues/Groups handlers ---
  const onUpdateSettings = async (newSettings: any) => {
    try {
      // Deactivate current active version(s)
      const { error: deactivateError } = await supabase
        .from("app_settings_versions")
        .update({ is_active: false })
        .eq("is_active", true);
      if (deactivateError) throw deactivateError;

      // Insert new active version
      const payload = {
        ...newSettings,
        is_active: true,
        created_by: user?.id || null,
      };
      const { error: insertError } = await supabase
        .from("app_settings_versions")
        .insert(payload);
      if (insertError) throw insertError;

      await queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      showNotification("Paramètres enregistrés.", "success");
      logAudit({
        action: "update_settings",
        table: "app_settings_versions",
        recordId: null,
        newValues: newSettings,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur sauvegarde paramètres: ${e.message}`, "error");
    }
  };

  const onSaveLeague = async (league: Partial<League>) => {
    try {
      const payload: any = {
        name: league.name,
        parent_league_id: league.parent_league_id || null,
        level: league.level ?? 1,
      };
      if (league.id) {
        const { error } = await supabase
          .from("leagues")
          .update(payload)
          .eq("id", league.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leagues").insert(payload);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      showNotification("Ligue sauvegardée.", "success");
      logAudit({
        action: league.id ? "update_league" : "create_league",
        table: "leagues",
        recordId: (league.id as string) || null,
        newValues: payload,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur sauvegarde ligue: ${e.message}`, "error");
    }
  };

  const onSaveLeagueGroup = async (group: Partial<LeagueGroup>) => {
    try {
      const payload: any = {
        name: group.name,
        league_id: group.league_id,
        season: group.season,
      };
      if (group.id) {
        const { error } = await supabase
          .from("league_groups")
          .update(payload)
          .eq("id", group.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("league_groups").insert(payload);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      showNotification("Groupe sauvegardé.", "success");
      logAudit({
        action: group.id ? "update_league_group" : "create_league_group",
        table: "league_groups",
        recordId: (group.id as string) || null,
        newValues: payload,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur sauvegarde groupe: ${e.message}`, "error");
    }
  };

  const onSaveGroupTeams = async (groupId: string, teamIds: string[]) => {
    try {
      // Clear existing links
      const { error: delErr } = await supabase
        .from("league_group_teams")
        .delete()
        .eq("league_group_id", groupId);
      if (delErr) throw delErr;
      // Insert new links
      if (teamIds.length > 0) {
        const rows = teamIds.map((teamId) => ({
          league_group_id: groupId,
          team_id: teamId,
        }));
        const { error: insErr } = await supabase
          .from("league_group_teams")
          .insert(rows);
        if (insErr) throw insErr;
      }
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      showNotification("Équipes du groupe mises à jour.", "success");
      logAudit({
        action: "update_league_group_teams",
        table: "league_group_teams",
        recordId: groupId,
        newValues: { teamIds },
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(
        `Erreur mise à jour équipes du groupe: ${e.message}`,
        "error"
      );
    }
  };

  const onDeleteLeague = async (leagueId: string) => {
    try {
      const { error } = await supabase
        .from("leagues")
        .delete()
        .eq("id", leagueId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      showNotification("Ligue supprimée.", "success");
      logAudit({
        action: "delete_league",
        table: "leagues",
        recordId: leagueId,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur suppression ligue: ${e.message}`, "error");
    }
  };

  const onDeleteLeagueGroup = async (groupId: string) => {
    try {
      // Delete team links first
      const { error: delLinksErr } = await supabase
        .from("league_group_teams")
        .delete()
        .eq("league_group_id", groupId);
      if (delLinksErr) throw delLinksErr;
      // Delete group
      const { error } = await supabase
        .from("league_groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      showNotification("Groupe supprimé.", "success");
      logAudit({
        action: "delete_league_group",
        table: "league_groups",
        recordId: groupId,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur suppression groupe: ${e.message}`, "error");
    }
  };

  const onUpdateUserRole = async (userId: string, roleName: string) => {
    try {
      // Resolve role id
      const { data: role, error: roleErr } = await supabase
        .from("roles")
        .select("id")
        .eq("name", roleName)
        .single();
      if (roleErr || !role) throw roleErr || new Error("Rôle introuvable");

      // Remove existing roles for user
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;

      // Assign new role
      const { error: insErr } = await supabase.from("user_roles").insert({
        user_id: userId,
        role_id: role.id,
        assigned_by: user?.id || null,
      });
      if (insErr) throw insErr;

      await queryClient.invalidateQueries({ queryKey: ["users"] });
      showNotification("Rôle utilisateur mis à jour.", "success");
      logAudit({
        action: "update_user_role",
        table: "user_roles",
        recordId: userId,
        newValues: { roleName },
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur mise à jour rôle: ${e.message}`, "error");
    }
  };

  // --- Restore (unarchive) actions ---
  const onRestoreOfficial = async (officialId: string) => {
    try {
      const { error } = await supabase
        .from("officials")
        .update({ is_archived: false })
        .eq("id", officialId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification("Officiel restauré.", "success");
      logAudit({
        action: "restore_official",
        table: "officials",
        recordId: officialId,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur restauration officiel: ${e.message}`, "error");
    }
  };

  const onRestoreTeam = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ is_archived: false })
        .eq("id", teamId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      showNotification("Équipe restaurée.", "success");
      logAudit({
        action: "restore_team",
        table: "teams",
        recordId: teamId,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur restauration équipe: ${e.message}`, "error");
    }
  };

  const onRestoreStadium = async (stadiumId: string) => {
    try {
      const { error } = await supabase
        .from("stadiums")
        .update({ is_archived: false })
        .eq("id", stadiumId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      showNotification("Stade restauré.", "success");
      logAudit({
        action: "restore_stadium",
        table: "stadiums",
        recordId: stadiumId,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur restauration stade: ${e.message}`, "error");
    }
  };

  const onRestoreMatch = async (matchId: string) => {
    try {
      const { error } = await supabase
        .from("matches")
        .update({ is_archived: false })
        .eq("id", matchId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Match restauré.", "success");
      logAudit({
        action: "restore_match",
        table: "matches",
        recordId: matchId,
        userId: user?.id || null,
        userName: user?.user_metadata?.full_name || null,
        userEmail: user?.email || null,
      });
    } catch (e: any) {
      showNotification(`Erreur restauration match: ${e.message}`, "error");
    }
  };

  const allRoles = Object.values(UserRole).map((roleName) => ({
    id: roleName,
    name: roleName,
  }));

  const isLoading =
    settingsLoading ||
    leaguesLoading ||
    lgLoading ||
    teamsLoading ||
    officialsLoading ||
    matchesLoading ||
    stadiumsLoading ||
    usersLoading ||
    tsLoading ||
    apLoading ||
    sanctionsLoading ||
    playersLoading ||
    paymentsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  const dummyFuncWithParams = async (...args: any[]) => {};

  // FIX: The onAddAssignment prop passed to Dashboard was incompatible.
  // This wrapper adapts the call to match the useCreateAssignment hook,
  // creating an empty assignment slot by passing null for the officialId.
  // This requires a corresponding fix in useCreateAssignment to allow a nullable officialId.
  const onAddAssignment = (
    matchId: string,
    role: OfficialRole
  ): Promise<void> => {
    // This now returns a promise that resolves to void, matching the prop type.
    return addAssignmentMutate({ matchId, role, officialId: null }).then(
      () => {}
    );
  };

  const dashboardProps = {
    matches,
    officials,
    users: users || [],
    teams,
    stadiums,
    leagues: leagues || [],
    leagueGroups,
    locations: settings?.locations || [],
    officialRoles: settings?.roles || [],
    teamStadiums: teamStadiums || [],
    seasons: settings?.seasons || [],
    currentSeason,
    currentUser: user!,
    permissions,
    onUpdateAssignment,
    onUpdateMatchStatus,
    onUpdateMatchScoreAndStatus,
    onMarkOfficialAbsent,
    onArchiveMatch,
    onSendMatchSheet: handleSendMatchSheet,
    onNotifyChanges: handleSendMatchSheet, // Same logic for now
    onAddAssignment: onAddAssignment,
    // FIX: The 'removeAssignmentMutate' function from the useDeleteAssignment hook expects only the 'assignmentId',
    // but the 'onRemoveAssignment' prop requires '(matchId, assignmentId)'. This wrapper function correctly
    // adapts the call signature to match the prop type while still using the mutation hook as intended.
    onRemoveAssignment,
    onUpdateGameDaySchedule,
    onSaveMatch,
    onSaveStadium: onSaveStadium,
    onUpdateOfficialEmail: (officialId: string, email: string) =>
      onUpdateOfficial({ id: officialId, email }),
    onPrintIndividualMissionOrder: () => {},
    onSendIndividualMissionOrder: handleSendIndividualMissionOrder,
    onSendAllMissionOrders: () => {},
  };

  return (
    <BrowserRouter>
      <Header
        seasons={settings?.seasons || []}
        currentSeason={currentSeason}
        onSetCurrentSeason={handleSetCurrentSeason}
        leagues={leagues || []}
        currentLeagueId={currentLeagueId}
        onSetCurrentLeagueId={handleSetCurrentLeagueId}
      />
      <Routes>
        <Route path="/planning" element={<Dashboard {...dashboardProps} />} />
        <Route
          path="/classements"
          element={
            <RankingsView
              matches={matches}
              teams={teams}
              leagues={leagues || []}
              leagueGroups={leagueGroups}
              currentUser={user!}
            />
          }
        />
        <Route
          path="/disciplinary"
          element={
            <DisciplinaryView
              players={players as Player[]}
              sanctions={sanctions || []}
              teams={teams}
              matches={matches}
              permissions={permissions}
              onSavePlayer={dummyFuncWithParams}
              onArchivePlayer={dummyFuncWithParams}
              onSaveSanction={dummyFuncWithParams}
              onCancelSanction={dummyFuncWithParams}
              disciplinarySettings={settings?.disciplinary_settings || null}
            />
          }
        />
        <Route
          path="/officials"
          element={
            <OfficialsView
              officials={officials}
              matches={matches}
              officialCategories={settings?.official_categories || []}
              localisations={settings?.locations || []}
              onUpdateUnavailabilities={() => {}}
              onSaveOfficial={async () => {}}
              onArchiveOfficial={() => {}}
              onBulkUpdateOfficialLocations={() => {}}
              onBulkArchiveOfficials={() => {}}
              onBulkUpdateOfficialCategory={() => {}}
              onSendBulkMessage={() => {}}
              currentUser={user!}
              permissions={permissions}
              logAction={async () => {}}
            />
          }
        />
        <Route
          path="/clubs"
          element={
            <ClubsView
              teams={teams}
              stadiums={stadiums}
              leagues={leagues || []}
              leagueGroups={leagueGroups}
              teamStadiums={teamStadiums || []}
              onSaveTeam={onSaveTeam}
              onSaveStadium={onSaveStadium}
              onSetTeamHomeStadium={onSetTeamHomeStadium}
              onArchiveTeam={onArchiveTeam}
              onArchiveStadium={onArchiveStadium}
              currentUser={user!}
              permissions={permissions}
              localisations={settings?.locations || []}
              currentSeason={currentSeason}
            />
          }
        />
        <Route
          path="/finances"
          element={
            <FinancesView
              payments={payments as Payment[]}
              matches={matches}
              officials={officials}
              onUpdatePaymentNotes={() => {}}
              onBulkUpdatePaymentNotes={() => {}}
              currentUser={user!}
              users={users || []}
              permissions={permissions}
              locations={settings?.locations || []}
              leagues={leagues || []}
              leagueGroups={leagueGroups}
              indemnityRates={settings?.indemnity_rates || {}}
            />
          }
        />
        <Route
          path="/accounting"
          element={
            <ProtectedRoute isAllowed={permissions.can("view", "accounting")}>
              <AccountingView
                matches={matches}
                officials={officials}
                accountingPeriods={accountingPeriods || []}
                currentUser={user!}
                permissions={permissions}
                locations={settings?.locations || []}
                leagues={leagues || []}
                leagueGroups={leagueGroups}
                indemnityRates={settings?.indemnity_rates || {}}
                financialSettings={settings?.financial_settings || null}
                rejectionReasons={settings?.rejection_reasons || []}
                officialRoles={settings?.roles || []}
                onSubmit={() => {}}
                onValidate={() => {}}
                onReject={() => {}}
                onReopenGameDay={async () => {}}
                onCloseMonth={async () => {}}
                onReopenMonth={async () => {}}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/virements"
          element={
            <ProtectedRoute isAllowed={permissions.can("view", "finances")}>
              <VirementsView
                payments={payments as Payment[]}
                officials={officials}
                permissions={permissions}
                onCreatePaymentBatch={() => {}}
                accountingPeriods={accountingPeriods || []}
                onCancelPaymentBatch={() => {}}
                onSaveProofOfPayment={() => {}}
                users={users || []}
                showNotification={showNotification}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/etats"
          element={
            <ProtectedRoute isAllowed={permissions.can("view", "finances")}>
              <EtatsView
                payments={payments as Payment[]}
                officials={officials}
                permissions={permissions}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute isAllowed={permissions.can("view", "audit")}>
              <AuditLogView
                logs={auditLogs as AuditLog[]}
                isLoading={auditLogsLoading}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute isAllowed={permissions.can("view", "settings")}>
              <SettingsView
                indemnityRates={settings?.indemnity_rates || {}}
                officialCategories={settings?.official_categories || []}
                officialRoles={settings?.roles || []}
                rejectionReasons={settings?.rejection_reasons || []}
                leagues={leagues || []}
                leagueGroups={leagueGroups}
                officials={officials}
                matches={matches}
                teams={teams}
                stadiums={stadiums}
                locations={settings?.locations || []}
                seasons={settings?.seasons || []}
                currentSeason={currentSeason}
                optimizationSettings={settings?.optimization_settings || null}
                financialSettings={settings?.financial_settings || null}
                disciplinarySettings={settings?.disciplinary_settings || null}
                users={users || []}
                allRoles={allRoles}
                onUpdateSettings={onUpdateSettings}
                onSaveLeague={onSaveLeague}
                onSaveLeagueGroup={onSaveLeagueGroup}
                onSaveGroupTeams={onSaveGroupTeams}
                onDeleteLeague={onDeleteLeague}
                onDeleteLeagueGroup={onDeleteLeagueGroup}
                onUpdateUserRole={onUpdateUserRole}
                onRestoreOfficial={onRestoreOfficial}
                onRestoreTeam={onRestoreTeam}
                onRestoreStadium={onRestoreStadium}
                onRestoreMatch={onRestoreMatch}
                onGenerateTemplate={() => {}}
                onImportOfficials={async () => {}}
                onImportTeams={async () => {}}
                onImportStadiums={async () => {}}
                onImportMatches={async () => {}}
                onImportAssignments={async () => {}}
                onImportOptimizedAssignments={async () => {}}
                onLaunchOptimization={() => {}}
                currentUser={user!}
                permissions={permissions}
                isDirty={false}
                setIsDirty={() => {}}
              />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/planning" replace />} />
        <Route path="*" element={<Navigate to="/planning" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
