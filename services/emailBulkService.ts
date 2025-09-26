import { supabase } from '../lib/supabaseClient';
import { JobRecord } from '../hooks/useJobCenter';

export interface BulkEmailRecipient {
    id?: string | number;
    email: string;
    name?: string;
}

export interface EnqueueEmailBulkOptions {
    template?: string;
    dedupe?: boolean; // default true
    registerJob?: (job: Partial<JobRecord>) => void; // optional injection from JobCenter
}

export interface EnqueueEmailBulkResult {
    jobId: string;
    reused: boolean;
    status: string;
    progress?: number;
    artifactPath?: string | null;
}

export async function enqueueBulkEmails(
    recipients: BulkEmailRecipient[],
    opts: EnqueueEmailBulkOptions = {}
): Promise<EnqueueEmailBulkResult> {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('At least one recipient required');
    }
    const { template = 'default', dedupe = true } = opts;
    const { data, error } = await supabase.functions.invoke('enqueue-email-bulk', {
        body: { recipients, template, dedupe }
    });
    if (error) throw error;
    if (!data?.jobId) throw new Error('Invalid response from enqueue-email-bulk');

    // Optionally register a placeholder job locally so UI shows immediately
    if (opts.registerJob) {
        opts.registerJob({
            id: data.jobId,
            type: 'emails' as any,
            label: `Envoi emails (${recipients.length})`,
            status: (data.status === 'running' ? 'processing' : data.status) as any,
            progress: data.progress,
            artifactPath: data.artifactPath,
            meta: { template, reused: data.reused, count: recipients.length }
        });
    }

    return data as EnqueueEmailBulkResult;
}
