import { createMiddleware } from "@tanstack/react-start";

/**
 * Server-function middleware that requires a signed-in Supabase user.
 *
 * Reads the bearer token attached by the client-side function middleware,
 * validates it against Supabase Auth, and injects a user-scoped client
 * (RLS applies as that user) into the handler context:
 *
 *   export const getMyComics = createServerFn({ method: "GET" })
 *     .middleware([requireSupabaseAuth])
 *     .handler(async ({ context }) =>
 *       context.supabase.from("comics").select("*").eq("owner_id", context.userId),
 *     );
 *
 * The clients.server import stays inside the handler so this module remains
 * importable from client-reachable .functions.ts files.
 */
export const requireSupabaseAuth = createMiddleware().server(async ({ next, request }) => {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const { createUserClient } = await import("./clients.server");
  const supabase = createUserClient(token);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

  return next({
    context: { supabase, user: data.user, userId: data.user.id },
  });
});
