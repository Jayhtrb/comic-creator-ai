import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "./client";

/**
 * Client-side function middleware: attaches the current Supabase access token
 * as a bearer header so `requireSupabaseAuth` can validate it on the server.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return next();
    return next({ headers: { Authorization: `Bearer ${token}` } });
  },
);
