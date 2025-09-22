// lib/queryClient.ts
import { QueryClient, keepPreviousData } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            retry: 3,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            placeholderData: keepPreviousData
        },
    },
});