// hooks/useAppSettings.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logAndThrow } from '../utils/logging';

export function useAppSettings() {
    return useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('app_settings_versions')
                .select('*')
                .eq('is_active', true)
                .maybeSingle(); // Use maybeSingle() to avoid errors if no row is found

            if (error) return logAndThrow('fetch app_settings_versions', error);

            // Also fetch locations
            const { data: locations, error: locationsError } = await supabase
                .from('locations')
                .select('id, wilaya, dairas, communes, latitude, longitude, wilaya_ar, daira_ar, commune_ar')
                .limit(3000);

            if (locationsError) return logAndThrow('fetch locations', locationsError);

            return {
                ...data,
                locations: locations || []
            };
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}