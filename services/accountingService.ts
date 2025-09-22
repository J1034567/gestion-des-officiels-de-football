import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function submitAccounting(
    supabase: SupabaseClient,
    {
        matchId,
        scores,
        updatedAssignments,
        userId,
    }: {
        matchId: string;
        scores: { home: number; away: number } | null;
        updatedAssignments: Array<{
            id: string;
            role: string;
            officialId: string | null;
            travelDistanceInKm?: number | null;
            indemnityAmount?: number | null;
            notes?: string | null;
        }>;
        userId: string | null;
    }
) {
    const matchUpdate: any = {
        accounting_status: "pending_validation",
        rejection_reason: null,
        rejection_comment: null,
        updated_by: userId,
    };
    if (scores) {
        matchUpdate.home_score = scores.home;
        matchUpdate.away_score = scores.away;
        matchUpdate.status = "completed";
    }
    const { error: mErr } = await supabase
        .from("matches")
        .update(matchUpdate)
        .eq("id", matchId);
    if (mErr)
        return logAndThrow("accounting submit: update match", mErr, {
            matchId,
            matchUpdate,
        });

    if (updatedAssignments?.length) {
        const rows = updatedAssignments.map((a) => ({
            id: a.id,
            match_id: matchId,
            role: a.role,
            official_id: a.officialId,
            travel_distance_km: a.travelDistanceInKm ?? 0,
            indemnity_amount: a.indemnityAmount ?? 0,
            notes: a.notes ?? null,
            updated_by: userId,
        }));
        const { error: aErr } = await supabase.from("match_assignments").upsert(rows);
        if (aErr)
            return logAndThrow("accounting submit: upsert assignments", aErr, {
                count: rows.length,
                matchId,
            });
    }
}

export async function validateAccounting(
    supabase: SupabaseClient,
    { matchId, userId }: { matchId: string; userId: string | null }
) {
    const { error } = await supabase
        .from("matches")
        .update({
            accounting_status: "validated",
            validated_by: userId,
            validated_at: new Date().toISOString(),
            updated_by: userId,
        })
        .eq("id", matchId);
    if (error) return logAndThrow("accounting validate", error, { matchId });
}

export async function rejectAccounting(
    supabase: SupabaseClient,
    {
        matchId,
        reason,
        comment,
        userId,
    }: { matchId: string; reason: string; comment: string; userId: string | null }
) {
    const { error } = await supabase
        .from("matches")
        .update({
            accounting_status: "rejected",
            rejection_reason: reason,
            rejection_comment: comment,
            validated_by: null,
            validated_at: null,
            updated_by: userId,
        })
        .eq("id", matchId);
    if (error) return logAndThrow("accounting reject", error, { matchId });
}

export async function reopenDailyPeriod(
    supabase: SupabaseClient,
    { periodId }: { periodId: string }
) {
    const { error } = await supabase.functions.invoke("reopen-accounting-period", {
        body: { type: "daily", periodId },
    });
    if (error)
        return logAndThrow("invoke reopen-accounting-period (daily)", error, {
            periodId,
        });
}

export async function closeMonthlyPeriod(
    supabase: SupabaseClient,
    { month }: { month: string }
) {
    const { error } = await supabase.functions.invoke("close-accounting-period", {
        body: { type: "monthly", periodIdentifier: { month } },
    });
    if (error)
        return logAndThrow("invoke close-accounting-period (monthly)", error, {
            month,
        });
}

export async function reopenMonthlyPeriod(
    supabase: SupabaseClient,
    { periodId }: { periodId: string }
) {
    const { error } = await supabase.functions.invoke("reopen-accounting-period", {
        body: { type: "monthly", periodId },
    });
    if (error)
        return logAndThrow("invoke reopen-accounting-period (monthly)", error, {
            periodId,
        });
}
