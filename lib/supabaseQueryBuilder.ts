// lib/supabaseQueryBuilder.ts
import { supabase } from './supabaseClient';

// Define the structure for pagination and filtering options
export interface QueryOptions {
    filters?: { [key: string]: any };
    pagination?: {
        page: number;
        pageSize: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    };
}

// Define the structure for the paginated response object
export interface PaginatedResponse<T> {
    data: T[];
    count: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
}

export class SupabaseQueryBuilder {
    static buildPaginatedQuery<T extends Record<string, any>>(
        tableName: string,
        selectQuery: string,
        options: QueryOptions
    ) {
        let query = supabase
            .from(tableName)
            .select<string, T>(selectQuery, { count: 'exact' });

        // Apply filters
        if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    const toSnake = (k: string) => k.replace(/([A-Z])/g, '_$1').toLowerCase();
                    // Table-specific special cases
                    if (tableName === 'matches' && key === 'leagueId') {
                        // Filter matches by related league via league_groups.league_id
                        query = query.eq('league_groups.league_id', value);
                        return;
                    }
                    if (key === 'search' && value) {
                        // Table-specific search columns to avoid referencing non-existent fields
                        const searchColumnsMap: Record<string, string[]> = {
                            officials: ['full_name', 'first_name', 'last_name', 'email'],
                            teams: ['name', 'full_name', 'code'],
                            players: ['full_name', 'first_name', 'last_name', 'license_number'],
                            stadiums: ['name', 'code'],
                            leagues: ['name', 'code'],
                            league_groups: ['name', 'code', 'season'],
                        };
                        const cols = searchColumnsMap[tableName] || ['name', 'full_name'];
                        const orExpr = cols.map(c => `${c}.ilike.%${value}%`).join(',');
                        query = query.or(orExpr);
                    } else if (key.endsWith('From')) {
                        const field = toSnake(key.replace('From', ''));
                        query = query.gte(field, value);
                    } else if (key.endsWith('To')) {
                        const field = toSnake(key.replace('To', ''));
                        query = query.lte(field, value);
                    } else if (Array.isArray(value)) {
                        query = query.in(toSnake(key), value);
                    } else {
                        query = query.eq(toSnake(key), value);
                    }
                }
            });
        }

        // Apply sorting
        if (options.pagination?.sortBy) {
            query = query.order(options.pagination.sortBy, {
                ascending: options.pagination.sortOrder === 'asc',
            });
        }

        // Apply pagination
        if (options.pagination) {
            const { page, pageSize } = options.pagination;
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);
        }

        return query;
    }

    static async executePaginatedQuery<T extends Record<string, any>>(
        tableName: string,
        selectQuery: string,
        options: QueryOptions
    ): Promise<PaginatedResponse<T>> {
        const query = this.buildPaginatedQuery<T>(tableName, selectQuery, options);

        const { data, error, count } = await query;

        if (error) {
            console.error('Supabase query error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        const { page = 1, pageSize = 25 } = options.pagination || {};
        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / pageSize);

        return {
            data: data || [], // This will now be correctly typed as T[]
            count: totalCount,
            page,
            pageSize,
            totalPages,
            hasMore: page < totalPages,
        };
    }
}