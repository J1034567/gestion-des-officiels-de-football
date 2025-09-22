import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function savePlayer(
    supabase: SupabaseClient,
    payload: any,
    userId: string | null
) {
    const { id, createdByName, updatedByName, fullName, ...rest } = payload || {};
    const { error } = await supabase.from("players").upsert({
        ...rest,
        id,
        updated_by: userId,
        ...(id ? {} : { created_by: userId }),
    });
    if (error) return logAndThrow("savePlayer", error, { id });
}

export async function archivePlayer(
    supabase: SupabaseClient,
    playerId: string,
    userId: string | null
) {
    const { error } = await supabase
        .from("players")
        .update({ is_archived: true, updated_by: userId })
        .eq("id", playerId);
    if (error) return logAndThrow("archivePlayer", error, { playerId });
}

export async function saveSanction(
    supabase: SupabaseClient,
    payload: any,
    userId: string | null
) {
    const { id, createdByName, ...rest } = payload || {};
    const { error } = await supabase.from("sanctions").upsert({
        ...rest,
        id,
        updated_by: userId,
        ...(id ? {} : { created_by: userId }),
    });
    if (error) return logAndThrow("saveSanction", error, { id });
}

export async function cancelSanction(
    supabase: SupabaseClient,
    sanctionId: string,
    userId: string | null
) {
    const { error } = await supabase
        .from("sanctions")
        .update({ is_cancelled: true, updated_by: userId })
        .eq("id", sanctionId);
    if (error) return logAndThrow("cancelSanction", error, { sanctionId });
}
