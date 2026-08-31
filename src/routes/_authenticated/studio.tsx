import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { ComicStage } from "@/components/comic-stage";
import { StudioForm, type GenerationConfig } from "@/components/studio-form";
import { Button } from "@/components/ui/button";
import { ART_STYLES, LAYOUTS, type Panel } from "@/lib/comic";
import { saveComic } from "@/lib/comics.functions";
import { generatePanelImage, generateScript } from "@/lib/generate.functions";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Comic Crafter AI" },
      {
        name: "description",
        content:
          "Write a story, pick an art style, keep your characters consistent, and generate a full comic you can edit and export.",
      },
      { property: "og:title", content: "Studio — Comic Crafter AI" },
      {
        property: "og:description",
        content: "Generate multi-panel comics with consistent characters and editable bubbles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Phase = "studio" | "comic";

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

function Studio() {
  const [phase, setPhase] = useState<Phase>("studio");
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [saving, setSaving] = useState(false);
  const [scripting, setScripting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled comic");
  const persist = useServerFn(saveComic);
  const writeScript = useServerFn(generateScript);
  const drawPanel = useServerFn(generatePanelImage);

  function updatePanel(id: string, patch: Partial<Panel>) {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleGenerate(next: GenerationConfig) {
    const style = ART_STYLES.find((s) => s.id === next.style)!;
    const perPage = LAYOUTS.find((l) => l.id === next.layout)?.panelsPerPage ?? 4;

    setConfig(next);
    setPanels([]);
    setSavedId(null);
    setTitle("Untitled comic");
    setPhase("comic");
    setScripting(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    let script;
    try {
      script = await writeScript({
        data: {
          story: next.story,
          styleName: style.name,
          styleFragment: style.promptFragment,
          pages: next.pages,
          panelsPerPage: perPage,
          characters: next.characters,
          ...(next.seed ? { seed: next.seed } : {}),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not write the script.");
      setPhase("studio");
      return;
    } finally {
      setScripting(false);
    }

    const plan: Panel[] = script.panels.map((p) => ({
      id: `p${p.page}-${p.index}`,
      page: p.page,
      index: p.index,
      camera: p.camera,
      prompt: p.prompt,
      status: "drawing",
      bubbles: p.bubbles.map((b, bi) => ({ ...b, id: `p${p.page}-${p.index}-b${bi}` })),
    }));

    setTitle(script.title);
    setPanels(plan);
    toast.success("Script ready — inking panels…");

    await pooled(plan, 4, async (panel) => {
      try {
        const { image, path } = await drawPanel({
          data: {
            prompt: panel.prompt,
            camera: panel.camera,
            styleFragment: style.promptFragment,
            characters: next.characters,
            ...(next.seed ? { seed: next.seed } : {}),
          },
        });
        updatePanel(panel.id, { status: "ready", image, imagePath: path });
      } catch {
        updatePanel(panel.id, { status: "failed" });
      }
    });
  }

  function editBubble(panelId: string, bubbleId: string, text: string) {
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panelId
          ? { ...p, bubbles: p.bubbles.map((b) => (b.id === bubbleId ? { ...b, text } : b)) }
          : p,
      ),
    );
  }

  async function regenerate(panelId: string) {
    const panel = panels.find((p) => p.id === panelId);
    if (!panel || !config) return;
    const style = ART_STYLES.find((s) => s.id === config.style)!;

    updatePanel(panelId, { status: "drawing", image: undefined });
    toast("Redrawing that panel…");
    try {
      const { image, path } = await drawPanel({
        data: {
          prompt: panel.prompt,
          camera: panel.camera,
          styleFragment: style.promptFragment,
          characters: config.characters,
          seed: Math.random().toString(36).slice(2, 10),
        },
      });
      updatePanel(panelId, { status: "ready", image, imagePath: path });
    } catch (error) {
      updatePanel(panelId, { status: "failed" });
      toast.error(error instanceof Error ? error.message : "Redraw failed.");
    }
  }

  function startOver() {
    setPhase("studio");
    setPanels([]);
    setSavedId(null);
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const result = await persist({
        data: {
          title,
          story: config.story,
          style: config.style,
          layout: config.layout,
          pages: config.pages,
          panels: panels.map((p) => ({
            page: p.page,
            index: p.index,
            camera: p.camera,
            prompt: p.prompt,
            ...(p.imagePath ? { imagePath: p.imagePath } : {}),
            bubbles: p.bubbles,
          })),
        },
      });
      setSavedId(result.id);
      toast.success("Saved to your library.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this comic.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
        {phase === "studio" ? (
          <>
            <div data-print-hide className="mb-10 max-w-2xl">
              <p className="mb-3 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                Comic studio · powered by your own Gemini key
              </p>
              <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">
                Turn a story into a
                <span className="text-primary"> finished comic.</span>
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Write the plot, upload your cast, choose a style. Comic Crafter breaks the story
                into panels, keeps every character on-model, and hands you an editable, printable
                book.
              </p>
            </div>
            <StudioForm onGenerate={handleGenerate} />
          </>
        ) : (
          config && (
            <>
              <div data-print-hide className="mb-4 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    savedId !== null ||
                    panels.length === 0 ||
                    panels.some((p) => p.status === "drawing")
                  }
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {savedId ? "Saved" : "Save to library"}
                </Button>
              </div>
              <ComicStage
                title={title}
                style={config.style}
                layout={config.layout}
                panels={panels}
                scripting={scripting}
                onEditBubble={editBubble}
                onRegenerate={regenerate}
                onStartOver={startOver}
              />
            </>
          )
        )}
      </main>
    </div>
  );
}
