// hooks/useTeams.ts
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Team } from '../types';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { supabase } from '../lib/supabaseClient';
import { mapTeam } from '../lib/mappers';

const TEAMS_QUERY_KEY = 'teams';

export function useTeams(options: QueryOptions = {}) {
    return useQuery<PaginatedResponse<Team>>({
        queryKey: [TEAMS_QUERY_KEY, options],
        queryFn: async () => {
            const resp = await SupabaseQueryBuilder.executePaginatedQuery<any>(
                'teams',
                `
          *,
          homeMatches:matches!matches_home_team_id_fkey(count),
          awayMatches:matches!matches_away_team_id_fkey(count)
        `,
                {
                    ...options,
                    filters: {
                        ...options.filters,
                        isArchived: false,
                    },
                }
            );
            const data = (resp.data || []).map(mapTeam);
            return { ...resp, data } as PaginatedResponse<Team>;
        },
        enabled: options.enabled !== false,
        placeholderData: keepPreviousData
    });
}