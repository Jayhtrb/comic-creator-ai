# UI spec document for Comic Crafter AI

Create `docs/UI-SPEC.md` — a single, self-contained reference another developer (or Cline)
can read to replicate this app's look and feel exactly. Documentation only: no app code,
styles, or behaviour changes.

## What the document contains

1. **Design system** — the full `src/styles.css` reproduced verbatim: oklch token map,
   `@theme inline` block, light/dark `:root` values with their hex origins
   (cream #F8F6F0, ink #1A1A1E, red #E53E3E, gold #F6AD55, emerald #48BB78), the four
   custom utilities (`field-line`, `paper-page`, `lift-on-hover`, `ink-sweep`,
   `sketch-pulse`) and the print block. Plus the Tailwind v4 caveats: config is CSS-first,
   no `tailwind.config.js`, fonts loaded via `<link>` in the root route head.

2. **Component tree** — the route/component hierarchy from `__root` down to `SpeechBubble`,
   with a note on who owns which state (studio route owns panels, ComicStage is
   presentational, StudioForm emits one `GenerationConfig`).

3. **Character upload** — `readAsDataUrl` + hidden file input + dashed upload tile, the
   5 MB guard, max-3 cast rule, the TanStack Query keys, and the `CharacterRef` shape
   (display URLs vs. storage `refPaths`).

4. **Style selector** — the `ArtStyle` interface, the full 25-entry catalogue as a table
   (id, name, blurb, prompt fragment), and the clickable-card markup with its
   selected/hover treatment.

5. **Panel display** — DOM-overlay approach (no canvas/SVG), the `Bubble` model,
   `bubbleShape` classes per kind, the four `BUBBLE_SLOTS` safe corners and the slot
   assignment rule, and the pointer handler with its 4px click-vs-drag threshold and
   percent clamping.

6. **Loading states** — the three stages (scripting card, segmented inking bar, per-panel
   ink-sweep skeleton), the `pooled` concurrency helper, and the panel `status` union.

7. **PDF export** — `window.print()` plus `data-print-hide` / `page-break-after`, and why
   no jsPDF/html2canvas is used.

8. **Porting checklist** — the minimum set of files and dependencies (tailwindcss v4,
   lucide-react, sonner, shadcn button/input/textarea/slider/label) needed to reproduce
   the UI in another app.

## Technical notes

- New file only: `docs/UI-SPEC.md`. Nothing under `src/` is touched.
- Snippets are copied verbatim from `src/styles.css`, `src/components/comic-stage.tsx`,
  `src/components/studio-form.tsx`, `src/lib/comic.ts` and
  `src/routes/_authenticated/studio.tsx`, each labelled with its source path so the doc
  stays traceable when the code changes.
