import React, { useMemo } from "react";
import DisciplinaryView from "../DisciplinaryView";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayers } from "../../hooks/usePlayers";
import { useSanctions } from "../../hooks/useSanctions";
import { useTeams } from "../../hooks/useTeams";
import { useMatches } from "../../hooks/useMatches";
import { useAppSettings } from "../../hooks/useAppSettings";
import { supabase } from "../../lib/supabaseClient";
import {
  savePlayer as svcSavePlayer,
  archivePlayer as svcArchivePlayer,
  saveSanction as svcSaveSanction,
  cancelSanction as svcCancelSanction,
} from "../../services/disciplinaryService";

const DisciplinaryContainer: React.FC = () => {
  const { user, permissions } = useAuth();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);
  const queryClient = useQueryClient();

  const { data: playersData } = usePlayers();
  const { data: sanctions } = useSanctions();
  const { data: teamsData } = useTeams({
    pagination: { page: 1, pageSize: 2000 },
    filters: { includeArchived: true },
  });
  const { data: matchesData } = useMatches({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: settings } = useAppSettings();

  const players = useMemo(() => playersData?.data || [], [playersData]);
  const teams = useMemo(() => (teamsData as any)?.data || [], [teamsData]);
  const matches = useMemo(() => matchesData?.data || [], [matchesData]);

  const onSavePlayer = async (player: any) => {
    try {
      notify.info("Enregistrement en cours…");
      await svcSavePlayer(supabase, player, user?.id || null);
      notify.success("Joueur sauvegardé.");
      queryClient.invalidateQueries({ queryKey: ["players"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onArchivePlayer = async (playerId: string) => {
    try {
      notify.info("Enregistrement en cours…");
      await svcArchivePlayer(supabase, playerId, user?.id || null);
      notify.success("Joueur archivé.");
      queryClient.invalidateQueries({ queryKey: ["players"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onSaveSanction = async (sanction: any) => {
    try {
      notify.info("Enregistrement en cours…");
      await svcSaveSanction(supabase, sanction, user?.id || null);
      notify.success("Sanction sauvegardée.");
      queryClient.invalidateQueries({ queryKey: ["sanctions"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onCancelSanction = async (sanctionId: string) => {
    try {
      notify.info("Enregistrement en cours…");
      await svcCancelSanction(supabase, sanctionId, user?.id || null);
      notify.success("Sanction annulée.");
      queryClient.invalidateQueries({ queryKey: ["sanctions"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  return (
    <DisciplinaryView
      players={players}
      sanctions={sanctions || []}
      teams={teams}
      matches={matches}
      permissions={permissions}
      onSavePlayer={onSavePlayer}
      onArchivePlayer={onArchivePlayer}
      onSaveSanction={onSaveSanction}
      onCancelSanction={onCancelSanction}
      disciplinarySettings={settings?.disciplinary_settings || null}
    />
  );
};

export default DisciplinaryContainer;
