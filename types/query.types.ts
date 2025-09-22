// types/query.types.ts
export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    [key: string]: any;
}

export interface PaginatedResponse<T> {
    data: T[];
    count: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
}

export interface QueryOptions {
    pagination?: PaginationParams;
    filters?: FilterParams;
    enabled?: boolean;
}