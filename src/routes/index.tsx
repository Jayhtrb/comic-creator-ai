import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Sparkles, Users } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { ART_STYLES } from "@/lib/comic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comic Crafter AI — Turn a story into a finished comic" },
      {
        name: "description",
        content:
          "Write a story, pick an art style, keep your characters consistent, and generate a full comic book you can edit and export as a PDF.",
      },
      { property: "og:title", content: "Comic Crafter AI — Turn a story into a finished comic" },
      {
        property: "og:description",
        content:
          "An AI comic studio: consistent characters, 12 art styles, editable speech bubbles, PDF export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-[1200px] px-6 py-14 sm:py-20">
        <section className="max-w-3xl">
          <p className="mb-3 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            AI comic studio · your own Gemini key
          </p>
          <h1 className="font-display text-4xl font-bold leading-[1.08] sm:text-6xl">
            Turn a story into a
            <span className="text-primary"> finished comic.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Write the plot, upload your cast, choose a style. Comic Crafter breaks the story into
            panels, keeps every character on-model, and hands you an editable, printable book.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/studio">Open the studio</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-16 grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Script to panels",
              body: "Your story is broken into paced panels with camera angles and dialogue.",
            },
            {
              icon: Users,
              title: "Consistent cast",
              body: "Reference images keep every character on-model across the whole book.",
            },
            {
              icon: Palette,
              title: "12 art styles",
              body: "Manga, noir, watercolor, webtoon, retro print and more — one click each.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
            >
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-lg font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold">Pick a look</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {ART_STYLES.map((style) => (
              <li key={style.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <img
                  src={style.thumb}
                  alt={`${style.name} art style example`}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <p className="px-3 py-2 text-sm font-medium">{style.name}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
