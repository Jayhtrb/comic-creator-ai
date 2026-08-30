# Comic Crafter AI — credentials & deployment setup

## 1. Supabase (your own account)

1. Create a project at supabase.com (a new one is cleanest; an existing one works if it's empty of conflicting tables).
2. In Lovable: **Settings → Connectors → Supabase → Connect**, then pick that project. Lovable wires the client and env vars for you — you don't paste keys into code.
3. Env vars used by the app (set automatically by the connector):
   - Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key)
   - Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - The service-role key is server-only. Never expose it with a `VITE_` prefix.
4. Run `docs/supabase-schema.sql` in the Supabase SQL Editor.
5. Auth → Providers: enable **Email** and **Google** (add your Google OAuth client id/secret; redirect URL is shown in that panel).

## 2. Gemini API key

Add it in Lovable: **Project Settings → Secrets → Add secret** (or ask me and I'll open the secure form).
- Name: `GEMINI_API_KEY`
- It becomes an env var readable only inside server code (`process.env.GEMINI_API_KEY`), never in the browser.

Models:
- Script/panel breakdown: `gemini-2.5-flash` (fast) or `gemini-2.5-pro` (better structure).
- Panel images: `gemini-3-pro-image-preview` (Nano Banana Pro) — the current image model that accepts multiple reference images, which is what gives character consistency. `gemini-2.0-flash-exp-image-generation` is the older, weaker one; `1.5-pro-vision` reads images but cannot generate them.
- If image quality falls short, the best swap for comics is **Replicate** (SDXL / Flux with IP-Adapter for character identity). DALL·E 3 has no reference-image conditioning, so consistency is much harder there.

## 3. GitHub

Lovable pushes for you — no local git needed:
**GitHub button (top-right) → Connect to GitHub → authorize → Create repository** (name it `comic-crafter-ai`).
After that every Lovable change is committed automatically; local clones push back and sync in.

Branching: `main` as the deployed branch, feature branches for experiments. A long-lived `dev` branch adds merge overhead for a solo project.

## 4. Deployment

This app is **TanStack Start** (SSR, server functions), not a static Vite SPA — Lovable's own Publish button hosts it with the server runtime already configured, which is the path I recommend.

If you still want Vercel, the repo needs the Vercel Nitro preset instead of the Cloudflare one, and `vercel.json` is minimal:

```json
{
  "framework": null,
  "buildCommand": "npm run build",
  "outputDirectory": ".output/public",
  "installCommand": "npm install"
}
```

Vercel env vars to set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.

## 5. Architecture note

Your diagram is right except for one layer: on this stack there are **no Supabase Edge Functions**. The equivalent is TanStack `createServerFn` / server routes running on the app's own server runtime — same security properties (keys stay server-side), fewer moving parts and no CORS.

```
React UI  ->  TanStack server functions  ->  Gemini (script + panel images)
                      |                        |
                      +--> Supabase (auth, Postgres, Storage)
```
