import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase clients. The `.server.ts` suffix keeps this module out
 * of client bundles — never import it from components, routes, or hooks.
 *
 * Env vars (server runtime):
 *   SB_URL               — Supabase project URL
 *   SB_PUBLISHABLE_KEY   — anon/publishable key
 *   SB_SERVICE_ROLE_KEY  — service-role/secret key (secret store)
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — Supabase server env is not configured`);
  return value;
}

const statelessAuth = {
  persistSession: false,
  autoRefreshToken: false,
  storage: undefined,
} as const;

/**
 * Service-role client — BYPASSES Row Level Security.
 * Use only for privileged, verified server work (admin jobs, verified
 * webhooks). Never for ordinary user reads, and never let its results decide
 * whether a caller is an admin.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(requireEnv("SB_URL"), requireEnv("SB_SERVICE_ROLE_KEY"), {
    auth: statelessAuth,
  });
}

/**
 * Client that acts as the owner of `accessToken` — RLS applies as that user.
 * This is the default for server functions that read or write user data.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(requireEnv("SB_URL"), requireEnv("SB_PUBLISHABLE_KEY"), {
    auth: statelessAuth,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
