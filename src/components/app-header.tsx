import { Link } from "@tanstack/react-router";
import { Moon, PencilRuler, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/** Light/dark toggle. Reads storage after mount to avoid hydration mismatch. */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("comic-crafter-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    setMounted(true);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("comic-crafter-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mounted && dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PencilRuler className="size-4.5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Comic Crafter <span className="text-primary">AI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Studio
          </Link>
          <a
            href="#library"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Characters
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
