import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function markMatchAsChanged(
    supabase: SupabaseClient,
    matchId: string,
    userId: string | null
): Promise<void> {
    const { error } = await supabase
        .from("matches")
        .update({ has_unsent_changes: true, updated_by: userId })
        .eq("id", matchId);
    if (error)
        return logAndThrow("markMatchAsChanged", error, { matchId, userId });
}

export async function updateScoreAndComplete(
    supabase: SupabaseClient,
    params: { matchId: string; homeScore: number; awayScore: number }
) {
    const { matchId, homeScore, awayScore } = params;
    const { data, error } = await supabase
        .from("matches")
        .update({ home_score: homeScore, away_score: awayScore, status: "completed" })
        .eq("id", matchId)
        .select()
        .single();
    if (error)
        return logAndThrow("updateScoreAndComplete", error, {
            matchId,
            homeScore,
            awayScore,
        });
    return data;
}

export async function getMatchAccountingStatus(
    supabase: SupabaseClient,
    matchId: string
): Promise<string | null> {
    const { data, error } = await supabase
        .from("matches")
        .select("accounting_status")
        .eq("id", matchId)
        .single();
    if (error) return logAndThrow("getMatchAccountingStatus", error, { matchId });
    return (data as any)?.accounting_status ?? null;
}

export async function archiveMatchById(
    supabase: SupabaseClient,
    matchId: string,
    userId: string | null
): Promise<void> {
    const { error } = await supabase
        .from("matches")
        .update({ is_archived: true, updated_by: userId })
        .eq("id", matchId);
    if (error) return logAndThrow("archiveMatchById", error, { matchId });
}

export async function upsertMatch(
    supabase: SupabaseClient,
    matchData: any,
    userId: string | null
) {
    const { id, ...rest } = matchData;
    const upsertData: any = {
        season: rest.season,
        game_day: rest.gameDay,
        match_date: rest.matchDate ?? null,
        match_time: rest.matchTime ?? null,
        home_team_id: rest.homeTeam?.id,
        away_team_id: rest.awayTeam?.id,
        stadium_id: rest.stadium?.id ?? null,
        league_group_id: rest.leagueGroup?.id,
        has_unsent_changes: true,
    };
    if (id) {
        const { data, error } = await supabase
            .from("matches")
            .update({ ...upsertData, updated_by: userId })
            .eq("id", id)
            .select()
            .single();
        if (error) return logAndThrow("upsertMatch:update", error, { id, upsertData });
        try {
            await supabase.from("audit_logs").insert({
                action: "Mise à jour du match",
                table_name: "matches",
                record_id: id,
                new_values: upsertData,
                user_id: userId,
            });
        } catch (_) { }
        return data;
    } else {
        const { data, error } = await supabase
            .from("matches")
            .insert({
                ...upsertData,
                created_by: userId,
                updated_by: userId,
                status: "scheduled",
            })
            .select()
            .single();
        if (error) return logAndThrow("upsertMatch:insert", error, { upsertData });
        try {
            await supabase.from("audit_logs").insert({
                action: "Création de match",
                table_name: "matches",
                record_id: data?.id,
                new_values: upsertData,
                user_id: userId,
            });
        } catch (_) { }
        return data;
    }
}

export async function archiveMatchWithGuard(
    supabase: SupabaseClient,
    matchId: string,
    userId: string | null
) {
    const status = await getMatchAccountingStatus(supabase, matchId);
    if (status === "validated" || status === "closed") {
        const label = status === "validated" ? "Validé" : "Clôturé";
        const err: any = new Error(`Accounting ${label}`);
        err.code = "AccountingGuard";
        err.status = status;
        throw err;
    }
    await archiveMatchById(supabase, matchId, userId);
}
