// ---------- Style switcher ----------
// Shared across every page. Picks a theme, applies it via a `data-theme`
// attribute on <html>, and remembers the choice in localStorage so it
// carries over as you move between pages (each page is a separate
// document load, so there's no other way to persist the pick).

const THEMES = [
  { value: "classic", label: "90s Ticket Stub (Classic)" },
  { value: "socal", label: "SoCal 80s Computer" },
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
