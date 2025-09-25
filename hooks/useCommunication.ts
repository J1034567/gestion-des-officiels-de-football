// hooks/useCommunication.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { generateMatchSheetHtml } from '../services/emailService'; // Assuming you extract this
import { generateBulkMissionOrdersPDF } from '../services/pdfService'; // Legacy bulk (kept for fallback if needed)
import { getMissionOrderPdf, getBulkMissionOrdersPdf } from '../services/missionOrderService';
import { Match, Official, Location } from '../types';
import { blobToBase64 } from '../utils/fileHelpers';
import { logAndThrow } from '../utils/logging';


export function useSendMatchSheet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ match, officials, locations }: { match: Match; officials: Official[]; locations: Location[] }) => {
            // Step 1: Identify recipients with valid email addresses
            const assignedOfficialsWithEmail = match.assignments
                .map(assignment => officials.find(o => o.id === assignment.officialId))
                .filter((official): official is Official => !!official && !!official.email && official.email.trim() !== '');

            if (assignedOfficialsWithEmail.length === 0) {
                // This error will be caught by react-query's `onError` callback
                throw new Error("Aucun officiel avec une adresse e-mail valide n'est assigné à ce match.");
            }

            const emails = assignedOfficialsWithEmail.map(o => o.email!);

            // Step 2: Generate the bulk PDF of mission orders
            const ordersToGenerate = assignedOfficialsWithEmail.map(official => ({
                matchId: match.id,
                officialId: official.id,
            }));

            // Prefer cached bulk generation via service (will reuse existing single PDFs within session)
            const pdfBlob = await getBulkMissionOrdersPdf(ordersToGenerate) || await generateBulkMissionOrdersPDF(ordersToGenerate);
            if (!pdfBlob) {
                throw new Error("Erreur lors de la génération du PDF des ordres de mission.");
            }

            // Step 3: Convert the PDF to a base64 string for the attachment
            const base64Pdf = await blobToBase64(pdfBlob);
            const fileName = `ordres_de_mission_${match.homeTeam.code}_vs_${match.awayTeam.code}.pdf`;

            // Step 4: Generate the email's subject and body content
            const isUpdate = match.hasUnsentChanges;
            const { subject, html, text } = generateMatchSheetHtml(
                match,
                officials, // Pass the full list for context
                isUpdate,
                locations
            );

            // Step 5: Invoke the Supabase Edge Function to send the email
            const { error: functionError } = await supabase.functions.invoke(
                "send-email",
                {
                    body: {
                        to: emails,
                        subject,
                        html,
                        text,
                        attachments: [
                            {
                                content: base64Pdf,
                                filename: fileName,
                                type: "application/pdf",
                                disposition: "attachment",
                            },
                        ],
                    },
                }
            );

            if (functionError) return logAndThrow('send-email (bulk match sheet)', functionError, { matchId: match.id, recipientCount: emails.length });

            // Step 6: Update the match's status in the database upon successful email sending
            const { data: updatedMatch, error: dbError } = await supabase
                .from("matches")
                .update({
                    is_sheet_sent: true,
                    has_unsent_changes: false,
                    // updated_by will be set by database triggers/policies based on the authenticated user
                })
                .eq("id", match.id)
                .select()
                .single();

            if (dbError) return logAndThrow('update match after send-email', dbError, { matchId: match.id });

            return updatedMatch;
        },
        onSuccess: (updatedMatch) => {
            // Invalidate the entire list of matches to ensure all views are fresh
            queryClient.invalidateQueries({ queryKey: ['matches'] });

            // Immediately update the cache for this specific match for a faster UI response
            queryClient.setQueryData(['matches', updatedMatch.id], updatedMatch);
        }
    });
}

export function useSendIndividualMissionOrder() {
    return useMutation({
        mutationFn: async ({ match, official, allOfficials, allLocations }: { match: Match; official: Official; allOfficials: Official[], allLocations: Location[] }) => {
            if (!official.email) {
                throw new Error("Impossible d'envoyer: L'officiel n'a pas d'adresse e-mail enregistrée.");
            }

            const pdfBlob = await getMissionOrderPdf(match.id, official.id);
            const base64Pdf = await blobToBase64(pdfBlob);
            const fileName = `ordre_de_mission_${official.lastName}_${match.homeTeam.code}_${match.awayTeam.code}.pdf`;

            const { subject, html, text } = generateMatchSheetHtml(match, allOfficials, false, allLocations);

            const { error: emailError } = await supabase.functions.invoke(
                "send-email",
                {
                    body: {
                        to: [official.email],
                        subject,
                        html,
                        text,
                        attachments: [
                            {
                                content: base64Pdf,
                                filename: fileName,
                                type: "application/pdf",
                                disposition: "attachment",
                            },
                        ],
                    },
                }
            );
            if (emailError) return logAndThrow('send-email (individual mission order)', emailError, { matchId: match.id, officialId: official.id });

            // Optionally, log this action to your audit log here if you have a hook for it
            return { success: true, officialName: official.fullName };
        },
    });
}