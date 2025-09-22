// hooks/useTeamStadiums.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { TeamSeasonStadium } from '../types'; // Ensure this type is correctly defined and imported

const TEAM_STADIUMS_KEY = 'teamStadiums';

export function useTeamStadiums(options: { season?: string; enabled?: boolean } = {}) {
    return useQuery<TeamSeasonStadium[]>({
        // The query key will change if a season is provided, allowing for separate caching
        queryKey: [TEAM_STADIUMS_KEY, options.season],
        queryFn: async () => {
            let query = supabase
                .from('team_stadiums')
                .select('*');

            // This makes the hook more flexible, allowing it to fetch for a specific season
            if (options.season) {
                query = query.eq('season', options.season);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            // This is the exact data transformation logic from your original App.tsx
            const fetchedTeamStadiums = data?.map((ts: any) => ({
                id: ts.id,
                teamId: ts.team_id,
                stadiumId: ts.stadium_id,
                season: ts.season,
            })) || [];

            return fetchedTeamStadiums;
        },
        // The query will only run if it's explicitly enabled (and a season is present)
        enabled: options.enabled !== false,
    });
}