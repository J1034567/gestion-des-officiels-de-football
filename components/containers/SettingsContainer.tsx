import React, { useEffect, useMemo, useState, useCallback } from "react";
import SettingsView from "../SettingsView";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useLeagues } from "../../hooks/useLeagues";
import { useLeagueGroups } from "../../hooks/useLeagueGroups";
import { useTeams } from "../../hooks/useTeams";
import { useStadiums } from "../../hooks/useStadiums";
import { useOfficials } from "../../hooks/useOfficials";
import { useMatches } from "../../hooks/useMatches";
import { useUsers } from "../../hooks/useUsers";
import { useAuditLogs } from "../../hooks/useAuditLogs";
import { supabase } from "../../lib/supabaseClient";
import { generateTemplate } from "../../services/exportService";
import {
  saveImportedOfficials,
  saveImportedTeams,
  saveImportedStadiums,
  saveImportedMatches,
  applyAssignmentsFromData,
  applyOptimizedAssignmentsFromData,
} from "../../services/importService";
import {
  createActiveSettingsVersion,
  upsertLeague as upsertLeagueService,
  upsertLeagueGroup as upsertLeagueGroupService,
  saveLeagueGroupTeams,
  deleteLeagueWithGuard,
  deleteLeagueGroupWithGuard,
  updateUserRole as updateUserRoleService,
} from "../../services/settingsService";
import {
  generateAvailabilityCsv,
  generateForbiddenCsv,
  generateMatchesCsv,
  generateOfficialsCsv,
  generateStadiumsCsv,
  downloadOptimizationDataAsZip,
} from "../../services/optimizationService";
import { UserRole } from "../../types";

type Props = {
  currentSeason: string;
};

const SettingsContainer: React.FC<Props> = ({ currentSeason }) => {
  const { user, permissions } = useAuth();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier((m, t) => showNotification(m, t));
  const queryClient = useQueryClient();

  const { data: settings } = useAppSettings();
  const { data: leagues } = useLeagues();
  const { data: leagueGroupsData } = useLeagueGroups({ season: currentSeason });
  const { data: teamsData } = useTeams({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: stadiumsData } = useStadiums({
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
  const { data: users } = useUsers();

  const matches = useMemo(() => matchesData?.data || [], [matchesData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);
  const teams = useMemo(() => teamsData?.data || [], [teamsData]);
  const stadiums = useMemo(() => stadiumsData?.data || [], [stadiumsData]);
  const leagueGroups = useMemo(
    () => leagueGroupsData || [],
    [leagueGroupsData]
  );

  const [settingsDirty, setSettingsDirty] = useState(false);

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

  const onSaveLeague = async (league: any) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertLeagueService(supabase, league, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["leagues"] });
      notify.success(`Ligue "${league.name}" sauvegardée.`);
    } catch (e: any) {
      notify.error(`Erreur sauvegarde ligue: ${e?.message || e}`);
    }
  };

  const onSaveLeagueGroup = async (group: any) => {
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
      const u = (users || []).find((u) => u.id === userId) as any;
      const displayName = u?.fullName || u?.full_name || u?.email || userId;
      notify.success(`Rôle de ${displayName} mis à jour: ${roleName}.`);
    } catch (e: any) {
      notify.error(`Erreur mise à jour rôle: ${e?.message || e}`);
    }
  };

  const onRestoreOfficial = async (officialId: string) => {
    try {
      const { error } = await supabase
        .from("officials")
        .update({ is_archived: false, updated_by: user?.id || null })
        .eq("id", officialId);
      if (error) throw error;
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
      if (error) throw error;
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
      if (error) throw error;
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
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      notify.success("Match restauré.");
    } catch (e: any) {
      notify.error(`Erreur restauration match: ${e.message}`);
    }
  };

  const allRoles = useMemo(
    () =>
      Object.values(UserRole).map((roleName) => ({
        id: roleName,
        name: roleName,
      })),
    []
  );

  if (!settings || !leagues) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
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
          const count = await saveImportedOfficials(
            supabase,
            data,
            user?.id || null
          );
          notify.success(`${count} officiels importés/synchronisés.`);
          queryClient.invalidateQueries({ queryKey: ["officials"] });
        } catch (e: any) {
          notify.error(`Erreur import officiels: ${e?.message || e}`);
        }
      }}
      onImportTeams={async (data) => {
        try {
          const count = await saveImportedTeams(
            supabase,
            data,
            user?.id || null
          );
          notify.success(`${count} équipes importées/synchronisées.`);
          queryClient.invalidateQueries({ queryKey: ["teams"] });
        } catch (e: any) {
          notify.error(`Erreur import équipes: ${e?.message || e}`);
        }
      }}
      onImportStadiums={async (data) => {
        try {
          const count = await saveImportedStadiums(
            supabase,
            data,
            user?.id || null
          );
          notify.success(`${count} stades importés/synchronisés.`);
          queryClient.invalidateQueries({ queryKey: ["stadiums"] });
        } catch (e: any) {
          notify.error(`Erreur import stades: ${e?.message || e}`);
        }
      }}
      onImportMatches={async (data) => {
        try {
          const count = await saveImportedMatches(
            supabase,
            data,
            user?.id || null
          );
          notify.success(`${count} matchs importés/synchronisés.`);
          queryClient.invalidateQueries({ queryKey: ["matches"] });
        } catch (e: any) {
          notify.error(`Erreur import matchs: ${e?.message || e}`);
        }
      }}
      onImportAssignments={async (data) => {
        try {
          await applyAssignmentsFromData(supabase, data, {
            matches,
            userId: user?.id || null,
          });
          notify.success("Désignations importées.");
          queryClient.invalidateQueries({ queryKey: ["matches"] });
        } catch (e: any) {
          notify.error(`Erreur import désignations: ${e?.message || e}`);
        }
      }}
      onImportOptimizedAssignments={async (data) => {
        try {
          await applyOptimizedAssignmentsFromData(supabase, data, {
            matches,
            userId: user?.id || null,
          });
          notify.success("Désignations (optimisées) importées.");
          queryClient.invalidateQueries({ queryKey: ["matches"] });
        } catch (e: any) {
          notify.error(`Erreur import optimisation: ${e?.message || e}`);
        }
      }}
      onLaunchOptimization={async (scope) => {
        try {
          const scopeSet = new Set(scope.leagueGroupIds);
          const daysSet = new Set(scope.gameDays);
          const matchesInScope = matches.filter(
            (m) => scopeSet.has(m.leagueGroup.id) && daysSet.has(m.gameDay)
          );
          if (matchesInScope.length === 0) {
            notify.error("Aucun match dans le périmètre.");
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
            stadiums: generateStadiumsCsv(stadiums, settings?.locations || []),
            availability: generateAvailabilityCsv(officials, matchesInScope),
            forbidden: generateForbiddenCsv(),
          };
          await downloadOptimizationDataAsZip(csvs);
          notify.success("Données d'optimisation exportées.");
        } catch (e: any) {
          notify.error(`Erreur export optimisation: ${e.message}`);
        }
      }}
      currentUser={user!}
      permissions={permissions}
      isDirty={settingsDirty}
      setIsDirty={setSettingsDirty}
    />
  );
};

export default SettingsContainer;
