import { jobService } from '../services/jobService';
import { JobKinds, JobKind, JobPayloadFor } from '../supabase/functions/_shared/jobKinds';
import { JOB_KIND_META } from './job-kind-meta';
import { useNotificationContext } from '../contexts/NotificationContext';

// Hook wrapper returning a function so it can access notification context cleanly
export function useEnqueueWithUX() {
    const { replaceGroup } = useNotificationContext();

    return async function enqueueWithUX<K extends JobKind>(args: { type: K; payload: JobPayloadFor<K>; label?: string; totalOverride?: number }) {
        const meta = JOB_KIND_META[args.type];
        const label = args.label || meta.fullLabel;

        // Initial grouped toast (will be replaced on lifecycle events)
        const group = `job:pending:${crypto.randomUUID()}`; // temporary group until id known
        const tempId = replaceGroup(group, { message: `${meta.verbPresent}: ${meta.shortLabel}`, type: 'info' });

        const job = await jobService.enqueueJob({
            type: args.type,
            label,
            payload: args.payload,
            total: args.totalOverride || (Array.isArray((args.payload as any)?.orders) ? (args.payload as any).orders.length : undefined)
        });

        // Replace temp group with stable job id group toast (processing will overwrite soon via realtime)
        const stableGroup = `job:${job.id}`;
        replaceGroup(stableGroup, { message: meta.verbProgressive || `${meta.verbPresent}…`, type: 'info' });
        // remove the temp one (group replace already clears previous group entries)

        // Success/Failure toasts will ultimately come from realtime updates; for now an optimistic success is avoided to prevent double messaging.
        return job;
    };
}
