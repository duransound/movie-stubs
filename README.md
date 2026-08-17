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

There's one config file, and it's entirely public:

- **`config.public.js`** — committed to git, ships with the live site. Holds
  `OMDB_API_KEY` (free-tier, rate-limited, read-only — safe to expose;
  worst case someone burns your daily quota), plus `PUBLISH_WORKER_URL` and
  `PUBLISH_SITE_KEY`, which point at a small Cloudflare Worker that does the
  actual writing to GitHub on your behalf. See "Publishing without a token
  on every device" below for what that is and how to set it up.

Nothing sensitive lives in this project's files or on your Mac anymore. The
one real secret — your GitHub write token — lives only inside the Cloudflare
Worker, set up once, and no device that visits the site ever sees it.

(Older versions of this project used a second, gitignored `config.js` file
to hold that token locally. That's no longer needed — if you still have
`config.js` or `config.example.js` sitting in this folder, they're unused
and safe to delete.)

## Adding a movie (the easy way)

1. Open `add.html` (on the live site or locally). Your OMDb key comes from
   `config.public.js` — it's never shown or typed into the page.
2. Type the title, then hit **Look up on OMDb**. It searches OMDb and shows
   every matching title/year as a clickable list — handy for franchises,
   remakes, and sequels that share a name. Click the right one and it fills
   in the year, pulls the release date, and shows a poster preview.
3. Pick the date you watched it, and click stars for each of you — click
   the left half of a star for a half rating (e.g. 3.5), the right half for
   a whole one.
4. Hit **Add**. It publishes straight to `data/movies.json` in your repo —
   GitHub Pages picks up the change automatically within a minute or two.
   Repeat for the next movie.

This needs the publish worker set up (see "Publishing without a token on
every device" below) — without it, the **Add** button stays disabled and
the page tells you so. Once it's set up, this works from any device — your
Mac, your phone, Mollie's laptop — with no extra setup per device.

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
   This file is meant to be committed — see "Config & secrets" above for
   why that's fine for this particular key.
4. Posters use the `Poster` field from OMDb's main API response (an Amazon
   CDN link) by default, falling back to the dedicated poster endpoint
   (`img.omdbapi.com/?i={imdbID}&h=600`) only if that's missing — the main
   field tends to be more reliable.

## Publishing without a token on every device

`add.html`, `watchlist.html`, and `suggest.html` all publish straight to
this repo when you hit their **Add** button. Instead of each device needing
its own copy of a GitHub write token (which either can't be deployed
publicly, or would need re-entering on every browser), a small piece of
code called a **Cloudflare Worker** holds the real token privately and does
the writing on the site's behalf. You deploy it once, and after that every
device — your Mac, your phone, Mollie's laptop — can just hit Add and it
works, no setup per device.

This is entirely free (Cloudflare's free tier is far more than this project
needs) and doesn't require any coding or Terminal use — it's all done
through Cloudflare's website.

**1. Create your GitHub token** (same as before, this part hasn't changed):

1. Go to **github.com → Settings → Developer settings → Personal access
   tokens → Fine-grained tokens** (or go directly to
   https://github.com/settings/tokens?type=beta).
2. Click **Generate new token**.
3. Under **Repository access**, choose **Only select repositories** and
   pick this repo (`duransound/movie-stubs`).
4. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. Leave everything else as **No access**.
5. Set an expiration (90 days is a reasonable default — you'll just
   generate a new one when it lapses, and update the Worker below).
6. Click **Generate token** and copy it — GitHub only shows it once.

**2. Create the Worker:**

1. Go to https://dash.cloudflare.com and sign up for a free account if you
   don't have one.
2. In the sidebar, go to **Workers & Pages** → **Create** → **Create
   Worker**. Give it any name (e.g. `movie-stubs-publish`) and click
   **Deploy** to create it with the default placeholder code.
3. Click **Edit code**. Delete everything in the editor and paste in the
   entire contents of this project's `cloudflare-worker.js` file instead.
   Click **Deploy** / **Save and deploy**.
4. Back on the Worker's page, go to **Settings → Variables and Secrets**
   and add these (use **Secret** for the token, **Text**/plain for the
   rest):
   - `GITHUB_TOKEN` (Secret) — the token you copied above.
   - `GITHUB_REPO` — `duransound/movie-stubs`
   - `GITHUB_BRANCH` — `main` (or whatever your default branch is)
   - `ALLOWED_ORIGIN` — `https://duransound.github.io`
   - `SITE_KEY` — make up any random string, e.g. `movie-stubs-8f2k`. This
     isn't a real secret (it'll be visible in the site's code either way) —
     it just filters out random bots that stumble onto the Worker's URL.
   Save/deploy after adding these.
5. Copy the Worker's URL — it's shown at the top of the Worker's page,
   something like `https://movie-stubs-publish.yourname.workers.dev`.

**3. Point the site at it:**

Open `config.public.js` and fill in the two values to match what you just
set up:

```js
const PUBLISH_WORKER_URL = "https://movie-stubs-publish.yourname.workers.dev";
const PUBLISH_SITE_KEY = "movie-stubs-8f2k"; // must match SITE_KEY on the Worker
```

Push that change to GitHub (see "Deploying to GitHub Pages" below) — once
it's live, the Add buttons on every page work from any device, no further
setup needed.

If you ever need to rotate the GitHub token (it expired, or you think it
leaked), generate a new one and update just the `GITHUB_TOKEN` secret on
the Worker — nothing on the site itself needs to change.

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
- **Before pushing code changes from your Mac, always run `git pull`
  first.** The Add buttons publish straight to GitHub independently of
  your Mac's local folder — if you push without pulling first, your Mac's
  older local copy of `data/movies.json` / `data/watchlist.json` can
  overwrite anything added through the site since your last pull. This is
  the single most important habit for this project: **pull before you
  push, every time.**

Then:

1. `git init`, commit, and push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   pick your default branch and the `/ (root)` folder.
4. Save. Your site will be live at `https://<username>.github.io/<repo-name>/`
   within a minute or two — open it and confirm posters are actually
   showing (proves `config.public.js` made it into the deployed site) and,
   once you've set up the publish worker (see above), that the **Add**
   button works.

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
2. Hit **Add**. It publishes straight to `data/watchlist.json` in the repo
   through the same publish worker described above. Repeat for the next
   title.

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

Needs the same publish worker setup as the other Add buttons to publish
pitches; the random picker works with no setup at all, since it only reads.

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
├── config.public.js      OMDb key + publish worker URL — committed, all public
├── cloudflare-worker.js  code to paste into your Cloudflare Worker (not loaded by the site)
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
