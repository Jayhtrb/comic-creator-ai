# UI port bundle for Comic Crafter AI

`docs/UI-SPEC.md` already documents the design system, component tree, character upload,
style selector, panel display, loading states and PDF export. What it does not give you is
copy-paste-ready source. This plan adds a self-contained port bundle: the actual UI files,
verbatim, plus the three sections the spec is missing.

## What gets created

A new folder `docs/ui-port/` holding literal copies of the presentation layer, each with a
short header comment naming its original path and its backend touchpoints:

```text
docs/ui-port/
  README.md                 how to drop these into another app, in order
  styles.css                full design system (tokens, utilities, print block)
  root-head.tsx             font <link> tags + html shell from __root.tsx
  app-header.tsx            logo, Studio / My comics nav, sign out, theme toggle
  studio-form.tsx           story input, character upload + chips, strength slider, style grid
  comic-stage.tsx           page view, panel gallery, bubbles, toolbar (print/export/start over)
  studio-page.tsx           the studio route stripped to UI + prop wiring
  library-page.tsx          saved-comics grid
  auth-page.tsx             sign in / magic link screen
  comic.ts                  ArtStyle catalogue (25 styles), REFERENCE_STRENGTHS, Panel/Bubble types
  ui-primitives.md          the shadcn components used (button, input, textarea, slider, label,
                            sonner) and the exact `bunx shadcn add` command
```

Server-function imports in the copied route files are replaced by clearly marked
`// TODO: point at your own backend` stubs with the same call signatures, so the files
compile in a fresh app without Supabase or Gemini wired up.

## What gets added to docs/UI-SPEC.md

Three new sections, matching the parts of your request the spec doesn't cover yet:

- **Layout structure** — the page frame: sticky header, no sidebar, `max-w-[1200px]`
  centred main, spacing scale, responsive breakpoints, and where the print-hidden
  regions sit. Includes an ASCII wireframe of studio and comic phases.
- **Download / share actions** — the toolbar in `ComicStage`: print-to-PDF button,
  per-panel redraw, reset bubbles, start over, save-to-library, plus the exact
  disabled-state rules and the `data-print-hide` contract.
- **Header and navigation** — nav item list, active/hover styling, the auth-conditional
  Sign in / Sign out swap, and the hydration-safe theme toggle.

## Technical notes

- Documentation only. Nothing under `src/` changes; app behaviour is untouched.
- Copies are byte-faithful to the current source except for the added path header and the
  backend stubs, so they stay traceable.
- `README.md` in the bundle lists dependency versions actually in `package.json`
  (Tailwind v4, lucide-react, sonner, TanStack Query/Router) and the order to port in:
  styles → primitives → comic.ts → header → form → stage → routes.
