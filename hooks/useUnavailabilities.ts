// hooks/useUnavailabilities.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Unavailability } from '../types';

export function useUpdateUnavailabilities() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ officialId, unavailabilities }: { officialId: string; unavailabilities: Omit<Unavailability, 'id' | 'officialId'>[] }) => {
            // 1. Delete existing unavailabilities for this official
            const { error: deleteError } = await supabase
                .from('official_unavailabilities')
                .delete()
                .eq('official_id', officialId);
            
            if (deleteError) throw deleteError;

            // 2. Insert the new ones, if any
            if (unavailabilities.length > 0) {
                const unavsToInsert = unavailabilities.map(u => ({
                    official_id: officialId,
                    start_date: u.startDate,
                    end_date: u.endDate,
                    reason: u.reason,
                    is_approved: u.isApproved,
                }));

                const { data, error: insertError } = await supabase
                    .from('official_unavailabilities')
                    .insert(unavsToInsert)
                    .select();

                if (insertError) throw insertError;
                return data;
            }

            return [];
        },
        onSuccess: (data, variables) => {
            // Invalidate the main officials query to get fresh data
            queryClient.invalidateQueries({ queryKey: ['officials'] });
            // Also invalidate the specific official query if you have one
            queryClient.invalidateQueries({ queryKey: ['officials', variables.officialId] });
        },
    });
}