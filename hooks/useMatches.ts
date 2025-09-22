// hooks/useMatches.ts
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Match } from '../types';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { supabase } from '../lib/supabaseClient';
import { mapMatch } from '../lib/mappers';

const MATCHES_QUERY_KEY = 'matches';

export function useMatches(options: QueryOptions = {}) {
    const hasLeagueFilter = !!options.filters?.leagueId;
    const leagueGroupSelect = hasLeagueFilter
        ? `leagueGroup:league_groups!inner!matches_league_group_id_fkey(*,league:leagues(*))`
        : `leagueGroup:league_groups!matches_league_group_id_fkey(*,league:leagues(*))`;
    const baseSelect = `
          *,
          homeTeam:teams!matches_home_team_id_fkey(*),
          awayTeam:teams!matches_away_team_id_fkey(*),
        stadium:stadiums(*),
          ${leagueGroupSelect},
        assignments:match_assignments(*,official:officials!match_assignments_official_id_fkey(*)),
        validatedBy:profiles!matches_validated_by_fkey(full_name)
        `;

    return useQuery<PaginatedResponse<Match>>({
        queryKey: [MATCHES_QUERY_KEY, options],
        queryFn: async () => {
            const resp = await SupabaseQueryBuilder.executePaginatedQuery<any>(
                'matches',
                baseSelect,
                options
            );
            const data = (resp.data || []).map(mapMatch).filter(Boolean) as Match[];
            return { ...resp, data } as PaginatedResponse<Match>;
        },
        enabled: options.enabled !== false,
        placeholderData: keepPreviousData
    });
}

export function useMatch(id: string) {
    return useQuery<Match>({
        queryKey: [MATCHES_QUERY_KEY, id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('matches')
                .select(`
          *,
          homeTeam:teams!matches_home_team_id_fkey(*),
          awayTeam:teams!matches_away_team_id_fkey(*),
          stadium:stadiums(*),
          leagueGroup:league_groups!matches_league_group_id_fkey(*,league:leagues(*)),
                    assignments:match_assignments(*,official:officials!match_assignments_official_id_fkey(*)),
                    validatedBy:profiles!matches_validated_by_fkey(full_name)
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return mapMatch(data)!;
        },
        enabled: !!id,
    });
}

export function useCreateMatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (match: Partial<Match>) => {
            const { data, error } = await supabase
                .from('matches')
                .insert(match)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [MATCHES_QUERY_KEY] });
        },
    });
}

export function useUpdateMatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Match> & { id: string }) => {
            const { data, error } = await supabase
                .from('matches')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [MATCHES_QUERY_KEY] });
            queryClient.setQueryData([MATCHES_QUERY_KEY, data.id], data);
        },
    });
}

export function useBulkUpdateMatchSchedule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ matchIds, matchDate, matchTime }: { matchIds: string[]; matchDate: string; matchTime: string; }) => {
            const { data, error } = await supabase
                .from('matches')
                .update({ match_date: matchDate, match_time: matchTime, has_unsent_changes: true })
                .in('id', matchIds)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
        },
    });
}

export function useArchiveMatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (matchId: string) => {
            const { data, error } = await supabase
                .from('matches')
                .update({ is_archived: true })
                .eq('id', matchId)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
        },
    });
}