import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function upsertStadium(
    supabase: SupabaseClient,
    stadium: any,
    userId: string | null
): Promise<void> {
    const payload: any = {
        name: stadium.name,
        name_ar: stadium.nameAr ?? null,
        location_id: stadium.locationId ?? null,
    };
    if (stadium.id) {
        const { error } = await supabase
            .from("stadiums")
            .update({ ...payload, updated_by: userId })
            .eq("id", stadium.id);
        if (error) return logAndThrow("upsertStadium:update", error, { stadiumId: stadium.id, payload });
    } else {
        const { error } = await supabase.from("stadiums").insert({
            ...payload,
            created_by: userId,
            updated_by: userId,
        });
        if (error) return logAndThrow("upsertStadium:insert", error, { payload });
    }
}

export async function archiveStadiumWithGuard(
    supabase: SupabaseClient,
    stadiumId: string,
    userId: string | null
): Promise<void> {
    const { data: usage, error: usageErr } = await supabase
        .from("matches")
        .select("id")
        .eq("stadium_id", stadiumId)
        .eq("is_archived", false)
        .limit(1);
    if (usageErr) return logAndThrow("archiveStadiumWithGuard:usage", usageErr, { stadiumId });
    if (Array.isArray(usage) && usage.length > 0) {
        throw new Error("StadiumInUse");
    }
    const { error } = await supabase
        .from("stadiums")
        .update({ is_archived: true, updated_by: userId })
        .eq("id", stadiumId);
    if (error) return logAndThrow("archiveStadiumWithGuard:update", error, { stadiumId });
}
