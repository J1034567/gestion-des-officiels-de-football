import { SupabaseClient } from "@supabase/supabase-js";
import { logAndThrow } from "../utils/logging";

export async function saveImportedOfficials(
    supabase: SupabaseClient,
    data: any[],
    userId: string | null
): Promise<number> {
    const rows = data.map((o: any) => ({
        id: o.id,
        first_name: o.firstName,
        last_name: o.lastName,
        first_name_ar: o.firstNameAr ?? null,
        last_name_ar: o.lastNameAr ?? null,
        category: o.category,
        location_id: o.locationId ?? null,
        address: o.address ?? null,
        position: o.position ?? null,
        email: o.email ?? null,
        phone: o.phone ?? null,
        bank_account_number: o.bankAccountNumber ?? null,
        is_active: true,
        is_archived: false,
        created_by: userId,
        updated_by: userId,
    }));
    const { error } = await supabase.from("officials").upsert(rows);
    if (error) return logAndThrow("import officials upsert", error, { count: rows.length });
    return rows.length;
}

function normalizeCode(name: string): string {
    return name
        .toUpperCase()
        .normalize("NFD")
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 10);
}

export async function saveImportedTeams(
    supabase: SupabaseClient,
    data: any[],
    userId: string | null
): Promise<number> {
    const rows = data.map((t: any) => ({
        id: t.id,
        code: normalizeCode(t.name),
        name: t.name,
        full_name: t.fullName ?? null,
        logo_url: t.logoUrl ?? null,
        primary_color: t.primaryColor ?? null,
        secondary_color: t.secondaryColor ?? null,
        founded_year: t.foundedYear ?? null,
        created_by: userId,
        updated_by: userId,
    }));
    const { error } = await supabase.from("teams").upsert(rows);
    if (error) return logAndThrow("import teams upsert", error, { count: rows.length });
    return rows.length;
}

export async function saveImportedStadiums(
    supabase: SupabaseClient,
    data: any[],
    userId: string | null
): Promise<number> {
    const rows = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        location_id: s.locationId ?? null,
        created_by: userId,
        updated_by: userId,
    }));
    const { error } = await supabase.from("stadiums").upsert(rows);
    if (error) return logAndThrow("import stadiums upsert", error, { count: rows.length });
    return rows.length;
}

export async function saveImportedMatches(
    supabase: SupabaseClient,
    data: any[],
    userId: string | null
): Promise<number> {
    const rows = data.map((m: any) => ({
        id: m.id,
        season: m.season,
        game_day: m.gameDay,
        league_group_id: m.leagueGroup?.id,
        match_date: m.matchDate ?? null,
        match_time: m.matchTime ?? null,
        home_team_id: m.homeTeam?.id,
        away_team_id: m.awayTeam?.id,
        stadium_id: m.stadium?.id ?? null,
        status: "scheduled",
        has_unsent_changes: true,
        created_by: userId,
        updated_by: userId,
    }));
    const { error } = await supabase.from("matches").upsert(rows);
    if (error) return logAndThrow("import matches upsert", error, { count: rows.length });
    return rows.length;
}

export async function applyAssignmentsFromData(
    supabase: SupabaseClient,
    data: Array<{ matchId: string; role: string; officialId: string }>,
    context: { matches: any[]; userId: string | null }
): Promise<void> {
    const byMatch = new Map<string, typeof data>();
    data.forEach((it) => {
        const arr = byMatch.get(it.matchId) || [];
        arr.push(it);
        byMatch.set(it.matchId, arr);
    });
    for (const [matchId, arr] of byMatch.entries()) {
        const match = context.matches.find((m) => m.id === matchId);
        if (!match) continue;
        const existing = match.assignments;
        const updates: any[] = [];
        const inserts: any[] = [];
        for (const it of arr) {
            const slot = existing.find((a: any) => a.role === it.role && !a.officialId);
            if (slot) {
                updates.push({ id: slot.id, official_id: it.officialId, updated_by: context.userId });
            } else {
                inserts.push({
                    match_id: matchId,
                    role: it.role,
                    official_id: it.officialId,
                    created_by: context.userId,
                    updated_by: context.userId,
                });
            }
        }
        if (updates.length > 0) {
            const { error: uerr } = await supabase.from("match_assignments").upsert(updates);
            if (uerr) throw uerr;
        }
        if (inserts.length > 0) {
            const { error: ierr } = await supabase.from("match_assignments").insert(inserts);
            if (ierr) throw ierr;
        }
        const { error: matchUpdateErr } = await supabase
            .from("matches")
            .update({ has_unsent_changes: true, updated_by: context.userId })
            .eq("id", matchId);
        if (matchUpdateErr)
            return logAndThrow("set match unsent after import assignments", matchUpdateErr, { matchId });
    }
}

export async function applyOptimizedAssignmentsFromData(
    supabase: SupabaseClient,
    data: Array<{ match_id: string; official_id: string }>,
    context: { matches: any[]; userId: string | null }
): Promise<void> {
    const byMatch = new Map<string, Array<{ official_id: string }>>();
    data.forEach((it) => {
        const arr = byMatch.get(it.match_id) || [];
        arr.push({ official_id: it.official_id });
        byMatch.set(it.match_id, arr);
    });
    for (const [matchId, arr] of byMatch.entries()) {
        const match = context.matches.find((m) => m.id === matchId);
        if (!match) continue;
        const delegateSlots = match.assignments.filter((a: any) =>
            a.role.toLowerCase().includes("délégué")
        );
        let slotIdx = 0;
        const updates: any[] = [];
        const inserts: any[] = [];
        for (const it of arr) {
            let slot = delegateSlots.find((s: any) => !s.officialId && delegateSlots.indexOf(s) >= slotIdx);
            if (slot) {
                updates.push({ id: slot.id, official_id: it.official_id, updated_by: context.userId });
                slotIdx = delegateSlots.indexOf(slot) + 1;
            } else {
                inserts.push({
                    match_id: matchId,
                    role: delegateSlots[0]?.role || "Délégué",
                    official_id: it.official_id,
                    created_by: context.userId,
                    updated_by: context.userId,
                });
            }
        }
        if (updates.length > 0) {
            const { error: uerr } = await supabase.from("match_assignments").upsert(updates);
            if (uerr) throw uerr;
        }
        if (inserts.length > 0) {
            const { error: ierr } = await supabase.from("match_assignments").insert(inserts);
            if (ierr) throw ierr;
        }
        const { error: matchUpdateErr } = await supabase
            .from("matches")
            .update({ has_unsent_changes: true, updated_by: context.userId })
            .eq("id", matchId);
        if (matchUpdateErr)
            return logAndThrow("set match unsent after import optimized", matchUpdateErr, { matchId });
    }
}
import * as XLSX from 'xlsx';
import { Official, Match, OfficialRole, Team, Stadium, Assignment, Unavailability, MatchStatus, League, LeagueGroup, AccountingStatus, Location } from '../types';

// Define a structured result for import operations
export interface ImportResult<T> {
    data: T[];
    successCount: number;
    errorCount: number;
    errors: string[];
}

export interface ImportedAssignment {
    matchId: string;
    role: OfficialRole;
    officialId: string;
}

const readFileData = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(jsonData);
            } catch (error) {
                reject(new Error("Erreur lors de l'analyse du fichier Excel. Assurez-vous qu'il s'agit d'un format valide."));
            }
        };
        reader.onerror = (error) => reject(new Error("Erreur de lecture du fichier."));
        reader.readAsBinaryString(file);
    });
};

const readCsvData = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const text = e.target?.result as string;
                const workbook = XLSX.read(text, { type: 'string' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(jsonData);
            } catch (error) {
                reject(new Error("Erreur lors de l'analyse du fichier CSV."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};


export const importOfficials = async (file: File, officialCategories: string[], locations: Location[]): Promise<ImportResult<Partial<Official>>> => {
    const result: ImportResult<Partial<Official>> = { data: [], successCount: 0, errorCount: 0, errors: [] };
    const locationMap = new Map(locations.map(l => [[l.wilaya, l.daira, l.commune].filter(Boolean).join(' / ').toLowerCase(), l.id]));

    try {
        const rows = await readFileData(file);
        const headers = (rows[0] as string[]).map(h => h.trim());

        // Validate headers
        const requiredHeaders = ['name', 'category'];
        for (const rh of requiredHeaders) if (!headers.includes(rh)) result.errors.push(`En-tête manquant: ${rh}`);
        if (result.errors.length > 0) { result.errorCount = 1; return result; }

        const h = (name: string) => headers.indexOf(name);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[h('name')]) continue;
            const fullName = String(row[h('name')]).trim();
            const [firstName, ...lastNameParts] = fullName.split(' ');
            const lastName = lastNameParts.join(' ');
            const category = String(row[h('category')]).trim();

            if (!officialCategories.includes(category)) {
                result.errors.push(`Ligne ${i + 1}: Catégorie "${category}" invalide.`);
                result.errorCount++;
                continue;
            }

            const locationString = String(row[h('location')] || '').trim().toLowerCase();
            const locationId = locationString ? locationMap.get(locationString) : null;
            if (locationString && !locationId) {
                result.errors.push(`Ligne ${i + 1}: Localisation "${row[h('location')]}" non trouvée.`);
                result.errorCount++;
                continue;
            }

            result.data.push({
                id: String(row[h('id')] || crypto.randomUUID()),
                firstName,
                lastName,
                fullName,
                category,
                locationId,
                address: String(row[h('address')] || ''),
                position: row[h('position')] ? Number(row[h('position')]) : null,
                email: String(row[h('email')] || ''),
                phone: String(row[h('phone')] || ''),
                bankAccountNumber: String(row[h('bankAccountNumber')] || ''),
            });
            result.successCount++;
        }
    } catch (e: any) { result.errorCount++; result.errors.push(e.message); }
    return result;
};

export const importTeams = async (file: File): Promise<ImportResult<Partial<Team>>> => {
    const result: ImportResult<Partial<Team>> = { data: [], successCount: 0, errorCount: 0, errors: [] };
    try {
        const rows = await readFileData(file);
        const headers = (rows[0] as string[]).map(h => h.trim());
        const h = (name: string) => headers.indexOf(name);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[h('name')]) continue;
            result.data.push({
                id: String(row[h('id')] || crypto.randomUUID()),
                name: String(row[h('name')]).trim(),
                fullName: String(row[h('fullName')] || '').trim(),
                logoUrl: String(row[h('logoUrl')] || '').trim(),
                primaryColor: String(row[h('primaryColor')] || '').trim(),
                secondaryColor: String(row[h('secondaryColor')] || '').trim(),
                foundedYear: row[h('foundedYear')] ? Number(row[h('foundedYear')]) : null,
            });
            result.successCount++;
        }
    } catch (e: any) { result.errorCount++; result.errors.push(e.message); }
    return result;
};

export const importStadiums = async (file: File, locations: Location[]): Promise<ImportResult<Partial<Stadium>>> => {
    const result: ImportResult<Partial<Stadium>> = { data: [], successCount: 0, errorCount: 0, errors: [] };
    const locationMap = new Map(locations.map(l => [[l.wilaya, l.daira, l.commune].filter(Boolean).join(' / ').toLowerCase(), l.id]));
    try {
        const rows = await readFileData(file);
        const headers = (rows[0] as string[]).map(h => h.trim());
        const h = (name: string) => headers.indexOf(name);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[h('name')]) continue;

            const locationString = String(row[h('location')] || '').trim().toLowerCase();
            const locationId = locationString ? locationMap.get(locationString) : null;
            if (locationString && !locationId) {
                result.errors.push(`Ligne ${i + 1}: Localisation "${row[h('location')]}" non trouvée.`);
                result.errorCount++;
                continue;
            }

            result.data.push({
                id: String(row[h('id')] || crypto.randomUUID()),
                name: String(row[h('name')]).trim(),
                locationId,
            });
            result.successCount++;
        }
    } catch (e: any) { result.errorCount++; result.errors.push(e.message); }
    return result;
};

export const importMatches = async (file: File, teams: Team[], stadiums: Stadium[], leagues: League[], leagueGroups: LeagueGroup[]): Promise<ImportResult<any>> => {
    const result: ImportResult<any> = { data: [], successCount: 0, errorCount: 0, errors: [] };
    const teamsMap = new Map(teams.map(t => [t.name.toLowerCase(), t.id]));
    const stadiumsMap = new Map(stadiums.map(s => [s.name.toLowerCase(), s.id]));
    const groupsMap = new Map(leagueGroups.map(g => [g.name.toLowerCase(), g.id]));

    try {
        const rows = await readFileData(file);
        const headers = (rows[0] as string[]).map(h => h.trim());
        const h = (name: string) => headers.indexOf(name);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const homeTeamId = teamsMap.get(String(row[h('homeTeamName')] || '').trim().toLowerCase());
            const awayTeamId = teamsMap.get(String(row[h('awayTeamName')] || '').trim().toLowerCase());
            const stadiumId = stadiumsMap.get(String(row[h('stadiumName')] || '').trim().toLowerCase());
            const groupId = groupsMap.get(String(row[h('groupName')] || '').trim().toLowerCase());

            // Validation
            if (!homeTeamId) { result.errors.push(`Ligne ${i + 1}: Équipe domicile "${row[h('homeTeamName')]}" non trouvée.`); result.errorCount++; continue; }
            if (!awayTeamId) { result.errors.push(`Ligne ${i + 1}: Équipe extérieure "${row[h('awayTeamName')]}" non trouvée.`); result.errorCount++; continue; }
            if (!stadiumId) { result.errors.push(`Ligne ${i + 1}: Stade "${row[h('stadiumName')]}" non trouvé.`); result.errorCount++; continue; }
            if (!groupId) { result.errors.push(`Ligne ${i + 1}: Groupe "${row[h('groupName')]}" non trouvé.`); result.errorCount++; continue; }

            result.data.push({
                id: String(row[h('id')] || crypto.randomUUID()),
                season: String(row[h('saison')]).trim(),
                gameDay: Number(row[h('journee')]),
                leagueGroup: { id: groupId },
                matchDate: String(row[h('date')]).trim(),
                matchTime: String(row[h('time')] || '').trim(),
                homeTeam: { id: homeTeamId },
                awayTeam: { id: awayTeamId },
                stadium: { id: stadiumId },
            });
            result.successCount++;
        }
    } catch (e: any) { result.errorCount++; result.errors.push(e.message); }
    return result;
}

export const importAssignments = async (file: File, matches: Match[], officials: Official[], officialRoles: OfficialRole[]): Promise<ImportResult<ImportedAssignment>> => {
    const result: ImportResult<ImportedAssignment> = { data: [], successCount: 0, errorCount: 0, errors: [] };
    try {
        const rows = await readFileData(file);
        const headers = (rows[0] as string[]).map(h => h.trim());
        const h = (name: string) => headers.indexOf(name);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const matchId = String(row[h('match_id')]).trim();
            const role = String(row[h('role')]).trim();
            const officialId = String(row[h('official_id')]).trim();

            if (!matchId || !role || !officialId) { result.errors.push(`Ligne ${i + 1}: Données manquantes.`); result.errorCount++; continue; }
            if (!matches.some(m => m.id === matchId)) { result.errors.push(`Ligne ${i + 1}: Match ID "${matchId}" non trouvé.`); result.errorCount++; continue; }
            if (!officials.some(o => o.id === officialId)) { result.errors.push(`Ligne ${i + 1}: Official ID "${officialId}" non trouvé.`); result.errorCount++; continue; }
            if (!officialRoles.includes(role)) { result.errors.push(`Ligne ${i + 1}: Rôle "${role}" non valide.`); result.errorCount++; continue; }

            result.data.push({ matchId, role, officialId });
            result.successCount++;
        }
    } catch (e: any) { result.errorCount++; result.errors.push(e.message); }
    return result;
}

export const importOptimizedDelegateAssignments = async (file: File, matches: Match[], officials: Official[]): Promise<ImportResult<any>> => {
    const result: ImportResult<any> = { data: [], successCount: 0, errorCount: 0, errors: [] };
    try {
        const rows = await readCsvData(file);
        const headers = (rows[0] as string[]).map(h => h.trim());
        const h = (name: string) => headers.indexOf(name);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || Number(row[h('assigned')]) !== 1) continue;

            const matchId = String(row[h('match_id')]).trim();
            const officialId = String(row[h('official_id')]).trim();

            if (!matches.some(m => m.id === matchId)) { result.errors.push(`Ligne ${i + 1}: Match ID "${matchId}" non trouvé.`); result.errorCount++; continue; }
            if (!officials.some(o => o.id === officialId)) { result.errors.push(`Ligne ${i + 1}: Official ID "${officialId}" non trouvé.`); result.errorCount++; continue; }

            result.data.push({ match_id: matchId, official_id: officialId });
            result.successCount++;
        }
    } catch (e: any) { result.errorCount++; result.errors.push(e.message); }
    return result;
}
