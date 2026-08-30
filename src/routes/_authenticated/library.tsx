import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { deleteComic, listComics } from "@/lib/comics.functions";
import { ART_STYLES } from "@/lib/comic";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "My comics — Comic Crafter AI" },
      { name: "description", content: "Every comic you have generated and saved, in one place." },
      { property: "og:title", content: "My comics — Comic Crafter AI" },
      { property: "og:description", content: "Your saved comic pages and scripts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const fetchComics = useServerFn(listComics);
  const removeComic = useServerFn(deleteComic);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["comics"], queryFn: () => fetchComics() });

  const del = useMutation({
    mutationFn: (id: string) => removeComic({ data: { id } }),
    onSuccess: () => {
      toast.success("Comic deleted.");
      void qc.invalidateQueries({ queryKey: ["comics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">My comics</h1>
            <p className="mt-1 text-muted-foreground">Saved scripts, styles and page layouts.</p>
          </div>
          <Button asChild>
            <Link to="/studio">New comic</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your shelf…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nothing on the shelf yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a comic in the studio and hit “Save to library”.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c: Record<string, unknown>) => (
              <li
                key={c.id as string}
                className="rounded-xl border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
              >
                <p className="font-display text-lg font-semibold leading-snug">
                  {(c.title as string) ?? "Untitled comic"}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.story_prompt as string}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    {ART_STYLES.find((s) => s.id === c.style_choice)?.name ?? (c.style_choice as string)} ·{" "}
                    {c.num_pages as number} {c.num_pages === 1 ? "page" : "pages"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete comic"
                    onClick={() => del.mutate(c.id as string)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
