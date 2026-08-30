import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (publishable key, RLS applies).
 *
 * Publishable values — safe to ship to the browser. They come from `.env`
 * (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), never from the
 * secret store, because Vite inlines them at build time.
 */
const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env",
  );
}

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // localStorage does not exist during SSR — only touch it in the browser.
    storage: isBrowser ? window.localStorage : undefined,
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});
