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
import { logAndThrow, logWarning } from "../utils/logging";
import { generateTemplate } from "../services/exportService";
import { generateMissionOrderPDF, downloadBlob } from "../services/pdfService";
import {
  generateOfficialsCsv,
  generateMatchesCsv,
  generateStadiumsCsv,
  generateAvailabilityCsv,
  generateForbiddenCsv,
  downloadOptimizationDataAsZip,
} from "../services/optimizationService";
// audit logging is handled by DB triggers; no client logging here

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
  const [settingsDirty, setSettingsDirty] = useState<boolean>(false);

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
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: officialsData, isLoading: officialsLoading } = useOfficials({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
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
    filters: { includeArchived: true },
  });
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: auditLogsData, isLoading: auditLogsLoading } = useAuditLogs({
    pagination: { page: 1, pageSize: 2000 },
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
  const { mutateAsync: updateAssignmentMutate } = useUpdateAssignment();
  const onUpdateAssignment = async (
    matchId: string,
    assignmentId: string,
    officialId: string | null
  ) => {
    if (!user?.id) {
      showNotification(
        "Session requise pour modifier une désignation.",
        "error"
      );
      return;
    }
    try {
      await updateAssignmentMutate({
        id: assignmentId,
        officialId: officialId,
        matchId,
        updatedBy: user.id,
      });
      await supabase
        .from("matches")
        .update({ has_unsent_changes: true, updated_by: user.id })
        .eq("id", matchId);
      showNotification("Désignation mise à jour.", "success");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e: any) {
      showNotification(
        `Erreur mise à jour désignation: ${e.message || e}`,
        "error"
      );
    }
  };
  const { mutate: markOfficialAbsentMutate } = useMarkOfficialAbsent();
  const onMarkOfficialAbsent = (matchId: string, assignmentId: string) => {
    const match = matches.find((m) => m.id === matchId);
    const assignment = match?.assignments.find((a) => a.id === assignmentId);
    if (assignment?.officialId) {
      markOfficialAbsentMutate(
        {
          assignmentId,
          officialId: assignment.officialId,
          updatedBy: user?.id || null,
        },
        {
          onSuccess: () => {
            showNotification("Officiel marqué absent.", "success");
          },
          onError: (e: any) => {
            showNotification(
              `Erreur marquage absence: ${e?.message || e}`,
              "error"
            );
          },
        }
      );
    }
  };
  const { mutateAsync: addAssignmentMutate } = useCreateAssignment();
  const { mutate: removeAssignmentMutate } = useDeleteAssignment();
  const onRemoveAssignment = async (matchId: string, assignmentId: string) => {
    try {
      await new Promise<void>((resolve, reject) =>
        removeAssignmentMutate(assignmentId, {
          onSuccess: () => resolve(),
          onError: (e: any) => reject(e),
        })
      );
      const { error: upErr } = await supabase
        .from("matches")
        .update({ has_unsent_changes: true, updated_by: user?.id || null })
        .eq("id", matchId);
      if (upErr)
        return logAndThrow("set match unsent after assignment removal", upErr, {
          matchId,
          assignmentId,
        });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Désignation supprimée.", "success");
    } catch (e: any) {
      showNotification(
        `Erreur suppression désignation: ${e.message || e}`,
        "error"
      );
    }
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
    updateMatchMutate(
      { id: matchId, status: mapUiStatusToDb(status) as any },
      {
        onSuccess: () => {
          showNotification("Statut du match mis à jour.", "success");
        },
        onError: (error: any) => {
          showNotification(
            `Erreur mise à jour statut: ${error?.message || error}`,
            "error"
          );
        },
      }
    );

  useEffect(() => {
    // No-op: just keeping file structure consistent
  }, []);

  // Client-side action logging for sensitive read actions (complements DB triggers)
  const logAction = useCallback(
    async (
      action: string,
      details?: { tableName?: string; recordId?: string | null }
    ) => {
      try {
        await supabase.from("audit_logs").insert({
          user_id: user?.id || null,
          user_name: (user as any)?.user_metadata?.full_name || null,
          user_email: (user as any)?.email || null,
          action,
          table_name: details?.tableName || null,
          record_id: details?.recordId || null,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
      } catch (e) {
        console.warn("audit logAction failed", e);
      }
    },
    [user]
  );
  const { mutate: archiveMatchMutate } = useArchiveMatch();
  const onArchiveMatch = async (matchId: string) => {
    try {
      // Guard: prevent archiving if accounting is validated or closed
      const { data: m, error: mErr } = await supabase
        .from("matches")
        .select("id, accounting_status")
        .eq("id", matchId)
        .single();
      if (mErr)
        return logAndThrow("select match before archive", mErr, { matchId });
      const acc = (m as any)?.accounting_status as string | undefined;
      if (acc === "validated" || acc === "closed") {
        const statusLabel = acc === "validated" ? "Validé" : "Clôturé";
        showNotification(
          `Impossible d'archiver ce match: statut comptable ${statusLabel}.`,
          "error"
        );
        return;
      }
      archiveMatchMutate(matchId, {
        onSuccess: () => {
          showNotification("Match archivé.", "success");
        },
        onError: (e: any) =>
          showNotification(`Erreur archivage match: ${e.message}`, "error"),
      } as any);
    } catch (e: any) {
      showNotification(`Erreur archivage match: ${e.message}`, "error");
    }
  };

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
      showNotification(
        `Mise à jour des horaires pour ${matchIds.length} match(s)...`,
        "info"
      );
      bulkUpdateMatchScheduleMutate(
        {
          matchIds,
          matchDate: date,
          matchTime: time,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["matches"] });
            showNotification("Horaires de la journée mis à jour.", "success");
          },
          onError: (e: any) => {
            showNotification(
              `Erreur mise à jour horaires: ${e?.message || e}`,
              "error"
            );
          },
        }
      );
    } else {
      showNotification("Aucun match trouvé pour cette journée/groupe.", "info");
    }
  };

  const { mutate: onUpdateMatchScoreAndStatusMutate } = useMutation({
    mutationFn: async ({
      matchId,
      homeScore,
      awayScore,
      label,
    }: {
      matchId: string;
      homeScore: number;
      awayScore: number;
      label?: string;
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
      if (error)
        return logAndThrow("update match score+status", error, {
          matchId,
          homeScore,
          awayScore,
        });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      if (variables?.label) {
        showNotification(`Score mis à jour: ${variables.label}.`, "success");
      } else {
        showNotification("Score enregistré avec succès.", "success");
      }
    },
    onError: (error) => showNotification(`Erreur: ${error.message}`, "error"),
  });

  const onUpdateMatchScoreAndStatus = (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    const match = matches.find((m) => m.id === matchId);
    const home = match?.homeTeam?.name || "Domicile";
    const away = match?.awayTeam?.name || "Extérieur";
    const label = `${home} ${homeScore} - ${awayScore} ${away}`;
    onUpdateMatchScoreAndStatusMutate({ matchId, homeScore, awayScore, label });
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
          .update({ ...upsertData, updated_by: user?.id || null })
          .eq("id", id)
          .select()
          .single();
        if (error)
          return logAndThrow("update match (router onSaveMatch)", error, {
            id,
            upsertData,
          });
        return data;
      } else {
        const { data, error } = await supabase
          .from("matches")
          .insert({
            ...upsertData,
            created_by: user?.id || null,
            updated_by: user?.id || null,
            status: "scheduled",
          })
          .select()
          .single();
        if (error)
          return logAndThrow("insert match (router onSaveMatch)", error, {
            upsertData,
          });
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Match planifié/mis à jour avec succès.", "success");
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
    if (!match) {
      showNotification("Match introuvable pour envoi de feuille.", "error");
      return;
    }
    showNotification("Envoi de la feuille de match en cours...", "info");
    await sendMatchSheetMutation({
      match,
      officials,
      locations: settings?.locations || [],
    });
    showNotification("Feuille de match envoyée.", "success");
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
          .update({ ...payload, updated_by: user?.id || null })
          .eq("id", team.id);
        if (error)
          return logAndThrow("update team", error, {
            teamId: team.id,
            payload,
          });
      } else {
        const { error } = await supabase.from("teams").insert({
          ...payload,
          created_by: user?.id || null,
          updated_by: user?.id || null,
        });
        if (error) return logAndThrow("insert team", error, { payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      showNotification(`Équipe "${team.name}" sauvegardée.`, "success");
    } catch (e: any) {
      showNotification(`Erreur sauvegarde équipe: ${e.message}`, "error");
    }
  };

  const onArchiveTeam = async (teamId: string) => {
    try {
      // Prevent archiving if team is used in any non-archived match
      const { data: usage, error: usageErr } = await supabase
        .from("matches")
        .select("id")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq("is_archived", false)
        .limit(1);
      if (usageErr)
        return logAndThrow("usage check team archive", usageErr, { teamId });
      if (Array.isArray(usage) && usage.length > 0) {
        showNotification(
          "Impossible d'archiver: l'équipe est utilisée dans des matchs actifs.",
          "error"
        );
        return;
      }
      const teamName = teams.find((t) => t.id === teamId)?.name || "Équipe";
      const { error } = await supabase
        .from("teams")
        .update({ is_archived: true, updated_by: user?.id || null })
        .eq("id", teamId);
      if (error) return logAndThrow("archive team", error, { teamId });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      showNotification(`"${teamName}" archivée.`, "success");
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
          .update({ ...payload, updated_by: user?.id || null })
          .eq("id", stadium.id);
        if (error)
          return logAndThrow("update stadium", error, {
            stadiumId: stadium.id,
            payload,
          });
      } else {
        const { error } = await supabase.from("stadiums").insert({
          ...payload,
          created_by: user?.id || null,
          updated_by: user?.id || null,
        });
        if (error) return logAndThrow("insert stadium", error, { payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      showNotification(`Stade "${stadium.name}" sauvegardé.`, "success");
    } catch (e: any) {
      showNotification(`Erreur sauvegarde stade: ${e.message}`, "error");
    }
  };

  const onArchiveStadium = async (stadiumId: string) => {
    try {
      // Prevent archiving if stadium is used in any non-archived match
      const { data: usage, error: usageErr } = await supabase
        .from("matches")
        .select("id")
        .eq("stadium_id", stadiumId)
        .eq("is_archived", false)
        .limit(1);
      if (usageErr)
        return logAndThrow("usage check stadium archive", usageErr, {
          stadiumId,
        });
      if (Array.isArray(usage) && usage.length > 0) {
        showNotification(
          "Impossible d'archiver: le stade est utilisé dans des matchs actifs.",
          "error"
        );
        return;
      }
      const stadiumName =
        stadiums.find((s) => s.id === stadiumId)?.name || "Stade";
      const { error } = await supabase
        .from("stadiums")
        .update({ is_archived: true, updated_by: user?.id || null })
        .eq("id", stadiumId);
      if (error) return logAndThrow("archive stadium", error, { stadiumId });
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      showNotification(`"${stadiumName}" archivé.`, "success");
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
      if (delErr)
        return logAndThrow("delete team_stadiums for team+season", delErr, {
          teamId,
          season,
        });
      if (stadiumId) {
        const { error: insErr } = await supabase.from("team_stadiums").insert({
          team_id: teamId,
          stadium_id: stadiumId,
          season,
          created_by: user?.id || null,
        });
        if (insErr)
          return logAndThrow("insert team_stadiums", insErr, {
            teamId,
            stadiumId,
            season,
          });
      }
      await queryClient.invalidateQueries({ queryKey: ["teamStadiums"] });
      const teamName = teams.find((t) => t.id === teamId)?.name || "Équipe";
      const stadiumName = stadiumId
        ? stadiums.find((s) => s.id === stadiumId)?.name || "Stade"
        : null;
      showNotification(
        stadiumName
          ? `Stade à domicile de "${teamName}" défini sur "${stadiumName}".`
          : `Stade à domicile de "${teamName}" effacé.`,
        "success"
      );
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
    if (!match || !official) {
      showNotification("Match ou officiel introuvable.", "error");
      return;
    }
    try {
      showNotification("Envoi de l'ordre de mission...", "info");
      await sendIndividualMissionOrderMutation({
        match,
        official,
        allOfficials: officials,
        allLocations: settings?.locations || [],
      });
      showNotification("Ordre de mission envoyé.", "success");
    } catch (e: any) {
      showNotification(
        `Erreur envoi ordre de mission: ${e?.message || e}`,
        "error"
      );
    }
  };

  const onPrintIndividualMissionOrder = async (
    matchId: string,
    officialId: string
  ) => {
    try {
      const blob = await generateMissionOrderPDF(matchId, officialId);
      const official = officials.find((o) => o.id === officialId);
      const match = matches.find((m) => m.id === matchId);
      const dateStr = match?.matchDate || new Date().toISOString().slice(0, 10);
      const safeName = (official?.fullName || officialId).replace(/\s+/g, "_");
      downloadBlob(blob, `Ordre_Mission_${safeName}_${dateStr}.pdf`);
      showNotification("Ordre de mission généré.", "success");
    } catch (e: any) {
      showNotification(`Erreur génération PDF: ${e.message}`, "error");
    }
  };

  const handleSendAllMissionOrders = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      showNotification("Match non trouvé.", "error");
      return;
    }
    const assignedOfficials = match.assignments
      .map((a) => officials.find((o) => o.id === a.officialId))
      .filter((o): o is Official => !!o && !!o.email);
    if (assignedOfficials.length === 0) {
      showNotification(
        "Aucun officiel désigné avec un email pour ce match.",
        "error"
      );
      return;
    }
    showNotification(
      `Envoi en cours pour ${assignedOfficials.length} officiels...`,
      "info"
    );
    const results = await Promise.all(
      assignedOfficials.map((o) =>
        handleSendIndividualMissionOrder(matchId, o.id)
          .then(() => ({ ok: true, name: o.fullName }))
          .catch((e) => ({ ok: false, name: o.fullName, err: e }))
      )
    );
    const fail = results.filter((r) => !r.ok);
    const ok = results.filter((r) => r.ok);
    if (ok.length > 0)
      showNotification(
        `${ok.length} ordre(s) envoyé(s) avec succès.`,
        "success"
      );
    if (fail.length > 0)
      showNotification(
        `${fail.length} échec(s): ${fail.map((f) => f.name).join(", ")}.`,
        "error"
      );
  };

  // --- Officials handlers parity ---
  const onUpdateUnavailabilities = async (
    officialId: string,
    newUnavs: Array<{
      id?: string;
      startDate: string;
      endDate: string;
      reason?: string | null;
      isApproved?: boolean | null;
    }>
  ) => {
    try {
      const { error: delErr } = await supabase
        .from("official_unavailabilities")
        .delete()
        .match({ official_id: officialId });
      if (delErr)
        return logAndThrow("delete official_unavailabilities", delErr, {
          officialId,
        });
      if (newUnavs.length > 0) {
        const rows = newUnavs.map((u) => ({
          official_id: officialId,
          start_date: u.startDate,
          end_date: u.endDate,
          reason: u.reason ?? null,
          is_approved: u.isApproved ?? false,
          created_by: user?.id || null,
        }));
        const { error: insErr } = await supabase
          .from("official_unavailabilities")
          .insert(rows);
        if (insErr)
          return logAndThrow("insert official_unavailabilities", insErr, {
            officialId,
            count: rows.length,
          });
      }
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification("Disponibilités mises à jour.", "success");
    } catch (e: any) {
      showNotification(`Erreur: ${e.message}`, "error");
    }
  };

  const onSaveOfficial = async (official: Official) => {
    try {
      const payload: any = {
        id: official.id,
        first_name: official.firstName,
        last_name: official.lastName,
        first_name_ar: official.firstNameAr,
        last_name_ar: official.lastNameAr,
        category: official.category,
        location_id: official.locationId,
        address: official.address,
        position: official.position,
        email: official.email,
        phone: official.phone,
        bank_account_number: official.bankAccountNumber,
        is_active: official.isActive,
        user_id: official.userId,
        updated_by: user?.id || null,
      };
      const isNew = !official.createdAt;
      if (isNew) payload.created_by = user?.id || null;
      const { error } = await supabase.from("officials").upsert(payload);
      if (error) return logAndThrow("upsert official", error, { payload });
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification(
        `Officiel "${official.fullName}" sauvegardé.`,
        "success"
      );
    } catch (e: any) {
      showNotification(`Erreur: ${e.message}`, "error");
    }
  };

  const onArchiveOfficial = async (officialId: string) => {
    try {
      // Prevent archiving if official has active assignments in non-archived matches
      const { data: usage, error: usageErr } = await supabase
        .from("matches")
        .select("id, match_assignments!inner(official_id)")
        .eq("match_assignments.official_id", officialId)
        .eq("is_archived", false)
        .limit(1);
      if (usageErr)
        return logAndThrow("usage check official archive", usageErr, {
          officialId,
        });
      if (Array.isArray(usage) && usage.length > 0) {
        showNotification(
          "Impossible d'archiver: l'officiel est désigné sur des matchs actifs.",
          "error"
        );
        return;
      }
      const { error } = await supabase
        .from("officials")
        .update({ is_archived: true, updated_by: user?.id || null })
        .eq("id", officialId);
      if (error) return logAndThrow("archive official", error, { officialId });
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      const name =
        officials.find((o) => o.id === officialId)?.fullName || "Officiel";
      showNotification(`"${name}" archivé.`, "success");
    } catch (e: any) {
      showNotification(`Erreur: ${e.message}`, "error");
    }
  };

  const onBulkUpdateOfficialLocations = async (
    officialIds: string[],
    newLocationId: string
  ) => {
    if (officialIds.length === 0 || !newLocationId) return;
    try {
      const updates = officialIds.map((id) => ({
        id,
        location_id: newLocationId,
        updated_by: user?.id || null,
      }));
      const { error } = await supabase.from("officials").upsert(updates);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification(
        `${officialIds.length} officiel(s) mis à jour.`,
        "success"
      );
    } catch (e: any) {
      showNotification(`Erreur: ${e.message}`, "error");
    }
  };

  const onBulkUpdateOfficialCategory = async (
    officialIds: string[],
    newCategory: string
  ) => {
    if (officialIds.length === 0 || !newCategory) return;
    try {
      const updates = officialIds.map((id) => ({
        id,
        category: newCategory,
        updated_by: user?.id || null,
      }));
      const { error } = await supabase.from("officials").upsert(updates);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification(
        `Catégorie mise à jour pour ${officialIds.length} officiels.`,
        "success"
      );
    } catch (e: any) {
      showNotification(`Erreur: ${e.message}`, "error");
    }
  };

  const onBulkArchiveOfficials = async (officialIds: string[]) => {
    if (officialIds.length === 0) return;
    try {
      const { error } = await supabase
        .from("officials")
        .update({ is_archived: true, updated_by: user?.id || null })
        .in("id", officialIds);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification(
        `${officialIds.length} officiel(s) archivés.`,
        "success"
      );
    } catch (e: any) {
      showNotification(`Erreur: ${e.message}`, "error");
    }
  };

  const onSendBulkMessage = async (
    officialIds: string[],
    subject: string,
    message: string
  ) => {
    const recipients = officials
      .filter((o) => officialIds.includes(o.id) && o.email)
      .map((o) => o.email!)
      .filter((e) => e.trim().length > 0);
    if (recipients.length === 0) {
      showNotification("Aucun destinataire avec email valide.", "error");
      return;
    }
    showNotification(
      `Préparation de l'envoi: ${recipients.length} destinataires.`,
      "info"
    );
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to: recipients,
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      },
    });
    if (error) {
      logWarning("send-email failed", {
        message: error.message,
        recipients: recipients.length,
      });
      showNotification(`Erreur d'envoi: ${error.message}`, "error");
    } else
      showNotification(
        `Message envoyé à ${recipients.length} destinataires.`,
        "success"
      );
  };

  // --- Settings & Leagues/Groups handlers ---
  const onUpdateSettings = async (newSettings: any) => {
    try {
      // Deactivate current active version(s)
      const { error: deactivateError } = await supabase
        .from("app_settings_versions")
        .update({ is_active: false })
        .eq("is_active", true);
      if (deactivateError)
        return logAndThrow("deactivate app_settings_versions", deactivateError);

      // Insert new active version
      const payload = {
        ...newSettings,
        is_active: true,
        created_by: user?.id || null,
      };
      const { error: insertError } = await supabase
        .from("app_settings_versions")
        .insert(payload);
      if (insertError)
        return logAndThrow("insert app_settings_version", insertError, payload);

      await queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      showNotification("Paramètres enregistrés.", "success");
      setSettingsDirty(false);
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
          .update({ ...payload, updated_by: user?.id || null })
          .eq("id", league.id);
        if (error)
          return logAndThrow("update league", error, {
            id: league.id,
            payload,
          });
      } else {
        const { error } = await supabase.from("leagues").insert({
          ...payload,
          created_by: user?.id || null,
          updated_by: user?.id || null,
        });
        if (error) return logAndThrow("insert league", error, { payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      showNotification(`Ligue "${league.name}" sauvegardée.`, "success");
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
          .update({ ...payload, updated_by: user?.id || null })
          .eq("id", group.id);
        if (error)
          return logAndThrow("update league_group", error, {
            id: group.id,
            payload,
          });
      } else {
        const { error } = await supabase.from("league_groups").insert({
          ...payload,
          created_by: user?.id || null,
          updated_by: user?.id || null,
        });
        if (error) return logAndThrow("insert league_group", error, payload);
      }
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      showNotification(`Groupe "${group.name}" sauvegardé.`, "success");
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
      if (delErr)
        return logAndThrow("clear league_group_teams", delErr, { groupId });
      // Insert new links
      if (teamIds.length > 0) {
        const rows = teamIds.map((teamId) => ({
          league_group_id: groupId,
          team_id: teamId,
        }));
        const { error: insErr } = await supabase
          .from("league_group_teams")
          .insert(rows);
        if (insErr)
          return logAndThrow("insert league_group_teams", insErr, {
            groupId,
            count: rows.length,
          });
      }
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      showNotification(
        `${teamIds.length} équipe(s) associée(s) au groupe.`,
        "success"
      );
    } catch (e: any) {
      showNotification(
        `Erreur mise à jour équipes du groupe: ${e.message}`,
        "error"
      );
    }
  };

  const onDeleteLeague = async (leagueId: string) => {
    try {
      // Prevent deleting league if it has groups
      const { data: grp, error: gErr } = await supabase
        .from("league_groups")
        .select("id")
        .eq("league_id", leagueId)
        .limit(1);
      if (gErr)
        return logAndThrow("select league_groups by league", gErr, {
          leagueId,
        });
      if (Array.isArray(grp) && grp.length > 0) {
        showNotification(
          "Impossible de supprimer: des groupes existent pour cette ligue.",
          "error"
        );
        return;
      }
      const { error } = await supabase
        .from("leagues")
        .delete()
        .eq("id", leagueId);
      if (error) return logAndThrow("delete league", error, { leagueId });
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      showNotification("Ligue supprimée.", "success");
    } catch (e: any) {
      showNotification(`Erreur suppression ligue: ${e.message}`, "error");
    }
  };

  const onDeleteLeagueGroup = async (groupId: string) => {
    try {
      // Prevent deleting group if referenced by matches
      const { data: m, error: mErr } = await supabase
        .from("matches")
        .select("id")
        .eq("league_group_id", groupId)
        .limit(1);
      if (mErr)
        return logAndThrow("select matches by group", mErr, { groupId });
      if (Array.isArray(m) && m.length > 0) {
        showNotification(
          "Impossible de supprimer: des matchs référencent ce groupe.",
          "error"
        );
        return;
      }
      // Delete team links first
      const { error: delLinksErr } = await supabase
        .from("league_group_teams")
        .delete()
        .eq("league_group_id", groupId);
      if (delLinksErr)
        return logAndThrow("clear league_group_teams", delLinksErr, {
          groupId,
        });
      // Delete group
      const { error } = await supabase
        .from("league_groups")
        .delete()
        .eq("id", groupId);
      if (error) return logAndThrow("delete league_group", error, { groupId });
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      showNotification("Groupe supprimé.", "success");
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
      const u = (users || []).find((u) => u.id === userId);
      const displayName =
        (u as any)?.fullName ||
        (u as any)?.full_name ||
        (u as any)?.email ||
        userId;
      showNotification(
        `Rôle de ${displayName} mis à jour: ${roleName}.`,
        "success"
      );
    } catch (e: any) {
      showNotification(`Erreur mise à jour rôle: ${e.message}`, "error");
    }
  };

  // --- Restore (unarchive) actions ---
  const onRestoreOfficial = async (officialId: string) => {
    try {
      const { error } = await supabase
        .from("officials")
        .update({ is_archived: false, updated_by: user?.id || null })
        .eq("id", officialId);
      if (error) return logAndThrow("restore official", error, { officialId });
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      showNotification("Officiel restauré.", "success");
    } catch (e: any) {
      showNotification(`Erreur restauration officiel: ${e.message}`, "error");
    }
  };

  const onRestoreTeam = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from("teams")
        .update({ is_archived: false, updated_by: user?.id || null })
        .eq("id", teamId);
      if (error) return logAndThrow("restore team", error, { teamId });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      showNotification("Équipe restaurée.", "success");
    } catch (e: any) {
      showNotification(`Erreur restauration équipe: ${e.message}`, "error");
    }
  };

  const onRestoreStadium = async (stadiumId: string) => {
    try {
      const { error } = await supabase
        .from("stadiums")
        .update({ is_archived: false, updated_by: user?.id || null })
        .eq("id", stadiumId);
      if (error) return logAndThrow("restore stadium", error, { stadiumId });
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      showNotification("Stade restauré.", "success");
    } catch (e: any) {
      showNotification(`Erreur restauration stade: ${e.message}`, "error");
    }
  };

  const onRestoreMatch = async (matchId: string) => {
    try {
      const { error } = await supabase
        .from("matches")
        .update({ is_archived: false, updated_by: user?.id || null })
        .eq("id", matchId);
      if (error) return logAndThrow("restore match", error, { matchId });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Match restauré.", "success");
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

  const onAddAssignment = async (
    matchId: string,
    role: OfficialRole
  ): Promise<void> => {
    try {
      await addAssignmentMutate({
        matchId,
        role,
        officialId: null,
        createdBy: user?.id || null,
        updatedBy: user?.id || null,
      });
      const { error: upErr } = await supabase
        .from("matches")
        .update({ has_unsent_changes: true, updated_by: user?.id || null })
        .eq("id", matchId);
      if (upErr)
        return logAndThrow("set match unsent after add assignment", upErr, {
          matchId,
          role,
        });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      showNotification("Désignation ajoutée.", "success");
    } catch (e: any) {
      showNotification(`Erreur ajout désignation: ${e?.message || e}`, "error");
    }
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
    onNotifyChanges: handleSendMatchSheet,
    onAddAssignment: onAddAssignment,
    onRemoveAssignment,
    onUpdateGameDaySchedule,
    onSaveMatch,
    onSaveStadium: onSaveStadium,
    onUpdateOfficialEmail: (officialId: string, email: string) =>
      onUpdateOfficial({ id: officialId, email }),
    onPrintIndividualMissionOrder: onPrintIndividualMissionOrder,
    onSendIndividualMissionOrder: handleSendIndividualMissionOrder,
    onSendAllMissionOrders: handleSendAllMissionOrders,
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
              onSavePlayer={async (player: any) => {
                try {
                  const {
                    id,
                    createdByName,
                    updatedByName,
                    fullName,
                    ...rest
                  } = player || {};
                  const { error } = await supabase.from("players").upsert({
                    ...rest,
                    id,
                    updated_by: user?.id || null,
                    ...(id ? {} : { created_by: user?.id || null }),
                  });
                  if (error)
                    return logAndThrow("upsert player (disciplinary)", error, {
                      id,
                      rest,
                    });
                  showNotification("Joueur sauvegardé.", "success");
                  queryClient.invalidateQueries({ queryKey: ["players"] });
                } catch (e: any) {
                  showNotification(`Erreur: ${e.message}`, "error");
                }
              }}
              onArchivePlayer={async (playerId: string) => {
                try {
                  const { error } = await supabase
                    .from("players")
                    .update({ is_archived: true, updated_by: user?.id || null })
                    .eq("id", playerId);
                  if (error)
                    return logAndThrow("archive player", error, { playerId });
                  showNotification("Joueur archivé.", "success");
                } catch (e: any) {
                  showNotification(`Erreur: ${e.message}`, "error");
                }
              }}
              onSaveSanction={async (sanction: any) => {
                try {
                  const { id, createdByName, ...rest } = sanction || {};
                  const { error } = await supabase.from("sanctions").upsert({
                    ...rest,
                    id,
                    updated_by: user?.id || null,
                    ...(id ? {} : { created_by: user?.id || null }),
                  });
                  if (error)
                    return logAndThrow("upsert sanction", error, { id, rest });
                  showNotification("Sanction sauvegardée.", "success");
                } catch (e: any) {
                  showNotification(`Erreur: ${e.message}`, "error");
                }
              }}
              onCancelSanction={async (sanctionId: string) => {
                try {
                  const { error } = await supabase
                    .from("sanctions")
                    .update({
                      is_cancelled: true,
                      updated_by: user?.id || null,
                    })
                    .eq("id", sanctionId);
                  if (error)
                    return logAndThrow("cancel sanction", error, {
                      sanctionId,
                    });
                  showNotification("Sanction annulée.", "success");
                } catch (e: any) {
                  showNotification(`Erreur: ${e.message}`, "error");
                }
              }}
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
              onUpdateUnavailabilities={onUpdateUnavailabilities}
              onSaveOfficial={onSaveOfficial}
              onArchiveOfficial={onArchiveOfficial}
              onBulkUpdateOfficialLocations={onBulkUpdateOfficialLocations}
              onBulkArchiveOfficials={onBulkArchiveOfficials}
              onBulkUpdateOfficialCategory={onBulkUpdateOfficialCategory}
              onSendBulkMessage={onSendBulkMessage}
              currentUser={user!}
              permissions={permissions}
              logAction={logAction}
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
              onUpdatePaymentNotes={async (
                assignmentId: string,
                notes: string | null
              ) => {
                try {
                  const { error } = await supabase
                    .from("match_assignments")
                    .update({ notes, updated_by: user?.id || null })
                    .eq("id", assignmentId);
                  if (error)
                    return logAndThrow("update payment notes", error, {
                      assignmentId,
                    });
                  showNotification("Note mise à jour.", "success");
                  queryClient.invalidateQueries({ queryKey: ["payments"] });
                } catch (e: any) {
                  showNotification(`Erreur: ${e.message}`, "error");
                }
              }}
              onBulkUpdatePaymentNotes={async (
                updates: { id: string; notes: string | null }[]
              ) => {
                try {
                  const rows = updates.map((u) => ({
                    id: u.id,
                    notes: u.notes,
                    updated_by: user?.id || null,
                  }));
                  const { error } = await supabase
                    .from("match_assignments")
                    .upsert(rows);
                  if (error)
                    return logAndThrow("bulk update payment notes", error, {
                      count: rows.length,
                    });
                  showNotification(
                    `${updates.length} notes mises à jour.`,
                    "success"
                  );
                  queryClient.invalidateQueries({ queryKey: ["payments"] });
                } catch (e: any) {
                  showNotification(`Erreur: ${e.message}`, "error");
                }
              }}
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
                onSubmit={async (
                  matchId: string,
                  scores: { home: number; away: number } | null,
                  updatedAssignments: any[]
                ) => {
                  try {
                    const matchUpdate: any = {
                      accounting_status: "pending_validation",
                      rejection_reason: null,
                      rejection_comment: null,
                      updated_by: user?.id || null,
                    };
                    if (scores) {
                      matchUpdate.home_score = scores.home;
                      matchUpdate.away_score = scores.away;
                      matchUpdate.status = "completed";
                    }
                    const { error: mErr } = await supabase
                      .from("matches")
                      .update(matchUpdate)
                      .eq("id", matchId);
                    if (mErr)
                      return logAndThrow(
                        "accounting submit: update match",
                        mErr,
                        { matchId, matchUpdate }
                      );

                    if (updatedAssignments?.length) {
                      const rows = updatedAssignments.map((a: any) => ({
                        id: a.id,
                        match_id: matchId,
                        role: a.role,
                        official_id: a.officialId,
                        travel_distance_km: a.travelDistanceInKm ?? 0,
                        indemnity_amount: a.indemnityAmount ?? 0,
                        notes: a.notes ?? null,
                        updated_by: user?.id || null,
                      }));
                      const { error: aErr } = await supabase
                        .from("match_assignments")
                        .upsert(rows);
                      if (aErr)
                        return logAndThrow(
                          "accounting submit: upsert assignments",
                          aErr,
                          { count: rows.length, matchId }
                        );
                    }
                    showNotification(
                      "Données soumises pour validation.",
                      "success"
                    );
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                    queryClient.invalidateQueries({ queryKey: ["payments"] });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                onValidate={async (matchId: string) => {
                  try {
                    const { error } = await supabase
                      .from("matches")
                      .update({
                        accounting_status: "validated",
                        validated_by: user?.id || null,
                        validated_at: new Date().toISOString(),
                        updated_by: user?.id || null,
                      })
                      .eq("id", matchId);
                    if (error)
                      return logAndThrow("accounting validate", error, {
                        matchId,
                      });
                    showNotification("Saisie validée.", "success");
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                    queryClient.invalidateQueries({ queryKey: ["payments"] });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                onReject={async (
                  matchId: string,
                  reason: string,
                  comment: string
                ) => {
                  try {
                    const { error } = await supabase
                      .from("matches")
                      .update({
                        accounting_status: "rejected",
                        rejection_reason: reason,
                        rejection_comment: comment,
                        validated_by: null,
                        validated_at: null,
                        updated_by: user?.id || null,
                      })
                      .eq("id", matchId);
                    if (error)
                      return logAndThrow("accounting reject", error, {
                        matchId,
                      });
                    showNotification("Saisie rejetée.", "success");
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                    queryClient.invalidateQueries({ queryKey: ["payments"] });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                onReopenGameDay={async (periodId: string) => {
                  try {
                    const { error } = await supabase.functions.invoke(
                      "reopen-accounting-period",
                      { body: { type: "daily", periodId } }
                    );
                    if (error)
                      return logAndThrow(
                        "invoke reopen-accounting-period (daily)",
                        error,
                        { periodId }
                      );
                    showNotification("Journée réouverte.", "success");
                    queryClient.invalidateQueries({
                      queryKey: ["accountingPeriods"],
                    });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                onCloseMonth={async (month: string) => {
                  try {
                    const { error } = await supabase.functions.invoke(
                      "close-accounting-period",
                      {
                        body: { type: "monthly", periodIdentifier: { month } },
                      }
                    );
                    if (error)
                      return logAndThrow(
                        "invoke close-accounting-period (monthly)",
                        error,
                        { month }
                      );
                    showNotification("Mois clôturé.", "success");
                    queryClient.invalidateQueries({
                      queryKey: ["accountingPeriods"],
                    });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                onReopenMonth={async (periodId: string) => {
                  try {
                    const { error } = await supabase.functions.invoke(
                      "reopen-accounting-period",
                      { body: { type: "monthly", periodId } }
                    );
                    if (error)
                      return logAndThrow(
                        "invoke reopen-accounting-period (monthly)",
                        error,
                        { periodId }
                      );
                    showNotification("Mois réouvert.", "success");
                    queryClient.invalidateQueries({
                      queryKey: ["accountingPeriods"],
                    });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
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
                onCreatePaymentBatch={async (
                  paymentIds: string[],
                  batchDetails: {
                    batchReference: string;
                    batchDate: string;
                    debitAccountNumber: string;
                  },
                  ediFile?: { content: string; name: string }
                ) => {
                  try {
                    const { data: period, error: perr } = await supabase
                      .from("accounting_periods")
                      .insert({
                        type: "payment_batch",
                        period_date: batchDetails.batchDate,
                        status: "closed",
                        closed_by: user?.id || null,
                        closed_at: new Date().toISOString(),
                      })
                      .select()
                      .single();
                    if (perr)
                      return logAndThrow("create payment batch period", perr, {
                        batchDetails,
                      });

                    const total = (payments as Payment[])
                      .filter((p) => paymentIds.includes(p.id))
                      .reduce((s, p) => s + (p.total || 0), 0);

                    const { error: berr } = await supabase
                      .from("payment_batches")
                      .insert({
                        id: period.id,
                        reference: batchDetails.batchReference,
                        total_amount: total,
                        payment_count: paymentIds.length,
                        debit_account_number: batchDetails.debitAccountNumber,
                      });
                    if (berr)
                      return logAndThrow("insert payment_batches", berr, {
                        periodId: period.id,
                      });

                    const { data: assn, error: aerr } = await supabase
                      .from("match_assignments")
                      .select("match_id")
                      .in("id", paymentIds);
                    if (aerr)
                      return logAndThrow(
                        "select assignments for batch matches",
                        aerr,
                        { count: paymentIds.length }
                      );
                    const matchIds = Array.from(
                      new Set((assn || []).map((a: any) => a.match_id))
                    );
                    if (matchIds.length > 0) {
                      const { error: merr } = await supabase
                        .from("matches")
                        .update({
                          accounting_status: "closed",
                          accounting_period_id: period.id,
                          updated_by: user?.id || null,
                        })
                        .in("id", matchIds);
                      if (merr)
                        return logAndThrow(
                          "close matches for payment batch",
                          merr,
                          { periodId: period.id, count: matchIds.length }
                        );
                    }

                    if (ediFile) {
                      try {
                        const blob = new Blob([ediFile.content], {
                          type: "text/plain;charset=utf-8",
                        });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = ediFile.name;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        URL.revokeObjectURL(link.href);
                      } catch (_) {}
                    }

                    showNotification(
                      "Lot de virement créé et clôturé.",
                      "success"
                    );
                    queryClient.invalidateQueries({
                      queryKey: ["accountingPeriods"],
                    });
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                accountingPeriods={accountingPeriods || []}
                onCancelPaymentBatch={async (batchId: string) => {
                  try {
                    const { data: matchesToRevert, error: ferr } =
                      await supabase
                        .from("matches")
                        .select("id")
                        .eq("accounting_period_id", batchId);
                    if (ferr)
                      return logAndThrow(
                        "fetch matches for batch cancel",
                        ferr,
                        { batchId }
                      );
                    const ids = (matchesToRevert || []).map((m: any) => m.id);
                    if (ids.length > 0) {
                      const { error: uerr } = await supabase
                        .from("matches")
                        .update({
                          accounting_status: "validated",
                          accounting_period_id: null,
                          updated_by: user?.id || null,
                        })
                        .in("id", ids);
                      if (uerr)
                        return logAndThrow(
                          "revert matches on batch cancel",
                          uerr,
                          { count: ids.length }
                        );
                    }
                    const { error: perr2 } = await supabase
                      .from("accounting_periods")
                      .update({
                        status: "open",
                        reopened_by: user?.id || null,
                        reopened_at: new Date().toISOString(),
                      })
                      .eq("id", batchId);
                    if (perr2)
                      return logAndThrow(
                        "reopen accounting period (batch cancel)",
                        perr2,
                        { batchId }
                      );
                    showNotification("Lot de virement annulé.", "success");
                    queryClient.invalidateQueries({
                      queryKey: ["accountingPeriods"],
                    });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
                onSaveProofOfPayment={async (
                  batchId: string,
                  proof: { transactionId?: string; file?: File }
                ) => {
                  try {
                    const update: any = { transaction_id: proof.transactionId };
                    if (proof.file) {
                      const filePath = `proofs/${batchId}/${proof.file.name}`;
                      const { error: upErr } = await supabase.storage
                        .from("payment_proofs")
                        .upload(filePath, proof.file, { upsert: true });
                      if (upErr)
                        return logAndThrow("upload proof_of_payment", upErr, {
                          batchId,
                          filePath,
                        });
                      const { data: pub } = supabase.storage
                        .from("payment_proofs")
                        .getPublicUrl(filePath);
                      update.proof_of_payment_url = pub.publicUrl;
                      update.proof_of_payment_filename = proof.file.name;
                    }
                    const { error } = await supabase
                      .from("payment_batches")
                      .update(update)
                      .eq("id", batchId);
                    if (error)
                      return logAndThrow("update payment_batches", error, {
                        batchId,
                      });
                    showNotification("Preuve sauvegardée.", "success");
                    queryClient.invalidateQueries({
                      queryKey: ["accountingPeriods"],
                    });
                  } catch (e: any) {
                    showNotification(`Erreur: ${e.message}`, "error");
                  }
                }}
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
                onGenerateTemplate={(headers, sheetName, fileName) =>
                  generateTemplate(headers, sheetName, fileName)
                }
                onImportOfficials={async (data) => {
                  try {
                    const rows = data.map((o: any) => ({
                      id: o.id,
                      first_name: o.firstName,
                      last_name: o.lastName,
                      first_name_ar: o.firstNameAr ?? null,
                      last_name_ar: o.lastNameAr ?? null,
                      category: o.category,
                      location_id: o.locationId ?? null,
                      address: o.address ?? null,
                      position: o.position ?? null,
                      email: o.email ?? null,
                      phone: o.phone ?? null,
                      bank_account_number: o.bankAccountNumber ?? null,
                      is_active: true,
                      is_archived: false,
                      created_by: user?.id || null,
                      updated_by: user?.id || null,
                    }));
                    const { error } = await supabase
                      .from("officials")
                      .upsert(rows);
                    if (error)
                      return logAndThrow("import officials upsert", error, {
                        count: rows.length,
                      });
                    showNotification(
                      `${rows.length} officiels importés/synchronisés.`,
                      "success"
                    );
                    queryClient.invalidateQueries({ queryKey: ["officials"] });
                  } catch (e: any) {
                    showNotification(
                      `Erreur import officiels: ${e.message}`,
                      "error"
                    );
                  }
                }}
                onImportTeams={async (data) => {
                  const normalizeCode = (name: string) =>
                    name
                      .toUpperCase()
                      .normalize("NFD")
                      .replace(/[^A-Z0-9]+/g, "")
                      .slice(0, 10);
                  try {
                    const rows = (data as any[]).map((t) => ({
                      id: t.id,
                      code: normalizeCode(t.name),
                      name: t.name,
                      full_name: t.fullName ?? null,
                      logo_url: t.logoUrl ?? null,
                      primary_color: t.primaryColor ?? null,
                      secondary_color: t.secondaryColor ?? null,
                      founded_year: t.foundedYear ?? null,
                      created_by: user?.id || null,
                      updated_by: user?.id || null,
                    }));
                    const { error } = await supabase.from("teams").upsert(rows);
                    if (error)
                      return logAndThrow("import teams upsert", error, {
                        count: rows.length,
                      });
                    showNotification(
                      `${rows.length} équipes importées/synchronisées.`,
                      "success"
                    );
                    queryClient.invalidateQueries({ queryKey: ["teams"] });
                  } catch (e: any) {
                    showNotification(
                      `Erreur import équipes: ${e.message}`,
                      "error"
                    );
                  }
                }}
                onImportStadiums={async (data) => {
                  try {
                    const rows = (data as any[]).map((s) => ({
                      id: s.id,
                      name: s.name,
                      location_id: s.locationId ?? null,
                      created_by: user?.id || null,
                      updated_by: user?.id || null,
                    }));
                    const { error } = await supabase
                      .from("stadiums")
                      .upsert(rows);
                    if (error)
                      return logAndThrow("import stadiums upsert", error, {
                        count: rows.length,
                      });
                    showNotification(
                      `${rows.length} stades importés/synchronisés.`,
                      "success"
                    );
                    queryClient.invalidateQueries({ queryKey: ["stadiums"] });
                  } catch (e: any) {
                    showNotification(
                      `Erreur import stades: ${e.message}`,
                      "error"
                    );
                  }
                }}
                onImportMatches={async (data) => {
                  try {
                    const rows = (data as any[]).map((m) => ({
                      id: m.id,
                      season: m.season,
                      game_day: m.gameDay,
                      league_group_id: m.leagueGroup?.id,
                      match_date: m.matchDate ?? null,
                      match_time: m.matchTime ?? null,
                      home_team_id: m.homeTeam?.id,
                      away_team_id: m.awayTeam?.id,
                      stadium_id: m.stadium?.id ?? null,
                      status: "scheduled",
                      has_unsent_changes: true,
                      created_by: user?.id || null,
                      updated_by: user?.id || null,
                    }));
                    const { error } = await supabase
                      .from("matches")
                      .upsert(rows);
                    if (error)
                      return logAndThrow("import matches upsert", error, {
                        count: rows.length,
                      });
                    showNotification(
                      `${rows.length} matchs importés/synchronisés.`,
                      "success"
                    );
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                  } catch (e: any) {
                    showNotification(
                      `Erreur import matchs: ${e.message}`,
                      "error"
                    );
                  }
                }}
                onImportAssignments={async (data) => {
                  try {
                    const items = data as Array<{
                      matchId: string;
                      role: string;
                      officialId: string;
                    }>;
                    const byMatch = new Map<string, typeof items>();
                    items.forEach((it) => {
                      const arr = byMatch.get(it.matchId) || [];
                      arr.push(it);
                      byMatch.set(it.matchId, arr);
                    });
                    for (const [matchId, arr] of byMatch.entries()) {
                      const match = matches.find((m) => m.id === matchId);
                      if (!match) continue;
                      const existing = match.assignments;
                      const updates: any[] = [];
                      const inserts: any[] = [];
                      for (const it of arr) {
                        const slot = existing.find(
                          (a) => a.role === it.role && !a.officialId
                        );
                        if (slot) {
                          updates.push({
                            id: slot.id,
                            official_id: it.officialId,
                            updated_by: user?.id || null,
                          });
                        } else {
                          inserts.push({
                            match_id: matchId,
                            role: it.role,
                            official_id: it.officialId,
                            created_by: user?.id || null,
                            updated_by: user?.id || null,
                          });
                        }
                      }
                      if (updates.length > 0) {
                        const { error: uerr } = await supabase
                          .from("match_assignments")
                          .upsert(updates);
                        if (uerr) throw uerr;
                      }
                      if (inserts.length > 0) {
                        const { error: ierr } = await supabase
                          .from("match_assignments")
                          .insert(inserts);
                        if (ierr) throw ierr;
                      }
                      const { error: matchUpdateErr } = await supabase
                        .from("matches")
                        .update({
                          has_unsent_changes: true,
                          updated_by: user?.id || null,
                        })
                        .eq("id", matchId);
                      if (matchUpdateErr)
                        return logAndThrow(
                          "set match unsent after import assignments",
                          matchUpdateErr,
                          { matchId }
                        );
                    }
                    showNotification("Désignations importées.", "success");
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                  } catch (e: any) {
                    showNotification(
                      `Erreur import désignations: ${e.message}`,
                      "error"
                    );
                  }
                }}
                onImportOptimizedAssignments={async (data) => {
                  try {
                    // data: array of { match_id, official_id }
                    const items = data as Array<{
                      match_id: string;
                      official_id: string;
                    }>;
                    const byMatch = new Map<
                      string,
                      Array<{ official_id: string }>
                    >();
                    items.forEach((it) => {
                      const arr = byMatch.get(it.match_id) || [];
                      arr.push({ official_id: it.official_id });
                      byMatch.set(it.match_id, arr);
                    });
                    for (const [matchId, arr] of byMatch.entries()) {
                      const match = matches.find((m) => m.id === matchId);
                      if (!match) continue;
                      const delegateSlots = match.assignments.filter((a) =>
                        a.role.toLowerCase().includes("délégué")
                      );
                      let slotIdx = 0;
                      const updates: any[] = [];
                      const inserts: any[] = [];
                      for (const it of arr) {
                        let slot = delegateSlots.find(
                          (s) =>
                            !s.officialId && delegateSlots.indexOf(s) >= slotIdx
                        );
                        if (slot) {
                          updates.push({
                            id: slot.id,
                            official_id: it.official_id,
                            updated_by: user?.id || null,
                          });
                          slotIdx = delegateSlots.indexOf(slot) + 1;
                        } else {
                          inserts.push({
                            match_id: matchId,
                            role: delegateSlots[0]?.role || "Délégué",
                            official_id: it.official_id,
                            created_by: user?.id || null,
                            updated_by: user?.id || null,
                          });
                        }
                      }
                      if (updates.length > 0) {
                        const { error: uerr } = await supabase
                          .from("match_assignments")
                          .upsert(updates);
                        if (uerr) throw uerr;
                      }
                      if (inserts.length > 0) {
                        const { error: ierr } = await supabase
                          .from("match_assignments")
                          .insert(inserts);
                        if (ierr) throw ierr;
                      }
                      const { error: matchUpdateErr } = await supabase
                        .from("matches")
                        .update({
                          has_unsent_changes: true,
                          updated_by: user?.id || null,
                        })
                        .eq("id", matchId);
                      if (matchUpdateErr)
                        return logAndThrow(
                          "set match unsent after import optimized",
                          matchUpdateErr,
                          { matchId }
                        );
                    }
                    showNotification(
                      "Désignations (optimisées) importées.",
                      "success"
                    );
                    queryClient.invalidateQueries({ queryKey: ["matches"] });
                  } catch (e: any) {
                    showNotification(
                      `Erreur import optimisation: ${e.message}`,
                      "error"
                    );
                  }
                }}
                onLaunchOptimization={async (scope) => {
                  try {
                    const scopeSet = new Set(scope.leagueGroupIds);
                    const daysSet = new Set(scope.gameDays);
                    const matchesInScope = matches.filter(
                      (m) =>
                        scopeSet.has(m.leagueGroup.id) && daysSet.has(m.gameDay)
                    );
                    if (matchesInScope.length === 0) {
                      showNotification(
                        "Aucun match dans le périmètre.",
                        "error"
                      );
                      return;
                    }
                    const csvs: Record<string, string> = {
                      officials: generateOfficialsCsv(
                        officials,
                        settings?.locations || [],
                        settings?.optimization_settings || {
                          travelSpeedKmph: 70,
                          bufferMin: 30,
                          matchDurationMin: 120,
                          defaultMatchRisk: 1,
                          categoryGradeMap: {},
                          categoryCapacityMap: {},
                        },
                        matchesInScope
                      ),
                      matches: generateMatchesCsv(
                        matchesInScope,
                        settings?.locations || [],
                        settings?.optimization_settings || {
                          travelSpeedKmph: 70,
                          bufferMin: 30,
                          matchDurationMin: 120,
                          defaultMatchRisk: 1,
                          categoryGradeMap: {},
                          categoryCapacityMap: {},
                        }
                      ),
                      stadiums: generateStadiumsCsv(
                        stadiums,
                        settings?.locations || []
                      ),
                      availability: generateAvailabilityCsv(
                        officials,
                        matchesInScope
                      ),
                      forbidden: generateForbiddenCsv(),
                    };
                    await downloadOptimizationDataAsZip(csvs);
                    showNotification(
                      "Données d'optimisation exportées.",
                      "success"
                    );
                  } catch (e: any) {
                    showNotification(
                      `Erreur export optimisation: ${e.message}`,
                      "error"
                    );
                  }
                }}
                currentUser={user!}
                permissions={permissions}
                isDirty={settingsDirty}
                setIsDirty={setSettingsDirty}
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
