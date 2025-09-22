// hooks/useAuditLogs.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { QueryOptions, PaginatedResponse } from '../types/query.types.ts';
import { AuditLog } from '../types';

export function useAuditLogs(options: QueryOptions = {}) {
    return useQuery<PaginatedResponse<AuditLog>>({
        queryKey: ['auditLogs', options],
        queryFn: async () => {
            const page = options.pagination?.page ?? 1;
            const pageSize = options.pagination?.pageSize ?? 50;
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('audit_logs')
                .select('id, created_at, user_id, user_name, user_email, action, table_name, record_id, old_values, new_values, user_agent, ip_address', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            const { data, error, count } = await query;
            if (error) throw error;

            const mapped: AuditLog[] = (data || []).map((r: any) => ({
                id: r.id,
                timestamp: r.created_at,
                userId: r.user_id ?? null,
                userName: r.user_name || r.user_email || 'Système',
                userEmail: r.user_email || undefined,
                action: r.action,
                tableName: r.table_name || undefined,
                recordId: r.record_id || undefined,
                oldValues: r.old_values || undefined,
                newValues: r.new_values || undefined,
                userAgent: r.user_agent || null,
                ipAddress: r.ip_address || null,
            }));

            const totalCount = count || 0;
            const totalPages = Math.ceil(totalCount / pageSize);
            return {
                data: mapped,
                count: totalCount,
                page,
                pageSize,
                totalPages,
                hasMore: page < totalPages,
            };
        },
        enabled: options.enabled !== false,
    });
}