// hooks/useBulkOperations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useBulkArchiveOfficials() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (officialIds: string[]) => {
            const { data, error } = await supabase
                .from('officials')
                .update({ is_archived: true })
                .in('id', officialIds)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['officials'] });
        },
    });
}

export function useBulkUpdateOfficialCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            officialIds,
            category
        }: {
            officialIds: string[];
            category: string;
        }) => {
            const { data, error } = await supabase
                .from('officials')
                .update({ official_category: category })
                .in('id', officialIds)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['officials'] });
        },
    });
}

export function useBulkUpdateOfficialLocations() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ officialIds, locationId }: { officialIds: string[]; locationId: string }) => {
            const { data, error } = await supabase
                .from('officials')
                .update({ location_id: locationId })
                .in('id', officialIds)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['officials'] });
        },
    });
}