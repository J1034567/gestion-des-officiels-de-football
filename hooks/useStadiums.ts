// hooks/useStadiums.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stadium } from '../types';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { supabase } from '../lib/supabaseClient';
import { mapStadium } from '../lib/mappers';

const STADIUMS_QUERY_KEY = 'stadiums';

export function useStadiums(options: QueryOptions = {}) {
    return useQuery<PaginatedResponse<Stadium>>({
        queryKey: [STADIUMS_QUERY_KEY, options],
        queryFn: async () => {
            const resp = await SupabaseQueryBuilder.executePaginatedQuery<any>(
                'stadiums',
                '*',
                {
                    ...options,
                    filters: {
                        ...options.filters,
                        isArchived: false,
                    },
                }
            );
            const data = (resp.data || []).map(mapStadium);
            return { ...resp, data } as PaginatedResponse<Stadium>;
        },
        enabled: options.enabled !== false,
        placeholderData: keepPreviousData
    });
}

export function useCreateStadium() {
    const queryClient = useQueryClient();
    // FIX: The mutation function must return a promise. Wrap the Supabase call in an async function.
    return useMutation({
        mutationFn: async (stadium: Partial<Stadium>) => {
            const { data, error } = await supabase.from('stadiums').insert(stadium).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stadiums'] }),
    });
}

export function useUpdateStadium() {
    const queryClient = useQueryClient();
    // FIX: The mutation function must return a promise. Wrap the Supabase call in an async function.
    // FIX: Add generic types to useMutation to correctly type the 'data' parameter in onSuccess.
    return useMutation<Stadium, Error, Partial<Stadium> & { id: string }>({
        mutationFn: async ({ id, ...updates }: Partial<Stadium> & { id: string }) => {
            const { data, error } = await supabase.from('stadiums').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['stadiums'] });
            queryClient.setQueryData(['stadiums', data.id], data);
        },
    });
}