const DATA_URL = "data/movies.json";

function getOmdbKey() {
  return typeof OMDB_API_KEY !== "undefined" ? OMDB_API_KEY : "";
}

function average(ratings) {
  const vals = Object.values(ratings);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatShortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
}

// ---------- OMDb genre/director lookup ----------
// Reuses the same localStorage cache key app.js writes ("details2:title:year"),
// so genres and directors are free if you've already browsed the ticket wall.

async function getGenreDirector(movie) {
  // Same "details2" cache namespace as app.js — see the comment there.
  const cacheKey = `details2:${movie.title}:${movie.year}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { genre: parsed.genre || "", director: parsed.director || "" };
    } catch {
      // fall through and refetch on a bad cache entry
    }
  }

  const key = getOmdbKey();
  if (!key) return { genre: "", director: "" };

  try {
    const url = `https://www.omdbapi.com/?apikey=${key}&t=${encodeURIComponent(movie.title)}&y=${movie.year}`;
    const res = await fetch(url);
    const data = await res.json();

    const genre = data.Genre && data.Genre !== "N/A" ? data.Genre : "";
    const director = data.Director && data.Director !== "N/A" ? data.Director : "";

    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        poster: null,
        genre,
        director,
        plot: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
        imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : "",
        awards: data.Awards && data.Awards !== "N/A" ? data.Awards : "",
      })
    );

    return { genre, director };
  } catch (err) {
    console.warn("OMDb lookup failed for", movie.title, err);
    return { genre: "", director: "" };
  }
}

// ---------- Rendering helpers ----------

function tile(value, label) {
  return `<div class="stat-tile"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;
}

function barRow(label, value, max, valueLabel) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return `
    <div class="chart-row">
      <span class="chart-label" title="${label}">${label}</span>
      <div class="chart-track" title="${label}: ${valueLabel}">
        <div class="chart-fill" style="width:${pct}%"></div>
      </div>
      <span class="chart-value">${valueLabel}</span>
    </div>
  `;
}

function pairedRow(label, mollieVal, ianVal, max) {
  const mPct = max > 0 ? Math.max(4, Math.round((mollieVal / max) * 100)) : 0;
  const iPct = max > 0 ? Math.max(4, Math.round((ianVal / max) * 100)) : 0;
  return `
    <div class="chart-row chart-row-paired">
      <span class="chart-label" title="${label}">${label}</span>
      <div class="chart-track-group">
        <div class="chart-track" title="Mollie: ${mollieVal.toFixed(1)}">
          <div class="chart-fill mollie" style="width:${mPct}%"></div>
        </div>
        <div class="chart-track" title="Ian: ${ianVal.toFixed(1)}">
          <div class="chart-fill ian" style="width:${iPct}%"></div>
        </div>
      </div>
      <span class="chart-value">${mollieVal.toFixed(1)} / ${ianVal.toFixed(1)}</span>
    </div>
  `;
}

function leaderboardRow(movie, rank) {
  return `
    <li class="leaderboard-row">
      <span class="leaderboard-rank">${rank}</span>
      <span class="leaderboard-title">${movie.title} <span class="leaderboard-year">(${movie.year})</span></span>
      <span class="leaderboard-detail">Mollie ${movie.ratings.mollie.toFixed(1)}★ &middot; Ian ${movie.ratings.ian.toFixed(1)}★</span>
    </li>
  `;
}

// ---------- Sections ----------

function renderStatTiles(movies) {
  const total = movies.length;
  const overallAvg = movies.reduce((sum, m) => sum + average(m.ratings), 0) / total;
  const mollieAvg = movies.reduce((sum, m) => sum + m.ratings.mollie, 0) / total;
  const ianAvg = movies.reduce((sum, m) => sum + m.ratings.ian, 0) / total;

  const byDate = [...movies].sort((a, b) => a.watchedDate.localeCompare(b.watchedDate));
  const firstWatch = byDate[0];

  let longestGap = 0;
  for (let i = 1; i < byDate.length; i++) {
    const gap = daysBetween(byDate[i - 1].watchedDate, byDate[i].watchedDate);
    if (gap > longestGap) longestGap = gap;
  }

  const highestRated = [...movies].sort((a, b) => average(b.ratings) - average(a.ratings))[0];

  const tiles = [
    tile(total, `ticket${total === 1 ? "" : "s"} torn`),
    tile(overallAvg.toFixed(1), "overall average"),
    tile(`${mollieAvg.toFixed(1)} / ${ianAvg.toFixed(1)}`, "Mollie / Ian average"),
    tile(formatShortDate(firstWatch.watchedDate), "together since"),
    tile(`${longestGap}d`, "longest gap between movies"),
    tile(highestRated.title, `highest rated (${average(highestRated.ratings).toFixed(1)}★)`),
  ];

  document.getElementById("stat-tiles").innerHTML = tiles.join("");
}

function renderYearChart(movies) {
  const counts = {};
  movies.forEach((m) => {
    const year = m.watchedDate.slice(0, 4);
    counts[year] = (counts[year] || 0) + 1;
  });

  const years = Object.keys(counts).sort();
  const max = Math.max(...Object.values(counts));

  document.getElementById("year-chart").innerHTML = years
    .map((y) => barRow(y, counts[y], max, String(counts[y])))
    .join("");
}

function renderRaterChart(movies) {
  const byYear = {};
  movies.forEach((m) => {
    const year = m.watchedDate.slice(0, 4);
    if (!byYear[year]) byYear[year] = { mollie: [], ian: [] };
    byYear[year].mollie.push(m.ratings.mollie);
    byYear[year].ian.push(m.ratings.ian);
  });

  const years = Object.keys(byYear).sort();

  document.getElementById("rater-chart").innerHTML = years
    .map((y) => {
      const mAvg = byYear[y].mollie.reduce((a, b) => a + b, 0) / byYear[y].mollie.length;
      const iAvg = byYear[y].ian.reduce((a, b) => a + b, 0) / byYear[y].ian.length;
      return pairedRow(y, mAvg, iAvg, 5);
    })
    .join("");

  document.getElementById("rater-legend").innerHTML = `
    <span class="legend-item"><span class="legend-swatch mollie"></span>Mollie</span>
    <span class="legend-item"><span class="legend-swatch ian"></span>Ian</span>
  `;
}

function renderLeaderboards(movies) {
  const withSpread = movies.map((m) => ({ ...m, spread: Math.abs(m.ratings.mollie - m.ratings.ian) }));

  const disagree = [...withSpread].sort((a, b) => b.spread - a.spread).slice(0, 5);
  const agree = [...withSpread]
    .sort((a, b) => a.spread - b.spread || average(b.ratings) - average(a.ratings))
    .slice(0, 5);

  document.getElementById("disagree-list").innerHTML = disagree.map((m, i) => leaderboardRow(m, i + 1)).join("");
  document.getElementById("agree-list").innerHTML = agree.map((m, i) => leaderboardRow(m, i + 1)).join("");
}

async function renderGenreAndDirectors(movies) {
  const key = getOmdbKey();
  if (!key) return;

  const details = await Promise.all(movies.map((m) => getGenreDirector(m)));

  const genreCounts = {};
  details.forEach((d) => {
    if (!d.genre) return;
    d.genre.split(",").forEach((g) => {
      const genre = g.trim();
      if (!genre) return;
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });
  });

  const genreEntries = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (genreEntries.length) {
    const max = genreEntries[0][1];
    document.getElementById("genre-chart").innerHTML = genreEntries
      .map(([g, c]) => barRow(g, c, max, String(c)))
      .join("");
    document.getElementById("genre-section").hidden = false;
  }

  const directorCounts = {};
  details.forEach((d) => {
    if (!d.director) return;
    d.director.split(",").forEach((name) => {
      const director = name.trim();
      if (!director) return;
      directorCounts[director] = (directorCounts[director] || 0) + 1;
    });
  });

  const repeatDirectors = Object.entries(directorCounts)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);

  if (repeatDirectors.length) {
    document.getElementById("director-list").innerHTML = repeatDirectors
      .map(
        ([name, c]) =>
          `<li><span class="director-name">${name}</span><span class="director-count">${c} films</span></li>`
      )
      .join("");
    document.getElementById("director-section").hidden = false;
  }
}

// ---------- Init ----------

async function init() {
  let movies = [];
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    movies = await res.json();
  } catch (err) {
    console.error("Could not load movies.json", err);
  }

  if (!movies.length) {
    document.getElementById("report-empty").hidden = false;
    return;
  }

  document.getElementById("report-body").hidden = false;

  renderStatTiles(movies);
  renderYearChart(movies);
  renderRaterChart(movies);
  renderLeaderboards(movies);
  await renderGenreAndDirectors(movies);
}

init();
