import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function createActiveSettingsVersion(
    supabase: SupabaseClient,
    newSettings: any,
    userId: string | null
): Promise<void> {
    const { error: deactivateError } = await supabase
        .from("app_settings_versions")
        .update({ is_active: false })
        .eq("is_active", true);
    if (deactivateError)
        return logAndThrow("deactivate app_settings_versions", deactivateError);

    const payload = { ...newSettings, is_active: true, created_by: userId };
    const { error: insertError } = await supabase
        .from("app_settings_versions")
        .insert(payload);
    if (insertError)
        return logAndThrow("insert app_settings_version", insertError, payload);
}

export async function upsertLeague(
    supabase: SupabaseClient,
    league: any,
    userId: string | null
): Promise<void> {
    const payload: any = {
        name: league.name,
        parent_league_id: league.parent_league_id ?? null,
        level: league.level ?? 1,
    };
    if (league.id) {
        const { error } = await supabase
            .from("leagues")
            .update({ ...payload, updated_by: userId })
            .eq("id", league.id);
        if (error) return logAndThrow("update league", error, { id: league.id, payload });
    } else {
        const { error } = await supabase.from("leagues").insert({
            ...payload,
            created_by: userId,
            updated_by: userId,
        });
        if (error) return logAndThrow("insert league", error, { payload });
    }
}

export async function upsertLeagueGroup(
    supabase: SupabaseClient,
    group: any,
    userId: string | null
): Promise<void> {
    const payload: any = {
        name: group.name,
        league_id: group.league_id,
        season: group.season,
    };
    if (group.id) {
        const { error } = await supabase
            .from("league_groups")
            .update({ ...payload, updated_by: userId })
            .eq("id", group.id);
        if (error) return logAndThrow("update league_group", error, { id: group.id, payload });
    } else {
        const { error } = await supabase.from("league_groups").insert({
            ...payload,
            created_by: userId,
            updated_by: userId,
        });
        if (error) return logAndThrow("insert league_group", error, payload);
    }
}

export async function saveLeagueGroupTeams(
    supabase: SupabaseClient,
    groupId: string,
    nextTeamIds: string[]
): Promise<void> {
    const { data: curRows, error: curErr } = await supabase
        .from("league_group_teams")
        .select("team_id")
        .eq("league_group_id", groupId);
    if (curErr) return logAndThrow("select league_group_teams", curErr, { groupId });
    const currentTeamIds = (curRows || []).map((r: any) => r.team_id);
    const toAdd = nextTeamIds.filter((id) => !currentTeamIds.includes(id));
    const toRemove = currentTeamIds.filter((id) => !nextTeamIds.includes(id));

    if (toAdd.length > 0) {
        const rows = toAdd.map((teamId) => ({ league_group_id: groupId, team_id: teamId }));
        const { error: insErr } = await supabase.from("league_group_teams").insert(rows);
        if (insErr) return logAndThrow("insert league_group_teams", insErr, { groupId, count: rows.length });
    }
    if (toRemove.length > 0) {
        const { error: delErr } = await supabase
            .from("league_group_teams")
            .delete()
            .eq("league_group_id", groupId)
            .in("team_id", toRemove);
        if (delErr) return logAndThrow("delete league_group_teams diff", delErr, { groupId, count: toRemove.length });
    }
}

export async function deleteLeagueWithGuard(
    supabase: SupabaseClient,
    leagueId: string
): Promise<void> {
    const { data: grp, error: gErr } = await supabase
        .from("league_groups")
        .select("id")
        .eq("league_id", leagueId)
        .limit(1);
    if (gErr) return logAndThrow("select league_groups by league", gErr, { leagueId });
    if (Array.isArray(grp) && grp.length > 0) {
        const err: any = new Error("LeagueHasGroups");
        err.code = "LeagueHasGroups";
        throw err;
    }
    const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
    if (error) return logAndThrow("delete league", error, { leagueId });
}

export async function deleteLeagueGroupWithGuard(
    supabase: SupabaseClient,
    groupId: string
): Promise<void> {
    const { data: m, error: mErr } = await supabase
        .from("matches")
        .select("id")
        .eq("league_group_id", groupId)
        .limit(1);
    if (mErr) return logAndThrow("select matches by group", mErr, { groupId });
    if (Array.isArray(m) && m.length > 0) {
        const err: any = new Error("GroupHasMatches");
        err.code = "GroupHasMatches";
        throw err;
    }
    const { error: delLinksErr } = await supabase
        .from("league_group_teams")
        .delete()
        .eq("league_group_id", groupId);
    if (delLinksErr) return logAndThrow("clear league_group_teams", delLinksErr, { groupId });
    const { error } = await supabase.from("league_groups").delete().eq("id", groupId);
    if (error) return logAndThrow("delete league_group", error, { groupId });
}

export async function updateUserRole(
    supabase: SupabaseClient,
    userId: string,
    roleName: string,
    actingUserId: string | null
): Promise<string> {
    const { data: role, error: roleErr } = await supabase
        .from("roles")
        .select("id")
        .eq("name", roleName)
        .single();
    if (roleErr || !role) throw roleErr || new Error("Rôle introuvable");
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) throw delErr;
    const { error: insErr } = await supabase.from("user_roles").insert({
        user_id: userId,
        role_id: (role as any).id,
        assigned_by: actingUserId,
    });
    if (insErr) throw insErr;
    return (role as any).id;
}
