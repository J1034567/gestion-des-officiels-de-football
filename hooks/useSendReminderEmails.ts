import { useCallback } from 'react';
import { enqueueBulkEmails, BulkEmailRecipient } from '../services/emailBulkService';
import { useJobCenter } from './useJobCenter';

/**
 * Hook to enqueue a reminder email bulk job using the unified jobs system.
 * Automatically registers the job locally so UI feedback starts immediately.
 */
export function useSendReminderEmails() {
    const { register } = useJobCenter();

    return useCallback(async (recipients: BulkEmailRecipient[]) => {
        const res = await enqueueBulkEmails(recipients, {
            template: 'reminder',
            registerJob: register,
            dedupe: true
        });
        return res.jobId;
    }, [register]);
}
