// components/AppRouter.tsx

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./Header";
const Dashboard = React.lazy(() => import("./Dashboard"));
const PlanningContainer = React.lazy(
  () => import("./containers/PlanningContainer")
);
const OfficialsContainer = React.lazy(
  () => import("./containers/OfficialsContainer")
);
const FinancesView = React.lazy(() => import("./FinancesView"));
const FinancesContainer = React.lazy(
  () => import("./containers/FinancesContainer")
);
const ClubsContainer = React.lazy(() => import("./containers/ClubsContainer"));
const SettingsView = React.lazy(() => import("./SettingsView"));
const SettingsContainer = React.lazy(
  () => import("./containers/SettingsContainer")
);
const AuditLogView = React.lazy(() => import("./AuditLogView"));
const AccountingContainer = React.lazy(
  () => import("./containers/AccountingContainer")
);
const VirementsContainer = React.lazy(
  () => import("./containers/VirementsContainer")
);
const EtatsContainer = React.lazy(() => import("./containers/EtatsContainer"));
const DisciplinaryView = React.lazy(() => import("./DisciplinaryView"));
const DisciplinaryContainer = React.lazy(
  () => import("./containers/DisciplinaryContainer")
);
const RankingsView = React.lazy(() => import("./RankingsView"));
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../hooks/useAppSettings";
import { useLeagues, useCreateLeague } from "../hooks/useLeagues";
import { useLeagueGroups } from "../hooks/useLeagueGroups";
import { useTeams } from "../hooks/useTeams";
import { useStadiums } from "../hooks/useStadiums";
import { useTeamStadiums } from "../hooks/useTeamStadiums";
import { useUsers } from "../hooks/useUsers";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { useAccountingPeriods } from "../hooks/useAccountingPeriods";
import { useSanctions } from "../hooks/useSanctions";
import { usePlayers } from "../hooks/usePlayers";
import { usePayments } from "../hooks/usePayments";
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
} from "../hooks/useMatches";
import { supabase } from "../lib/supabaseClient";
import { logAndThrow, logWarning } from "../utils/logging";
import { generateMissionOrderPDF, downloadBlob } from "../services/pdfService";
import {
  generateOfficialsCsv,
  generateMatchesCsv,
  generateStadiumsCsv,
  generateAvailabilityCsv,
  generateForbiddenCsv,
  downloadOptimizationDataAsZip,
} from "../services/optimizationService";
import { mapUiStatusToDb } from "../utils/dbMapping";
import { makeNotifier } from "../utils/notify";
import {
  markMatchAsChanged,
  updateScoreAndComplete,
  upsertMatch,
  archiveMatchWithGuard,
} from "../services/matchService";
// Clubs-specific services moved to ClubsContainer
import {
  updateUnavailabilitiesForOfficial,
  upsertOfficial as upsertOfficialService,
  archiveOfficialWithGuard,
  bulkUpdateOfficialLocations as bulkUpdateOfficialLocationsService,
  bulkUpdateOfficialCategory as bulkUpdateOfficialCategoryService,
  bulkArchiveOfficials as bulkArchiveOfficialsService,
} from "../services/officialService";
import {
  createActiveSettingsVersion,
  upsertLeague as upsertLeagueService,
  upsertLeagueGroup as upsertLeagueGroupService,
  saveLeagueGroupTeams,
  deleteLeagueWithGuard,
  deleteLeagueGroupWithGuard,
  updateUserRole as updateUserRoleService,
} from "../services/settingsService";
import { useNotificationContext } from "../contexts/NotificationContext";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useUpdateAssignment,
  useMarkOfficialAbsent,
  useCreateAssignment,
  useDeleteAssignment,
} from "../hooks/useAssignments";
// Clubs-specific stadium update hook moved to ClubsContainer
import {
  useSendMatchSheet,
  useSendIndividualMissionOrder,
} from "../hooks/useCommunication";
import {
  MatchStatus,
  Match,
  Team,
  Stadium,
  Official,
  League,
  LeagueGroup,
  OfficialRole,
  UserRole,
  Player,
} from "../types";

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
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);
  const queryClient = useQueryClient();

  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("all");
  const [settingsDirty, setSettingsDirty] = useState<boolean>(false);

  // Initialize season from localStorage if available; otherwise default to latest from settings
  useEffect(() => {
    const storedSeason = localStorage.getItem("currentSeason");
    if (storedSeason) {
      setCurrentSeason(storedSeason);
      return;
    }
    if (!currentSeason && settings?.seasons && settings.seasons.length > 0) {
      const sortedSeasons = [...settings.seasons].sort((a, b) =>
        b.localeCompare(a)
      );
      setCurrentSeason(sortedSeasons[0]);
    }
  }, [settings]);

  // Initialize league filter from localStorage if available
  useEffect(() => {
    const storedLeagueId = localStorage.getItem("currentLeagueId");
    if (storedLeagueId) setCurrentLeagueId(storedLeagueId);
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    if (currentSeason) localStorage.setItem("currentSeason", currentSeason);
  }, [currentSeason]);
  useEffect(() => {
    if (currentLeagueId)
      localStorage.setItem("currentLeagueId", currentLeagueId);
  }, [currentLeagueId]);

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
      notify.error("Session requise pour modifier une désignation.");
      return;
    }
    try {
      await updateAssignmentMutate({
        id: assignmentId,
        officialId: officialId,
        matchId,
        updatedBy: user.id,
      });
      await supabase;
      await markMatchAsChanged(supabase, matchId, user.id);
      notify.success("Désignation mise à jour.");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e: any) {
      notify.error(`Erreur mise à jour désignation: ${e.message || e}`);
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
            notify.success("Officiel marqué absent.");
          },
          onError: (e: any) => {
            notify.error(`Erreur marquage absence: ${e?.message || e}`);
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
      await markMatchAsChanged(supabase, matchId, user?.id || null);
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      notify.success("Désignation supprimée.");
    } catch (e: any) {
      notify.error(`Erreur suppression désignation: ${e.message || e}`);
    }
  };
  const { mutate: updateMatchMutate } = useUpdateMatch();
  const onUpdateMatchStatus = (matchId: string, status: MatchStatus) =>
    updateMatchMutate(
      { id: matchId, status: mapUiStatusToDb(status) as any },
      {
        onSuccess: () => {
          notify.success("Statut du match mis à jour.");
        },
        onError: (error: any) => {
          notify.error(`Erreur mise à jour statut: ${error?.message || error}`);
        },
      }
    );

  // Removed no-op useEffect

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
  const onArchiveMatch = async (matchId: string) => {
    try {
      await archiveMatchWithGuard(supabase, matchId, user?.id || null);
      notify.success("Match archivé.");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e: any) {
      if (e?.code === "AccountingGuard") {
        const statusLabel = e?.status === "validated" ? "Validé" : "Clôturé";
        notify.error(
          `Impossible d'archiver ce match: statut comptable ${statusLabel}.`
        );
      } else {
        notify.error(`Erreur archivage match: ${e?.message || e}`);
      }
    }
  };

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
      notify.info(
        `Mise à jour des horaires pour ${matchIds.length} match(s)...`
      );
      bulkUpdateMatchScheduleMutate(
        {
          matchIds,
          matchDate: date,
          matchTime: time,
        },
        {
          onSuccess: () => {
            try {
              supabase.from("audit_logs").insert({
                action: `Planification journée J${gameDay}`,
                table_name: "matches",
                record_id: null,
                new_values: {
                  league_group_id: leagueGroupId,
                  game_day: gameDay,
                  match_date: date,
                  match_time: time,
                  count: matchIds.length,
                },
                user_id: user?.id || null,
              });
            } catch (_) {}
            queryClient.invalidateQueries({ queryKey: ["matches"] });
            notify.success("Horaires de la journée mis à jour.");
          },
          onError: (e: any) => {
            notify.error(`Erreur mise à jour horaires: ${e?.message || e}`);
          },
        }
      );
    } else {
      notify.info("Aucun match trouvé pour cette journée/groupe.");
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
      label?: string;
    }) => updateScoreAndComplete(supabase, { matchId, homeScore, awayScore }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      if (variables?.label) {
        notify.success(`Score mis à jour: ${variables.label}.`);
      } else {
        notify.success("Score enregistré avec succès.");
      }
    },
    onError: (error) => notify.error(`Erreur: ${error.message}`),
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
    ) => upsertMatch(supabase, matchData, user?.id || null),
    onMutate: () => {
      notify.info("Enregistrement en cours…");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      notify.success("Match planifié/mis à jour avec succès.");
    },
    onError: (error: any) => notify.error(`Erreur: ${error?.message || error}`),
  });

  const { mutate: onUpdateOfficial } = useUpdateOfficial();

  const { mutateAsync: sendMatchSheetMutation } = useSendMatchSheet();
  const { mutateAsync: sendIndividualMissionOrderMutation } =
    useSendIndividualMissionOrder();

  const handleSendMatchSheet = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      notify.error("Match introuvable pour envoi de feuille.");
      return;
    }
    notify.info("Envoi de la feuille de match en cours...");
    await sendMatchSheetMutation({
      match,
      officials,
      locations: settings?.locations || [],
    });
    notify.success("Feuille de match envoyée.");
  };

  // Clubs handlers moved to ClubsContainer

  const handleSendIndividualMissionOrder = async (
    matchId: string,
    officialId: string
  ) => {
    const match = matches.find((m) => m.id === matchId);
    const official = officials.find((o) => o.id === officialId);
    if (!match || !official) {
      notify.error("Match ou officiel introuvable.");
      return;
    }
    try {
      notify.info("Envoi de l'ordre de mission...");
      await sendIndividualMissionOrderMutation({
        match,
        official,
        allOfficials: officials,
        allLocations: settings?.locations || [],
      });
      notify.success("Ordre de mission envoyé.");
    } catch (e: any) {
      notify.error(`Erreur envoi ordre de mission: ${e?.message || e}`);
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
      notify.success("Ordre de mission généré.");
    } catch (e: any) {
      notify.error(`Erreur génération PDF: ${e.message}`);
    }
  };

  const handleSendAllMissionOrders = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      notify.error("Match non trouvé.");
      return;
    }
    const assignedOfficials = match.assignments
      .map((a) => officials.find((o) => o.id === a.officialId))
      .filter((o): o is Official => !!o && !!o.email);
    if (assignedOfficials.length === 0) {
      notify.error("Aucun officiel désigné avec un email pour ce match.");
      return;
    }
    notify.info(`Envoi en cours pour ${assignedOfficials.length} officiels...`);
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
      notify.success(`${ok.length} ordre(s) envoyé(s) avec succès.`);
    if (fail.length > 0)
      notify.error(
        `${fail.length} échec(s): ${fail.map((f) => f.name).join(", ")}.`
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
      await updateUnavailabilitiesForOfficial(
        supabase,
        officialId,
        newUnavs,
        user?.id || null
      );
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      notify.success("Disponibilités mises à jour.");
    } catch (e: any) {
      notify.error(`Erreur: ${e?.message || e}`);
    }
  };

  const onSaveOfficial = async (official: Official) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertOfficialService(supabase, official, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      notify.success(`Officiel "${official.fullName}" sauvegardé.`);
    } catch (e: any) {
      notify.error(`Erreur: ${e?.message || e}`);
    }
  };

  const onArchiveOfficial = async (officialId: string) => {
    try {
      await archiveOfficialWithGuard(supabase, officialId, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      const name =
        officials.find((o) => o.id === officialId)?.fullName || "Officiel";
      notify.success(`"${name}" archivé.`);
    } catch (e: any) {
      if (e?.message === "OfficialInUse") {
        notify.error(
          "Impossible d'archiver: l'officiel est désigné sur des matchs actifs."
        );
      } else {
        notify.error(`Erreur: ${e?.message || e}`);
      }
    }
  };

  const onBulkUpdateOfficialLocations = async (
    officialIds: string[],
    newLocationId: string
  ) => {
    if (officialIds.length === 0 || !newLocationId) return;
    try {
      notify.info("Enregistrement en cours…");
      await bulkUpdateOfficialLocationsService(
        supabase,
        officialIds,
        newLocationId,
        user?.id || null
      );
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      notify.success(`${officialIds.length} officiel(s) mis à jour.`);
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onBulkUpdateOfficialCategory = async (
    officialIds: string[],
    newCategory: string
  ) => {
    if (officialIds.length === 0 || !newCategory) return;
    try {
      notify.info("Enregistrement en cours…");
      await bulkUpdateOfficialCategoryService(
        supabase,
        officialIds,
        newCategory,
        user?.id || null
      );
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      notify.success(
        `Catégorie mise à jour pour ${officialIds.length} officiels.`
      );
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onBulkArchiveOfficials = async (officialIds: string[]) => {
    if (officialIds.length === 0) return;
    try {
      notify.info("Enregistrement en cours…");
      await bulkArchiveOfficialsService(
        supabase,
        officialIds,
        user?.id || null
      );
      await queryClient.invalidateQueries({ queryKey: ["officials"] });
      notify.success(`${officialIds.length} officiel(s) archivés.`);
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
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
      notify.error("Aucun destinataire avec email valide.");
      return;
    }
    notify.info(`Préparation de l'envoi: ${recipients.length} destinataires.`);
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
      notify.error(`Erreur d'envoi: ${error.message}`);
    } else
      notify.success(`Message envoyé à ${recipients.length} destinataires.`);
  };

  // --- Settings & Leagues/Groups handlers ---
  const onUpdateSettings = async (newSettings: any) => {
    try {
      notify.info("Enregistrement en cours…");
      await createActiveSettingsVersion(
        supabase,
        newSettings,
        user?.id || null
      );
      await queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      notify.success("Paramètres enregistrés.");
      setSettingsDirty(false);
    } catch (e: any) {
      notify.error(`Erreur sauvegarde paramètres: ${e?.message || e}`);
    }
  };

  const onSaveLeague = async (league: Partial<League>) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertLeagueService(supabase, league, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      notify.success(`Ligue "${league.name}" sauvegardée.`);
    } catch (e: any) {
      notify.error(`Erreur sauvegarde ligue: ${e?.message || e}`);
    }
  };

  const onSaveLeagueGroup = async (group: Partial<LeagueGroup>) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertLeagueGroupService(supabase, group, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      notify.success(`Groupe "${group.name}" sauvegardé.`);
    } catch (e: any) {
      notify.error(`Erreur sauvegarde groupe: ${e?.message || e}`);
    }
  };

  const onSaveGroupTeams = async (groupId: string, nextTeamIds: string[]) => {
    try {
      notify.info("Enregistrement en cours…");
      await saveLeagueGroupTeams(supabase, groupId, nextTeamIds);
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      notify.success(`${nextTeamIds.length} équipe(s) associée(s) au groupe.`);
    } catch (e: any) {
      notify.error(`Erreur mise à jour équipes du groupe: ${e?.message || e}`);
    }
  };

  const onDeleteLeague = async (leagueId: string) => {
    try {
      await deleteLeagueWithGuard(supabase, leagueId);
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      notify.success("Ligue supprimée.");
    } catch (e: any) {
      if (e?.code === "LeagueHasGroups") {
        notify.error(
          "Impossible de supprimer: des groupes existent pour cette ligue."
        );
      } else {
        notify.error(`Erreur suppression ligue: ${e?.message || e}`);
      }
    }
  };

  const onDeleteLeagueGroup = async (groupId: string) => {
    try {
      await deleteLeagueGroupWithGuard(supabase, groupId);
      await queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
      notify.success("Groupe supprimé.");
    } catch (e: any) {
      if (e?.code === "GroupHasMatches") {
        notify.error(
          "Impossible de supprimer: des matchs référencent ce groupe."
        );
      } else {
        notify.error(`Erreur suppression groupe: ${e?.message || e}`);
      }
    }
  };

  const onUpdateUserRole = async (userId: string, roleName: string) => {
    try {
      await updateUserRoleService(supabase, userId, roleName, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      const u = (users || []).find((u) => u.id === userId);
      const displayName =
        (u as any)?.fullName ||
        (u as any)?.full_name ||
        (u as any)?.email ||
        userId;
      notify.success(`Rôle de ${displayName} mis à jour: ${roleName}.`);
    } catch (e: any) {
      notify.error(`Erreur mise à jour rôle: ${e?.message || e}`);
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
      notify.success("Officiel restauré.");
    } catch (e: any) {
      notify.error(`Erreur restauration officiel: ${e.message}`);
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
      notify.success("Équipe restaurée.");
    } catch (e: any) {
      notify.error(`Erreur restauration équipe: ${e.message}`);
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
      notify.success("Stade restauré.");
    } catch (e: any) {
      notify.error(`Erreur restauration stade: ${e.message}`);
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
      notify.success("Match restauré.");
    } catch (e: any) {
      notify.error(`Erreur restauration match: ${e.message}`);
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
      await markMatchAsChanged(supabase, matchId, user?.id || null);
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      notify.success("Désignation ajoutée.");
    } catch (e: any) {
      notify.error(`Erreur ajout désignation: ${e?.message || e}`);
    }
  };

  const dashboardProps = {} as any;

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
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-primary"></div>
          </div>
        }
      >
        <Routes>
          <Route
            path="/planning"
            element={<PlanningContainer currentSeason={currentSeason} />}
          />
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
          <Route path="/disciplinary" element={<DisciplinaryContainer />} />
          <Route path="/officials" element={<OfficialsContainer />} />
          <Route
            path="/clubs"
            element={<ClubsContainer currentSeason={currentSeason} />}
          />
          <Route path="/finances" element={<FinancesContainer />} />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "accounting")}>
                <AccountingContainer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/virements"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "finances")}>
                <VirementsContainer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/etats"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "finances")}>
                <EtatsContainer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "audit")}>
                <AuditLogView logs={auditLogs} isLoading={auditLogsLoading} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute isAllowed={permissions.can("view", "settings")}>
                <SettingsContainer currentSeason={currentSeason} />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/planning" replace />} />
          <Route path="*" element={<Navigate to="/planning" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};
