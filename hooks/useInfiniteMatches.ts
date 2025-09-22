// hooks/useInfiniteMatches.ts
import { useInfiniteQuery, keepPreviousData, InfiniteData } from '@tanstack/react-query';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { FilterParams, PaginatedResponse } from '../types/query.types.ts';
import { Match } from '../types'; // FIX: Import your Match type

export function useInfiniteMatches(filters: FilterParams = {}) {
    return useInfiniteQuery<
        PaginatedResponse<Match>,
        Error,
        InfiniteData<PaginatedResponse<Match>>,
        (string | FilterParams)[],
        number
    >({
        queryKey: ['matches-infinite', filters],
        queryFn: async ({ pageParam }) => {
            return SupabaseQueryBuilder.executePaginatedQuery<Match>(
                'matches',
                `
          *,
          homeTeam:teams!matches_home_team_id_fkey(*),
          awayTeam:teams!matches_away_team_id_fkey(*),
          stadium:stadiums(*),
          leagueGroup:league_groups!matches_league_group_id_fkey(
            *,
            league:leagues(*)
          ),
          assignments:match_assignments(
            *,
                        official:officials!match_assignments_official_id_fkey(*)
          )
        `,
                {
                    pagination: {
                        page: pageParam,
                        pageSize: 25,
                        sortBy: 'match_date',
                        sortOrder: 'desc',
                    },
                    filters: {
                        ...filters,
                        isArchived: false
                    },
                }
            );
        },

        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            return lastPage.hasMore ? lastPage.page + 1 : undefined;
        },

        placeholderData: keepPreviousData,
    });
}