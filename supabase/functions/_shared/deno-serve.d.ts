// Minimal ambient module declaration so TypeScript (Node tooling) accepts remote Deno std import used by Supabase Edge Functions.
// This avoids local "Cannot find module" errors while keeping runtime behavior intact on the Deno edge.
// If you upgrade the std version, adjust the module specifier below.
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
    export function serve(
        handler: (req: Request) => Response | Promise<Response>,
        opts?: { port?: number }
    ): void;
}
