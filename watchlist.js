// ---------- Configuration ----------

const WATCHLIST_URL = "data/watchlist.json";

function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

// ---------- Poster lookup (same approach as app.js) ----------

async function getPosterUrl(movie) {
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

// ---------- Rendering ----------

async function cardElement(movie) {
  const poster = await getPosterUrl(movie);

  const el = document.createElement("article");
  el.className = "watch-card";

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
      <a class="btn secondary watch-log-btn" href="add.html?title=${encodeURIComponent(movie.title)}&year=${encodeURIComponent(movie.year)}">Log this</a>
    </div>
  `;

  return el;
}

// ---------- Add a movie ----------

let watchLookupResult = { genre: "", director: "", productionCompany: "" };

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
  if (!key) return setWatchLookupStatus("No OMDb key configured — see config.js.", true);

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
  if (!githubConfigured()) return showWatchFormError("Add GITHUB_TOKEN and GITHUB_REPO to config.js first — see README.");

  const entry = { title, year: Number(year) };
  if (watchLookupResult.genre) entry.genre = watchLookupResult.genre;
  if (watchLookupResult.director) entry.director = watchLookupResult.director;
  if (watchLookupResult.productionCompany) entry.productionCompany = watchLookupResult.productionCompany;

  publishWatchEntryToGithub(entry);
});

// ---------- Publish straight to GitHub (same approach as add.js) ----------

function githubConfigured() {
  return (
    typeof GITHUB_TOKEN !== "undefined" && GITHUB_TOKEN &&
    typeof GITHUB_REPO !== "undefined" && GITHUB_REPO
  );
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function setWatchPublishStatus(message, isError = false) {
  const el = document.getElementById("watch-publish-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

async function publishWatchEntryToGithub(entry) {
  const branch = typeof GITHUB_BRANCH !== "undefined" && GITHUB_BRANCH ? GITHUB_BRANCH : "main";
  const path =
    typeof GITHUB_WATCHLIST_PATH !== "undefined" && GITHUB_WATCHLIST_PATH
      ? GITHUB_WATCHLIST_PATH
      : "data/watchlist.json";
  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };

  const addBtn = document.getElementById("watch-add-btn");
  addBtn.disabled = true;
  setWatchPublishStatus("Fetching current watchlist.json from GitHub…");

  try {
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });

    let existing = [];
    let sha;

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      existing = JSON.parse(base64ToUtf8(fileData.content));
    } else if (getRes.status !== 404) {
      const errBody = await getRes.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub returned ${getRes.status} fetching the file.`);
    }

    const merged = [...existing, entry];
    const content = utf8ToBase64(`${JSON.stringify(merged, null, 2)}\n`);

    setWatchPublishStatus(`Adding "${entry.title}" to GitHub…`);

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add "${entry.title}" to watchlist via watchlist.html`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub returned ${putRes.status} publishing the file.`);
    }

    setWatchPublishStatus(
      `Added "${entry.title}"! Pushed straight to ${GITHUB_REPO}. GitHub Pages will update in a minute or two.`
    );

    document.getElementById("watch-add-form").reset();
    watchLookupResult = { genre: "", director: "", productionCompany: "" };
    setWatchLookupStatus("");
    clearWatchLookupResults();

    // Reflect the new title in the grid right away without a full reload.
    allWatchlist = merged;
    applyFilter();
  } catch (err) {
    console.error(err);
    setWatchPublishStatus(err.message || "Add failed. Check your token and repo settings in config.js.", true);
  } finally {
    addBtn.disabled = false;
  }
}

if (!githubConfigured()) {
  document.getElementById("watch-add-btn").disabled = true;
  document.getElementById("watch-add-btn").title = "Add GITHUB_TOKEN and GITHUB_REPO to config.js to enable this.";
}

// ---------- App state ----------

let allWatchlist = [];

function applyFilter() {
  const query = document.getElementById("watch-search").value.trim().toLowerCase();
  const filtered = allWatchlist.filter((m) => m.title.toLowerCase().includes(query));

  renderGrid(filtered);
  updateStats(filtered);

  const emptyState = document.getElementById("watch-empty-state");
  emptyState.hidden = filtered.length > 0;
  document.getElementById("watch-empty-query").textContent = query;
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
    const res = await fetch(WATCHLIST_URL);
    allWatchlist = await res.json();
  } catch (err) {
    console.error("Could not load watchlist.json", err);
    allWatchlist = [];
  }

  document.getElementById("watch-search").addEventListener("input", applyFilter);

  applyFilter();
}

init();
