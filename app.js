// ---------- Configuration ----------
// Keep the keys "mollie" and "ian" as-is unless you also update the
// matching CSS classes (.rater-tag.mollie / .ian, .stars.mollie / .ian)
// and the "ratings" keys in movies.json to match.

const RATERS = {
  mollie: { name: "Mollie", tagClass: "mollie" },
  ian: { name: "Ian", tagClass: "ian" },
};

const CINEMA_NAME = "Bijou Twin Cinema";

// OMDb key comes from config.js only — never shown or editable on-page.
// If it's missing, poster auto-fetch is silently skipped.
function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

const DATA_URL = "data/movies.json";

// ---------- Helpers ----------

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rotationFor(title) {
  const h = hashString(title);
  const deg = (h % 500) / 100 - 2.5; // -2.5deg to +2.5deg
  return `${deg.toFixed(2)}deg`;
}

function serialFor(title, year) {
  const h = hashString(`${title}${year}`);
  return String(h % 100000).padStart(5, "0");
}

// Renders the movie's own title as barcode-styled text via the
// "Libre Barcode 39" font (Code 39 only encodes A-Z, 0-9, space, and a
// handful of punctuation marks, and every string needs a "*" start/stop
// character on each end to render as a proper-looking barcode).
function barcodeText(title) {
  const cleaned = title.toUpperCase().replace(/[^A-Z0-9 \-.$/+%]/g, "");
  return `*${cleaned || "MOVIE"}*`;
}

function average(ratings) {
  const vals = Object.values(ratings);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const EMPTY_DETAILS = { poster: null, genre: "", director: "", plot: "", imdbRating: "", awards: "" };

// Fetches poster, genre, director, plot, and IMDb rating in a single OMDb
// call per movie, cached together in localStorage so repeat page loads
// don't re-hit the API (free-tier OMDb keys are capped at 1,000/day).
async function getOmdbDetails(movie) {
  // "details2" (not "details") because this cache entry shape gained an
  // `awards` field after the original one shipped — bumping the prefix
  // forces a fresh fetch instead of serving a stale cached object that's
  // silently missing it.
  const cacheKey = `details2:${movie.title}:${movie.year}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // fall through and refetch on a bad cache entry
    }
  }

  const key = getOmdbKey();
  if (!key) return { ...EMPTY_DETAILS, poster: movie.posterUrl || null };

  try {
    const searchUrl = `https://www.omdbapi.com/?apikey=${key}&t=${encodeURIComponent(movie.title)}&y=${movie.year}`;
    const res = await fetch(searchUrl);
    const data = await res.json();

    // Prefer OMDb's main Poster field (hosted on Amazon's CDN) — it's more
    // reliable than the dedicated poster endpoint, which occasionally 404s
    // or serves a broken image even for a valid key.
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
    return details;
  } catch (err) {
    console.warn("OMDb details fetch failed for", movie.title, err);
    return { ...EMPTY_DETAILS, poster: movie.posterUrl || null };
  }
}

// ---------- Rendering ----------

function starsMarkup(value, max = 5) {
  let html = "";
  for (let i = 0; i < max; i++) {
    const fill = Math.max(0, Math.min(1, value - i)) * 100;
    html += `<span class="star"><span class="bg">\u2605</span><span class="fg" style="--fill:${fill}%">\u2605</span></span>`;
  }
  return html;
}

function ratingBlock(raterKey, value) {
  const rater = RATERS[raterKey];
  if (!rater) return "";
  return `
    <div class="rating-block">
      <span class="rater-tag ${rater.tagClass}">${rater.name}</span>
      <span class="stars ${rater.tagClass}">${starsMarkup(value)}</span>
      <span class="rating-value">${value.toFixed(1)}</span>
    </div>
  `;
}

// Parses OMDb's free-text "Awards" field (e.g. "Won 7 Oscars. 408 wins &
// 382 nominations total" or "Nominated for 6 Oscars. 79 wins & 271
// nominations total") to auto-detect Oscar wins/nominations — no manual
// data entry needed. Only picks up whichever OMDb states: a win count when
// it won at least one, otherwise a nomination count.
function oscarBadge(awardsText) {
  if (!awardsText) return "";

  const wonMatch = awardsText.match(/Won (\d+) Oscars?/i);
  const nomMatch = awardsText.match(/Nominated for (\d+) Oscars?/i);

  if (!wonMatch && !nomMatch) return "";

  const isWinner = Boolean(wonMatch);
  const count = isWinner ? parseInt(wonMatch[1], 10) : parseInt(nomMatch[1], 10);
  const label = isWinner
    ? `Oscar winner${count > 1 ? ` ×${count}` : ""}`
    : `Oscar nominee${count > 1 ? ` ×${count}` : ""}`;

  return `<span class="oscar-badge ${isWinner ? "winner" : "nominee"}" title="${awardsText}">${label}</span>`;
}

async function ticketElement(movie, index) {
  const avg = average(movie.ratings);
  const details = await getOmdbDetails(movie);
  const poster = movie.posterUrl || details.poster;
  const rotate = rotationFor(movie.title);
  const serial = serialFor(movie.title, movie.year);

  const el = document.createElement("article");
  el.className = "ticket";
  el.style.setProperty("--rotate", rotate);

  const raterKeys = Object.keys(movie.ratings);

  el.innerHTML = `
    <div class="stub">
      <span class="stub-serial">NO. ${serial}</span>
      <span class="stub-admit">Admit</span>
      <span class="stub-avg">${avg.toFixed(1)}</span>
    </div>
    <div class="perforation"></div>
    <div class="ticket-body">
      <div class="ticket-main">
        ${poster ? `
        <div class="ticket-poster">
          <img src="${poster}" alt="${movie.title} poster" loading="lazy" onerror="this.parentElement.remove()" />
        </div>` : ""}
        <div class="ticket-details">
          <div class="ticket-header">
            <span class="cinema-name">${CINEMA_NAME}</span>
            <span class="ticket-no">${String(index + 1).padStart(3, "0")}</span>
          </div>
          <div class="title-row">
            <h2 class="movie-title">${movie.title}</h2>
            ${oscarBadge(details.awards)}
          </div>
          ${(details.genre || details.director) ? `
          <div class="ticket-credits">
            ${details.genre ? `<span class="ticket-genre">${details.genre}</span>` : ""}
            ${details.director ? `<span class="ticket-director">Dir. ${details.director}</span>` : ""}
          </div>` : ""}
          <div class="ticket-fields">
            <span>watched <b>${formatDate(movie.watchedDate)}</b></span>
            ${movie.venue ? `<span>venue <b>${movie.venue}</b></span>` : ""}
            <span>${movie.releaseDate ? "released" : "yr"} <b>${movie.releaseDate ? formatDate(movie.releaseDate) : movie.year}</b></span>
            ${details.imdbRating ? `<span>imdb <b>${details.imdbRating}/10</b></span>` : ""}
          </div>
          ${details.plot ? `<p class="ticket-plot">${details.plot}</p>` : ""}
        </div>
      </div>
      <div class="ratings-row">
        ${raterKeys.map((k) => ratingBlock(k, movie.ratings[k])).join("")}
      </div>
      ${movie.note ? `<p class="note">&ldquo;${movie.note}&rdquo;</p>` : ""}
      <div class="ticket-footer">
        <span class="price">ADM ${avg.toFixed(1)}/5.0</span>
        <div class="barcode-h">${barcodeText(movie.title)}</div>
      </div>
    </div>
  `;

  return el;
}

// ---------- App state ----------

let allMovies = [];

function applyFiltersAndSort() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const sortMode = document.getElementById("sort").value;

  let filtered = allMovies.filter((m) => m.title.toLowerCase().includes(query));

  const sorters = {
    "date-desc": (a, b) => b.watchedDate.localeCompare(a.watchedDate),
    "date-asc": (a, b) => a.watchedDate.localeCompare(b.watchedDate),
    "avg-desc": (a, b) => average(b.ratings) - average(a.ratings),
    "avg-asc": (a, b) => average(a.ratings) - average(b.ratings),
    "disagree-desc": (a, b) => {
      const spread = (m) => Math.max(...Object.values(m.ratings)) - Math.min(...Object.values(m.ratings));
      return spread(b) - spread(a);
    },
  };

  filtered = filtered.sort(sorters[sortMode] || sorters["date-desc"]);

  renderGrid(filtered);
  updateStats(filtered);

  const emptyState = document.getElementById("empty-state");
  emptyState.hidden = filtered.length > 0;
  document.getElementById("empty-query").textContent = query;
}

async function renderGrid(movies) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const elements = await Promise.all(movies.map((m, i) => ticketElement(m, i)));
  elements.forEach((el) => grid.appendChild(el));
}

function updateStats(movies) {
  const stats = document.getElementById("stats");
  if (movies.length === 0) {
    stats.textContent = "";
    return;
  }
  const overallAvg = movies.reduce((sum, m) => sum + average(m.ratings), 0) / movies.length;
  stats.textContent = `${movies.length} film${movies.length === 1 ? "" : "s"} \u00b7 avg ${overallAvg.toFixed(1)}/5`;
}

async function init() {
  try {
    // no-store so returning to the page always shows the latest data instead
    // of a stale cached copy from before your last Add.
    const res = await fetch(DATA_URL, { cache: "no-store" });
    allMovies = await res.json();
  } catch (err) {
    console.error("Could not load movies.json", err);
    allMovies = [];
  }

  document.getElementById("search").addEventListener("input", applyFiltersAndSort);
  document.getElementById("sort").addEventListener("change", applyFiltersAndSort);

  applyFiltersAndSort();
}

init();
