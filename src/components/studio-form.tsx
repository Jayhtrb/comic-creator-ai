import {
  Camera,
  Dice5,
  Heart,
  LayoutGrid,
  Palette,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ART_STYLES,
  DEMO_CHARACTERS,
  LAYOUTS,
  STORY_PLACEHOLDER,
  SURPRISE_PROMPTS,
  type ArtStyleId,
  type CharacterRef,
  type LayoutId,
} from "@/lib/comic";
import { cn } from "@/lib/utils";

export interface GenerationConfig {
  story: string;
  style: ArtStyleId;
  layout: LayoutId;
  pages: number;
  characterIds: string[];
  /** Name + physical description of each selected cast member, for consistency. */
  characters: { name: string; note: string }[];
  seed: string;
}

function SectionHeading({
  icon: Icon,
  step,
  title,
  hint,
}: {
  icon: typeof Pencil;
  step: number;
  title: string;
  hint: string;
}) {
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

export function StudioForm({ onGenerate }: { onGenerate: (config: GenerationConfig) => void }) {
  const [story, setStory] = useState("");
  const [style, setStyle] = useState<ArtStyleId>("cyberpunk");
  const [layout, setLayout] = useState<LayoutId>("auto");
  const [pages, setPages] = useState(4);
  const [seed, setSeed] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [characters, setCharacters] = useState<CharacterRef[]>(DEMO_CHARACTERS);
  const [selected, setSelected] = useState<string[]>(["kestrel"]);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeStyle = ART_STYLES.find((s) => s.id === style)!;

  function toggleCharacter(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  }

  function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0]!;
    const url = URL.createObjectURL(file);
    const id = `local-${Date.now()}`;
    setCharacters((prev) => [
      ...prev,
      { id, name: file.name.replace(/\.[^.]+$/, ""), note: "Uploaded reference", images: [url] },
    ]);
    setSelected((prev) => (prev.length >= 3 ? prev : [...prev, id]));
    toast.success("Reference added to your Character Library");
  }

  function surpriseMe() {
    const prompt = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)]!;
    const randomStyle = ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)]!;
    setStory(prompt);
    setStyle(randomStyle.id);
    toast("BAM! A fresh idea in " + randomStyle.name);
  }

  function submit() {
    if (story.trim().length < 12) {
      toast.error("Give the story a little more to work with (12+ characters).");
      return;
    }
    onGenerate({ story, style, layout, pages, characterIds: selected, seed });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionHeading
          icon={Pencil}
          step={1}
          title="Your story"
          hint="A plot, a scene, or a full script — the AI breaks it into panels."
        />
        <Textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder={STORY_PLACEHOLDER}
          rows={6}
          className="field-line resize-none rounded-none border-0 border-b border-input bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{story.length} characters</span>
          <Button variant="outline" size="sm" onClick={surpriseMe} className="gap-2">
            <Dice5 className="size-4" />
            Surprise Me!
          </Button>
        </div>
      </Card>

      <Card id="library">
        <SectionHeading
          icon={Camera}
          step={2}
          title="Character references"
          hint="Pick up to 3. Every panel is generated against these for a consistent cast."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {characters.map((char) => {
            const isOn = selected.includes(char.id);
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => toggleCharacter(char.id)}
                className={cn(
                  "group overflow-hidden rounded-xl border-2 bg-card text-left transition-all",
                  isOn
                    ? "border-primary shadow-[var(--shadow-card)]"
                    : "border-border hover:border-input",
                )}
                aria-pressed={isOn}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={char.images[0]}
                    alt={char.name}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isOn && (
                    <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Heart className="size-3.5 fill-current" />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{char.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{char.note}</p>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="size-5" />
            <span className="text-sm font-medium">Upload reference</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </Card>

      <Card>
        <SectionHeading
          icon={Palette}
          step={3}
          title="Art style"
          hint={`Selected: ${activeStyle.name} — ${activeStyle.blurb}`}
        />
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
                  isOn
                    ? "border-primary shadow-[var(--shadow-card)]"
                    : "border-border hover:border-input",
                )}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={s.thumb}
                    alt={`${s.name} art style example`}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.blurb}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionHeading
          icon={LayoutGrid}
          step={4}
          title="Pages & layout"
          hint="Set the length, then choose how each page is carved into panels."
        />

        <div className="mb-7">
          <div className="mb-3 flex items-baseline justify-between">
            <Label className="text-sm font-medium">Pages</Label>
            <span className="font-display text-2xl font-bold text-primary">{pages}</span>
          </div>
          <Slider
            value={[pages]}
            onValueChange={([v]) => setPages(v ?? 1)}
            min={1}
            max={8}
            step={1}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>1 page</span>
            <span>8 pages</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LAYOUTS.map((l) => {
            const isOn = l.id === layout;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayout(l.id)}
                aria-pressed={isOn}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-all",
                  isOn ? "border-primary bg-accent/60" : "border-border hover:border-input",
                )}
              >
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">{l.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="size-4" />
            Advanced options
          </button>
          {advanced && (
            <div className="mt-4 max-w-xs">
              <Label htmlFor="seed" className="text-sm font-medium">
                Seed
              </Label>
              <Input
                id="seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Leave blank for random"
                className="field-line mt-1 h-9 rounded-none border-0 border-b border-input bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Reuse a seed to get repeatable results across runs.
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-col items-center gap-3 pb-4 pt-2">
        <Button
          size="lg"
          onClick={submit}
          className="h-12 w-full gap-2 px-8 text-base transition-transform hover:scale-[1.02] sm:w-auto"
        >
          <Sparkles className="size-5" />
          Generate Comic
        </Button>
        <p className="text-xs text-muted-foreground">
          {pages} page{pages > 1 ? "s" : ""} · {activeStyle.name} · {selected.length} character
          reference{selected.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
