// hooks/useLeagues.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logAndThrow } from '../utils/logging';
import { League } from '../types';

const LEAGUES_KEY = 'leagues';

export function useLeagues(options: { enabled?: boolean } = {}) {
    return useQuery<League[]>({
        queryKey: [LEAGUES_KEY],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('leagues')
                .select('*')
                .order('level', { ascending: true })
                .order('name', { ascending: true });

            if (error) return logAndThrow('fetch leagues', error);
            return data || [];
        },
        enabled: options.enabled !== false,
        staleTime: 10 * 60 * 1000, // 10 minutes - leagues don't change often
    });
}

export function useCreateLeague() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (league: Partial<League>) => {
            const { data, error } = await supabase
                .from('leagues')
                .insert(league)
                .select()
                .single();

            if (error) return logAndThrow('create league', error, { league });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [LEAGUES_KEY] });
        },
    });
}