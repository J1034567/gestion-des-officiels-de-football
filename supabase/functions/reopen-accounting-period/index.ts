// supabase/functions/reopen-accounting-period/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAuthenticatedSupabaseClient(req: Request) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return { supabaseClient, user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabaseClient, user } = await getAuthenticatedSupabaseClient(req);
    const { type, periodId } = await req.json();

    if (!type || !periodId) {
        return new Response(JSON.stringify({ error: 'Type et ID de période requis.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (type === 'daily') {
      const { data: periodToReopen, error: periodFetchError } = await supabaseClient.from('accounting_periods').select('period_date').eq('id', periodId).single();
      if (periodFetchError) throw periodFetchError;

      const month = periodToReopen.period_date.substring(0, 7);
      const { data: monthlyPeriod, error: monthlyCheckError } = await supabaseClient.from('accounting_periods').select('id, status').eq('type', 'monthly').like('period_date', `${month}%`).maybeSingle();
      if (monthlyCheckError) throw monthlyCheckError;
      if (monthlyPeriod && monthlyPeriod.status === 'closed') {
        return new Response(JSON.stringify({ error: "Impossible de réouvrir une journée si le mois correspondant est déjà clôturé." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error: matchError } = await supabaseClient.from('matches')
        .update({ accounting_status: 'validated', accounting_period_id: null, updated_by: user.id })
        .eq('accounting_period_id', periodId);
      
      if (matchError) throw matchError;
        
      const { error: periodDeleteError } = await supabaseClient.from('accounting_periods').delete().eq('id', periodId);
      if (periodDeleteError) throw periodDeleteError;

      return new Response(JSON.stringify({ success: true, message: 'Journée réouverte.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (type === 'monthly') {
      const { error } = await supabaseClient.from('accounting_periods').delete().eq('id', periodId);
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true, message: 'Mois réouvert.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ error: 'Type de réouverture invalide.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
