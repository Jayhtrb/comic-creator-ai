import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { referenceFragment } from "./comic";
import { requireSupabaseAuth } from "./supabase/auth-middleware";

/**
 * Gemini-driven generation pipeline.
 *
 * Pass 1 (`generateScript`) turns the user's story into a structured panel
 * script: camera, image prompt and speech bubbles per panel.
 * Pass 2 (`generatePanelImage`) renders one panel image at a time so the studio
 * can stream results into the page as they land.
 */

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const TEXT_MODEL = "gemini-3.5-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

function apiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY is not configured for this project.");
  return key;
}

async function callGemini(model: string, body: unknown) {
  const res = await fetch(`${GEMINI}/${model}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${model} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
    }>;
  };
}

const characterSchema = z.object({ name: z.string().max(80), note: z.string().max(300) });

const scriptInput = z.object({
  story: z.string().min(12).max(6000),
  styleName: z.string().max(80),
  styleFragment: z.string().max(400),
  pages: z.number().int().min(1).max(8),
  panelsPerPage: z.number().int().min(1).max(6),
  characters: z.array(characterSchema).max(3).default([]),
  seed: z.string().max(60).optional(),
});

const scriptPanel = z.object({
  page: z.number().int().min(1),
  index: z.number().int().min(0),
  camera: z.string(),
  prompt: z.string(),
  bubbles: z
    .array(
      z.object({
        speaker: z.string(),
        text: z.string(),
        kind: z.enum(["speech", "thought", "caption"]),
        x: z.number(),
        y: z.number(),
      }),
    )
    .default([]),
});

/** Pass 1 — story ➜ structured panel script. */
export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => scriptInput.parse(data))
  .handler(async ({ data }) => {
    const total = data.pages * data.panelsPerPage;
    const named = data.characters.map((c) => c.name).filter(Boolean);
    const cast = data.characters.length
      ? data.characters.map((c) => `- ${c.name}: ${c.note}`).join("\n")
      : "- Invent a small, memorable cast and keep them consistent.";
    const castLock = named.length
      ? [
          `CLOSED CAST — the ONLY people who may appear anywhere in this comic are: ${named.join(", ")}.`,
          `Never introduce, draw or name any other person: no extra friends, rivals, bystanders,`,
          `crowds, passers-by, silhouettes, reflections of other people, or background figures.`,
          `If the story itself explicitly names another character, that character may appear — otherwise,`,
          `keep every panel limited to the cast above and empty environment.`,
          `Every "prompt" must state the exact number of people visible (e.g. "only two people are visible:`,
          `${named.slice(0, 2).join(" and ") || named[0]}") and say "no other people, no bystanders, no crowd".`,
        ].join("\n")
      : `Keep the cast as small as the story requires. Do not add background people, crowds or bystanders unless the story explicitly calls for them.`;

    const json = await callGemini(TEXT_MODEL, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                `You are a professional comic book writer and storyboard artist.`,
                `Break the story below into EXACTLY ${total} panels across ${data.pages} page(s),`,
                `${data.panelsPerPage} panels per page, paced so each page ends on a beat.`,
                ``,
                `STORY:\n${data.story}`,
                ``,
                `RECURRING CAST (keep descriptions identical in every panel prompt):\n${cast}`,
                ``,
                castLock,
                ``,
                `Art style: ${data.styleName} — ${data.styleFragment}`,
                data.seed ? `Creative seed: ${data.seed}` : ``,
                ``,
                `For each panel provide:`,
                `- camera: a shot description (e.g. "Establishing wide", "Extreme close-up").`,
                `- prompt: a single vivid sentence describing ONLY what is visible, restating each`,
                `  present character's full physical description verbatim so the art stays on-model.`,
                `  Never mention text, lettering, speech balloons or captions in the prompt.`,
                `  Compose so faces and key action sit in the middle band of the frame, leaving`,
                `  calm negative space (sky, wall, floor) in the top and bottom corners.`,
                `- bubbles: 0-2 balloons only, under 70 characters each so they fit in a corner.`,
                `  x/y are hints: x below 40 for a left-side speaker, above 60 for a right-side`,
                `  speaker; the app snaps balloons to safe corners. Use "caption" for narration.`,
                `  Only cast members listed above may speak.`,
                `Number pages from 1 and panel index from 0 within each page.`,

              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            panels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  index: { type: "integer" },
                  camera: { type: "string" },
                  prompt: { type: "string" },
                  bubbles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        speaker: { type: "string" },
                        text: { type: "string" },
                        kind: { type: "string", enum: ["speech", "thought", "caption"] },
                        x: { type: "number" },
                        y: { type: "number" },
                      },
                      required: ["speaker", "text", "kind", "x", "y"],
                    },
                  },
                },
                required: ["page", "index", "camera", "prompt", "bubbles"],
              },
            },
          },
          required: ["title", "panels"],
        },
      },
    });

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("The script model returned an unreadable response. Try again.");
    }

    const result = z
      .object({ title: z.string().default("Untitled comic"), panels: z.array(scriptPanel).min(1) })
      .parse(parsed);

    // Normalise page/index so the layout grid always lines up.
    const panels = result.panels.slice(0, total).map((p, i) => ({
      ...p,
      page: Math.floor(i / data.panelsPerPage) + 1,
      index: i % data.panelsPerPage,
    }));

    return { title: result.title, panels };
  });

const imageInput = z.object({
  prompt: z.string().min(4).max(1200),
  camera: z.string().max(120).default(""),
  styleFragment: z.string().max(400),
  characters: z.array(characterSchema).max(3).default([]),
  /** Storage paths of reference art in the private `character-refs` bucket. */
  refPaths: z.array(z.string().max(400)).max(6).default([]),
  /** 1 (loose inspiration) → 5 (locked likeness). */
  refStrength: z.number().int().min(1).max(5).default(3),
  seed: z.string().max(60).optional(),
});

/** Pass 2 — one panel prompt ➜ one rendered panel image (data URL). */
export const generatePanelImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => imageInput.parse(data))
  .handler(async ({ data, context }) => {
    const cast = data.characters.map((c) => `${c.name} (${c.note})`).join("; ");

    // Pull the user's reference art so the model sees the actual faces/outfits,
    // not just a text description of them.
    const refs: Array<{ mimeType: string; data: string }> = [];
    for (const path of data.refPaths.slice(0, 3)) {
      if (!path.startsWith(`${context.userId}/`)) continue;
      const { data: blob, error } = await context.supabase.storage
        .from("character-refs")
        .download(path);
      if (error || !blob) continue;
      const buffer = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]!);
      refs.push({ mimeType: blob.type || "image/jpeg", data: btoa(binary) });
    }

    const text = [
      `Single comic book panel illustration.`,
      data.camera ? `Shot: ${data.camera}.` : "",
      `Scene: ${data.prompt}`,
      cast ? `Character continuity — draw exactly as described: ${cast}.` : "",
      names.length
        ? `Cast lock: the only people allowed in this panel are ${names.join(" and ")}` +
          ` — and only those of them the scene description mentions. Draw no additional people:` +
          ` no extra characters, no bystanders, no crowd, no background figures, no silhouettes,` +
          ` no reflections or portraits of other people. An empty street or room is correct.`
        : `Do not add extra people, bystanders, crowds or background figures beyond those the scene describes.`,
      refs.length
        ? `${referenceFragment(data.refStrength)} Never paste, crop or photo-collage the` +
          ` reference itself — always redraw it.`
        : "",
      `Art direction: ${data.styleFragment}.`,
      `Full-bleed artwork with a clean composition: keep faces and key action in the`,
      `central band and leave uncluttered negative space in the top and bottom corners`,
      `for lettering. Absolutely no text, no lettering, no speech balloons, no captions,`,
      `no watermarks or panel borders.`,
      data.seed ? `Style seed: ${data.seed}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const json = await callGemini(IMAGE_MODEL, {
      contents: [
        {
          role: "user",
          parts: [{ text }, ...refs.map((r) => ({ inlineData: r }))],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:3" },
      },
    });


    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part?.inlineData) throw new Error("The image model returned no artwork. Try again.");

    // Park the artwork in the user's private bucket and hand the browser a signed
    // URL — passing megabytes of base64 back through RPC (and again on save) is
    // what makes multi-page runs fall over.
    const binary = atob(part.inlineData.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const contentType = part.inlineData.mimeType || "image/jpeg";
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const path = `${context.userId}/drafts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await context.supabase.storage
      .from("comic-panels")
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw new Error(`Could not store the panel art: ${uploadError.message}`);

    const { data: signed } = await context.supabase.storage
      .from("comic-panels")
      .createSignedUrl(path, 60 * 60 * 6);

    return { path, image: signed?.signedUrl ?? "" };
  });
