# ComicForge AI — Build Plan

An AI comic studio: story in, styled multi-panel comic pages out, with consistent characters, editable speech bubbles, and PDF export.

## Locked decisions

- Visual identity, palette, and typography exactly as you specified (cream `#F8F6F0`, ink `#1A1A1E`, comic red `#E53E3E`, golden `#F6AD55`, emerald `#48BB78`; Poppins headings / Inter body / Comic Neue bubbles). Light default + dark toggle.
- Generation: **one image per panel**, composed into a page in the app. Panels get real HTML speech bubbles, per-panel regenerate, and preset layouts.
- AI: **your own Gemini API key**, stored as a project secret and used only from server routes (never the browser). `gemini-3-pro-preview` for the script/panel breakdown, `gemini-3-pro-image-preview` for panel images.
- Backend: **your own Supabase account** for auth, storage, and saved data. Lovable Cloud stays off.

## Step 0 — Design mockup first (before any app logic)

You asked to align on visuals first. I'll build a static, clickable high-fidelity mockup of the three key screens using the locked palette/type:

1. **Studio dashboard** — story textarea (bottom-border input style), character reference cards, page-count slider, style grid, big red "Generate Comic".
2. **Style selection** — visual grid of style thumbnails with red selected border and hover zoom.
3. **Comic viewer** — page rendered as physical paper (off-white stock, page-curl shadow), speech bubbles overlaid, per-panel hover zoom, regenerate/download/share actions.

No backend, no API calls at this step — real components with mock data so you can judge the design. You approve or request changes, then I continue.

## Step 1 — Design system + shell

- Tokens in `src/styles.css` (`@theme inline`, oklch) for every locked color, 12px card / 8px button radius, `0 4px 20px rgba(0,0,0,0.06)` card shadow, 1200px max-width container.
- Fonts via `<link>` in the root route head; Lucide icons throughout.
- Dark mode toggle with a mirrored dark token set (ink background, red/gold accents preserved).
- Skeleton "panels being drawn" loaders instead of spinners; comic-strip progress bar during generation.

## Step 2 — Supabase connection + auth

You connect your Supabase account, then:

- Email/password + magic link auth, `/auth` route, protected app routes.
- Tables: `profiles`, `characters`, `comics`, `pages`, `panels`, `prompt_history`. RLS on all of them, owner-scoped via `auth.uid()`, with explicit grants.
- Storage buckets: `character-refs` (private) and `comic-panels` (private, signed URLs).
- Roles, if we later add moderation for the gallery, go in a separate `user_roles` table — never on `profiles`.

## Step 3 — Input & character library

- Story textarea with the cyberpunk-detective placeholder and "Surprise Me!" random prompt+style.
- Upload 1–3 reference images per character; saved to the Character Library for reuse across stories.
- Page slider 1–8, layout preset picker (Automatic, 4-panel classic, 6-panel manga, splash page, storyboard).
- Advanced drawer: seed control, negative notes.

## Step 4 — Generation pipeline

1. Script pass: Gemini text model turns the story into structured JSON — pages, panels, camera angle per panel, image prompt, dialogue lines with speaker.
2. Image pass: one call per panel. Every call carries the character reference images plus the previously generated panels of that page for visual continuity, and the art-style prompt block.
3. Panels stream into the UI as they finish; the page assembles progressively. Rate limits and quota errors surface as clear "queued / retrying" states, not crashes.
4. Panels upload to Supabase storage; rows persist so a reload restores the comic.

## Step 5 — Editor & viewer

- Click any speech bubble to edit text inline; drag to reposition; bubble tail direction control.
- Per-panel regenerate (keeps the rest of the page intact) with an optional prompt tweak.
- Viewer modes: scrollable gallery and single-page view, both on the paper-stock treatment.

## Step 6 — Export

- Download all as a single PDF (client-side, panels + bubbles rendered to canvas per page).
- Download individual pages as PNG.
- Share link (public read-only comic route).

## Deferred to a later round

Community Gallery, Series/Saga mode, voice-to-story, auto-colorize. These each add real data-model and moderation surface; I'd rather land the core studio well first and add them once the pipeline is proven.

## Technical notes

- All Gemini calls live in TanStack server routes (`src/routes/api/…`), streaming where the endpoint supports it, with no artificial request timeouts — panel generation can take tens of seconds.
- `GEMINI_API_KEY` stored as a secret, read inside handlers only.
- UI components stay free of API logic; generation orchestration lives in dedicated client hooks + server route modules.
- Panel images are stored, never re-sent as base64 through the browser beyond the initial reference upload.

## What I need from you

1. Approve this plan.
2. After the mockup step, tell me to proceed.
3. Connect your Supabase account (Settings → Connectors) and add your Gemini API key when I ask for it at Step 2/4.
