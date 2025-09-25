// Scaffold for future Edge Function / server-driven export job flow.
// This does not execute heavy work client-side; it coordinates with a backend table export_jobs.
// Table schema suggestion (Postgres):
// id uuid PK, kind text, params jsonb, status text, file_path text, error_message text, created_at, updated_at
// Status lifecycle: pending -> processing -> ready | error

import { supabase } from '../lib/supabaseClient';

export interface ExportJob {
    id: string;
    kind: string;
    status: 'pending' | 'processing' | 'ready' | 'error';
    file_path: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateExportJobParams {
    kind: string; // e.g. payments_excel, game_day_excel
    params: Record<string, any>;
}

export const createExportJob = async ({ kind, params }: CreateExportJobParams) => {
    const { data, error } = await supabase.from('export_jobs').insert({ kind, params }).select('*').single();
    if (error) throw new Error(error.message);
    return data as ExportJob;
};

export const getExportJob = async (id: string) => {
    const { data, error } = await supabase.from('export_jobs').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as ExportJob;
};

export const pollExportJob = async (id: string, { intervalMs = 1500, timeoutMs = 120000, signal }: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}) => {
    const start = Date.now();
    for (; ;) {
        if (signal?.aborted) throw new Error('Aborted');
        const job = await getExportJob(id);
        if (job.status === 'ready' || job.status === 'error') return job;
        if (Date.now() - start > timeoutMs) throw new Error('Timeout export job');
        await new Promise(r => setTimeout(r, intervalMs));
    }
};

export const downloadExportJobFile = async (job: ExportJob) => {
    if (job.status !== 'ready' || !job.file_path) throw new Error('Job not ready');
    // Assuming file_path is storage path e.g. public/exports/abc.xlsx
    const { data, error } = await supabase.storage.from('exports').createSignedUrl(job.file_path.replace(/^exports\//, ''), 60);
    if (error) throw new Error(error.message);
    const url = data.signedUrl;
    const a = document.createElement('a');
    a.href = url; a.download = job.file_path.split('/').pop() || 'export';
    a.click();
};

// Realtime subscription helper (optional) to push updates instead of polling.
export const subscribeToExportJob = (id: string, onUpdate: (job: ExportJob) => void) => {
    const channel = supabase.channel(`export_job:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'export_jobs', filter: `id=eq.${id}` }, (payload) => {
            if (payload.new) onUpdate(payload.new as ExportJob);
        })
        .subscribe();
    return () => { supabase.removeChannel(channel); };
};
