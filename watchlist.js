// ---------- Configuration ----------

const WATCHLIST_URL = "data/watchlist.json";

function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

// ---------- Poster + plot lookup ----------
// Same cache key ("details2:") as app.js/stats.js use for ticket details,
// so a movie already looked up on the ticket wall doesn't cost a second
// OMDb call here.

const EMPTY_WATCH_DETAILS = { poster: null, plot: "" };

async function getWatchDetails(movie) {
  const cacheKey = `details2:${movie.title}:${movie.year}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { poster: parsed.poster || movie.posterUrl || null, plot: parsed.plot || "" };
    } catch {
      // fall through and refetch on a bad cache entry
    }
  }

  const key = getOmdbKey();
  if (!key) return { ...EMPTY_WATCH_DETAILS, poster: movie.posterUrl || null };

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

    const details = {
      poster,
      genre: data.Genre && data.Genre !== "N/A" ? data.Genre : "",
      director: data.Director && data.Director !== "N/A" ? data.Director : "",
      plot: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
      imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : "",
      awards: data.Awards && data.Awards !== "N/A" ? data.Awards : "",
    };

    localStorage.setItem(cacheKey, JSON.stringify(details));
    return { poster: details.poster, plot: details.plot };
  } catch (err) {
    console.warn("OMDb details fetch failed for", movie.title, err);
    return { ...EMPTY_WATCH_DETAILS, poster: movie.posterUrl || null };
  }
}

// ---------- Rendering ----------

async function cardElement(movie) {
  const { poster, plot } = await getWatchDetails(movie);

  const el = document.createElement("article");
  el.className = "watch-card";
  if (justAddedKey && `${movie.title}|${movie.year}` === justAddedKey) {
    el.classList.add("just-added");
    el.id = "watch-just-added-card";
  }

  el.innerHTML = `
    <div class="watch-poster">
      ${poster
        ? `<img src="${poster}" alt="${movie.title} poster" loading="lazy" onerror="this.parentElement.innerHTML='<span class=&quot;watch-poster-fallback&quot;>${movie.title}</span>'" />`
        : `<span class="watch-poster-fallback">${movie.title}</span>`}
    </div>
    <div class="watch-info">
      <h2 class="watch-title">${movie.title}</h2>
      <div class="watch-meta">
        <span>${movie.year}</span>
        ${movie.genre ? `<span class="watch-genre">${movie.genre}</span>` : ""}
      </div>
      ${movie.director ? `<p class="watch-director">Dir. ${movie.director}</p>` : ""}
      ${plot ? `<p class="watch-plot">${plot}</p>` : ""}
      ${movie.mood || movie.suggestedBy ? `
        <div class="watch-tags">
          ${movie.mood ? `<span class="watch-mood">${movie.mood}</span>` : ""}
          ${movie.suggestedBy ? `<span class="watch-suggested-by ${movie.suggestedBy}">${movie.suggestedBy === "mollie" ? "Mollie's pick" : "Ian's pick"}</span>` : ""}
        </div>
      ` : ""}
      <a class="btn secondary watch-log-btn" href="add.html?title=${encodeURIComponent(movie.title)}&year=${encodeURIComponent(movie.year)}">Log this</a>
    </div>
  `;

  return el;
}

// ---------- Add a movie ----------

let watchLookupResult = { genre: "", director: "", productionCompany: "" };
let justAddedKey = null;

function setWatchLookupStatus(message, isError = false) {
  const el = document.getElementById("watch-lookup-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function clearWatchLookupResults() {
  const container = document.getElementById("watch-lookup-results");
  container.innerHTML = "";
  container.hidden = true;
}

function renderWatchLookupResults(results) {
  const container = document.getElementById("watch-lookup-results");
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
    item.addEventListener("click", () => selectWatchResult(r.imdbID));
    container.appendChild(item);
  });

  container.hidden = results.length === 0;
}

async function selectWatchResult(imdbID) {
  const key = getOmdbKey();
  setWatchLookupStatus("Loading details…");

  try {
    const url = `https://www.omdbapi.com/?apikey=${key}&i=${imdbID}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False") {
      setWatchLookupStatus(data.Error || "Couldn't load that title.", true);
      return;
    }

    document.getElementById("watch-title").value = data.Title;
    if (data.Year) document.getElementById("watch-year").value = parseInt(data.Year, 10) || data.Year;

    watchLookupResult = {
      genre: data.Genre && data.Genre !== "N/A" ? data.Genre.split(",")[0].trim() : "",
      director: data.Director && data.Director !== "N/A" ? data.Director : "",
      productionCompany: data.Production && data.Production !== "N/A" ? data.Production : "",
    };

    setWatchLookupStatus(`Selected "${data.Title}" (${data.Year}).`);
    clearWatchLookupResults();
  } catch (err) {
    console.error(err);
    setWatchLookupStatus("Lookup failed. Check your connection.", true);
  }
}

document.getElementById("watch-lookup-btn").addEventListener("click", async () => {
  const title = document.getElementById("watch-title").value.trim();
  const key = getOmdbKey();

  if (!title) return setWatchLookupStatus("Enter a title first.", true);
  if (!key) return setWatchLookupStatus("No OMDb key configured — see config.public.js.", true);

  setWatchLookupStatus("Searching…");
  clearWatchLookupResults();

  try {
    const url = `https://www.omdbapi.com/?apikey=${key}&s=${encodeURIComponent(title)}&type=movie`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False" || !data.Search || data.Search.length === 0) {
      setWatchLookupStatus(data.Error || "No matches found on OMDb.", true);
      return;
    }

    renderWatchLookupResults(data.Search);
    setWatchLookupStatus(
      `${data.Search.length} match${data.Search.length === 1 ? "" : "es"} — pick the right one below.`
    );
  } catch (err) {
    console.error(err);
    setWatchLookupStatus("Search failed. Check your connection.", true);
  }
});

function showWatchFormError(message) {
  const el = document.getElementById("watch-form-error");
  el.textContent = message;
  el.hidden = false;
}

function clearWatchFormError() {
  const el = document.getElementById("watch-form-error");
  el.hidden = true;
  el.textContent = "";
}

document.getElementById("watch-add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  clearWatchFormError();

  const title = document.getElementById("watch-title").value.trim();
  const year = document.getElementById("watch-year").value.trim();

  if (!title) return showWatchFormError("Enter a title first.");
  if (!year || Number(year) < 1888) return showWatchFormError("Enter a valid year.");
  if (!publishWorkerConfigured()) return showWatchFormError("Set PUBLISH_WORKER_URL in config.public.js first — see README.");

  const entry = { title, year: Number(year) };
  if (watchLookupResult.genre) entry.genre = watchLookupResult.genre;
  if (watchLookupResult.director) entry.director = watchLookupResult.director;
  if (watchLookupResult.productionCompany) entry.productionCompany = watchLookupResult.productionCompany;

  publishWatchEntryToGithub(entry);
});

// ---------- Publish via the publish worker (same approach as add.js) ----------
// The site never talks to GitHub with a write token itself — it posts the
// new entry to a small Cloudflare Worker (PUBLISH_WORKER_URL, set in
// config.public.js), which holds the real GitHub token privately and does
// the actual write. No device needs its own copy of a secret. See
// README.md's "Publishing without a token on every device" section.

function publishWorkerConfigured() {
  return typeof PUBLISH_WORKER_URL !== "undefined" && PUBLISH_WORKER_URL && PUBLISH_WORKER_URL.trim() !== "";
}

function setWatchPublishStatus(message, isError = false, isSuccess = false) {
  const el = document.getElementById("watch-publish-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.toggle("success", isSuccess);
}

async function publishWatchEntryToGithub(entry) {
  const addBtn = document.getElementById("watch-add-btn");
  addBtn.disabled = true;
  setWatchPublishStatus(`Adding "${entry.title}"…`);

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
        message: `Add "${entry.title}" to watchlist via watchlist.html`,
      }),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.ok) {
      throw new Error(result.error || `Publish failed (${res.status}).`);
    }

    setWatchPublishStatus(
      `✓ Added "${entry.title}" — look for the gold "Just added" card up top.`,
      false,
      true
    );

    document.getElementById("watch-add-form").reset();
    watchLookupResult = { genre: "", director: "", productionCompany: "" };
    setWatchLookupStatus("");
    clearWatchLookupResults();

    // Reflect the new title in the grid right away without a full reload
    // (the worker already wrote it to GitHub for real — this is just so you
    // see it immediately instead of waiting on a refetch), and flag it so
    // it renders at the top with a "Just added" highlight.
    allWatchlist = [...allWatchlist, entry];
    justAddedKey = `${entry.title}|${entry.year}`;
    await applyFilter();

    const newCard = document.getElementById("watch-just-added-card");
    if (newCard) newCard.scrollIntoView({ behavior: "smooth", block: "center" });

    // Drop the highlight after a bit so it doesn't stick around forever.
    setTimeout(() => {
      justAddedKey = null;
    }, 8000);
  } catch (err) {
    console.error(err);
    setWatchPublishStatus(err.message || "Add failed. Try again in a moment.", true);
  } finally {
    addBtn.disabled = false;
  }
}

if (!publishWorkerConfigured()) {
  document.getElementById("watch-add-btn").disabled = true;
  document.getElementById("watch-add-btn").title = "Set PUBLISH_WORKER_URL in config.public.js to enable this — see README.";
}

// ---------- App state ----------

let allWatchlist = [];

async function applyFilter() {
  // No search box — this is a poster wall to browse, not to look something
  // specific up. Newest-added titles land at the end of allWatchlist, so
  // reverse to show the most recently added movie first.
  const filtered = allWatchlist.slice().reverse();

  await renderGrid(filtered);
  updateStats(filtered);

  const emptyState = document.getElementById("watch-empty-state");
  emptyState.hidden = filtered.length > 0;
}

async function renderGrid(movies) {
  const grid = document.getElementById("watch-grid");
  grid.innerHTML = "";
  const elements = await Promise.all(movies.map((m) => cardElement(m)));
  elements.forEach((el) => grid.appendChild(el));
}

function updateStats(movies) {
  const stats = document.getElementById("watch-stats");
  stats.textContent = movies.length ? `${movies.length} title${movies.length === 1 ? "" : "s"}` : "";
}

async function init() {
  try {
    // no-store so returning to the page always shows the latest data instead
    // of a stale cached copy from before your last Add.
    const res = await fetch(WATCHLIST_URL, { cache: "no-store" });
    allWatchlist = await res.json();
  } catch (err) {
    console.error("Could not load watchlist.json", err);
    allWatchlist = [];
  }

  applyFilter();
}

init();
