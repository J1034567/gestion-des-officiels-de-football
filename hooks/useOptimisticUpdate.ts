// hooks/useOptimisticUpdate.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useOptimisticUpdate<T>(
    mutationFn: (data: T) => Promise<any>,
    queryKey: string[],
    optimisticUpdateFn: (old: any, newData: T) => any
) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onMutate: async (newData) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKey });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, (old: any) =>
                optimisticUpdateFn(old, newData)
            );

            // Return a context object with the snapshotted value
            return { previousData };
        },
        onError: (err, newData, context: any) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData);
            }
        },
        onSettled: () => {
            // Always refetch after error or success
            queryClient.invalidateQueries({ queryKey });
        },
    });
}