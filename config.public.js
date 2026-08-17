// This file is committed and ships with the live site. Everything in it is
// meant to be public — there's no real secret here anymore (see below for
// why the GitHub write token moved off of every device entirely).

// OMDb API key — free-tier, rate-limited (1,000 requests/day), read-only.
// Safe to expose publicly: worst case someone burns your daily quota, not a
// security incident. Powers posters, genres, plots, and Oscar badges.
// If OMDb ever emails about unusual usage, generate a fresh key at
// https://www.omdbapi.com/apikey.aspx and swap it in here.
const OMDB_API_KEY = "ff7acc65";

// Publish worker URL — a tiny Cloudflare Worker that holds your real GitHub
// token privately and does the actual writing to data/movies.json and
// data/watchlist.json on your behalf. The site posts new entries here
// instead of talking to GitHub directly, so no device (your Mac, your
// phone, Mollie's laptop) ever needs its own copy of the token — the Add
// buttons just work everywhere, no setup per device. See README.md's
// "Publishing without a token on every device" section to deploy your own
// (it's free, takes a few minutes, no coding).
//
// Until you deploy one, this stays a placeholder and the Add buttons show
// as disabled with an explanation.
const PUBLISH_WORKER_URL = "https://movie-stub-publish.iduran87.workers.dev";

// A made-up string that must match the SITE_KEY you set on the Worker. This
// is NOT a real secret — it ships in public code just like everything else
// in this file — it only exists to keep random internet bots from spamming
// the publish endpoint. Change it to anything you like, as long as both
// sides match.
const PUBLISH_SITE_KEY = "7a80an4)n:m";
