// Shared distance utilities (Haversine based) with buffered round-trip rule.
// Keep pure & framework-agnostic.

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function bufferedRoundTripKm(oneWayKm: number): number {
    return Math.round(oneWayKm * 2 * 1.2); // existing business rule
}

export function computeBufferedDistance(
    lat1: number | null,
    lon1: number | null,
    lat2: number | null,
    lon2: number | null
): number | null {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    return bufferedRoundTripKm(haversineKm(lat1, lon1, lat2, lon2));
}
