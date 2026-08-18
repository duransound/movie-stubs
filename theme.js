// ---------- Style switcher ----------
// Shared across every page. Picks a theme, applies it via a `data-theme`
// attribute on <html>, and remembers the choice in localStorage so it
// carries over as you move between pages (each page is a separate
// document load, so there's no other way to persist the pick).

const THEMES = [
  { value: "classic", label: "1990s" },
  { value: "socal", label: "1980s" },
  { value: "cinematic70s", label: "1970s" },
  { value: "midcentury", label: "1960s" },
  { value: "vintage50s", label: "1950s" },
  { value: "artdeco", label: "1930s" },
  { value: "mgm1920s", label: "1920s" },
  { value: "unitedartists", label: "United Artists Theatres" },
];

const THEME_KEY = "movieStubTheme";

function getSavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.some((t) => t.value === saved) ? saved : "classic";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// Applied immediately (theme.js is loaded synchronously in <head>) so
// there's no flash of the default theme before this runs.
applyTheme(getSavedTheme());

function initThemePicker() {
  const select = document.getElementById("theme-select");
  if (!select) return;

  THEMES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    select.appendChild(opt);
  });

  select.value = getSavedTheme();

  select.addEventListener("change", () => {
    localStorage.setItem(THEME_KEY, select.value);
    applyTheme(select.value);
  });
}

document.addEventListener("DOMContentLoaded", initThemePicker);
