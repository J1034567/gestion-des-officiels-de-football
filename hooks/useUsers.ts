// hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { User, mapDbRoleToEnum } from '../types';

export function useUsers() {
    return useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, team_id, email');

            if (profileError) throw profileError;

            const { data: roles, error: rolesError } = await supabase
                .from('user_roles')
                .select('user_id, roles(name)');

            if (rolesError) throw rolesError;

            const rolesMap = new Map(roles.map((r: any) => [r.user_id, r.roles?.name]));

            return profiles.map(p => ({
                id: p.id,
                full_name: p.full_name || p.email || "Unknown User",
                avatar_url: p.avatar_url,
                role: mapDbRoleToEnum(rolesMap.get(p.id)),
                teamId: p.team_id,
                email: p.email,
            }));
        },
    });
}