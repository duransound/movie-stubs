const stars = { mollie: 0, ian: 0 };
let lookupResult = { posterUrl: "", releaseDate: "" };

// ---------- Half-star input widgets ----------

function buildStarInput(container) {
  const track = container.querySelector(".star-track");
  const readout = container.querySelector(".rating-readout");
  const rater = container.dataset.rater;

  track.innerHTML = "";
  const fgEls = [];

  for (let i = 0; i < 5; i++) {
    const wrap = document.createElement("span");
    wrap.className = "star-wrap";
    wrap.innerHTML = `
      <span class="bg">★</span>
      <span class="fg" style="--fill:0%">★</span>
      <button type="button" class="half left" data-value="${i + 0.5}" aria-label="Rate ${i + 0.5} stars"></button>
      <button type="button" class="half right" data-value="${i + 1}" aria-label="Rate ${i + 1} stars"></button>
    `;
    track.appendChild(wrap);
    fgEls.push(wrap.querySelector(".fg"));
  }

  function setValue(v) {
    stars[rater] = v;
    readout.textContent = v.toFixed(1);
    fgEls.forEach((fg, i) => {
      const fill = Math.max(0, Math.min(1, v - i)) * 100;
      fg.style.setProperty("--fill", `${fill}%`);
    });
  }

  track.querySelectorAll("button.half").forEach((btn) => {
    btn.addEventListener("click", () => setValue(Number(btn.dataset.value)));
  });

  container._setValue = setValue;
  setValue(0);
}

document.querySelectorAll(".star-input").forEach(buildStarInput);

function resetStars() {
  document.querySelectorAll(".star-input").forEach((c) => c._setValue(0));
}

// ---------- OMDb lookup ----------

const MONTHS = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseOmdbDate(str) {
  if (!str || str === "N/A") return null;
  const parts = str.split(" ");
  if (parts.length !== 3) return null;
  const [day, mon, year] = parts;
  const mm = MONTHS[mon];
  if (!mm) return null;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}

function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

function setLookupStatus(message, isError = false) {
  const el = document.getElementById("lookup-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function clearResults() {
  const container = document.getElementById("lookup-results");
  container.innerHTML = "";
  container.hidden = true;
}

function renderResults(results) {
  const container = document.getElementById("lookup-results");
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
    item.addEventListener("click", () => selectResult(r.imdbID));
    container.appendChild(item);
  });

  container.hidden = results.length === 0;
}

async function selectResult(imdbID) {
  const key = getOmdbKey();
  setLookupStatus("Loading details…");

  try {
    const url = `https://www.omdbapi.com/?apikey=${key}&i=${imdbID}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False") {
      setLookupStatus(data.Error || "Couldn't load that title.", true);
      return;
    }

    document.getElementById("title").value = data.Title;
    if (data.Year) document.getElementById("year").value = parseInt(data.Year, 10) || data.Year;

    lookupResult.releaseDate = parseOmdbDate(data.Released) || "";
    // Prefer OMDb's main Poster field (hosted on Amazon's CDN) — it's more
    // reliable than the dedicated poster endpoint, which occasionally 404s
    // or serves a broken/placeholder image even for a valid key.
    lookupResult.posterUrl =
      data.Poster && data.Poster !== "N/A"
        ? data.Poster
        : data.imdbID
        ? `https://img.omdbapi.com/?i=${data.imdbID}&h=600&apikey=${key}`
        : "";

    const preview = document.getElementById("poster-preview");
    if (lookupResult.posterUrl) {
      preview.onerror = () => {
        preview.hidden = true;
        lookupResult.posterUrl = "";
      };
      preview.onload = () => {
        preview.hidden = false;
      };
      preview.src = lookupResult.posterUrl;
    } else {
      preview.hidden = true;
    }

    setLookupStatus(
      `Selected "${data.Title}" (${data.Year})${lookupResult.releaseDate ? `, released ${lookupResult.releaseDate}` : ""}.`
    );
    clearResults();
  } catch (err) {
    console.error(err);
    setLookupStatus("Lookup failed. Check your connection.", true);
  }
}

document.getElementById("lookup-btn").addEventListener("click", async () => {
  const title = document.getElementById("title").value.trim();
  const key = getOmdbKey();

  if (!title) return setLookupStatus("Enter a title first.", true);
  if (!key) return setLookupStatus("No OMDb key configured — see config.js.", true);

  setLookupStatus("Searching…");
  clearResults();
  document.getElementById("poster-preview").hidden = true;

  try {
    // Use the search endpoint (returns every matching title/year) instead
    // of a single exact lookup, since franchises and remakes share titles
    // — you pick the right one instead of guessing at a year up front.
    const url = `https://www.omdbapi.com/?apikey=${key}&s=${encodeURIComponent(title)}&type=movie`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === "False" || !data.Search || data.Search.length === 0) {
      setLookupStatus(data.Error || "No matches found on OMDb.", true);
      return;
    }

    renderResults(data.Search);
    setLookupStatus(
      `${data.Search.length} match${data.Search.length === 1 ? "" : "es"} — pick the right one below.`
    );
  } catch (err) {
    console.error(err);
    setLookupStatus("Search failed. Check your connection.", true);
  }
});

// ---------- Form validation ----------

function showError(message) {
  const el = document.getElementById("form-error");
  el.textContent = message;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById("form-error");
  el.hidden = true;
  el.textContent = "";
}

// ---------- Publish straight to GitHub ----------
// Reads the current data/movies.json from the repo via the GitHub Contents
// API, appends the new ticket, and commits the result back — one movie at
// a time, no staging or manual merging. Needs GITHUB_TOKEN and GITHUB_REPO
// set in config.js (gitignored, never shown on the page). See README for
// how to create a token scoped to just this repo.

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

function setPublishStatus(message, isError = false) {
  const el = document.getElementById("publish-status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

async function publishEntryToGithub(entry) {
  const branch = typeof GITHUB_BRANCH !== "undefined" && GITHUB_BRANCH ? GITHUB_BRANCH : "main";
  const path =
    typeof GITHUB_FILE_PATH !== "undefined" && GITHUB_FILE_PATH ? GITHUB_FILE_PATH : "data/movies.json";
  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };

  const addBtn = document.getElementById("add-btn");
  addBtn.disabled = true;
  setPublishStatus("Fetching current movies.json from GitHub…");

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
    // 404 means data/movies.json doesn't exist in the repo yet — that's
    // fine, we'll create it starting from an empty array.

    const merged = [...existing, entry];
    const content = utf8ToBase64(`${JSON.stringify(merged, null, 2)}\n`);

    setPublishStatus(`Adding "${entry.title}" to GitHub…`);

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add "${entry.title}" via add.html`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub returned ${putRes.status} publishing the file.`);
    }

    setPublishStatus(
      `Added "${entry.title}"! Pushed straight to ${GITHUB_REPO}. GitHub Pages will update in a minute or two.`
    );

    document.getElementById("ticket-form").reset();
    resetStars();
    lookupResult = { posterUrl: "", releaseDate: "" };
    document.getElementById("poster-preview").hidden = true;
    setLookupStatus("");
  } catch (err) {
    console.error(err);
    setPublishStatus(err.message || "Add failed. Check your token and repo settings in config.js.", true);
  } finally {
    addBtn.disabled = false;
  }
}

document.getElementById("ticket-form").addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const title = document.getElementById("title").value.trim();
  const year = document.getElementById("year").value.trim();
  const watchedDate = document.getElementById("watchedDate").value;
  const venue = document.getElementById("venue").value.trim();
  const note = document.getElementById("note").value.trim();

  if (!title) return showError("Enter a title first.");
  if (!year || Number(year) < 1888) return showError("Enter a valid year.");
  if (!watchedDate) return showError("Pick the date you watched it.");
  if (stars.mollie === 0) return showError("Give Mollie's rating a star count.");
  if (stars.ian === 0) return showError("Give Ian's rating a star count.");
  if (!githubConfigured()) return showError("Add GITHUB_TOKEN and GITHUB_REPO to config.js first — see README.");

  const entry = {
    title,
    year: Number(year),
    watchedDate,
    ratings: { mollie: stars.mollie, ian: stars.ian },
  };
  if (venue) entry.venue = venue;
  if (note) entry.note = note;
  if (lookupResult.posterUrl) entry.posterUrl = lookupResult.posterUrl;
  if (lookupResult.releaseDate) entry.releaseDate = lookupResult.releaseDate;

  publishEntryToGithub(entry);
});

if (!githubConfigured()) {
  document.getElementById("add-btn").disabled = true;
  document.getElementById("add-btn").title = "Add GITHUB_TOKEN and GITHUB_REPO to config.js to enable this.";
}

// ---------- Prefill from a "Log this" link (watchlist.html) ----------
// watchlist.html cards link here as add.html?title=...&year=... so logging
// a movie you've now watched doesn't mean retyping its title.

(function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get("title");
  const year = params.get("year");

  if (!title) return;

  document.getElementById("title").value = title;
  if (year) document.getElementById("year").value = parseInt(year, 10) || year;

  if (getOmdbKey()) {
    document.getElementById("lookup-btn").click();
  }
})();
