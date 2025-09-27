// supabase/functions/_shared/supabaseClient.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

/**
 * Creates a Supabase client that is aware of the incoming request's
 * authentication headers. This is the correct way to get the current user.
 */
export const createSupabaseClient = (req: Request) => {
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
            // Pass the request headers to the client so it can extract the auth token
            global: { headers: { Authorization: req.headers.get('Authorization')! } }
        }
    );
};
