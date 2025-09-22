// hooks/useCurrentUser.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { User, mapDbRoleToEnum } from '../types';

export function useCurrentUser(userId?: string) {
    return useQuery<User | null>({
        queryKey: ['currentUser', userId],
        queryFn: async () => {
            if (!userId) return null;

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, team_id')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;

            const { data: roleData } = await supabase
                .from('user_roles')
                .select('roles(name)')
                .eq('user_id', userId)
                .single();

            return {
                id: profileData.id,
                full_name: profileData.full_name || 'Unknown User',
                avatar_url: profileData.avatar_url,
                role: mapDbRoleToEnum((roleData as any)?.roles?.name),
                teamId: profileData.team_id,
            };
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}