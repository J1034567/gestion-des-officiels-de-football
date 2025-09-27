import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { supabase } from "../../lib/supabaseClient";
import { useOfficials } from "../../hooks/useOfficials";
import { useMatches } from "../../hooks/useMatches";
import { useAppSettings } from "../../hooks/useAppSettings";
import { jobService } from "../../services/jobService";
import { JobKinds } from "../../supabase/functions/_shared/jobKinds";
import OfficialsView from "../OfficialsView";
import { Official, Location } from "../../types";
import {
  updateUnavailabilitiesForOfficial,
  upsertOfficial as upsertOfficialService,
  archiveOfficialWithGuard,
  bulkUpdateOfficialLocations as bulkUpdateOfficialLocationsService,
  bulkUpdateOfficialCategory as bulkUpdateOfficialCategoryService,
  bulkArchiveOfficials as bulkArchiveOfficialsService,
} from "../../services/officialService";

const OfficialsContainer: React.FC = () => {
  const { user, permissions } = useAuth();
  const { data: officialsData } = useOfficials({
    pagination: { page: 1, pageSize: 5000 },
    filters: { includeArchived: true },
  });
  const { data: matchesData } = useMatches({
    pagination: { page: 1, pageSize: 5000 },
  });
  const { data: appSettings } = useAppSettings();

  const officials = officialsData?.data || [];
  const matches = matchesData?.data || [];
  const officialCategories: string[] = appSettings?.official_categories || [];
  const localisations: Location[] = appSettings?.locations || [];

  const queryClient = useQueryClient();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);

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
    if (!officialIds || officialIds.length === 0) {
      notify.error("Aucun destinataire sélectionné.");
      return;
    }
    try {
      notify.info("Enfilement du job d'envoi…");
      await jobService.enqueueJob({
        type: JobKinds.MessagingBulkEmail,
        label: `Message groupé (${officialIds.length})`,
        payload: { officialIds, subject, message },
        total: officialIds.length,
      });
      notify.success("Job d'envoi créé. Suivi dans le centre des jobs.");
    } catch (e: any) {
      notify.error(`Erreur: ${e?.message || e}`);
    }
  };

  const logAction = async (
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
      // Non bloquant
      console.warn("audit logAction failed", e);
    }
  };

  return (
    <OfficialsView
      officials={officials}
      matches={matches}
      officialCategories={officialCategories}
      localisations={localisations}
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
  );
};

export default OfficialsContainer;
