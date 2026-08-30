import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { ComicStage } from "@/components/comic-stage";
import { StudioForm, type GenerationConfig } from "@/components/studio-form";
import { Button } from "@/components/ui/button";
import { buildPanelPlan, demoImageFor, type Panel } from "@/lib/comic";
import { saveComic } from "@/lib/comics.functions";

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

function Studio() {
  const [phase, setPhase] = useState<Phase>("studio");
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const persist = useServerFn(saveComic);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * Preview-stage generation. Panels resolve one at a time so the UI models the
   * real streaming pipeline; swapping this for the Gemini calls only changes
   * where `image` comes from.
   */
  const runGeneration = useCallback((plan: Panel[]) => {
    plan.forEach((panel, i) => {
      const t = setTimeout(
        () => {
          setPanels((prev) =>
            prev.map((p) =>
              p.id === panel.id ? { ...p, status: "ready", image: demoImageFor(i) } : p,
            ),
          );
        },
        700 + i * 650,
      );
      timers.current.push(t);
    });
  }, []);

  function handleGenerate(next: GenerationConfig) {
    const plan = buildPanelPlan(next.pages, next.layout);
    setConfig(next);
    setPanels(plan);
    setSavedId(null);
    setPhase("comic");
    runGeneration(plan);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  function regenerate(panelId: string) {
    setPanels((prev) =>
      prev.map((p) => (p.id === panelId ? { ...p, status: "drawing", image: undefined } : p)),
    );
    toast("Redrawing that panel…");
    const t = setTimeout(() => {
      setPanels((prev) =>
        prev.map((p) =>
          p.id === panelId
            ? { ...p, status: "ready", image: demoImageFor(Math.floor(Math.random() * 4)) }
            : p,
        ),
      );
    }, 1400);
    timers.current.push(t);
  }

  function startOver() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
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
          title: config.story.slice(0, 60) + (config.story.length > 60 ? "…" : ""),
          story: config.story,
          style: config.style,
          layout: config.layout,
          pages: config.pages,
          panels: panels.map((p) => ({
            page: p.page,
            index: p.index,
            camera: p.camera,
            prompt: p.prompt,
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
                <Button onClick={handleSave} disabled={saving || savedId !== null}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {savedId ? "Saved" : "Save to library"}
                </Button>
              </div>
              <ComicStage
                title={config.story.slice(0, 60) + (config.story.length > 60 ? "…" : "")}
                style={config.style}
                layout={config.layout}
                panels={panels}
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
