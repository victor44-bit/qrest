// components/ThemeToggle.tsx
"use client";

import * as React from "react";

type Mode = "light" | "dark" | "system";
const KEY: string = "qrest_theme";

function getEffective(mode: Mode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function apply(mode: Mode) {
  const effective = getEffective(mode);
  document.documentElement.classList.toggle("dark", effective === "dark");
}

export default function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>(() => "system"); // default until mount

  // Mount: read saved mode, apply immediately
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = (localStorage.getItem(KEY) as Mode | null) ?? "system";
      setMode(saved);
      apply(saved);
    } catch {
      // ignore
    }
  }, []);

  // Keep in sync with OS changes when on "system"
  React.useEffect(() => {
    if (!mounted) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) as Mode | null) ?? "system" === "system") {
        apply("system");
        // force a render so the icon updates
        setMode((prev) => prev);
      }
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [mounted]);

  // Cross-tab sync
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const next = (e.newValue as Mode | null) ?? "system";
        setMode(next);
        apply(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const effective = mounted ? getEffective(mode) : "light";
  const isDark = effective === "dark";

  const toggle = () => {
    const next: Mode = isDark ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    setMode(next);       // re-render immediately
    apply(next);         // flip the `<html>` class right now
  };

  if (!mounted) {
    return (
      <button
        className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
        aria-label="Toggle theme"
        disabled
      >
        …
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-300 bg-white text-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      title="Toggle dark / light"
      aria-label="Toggle theme"
    >
      {isDark ? "🌙" : "☀️"}
    </button>
  );
}
