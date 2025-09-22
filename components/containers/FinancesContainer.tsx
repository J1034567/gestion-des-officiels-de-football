import React, { useMemo } from "react";
import FinancesView from "../FinancesView";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { supabase } from "../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { usePayments } from "../../hooks/usePayments";
import { useMatches } from "../../hooks/useMatches";
import { useOfficials } from "../../hooks/useOfficials";
import { useUsers } from "../../hooks/useUsers";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useLeagues } from "../../hooks/useLeagues";
import { useLeagueGroups } from "../../hooks/useLeagueGroups";
import { logAndThrow } from "../../utils/logging";
import {
  updatePaymentNotes as svcUpdatePaymentNotes,
  bulkUpdatePaymentNotes as svcBulkUpdatePaymentNotes,
} from "../../services/paymentService";

const FinancesContainer: React.FC = () => {
  const { user, permissions } = useAuth();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);
  const queryClient = useQueryClient();

  const { data: paymentsData } = usePayments({
    pagination: { page: 1, pageSize: 5000 },
  });
  const { data: matchesData } = useMatches({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: officialsData } = useOfficials({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: users } = useUsers();
  const { data: settings } = useAppSettings();
  const { data: leagues } = useLeagues();
  const { data: leagueGroups } = useLeagueGroups();

  const payments = useMemo(() => paymentsData?.data || [], [paymentsData]);
  const matches = useMemo(() => matchesData?.data || [], [matchesData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);

  const onUpdatePaymentNotes = async (
    assignmentId: string,
    notes: string | null
  ) => {
    try {
      notify.info("Enregistrement en cours…");
      await svcUpdatePaymentNotes(supabase, {
        assignmentId,
        notes,
        userId: user?.id || null,
      });
      notify.success("Note mise à jour.");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onBulkUpdatePaymentNotes = async (
    updates: { id: string; notes: string | null }[]
  ) => {
    try {
      notify.info("Enregistrement en cours…");
      await svcBulkUpdatePaymentNotes(supabase, {
        updates,
        userId: user?.id || null,
      });
      notify.success(`${updates.length} notes mises à jour.`);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  if (!settings || !leagues) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <FinancesView
      payments={payments}
      matches={matches}
      officials={officials}
      onUpdatePaymentNotes={onUpdatePaymentNotes}
      onBulkUpdatePaymentNotes={onBulkUpdatePaymentNotes}
      currentUser={user!}
      users={users || []}
      permissions={permissions}
      locations={settings?.locations || []}
      leagues={leagues || []}
      leagueGroups={leagueGroups || []}
      indemnityRates={settings?.indemnity_rates || {}}
    />
  );
};

export default FinancesContainer;
