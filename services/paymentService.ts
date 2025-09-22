import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function createPaymentBatch(
    supabase: SupabaseClient,
    params: {
        paymentIds: string[];
        batchReference: string;
        batchDate: string;
        debitAccountNumber: string;
        userId: string | null;
        payments: Array<{ id: string; total?: number }>; // lightweight view for total calc
    }
) {
    const { paymentIds, batchReference, batchDate, debitAccountNumber, userId, payments } = params;
    const { data: period, error: perr } = await supabase
        .from("accounting_periods")
        .insert({
            type: "payment_batch",
            period_date: batchDate,
            status: "closed",
            closed_by: userId,
            closed_at: new Date().toISOString(),
        })
        .select()
        .single();
    if (perr) return logAndThrow("create payment batch period", perr, { batchDate });

    const total = payments
        .filter((p) => paymentIds.includes(p.id))
        .reduce((s, p) => s + (p.total || 0), 0);

    const { error: berr } = await supabase.from("payment_batches").insert({
        id: period.id,
        reference: batchReference,
        total_amount: total,
        payment_count: paymentIds.length,
        debit_account_number: debitAccountNumber,
    });
    if (berr) return logAndThrow("insert payment_batches", berr, { periodId: period.id });

    const { data: assn, error: aerr } = await supabase
        .from("match_assignments")
        .select("match_id")
        .in("id", paymentIds);
    if (aerr) return logAndThrow("select assignments for batch matches", aerr, { count: paymentIds.length });

    const matchIds = Array.from(new Set((assn || []).map((a: any) => a.match_id)));
    if (matchIds.length > 0) {
        const { error: merr } = await supabase
            .from("matches")
            .update({ accounting_status: "closed", accounting_period_id: period.id, updated_by: userId })
            .in("id", matchIds);
        if (merr) return logAndThrow("close matches for payment batch", merr, { periodId: period.id, count: matchIds.length });
    }

    return { periodId: period.id };
}

export async function cancelPaymentBatch(
    supabase: SupabaseClient,
    batchId: string,
    userId: string | null
) {
    const { data: matchesToRevert, error: ferr } = await supabase
        .from("matches")
        .select("id")
        .eq("accounting_period_id", batchId);
    if (ferr) return logAndThrow("fetch matches for batch cancel", ferr, { batchId });
    const ids = (matchesToRevert || []).map((m: any) => m.id);
    if (ids.length > 0) {
        const { error: uerr } = await supabase
            .from("matches")
            .update({ accounting_status: "validated", accounting_period_id: null, updated_by: userId })
            .in("id", ids);
        if (uerr) return logAndThrow("revert matches on batch cancel", uerr, { count: ids.length });
    }
    const { error: perr2 } = await supabase
        .from("accounting_periods")
        .update({ status: "open", reopened_by: userId, reopened_at: new Date().toISOString() })
        .eq("id", batchId);
    if (perr2) return logAndThrow("reopen accounting period (batch cancel)", perr2, { batchId });
}

export async function updateProofOfPayment(
    supabase: SupabaseClient,
    bucket: string,
    batchId: string,
    proof: { transactionId?: string; file?: File }
) {
    const update: any = { transaction_id: proof.transactionId };
    if (proof.file) {
        const filePath = `proofs/${batchId}/${proof.file.name}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, proof.file, { upsert: true });
        if (upErr) return logAndThrow("upload proof_of_payment", upErr, { batchId, filePath });
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
        update.proof_of_payment_url = pub.publicUrl;
        update.proof_of_payment_filename = proof.file.name;
    }
    const { error } = await supabase.from("payment_batches").update(update).eq("id", batchId);
    if (error) return logAndThrow("update payment_batches", error, { batchId });
}

export async function updatePaymentNotes(
    supabase: SupabaseClient,
    {
        assignmentId,
        notes,
        userId,
    }: { assignmentId: string; notes: string | null; userId: string | null }
) {
    const { error } = await supabase
        .from("match_assignments")
        .update({ notes, updated_by: userId })
        .eq("id", assignmentId);
    if (error) return logAndThrow("update payment notes", error, { assignmentId });
}

export async function bulkUpdatePaymentNotes(
    supabase: SupabaseClient,
    { updates, userId }: { updates: { id: string; notes: string | null }[]; userId: string | null }
) {
    const rows = updates.map((u) => ({ id: u.id, notes: u.notes, updated_by: userId }));
    const { error } = await supabase.from("match_assignments").upsert(rows);
    if (error) return logAndThrow("bulk update payment notes", error, { count: rows.length });
}
