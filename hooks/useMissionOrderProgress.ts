import { useCallback, useEffect, useRef, useState } from 'react';

/** Shape of a single progress entry */
export interface MissionOrderProgressEntry {
    total: number;
    completed: number;
    updatedAt: number; // epoch ms
}

interface UseMissionOrderProgressOptions {
    /** milliseconds to consider an entry stale; default 10 minutes */
    ttlMs?: number;
    /** storage key override */
    storageKey?: string;
    /** cleanup interval ms; default 60s */
    sweepIntervalMs?: number;
}

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes
const DEFAULT_SWEEP = 60 * 1000; // 1 minute
const KEY_DEFAULT = 'missionOrderProgressMap';

function loadFromSession(key: string): Record<string, MissionOrderProgressEntry> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, MissionOrderProgressEntry>;
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {
        // ignore parse errors
    }
    return {};
}

function saveToSession(key: string, map: Record<string, MissionOrderProgressEntry>) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(key, JSON.stringify(map));
    } catch (_) {
        // ignore quota or serialization errors
    }
}

export function useMissionOrderProgress(options: UseMissionOrderProgressOptions = {}) {
    const { ttlMs = DEFAULT_TTL, storageKey = KEY_DEFAULT, sweepIntervalMs = DEFAULT_SWEEP } = options;
    const [progressMap, setProgressMap] = useState<Record<string, MissionOrderProgressEntry>>(() => loadFromSession(storageKey));
    const keyRef = useRef(storageKey);
    const ttlRef = useRef(ttlMs);

    // Persist whenever it changes
    useEffect(() => {
        saveToSession(keyRef.current, progressMap);
    }, [progressMap]);

    // Sweep stale entries
    const sweep = useCallback(() => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, MissionOrderProgressEntry> = {};
        for (const [k, v] of Object.entries(progressMap)) {
            if (now - v.updatedAt <= ttlRef.current) {
                next[k] = v;
            } else {
                changed = true;
            }
        }
        if (changed) setProgressMap(next);
    }, [progressMap]);

    useEffect(() => {
        sweep();
        const id = setInterval(sweep, sweepIntervalMs);
        return () => clearInterval(id);
    }, [sweep, sweepIntervalMs]);

    const setProgress = useCallback((scope: string, total: number, completed: number) => {
        setProgressMap((prev) => ({
            ...prev,
            [scope]: { total, completed, updatedAt: Date.now() },
        }));
    }, []);

    const initScope = useCallback((scope: string) => {
        setProgressMap((prev) => ({
            ...prev,
            [scope]: { total: 0, completed: 0, updatedAt: Date.now() },
        }));
    }, []);

    const clearScope = useCallback((scope: string) => {
        setProgressMap((prev) => {
            if (!(scope in prev)) return prev;
            const copy = { ...prev };
            delete copy[scope];
            return copy;
        });
    }, []);

    const resetAll = useCallback(() => {
        setProgressMap({});
    }, []);

    return {
        progressMap,
        setProgress,
        initScope,
        clearScope,
        resetAll,
    };
}
