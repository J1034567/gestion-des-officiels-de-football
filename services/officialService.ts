import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function updateUnavailabilitiesForOfficial(
    supabase: SupabaseClient,
    officialId: string,
    newUnavs: Array<{
        id?: string;
        startDate: string;
        endDate: string;
        reason?: string | null;
        isApproved?: boolean | null;
    }>,
    userId: string | null
): Promise<void> {
    const { error: delErr } = await supabase
        .from("official_unavailabilities")
        .delete()
        .match({ official_id: officialId });
    if (delErr) return logAndThrow("officials:delete unavailabilities", delErr, { officialId });

    if (newUnavs.length > 0) {
        const rows = newUnavs.map((u) => ({
            official_id: officialId,
            start_date: u.startDate,
            end_date: u.endDate,
            reason: u.reason ?? null,
            is_approved: u.isApproved ?? false,
            created_by: userId,
        }));
        const { error: insErr } = await supabase
            .from("official_unavailabilities")
            .insert(rows);
        if (insErr)
            return logAndThrow("officials:insert unavailabilities", insErr, {
                officialId,
                count: rows.length,
            });
    }
}

export async function upsertOfficial(
    supabase: SupabaseClient,
    official: any,
    userId: string | null
): Promise<void> {
    const payload: any = {
        id: official.id,
        first_name: official.firstName,
        last_name: official.lastName,
        first_name_ar: official.firstNameAr ?? null,
        last_name_ar: official.lastNameAr ?? null,
        category: official.category,
        location_id: official.locationId ?? null,
        address: official.address ?? null,
        position: official.position ?? null,
        email: official.email ?? null,
        phone: official.phone ?? null,
        bank_account_number: official.bankAccountNumber ?? null,
        is_active: official.isActive,
        user_id: official.userId ?? null,
        updated_by: userId,
    };
    const isNew = !official.createdAt;
    if (isNew) payload.created_by = userId;
    const { error } = await supabase.from("officials").upsert(payload);
    if (error) return logAndThrow("upsertOfficial", error, { payload });
}

export async function archiveOfficialWithGuard(
    supabase: SupabaseClient,
    officialId: string,
    userId: string | null
): Promise<void> {
    const { data: usage, error: usageErr } = await supabase
        .from("matches")
        .select("id, match_assignments!inner(official_id)")
        .eq("match_assignments.official_id", officialId)
        .eq("is_archived", false)
        .limit(1);
    if (usageErr)
        return logAndThrow("archiveOfficialWithGuard:usage", usageErr, { officialId });
    if (Array.isArray(usage) && usage.length > 0) {
        throw new Error("OfficialInUse");
    }
    const { error } = await supabase
        .from("officials")
        .update({ is_archived: true, updated_by: userId })
        .eq("id", officialId);
    if (error) return logAndThrow("archiveOfficialWithGuard:update", error, { officialId });
}

export async function bulkUpdateOfficialLocations(
    supabase: SupabaseClient,
    officialIds: string[],
    newLocationId: string,
    userId: string | null
): Promise<void> {
    const updates = officialIds.map((id) => ({ id, location_id: newLocationId, updated_by: userId }));
    const { error } = await supabase.from("officials").upsert(updates);
    if (error) return logAndThrow("bulkUpdateOfficialLocations", error, { count: updates.length });
}

export async function bulkUpdateOfficialCategory(
    supabase: SupabaseClient,
    officialIds: string[],
    newCategory: string,
    userId: string | null
): Promise<void> {
    const updates = officialIds.map((id) => ({ id, category: newCategory, updated_by: userId }));
    const { error } = await supabase.from("officials").upsert(updates);
    if (error) return logAndThrow("bulkUpdateOfficialCategory", error, { count: updates.length });
}

export async function bulkArchiveOfficials(
    supabase: SupabaseClient,
    officialIds: string[],
    userId: string | null
): Promise<void> {
    const { error } = await supabase
        .from("officials")
        .update({ is_archived: true, updated_by: userId })
        .in("id", officialIds);
    if (error) return logAndThrow("bulkArchiveOfficials", error, { count: officialIds.length });
}
