// hooks/useRealtimeSubscriptions.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeMatchUpdates(matchId?: string) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!matchId) return;

        const subscription = supabase
            .channel(`match-${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'matches',
                    filter: `id=eq.${matchId}`,
                },
                (payload) => {
                    // Invalidate the specific match query
                    queryClient.invalidateQueries({ queryKey: ['matches', matchId] });
                    // Also invalidate the list query
                    queryClient.invalidateQueries({ queryKey: ['matches'] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'match_assignments',
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['matches', matchId] });
                    queryClient.invalidateQueries({ queryKey: ['matches'] });
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [matchId, queryClient]);
}