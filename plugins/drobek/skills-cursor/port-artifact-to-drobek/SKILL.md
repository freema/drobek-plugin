---
name: port-artifact-to-drobek
description: Move a Claude artifact (an HTML page, a React component, or a folder with index.html, scripts, images and video) into the user's drobek workspace as a new app, paths unchanged. Use when the user asks to move, port or host a Claude artifact on drobek, or runs the port-artifact command.
---

# Move a Claude artifact to drobek

drobek hosts a Claude artifact's page, scripts, styles, images and video at
its own URL in the user's workspace, with versions, a preview and publishing.
Read the artifact's files on this machine and transfer them through the
`drobek` MCP server (`create_app`,
`write_files`, `create_asset_upload`, `list_assets`, `delete_asset`,
`get_logs`, `publish`, `set_gallery_listing`); the drobek server fetches
nothing from claude.ai. Keep the paths unchanged and send each binary through
an upload URL, never through the model. Follow `build-app-on-drobek` for the
build workflow and rules. If `skill_info()` lists `port-artifact`, read
`skill_info('port-artifact')` for the server's version of this procedure.

## When to use this

Use this when the user asks to move, port or host a Claude artifact on
drobek, or runs the drobek `port-artifact` command. The drobek tools must be
connected; if they are missing or answer 401, ask the user to sign in to the
drobek server under Cursor Settings > Tools & MCP, then stop.

## The procedure

1. Find the folder or file the user specified. A Claude artifact downloads
   as an HTML/JSX file, or as a folder or zip for multiple files. Unzip it
   first if needed. List the text files (`.html .js .mjs .css .json .svg .txt .md .jsx .tsx`) and binaries (video,
   audio, images, fonts). Ask the user once: "Move <artifact> to drobek as a
   new app?" (and which workspace, if `list_apps` shows more than one).
2. Call `create_app({ name, template?, workspace? })` with `"html"` for a page
   or folder of files, or `"react-ts"` for a single React component. Read the
   briefing: it has this server's limits.
3. Call `write_files({ app_id, files, reasoning })` with every text file,
   keeping its path and content exactly as in the artifact (1–20 files and at most 10 MiB per call; split a bigger folder into several calls). Never
   rewrite a path: the app serves text files and uploaded assets side by side
   at `/<path>`, so `<video src="film.mp4">` and `img/s1.jpg` keep working.
   Until the binaries are uploaded (step 4), `compile.warnings` reports the
   page's references to them as `missing_reference`; that is expected. Any
   other `missing_reference` is a file the artifact really lacks.
4. Upload every binary through an upload URL, never base64 through a tool
   call. Get each file's exact size (`stat -c %s film.mp4` on Linux,
   `stat -f %z film.mp4` on macOS), call
   `create_asset_upload({ app_id, path, size })` with the SAME relative path
   the page uses, then run the returned line: `curl -fsS -T film.mp4
   '<upload_url>'` (201 = stored). Without a shell or network, give the user
   each `upload_url`: in a browser it is an upload page for that one file.
   An upload URL takes exactly one PUT and expires after 30 minutes.
5. Check for `compile.ok: true` in the `write_files` result and confirm that
   `list_assets({ app_id })` lists every binary with its size. Give the user
   the `preview_url` and ask them to check that the video plays and seeks.
   Use `get_logs({ app_id, kind: "runtime" })` to check for errors from their
   browser. Fix any errors, then write again. An artifact rarely has a
   description, a favicon or link-preview tags (`readiness.warnings`
   `missing_description`, `missing_favicon`): add them to its `<head>` as the
   build-app-on-drobek skill describes.
6. Publish only when the user explicitly asks: call `publish({ app_id })`
   and give them the `published_url`.
7. Offer the gallery once. Show the exact description (plain text, at
   most 160 characters) and ask. Only after an explicit yes:
   `set_gallery_listing({ app_id, listed: true, description,
   user_confirmed: true })`.

To correct an upload, upload to the same path again to replace the asset, or
remove it with `delete_asset({ app_id, path })`.

## What differs from the artifact sandbox

- Scripts load only from the app itself and https://esm.sh (inline
  scripts run). A `<script src>` from cdnjs, unpkg or jsdelivr is blocked:
  load the library as a module from esm.sh
  (`import * as THREE from 'https://esm.sh/three@0.160.0'`) or copy the
  library file into the app as a text file. `compile.warnings` reports each
  such URL as `blocked_by_csp`, with the directive and the fix.
- A React artifact (one component with `export default`): put it in the
  react-ts template (`src/App.tsx` + a `src/main.tsx` that renders it with
  `createRoot`). Its packages (`lucide-react`, `recharts`, `d3`, `lodash`,
  `three`, `papaparse`, …) become pinned `https://esm.sh/<package>@<version>`
  URLs in `drobek.json` `imports`; Tailwind classes need Tailwind's browser
  build (`skill_info('ui')`). Use plain elements in place of
  `@/components/ui/*` (shadcn), which is not available.
- `fetch` reaches only the app itself and esm.sh. An external API goes
  through drobek's proxy module with a secret the owner sets in the drobek
  dashboard (`skill_info('proxy')`).
- Fonts (Google Fonts), CSS, images, `<video>` and `<audio>` from any
  https URL work. `<iframe>` works only for YouTube
  (`youtube-nocookie.com`), Vimeo and Google Drive (plus what the operator
  allows).
- The `window.claude.*` runtime API is unavailable. `window.claude.complete`
  has no replacement; drop the feature or call an LLM API through the proxy
  module. `window.storage` becomes `localStorage` (one browser) or the data
  module (shared). Use the auth module for sign-in and the forms module for
  forms whose responses must reach the owner.
  Before using a backend (login, stored data, forms, email, file uploads, external APIs), call `skill_info` and follow the skill; `create_app`/`get_app` list the available skills.
- Default limits are 512 KiB per text file, 5 MiB and 200 files per version,
  100 MiB per asset, 1 GiB of assets per app, and 60 upload URLs per app per
  hour. Check the briefing and `create_asset_upload` for this server's limits.
  Asset types come from the bytes: MP4 (H.264/AAC), WebM, MP3, M4A,
  Ogg, WAV, PNG, JPEG, GIF, WebP, AVIF, ICO, SVG, WOFF, WOFF2. drobek does not
  transcode files, so convert MOV/HEVC videos first. If the HTML contains a
  large `data:` URI, save it as a file and upload it.

## Errors

A failed call returns `{ code, message, hint }`. Follow the `hint`.
`asset_too_large` / `asset_quota_exceeded`: compress, or remove unused
assets (`list_assets`, `delete_asset`). `asset_type_not_allowed`: convert
the file. `asset_path_taken`: an app text file holds that path.
`asset_size_mismatch`: check the size again with `stat` and request a new
URL. `upload_token_invalid`: the URL was used or expired; request a new one.
`limit_exceeded`: a text file is too big (inlined base64, a bundled
library). `secret_in_source`: remove the API key from the artifact's code;
the owner sets secrets in the drobek dashboard. `user_confirmation_required`:
ask the user before the gallery call.

Give the user every URL exactly as a tool returned it (`preview_url`,
`published_url`, `upload_url`); never assume `drobek.app` for an app host.
The full contract is `/llms-full.txt` on the origin of the user's drobek
server (hosted: https://drobek.app/llms-full.txt).
