// Copy this file to "config.js" (which is gitignored, and stays that way —
// see the comment inside config.js for why) and paste in your GitHub
// token below. The OMDb key lives separately in config.public.js, which is
// already committed with a working key, since it's safe to expose
// publicly (see that file's comment).

// Optional: lets add.html's and watchlist.html's "Add" buttons write
// straight to data/movies.json / data/watchlist.json instead of
// downloading a file to merge by hand. Needs a fine-grained personal
// access token scoped to just this repo with Contents: Read and write
// permission (see README). Leave GITHUB_TOKEN blank to skip this — the
// Add button just stays disabled.
const GITHUB_TOKEN = "";
const GITHUB_REPO = "your-username/your-repo";
const GITHUB_BRANCH = "main";
const GITHUB_FILE_PATH = "data/movies.json";
const GITHUB_WATCHLIST_PATH = "data/watchlist.json";
