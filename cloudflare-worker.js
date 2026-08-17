// ============================================================
// Movie Stubs — publish worker
// ============================================================
// This is NOT part of the website itself — it's a small piece of code that
// runs on Cloudflare's servers (not your Mac, not a browser, not GitHub
// Pages). Its only job is to hold your GitHub token privately and use it to
// write to data/movies.json / data/watchlist.json whenever the site asks it
// to. No device that visits the site — your Mac, your phone, Mollie's
// laptop — ever needs to know the token. See README.md's "Publishing
// without a token on every device" section for how to deploy this.
//
// Paste this whole file into a new Cloudflare Worker (via the dashboard —
// no coding, no Terminal needed) and set these in the Worker's Settings:
//
//   Variables and Secrets:
//     GITHUB_TOKEN     (Secret)  — your fine-grained GitHub token, Contents: Read & write
//     GITHUB_REPO      (Text)    — e.g. "duransound/movie-stubs"
//     GITHUB_BRANCH    (Text)    — e.g. "main"
//     ALLOWED_ORIGIN   (Text)    — e.g. "https://duransound.github.io"
//     SITE_KEY         (Text)    — any random string you make up, must match
//                                   PUBLISH_SITE_KEY in config.public.js.
//                                   This isn't a real secret (it ships in
//                                   public site code) — it just keeps random
//                                   internet bots from spamming this endpoint.

const ALLOWED_PATHS = ["data/movies.json", "data/watchlist.json"];

function corsHeaders(origin, allowedOrigin) {
  const allow = !allowedOrigin || allowedOrigin === "*" || origin === allowedOrigin ? origin || "*" : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Site-Key",
  };
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const respond = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...cors },
      });

    if (request.method !== "POST") {
      return respond(405, { ok: false, error: "Method not allowed." });
    }

    if (env.SITE_KEY && request.headers.get("X-Site-Key") !== env.SITE_KEY) {
      return respond(403, { ok: false, error: "Not authorized." });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return respond(400, { ok: false, error: "Bad request body." });
    }

    const { path, entry, message } = body || {};

    if (!ALLOWED_PATHS.includes(path)) {
      return respond(400, { ok: false, error: "Not an allowed file." });
    }
    if (!entry || typeof entry !== "object") {
      return respond(400, { ok: false, error: "Missing entry." });
    }

    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";
    const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "movie-stubs-worker",
    };

    // Retry a couple of times in case two devices publish at nearly the same
    // moment and the file's sha goes stale between our read and our write.
    for (let attempt = 0; attempt < 3; attempt++) {
      const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });

      let existing = [];
      let sha;

      if (getRes.status === 200) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        try {
          existing = JSON.parse(base64ToUtf8(fileData.content));
        } catch {
          return respond(500, { ok: false, error: "Existing file isn't valid JSON." });
        }
      } else if (getRes.status !== 404) {
        const errBody = await getRes.json().catch(() => ({}));
        return respond(getRes.status, { ok: false, error: errBody.message || `GitHub returned ${getRes.status} reading the file.` });
      }
      // 404 means the file doesn't exist yet — start from an empty array.

      const merged = [...existing, entry];
      const content = utf8ToBase64(`${JSON.stringify(merged, null, 2)}\n`);

      const putRes = await fetch(apiBase, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || `Add "${entry.title || "entry"}" via movie-stubs`,
          content,
          branch,
          ...(sha ? { sha } : {}),
        }),
      });

      if (putRes.ok) {
        return respond(200, { ok: true });
      }

      if (putRes.status === 409 && attempt < 2) {
        continue; // stale sha — someone else wrote in between, try again
      }

      const errBody = await putRes.json().catch(() => ({}));
      return respond(putRes.status, { ok: false, error: errBody.message || `GitHub returned ${putRes.status} publishing the file.` });
    }

    return respond(500, { ok: false, error: "Gave up after a few conflicting writes — try again." });
  },
};
