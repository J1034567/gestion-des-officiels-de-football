// hooks/useAssignments.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useUpdateAssignment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            officialId,
            matchId
        }: {
            id: string;
            officialId: string | null;
            matchId: string;
        }) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .update({ official_id: officialId })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
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
// FIX: Changed officialId to be nullable to allow creating empty assignment slots.
            officialId: string | null;
            role: string;
        }) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .insert({
                    match_id: assignment.matchId,
                    official_id: assignment.officialId,
                    role: assignment.role,
                })
                .select()
                .single();

            if (error) throw error;
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
            if (error) throw error;
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
        mutationFn: async ({ assignmentId, officialId }: { assignmentId: string; officialId: string }) => {
            const { data, error } = await supabase
                .from('match_assignments')
                .update({ original_official_id: officialId, official_id: null })
                .eq('id', assignmentId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['matches'] });
            queryClient.invalidateQueries({ queryKey: ['matches', data.match_id] });
        },
    });
}
