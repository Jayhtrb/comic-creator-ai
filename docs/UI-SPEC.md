# Comic Crafter AI — UI/UX specification

A self-contained reference for replicating this app's look and feel in another codebase.
Every snippet is copied verbatim from the source file named above it.

Stack assumptions: React 19, Tailwind CSS **v4** (CSS-first), shadcn/ui (new-york, slate),
lucide-react icons, sonner toasts, TanStack Query + Router.

- [1. Design system](#1-design-system)
- [2. Component tree](#2-component-tree)
- [3. Character upload](#3-character-upload)
- [4. Style selector](#4-style-selector)
- [5. Panel display and speech bubbles](#5-panel-display-and-speech-bubbles)
- [6. Loading and progress states](#6-loading-and-progress-states)
- [7. PDF export](#7-pdf-export)
- [8. Porting checklist](#8-porting-checklist)

---

## 1. Design system

### Tailwind v4 caveats (read first)

- **There is no `tailwind.config.js`.** All theme configuration lives in `src/styles.css`.
  Creating a JS config has no effect.
- The entry is a single `@import "tailwindcss";` — the v3 `@tailwind base/components/utilities`
  directives emit nothing.
- Custom utilities use `@utility name { ... }`, **not** `@layer utilities`.
- shadcn tokens require `@theme inline` so `var()` indirection resolves.
- **Never `@import` a font URL in CSS.** Lightning CSS resolves `@import` from the
  filesystem, so a remote import breaks the build. Fonts load via `<link>` in the root
  route head (see below).

### Palette origins

| Role | Hex | oklch token |
|---|---|---|
| Background (cream) | `#F8F6F0` | `--background: oklch(0.973 0.0082 91.48)` |
| Ink / foreground | `#1A1A1E` | `--ink: oklch(0.2195 0.0077 285.74)` |
| Primary (comic red) | `#E53E3E` | `--primary: oklch(0.6137 0.2039 25.56)` |
| Gold (captions) | `#F6AD55` | `--gold: oklch(0.8012 0.1343 68.79)` |
| Emerald (success) | `#48BB78` | `--success: oklch(0.7096 0.1434 154.53)` |
| Paper (page stock) | warm cream | `--paper: oklch(0.9822 0.0232 90.75)` |

Typography: **Poppins** headings (`--font-display`), **Inter** body (`--font-sans`),
**Comic Neue** speech bubbles (`--font-comic`).

### Font loading — `src/routes/__root.tsx`

```tsx
links: [
  { rel: "stylesheet", href: appCss },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Inter:wght@400;500;600&family=Comic+Neue:ital,wght@0,400;0,700;1,400&display=swap",
  },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
]
```

The root component also mounts the toaster once: `<Toaster position="top-center" />`.

### The five custom utilities

| Utility | Purpose |
|---|---|
| `field-line` | Bottom-border-only inputs; border turns primary on focus, no ring |
| `paper-page` | Warm page stock, page-drop shadow, and a 46px `::after` corner curl |
| `lift-on-hover` | `translateY(-2px) scale(1.01)` + `--shadow-lift` |
| `ink-sweep` | Shimmering gradient sweep used by the panel skeleton |
| `sketch-pulse` | Pencil icon wobble inside the skeleton |

### `src/styles.css` — verbatim

```css
<!--STYLES-->
```

---

## 2. Component tree

```text
__root.tsx  (fonts, HeadContent, QueryClientProvider, <Toaster position="top-center" />)
├─ /                      index.tsx            marketing landing
├─ /auth                  auth.tsx             email+password / magic link
└─ /_authenticated        route.tsx            session gate → redirect /auth
   ├─ /studio             studio.tsx           orchestrator: phase "studio" | "comic"
   │   ├─ AppHeader                            nav + theme toggle + account menu
   │   ├─ StudioForm                           four numbered Cards
   │   │   ├─ SectionHeading (icon, step, title, hint)
   │   │   ├─ Card 1  Your story        Textarea.field-line + "Surprise Me!"
   │   │   ├─ Card 2  Character refs    character grid + upload tile
   │   │   │            ├─ reference match strength Slider (1–5)
   │   │   │            └─ named reference sets (save / apply / update / delete)
   │   │   ├─ Card 3  Art style         25 thumbnail cards
   │   │   ├─ Card 4  Pages & layout    pages Slider + layout cards + Advanced (seed)
   │   │   └─ Generate Comic CTA
   │   └─ ComicStage                    title bar, Gallery/Page toggle, Share, Download PDF
   │       ├─ scripting card | inking progress bar
   │       ├─ <article className="paper-page">   one per page
   │       │   └─ PanelView (grid class chosen by layout)
   │       │       ├─ <img> | PanelSkeleton
   │       │       ├─ SpeechBubble ×n            drag + inline edit
   │       │       └─ figcaption toolbar         reset layout / redraw / download
   │       └─ page nav + "Edit prompt / start a new comic"
   └─ /library            library.tsx           saved comics
```

### State ownership

- **`studio.tsx`** owns `panels[]`, `title`, `config`, and every mutation:
  `updatePanel`, `patchBubble`, `resetBubbles`, `regenerate`, `handleSave`.
- **`ComicStage`** is purely presentational. Props:
  `title, style, layout, panels, scripting, onPatchBubble, onResetBubbles, onRegenerate, onStartOver`.
- **`StudioForm`** owns only form state and emits one object on submit:

```ts
export interface GenerationConfig {
  story: string;
  style: ArtStyleId;
  layout: LayoutId;
  pages: number;
  characterIds: string[];
  /** Name + physical description of each selected cast member, for consistency. */
  characters: { name: string; note: string }[];
  /** Storage paths of the selected cast's saved reference art. */
  refPaths: string[];
  /** 1 (loose inspiration) → 5 (locked likeness). */
  refStrength: number;
  seed: string;
}
```

### Shared shells inside `StudioForm`

```tsx
function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section
      id={id}
      className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7"
    >
      {children}
    </section>
  );
}

function SectionHeading({ icon: Icon, step, title, hint }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="text-base font-semibold">
          <span className="mr-2 text-sm font-medium text-primary">{step}</span>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
```

---

## 3. Character upload

### Data model — `src/lib/comic.ts`

```ts
export interface CharacterRef {
  id: string;
  name: string;
  note: string;
  /** Displayable image URLs (signed for saved characters). */
  images: string[];
  /** Storage paths in the private `character-refs` bucket, for saved characters. */
  refPaths?: string[];
  /** True when this character lives in the user's Supabase library. */
  saved?: boolean;
}

/** A named, reusable group of saved characters ("The Kestrel crew"). */
export interface CharacterSet {
  id: string;
  name: string;
  characterIds: string[];
}
```

Two distinct fields matter: `images` are **display URLs** (signed, short-lived, or bundled
demo assets) and `refPaths` are **storage paths** — only paths are sent to the image model,
which fetches and inlines the bytes server-side.

### Query wiring

```tsx
const saved = useQuery({ queryKey: ["characters"],     queryFn: () => fetchCharacters() });
const sets  = useQuery({ queryKey: ["character-sets"], queryFn: () => fetchSets() });

const savedCharacters: CharacterRef[] = (saved.data ?? []).map((c) => ({ ...c, saved: true }));
const characters: CharacterRef[] = [...savedCharacters, ...DEMO_CHARACTERS];
```

Saved library entries come first; the bundled demo cast is the always-available fallback.
Mutations invalidate `["characters"]` / `["character-sets"]` and surface failures via `toast.error`.

### Upload flow — `src/components/studio-form.tsx`

```tsx
function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

async function handleUpload(files: FileList | null) {
  if (!files?.length) return;
  const file = files[0]!;
  if (file.size > 5_000_000) {
    toast.error("Reference images need to be under 5 MB.");
    return;
  }
  setUploading(true);
  try {
    const dataUrl = await readAsDataUrl(file);
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "New character";
    const { id } = await saveMutation.mutateAsync({
      name,
      note: "Uploaded reference",
      images: [dataUrl],
    });
    setSelected((prev) => (prev.length >= 3 ? prev : [...prev, id]));
    setEditing(id);                              // jump straight into inline rename
    setDraft({ name, note: "Uploaded reference" });
    toast.success("Saved to your Character Library");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Upload failed.");
  } finally {
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }
}
```

Rules encoded here: **5 MB cap**, **max 3 selected characters**, filename becomes the initial
name, and the image never touches the client bundle — it goes straight to the private bucket.

### Selection rule

```ts
function toggleCharacter(id: string) {
  setSelected((prev) =>
    prev.includes(id) ? prev.filter((c) => c !== id) : prev.length >= 3 ? prev : [...prev, id],
  );
}
```

### Upload tile + hidden input

```tsx
<button
  type="button"
  disabled={uploading}
  onClick={() => fileInput.current?.click()}
  className="flex aspect-square min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
>
  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
  <span className="text-sm font-medium">{uploading ? "Saving…" : "Upload reference"}</span>
</button>
<input
  ref={fileInput}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={(e) => handleUpload(e.target.files)}
/>
```

### Character card

Square thumbnail, primary border when selected, a filled heart badge top-right, a "Saved"
pill top-left for library entries, and hover-revealed Edit/Delete icon buttons.

```tsx
<div className={cn(
  "group relative overflow-hidden rounded-xl border-2 bg-card text-left transition-all",
  isOn ? "border-primary shadow-[var(--shadow-card)]" : "border-border hover:border-input",
)}>
  <button type="button" onClick={() => toggleCharacter(char.id)} aria-pressed={isOn} className="block w-full">
    <div className="relative aspect-square overflow-hidden bg-muted">
      <img src={char.images[0]} alt={char.name} loading="lazy"
           className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
      {isOn && (
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Heart className="size-3.5 fill-current" />
        </span>
      )}
      {char.saved && (
        <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-paper">
          Saved
        </span>
      )}
    </div>
  </button>
  {/* inline name Input + note Textarea when editing, else name + truncated note */}
</div>
```

### Reference match strength

A 1–5 slider whose preset injects a prompt fragment into every image request.

| Value | Label | Hint |
|---|---|---|
| 1 | Loose | Inspiration only — the art style leads |
| 2 | Guided | Keeps the broad look |
| 3 | Balanced | Recognisable, fully restyled (default) |
| 4 | Strong | Faithful likeness |
| 5 | Locked | Maximum likeness |

```tsx
<div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
  <div className="flex flex-wrap items-baseline justify-between gap-2">
    <p className="text-sm font-medium">Reference match strength</p>
    <p className="text-xs text-muted-foreground">{strengthPreset.label} — {strengthPreset.hint}</p>
  </div>
  <Slider value={[refStrength]} min={1} max={5} step={1}
          onValueChange={([v]) => setRefStrength(v ?? 3)} className="mt-4"
          aria-label="Reference match strength" />
  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
    {REFERENCE_STRENGTHS.map((s) => <span key={s.value}>{s.label}</span>)}
  </div>
</div>
```

### Named reference sets

Pills below the slider: click the label to apply the set, the trash icon to delete it.
Applying filters out characters that no longer exist and caps at three.

```ts
function applySet(id: string, ids: string[]) {
  const usable = ids.filter((cid) => characters.some((c) => c.id === cid)).slice(0, 3);
  setActiveSet(id);
  setSelected(usable);
  if (!usable.length) toast("That set's characters are no longer in your library.");
}
```

---

## 4. Style selector

**Clickable image cards, not a dropdown.** 25 styles, each with a 512×512 generated thumbnail.

### Data structure — `src/lib/comic.ts`

```ts
export interface ArtStyle {
  id: ArtStyleId;
  name: string;
  blurb: string;
  thumb: string;          // imported jpg
  /** Prompt fragment appended to every panel request for this style. */
  promptFragment: string;
}
```

### The catalogue

| id | name | blurb | promptFragment |
|---|---|---|---|
| `manga` | Manga | Black & white, dynamic lines | black and white manga art, sharp inked linework, screentone shading, dynamic speed lines |
| `western` | Western Comic | Vibrant superhero energy | classic western superhero comic art, vibrant primary colors, bold ink outlines, halftone dots |
| `cyberpunk` | Cyberpunk | Neon-drenched, high contrast | cyberpunk comic art, neon magenta and cyan lighting, rain-slicked reflections, high contrast |
| `noir` | Noir | Gritty, shadow-heavy | film noir comic art, extreme high contrast black and white, deep shadows, ink wash |
| `watercolor` | Watercolor | Soft, ethereal, artistic | watercolor illustration, soft bleeding washes, delicate pigment edges, textured paper |
| `chibi` | Chibi / Cute | Big heads, tiny bodies | chibi cartoon art, oversized head and eyes, tiny rounded body, bright pastel colors |
| `ghibli` | Ghibli Style | Warm, whimsical, detailed | warm whimsical hand-painted anime film art, detailed painted skies, nostalgic soft light |
| `graphic-novel` | Graphic Novel | Mature, flat, stylized | mature graphic novel art, flat muted color, hard-edged stylized shadows, restrained palette |
| `pixel` | Pixel Art | Retro 16-bit | 16-bit pixel art, chunky pixels, limited retro palette, crisp pixel grid |
| `cgi` | 3D / CGI | Pixar-like rendered look | stylized 3D CGI render, glossy surfaces, cinematic soft lighting, shallow depth of field |
| `webtoon` | Korean Webtoon | Clean lines, gradients | korean webtoon art, clean thin linework, smooth gradient coloring, glossy digital rendering |
| `retro` | Retro Print | 1950s four-color print | vintage 1950s comic print, faded four-color offset, visible halftone dots, aged newsprint |
| `indie-ink` | Indie Ink | Scratchy underground comix | gritty independent underground comix art, scratchy hand-inked crosshatching, rough organic linework, limited two-tone spot color |
| `newspaper` | Newspaper Strip | Sunday funnies charm | classic Sunday newspaper comic strip art, simple bouncy cartoon linework, flat cheerful primary colors, coarse newsprint dot texture |
| `art-deco` | Art Deco Poster | Geometric, gold & teal | art deco poster illustration, bold geometric shapes, strong symmetry, gold cream and deep teal palette, stylized sunburst rays |
| `pencil` | Pencil Sketch | Raw graphite roughs | raw graphite pencil sketchbook drawing, visible construction lines, smudged hatching, off-white paper tone, no color |
| `steampunk` | Steampunk | Brass, gears, airships | steampunk illustration, brass gears goggles and airships, warm sepia and copper palette, finely etched victorian linework |
| `gothic-horror` | Gothic Horror | Fog, ink and dread | gothic horror comic art, heavy black ink, sickly green and blood red accents, creeping fog, unsettling deep shadows |
| `pop-art` | Pop Art | Ben-Day dots, 1960s punch | 1960s pop art comic panel, thick black outlines, oversized Ben-Day dots, flat red yellow and blue, bold graphic drama |
| `flat-vector` | Flat Vector | Clean modern shapes | modern flat vector illustration, clean geometric shapes with no outlines, bold coral and navy palette, crisp minimal detail |
| `dark-romantic` | Dark Cinematic Romantic Realism | Moody, painterly, intimate | dark cinematic romantic realism, painterly photoreal rendering, warm rim light against deep shadow, filmic colour grade, intimate emotive expressions, shallow depth of field |
| `graphic-noir` | Graphic Novel Noir | Flat shapes, heavy black | graphic novel noir art, flat stylised shapes, huge fields of solid black, desaturated muted palette with one cold accent, stark negative space |
| `seinen-noir` | Seinen Noir | Adult manga grit | gritty seinen manga noir, realistic adult proportions, dense fine crosshatching and screentone, harsh contrast black and white, weary cinematic staging |
| `pulp` | Pulp Magazine | Lurid 1940s gouache | 1940s pulp magazine cover painting, lurid saturated gouache, dramatic melodramatic staging, hard directional light, aged paper texture |
| `gonzo` | Gonzo Illustrator | Splattered ink caricature | gonzo illustration, frantic splattered ink and violent brush strokes, warped exaggerated caricature anatomy, garish accent colours on raw white paper |

### Card markup

```tsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
  {ART_STYLES.map((s) => {
    const isOn = s.id === style;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setStyle(s.id)}
        aria-pressed={isOn}
        className={cn(
          "group overflow-hidden rounded-xl border-2 text-left transition-all",
          isOn ? "border-primary shadow-[var(--shadow-card)]" : "border-border hover:border-input",
        )}
      >
        <div className="aspect-square overflow-hidden bg-muted">
          <img src={s.thumb} alt={`${s.name} art style example`} loading="lazy"
               width={512} height={512}
               className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
        <div className="p-3">
          <p className="text-sm font-medium">{s.name}</p>
          <p className="truncate text-xs text-muted-foreground">{s.blurb}</p>
        </div>
      </button>
    );
  })}
</div>
```

The selected style's name and blurb are echoed live in the section heading hint:
`hint={`Selected: ${activeStyle.name} — ${activeStyle.blurb}`}`.

### Layout presets (same pattern, text-only cards)

```ts
export type LayoutId = "auto" | "classic-4" | "manga-6" | "splash" | "storyboard";

export const LAYOUTS: LayoutPreset[] = [
  { id: "auto",       name: "Automatic",      description: "Let the AI pace the page",       panelsPerPage: 4 },
  { id: "classic-4",  name: "4-panel classic",description: "Two even rows",                  panelsPerPage: 4 },
  { id: "manga-6",    name: "6-panel manga",  description: "Tight, fast cutting",            panelsPerPage: 6 },
  { id: "splash",     name: "Splash page",    description: "One full-bleed hero panel",      panelsPerPage: 1 },
  { id: "storyboard", name: "Storyboard",     description: "Uniform grid with notes",        panelsPerPage: 6 },
];
```

Selected layout card: `border-primary bg-accent/60`.

---

## 5. Panel display and speech bubbles

**Approach: absolutely positioned DOM overlay.** No canvas, no SVG.
The art is a plain `<img>` inside a `position: relative` figure; each bubble is an
absolutely positioned `<button>` using **percent** coordinates, so placement survives
responsive resizing, zoom, mobile, and print. Because bubbles stay real DOM text, printing
produces crisp vector type rather than a rasterised screenshot.

### Model — `src/lib/comic.ts`

```ts
export interface Bubble {
  id: string;
  speaker: string;
  text: string;
  /** Percentage position within the panel (centre point when `pinned`). */
  x: number;
  y: number;
  kind: "speech" | "thought" | "caption";
  /** True once the reader has dragged this bubble — manual position wins. */
  pinned?: boolean | undefined;
}

export type PanelStatus = "queued" | "drawing" | "ready" | "failed";

export interface Panel {
  id: string;
  page: number;
  index: number;
  camera: string;
  prompt: string;
  /** Displayable URL (signed) for the rendered panel art. */
  image?: string | undefined;
  /** Storage path of the art in the private `comic-panels` bucket. */
  imagePath?: string | undefined;
  status: PanelStatus;
  bubbles: Bubble[];
}
```

### Bubble skins by kind

```ts
function bubbleShape(kind: Bubble["kind"]) {
  if (kind === "caption") {
    return "rounded-sm bg-gold text-gold-foreground font-display text-[11px] font-bold uppercase tracking-wide";
  }
  if (kind === "thought") {
    return "rounded-[999px] bg-paper text-paper-foreground font-comic text-[13px] italic";
  }
  return "rounded-2xl bg-paper text-paper-foreground font-comic text-[13px] font-bold";
}
```

Common chrome on every bubble: `border-2 border-ink`, hard offset shadow
`shadow-[2px_2px_0_var(--color-ink)]`, `max-w-[38%]`, `touch-none`, `cursor-grab`.

### Safe-corner auto placement

The model's raw `x`/`y` is treated only as a **left/right intent hint**; bubbles snap to four
safe edge slots so faces and the central action band are never covered.

```ts
const BUBBLE_SLOTS: Array<React.CSSProperties> = [
  { top: "4%", left: "4%" },
  { top: "4%", right: "4%" },
  { bottom: "6%", left: "4%" },
  { bottom: "6%", right: "4%" },
];

function bubbleSlots(bubbles: Bubble[]): Array<{ bubble: Bubble; slot: React.CSSProperties }> {
  const captions = bubbles.filter((b) => b.kind === "caption");
  const rest = bubbles.filter((b) => b.kind !== "caption");
  let cursor = 0;
  const out: Array<{ bubble: Bubble; slot: React.CSSProperties }> = [];

  // Captions read first, pinned to the top-left corner.
  captions.forEach((bubble) => {
    out.push({ bubble, slot: BUBBLE_SLOTS[cursor % BUBBLE_SLOTS.length]! });
    cursor++;
  });
  // Dialogue keeps the original left/right intent from the script when possible.
  rest.forEach((bubble) => {
    const prefersRight = bubble.x >= 50;
    const candidates = BUBBLE_SLOTS.map((s, i) => ({ s, i })).filter(
      ({ s, i }) => i >= cursor && (prefersRight ? "right" in s : "left" in s),
    );
    const pick = candidates[0]?.i ?? cursor;
    out.push({ bubble, slot: BUBBLE_SLOTS[pick % BUBBLE_SLOTS.length]! });
    cursor = pick + 1;
  });

  // Manually positioned bubbles ignore the slot grid entirely.
  return out.map((entry) =>
    entry.bubble.pinned
      ? {
          bubble: entry.bubble,
          slot: {
            left: `${entry.bubble.x}%`,
            top: `${entry.bubble.y}%`,
            transform: "translate(-50%, -50%)",
          } as React.CSSProperties,
        }
      : entry,
  );
}
```

The generation prompt cooperates with this: dialogue is capped at two balloons under
~70 characters per panel, and the art prompt asks for action in the central band with
negative space in the corners.

### Drag vs. click — one pointer handler, 4px threshold

A click opens the inline editor; a movement of 4px or more becomes a drag. Coordinates are
clamped to 4–96% horizontally and 6–94% vertically so a bubble can never leave the panel.

```tsx
function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
  if (editing) return;
  const rect = containerRef.current?.getBoundingClientRect();
  if (!rect) return;

  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);
  movedRef.current = false;
  const startX = event.clientX;
  const startY = event.clientY;

  function move(e: PointerEvent) {
    if (!movedRef.current && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
    movedRef.current = true;
    setDragging(true);
    onMove(
      clamp(((e.clientX - rect!.left) / rect!.width) * 100, 4, 96),
      clamp(((e.clientY - rect!.top) / rect!.height) * 100, 6, 94),
    );
  }

  function up() {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    setDragging(false);
    if (!movedRef.current) setEditing(true);
  }

  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
}
```

Dragging sets `pinned: true` via `onMove(x, y) → onPatchBubble(id, { x, y, pinned: true })`.
"Reset layout" simply clears `pinned` on every bubble in the panel, handing control back to
the auto slots.

### Editing affordance

```tsx
<textarea
  autoFocus value={draft} rows={2}
  onChange={(e) => setDraft(e.target.value)}
  onBlur={commit}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setDraft(bubble.text); setEditing(false); }
  }}
  className="w-44 resize-none rounded-lg border-2 border-primary bg-paper p-2 font-comic text-[13px] text-paper-foreground outline-none"
/>
```

Enter commits, Shift+Enter adds a newline, Escape reverts, blur commits.

### Panel frame and hover toolbar

```tsx
<figure ref={frameRef} className="group relative aspect-[8/5] overflow-hidden rounded-md">
  <img src={panel.image} alt={`${panel.camera}: ${panel.prompt}`} loading="lazy" draggable={false}
       className="size-full rounded-md border-2 border-ink object-cover" />
  {bubbleSlots(panel.bubbles).map(({ bubble: b, slot }) => (
    <SpeechBubble key={b.id} bubble={b} slot={slot} containerRef={frameRef}
      onChange={(text) => onPatchBubble(b.id, { text })}
      onMove={(x, y) => onPatchBubble(b.id, { x, y, pinned: true })} />
  ))}
  <figcaption data-print-hide
    className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-ink/85 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
    <span className="truncate text-[11px] font-medium uppercase tracking-wide text-paper">{panel.camera}</span>
    {/* Reset layout (only when a bubble is pinned) · Redraw · Download */}
  </figcaption>
</figure>
```

### Page container and grid

```tsx
<article className="paper-page rounded-xl p-5 sm:p-7">
  <header className="mb-4 flex items-baseline justify-between">
    <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-paper-foreground/70">Page {page}</h3>
    <span className="text-xs text-paper-foreground/50">{title}</span>
  </header>
  <div className={cn("grid gap-3", pageGridClass(layout, pagePanels.length))}>…</div>
</article>
```

```ts
function pageGridClass(layout: LayoutId, count: number) {
  if (layout === "splash" || count === 1) return "grid-cols-1";
  if (layout === "manga-6" || layout === "storyboard") return "grid-cols-2 sm:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2";
}
```

A Gallery / Page-view toggle in the stage header switches between all pages stacked and one
page at a time with prev/next arrows.

---

## 6. Loading and progress states

Three distinct stages, so the user is never staring at an empty screen.

### Stage 1 — writing the script (no panels exist yet)

```tsx
{panels.length === 0 && (scripting || !done) && (
  <div data-print-hide className="rounded-xl border border-border bg-card p-8 text-center"
       role="status" aria-live="polite">
    <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    <p className="font-medium">Writing your script…</p>
    <p className="mt-1 text-sm text-muted-foreground">
      The AI is breaking your story into panels, shots and dialogue. This usually takes
      20–40 seconds — panel art starts appearing right after.
    </p>
  </div>
)}
```

The stage subtitle also reflects the phase:
`${styleName} · breaking your story into panels…` before panels exist, then
`${styleName} · N pages · ${ready}/${total} panels drawn`.

### Stage 2 — inking (segmented per-panel bar)

```tsx
{panels.length > 0 && !done && (
  <div data-print-hide className="rounded-xl border border-border bg-card p-5">
    <div className="mb-2 flex items-center justify-between text-sm">
      <span className="font-medium">Inking your panels…</span>
      <span className="text-muted-foreground">{ready} of {panels.length}</span>
    </div>
    <div className="flex gap-1">
      {panels.map((p) => (
        <span key={p.id} className={cn(
          "h-2.5 flex-1 rounded-[2px] border border-ink/30",
          p.status === "ready" ? "bg-success" : "bg-muted",
        )} />
      ))}
    </div>
  </div>
)}
```

### Stage 3 — per-panel skeleton

```tsx
function PanelSkeleton() {
  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden rounded-md border-2 border-ink/70 ink-sweep">
      <Pencil className="size-6 text-muted-foreground sketch-pulse" />
    </div>
  );
}
```

### Streaming: a 4-way concurrency pool

Panels resolve independently and each one flips to `ready` the moment its art lands, so the
page fills in progressively instead of all at once.

```ts
/** Renders panels a few at a time so art streams in without hammering the API. */
async function pooled<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (next === undefined) return;
        await worker(next);
      }
    }),
  );
}

await pooled(plan, 4, async (panel) => {
  try {
    const { image, path } = await drawPanel({ data: { /* prompt, camera, styleFragment, characters, refPaths, refStrength, seed */ } });
    updatePanel(panel.id, { status: "ready", image, imagePath: path });
  } catch {
    updatePanel(panel.id, { status: "failed" });
  }
});
```

Everything transient is a `sonner` toast: "Script ready — inking panels…", "Redrawing that
panel…", "Bubble updated", "Saved to your library". The Save button is disabled while any
panel is still `drawing`.

---

## 7. PDF export

**No library.** No jsPDF, no html2canvas. Export is `window.print()` plus a print stylesheet.

```tsx
<Button size="sm" className="gap-2" disabled={!done} onClick={() => window.print()}
        title={done ? "Save the whole comic as a PDF" : "Wait for all panels to finish"}>
  <FileDown className="size-4" />
  Download PDF
</Button>
```

```css
@media print {
  [data-print-hide] { display: none !important; }
  body { background: white; }
  .paper-page {
    box-shadow: none;
    break-inside: avoid;
    page-break-after: always;
  }
}
```

How it works:

1. Every piece of app chrome — headers, toolbars, progress bars, hover captions, drag
   handles — carries `data-print-hide` and vanishes.
2. Each `<article className="paper-page">` is one comic page and gets
   `page-break-after: always`, so the browser's "Save as PDF" emits one sheet per page.
3. Bubbles are DOM text positioned in percentages, so they land exactly where they do on
   screen and print as selectable vector type, at printer DPI rather than screen DPI.

Single-panel export is a plain anchor download of the image URL:

```ts
function downloadPanel() {
  if (!panel.image) return;
  const a = document.createElement("a");
  a.href = panel.image;
  a.download = `comic-crafter-page${panel.page}-panel${panel.index + 1}.jpg`;
  a.click();
}
```

Trade-off worth knowing: the user goes through the browser print dialog (choose
"Save as PDF"), which is one extra click but costs zero bundle weight and avoids the
blurry rasterisation that html2canvas produces on text.

---

## 8. Porting checklist

### Dependencies

```
tailwindcss ^4 + @tailwindcss/vite
tw-animate-css
lucide-react
sonner
clsx + tailwind-merge          (the cn() helper)
@tanstack/react-query          (character library only)
shadcn/ui: button, input, textarea, label, slider, sonner
```

`components.json`: style `new-york`, baseColor `slate`, cssVariables `true`,
icon library `lucide`, css path `src/styles.css`.

### Files to copy

| File | Contains |
|---|---|
| `src/styles.css` | Entire design system — copy verbatim first |
| `src/lib/utils.ts` | `cn()` |
| `src/lib/comic.ts` | `ArtStyle`, `ART_STYLES`, `LAYOUTS`, `REFERENCE_STRENGTHS`, `Bubble`, `Panel`, `CharacterRef`, `CharacterSet` |
| `src/assets/styles/*.jpg` | 25 style thumbnails, 512×512 |
| `src/components/comic-stage.tsx` | `ComicStage`, `PanelView`, `SpeechBubble`, `PanelSkeleton` |
| `src/components/studio-form.tsx` | `StudioForm`, `Card`, `SectionHeading`, upload + set management |

### Order of operations

1. Copy `src/styles.css` and add the Google Fonts `<link>` to your document head.
2. Confirm `border-border`, `bg-paper`, `text-ink`, `bg-gold` all resolve — if not, the
   `@theme inline` map is incomplete.
3. Copy `comic.ts` + thumbnails, then `studio-form.tsx`, stubbing the six server functions
   (`listCharacters`, `saveCharacter`, `deleteCharacter`, `listCharacterSets`,
   `saveCharacterSet`, `deleteCharacterSet`) with local state if you have no backend yet.
4. Copy `comic-stage.tsx` and feed it a static `Panel[]` to verify bubble drag, editing and
   print output before wiring generation.
5. Wire the orchestrator: hold `panels[]` in the page, stream with `pooled(plan, 4, …)`.

### Non-obvious details that make it feel right

- Bubbles are **percent-positioned**, never pixel-positioned.
- The click-vs-drag threshold is **4px** — lower and every edit becomes an accidental drag.
- Bubble max width is **38%** of the panel.
- Panels are **`aspect-[8/5]`**; the page container is `paper-page`.
- The heavy `2px 2px 0` ink shadow (not a soft blur) is what reads as "printed comic".
- Selection state everywhere is `border-2 border-primary` + `shadow-[var(--shadow-card)]`.
- Cast selection is capped at **3**; reference uploads at **5 MB**.
