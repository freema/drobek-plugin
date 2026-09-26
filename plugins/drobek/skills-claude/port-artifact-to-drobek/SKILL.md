---
name: port-artifact-to-drobek
description: Move a Claude artifact (an HTML page, a React component, or a folder with index.html, scripts, images and video) into the user's drobek workspace as a new app, paths unchanged. Use when the user asks to move, port or host a Claude artifact on drobek, or runs /drobek:port-artifact.
---

# Move a Claude artifact to drobek

drobek hosts what a Claude artifact is — a page with its script, styles,
images and video — at its own URL in the user's drobek workspace, with
versions, a preview and publishing. YOU do the port from the artifact's
files on this machine, through the `drobek` MCP server (`create_app`,
`write_files`, `create_asset_upload`, `list_assets`, `delete_asset`,
`get_logs`, `publish`, `set_gallery_listing`); the drobek server fetches
nothing from claude.ai. Paths stay as they are and every binary goes up
through an upload URL, never through the model. The general build loop and
rules are in the `build-app-on-drobek` skill; where `skill_info()` lists
`port-artifact`, `skill_info('port-artifact')` is the server's own version
of this procedure.

## When to use this

Use this only after the user has chosen drobek for the artifact — they asked
to move, port or host it on drobek, or ran `/drobek:port-artifact`. The
drobek tools must be connected (`/mcp` in Claude Code → drobek → sign in);
if they are missing or answer 401, ask the user to connect and stop.

## The procedure

1. **Find the files and ask.** The artifact is a folder or a single file the
   user points you at (a Claude artifact downloads as its HTML/JSX file, a
   multi-file one as a folder or zip — unzip it first). List it: text files
   (`.html .js .mjs .css .json .svg .txt .md .jsx .tsx`) and binaries (video,
   audio, images, fonts). Ask the user once: "Move <artifact> to drobek as a
   new app?" (and which workspace, if `list_apps` shows more than one).
2. **`create_app({ name, template?, workspace? })`** — `"html"` for a page
   or a folder of files, `"react-ts"` for a single React component. Read the
   briefing: it has this server's limits.
3. **Text files unchanged.** `write_files({ app_id, files, reasoning })`
   with every text file, its path and its content exactly as in the artifact
   (1–20 files per call; split a bigger folder into several calls). Never
   rewrite a path: the app serves text files and uploaded assets side by side
   at `/<path>`, so `<video src="film.mp4">` and `img/s1.jpg` keep working.
4. **Every binary through an upload URL — never base64 through a tool
   call.** Per file: take its exact size (`stat -c %s film.mp4` on Linux,
   `stat -f %z film.mp4` on macOS), call
   `create_asset_upload({ app_id, path, size })` with the SAME relative path
   the page uses, then run the returned line: `curl -fsS -T film.mp4
   '<upload_url>'` (201 = stored). Without a shell or network, give the user
   each `upload_url`: in a browser it is an upload page for that one file.
   An upload URL takes exactly one PUT and expires after 30 minutes.
5. **Check.** `compile.ok: true` in the `write_files` result;
   `list_assets({ app_id })` lists every binary with its size; give the user
   the `preview_url` and ask them to open it (the video plays and seeks);
   `get_logs({ app_id, kind: "runtime" })` shows errors the page hit in their
   browser. Fix, then write again.
6. **Publish only when the user explicitly asks:** `publish({ app_id })` →
   give them the `published_url`.
7. **Offer the gallery once.** Show the exact description (plain text, at
   most 160 characters) and ask. Only after an explicit yes:
   `set_gallery_listing({ app_id, listed: true, description,
   user_confirmed: true })`.

A wrong upload: upload to the same path again (it replaces the asset) or
`delete_asset({ app_id, path })`.

## What differs from the artifact sandbox

- **Scripts** load only from the app itself and https://esm.sh (inline
  scripts run). A `<script src>` from cdnjs, unpkg or jsdelivr is blocked:
  load the library as a module from esm.sh
  (`import * as THREE from 'https://esm.sh/three@0.160.0'`) or copy the
  library file into the app as a text file.
- **A React artifact** (one component with `export default`): put it in the
  react-ts template (`src/App.tsx` + a `src/main.tsx` that renders it with
  `createRoot`). Its packages (`lucide-react`, `recharts`, `d3`, `lodash`,
  `three`, `papaparse`, …) become pinned `https://esm.sh/<package>@<version>`
  URLs in `drobek.json` `imports`; Tailwind classes need Tailwind's browser
  build (`skill_info('ui')`); `@/components/ui/*` (shadcn) does not exist —
  use plain elements.
- **`fetch`** reaches only the app itself and esm.sh. An external API goes
  through drobek's proxy module with a secret the owner sets in the drobek
  dashboard (`skill_info('proxy')`).
- **Fonts** (Google Fonts), CSS, images, `<video>` and `<audio>` from any
  https URL work. `<iframe>` works only for YouTube
  (`youtube-nocookie.com`), Vimeo and Google Drive (plus what the operator
  allows).
- **No `window.claude.*` runtime API.** `window.claude.complete` has no
  replacement — drop the feature, or call an LLM API through the proxy
  module. `window.storage` becomes `localStorage` (one browser) or the data
  module (shared). Sign-in → the auth module, a form that must reach the
  owner → the forms module.
  Before using a backend (login, stored data, forms, email, file uploads, external APIs), call `skill_info` and follow the skill; `create_app`/`get_app` list the available skills.
- **Limits** (defaults; the briefing and `create_asset_upload` give this
  server's): text files 512 KiB each, 5 MiB and 200 files per version; an
  asset up to 100 MiB, 1 GiB of assets per app, 60 upload URLs per app and
  hour. Asset types come from the bytes: MP4 (H.264/AAC), WebM, MP3, M4A,
  Ogg, WAV, PNG, JPEG, GIF, WebP, SVG, WOFF, WOFF2 — no transcoding (convert
  a MOV/HEVC video first). A big `data:` URI inlined in the HTML: save it as
  a file and upload it.

## Errors

A failed call returns `{ code, message, hint }` — follow the `hint`.
`asset_too_large` / `asset_quota_exceeded`: compress, or remove unused
assets (`list_assets`, `delete_asset`). `asset_type_not_allowed`: convert
the file. `asset_path_taken`: an app text file holds that path.
`asset_size_mismatch`: the size was wrong — `stat` again and ask for a new
URL. `upload_token_invalid`: the URL was used or expired — ask for a new one.
`limit_exceeded`: a text file is too big (inlined base64, a bundled
library). `secret_in_source`: an API key in the artifact's code — remove it;
the owner sets secrets in the drobek dashboard. `user_confirmation_required`:
ask the user before the gallery call.

Give the user every URL exactly as a tool returned it (`preview_url`,
`published_url`, `upload_url`) — never assume `drobek.app` for an app host.
The full contract is `/llms-full.txt` on the origin of the user's drobek
server (hosted: https://drobek.app/llms-full.txt).
