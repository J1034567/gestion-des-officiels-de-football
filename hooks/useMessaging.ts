// hooks/useMessaging.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { jobService } from '../services/jobService';

export function useSendBulkMessage() {
    return useMutation({
        mutationFn: async ({ officialIds, subject, message }: { officialIds: string[]; subject: string; message: string; }) => {
            const { data: officials, error: fetchError } = await supabase
                .from('officials')
                .select('id, email, name')
                .in('id', officialIds)
                .not('email', 'is', null);

            if (fetchError) throw fetchError;

            const recipients = officials
                .filter(o => o.email && o.email.trim() !== '')
                .map(o => ({ id: o.id, email: o.email, name: o.name }));

            if (recipients.length === 0) {
                throw new Error("No valid email addresses found for the selected officials.");
            }

            // Use the new job-based email system
            const job = await jobService.enqueueJob({
                type: 'mission_orders.email_bulk_v3',
                label: `Bulk Message (${recipients.length} recipients)`,
                scope: 'messaging',
                meta: {
                    recipients,
                    subject,
                    message,
                    total: recipients.length
                },
                total: recipients.length,
                priority: 'normal',
                retry_policy: {
                    max_attempts: 3,
                    backoff_base_ms: 2000,
                    backoff_multiplier: 2,
                    retryable_errors: ['network_error', 'service_unavailable']
                }
            });

            return {
                success: true,
                recipientCount: recipients.length,
                jobId: job.id,
                status: job.status
            };
        },
    });
}