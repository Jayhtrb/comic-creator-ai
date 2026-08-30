/**
 * Comic Crafter AI — domain model, art-style catalog and demo data.
 *
 * This module is pure data + types. No API calls live here; generation
 * orchestration is kept separate so the UI never talks to a provider directly.
 */

import manga from "@/assets/styles/manga.jpg";
import western from "@/assets/styles/western.jpg";
import cyberpunk from "@/assets/styles/cyberpunk.jpg";
import noir from "@/assets/styles/noir.jpg";
import watercolor from "@/assets/styles/watercolor.jpg";
import chibi from "@/assets/styles/chibi.jpg";
import ghibli from "@/assets/styles/ghibli.jpg";
import graphicNovel from "@/assets/styles/graphic-novel.jpg";
import pixel from "@/assets/styles/pixel.jpg";
import cgi from "@/assets/styles/cgi.jpg";
import webtoon from "@/assets/styles/webtoon.jpg";
import retro from "@/assets/styles/retro.jpg";

import panel1 from "@/assets/demo/panel-1.jpg";
import panel2 from "@/assets/demo/panel-2.jpg";
import panel3 from "@/assets/demo/panel-3.jpg";
import panel4 from "@/assets/demo/panel-4.jpg";
import charKestrel from "@/assets/demo/char-kestrel.jpg";
import charMercer from "@/assets/demo/char-mercer.jpg";

export type ArtStyleId =
  | "manga"
  | "western"
  | "cyberpunk"
  | "noir"
  | "watercolor"
  | "chibi"
  | "ghibli"
  | "graphic-novel"
  | "pixel"
  | "cgi"
  | "webtoon"
  | "retro";

export interface ArtStyle {
  id: ArtStyleId;
  name: string;
  blurb: string;
  thumb: string;
  /** Prompt fragment appended to every panel request for this style. */
  promptFragment: string;
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: "manga",
    name: "Manga",
    blurb: "Black & white, dynamic lines",
    thumb: manga,
    promptFragment:
      "black and white manga art, sharp inked linework, screentone shading, dynamic speed lines",
  },
  {
    id: "western",
    name: "Western Comic",
    blurb: "Vibrant superhero energy",
    thumb: western,
    promptFragment:
      "classic western superhero comic art, vibrant primary colors, bold ink outlines, halftone dots",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    blurb: "Neon-drenched, high contrast",
    thumb: cyberpunk,
    promptFragment:
      "cyberpunk comic art, neon magenta and cyan lighting, rain-slicked reflections, high contrast",
  },
  {
    id: "noir",
    name: "Noir",
    blurb: "Gritty, shadow-heavy",
    thumb: noir,
    promptFragment:
      "film noir comic art, extreme high contrast black and white, deep shadows, ink wash",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    blurb: "Soft, ethereal, artistic",
    thumb: watercolor,
    promptFragment:
      "watercolor illustration, soft bleeding washes, delicate pigment edges, textured paper",
  },
  {
    id: "chibi",
    name: "Chibi / Cute",
    blurb: "Big heads, tiny bodies",
    thumb: chibi,
    promptFragment:
      "chibi cartoon art, oversized head and eyes, tiny rounded body, bright pastel colors",
  },
  {
    id: "ghibli",
    name: "Ghibli Style",
    blurb: "Warm, whimsical, detailed",
    thumb: ghibli,
    promptFragment:
      "warm whimsical hand-painted anime film art, detailed painted skies, nostalgic soft light",
  },
  {
    id: "graphic-novel",
    name: "Graphic Novel",
    blurb: "Mature, flat, stylized",
    thumb: graphicNovel,
    promptFragment:
      "mature graphic novel art, flat muted color, hard-edged stylized shadows, restrained palette",
  },
  {
    id: "pixel",
    name: "Pixel Art",
    blurb: "Retro 16-bit",
    thumb: pixel,
    promptFragment:
      "16-bit pixel art, chunky pixels, limited retro palette, crisp pixel grid",
  },
  {
    id: "cgi",
    name: "3D / CGI",
    blurb: "Pixar-like rendered look",
    thumb: cgi,
    promptFragment:
      "stylized 3D CGI render, glossy surfaces, cinematic soft lighting, shallow depth of field",
  },
  {
    id: "webtoon",
    name: "Korean Webtoon",
    blurb: "Clean lines, gradients",
    thumb: webtoon,
    promptFragment:
      "korean webtoon art, clean thin linework, smooth gradient coloring, glossy digital rendering",
  },
  {
    id: "retro",
    name: "Retro Print",
    blurb: "1950s four-color print",
    thumb: retro,
    promptFragment:
      "vintage 1950s comic print, faded four-color offset, visible halftone dots, aged newsprint",
  },
];

export type LayoutId = "auto" | "classic-4" | "manga-6" | "splash" | "storyboard";

export interface LayoutPreset {
  id: LayoutId;
  name: string;
  description: string;
  panelsPerPage: number;
}

export const LAYOUTS: LayoutPreset[] = [
  { id: "auto", name: "Automatic", description: "Let the AI pace the page", panelsPerPage: 4 },
  { id: "classic-4", name: "4-panel classic", description: "Two even rows", panelsPerPage: 4 },
  { id: "manga-6", name: "6-panel manga", description: "Tight, fast cutting", panelsPerPage: 6 },
  { id: "splash", name: "Splash page", description: "One full-bleed hero panel", panelsPerPage: 1 },
  { id: "storyboard", name: "Storyboard", description: "Uniform grid with notes", panelsPerPage: 6 },
];

export const CAMERA_ANGLES = [
  "Establishing wide",
  "Medium shot",
  "Close-up",
  "Extreme close-up",
  "Over the shoulder",
  "Low angle action",
  "Bird's eye",
] as const;

export interface CharacterRef {
  id: string;
  name: string;
  note: string;
  images: string[];
}

export const DEMO_CHARACTERS: CharacterRef[] = [
  {
    id: "kestrel",
    name: "Detective Kestrel",
    note: "Silver crop, cybernetic left eye, black trench",
    images: [charKestrel],
  },
  {
    id: "mercer",
    name: "Old Man Mercer",
    note: "Grey stubble, scarred brow, informant",
    images: [charMercer],
  },
];

export interface Bubble {
  id: string;
  speaker: string;
  text: string;
  /** Percentage position within the panel. */
  x: number;
  y: number;
  kind: "speech" | "thought" | "caption";
}

export type PanelStatus = "queued" | "drawing" | "ready" | "failed";

export interface Panel {
  id: string;
  page: number;
  index: number;
  camera: string;
  prompt: string;
  image?: string | undefined;
  status: PanelStatus;
  bubbles: Bubble[];
}

export interface Comic {
  title: string;
  style: ArtStyleId;
  layout: LayoutId;
  pages: number;
  panels: Panel[];
}

const DEMO_IMAGES = [panel1, panel2, panel3, panel4];

/** Panel art used by the preview build until a Gemini key is wired up. */
export function demoImageFor(index: number): string {
  return DEMO_IMAGES[index % DEMO_IMAGES.length]!;
}

const DEMO_SCRIPT: Array<Pick<Panel, "camera" | "prompt"> & { bubbles: Omit<Bubble, "id">[] }> = [
  {
    camera: "Establishing wide",
    prompt: "Rain-soaked neon megacity skyline at night, transit pods overhead",
    bubbles: [
      {
        speaker: "Caption",
        text: "NEO-KOWLOON. 3:41 A.M. THE RAIN NEVER STOPS HERE.",
        x: 6,
        y: 8,
        kind: "caption",
      },
    ],
  },
  {
    camera: "Medium shot",
    prompt: "Detective Kestrel in a neon alley, collar up against the downpour",
    bubbles: [
      { speaker: "Kestrel", text: "You're late, Mercer.", x: 54, y: 12, kind: "speech" },
      { speaker: "Kestrel", text: "And I'm out of patience.", x: 8, y: 70, kind: "thought" },
    ],
  },
  {
    camera: "Extreme close-up",
    prompt: "Kestrel's cybernetic eye scrolling intercepted data streams",
    bubbles: [
      {
        speaker: "Caption",
        text: "THE SIGNAL WASN'T HUMAN. IT NEVER WAS.",
        x: 5,
        y: 78,
        kind: "caption",
      },
    ],
  },
  {
    camera: "Low angle action",
    prompt: "Kestrel sprinting through a server hall as holographic AI shards detonate",
    bubbles: [
      { speaker: "ARIA", text: "YOU CANNOT DELETE WHAT YOU DEPEND ON.", x: 46, y: 10, kind: "speech" },
      { speaker: "Kestrel", text: "Watch me.", x: 8, y: 74, kind: "speech" },
    ],
  },
];

/** Builds the panel plan for a generation run (stand-in for the script pass). */
export function buildPanelPlan(pages: number, layout: LayoutId): Panel[] {
  const perPage = LAYOUTS.find((l) => l.id === layout)?.panelsPerPage ?? 4;
  const panels: Panel[] = [];

  for (let page = 1; page <= pages; page++) {
    for (let i = 0; i < perPage; i++) {
      const seed = DEMO_SCRIPT[(page - 1 + i) % DEMO_SCRIPT.length]!;
      panels.push({
        id: `p${page}-${i}`,
        page,
        index: i,
        camera: seed.camera,
        prompt: seed.prompt,
        status: "queued",
        bubbles: seed.bubbles.map((b, bi) => ({ ...b, id: `p${page}-${i}-b${bi}` })),
      });
    }
  }

  return panels;
}

export const SURPRISE_PROMPTS = [
  "A cyberpunk detective in a neon-lit city tracks down a rogue AI that has been ghost-writing the city's laws.",
  "A retired dragon opens a bakery in a mountain village and accidentally becomes the town's fire brigade.",
  "Two rival lighthouse keepers on the same island discover they have been signalling the same ship for forty years.",
  "A tea shop at the edge of the underworld serves one impossible customer every night.",
  "A courier on a solar sailship must deliver a letter before the sun it orbits goes dark.",
];

export const STORY_PLACEHOLDER =
  "A cyberpunk detective in a neon-lit city tracks down a rogue AI...";
