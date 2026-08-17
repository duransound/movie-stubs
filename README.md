# Movie Stubs

A tiny static site that turns the movies you and Mollie have watched
together into a wall of 90s-style movie ticket stubs — no backend, no
database, just a JSON file and a form to fill it in.

## Where this lives

This project doesn't need a server or a database — it's meant to sit in a
folder on your computer (e.g. `Documents/Movie Stubs`) and get pushed to a
GitHub repo from there. Nothing in these files reads or writes anywhere on
your machine outside this folder.

## How it works

- `data/movies.json` is your shared log. Each entry is one movie you both watched.
- `index.html` / `styles.css` / `app.js` render that JSON as ticket stubs —
  dot-matrix printer type, a tear-off "ADMIT TWO" stub with a serial number,
  and a half-star rating row for each of you.
- `add.html` / `add.js` is the input form — click stars (including halves)
  instead of hand-editing JSON, and look up posters and release dates from
  OMDb automatically.
- `RATING-GUIDE.md` is a short rubric so a 4-star from Mollie means the same
  thing as a 4-star from you.

Nothing here needs a server. Open `index.html` in a browser, or host it on
GitHub Pages, and it just works.

## Config & secrets

Two config files, two different trust levels:

- **`config.public.js`** — committed to git, ships with the live site. Holds
  only `OMDB_API_KEY`. That key is free-tier, rate-limited (1,000
  requests/day), and read-only, so it's fine for it to be publicly visible
  — worst case someone burns your daily quota. This is what makes posters,
  genres, plots, and Oscar badges work on the live GitHub Pages site, not
  just when running locally.
- **`config.js`** — gitignored, local-only, never deployed. Holds
  `GITHUB_TOKEN` and friends. That token can *write* to your repo, so it
  must never be committed or shipped anywhere — a leaked write token would
  let anyone push arbitrary files to this repo, which GitHub Pages would
  then serve to every visitor. Copy `config.example.js` to `config.js` to
  set it up (see "Publishing straight to GitHub" below).

Both files load on every page; if `config.js` is missing (as it will be on
the deployed site), the GitHub-dependent features — the **Add** buttons —
just show as disabled instead of failing loudly.

## Adding a movie (the easy way)

1. Open `add.html` in your browser. Your OMDb key comes from
   `config.public.js` (see "Config & secrets" above) — it's never shown or
   typed into the page.
2. Type the title, then hit **Look up on OMDb**. It searches OMDb and shows
   every matching title/year as a clickable list — handy for franchises,
   remakes, and sequels that share a name. Click the right one and it fills
   in the year, pulls the release date, and shows a poster preview.
3. Pick the date you watched it, and click stars for each of you — click
   the left half of a star for a half rating (e.g. 3.5), the right half for
   a whole one.
4. Hit **Add**. It commits straight to `data/movies.json` in your repo —
   GitHub Pages picks up the change automatically within a minute or two.
   Repeat for the next movie.

This needs the GitHub token set up (see below) — without it, the **Add**
button stays disabled and the page tells you so.

If you haven't set up the OMDb key, the lookup step just won't have
anything to search — you can still type the year by hand and the ticket
won't have a poster or a separate release date (it'll fall back to showing
the year you typed).

## Adding a movie (by hand)

If you'd rather edit the JSON directly, open `data/movies.json` and add an
entry like this:

```json
{
  "title": "Portrait of a Lady on Fire",
  "year": 2019,
  "releaseDate": "2019-09-18",
  "watchedDate": "2026-05-03",
  "venue": "Living room, candles lit",
  "ratings": { "mollie": 5, "ian": 4.5 },
  "note": "Optional one-line memory of the night.",
  "posterUrl": "https://..."
}
```

Field notes:
- `ratings` keys are `mollie` and `ian`, on a 0.5–5 scale in half-star
  steps. See `RATING-GUIDE.md` for what each level should roughly mean.
- `releaseDate` and `posterUrl` are both optional — omit them and the
  ticket falls back to showing `year` and no poster.
- `watchedDate` and `releaseDate` are both `YYYY-MM-DD`.
- `venue` and `note` are both optional; omit them if you don't want that
  line to show.

### Oscar badges (automatic)

No field to add — `app.js` parses OMDb's `Awards` text (the same call it
already makes for the poster/genre/director) for a line like `"Won 7
Oscars. 408 wins & 382 nominations total"` or `"Nominated for 6 Oscars. 79
wins & 271 nominations total"`. If a win count is present the ticket gets a
gold **Oscar winner ×N** stamp; otherwise a nomination count gets a plain
outlined **Oscar nominee ×N** stamp. Hovering the stamp shows OMDb's full
awards line. This only reports counts, not which categories — OMDb doesn't
expose category-level detail, and Wikipedia's doesn't either in a form a
static site can query live (it's prose, not structured data). Needs the
OMDb key in `config.public.js`, same as posters/genres.

## Getting an OMDb key

`config.public.js` already ships with a working key, so you likely don't
need to do this — it's here in case that key ever gets rate-limited or
revoked and you want to swap in your own.

1. Go to https://www.omdbapi.com/apikey.aspx and request a free key (1,000
   requests/day on the free tier).
2. Check your email for the key.
3. Paste it into `config.public.js`:
   ```js
   const OMDB_API_KEY = "your-key-here";
   ```
   Unlike `config.js`, this file is meant to be committed — see "Config &
   secrets" above for why that's fine for this particular key.
4. Posters use the `Poster` field from OMDb's main API response (an Amazon
   CDN link) by default, falling back to the dedicated poster endpoint
   (`img.omdbapi.com/?i={imdbID}&h=600`) only if that's missing — the main
   field tends to be more reliable.

## Publishing straight to GitHub (required for the Add buttons)

`add.html` and `watchlist.html` both commit straight to this repo via the
GitHub API when you hit their **Add** button — no downloading a file and
merging it by hand. This needs a token.

1. Go to **github.com → Settings → Developer settings → Personal access
   tokens → Fine-grained tokens** (or go directly to
   https://github.com/settings/tokens?type=beta).
2. Click **Generate new token**.
3. Under **Repository access**, choose **Only select repositories** and
   pick this repo (`duransound/movie-stubs`).
4. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. Leave everything else as **No access**.
5. Set an expiration (90 days is a reasonable default — you'll just
   generate a new one when it lapses).
6. Click **Generate token** and copy it — GitHub only shows it once.
7. Copy `config.example.js` to `config.js` (if you haven't already) and
   paste the token in:
   ```js
   const GITHUB_TOKEN = "your-token-here";
   const GITHUB_REPO = "duransound/movie-stubs";
   const GITHUB_BRANCH = "main"; // change if your default branch differs
   ```
   `config.js` is gitignored, so the token never gets committed — see
   "Config & secrets" above for why that matters more here than for the
   OMDb key.

If `GITHUB_TOKEN` is blank, the Add button is disabled and the page tells
you so.

## Customizing

Rename either rater at the top of `app.js`:

```js
const RATERS = {
  mollie: { name: "Mollie", tagClass: "mollie" },
  ian: { name: "Ian", tagClass: "ian" },
};

const CINEMA_NAME = "Bijou Twin Cinema"; // rename your fictional theater
```

If you rename the `mollie` / `ian` keys themselves (not just the display
`name`), update the matching CSS classes in `styles.css`
(`.rater-tag.mollie`, `.stars.mollie`, etc.), the `ratings` keys in
`movies.json`, and the `stars` object and DOM IDs in `add.js` to match.

Colors for each of you live in `styles.css` under `--mollie` / `--mollie-dim`
and `--you` / `--you-dim`. The ticket stock color is `--paper`, the stub
color is `--maroon`.

## Deploying to GitHub Pages

**Before your first push, a few things worth checking:**

- **This repo will be public.** GitHub Pages' free tier requires a public
  repo (private Pages needs a paid plan), so everything in it — full
  commit history, `data/movies.json`, `data/watchlist.json`, notes,
  ratings — becomes visible to anyone with the URL, indefinitely. Read
  back through your notes/venues before pushing if that changes anything
  you'd want to phrase differently.
- **Confirm `config.js` is actually gitignored, not just listed as
  intending to be.** After `git init`, run `git status` and make sure
  `config.js` doesn't show up as a file ready to be added — only
  `config.public.js` and `config.example.js` should. If you ever ran `git
  add -A` or similar before setting up `.gitignore`, double-check
  `git log -- config.js` comes back empty; a token committed once and
  later deleted still lives in git history and should be treated as
  burned (regenerate it).
- **`GITHUB_TOKEN` needs to be in your local `config.js` for the Add
  buttons to work even locally** — see "Config & secrets" above. It's
  never pushed either way.

Then:

1. `git init`, commit, and push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   pick your default branch and the `/ (root)` folder.
4. Save. Your site will be live at `https://<username>.github.io/<repo-name>/`
   within a minute or two — open it and confirm posters are actually
   showing (proves `config.public.js` made it into the deployed site) and
   that the **Add** button works from a browser where you've set up a local
   `config.js`.

## Coming attractions (watchlist)

`watchlist.html` renders `data/watchlist.json` — movies you haven't watched
together yet — as a grid of poster cards with live OMDb poster lookups and
a title search. Each card has a **Log this** button that jumps to
`add.html?title=...&year=...`, which prefills the title/year and
auto-triggers the OMDb lookup, so logging a movie you've now seen doesn't
mean retyping it.

### Adding to the watchlist

`watchlist.html` has its own add form at the top of the page, working the
same way `add.html` does:

1. Type a title and hit **Look up on OMDb** — pick the right match from the
   list (handles sequels/remakes the same way `add.html` does), or just
   type the year by hand and skip the lookup.
2. Hit **Add**. It commits straight to `data/watchlist.json` in the repo
   (needs the same `GITHUB_TOKEN` setup described above — it reuses
   `GITHUB_REPO`/`GITHUB_BRANCH`, writing to `GITHUB_WATCHLIST_PATH` instead
   of `GITHUB_FILE_PATH`). Repeat for the next title.

Or skip the form and edit `data/watchlist.json` directly:

```json
{
  "title": "Poor Things",
  "year": 2023,
  "genre": "Comedy",
  "director": "Yorgos Lanthimos",
  "mood": "Date night",
  "suggestedBy": "mollie"
}
```

`genre`, `director`, `productionCompany`, `mood`, and `suggestedBy` are all
optional. `mood` is free text (the `suggest.html` form uses a fixed
dropdown list, but hand-editing the JSON isn't restricted to those exact
words). `suggestedBy` should be `mollie` or `ian` to match the color-coded
tag styling.

Newly-added entries always render at the **top** of the Coming Attractions
grid with a gold "Just added" highlight for a few seconds, whether added via
`watchlist.html` or `suggest.html`.

## Suggesting a movie

`suggest.html` has two things on it:

1. **A pitch form** — same lookup flow as `add.html`/`watchlist.html` (search
   OMDb, pick the right title/year from the list), plus two dropdowns: a
   **mood/occasion** tag (cozy night in, date night, background noise, etc.)
   and **who's suggesting** (Mollie or Ian). Hitting **Add** commits it to
   `data/watchlist.json` — it shows up on Coming Attractions right away, with
   its mood and "X's pick" tag visible on the card.
2. **A random picker** ("What should we watch?") — filter dropdowns for
   genre, mood, and who suggested it (all populated automatically from
   what's already on the watchlist), then hit **Pick one!** to get a random
   title from whatever matches. Its "Log this" button jumps to `add.html`
   the same way watchlist cards do.

Needs the same `GITHUB_TOKEN` setup as the other Add buttons to publish
pitches; the random picker works with no token, since it only reads.

## Box Office Report (stats)

`stats.html` is a read-only stats page built from `data/movies.json` — no
setup needed beyond having a few tickets logged. It shows:

- Headline tiles: total tickets, overall average, Mollie's/Ian's average
  side by side, how long you've been keeping the log, the longest gap
  between movie nights, and the highest-rated ticket.
- A bar chart of tickets watched per year.
- A paired bar chart comparing Mollie's and Ian's average rating by year.
- Leaderboards for the biggest rating disagreements and the movies you were
  most in sync on.
- Genre and repeat-director breakdowns — these two need an OMDb key in
  `config.public.js` (same one used for posters), since genre/director aren't
  stored in `movies.json` itself. Without a key, those two sections just
  don't render; everything else still works.

## Project structure

```
Movie Stubs/
├── index.html          the ticket wall
├── add.html            the input form (OMDb lookup + half-star input)
├── add.js
├── watchlist.html       coming attractions / want-to-see list
├── watchlist.js
├── suggest.html          pitch form + random "what should we watch" picker
├── suggest.js
├── stats.html            Box Office Report (stats page)
├── stats.js
├── styles.css
├── app.js
├── config.public.js      OMDb key — committed, ships with the site
├── config.example.js    template — copy to config.js
├── config.js             GitHub token, gitignored, never committed
├── .gitignore
├── RATING-GUIDE.md      what your stars mean
└── data/
    ├── movies.json
    └── watchlist.json
```

## Ideas to extend

- Switch `average()` in `app.js` to weight recency, or add a "rewatch" flag.
- Swap OMDb for [TMDb](https://www.themoviedb.org/documentation/api) if you
  want richer data (cast, runtime, trailers).
