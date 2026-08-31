import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "./supabase/auth-middleware";

const bubbleSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  kind: z.enum(["speech", "thought", "caption"]),
});

const panelSchema = z.object({
  page: z.number().int().min(1),
  index: z.number().int().min(0),
  camera: z.string().optional(),
  prompt: z.string().optional(),
  /** Rendered panel art as a data URL; uploaded to the private panels bucket. */
  image: z.string().optional(),
  bubbles: z.array(bubbleSchema),
});

const saveSchema = z.object({
  title: z.string().min(1).max(200),
  story: z.string().min(1),
  style: z.string().min(1),
  layout: z.string().min(1),
  pages: z.number().int().min(1).max(8),
  panels: z.array(panelSchema).min(1),
});

/** Decodes a `data:image/...;base64,...` URL into bytes for storage upload. */
function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: match[1]! };
}

/** Persists a finished comic (metadata, panel art and script) for the signed-in user. */
export const saveComic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: comic, error } = await context.supabase
      .from("comics")
      .insert({
        user_id: context.userId,
        title: data.title,
        story_prompt: data.story,
        style_choice: data.style,
        num_pages: data.pages,
        layout_preset: data.layout,
        status: "complete",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    const comicId = comic.id as string;

    const rows = [];
    for (const p of data.panels) {
      let imagePath: string | null = null;
      const decoded = p.image ? decodeDataUrl(p.image) : null;
      if (decoded) {
        const ext = decoded.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        const path = `${context.userId}/${comicId}/p${p.page}-${p.index}.${ext}`;
        const { error: uploadError } = await context.supabase.storage
          .from("comic-panels")
          .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: true });
        if (!uploadError) imagePath = path;
      }

      rows.push({
        comic_id: comicId,
        user_id: context.userId,
        page_number: p.page,
        panel_index: p.index,
        camera: p.camera ?? null,
        image_prompt: p.prompt ?? null,
        image_path: imagePath,
        bubbles: p.bubbles,
        status: "ready",
      });
    }

    const { error: panelError } = await context.supabase.from("panels").insert(rows);
    if (panelError) throw new Error(panelError.message);

    await context.supabase.from("prompt_history").insert({
      user_id: context.userId,
      prompt: data.story,
      style: data.style,
      comic_id: comicId,
    });

    return { id: comicId };
  });

/** Lists the signed-in user's saved comics, newest first. */
export const listComics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("comics")
      .select("id, title, story_prompt, style_choice, num_pages, layout_preset, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Loads one saved comic with its panel script. */
export const getComic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: comic, error } = await context.supabase
      .from("comics")
      .select("id, title, story_prompt, style_choice, num_pages, layout_preset, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!comic) throw new Error("Comic not found");

    const { data: panels, error: panelError } = await context.supabase
      .from("panels")
      .select("page_number, panel_index, camera, image_prompt, bubbles")
      .eq("comic_id", data.id)
      .order("page_number", { ascending: true })
      .order("panel_index", { ascending: true });
    if (panelError) throw new Error(panelError.message);

    return { comic, panels: panels ?? [] };
  });

/** Deletes a saved comic (panels cascade). */
export const deleteComic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("comics").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
