// supabase/functions/worker-bulk-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// deno-lint-ignore no-explicit-any
declare const Deno: any;
import { createSupabaseAdminClient, createJsonResponse } from '../_shared/supabaseAdmin.ts';
import { generateMatchSheetHtml } from '../_shared/email-templates.ts';
// We need the PDF generation logic from the other worker
import { generateSingleMissionOrderPdf } from '../_shared/pdf-generation.ts';
import { PDFDocument } from 'pdf-lib';

function toBase64(arr: Uint8Array): string {
    let binStr = '';
    arr.forEach((byte) => {
        binStr += String.fromCharCode(byte);
    });
    return btoa(binStr);
}


serve(async (req: Request) => {
    const { job } = await req.json();
    const supabase = createSupabaseAdminClient();

    console.log(`[worker-bulk-email] Processing job ${job.id}`);

    const updateJobProgress = async (progress: number) => {
        await supabase.from('jobs').update({ progress }).eq('id', job.id);
    };

    const failJob = async (errorMessage: string) => {
        await supabase.from('jobs').update({ status: 'failed', error_message: errorMessage }).eq('id', job.id);
    };

    try {
        await supabase.from('jobs').update({ status: 'processing' }).eq('id', job.id);

        const matchIds: string[] = job.payload.matchIds;
        if (!matchIds || matchIds.length === 0) {
            await failJob('No match IDs provided in payload.');
            return createJsonResponse({ error: 'No match IDs' }, 400);
        }

        // --- Data Fetching (Optimized) ---
        const { data: matches, error: matchesError } = await supabase.from('matches').select(`
        *,
        homeTeam:teams!home_team_id(code, name, name_ar),
        awayTeam:teams!away_team_id(code, name, name_ar),
        stadium:stadiums(*),
        leagueGroup:league_groups!league_group_id(name_ar, league:leagues!league_id(name_ar)),
        assignments:match_assignments(*)
    `).in('id', matchIds);
        if (matchesError) throw matchesError;

        const allOfficialIds = [...new Set(matches.flatMap((m: any) => (m.assignments as any[]).map((a: any) => a.official_id)))].filter((id: any) => id);
        if (allOfficialIds.length === 0) {
            // Complete job early if no officials are assigned at all
            await supabase.from('jobs').update({ status: 'completed', progress: job.total }).eq('id', job.id);
            return createJsonResponse({ success: true, message: "No officials to email." });
        }

        const { data: officials, error: officialsError } = await supabase.from('officials').select('*').in('id', allOfficialIds);
        if (officialsError) throw officialsError;

        const officialsMap = new Map(officials.map((o: any) => [o.id, o]));

        // Adapt officials to template's expected camelCase structure
        const adaptedOfficials = officials.map((o: any) => ({
            id: o.id,
            firstName: o.first_name,
            lastName: o.last_name,
            firstNameAr: o.first_name_ar || o.first_name,
            lastNameAr: o.last_name_ar || o.last_name,
            fullName: o.full_name || `${o.first_name} ${o.last_name}`,
            category: o.category,
            phone: o.phone,
            email: o.email,
            locationId: o.location_id ?? null,
        }));

        // --- Locations (for email template formatting) ---
        const locationIds = [
            ...new Set(
                matches
                    .map((m: any) => m?.stadium?.location_id || m?.stadium?.locationId)
                    .filter((id: string | null | undefined): id is string => !!id)
            ),
        ];
        let locations: any[] = [];
        if (locationIds.length > 0) {
            const { data: locs, error: locErr } = await supabase
                .from('locations')
                .select('*')
                .in('id', locationIds);
            if (locErr) {
                console.warn('[worker-bulk-email] Failed to fetch locations', locErr);
            } else if (locs) {
                locations = locs;
            }
        }

        // --- Per-Match Processing Loop ---
        let completedCount = 0;
        for (const match of matches) {
            try {
                // Step 1: Identify recipients for THIS match
                const recipients = (match.assignments as any[])
                    .map((a: any) => officialsMap.get(a.official_id))
                    .filter((o: any): o is any => !!o && !!o.email);

                if (recipients.length === 0) {
                    console.log(`Skipping match ${match.id}: no recipients with valid emails.`);
                    continue; // Skip to the next match
                }

                // --- ATTACHMENT GENERATION LOGIC ---
                // Step 2: Generate a bulk PDF of mission orders FOR THIS MATCH ONLY
                const mergedPdf = await PDFDocument.create();
                for (const official of recipients as any[]) {
                    try {
                        const pdfBytes = await generateSingleMissionOrderPdf(supabase, match.id, official.id);
                        const singlePdf = await PDFDocument.load(pdfBytes);
                        const copiedPages = await mergedPdf.copyPages(singlePdf, singlePdf.getPageIndices());
                        copiedPages.forEach((page) => mergedPdf.addPage(page));
                    } catch (pdfError) {
                        console.error(`Failed to generate individual PDF for official ${official.id} in match ${match.id}`, pdfError);
                    }
                }

                if (mergedPdf.getPageCount() === 0) {
                    console.error(`Could not generate any mission orders for match ${match.id}, sending email without attachment.`);
                    // Decide if you want to send the email anyway or skip. Here we skip.
                    continue;
                }

                const pdfBytes = await mergedPdf.save();

                // Step 3: Convert the PDF to a Base64 string for the attachment
                const base64Pdf = toBase64(pdfBytes);
                const fileName = `ordres_de_mission_${match.homeTeam.code}_vs_${match.awayTeam.code}.pdf`;

                // --- END ATTACHMENT LOGIC ---

                // Step 4: Prepare transformed match (normalize fields for template) & generate email content
                const transformedMatch: any = {
                    ...match,
                    // Normalize date/time fields expected by template
                    matchDate: (match as any).match_date ?? (match as any).matchDate ?? null,
                    matchTime: (match as any).match_time ?? (match as any).matchTime ?? null,
                    assignments: match.assignments.map((a: any) => ({
                        ...a,
                        officialId: a.official_id ?? a.officialId ?? null,
                    })),
                    stadium: match.stadium
                        ? {
                            ...match.stadium,
                            locationId:
                                match.stadium.locationId ?? match.stadium.location_id ?? null,
                            nameAr: (match.stadium as any).nameAr || (match.stadium as any).name_ar || match.stadium.name,
                        }
                        : null,
                };
                const { subject, html } = generateMatchSheetHtml(
                    transformedMatch,
                    adaptedOfficials,
                    !!match.is_sheet_sent,
                    locations
                );

                // Step 5: Invoke the 'send-email' function with the attachment
                const { error: invokeError } = await supabase.functions.invoke('send-email', {
                    body: {
                        to: recipients.map((o: any) => o.email),
                        subject,
                        html,
                        attachments: [{
                            content: base64Pdf,
                            filename: fileName,
                            type: "application/pdf",
                            disposition: "attachment",
                        }]
                    },
                    headers: {
                        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    }
                });

                if (invokeError) throw invokeError;

                // Step 6: Update match status
                await supabase.from('matches').update({ is_sheet_sent: true, has_unsent_changes: false }).eq('id', match.id);

            } catch (e) {
                console.error(`[worker-bulk-email] Failed to process match ${match.id}:`, e);
            } finally {
                // We increment progress regardless of per-match failure to ensure the job completes
                completedCount++;
                await updateJobProgress(completedCount);
            }
        }

        // --- Finalize Job ---
        await supabase.from('jobs').update({
            status: 'completed',
            progress: completedCount
        }).eq('id', job.id);

        return createJsonResponse({ success: true, processed: completedCount });

    } catch (error: unknown) {
        const message = (error as any)?.message || 'Unknown error';
        console.error(`[worker-bulk-email] FATAL ERROR for job ${job.id}:`, error);
        await failJob(message);
        return createJsonResponse({ error: message }, 500);
    }
});