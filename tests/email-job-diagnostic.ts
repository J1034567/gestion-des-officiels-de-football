/**
 * Email Job Diagnostic Script
 * Run in browser console or via a test harness after authenticating.
 * Purpose: Ensure mission_orders.email_bulk_v3 path + provider integration works.
 */
import { jobService } from '../services/jobService';

export async function enqueueDiagnosticEmail(recipient: string) {
    if (!recipient.includes('@')) throw new Error('Invalid test recipient email');

    const job = await jobService.enqueueJob({
        type: 'mission_orders.email_bulk_v3',
        label: 'Diagnostic Email Test',
        scope: 'diagnostic',
        meta: {
            recipients: [{ email: recipient, name: 'Diagnostic User' }],
            subject: 'Diagnostic Email Test',
            html: '<h1>Diagnostic Email</h1><p>If you see this, email sending pipeline works.</p>',
            text: 'Diagnostic Email: pipeline operational.',
            attachments: [{
                filename: 'diagnostic.txt',
                content: btoa('Diagnostic attachment content'),
                type: 'text/plain',
                disposition: 'attachment'
            }],
            total: 1
        },
        total: 1,
        priority: 'low'
    });
    console.log('Enqueued diagnostic job', job);
    return job;
}

// Expose helper in browser
if (typeof window !== 'undefined') {
    (window as any).enqueueDiagnosticEmail = enqueueDiagnosticEmail;
    console.log('Helper available: enqueueDiagnosticEmail("you@example.com")');
}
