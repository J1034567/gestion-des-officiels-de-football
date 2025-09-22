import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

function normalizeCode(name: string): string {
    return name
        .toUpperCase()
        .normalize("NFD")
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 10);
}

export async function upsertTeam(
    supabase: SupabaseClient,
    team: any,
    userId: string | null
): Promise<void> {
    const code = team.code && team.code.trim().length > 0 ? team.code : normalizeCode(team.name);
    const payload: any = {
        code,
        name: team.name,
        full_name: team.fullName ?? null,
        logo_url: team.logoUrl ?? null,
        founded_year: team.foundedYear ?? null,
        primary_color: team.primaryColor ?? null,
        secondary_color: team.secondaryColor ?? null,
    };

    if (team.id) {
        const { error } = await supabase
            .from("teams")
            .update({ ...payload, updated_by: userId })
            .eq("id", team.id);
        if (error) return logAndThrow("upsertTeam:update", error, { teamId: team.id, payload });
    } else {
        const { error } = await supabase.from("teams").insert({
            ...payload,
            created_by: userId,
            updated_by: userId,
        });
        if (error) return logAndThrow("upsertTeam:insert", error, { payload });
    }
}

export async function archiveTeamWithGuard(
    supabase: SupabaseClient,
    teamId: string,
    userId: string | null
): Promise<void> {
    const { data: usage, error: usageErr } = await supabase
        .from("matches")
        .select("id")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq("is_archived", false)
        .limit(1);
    if (usageErr) return logAndThrow("archiveTeamWithGuard:usage", usageErr, { teamId });
    if (Array.isArray(usage) && usage.length > 0) {
        throw new Error("TeamInUse");
    }
    const { error } = await supabase
        .from("teams")
        .update({ is_archived: true, updated_by: userId })
        .eq("id", teamId);
    if (error) return logAndThrow("archiveTeamWithGuard:update", error, { teamId });
}

export async function setTeamHomeStadium(
    supabase: SupabaseClient,
    params: { teamId: string; stadiumId: string | null; season: string; userId: string | null }
): Promise<void> {
    const { teamId, stadiumId, season, userId } = params;
    if (stadiumId) {
        const { error } = await supabase
            .from("team_stadiums")
            .upsert(
                {
                    team_id: teamId,
                    stadium_id: stadiumId,
                    season,
                    created_by: userId,
                    updated_by: userId,
                },
                { onConflict: "team_id,season" }
            );
        if (error) return logAndThrow("setTeamHomeStadium:upsert", error, { teamId, stadiumId, season });
    } else {
        const { error } = await supabase
            .from("team_stadiums")
            .delete()
            .eq("team_id", teamId)
            .eq("season", season);
        if (error) return logAndThrow("setTeamHomeStadium:delete", error, { teamId, season });
    }
}
