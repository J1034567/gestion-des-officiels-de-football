// hooks/useAccountingPeriods.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logAndThrow } from '../utils/logging';

const ACCOUNTING_PERIODS_KEY = 'accountingPeriods';

export function useAccountingPeriods(options: {
    type?: 'daily' | 'monthly' | 'payment_batch';
    status?: 'open' | 'closed';
    enabled?: boolean;
} = {}) {
    return useQuery({
        queryKey: [ACCOUNTING_PERIODS_KEY, options.type, options.status],
        queryFn: async () => {
            let query = supabase
                .from('accounting_periods')
                .select(`
          *,
          closedBy:profiles!accounting_periods_closed_by_fkey(full_name),
          reopenedBy:profiles!accounting_periods_reopened_by_fkey(full_name),
          payment_batches(*)
        `)
                .order('period_date', { ascending: false });

            if (options.type) {
                query = query.eq('type', options.type);
            }

            if (options.status) {
                query = query.eq('status', options.status);
            }

            const { data, error } = await query;
            if (error) return logAndThrow('fetch accounting_periods', error, { options });
            return data || [];
        },
        enabled: options.enabled !== false,
    });
}

export function useCloseAccountingPeriod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ type, periodIdentifier }: any) => {
            const { data, error } = await supabase.functions.invoke('close-accounting-period', {
                body: { type, periodIdentifier }
            });

            if (error) return logAndThrow('close-accounting-period', error, { type, periodIdentifier });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ACCOUNTING_PERIODS_KEY] });
            queryClient.invalidateQueries({ queryKey: ['matches'] });
        },
    });
}