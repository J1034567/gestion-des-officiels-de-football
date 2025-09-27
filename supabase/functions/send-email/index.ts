// supabase/functions/send-email/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- CONFIGURATION & CONSTANTS ---
const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- TYPESCRIPT INTERFACES ---
interface Attachment {
    content: string;
    filename: string;
    type?: string;
    disposition?: 'attachment' | 'inline';
    content_id?: string;
}

interface EmailPayload {
    to: string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: Attachment[];
}

interface SendGridAttachment {
    content: string;
    filename: string;
    type: string;
    disposition: 'attachment' | 'inline';
    content_id?: string;
}

// --- UTILITY FUNCTIONS (NOW WITH TYPES) ---
const log = {
    info: (reqId: string, msg: string, data?: object) => console.log(`[${reqId}] INFO: ${msg}`, data ? JSON.stringify(data) : ''),
    error: (reqId: string, msg: string, err?: unknown) => console.error(`[${reqId}] ERROR: ${msg}`, err),
};

function isValidBase64(str: string): boolean {
    try {
        const base64 = str.replace(/^data:.*;base64,/, '');
        const regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!regex.test(base64)) return false;
        atob(base64); // Use Deno's native atob
        return true;
    } catch {
        return false;
    }
}

function getBase64Size(base64String: string): number {
    const base64 = base64String.replace(/^data:.*;base64,/, '');
    return Math.ceil(base64.length * 0.75);
}

function validateAttachments(attachments: Attachment[], reqId: string): { valid: boolean; processed: SendGridAttachment[]; errors: string[] } {
    const errors: string[] = [];
    const processed: SendGridAttachment[] = [];
    let totalSize = 0;

    for (const [i, attachment] of attachments.entries()) {
        if (!attachment.content || !attachment.filename) {
            errors.push(`Attachment #${i + 1}: Missing 'content' or 'filename'.`);
            continue;
        }
        if (!isValidBase64(attachment.content)) {
            errors.push(`Attachment "${attachment.filename}": Invalid Base64 content.`);
            continue;
        }
        const size = getBase64Size(attachment.content);
        if (size > MAX_ATTACHMENT_SIZE) {
            errors.push(`Attachment "${attachment.filename}" exceeds 25MB size limit.`);
            continue;
        }
        totalSize += size;
        processed.push({
            content: attachment.content.replace(/^data:.*;base64,/, ''),
            filename: attachment.filename,
            type: attachment.type || 'application/octet-stream',
            disposition: attachment.disposition || 'attachment',
            ...(attachment.content_id && { content_id: attachment.content_id }),
        });
    }

    if (totalSize > MAX_TOTAL_SIZE) {
        errors.push(`Total attachment size exceeds 30MB limit.`);
    }

    return { valid: errors.length === 0, processed, errors };
}


// --- MAIN SERVER LOGIC ---
serve(async (req: Request) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    log.info(requestId, 'New request received', { method: req.method });

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const sendError = (message: string, status: number, details?: object) => {
        log.error(requestId, message, details || {});
        return new Response(JSON.stringify({ error: message, requestId, ...details }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    };

    try {
        if (req.method !== 'POST') {
            return sendError('Method Not Allowed', 405);
        }

        // --- Authentication ---
        const authHeader = req.headers.get('Authorization');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        let isAuthenticated = false;

        if (authHeader) {
            if (`Bearer ${serviceRoleKey}` === authHeader) {
                isAuthenticated = true;
                log.info(requestId, 'Authenticated via Service Role Key.');
            } else {
                const supabaseClient = createClient(
                    Deno.env.get('SUPABASE_URL')!,
                    Deno.env.get('SUPABASE_ANON_KEY')!,
                    { global: { headers: { Authorization: authHeader } } }
                );
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    isAuthenticated = true;
                    log.info(requestId, 'Authenticated as user', { userId: user.id });
                }
            }
        }

        if (!isAuthenticated) {
            return sendError('Authentication required: Invalid JWT or Service Key.', 401);
        }

        // --- Payload Validation ---
        const payload: EmailPayload = await req.json();
        const { to, subject, html, text, attachments } = payload;

        if (!to || !Array.isArray(to) || to.length === 0) {
            return sendError('Invalid payload: "to" must be a non-empty array.', 400);
        }
        if (!subject || !html) {
            return sendError('Invalid payload: "subject" and "html" are required.', 400);
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = to.filter(email => !emailRegex.test(email));
        if (invalidEmails.length > 0) {
            return sendError('Invalid email addresses provided.', 400, { invalidEmails });
        }

        // --- Attachment Processing ---
        let processedAttachments: SendGridAttachment[] = [];
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            const validationResult = validateAttachments(attachments, requestId);
            if (!validationResult.valid) {
                return sendError('Attachment validation failed.', 400, { details: validationResult.errors });
            }
            processedAttachments = validationResult.processed;
        }

        // --- SendGrid API Call ---
        const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
        if (!sendgridApiKey) {
            return sendError('Email service is not configured on the server.', 500);
        }

        const emailData = {
            personalizations: [{ to: to.map(email => ({ email })) }],
            from: { email: 'lirf@washlib.com', name: 'رابطة ما بين الجهات لكرة القدم' },
            subject: subject,
            content: [
                { type: 'text/plain', value: text || html.replace(/<[^>]*>?/gm, '') },
                { type: 'text/html', value: html },
            ],
            ...(processedAttachments.length > 0 && { attachments: processedAttachments }),
        };

        const response = await fetch(SENDGRID_API, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sendgridApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return sendError('Failed to send email via provider.', response.status, { providerError: errorBody });
        }

        // --- Success ---
        log.info(requestId, 'Email sent successfully', { recipientCount: to.length });
        return new Response(JSON.stringify({ success: true, requestId }), {
            status: 202, // 202 Accepted is more appropriate as sending is async
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return sendError('An unexpected error occurred.', 500, { details: error.message });
    }
});