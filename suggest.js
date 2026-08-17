// ---------- Configuration ----------

const WATCHLIST_URL = "data/watchlist.json";

function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

// ---------- Pitch form: OMDb lookup (same approach as watchlist.js) ----------

let suggestLookupResult = { genre: "", director: "", productionCompany: "" };

function setSuggestLookupStatus(message, isError = false) {
  const el = document.getElementById("suggest-lookup-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function clearSuggestLookupResults() {
  const container = document.getElementById("suggest-lookup-results");
  container.innerHTML = "";
  container.hidden = true;
}

function renderSuggestLookupResults(results) {
  const container = document.getElementById("suggest-lookup-results");
  container.innerHTML = "";

  results.slice(0, 10).forEach((r) => {
    const hasPoster = r.Poster && r.Poster !== "N/A";
    const item = document.createElement("button");
    item.type = "button";
    item.className = "lookup-result";
    item.innerHTML = `
      ${hasPoster
        ? `<img src="${r.Poster}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className: 'lookup-result-noposter', textContent: 'No art'}))" />`
        : `<span class="lookup-result-noposter">No art</span>`}
      <span class="lookup-result-info">
        <span class="lookup-result-title">${r.Title}</span>
        <span class="lookup-result-year">${r.Year}</span>
      </span>
    `;
    item.addEventListener("click", () => selectSuggestResult(r.imdbID));
    container.appendChild(item);
  });

  container.hidden = results.length === 0;
}

async function selectSuggestResult(imdbID) {
  const key = getOmdbKey();
  setSuggestLookupStatus("Loading details…");

  try {
    const url = `https://www.omdbapi.com/?apikey=${key}&i=${imdbID}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False") {
      setSuggestLookupStatus(data.Error || "Couldn't load that title.", true);
      return;
    }

    document.getElementById("suggest-title").value = data.Title;
    if (data.Year) document.getElementById("suggest-year").value = parseInt(data.Year, 10) || data.Year;

    suggestLookupResult = {
      genre: data.Genre && data.Genre !== "N/A" ? data.Genre.split(",")[0].trim() : "",
      director: data.Director && data.Director !== "N/A" ? data.Director : "",
      productionCompany: data.Production && data.Production !== "N/A" ? data.Production : "",
    };

    setSuggestLookupStatus(`Selected "${data.Title}" (${data.Year}).`);
    clearSuggestLookupResults();
  } catch (err) {
    console.error(err);
    setSuggestLookupStatus("Lookup failed. Check your connection.", true);
  }
}

document.getElementById("suggest-lookup-btn").addEventListener("click", async () => {
  const title = document.getElementById("suggest-title").value.trim();
  const key = getOmdbKey();

  if (!title) return setSuggestLookupStatus("Enter a title first.", true);
  if (!key) return setSuggestLookupStatus("No OMDb key configured — see config.public.js.", true);

  setSuggestLookupStatus("Searching…");
  clearSuggestLookupResults();

  try {
    const url = `https://www.omdbapi.com/?apikey=${key}&s=${encodeURIComponent(title)}&type=movie`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False" || !data.Search || data.Search.length === 0) {
      setSuggestLookupStatus(data.Error || "No matches found on OMDb.", true);
      return;
    }

    renderSuggestLookupResults(data.Search);
    setSuggestLookupStatus(
      `${data.Search.length} match${data.Search.length === 1 ? "" : "es"} — pick the right one below.`
    );
  } catch (err) {
    console.error(err);
    setSuggestLookupStatus("Search failed. Check your connection.", true);
  }
});

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
  const mood = document.getElementById("suggest-mood").value;
  const suggestedBy = document.getElementById("suggest-by").value;

  if (!title) return showSuggestFormError("Enter a title first.");
  if (!year || Number(year) < 1888) return showSuggestFormError("Enter a valid year.");
  if (!publishWorkerConfigured()) return showSuggestFormError("Set PUBLISH_WORKER_URL in config.public.js first — see README.");

  const entry = { title, year: Number(year) };
  if (suggestLookupResult.genre) entry.genre = suggestLookupResult.genre;
  if (suggestLookupResult.director) entry.director = suggestLookupResult.director;
  if (suggestLookupResult.productionCompany) entry.productionCompany = suggestLookupResult.productionCompany;
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
    suggestLookupResult = { genre: "", director: "", productionCompany: "" };
    setSuggestLookupStatus("");
    clearSuggestLookupResults();

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
    const res = await fetch(WATCHLIST_URL);
    allWatchlist = await res.json();
  } catch (err) {
    console.error("Could not load watchlist.json", err);
    allWatchlist = [];
  }

  populatePickerFilters();
}

init();
