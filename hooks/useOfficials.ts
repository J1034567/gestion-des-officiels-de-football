// hooks/useOfficials.ts
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Official } from '../types';
import { SupabaseQueryBuilder } from '../lib/supabaseQueryBuilder.ts';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { supabase } from '../lib/supabaseClient';
import { logAndThrow } from '../utils/logging';
import { mapOfficial } from '../lib/mappers';

const OFFICIALS_QUERY_KEY = 'officials';

export function useOfficials(options: QueryOptions = {}) {
    return useQuery<PaginatedResponse<Official>>({
        queryKey: [OFFICIALS_QUERY_KEY, options],
        queryFn: async () => {
            const { filters: rawFilters, ...restOptions } = options as any;
            const { includeArchived, ...forwardFilters } = (rawFilters || {}) as any;
            // By default return only non-archived, unless includeArchived is true or explicit isArchived provided
            const finalFilters = includeArchived ? forwardFilters : { isArchived: (forwardFilters as any)?.isArchived ?? false, ...forwardFilters };
            const resp = await SupabaseQueryBuilder.executePaginatedQuery<any>(
                'officials',
                `
                      *,
                      unavailabilities:official_unavailabilities(*)
                    `,
                {
                    ...(restOptions as any),
                    filters: finalFilters,
                }
            );
            const data = (resp.data || []).map(mapOfficial);
            return { ...resp, data } as PaginatedResponse<Official>;
        },
        enabled: options.enabled !== false,
        placeholderData: keepPreviousData
    });
}

export function useOfficial(id: string) {
    return useQuery<Official>({
        queryKey: [OFFICIALS_QUERY_KEY, id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('officials')
                .select(`
                    *,
                    unavailabilities:official_unavailabilities(*)
                `)
                .eq('id', id)
                .single();

            if (error) return logAndThrow('fetch official by id', error, { id });
            return mapOfficial(data);
        },
        enabled: !!id,
    });
}

export function useCreateOfficial() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (official: Partial<Official>) => {
            const { data, error } = await supabase
                .from('officials')
                .insert(official)
                .select()
                .single();

            if (error) return logAndThrow('create official', error, { official });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [OFFICIALS_QUERY_KEY] });
        },
    });
}

export function useUpdateOfficial() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Official> & { id: string }) => {
            const { data, error } = await supabase
                .from('officials')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) return logAndThrow('update official', error, { id, updates });
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [OFFICIALS_QUERY_KEY] });
            queryClient.setQueryData([OFFICIALS_QUERY_KEY, data.id], data);
        },
    });
}