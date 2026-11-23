/**
 * The visitor's light/dark choice. "system" follows the OS; "light"/"dark"
 * force a theme by setting `data-theme` on `<html>` (see `globals.css`).
 *
 * The choice lives in localStorage, not a cookie: reading a cookie in the
 * root layout would make every page dynamic. `themeInitScript` applies it
 * before first paint instead, so a forced theme never flashes.
 */
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_STORAGE_KEY = "theme";

/** Anything not a forced theme (missing, stale, tampered) means "system". */
export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/** Inline `<head>` script: sets `data-theme` before the page paints. Must
 * not throw — storage can be blocked (private mode, disabled site data). */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
