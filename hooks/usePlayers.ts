// hooks/usePlayers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { supabase } from '../lib/supabaseClient';
import { logAndThrow } from '../utils/logging';
import { Player } from '../types';

const PLAYERS_KEY = 'players';

export function usePlayers(options: QueryOptions = {}) {
    return useQuery<PaginatedResponse<Player>>({
        queryKey: [PLAYERS_KEY, options],
        queryFn: async () => {
            return SupabaseQueryBuilder.executePaginatedQuery<Player>(
                'players',
                `
          *,
                    currentTeam:teams!players_current_team_id_fkey(*)
        `,
                {
                    ...options,
                    filters: {
                        ...options.filters,
                        isArchived: false
                    }
                }
            );
        },
        enabled: options.enabled !== false,
    });
}

export function useCreatePlayer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (player: any) => {
            const { data, error } = await supabase
                .from('players')
                .insert(player)
                .select()
                .single();

            if (error) return logAndThrow('create player', error, { player });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PLAYERS_KEY] });
        },
    });
}