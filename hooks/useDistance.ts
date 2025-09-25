import { useCallback, useMemo, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Location } from '../types';

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export interface UseDistanceOptions {
    supabase: SupabaseClient | null; // pass explicitly to avoid coupling to context here
    // If true, automatically insert a background compute request when not found (future: RPC)
    enqueueMissing?: boolean;
}

interface DistanceRecord {
    from_location_id: string;
    to_location_id: string;
    distance_km: number;
}

/**
 * useDistance returns helpers to fetch (or compute) distance between two locations.
 * Strategy:
 * 1. Try precomputed table `location_distances` (if backend migration applied).
 * 2. If not present or row missing, fall back to haversine client computation.
 * 3. Optional: enqueue background insertion (left as a TODO / future RPC call placeholder).
 */
export function useDistance(options: UseDistanceOptions) {
    const { supabase, enqueueMissing = false } = options;

    // Simple in-memory cache (lifetime = component using this hook). Key normalized by sorting IDs.
    const cache = useMemo(() => new Map<string, number>(), []);
    // Track in-flight persistence to avoid spamming RPC for same pair.
    const persisting = useRef<Set<string>>(new Set());

    const fetchPrecomputed = useCallback(async (fromId: string, toId: string): Promise<number | null> => {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from('location_distances')
                .select('distance_km')
                .eq('from_location_id', fromId)
                .eq('to_location_id', toId)
                .maybeSingle();
            if (error) {
                // Table might not exist yet -> ignore silently
                if (error.code === '42P01') return null; // undefined table
                // Log other errors for diagnostics
                console.warn('Distance precompute query error', error);
                return null;
            }
            return data ? data.distance_km : null;
        } catch (e) {
            return null;
        }
    }, [supabase]);

    const getDistanceKm = useCallback(async (a: Location | null | undefined, b: Location | null | undefined): Promise<number | null> => {
        if (!a || !b) return null;
        if (a.id === b.id) return 0;
        if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;

        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (cache.has(key)) return cache.get(key)!;

        // Attempt precomputed (both directions acceptable; store canonical ordering in table design if needed)
        const pre = await fetchPrecomputed(a.id, b.id) ?? await fetchPrecomputed(b.id, a.id);
        if (pre != null) {
            cache.set(key, pre);
            return pre;
        }

        // Fallback to client calc
        const computed = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);

        // Optionally enqueue background storage (future: call RPC function) - placeholder only
        if (enqueueMissing && supabase) {
            const persistKey = key; // canonical key already sorted
            if (!persisting.current.has(persistKey)) {
                persisting.current.add(persistKey);
                // Best effort fire-and-forget. Assuming SQL function signature: upsert_location_distance(from_location_id uuid, to_location_id uuid, distance_km numeric)
                supabase
                    .rpc('upsert_location_distance', {
                        from_location_id: a.id < b.id ? a.id : b.id,
                        to_location_id: a.id < b.id ? b.id : a.id,
                        distance_km: computed,
                    })
                    .then(({ error }) => {
                        if (error) {
                            // Silently ignore table/function absence (e.g., migrations not yet applied) or log other errors.
                            if (error.code !== '42883' && error.code !== '42P01') {
                                console.warn('Failed to persist distance pair', { a: a.id, b: b.id, error });
                            }
                        }
                        // cleanup here (success or error)
                        persisting.current.delete(persistKey);
                    });
            }
        }

        cache.set(key, computed);
        return computed;
    }, [fetchPrecomputed, enqueueMissing, supabase, cache]);

    const getRoundTripBufferedKm = useCallback(async (a: Location | null | undefined, b: Location | null | undefined): Promise<number | null> => {
        const oneWay = await getDistanceKm(a, b);
        if (oneWay == null) return null;
        return Math.round(oneWay * 2 * 1.2); // round trip + 20% buffer (existing business rule)
    }, [getDistanceKm]);

    return useMemo(() => ({ getDistanceKm, getRoundTripBufferedKm }), [getDistanceKm, getRoundTripBufferedKm]);
}
