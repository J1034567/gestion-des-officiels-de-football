// src/components/job-center.config.ts
import { CheckCircle2, XCircle, AlertTriangle, Zap, Hourglass, Loader, Pause, RotateCcw } from 'lucide-react';
import { JobRecord } from '../hooks/useJobCenter';

export type JobStatus = JobRecord['status'];

// Centralized configuration for each status
export const STATUS_CONFIG: Record<JobStatus, {
    label: string;
    Icon: React.ElementType;
    color: string; // Tailwind CSS classes
    priority: number;
}> = {
    pending: {
        label: "En attente",
        Icon: Hourglass,
        color: 'bg-amber-500/90 text-amber-900',
        priority: 1,
    },
    processing: {
        label: "En cours",
        Icon: Loader, // This icon could be animated with `animate-spin`
        color: 'bg-blue-600/90',
        priority: 2,
    },
    completed: {
        label: "Terminé",
        Icon: CheckCircle2,
        color: 'bg-green-600/90',
        priority: 3,
    },
    failed: {
        label: "Échec",
        Icon: XCircle,
        color: 'bg-red-600/90',
        priority: 4,
    },
    cancelled: {
        label: "Annulé",
        Icon: AlertTriangle,
        color: 'bg-gray-600/90',
        priority: 5,
    },
    paused: {
        label: "En pause",
        Icon: Pause,
        color: 'bg-orange-500/90 text-orange-900',
        priority: 6,
    },
    retrying: {
        label: "Nouvelle tentative",
        Icon: RotateCcw,
        color: 'bg-purple-500/90 text-purple-900',
        priority: 7,
    },
};

// Utility function remains the same but is now co-located
export function formatDuration(ms: number): string {
    if (ms < 0) ms = 0;
    if (ms < 1000) return `${ms}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const remainingSeconds = Math.round(s % 60);
    return `${m}m ${remainingSeconds}s`;
}