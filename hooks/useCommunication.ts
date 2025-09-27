// hooks/useCommunication.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Match, Official, Location } from '../types';
import { logAndThrow } from '../utils/logging';
import { jobService } from '../services/jobService';
import { JobKinds } from '../supabase/functions/_shared/jobKinds';


// DEPRECATED: This hook previously performed client-side PDF + email sending.
// It now simply enqueues a background job (match_sheets.bulk_email).
export function useSendMatchSheet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ match }: { match: Match; officials: Official[]; locations: Location[] }) => {
            // Enqueue background job for this single match (treat as bulk with one ID)
            const job = await jobService.enqueueJob({
                type: JobKinds.MatchSheetsBulkEmail,
                label: `Envoi feuille match ${match.homeTeam.code} vs ${match.awayTeam.code}`,
                payload: { matchIds: [match.id] }, // recipients/subject resolved server-side
                total: 1,
            });
            return job; // Caller can observe via job center
        },
        onSuccess: (updatedMatch) => {
            // Optimistically invalidate match list (actual status update will come via realtime once worker finishes)
            queryClient.invalidateQueries({ queryKey: ['matches'] });
        }
    });
}

export function useSendIndividualMissionOrder() {
    return useMutation({
        mutationFn: async ({ match, official }: { match: Match; official: Official; allOfficials: Official[], allLocations: Location[] }) => {
            if (!official.email) {
                throw new Error("Impossible d'envoyer: L'officiel n'a pas d'adresse e-mail enregistrée.");
            }
            const job = await jobService.enqueueJob({
                type: JobKinds.MissionOrdersSingleEmail,
                label: `Ordre de mission ${official.lastName} ${match.homeTeam.code}-${match.awayTeam.code}`,
                payload: { matchId: match.id, officialId: official.id },
                total: 1,
            });
            return job;
        },
    });
}