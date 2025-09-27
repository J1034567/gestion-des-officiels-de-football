import React, { useMemo } from "react";
import AccountingView from "../AccountingView";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { supabase } from "../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { useMatches } from "../../hooks/useMatches";
import { useOfficials } from "../../hooks/useOfficials";
import { useAccountingPeriods } from "../../hooks/useAccountingPeriods";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useLeagues } from "../../hooks/useLeagues";
import { useLeagueGroups } from "../../hooks/useLeagueGroups";
import { logAndThrow } from "../../utils/logging";
import {
  submitAccounting,
  validateAccounting,
  rejectAccounting,
  reopenDailyPeriod,
  closeMonthlyPeriod,
  reopenMonthlyPeriod,
} from "../../services/accountingService";

const AccountingContainer: React.FC = () => {
  const { user, permissions } = useAuth();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier((m, t) => showNotification(m, t));
  const queryClient = useQueryClient();

  const { data: matchesData } = useMatches({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: officialsData } = useOfficials({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: accountingPeriods } = useAccountingPeriods();
  const { data: settings } = useAppSettings();
  const { data: leagues } = useLeagues();
  const { data: leagueGroups } = useLeagueGroups();

  const matches = useMemo(() => matchesData?.data || [], [matchesData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);

  const onSubmit = async (
    matchId: string,
    scores: { home: number; away: number } | null,
    updatedAssignments: any[]
  ) => {
    try {
      notify.info("Enregistrement en cours…");
      await submitAccounting(supabase, {
        matchId,
        scores,
        updatedAssignments,
        userId: user?.id || null,
      });
      notify.success("Données soumises pour validation.");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onValidate = async (matchId: string) => {
    try {
      notify.info("Enregistrement en cours…");
      await validateAccounting(supabase, { matchId, userId: user?.id || null });
      notify.success("Saisie validée.");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onReject = async (matchId: string, reason: string, comment: string) => {
    try {
      notify.info("Enregistrement en cours…");
      await rejectAccounting(supabase, {
        matchId,
        reason,
        comment,
        userId: user?.id || null,
      });
      notify.success("Saisie rejetée.");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onReopenGameDay = async (periodId: string) => {
    try {
      await reopenDailyPeriod(supabase, { periodId });
      notify.success("Journée réouverte.");
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onCloseMonth = async (month: string) => {
    try {
      await closeMonthlyPeriod(supabase, { month });
      notify.success("Mois clôturé.");
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onReopenMonth = async (periodId: string) => {
    try {
      await reopenMonthlyPeriod(supabase, { periodId });
      notify.success("Mois réouvert.");
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
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
    <AccountingView
      matches={matches}
      officials={officials}
      accountingPeriods={(accountingPeriods as any) || []}
      currentUser={user!}
      permissions={permissions}
      locations={settings?.locations || []}
      leagues={leagues || []}
      leagueGroups={
        (useMemo(
          () => (Array.isArray(leagueGroups) ? leagueGroups : []),
          [leagueGroups]
        ) as any) || []
      }
      indemnityRates={settings?.indemnity_rates || {}}
      financialSettings={settings?.financial_settings || null}
      rejectionReasons={settings?.rejection_reasons || []}
      officialRoles={settings?.roles || []}
      onSubmit={onSubmit}
      onValidate={onValidate}
      onReject={onReject}
      onReopenGameDay={onReopenGameDay}
      onCloseMonth={onCloseMonth}
      onReopenMonth={onReopenMonth}
    />
  );
};

export default AccountingContainer;
