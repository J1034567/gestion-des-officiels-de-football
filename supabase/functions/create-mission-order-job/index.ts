
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return new Response("Unauthorized", {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { orders, fileName } = await req.json();

        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            return new Response("Missing or invalid 'orders' parameter", {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const jobPayload = {
            type: "mission_order_generation",
            payload: { orders, fileName },
            status: "pending",
            created_by: user.id,
            total: orders.length,
        };

        const { data: job, error } = await supabase
            .from("jobs")
            .insert(jobPayload)
            .select()
            .single();

        if (error) {
            console.error("Error creating job:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify(job), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 201,
        });
    } catch (e) {
        console.error("Unexpected error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
