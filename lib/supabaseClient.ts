import { createClient } from '@supabase/supabase-js';

// IMPORTANT : Remplacez ces valeurs par les détails de votre projet Supabase.
// Vous pouvez les trouver dans les paramètres API de votre projet Supabase.
const supabaseUrl = 'https://tgttliylrnsowfksknfl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndHRsaXlscm5zb3dma3NrbmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3OTk2MDgsImV4cCI6MjA3MTM3NTYwOH0.ZtWVESKOum90EEHi6ZX_X_cdltnrMT5jFGiGMd4n0xQ';


if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("L'URL et la clé anonyme de Supabase doivent être définies dans lib/supabaseClient.ts");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
