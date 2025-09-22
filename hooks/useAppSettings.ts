// hooks/useAppSettings.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useAppSettings() {
    return useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('app_settings_versions')
                .select('*')
                .eq('is_active', true)
                .maybeSingle(); // Use maybeSingle() to avoid errors if no row is found

            if (error) {
                // It's good practice to log the specific error
                console.error("Error fetching app_settings_versions:", error);
                throw error;
            }

            // Also fetch locations
            const { data: locations, error: locationsError } = await supabase
                .from('locations')
                .select('id, wilaya, dairas, communes, latitude, longitude, wilaya_ar, daira_ar, commune_ar')
                .limit(3000);

            if (locationsError) {
                console.error("Error fetching locations:", locationsError);
                throw locationsError;
            }

            return {
                ...data,
                locations: locations || []
            };
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}