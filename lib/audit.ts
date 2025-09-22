import { supabase } from './supabaseClient';

type AuditPayload = {
    action: string;
    table?: string;
    recordId?: string | null;
    oldValues?: any;
    newValues?: any;
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    userAgent?: string | null;
};

export async function logAudit({
    action,
    table,
    recordId,
    oldValues,
    newValues,
    userId,
    userName,
    userEmail,
    userAgent,
}: AuditPayload) {
    try {
        const payload: any = {
            action,
            table_name: table || null,
            record_id: recordId || null,
            old_values: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
            new_values: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
            user_id: userId || null,
            user_name: userName || null,
            user_email: userEmail || null,
            user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
        };
        await supabase.from('audit_logs').insert(payload);
    } catch (e) {
        // Do not block UI on audit failures
        console.warn('Audit log failed:', e);
    }
}
