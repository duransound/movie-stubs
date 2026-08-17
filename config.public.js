// This file IS committed and ships with the live site — unlike config.js,
// it is NOT in .gitignore. It holds only the OMDb API key, which is safe
// to expose publicly: it's a free-tier key, rate-limited (1,000
// requests/day), and read-only — it can't write or change anything.
// Worst case if it leaks further or gets abused is a burned daily quota,
// not a security incident.
//
// This is what lets posters, genres, plots, and Oscar badges work on the
// live GitHub Pages site, not just when running locally. The GitHub write
// token is a different story — that one must NEVER be committed, and stays
// in the gitignored config.js instead. See README's "Config & secrets"
// section for the full reasoning.
//
// If OMDb ever emails about unusual usage, just generate a fresh key at
// https://www.omdbapi.com/apikey.aspx and swap it in here.

const OMDB_API_KEY = "ff7acc65";
