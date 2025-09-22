import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { supabase } from "../../lib/supabaseClient";
import { useTeams } from "../../hooks/useTeams";
import { useStadiums, useUpdateStadium } from "../../hooks/useStadiums";
import { useLeagues } from "../../hooks/useLeagues";
import { useLeagueGroups } from "../../hooks/useLeagueGroups";
import { useTeamStadiums } from "../../hooks/useTeamStadiums";
import { useAppSettings } from "../../hooks/useAppSettings";
import ClubsView from "../ClubsView";
import { Team, Stadium } from "../../types";
import {
  upsertTeam,
  archiveTeamWithGuard,
  setTeamHomeStadium,
} from "../../services/clubService";
import {
  upsertStadium,
  archiveStadiumWithGuard,
} from "../../services/stadiumService";

const ClubsContainer: React.FC = () => {
  const { user, permissions } = useAuth();
  const { data: teamsData } = useTeams({
    pagination: { page: 1, pageSize: 5000 },
    filters: { includeArchived: true },
  });
  const { data: stadiumsData } = useStadiums({
    pagination: { page: 1, pageSize: 5000 },
    filters: { includeArchived: true },
  });
  const { data: leagues } = useLeagues();
  const { data: leagueGroups } = useLeagueGroups();
  const { data: teamStadiums } = useTeamStadiums({});
  const { data: appSettings } = useAppSettings();

  const teams = teamsData?.data || [];
  const stadiums = stadiumsData?.data || [];
  const localisations = appSettings?.locations || [];

  const queryClient = useQueryClient();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);

  const onSaveTeam = async (team: Team) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertTeam(supabase, team, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      notify.success(`Équipe "${team.name}" sauvegardée.`);
    } catch (e: any) {
      if (e?.message === "TeamInUse") {
        notify.error(
          "Impossible d'archiver: l'équipe est utilisée dans des matchs actifs."
        );
      } else {
        notify.error(`Erreur sauvegarde équipe: ${e?.message || e}`);
      }
    }
  };

  const onArchiveTeam = async (teamId: string) => {
    try {
      await archiveTeamWithGuard(supabase, teamId, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      const teamName = teams.find((t) => t.id === teamId)?.name || "Équipe";
      notify.success(`"${teamName}" archivée.`);
    } catch (e: any) {
      if (e?.message === "TeamInUse") {
        notify.error(
          "Impossible d'archiver: l'équipe est utilisée dans des matchs actifs."
        );
      } else {
        notify.error(`Erreur archivage équipe: ${e?.message || e}`);
      }
    }
  };

  const onSaveStadium = async (stadium: Stadium) => {
    try {
      notify.info("Enregistrement en cours…");
      await upsertStadium(supabase, stadium, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      notify.success(`Stade "${stadium.name}" sauvegardé.`);
    } catch (e: any) {
      notify.error(`Erreur sauvegarde stade: ${e?.message || e}`);
    }
  };

  const onArchiveStadium = async (stadiumId: string) => {
    try {
      await archiveStadiumWithGuard(supabase, stadiumId, user?.id || null);
      await queryClient.invalidateQueries({ queryKey: ["stadiums"] });
      const stadiumName =
        stadiums.find((s) => s.id === stadiumId)?.name || "Stade";
      notify.success(`"${stadiumName}" archivé.`);
    } catch (e: any) {
      if (e?.message === "StadiumInUse") {
        notify.error(
          "Impossible d'archiver: le stade est utilisé dans des matchs actifs."
        );
      } else {
        notify.error(`Erreur archivage stade: ${e?.message || e}`);
      }
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
      await setTeamHomeStadium(supabase, {
        teamId,
        stadiumId,
        season,
        userId: user?.id || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["teamStadiums"] });
      const teamName = teams.find((t) => t.id === teamId)?.name || "Équipe";
      const stadiumName = stadiumId
        ? stadiums.find((s) => s.id === stadiumId)?.name || "Stade"
        : null;
      notify.success(
        stadiumName
          ? `Stade à domicile de "${teamName}" défini sur "${stadiumName}".`
          : `Stade à domicile de "${teamName}" effacé.`
      );
    } catch (e: any) {
      notify.error(`Erreur mise à jour stade domicile: ${e?.message || e}`);
    }
  };

  return (
    <ClubsView
      teams={teams}
      stadiums={stadiums}
      leagues={leagues || []}
      leagueGroups={leagueGroups || []}
      teamStadiums={teamStadiums || []}
      onSaveTeam={onSaveTeam}
      onSaveStadium={onSaveStadium}
      onSetTeamHomeStadium={onSetTeamHomeStadium}
      onArchiveTeam={onArchiveTeam}
      onArchiveStadium={onArchiveStadium}
      currentUser={user!}
      permissions={permissions}
      localisations={localisations}
      currentSeason={""}
    />
  );
};

export default ClubsContainer;
