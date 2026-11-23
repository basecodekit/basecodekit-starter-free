"use client";

import { useSyncExternalStore } from "react";
import { THEME_CHOICES, THEME_STORAGE_KEY, type ThemeChoice, parseThemeChoice } from "@/core/theme";
import { cn } from "@/lib/utils";

const LABELS: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

const ICONS: Record<ThemeChoice, string> = {
  system: "M4 5h16v11H4zM9 20h6M12 16v4",
  light: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4",
  dark: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
};

// Storage can throw (private mode, blocked site data): keep the choice in
// memory then, so the switch still works for this page view.
let memoryChoice: ThemeChoice = "system";
const listeners = new Set<() => void>();

function readTheme(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return memoryChoice;
  }
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it: follow along.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(readTheme());
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(choice: ThemeChoice) {
  memoryChoice = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Kept in memory only.
  }
  applyTheme(choice);
  for (const listener of listeners) listener();
}

/** The current choice; "system" on the server and until hydration. */
export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "system");
}

export function ThemeIcon({ choice, className = "size-4" }: { choice: ThemeChoice; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICONS[choice]} />
    </svg>
  );
}

/**
 * System / Light / Dark segmented switch. Native radios, so arrow keys move
 * between choices. Hidden under a style pack that is always one theme
 * (it sets `--theme-switch-display: none`).
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const theme = useTheme();
  return (
    <fieldset className={cn("[display:var(--theme-switch-display)] items-center justify-between gap-2", className)}>
      <legend className="sr-only">Theme</legend>
      <span aria-hidden="true" className="text-sm">
        Theme
      </span>
      <div className="flex rounded-md border p-0.5">
        {THEME_CHOICES.map((choice) => (
          <label
            key={choice}
            title={LABELS[choice]}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-sm p-1 text-muted-foreground has-focus-visible:outline-2 hover:text-foreground",
              theme === choice && "bg-accent text-accent-foreground",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={choice}
              checked={theme === choice}
              onChange={() => setTheme(choice)}
              className="sr-only"
            />
            <ThemeIcon choice={choice} className="size-3.5" />
            <span className="sr-only">{LABELS[choice]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
