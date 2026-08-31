import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileDown,
  Move,
  Pencil,
  RefreshCw,
  RotateCcw,
  Share2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ART_STYLES, type Bubble, type LayoutId, type Panel } from "@/lib/comic";
import { cn } from "@/lib/utils";

interface ComicStageProps {
  title: string;
  style: string;
  layout: LayoutId;
  panels: Panel[];
  onPatchBubble: (panelId: string, bubbleId: string, patch: Partial<Bubble>) => void;
  onResetBubbles: (panelId: string) => void;
  onRegenerate: (panelId: string) => void;
  onStartOver: () => void;
  /** True while pass 1 (the script) is still being written and no panels exist yet. */
  scripting?: boolean;
}

function bubbleShape(kind: Bubble["kind"]) {
  if (kind === "caption") {
    return "rounded-sm bg-gold text-gold-foreground font-display text-[11px] font-bold uppercase tracking-wide";
  }
  if (kind === "thought") {
    return "rounded-[999px] bg-paper text-paper-foreground font-comic text-[13px] italic";
  }
  return "rounded-2xl bg-paper text-paper-foreground font-comic text-[13px] font-bold";
}

/**
 * Bubbles are snapped into safe edge slots instead of the model's raw x/y, so
 * they never land on top of faces or the middle of the artwork — until the
 * reader drags one, after which its own x/y (percent of the panel) wins.
 */
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function SpeechBubble({
  bubble,
  slot,
  containerRef,
  onChange,
  onMove,
}: {
  bubble: Bubble;
  slot: React.CSSProperties;
  containerRef: React.RefObject<HTMLElement | null>;
  onChange: (text: string) => void;
  onMove: (x: number, y: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(bubble.text);
  const movedRef = useRef(false);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft !== bubble.text) {
      onChange(draft.trim());
      toast.success("Bubble updated");
    } else {
      setDraft(bubble.text);
    }
  }

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

  return (
    <div
      className={cn("absolute z-10 max-w-[38%]", dragging && "z-30 select-none")}
      style={slot}
    >
      {editing ? (
        <div className="flex items-start gap-1">
          <textarea
            autoFocus
            value={draft}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(bubble.text);
                setEditing(false);
              }
            }}
            className="w-44 resize-none rounded-lg border-2 border-primary bg-paper p-2 font-comic text-[13px] text-paper-foreground outline-none"
          />
          <span className="mt-1 rounded bg-primary p-1 text-primary-foreground">
            <Check className="size-3" />
          </span>
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          title="Drag to reposition · click to edit"
          className={cn(
            "group/bubble touch-none border-2 border-ink px-3 py-2 text-left leading-tight shadow-[2px_2px_0_var(--color-ink)] transition-transform",
            dragging ? "cursor-grabbing scale-[1.04]" : "cursor-grab hover:scale-[1.03]",
            bubbleShape(bubble.kind),
          )}
        >
          {bubble.text}
          <Move
            data-print-hide
            className="ml-1 inline size-2.5 opacity-0 transition-opacity group-hover/bubble:opacity-70"
          />
        </button>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden rounded-md border-2 border-ink/70 ink-sweep">
      <Pencil className="size-6 text-muted-foreground sketch-pulse" />
    </div>
  );
}

function PanelView({
  panel,
  onPatchBubble,
  onResetBubbles,
  onRegenerate,
}: {
  panel: Panel;
  onPatchBubble: (bubbleId: string, patch: Partial<Bubble>) => void;
  onResetBubbles: () => void;
  onRegenerate: () => void;
}) {
  const frameRef = useRef<HTMLElement | null>(null);
  const hasPinned = panel.bubbles.some((b) => b.pinned);

  function downloadPanel() {
    if (!panel.image) return;
    const a = document.createElement("a");
    a.href = panel.image;
    a.download = `comic-crafter-page${panel.page}-panel${panel.index + 1}.jpg`;
    a.click();
  }

  return (
    <figure ref={frameRef} className="group relative aspect-[8/5] overflow-hidden rounded-md">
      {panel.status === "ready" && panel.image ? (
        <>
          <img
            src={panel.image}
            alt={`${panel.camera}: ${panel.prompt}`}
            loading="lazy"
            draggable={false}
            className="size-full rounded-md border-2 border-ink object-cover"
          />
          {bubbleSlots(panel.bubbles).map(({ bubble: b, slot }) => (
            <SpeechBubble
              key={b.id}
              bubble={b}
              slot={slot}
              containerRef={frameRef}
              onChange={(text) => onPatchBubble(b.id, { text })}
              onMove={(x, y) => onPatchBubble(b.id, { x, y, pinned: true })}
            />
          ))}

          <figcaption
            data-print-hide
            className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-ink/85 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-paper">
              {panel.camera}
            </span>
            <span className="flex gap-1">
              {hasPinned && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-7"
                  onClick={onResetBubbles}
                  title="Reset bubble layout"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="secondary"
                className="size-7"
                onClick={onRegenerate}
                title="Regenerate this panel"
              >
                <RefreshCw className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="size-7"
                onClick={downloadPanel}
                title="Download this panel"
              >
                <Download className="size-3.5" />
              </Button>
            </span>
          </figcaption>
        </>
      ) : (
        <PanelSkeleton />
      )}
    </figure>
  );
}


function pageGridClass(layout: LayoutId, count: number) {
  if (layout === "splash" || count === 1) return "grid-cols-1";
  if (layout === "manga-6" || layout === "storyboard") return "grid-cols-2 sm:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2";
}

export function ComicStage({
  title,
  style,
  layout,
  panels,
  onPatchBubble,
  onResetBubbles,

  onRegenerate,
  onStartOver,
  scripting = false,
}: ComicStageProps) {
  const [mode, setMode] = useState<"scroll" | "page">("scroll");
  const [current, setCurrent] = useState(1);

  const styleName = ART_STYLES.find((s) => s.id === style)?.name ?? style;
  const pages = [...new Set(panels.map((p) => p.page))].sort((a, b) => a - b);
  const ready = panels.filter((p) => p.status === "ready").length;
  const done = panels.length > 0 && ready === panels.length;
  const visiblePages = mode === "page" ? pages.filter((p) => p === current) : pages;

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    navigator.clipboard.writeText(url);
    toast.success("POW! Share link copied to clipboard");
  }

  return (
    <div className="grid gap-6">
      <div
        data-print-hide
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {panels.length === 0
              ? `${styleName} · breaking your story into panels…`
              : `${styleName} · ${pages.length} page${pages.length > 1 ? "s" : ""} · ${ready}/${panels.length} panels drawn`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setMode("scroll")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "scroll" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              Gallery
            </button>
            <button
              type="button"
              onClick={() => setMode("page")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "page" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              Page view
            </button>
          </div>

          <Button variant="outline" size="sm" className="gap-2" onClick={share}>
            <Share2 className="size-4" />
            Share
          </Button>
          <Button
            size="sm"
            className="gap-2"
            disabled={!done}
            onClick={() => window.print()}
            title={done ? "Save the whole comic as a PDF" : "Wait for all panels to finish"}
          >
            <FileDown className="size-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {panels.length === 0 && (scripting || !done) && (
        <div
          data-print-hide
          className="rounded-xl border border-border bg-card p-8 text-center"
          role="status"
          aria-live="polite"
        >
          <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="font-medium">Writing your script…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The AI is breaking your story into panels, shots and dialogue. This usually takes
            20–40 seconds — panel art starts appearing right after.
          </p>
        </div>
      )}

      {panels.length > 0 && !done && (
        <div data-print-hide className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Inking your panels…</span>
            <span className="text-muted-foreground">
              {ready} of {panels.length}
            </span>
          </div>
          <div className="flex gap-1">
            {panels.map((p) => (
              <span
                key={p.id}
                className={cn(
                  "h-2.5 flex-1 rounded-[2px] border border-ink/30",
                  p.status === "ready" ? "bg-success" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {visiblePages.map((page) => {
        const pagePanels = panels.filter((p) => p.page === page);
        return (
          <article key={page} className="paper-page rounded-xl p-5 sm:p-7">
            <header className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-paper-foreground/70">
                Page {page}
              </h3>
              <span className="text-xs text-paper-foreground/50">{title}</span>
            </header>
            <div className={cn("grid gap-3", pageGridClass(layout, pagePanels.length))}>
              {pagePanels.map((panel) => (
                <PanelView
                  key={panel.id}
                  panel={panel}
                  onPatchBubble={(bubbleId, patch) => onPatchBubble(panel.id, bubbleId, patch)}
                  onResetBubbles={() => onResetBubbles(panel.id)}

                  onRegenerate={() => onRegenerate(panel.id)}
                />
              ))}
            </div>
          </article>
        );
      })}

      {mode === "page" && (
        <div data-print-hide className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            disabled={current <= 1}
            onClick={() => setCurrent((c) => c - 1)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {current} of {pages.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={current >= pages.length}
            onClick={() => setCurrent((c) => c + 1)}
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      <div data-print-hide className="flex justify-center pb-6">
        <Button variant="ghost" onClick={onStartOver} className="gap-2">
          <Pencil className="size-4" />
          Edit prompt / start a new comic
        </Button>
      </div>
    </div>
  );
}

export type { ComicStageProps };
