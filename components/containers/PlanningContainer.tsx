import React, { useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { useAuth } from "../../contexts/AuthContext";
import { useLeagueGroups } from "../../hooks/useLeagueGroups";
import { useTeams } from "../../hooks/useTeams";
import { useOfficials } from "../../hooks/useOfficials";
import {
  useMatches,
  useBulkUpdateMatchSchedule,
  useUpdateMatch,
} from "../../hooks/useMatches";
import { useStadiums } from "../../hooks/useStadiums";
import { useTeamStadiums } from "../../hooks/useTeamStadiums";
import { useUsers } from "../../hooks/useUsers";
import { useLeagues } from "../../hooks/useLeagues";
import { useAppSettings } from "../../hooks/useAppSettings";
import {
  useSendMatchSheet,
  useSendIndividualMissionOrder,
} from "../../hooks/useCommunication";
import { supabase } from "../../lib/supabaseClient";
import Dashboard from "../Dashboard";
import {
  markMatchAsChanged,
  updateScoreAndComplete,
  upsertMatch,
  archiveMatchWithGuard,
} from "../../services/matchService";
import { mapUiStatusToDb } from "../../utils/dbMapping";
import { OfficialRole, MatchStatus, Match, Official } from "../../types";
import {
  useUpdateAssignment,
  useMarkOfficialAbsent,
  useCreateAssignment,
  useDeleteAssignment,
} from "../../hooks/useAssignments";
import { upsertOfficial as upsertOfficialService } from "../../services/officialService";
import { upsertStadium } from "../../services/stadiumService";
import {
  generateMissionOrderPDF,
  downloadBlob,
} from "../../services/pdfService";

interface PlanningContainerProps {
  currentSeason: string;
  // Handlers passed from router (optional; fall back to local implementations)
  onUpdateAssignment?: (
    matchId: string,
    assignmentId: string,
    officialId: string | null
  ) => void | Promise<void>;
  onUpdateMatchStatus?: (matchId: string, status: MatchStatus) => void;
  onUpdateMatchScoreAndStatus?: (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => void;
  onMarkOfficialAbsent?: (matchId: string, assignmentId: string) => void;
  onArchiveMatch?: (matchId: string) => void | Promise<void>;
  onSendMatchSheet?: (matchId: string) => void | Promise<void>;
  onNotifyChanges?: (matchId: string) => void | Promise<void>;
  onAddAssignment?: (matchId: string, role: OfficialRole) => Promise<void>;
  onRemoveAssignment?: (matchId: string, assignmentId: string) => Promise<void>;
  onUpdateGameDaySchedule?: (
    leagueGroupId: string,
    gameDay: number,
    date: string,
    time: string
  ) => void;
  onSaveMatch?: (matchData: any) => void;
  onSaveStadium?: (stadium: any) => void;
  onUpdateOfficialEmail?: (officialId: string, email: string) => void;
  onPrintIndividualMissionOrder?: (
    matchId: string,
    officialId: string
  ) => void | Promise<void>;
  onSendIndividualMissionOrder?: (
    matchId: string,
    officialId: string
  ) => void | Promise<void>;
  onSendAllMissionOrders?: (matchId: string) => void | Promise<void>;
}

const PlanningContainer: React.FC<PlanningContainerProps> = ({
  currentSeason,
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
  onSaveMatch,
  onSaveStadium,
  onUpdateOfficialEmail,
  onPrintIndividualMissionOrder,
  onSendIndividualMissionOrder,
  onSendAllMissionOrders,
}) => {
  const { user, permissions } = useAuth();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);
  const queryClient = useQueryClient();

  // Fetch only what Dashboard needs for Planning route
  const { data: leagueGroups } = useLeagueGroups({ season: currentSeason });
  const { data: teamsData } = useTeams({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: officialsData } = useOfficials({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: matchesData } = useMatches({
    filters: { season: currentSeason },
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: stadiumsData } = useStadiums({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: teamStadiums } = useTeamStadiums({ season: currentSeason });
  const { data: appSettings } = useAppSettings();
  const { data: users } = useUsers();
  const { data: leagues } = useLeagues();
  const { mutateAsync: sendMatchSheet } = useSendMatchSheet();
  const { mutateAsync: sendIndividualOrder } = useSendIndividualMissionOrder();

  const matches = useMemo(() => matchesData?.data || [], [matchesData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);
  const teams = useMemo(() => teamsData?.data || [], [teamsData]);
  const stadiums = useMemo(() => stadiumsData?.data || [], [stadiumsData]);

  const { mutate: bulkUpdateMatchSchedule } = useBulkUpdateMatchSchedule();
  const { mutate: updateMatchMutate } = useUpdateMatch();
  const { mutateAsync: updateAssignmentMutate } = useUpdateAssignment();
  const { mutate: markOfficialAbsentMutate } = useMarkOfficialAbsent();
  const { mutateAsync: addAssignmentMutate } = useCreateAssignment();
  const { mutate: removeAssignmentMutate } = useDeleteAssignment();

  const localOnUpdateGameDaySchedule = (
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
      bulkUpdateMatchSchedule(
        { matchIds, matchDate: date, matchTime: time },
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

  const localOnUpdateMatchStatus = (matchId: string, status: MatchStatus) => {
    if (!updateMatchMutate) return;
    updateMatchMutate(
      { id: matchId, status: mapUiStatusToDb(status) as any },
      {
        onSuccess: () => notify.success("Statut du match mis à jour."),
        onError: (error: any) =>
          notify.error(`Erreur mise à jour statut: ${error?.message || error}`),
      }
    );
  };

  const { mutate: updateScoreMutate } = useMutation({
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
      if ((variables as any)?.label) {
        notify.success(`Score mis à jour: ${(variables as any).label}.`);
      } else {
        notify.success("Score enregistré avec succès.");
      }
    },
    onError: (error: any) => notify.error(`Erreur: ${error?.message || error}`),
  });

  const localOnUpdateMatchScoreAndStatus = (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    const match = matches.find((m) => m.id === matchId);
    const home = match?.homeTeam?.name || "Domicile";
    const away = match?.awayTeam?.name || "Extérieur";
    const label = `${home} ${homeScore} - ${awayScore} ${away}`;
    updateScoreMutate({ matchId, homeScore, awayScore, label } as any);
  };

  const localOnSendMatchSheet = async (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      notify.error("Match introuvable pour envoi de feuille.");
      return;
    }
    notify.info("Envoi de la feuille de match en cours...");
    await sendMatchSheet({
      match,
      officials,
      locations: appSettings?.locations || [],
    });
    notify.success("Feuille de match envoyée.");
  };

  const localOnSendAllMissionOrders = async (matchId: string) => {
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
    await Promise.all(
      assignedOfficials.map(async (o) => {
        try {
          await sendIndividualOrder({
            match,
            official: o,
            allOfficials: officials,
            allLocations: appSettings?.locations || [],
          });
        } catch (_) {}
      })
    );
    notify.success("Envois terminés.");
  };

  const localOnUpdateAssignment = async (
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
        officialId,
        matchId,
        updatedBy: user.id,
      });
      await markMatchAsChanged(supabase, matchId, user.id);
      notify.success("Désignation mise à jour.");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e: any) {
      notify.error(`Erreur mise à jour désignation: ${e?.message || e}`);
    }
  };

  const localOnMarkOfficialAbsent = (matchId: string, assignmentId: string) => {
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
          onSuccess: () => notify.success("Officiel marqué absent."),
          onError: (e: any) =>
            notify.error(`Erreur marquage absence: ${e?.message || e}`),
        }
      );
    }
  };

  const localOnArchiveMatch = async (matchId: string) => {
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

  const localOnAddAssignment = async (
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

  const localOnRemoveAssignment = async (
    matchId: string,
    assignmentId: string
  ): Promise<void> => {
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
      notify.error(`Erreur suppression désignation: ${e?.message || e}`);
    }
  };

  const localOnPrintIndividualMissionOrder = async (
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
      notify.error(`Erreur génération PDF: ${e?.message || e}`);
    }
  };

  const localOnSendIndividualMissionOrder = async (
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
      await sendIndividualOrder({
        match,
        official,
        allOfficials: officials,
        allLocations: appSettings?.locations || [],
      });
      notify.success("Ordre de mission envoyé.");
    } catch (e: any) {
      notify.error(`Erreur envoi ordre de mission: ${e?.message || e}`);
    }
  };

  const localOnSaveMatch = async (
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
    try {
      notify.info("Enregistrement en cours…");
      await upsertMatch(supabase, matchData, user?.id || null);
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      notify.success("Match planifié/mis à jour avec succès.");
    } catch (e: any) {
      notify.error(`Erreur: ${e?.message || e}`);
    }
  };

  const localOnSaveStadium = async (stadium: any) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertStadium(supabase, stadium, user?.id || null);
      queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      notify.success(`Stade "${stadium?.name || ""}" sauvegardé.`);
    } catch (e: any) {
      notify.error(`Erreur sauvegarde stade: ${e?.message || e}`);
    }
  };

  const localOnUpdateOfficialEmail = async (
    officialId: string,
    email: string
  ) => {
    const official = officials.find((o) => o.id === officialId);
    if (!official) {
      notify.error("Officiel introuvable.");
      return;
    }
    try {
      notify.info("Enregistrement en cours…");
      await upsertOfficialService(
        supabase,
        { ...official, email },
        user?.id || null
      );
      queryClient.invalidateQueries({ queryKey: ["officials"] });
      notify.success("Email de l'officiel mis à jour.");
    } catch (e: any) {
      notify.error(`Erreur: ${e?.message || e}`);
    }
  };

  // Use router-provided handlers when available
  const effectiveOnUpdateGameDaySchedule =
    onUpdateGameDaySchedule || localOnUpdateGameDaySchedule;
  const effectiveOnUpdateMatchScoreAndStatus =
    onUpdateMatchScoreAndStatus || localOnUpdateMatchScoreAndStatus;
  const effectiveOnSendMatchSheet = onSendMatchSheet || localOnSendMatchSheet;
  const effectiveOnNotifyChanges = onNotifyChanges || localOnSendMatchSheet;
  const effectiveOnSendAllMissionOrders =
    onSendAllMissionOrders || localOnSendAllMissionOrders;

  // Wrap maybe-void handlers into Promise-returning functions for Dashboard props
  const sendMatchSheetAsync = async (matchId: string) => {
    await Promise.resolve(effectiveOnSendMatchSheet(matchId) as any);
  };
  const notifyChangesAsync = async (matchId: string) => {
    notify.info("Notification des changements en cours...");
    await Promise.resolve(effectiveOnNotifyChanges(matchId) as any);
    notify.success("Notifications de changements envoyées.");
  };

  return (
    <Dashboard
      matches={matches}
      officials={officials}
      users={users || []}
      teams={teams}
      stadiums={stadiums}
      leagues={leagues || []}
      leagueGroups={leagueGroups || []}
      locations={appSettings?.locations || []}
      officialRoles={appSettings?.roles || []}
      teamStadiums={teamStadiums || []}
      seasons={appSettings?.seasons || []}
      currentSeason={currentSeason}
      currentUser={user!}
      permissions={permissions}
      onUpdateAssignment={onUpdateAssignment || localOnUpdateAssignment}
      onUpdateMatchStatus={onUpdateMatchStatus || localOnUpdateMatchStatus}
      onUpdateMatchScoreAndStatus={effectiveOnUpdateMatchScoreAndStatus}
      onMarkOfficialAbsent={onMarkOfficialAbsent || localOnMarkOfficialAbsent}
      onArchiveMatch={onArchiveMatch || localOnArchiveMatch}
      onSendMatchSheet={sendMatchSheetAsync}
      onNotifyChanges={notifyChangesAsync}
      onAddAssignment={onAddAssignment || localOnAddAssignment}
      onRemoveAssignment={onRemoveAssignment || localOnRemoveAssignment}
      onUpdateGameDaySchedule={effectiveOnUpdateGameDaySchedule}
      onSaveMatch={onSaveMatch || localOnSaveMatch}
      onSaveStadium={onSaveStadium || localOnSaveStadium}
      onUpdateOfficialEmail={
        onUpdateOfficialEmail || localOnUpdateOfficialEmail
      }
      onPrintIndividualMissionOrder={
        onPrintIndividualMissionOrder || localOnPrintIndividualMissionOrder
      }
      onSendIndividualMissionOrder={
        onSendIndividualMissionOrder || localOnSendIndividualMissionOrder
      }
      onSendAllMissionOrders={effectiveOnSendAllMissionOrders}
    />
  );
};

export default PlanningContainer;
