// supabase/functions/close-accounting-period/index.ts

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
    const { type, periodIdentifier } = await req.json();

    if (type === 'monthly') {
        const { month } = periodIdentifier; // YYYY-MM
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return new Response(JSON.stringify({ error: "Mois invalide pour la clôture." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const startDate = `${month}-01`;
        const nextMonthDate = new Date(startDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const endDate = nextMonthDate.toISOString().split('T')[0];

        const { data: matchesInMonth, error: matchesFetchError } = await supabaseClient.from('matches')
            .select('id, accounting_status, status')
            .gte('match_date', startDate)
            .lt('match_date', endDate)
            .neq('status', 'cancelled');
        
        if (matchesFetchError) throw matchesFetchError;
        
        if (matchesInMonth.length === 0) {
             return new Response(JSON.stringify({ error: "Aucun match trouvé pour ce mois." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const allMatchesClosed = matchesInMonth.every(m => m.accounting_status === 'closed');
        if (!allMatchesClosed) {
            return new Response(JSON.stringify({ error: "Tous les matchs du mois doivent être dans un état clôturé avant de pouvoir fermer le mois." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: period, error: periodError } = await supabaseClient.from('accounting_periods').insert({
            type: 'monthly',
            period_date: `${month}-01`,
            status: 'closed',
            closed_by: user.id,
            closed_at: new Date().toISOString(),
        }).select().single();

        if (periodError) throw periodError;

        return new Response(JSON.stringify({ success: true, message: 'Mois clôturé.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Type de clôture invalide.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})