// hooks/useLeagueGroups.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { LeagueGroup } from '../types';

const LEAGUE_GROUPS_KEY = 'leagueGroups';

export function useLeagueGroups(options: {
    leagueId?: string;
    season?: string;
    enabled?: boolean;
} = {}) {
    return useQuery<LeagueGroup[]>({
        queryKey: [LEAGUE_GROUPS_KEY, options.leagueId, options.season],
        queryFn: async () => {
            let query = supabase
                .from('league_groups')
                .select(`
          *,
          league_group_teams(team_id)
        `)
                .order('name', { ascending: true });

            if (options.leagueId) {
                query = query.eq('league_id', options.leagueId);
            }

            if (options.season) {
                query = query.eq('season', options.season);
            }

            const { data, error } = await query;
            if (error) throw error;
            const mapped: LeagueGroup[] = (data || []).map((g: any) => ({
                id: g.id,
                name: g.name,
                name_ar: g.name_ar ?? null,
                league_id: g.league_id,
                season: g.season,
                teamIds: Array.isArray(g.league_group_teams)
                    ? g.league_group_teams.map((r: any) => r.team_id)
                    : [],
            }));
            return mapped;
        },
        enabled: options.enabled !== false,
        staleTime: 5 * 60 * 1000,
    });
}