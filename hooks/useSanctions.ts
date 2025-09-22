// hooks/useSanctions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const SANCTIONS_KEY = 'sanctions';

export function useSanctions(options: {
    playerId?: string;
    matchId?: string;
    enabled?: boolean;
} = {}) {
    return useQuery({
        queryKey: [SANCTIONS_KEY, options.playerId, options.matchId],
        queryFn: async () => {
            let query = supabase
                .from('sanctions')
                .select(`
          *,
          player:players(*),
          match:matches(
            *,
            homeTeam:teams!matches_home_team_id_fkey(*),
            awayTeam:teams!matches_away_team_id_fkey(*)
          )
        `)
                .order('created_at', { ascending: false });

            if (options.playerId) {
                query = query.eq('player_id', options.playerId);
            }

            if (options.matchId) {
                query = query.eq('match_id', options.matchId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        enabled: options.enabled !== false,
    });
}

export function useCreateSanction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (sanction: any) => {
            const { data, error } = await supabase
                .from('sanctions')
                .insert(sanction)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [SANCTIONS_KEY] });
        },
    });
}