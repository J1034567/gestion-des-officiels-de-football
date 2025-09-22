// hooks/useMessaging.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useSendBulkMessage() {
    return useMutation({
        mutationFn: async ({ officialIds, subject, message }: { officialIds: string[]; subject: string; message: string; }) => {
            const { data: officials, error: fetchError } = await supabase
                .from('officials')
                .select('email')
                .in('id', officialIds)
                .not('email', 'is', null);

            if (fetchError) throw fetchError;

            const recipients = officials.map(o => o.email).filter(e => e && e.trim() !== '');
            if (recipients.length === 0) {
                throw new Error("No valid email addresses found for the selected officials.");
            }

            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to: recipients,
                    subject: subject,
                    text: message,
                    html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
                },
            });

            if (error) throw error;
            return { ...data, recipientCount: recipients.length };
        },
    });
}