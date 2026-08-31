# Draggable bubbles + real character reference images

Four connected upgrades: bubbles you can move by hand, reference images that actually
reach the image model, and a persistent character library.

## 1. Drag-and-drop speech bubbles

- Each bubble becomes draggable with a pointer-drag (mouse + touch) inside its panel.
- Position is stored as a percentage of panel width/height, so it stays correct at any
  zoom, on mobile, and in print/PDF export.
- Dragging is clamped to the panel bounds and snaps lightly to the existing safe-corner
  slots, but you can drop a bubble anywhere — manual position wins over auto-snapping.
- A small "reset layout" action per panel restores the auto-placed positions.
- Text editing keeps working: a click edits, a drag moves (distinguished by movement
  threshold, so a click never becomes an accidental drag).
- Manual positions are saved with the comic and restored when you open it from the library.

## 2. Character reference images used for real

Today references are only sent as text notes, so consistency depends on wording alone.

- Uploaded/selected reference images are attached to every panel image request as actual
  image input alongside the prompt, so the model matches the face, outfit and colors.
- Up to 3 characters, 1-3 images each; images are downscaled before sending to keep
  requests fast.
- The style fragment still governs art direction, so a photo reference gets redrawn in
  the chosen comic style rather than pasted in.

## 3. Stronger consistency across panels

- One "cast sheet" (names + verbatim physical descriptions + reference images) is built
  once per generation and reused unchanged for every panel and every redraw.
- A per-comic style seed is fixed at generation time so redraws stay in the same look.

## 4. Saved character library

- Uploads go to your private `character-refs` bucket and a row in the existing
  `characters` table (name, description, reference paths).
- The studio's "Character references" section lists your saved characters (loaded from
  Supabase, not just the demo cast), with add / rename / edit description / delete.
- Selecting a saved character loads its reference images into the current generation.
- Signed URLs are used for display; nothing becomes public.

## Technical notes

- `Bubble` gains explicit `x`/`y` percent coordinates plus a `pinned` flag; `comic-stage`
  gets a pointer-event drag handler and writes back through the existing `onEditBubble`
  path (widened to a generic bubble patch). Bubble coords already exist in the `panels`
  table JSON, so no migration is needed for positions.
- `generatePanelImage` in `src/lib/generate.functions.ts` accepts reference image paths,
  fetches them from storage server-side and sends them as `inlineData` parts to
  `gemini-3.1-flash-image` next to the text prompt.
- New `src/lib/characters.functions.ts` server functions (`listCharacters`,
  `saveCharacter`, `deleteCharacter`, plus a signed-upload helper) against the existing
  `characters` table and `character-refs` bucket — schema already in place, no SQL change.
- `studio-form.tsx` swaps its local-only character state for TanStack Query against those
  functions, keeping the demo cast as a fallback when the library is empty.
