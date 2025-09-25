// Stable hashing utilities for idempotent artifact generation.
// Uses Web Crypto if available, falls back to a lightweight JS hash (FNV-1a) if not.

export async function sha256Hex(input: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const data = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }
    // Fallback FNV-1a
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0; // 32-bit
    }
    return ('0000000' + hash.toString(16)).slice(-8);
}

/**
 * Canonical JSON stringify: sort object keys recursively so that logically equivalent
 * order sets produce the exact same string (and hash) regardless of insertion order.
 */
export function canonicalStringify(value: any): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map((v) => canonicalStringify(v)).join(',') + ']';
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}

/**
 * Compute a stable hash for a set of mission order requests.
 * Orders are normalized and sorted to ensure idempotency.
 */
export async function hashMissionOrders(orders: { matchId: string; officialId: string }[]): Promise<string> {
    const normalized = orders
        .map((o) => ({ matchId: o.matchId, officialId: o.officialId }))
        .sort((a, b) => (a.matchId === b.matchId ? a.officialId.localeCompare(b.officialId) : a.matchId.localeCompare(b.matchId)));
    const payload = { v: 1, type: 'mission_orders', items: normalized };
    return sha256Hex(canonicalStringify(payload));
}
