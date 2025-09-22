import React, { useMemo } from "react";
import VirementsView from "../VirementsView";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationContext } from "../../contexts/NotificationContext";
import { makeNotifier } from "../../utils/notify";
import { supabase } from "../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { usePayments } from "../../hooks/usePayments";
import { useOfficials } from "../../hooks/useOfficials";
import { useUsers } from "../../hooks/useUsers";
import { useAccountingPeriods } from "../../hooks/useAccountingPeriods";
import { logAndThrow } from "../../utils/logging";
import {
  createPaymentBatch,
  cancelPaymentBatch,
  updateProofOfPayment,
} from "../../services/paymentService";

const VirementsContainer: React.FC = () => {
  const { user, permissions } = useAuth();
  const { showNotification } = useNotificationContext();
  const notify = makeNotifier(showNotification);
  const queryClient = useQueryClient();

  const { data: paymentsData } = usePayments({
    pagination: { page: 1, pageSize: 5000 },
  });
  const { data: officialsData } = useOfficials({
    pagination: { page: 1, pageSize: 2000 },
  });
  const { data: users } = useUsers();
  const { data: accountingPeriods } = useAccountingPeriods();

  const payments = useMemo(() => paymentsData?.data || [], [paymentsData]);
  const officials = useMemo(() => officialsData?.data || [], [officialsData]);

  const onCreatePaymentBatch = async (
    paymentIds: string[],
    batchDetails: {
      batchReference: string;
      batchDate: string;
      debitAccountNumber: string;
    },
    ediFile?: { content: string; name: string }
  ) => {
    try {
      notify.info("Enregistrement en cours…");
      await createPaymentBatch(supabase, {
        paymentIds,
        batchReference: batchDetails.batchReference,
        batchDate: batchDetails.batchDate,
        debitAccountNumber: batchDetails.debitAccountNumber,
        userId: user?.id || null,
        payments,
      });
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

      notify.success("Lot de virement créé et clôturé.");
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onCancelPaymentBatch = async (batchId: string) => {
    try {
      notify.info("Enregistrement en cours…");
      await cancelPaymentBatch(supabase, batchId, user?.id || null);
      notify.success("Lot de virement annulé.");
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  const onSaveProofOfPayment = async (
    batchId: string,
    proof: { transactionId?: string; file?: File }
  ) => {
    try {
      notify.info("Enregistrement en cours…");
      await updateProofOfPayment(supabase, "payment_proofs", batchId, proof);
      notify.success("Preuve sauvegardée.");
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
    } catch (e: any) {
      notify.error(`Erreur: ${e.message}`);
    }
  };

  return (
    <VirementsView
      payments={payments}
      officials={officials}
      permissions={permissions}
      onCreatePaymentBatch={onCreatePaymentBatch}
      accountingPeriods={accountingPeriods || []}
      onCancelPaymentBatch={onCancelPaymentBatch}
      onSaveProofOfPayment={onSaveProofOfPayment}
      users={users || []}
      showNotification={showNotification}
    />
  );
};

export default VirementsContainer;
