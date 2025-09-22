// hooks/useAssignments.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logAndThrow } from '../utils/logging';

export function useUpdateAssignment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            officialId,
            matchId,
            updatedBy,
        }: {
            id: string;
            officialId: string | null;
            matchId: string;
            updatedBy?: string | null;
        }) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .update({ official_id: officialId, updated_by: updatedBy ?? null })
                .eq('id', id)
                .select();

            if (error) return logAndThrow('update assignment', error, { id, officialId, matchId });
            return data;
        },
        onSuccess: (data, variables) => {
            // Invalidate both matches and the specific match
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            queryClient.invalidateQueries({ queryKey: ['matches', variables.matchId] });
        },
    });
}

export function useCreateAssignment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (assignment: {
            matchId: string;
            officialId: string | null;
            role: string;
            createdBy?: string | null;
            updatedBy?: string | null;
        }) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .insert({
                    match_id: assignment.matchId,
                    official_id: assignment.officialId,
                    role: assignment.role,
                    created_by: assignment.createdBy ?? null,
                    updated_by: assignment.updatedBy ?? null,
                })
                .select();

            if (error) return logAndThrow('create assignment', error, assignment);
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            queryClient.invalidateQueries({ queryKey: ['matches', variables.matchId] });
        },
    });
}

export function useDeleteAssignment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (assignmentId: string) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .delete()
                .eq('id', assignmentId);
            if (error) return logAndThrow('delete assignment', error, { assignmentId });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
        },
    });
}

export function useMarkOfficialAbsent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ assignmentId, officialId, updatedBy }: { assignmentId: string; officialId: string; updatedBy?: string | null }) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .update({ original_official_id: officialId, official_id: null, updated_by: updatedBy ?? null })
                .eq('id', assignmentId)
                .select();
            if (error) return logAndThrow('mark official absent', error, { assignmentId, officialId });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
        },
    });
}
