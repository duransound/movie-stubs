// ---------- Configuration ----------

const WATCHLIST_URL = "data/watchlist.json";

function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

// ---------- Pitch form ----------
// Deliberately simple — no OMDb search step, just plain fields and a few
// dropdowns. (add.html and watchlist.html still have the OMDb lookup, if
// you want that richer flow elsewhere.)

function showSuggestFormError(message) {
  const el = document.getElementById("suggest-form-error");
  el.textContent = message;
  el.hidden = false;
}

function clearSuggestFormError() {
  const el = document.getElementById("suggest-form-error");
  el.hidden = true;
  el.textContent = "";
}

document.getElementById("suggest-form").addEventListener("submit", (e) => {
  e.preventDefault();
  clearSuggestFormError();

  const title = document.getElementById("suggest-title").value.trim();
  const year = document.getElementById("suggest-year").value.trim();
  const genre = document.getElementById("suggest-genre").value;
  const mood = document.getElementById("suggest-mood").value;
  const suggestedBy = document.getElementById("suggest-by").value;

  if (!title) return showSuggestFormError("Enter a title first.");
  if (!year || Number(year) < 1888) return showSuggestFormError("Enter a valid year.");
  if (!publishWorkerConfigured()) return showSuggestFormError("Set PUBLISH_WORKER_URL in config.public.js first — see README.");

  const entry = { title, year: Number(year) };
  if (genre) entry.genre = genre;
  if (mood) entry.mood = mood;
  if (suggestedBy) entry.suggestedBy = suggestedBy;

  publishSuggestionToGithub(entry);
});

// ---------- Publish via the publish worker (same approach as watchlist.js) ----------
// The site never talks to GitHub with a write token itself — it posts the
// new entry to a small Cloudflare Worker (PUBLISH_WORKER_URL, set in
// config.public.js), which holds the real GitHub token privately and does
// the actual write. No device needs its own copy of a secret. See
// README.md's "Publishing without a token on every device" section.

function publishWorkerConfigured() {
  return typeof PUBLISH_WORKER_URL !== "undefined" && PUBLISH_WORKER_URL && PUBLISH_WORKER_URL.trim() !== "";
}

function setSuggestPublishStatus(message, isError = false, isSuccess = false) {
  const el = document.getElementById("suggest-publish-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.toggle("success", isSuccess);
}

async function publishSuggestionToGithub(entry) {
  const addBtn = document.getElementById("suggest-add-btn");
  addBtn.disabled = true;
  setSuggestPublishStatus(`Adding "${entry.title}"…`);

  try {
    const res = await fetch(PUBLISH_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(typeof PUBLISH_SITE_KEY !== "undefined" && PUBLISH_SITE_KEY ? { "X-Site-Key": PUBLISH_SITE_KEY } : {}),
      },
      body: JSON.stringify({
        path: "data/watchlist.json",
        entry,
        message: `Suggest "${entry.title}" via suggest.html`,
      }),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.ok) {
      throw new Error(result.error || `Publish failed (${res.status}).`);
    }

    setSuggestPublishStatus(
      `✓ Added "${entry.title}" to Coming Attractions.`,
      false,
      true
    );

    document.getElementById("suggest-form").reset();

    // Refresh the picker pool so a suggestion just added is immediately
    // pickable (the worker already wrote it to GitHub for real).
    allWatchlist = [...allWatchlist, entry];
    populatePickerFilters();
  } catch (err) {
    console.error(err);
    setSuggestPublishStatus(err.message || "Add failed. Try again in a moment.", true);
  } finally {
    addBtn.disabled = false;
  }
}

if (!publishWorkerConfigured()) {
  document.getElementById("suggest-add-btn").disabled = true;
  document.getElementById("suggest-add-btn").title = "Set PUBLISH_WORKER_URL in config.public.js to enable this — see README.";
}

// ---------- Random picker ----------

let allWatchlist = [];

function populatePickerFilters() {
  const genreSel = document.getElementById("picker-genre");
  const moodSel = document.getElementById("picker-mood");
  const bySel = document.getElementById("picker-by");

  const genres = [...new Set(allWatchlist.map((m) => m.genre).filter(Boolean))].sort();
  const moods = [...new Set(allWatchlist.map((m) => m.mood).filter(Boolean))].sort();
  const suggesters = [...new Set(allWatchlist.map((m) => m.suggestedBy).filter(Boolean))].sort();

  const rebuild = (select, values, labelFn) => {
    const current = select.value;
    select.innerHTML = `<option value="">Any</option>`;
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = labelFn ? labelFn(v) : v;
      select.appendChild(opt);
    });
    if (values.includes(current)) select.value = current;
  };

  rebuild(genreSel, genres);
  rebuild(moodSel, moods);
  rebuild(bySel, suggesters, (v) => (v === "mollie" ? "Mollie" : v === "ian" ? "Ian" : v));
}

async function getPickerPosterUrl(movie) {
  if (movie.posterUrl) return movie.posterUrl;
  const key = getOmdbKey();
  if (!key) return null;

  const cacheKey = `poster:${movie.title}:${movie.year}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached === "none" ? null : cached;

  try {
    const year = String(movie.year).match(/^\d{4}/)?.[0] || "";
    const searchUrl = `https://www.omdbapi.com/?apikey=${key}&t=${encodeURIComponent(movie.title)}${year ? `&y=${year}` : ""}`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    let poster = null;
    if (data.Poster && data.Poster !== "N/A") {
      poster = data.Poster;
    } else if (data.imdbID) {
      poster = `https://img.omdbapi.com/?i=${data.imdbID}&h=600&apikey=${key}`;
    }
    localStorage.setItem(cacheKey, poster || "none");
    return poster;
  } catch (err) {
    console.warn("Poster fetch failed for", movie.title, err);
    return null;
  }
}

async function pickRandom() {
  const genre = document.getElementById("picker-genre").value;
  const mood = document.getElementById("picker-mood").value;
  const suggestedBy = document.getElementById("picker-by").value;

  const pool = allWatchlist.filter((m) => {
    if (genre && m.genre !== genre) return false;
    if (mood && m.mood !== mood) return false;
    if (suggestedBy && m.suggestedBy !== suggestedBy) return false;
    return true;
  });

  const resultEl = document.getElementById("picker-result");
  const emptyEl = document.getElementById("picker-empty");

  if (pool.length === 0) {
    resultEl.classList.remove("visible");
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const pick = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById("picker-result-title").textContent = pick.title;
  const metaBits = [pick.year];
  if (pick.genre) metaBits.push(pick.genre);
  document.getElementById("picker-result-meta").textContent = metaBits.join(" · ");
  document.getElementById("picker-result-log").href =
    `add.html?title=${encodeURIComponent(pick.title)}&year=${encodeURIComponent(pick.year)}`;

  const posterEl = document.getElementById("picker-result-poster");
  posterEl.innerHTML = "";
  const poster = await getPickerPosterUrl(pick);
  if (poster) {
    const img = document.createElement("img");
    img.src = poster;
    img.alt = `${pick.title} poster`;
    img.onerror = () => { posterEl.innerHTML = ""; };
    posterEl.appendChild(img);
  }

  // Restart the reveal animation even if the same card is picked twice in a row.
  resultEl.classList.remove("visible");
  void resultEl.offsetWidth;
  resultEl.classList.add("visible");
}

document.getElementById("picker-pick-btn").addEventListener("click", pickRandom);

async function init() {
  try {
    const res = await fetch(WATCHLIST_URL, { cache: "no-store" });
    allWatchlist = await res.json();
  } catch (err) {
    console.error("Could not load watchlist.json", err);
    allWatchlist = [];
  }

  populatePickerFilters();
}

init();
