import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "./supabase/auth-middleware";

/**
 * Saved character library.
 *
 * Reference art lives in the private `character-refs` bucket under the owner's
 * user id; rows in `public.characters` hold the name, description and paths.
 */

const REF_BUCKET = "character-refs";

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Reference images must be base64 data URLs.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

/** Lists the signed-in user's saved characters with short-lived signed art URLs. */
export const listCharacters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("characters")
      .select("id, name, description, reference_paths, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return await Promise.all(
      (data ?? []).map(async (row) => {
        const paths = (row.reference_paths as string[] | null) ?? [];
        const images = await Promise.all(
          paths.map(async (p) => {
            const { data: signed } = await context.supabase.storage
              .from(REF_BUCKET)
              .createSignedUrl(p, 60 * 60 * 6);
            return signed?.signedUrl ?? "";
          }),
        );
        return {
          id: row.id as string,
          name: (row.name as string) ?? "Unnamed",
          note: (row.description as string | null) ?? "",
          refPaths: paths,
          images: images.filter(Boolean),
        };
      }),
    );
  });

const saveInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  note: z.string().max(300).default(""),
  /** New uploads as base64 data URLs (max 3). */
  images: z.array(z.string().max(8_000_000)).max(3).default([]),
  /** Existing storage paths to keep when updating. */
  keepPaths: z.array(z.string().max(400)).max(3).default([]),
});

/** Creates or updates a saved character, uploading any new reference art. */
export const saveCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInput.parse(data))
  .handler(async ({ data, context }) => {
    const keep = data.keepPaths.filter((p) => p.startsWith(`${context.userId}/`));
    const uploaded: string[] = [];

    for (const image of data.images) {
      const { bytes, contentType } = decodeDataUrl(image);
      const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const path = `${context.userId}/refs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await context.supabase.storage
        .from(REF_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(`Could not store the reference image: ${error.message}`);
      uploaded.push(path);
    }

    const reference_paths = [...keep, ...uploaded].slice(0, 3);

    if (data.id) {
      const { error } = await context.supabase
        .from("characters")
        .update({ name: data.name, description: data.note, reference_paths })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("characters")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.note,
        reference_paths,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** Removes a saved character and its reference art. */
export const deleteCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("characters")
      .select("reference_paths")
      .eq("id", data.id)
      .maybeSingle();

    const paths = ((row?.reference_paths as string[] | null) ?? []).filter((p) =>
      p.startsWith(`${context.userId}/`),
    );
    if (paths.length) await context.supabase.storage.from(REF_BUCKET).remove(paths);

    const { error } = await context.supabase.from("characters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ *
 * Named character reference sets
 * ------------------------------------------------------------------ */

/** True when the optional `character_sets` table hasn't been created yet. */
function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || /character_sets/i.test(error?.message ?? "");
}

/** Lists the user's saved reference sets (empty until the table exists). */
export const listCharacterSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("character_sets")
      .select("id, name, character_ids, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTable(error)) return [];
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? "Untitled set",
      characterIds: ((row.character_ids as string[] | null) ?? []).filter(Boolean),
    }));
  });

const setInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  characterIds: z.array(z.string().max(64)).max(3).default([]),
});

/** Creates or renames a named reference set. */
export const saveCharacterSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("character_sets")
        .update({ name: data.name, character_ids: data.characterIds })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(missingTableMessage(error));
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("character_sets")
      .insert({ user_id: context.userId, name: data.name, character_ids: data.characterIds })
      .select("id")
      .single();
    if (error) throw new Error(missingTableMessage(error));
    return { id: row.id as string };
  });

/** Deletes a named reference set (the characters themselves are untouched). */
export const deleteCharacterSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("character_sets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(missingTableMessage(error));
    return { ok: true };
  });

function missingTableMessage(error: { code?: string; message?: string }) {
  return isMissingTable(error)
    ? "Reference sets need one more table — run docs/migrations/002-character-sets.sql in Supabase."
    : (error.message ?? "Could not save that set.");
}
