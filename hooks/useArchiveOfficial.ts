// hooks/useArchiveOfficial.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useArchiveOfficial() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (officialId: string) => {
            const { data, error } = await supabase
                .from('officials')
                .update({ is_archived: true })
                .eq('id', officialId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['officials'] });
        },
    });
}