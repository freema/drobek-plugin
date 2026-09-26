---
name: port-artifact
description: Move a Claude artifact (a page, a React component or a folder with its images and video) into your drobek workspace as a new app and return its preview URL
argument-hint: <path to the artifact's folder or file>
---

Move this Claude artifact into the user's **drobek** workspace as a new app:
**$ARGUMENTS**

The user chose drobek by running this command. If no path is given above, ask
where the artifact's files are (a downloaded artifact file, or a folder with
`index.html` and its images and video) before creating anything. Follow the
`port-artifact-to-drobek` skill. Work only through the `drobek` MCP server's
tools (`list_apps`, `create_app`, `write_files`, `create_asset_upload`,
`list_assets`, `delete_asset`, `get_logs`, `skill_info`, `publish`,
`set_gallery_listing`) plus reading the artifact's files and running `stat`
and `curl` for the uploads — do not start a local server, run npm or change
the artifact's files on disk.

1. `list_apps({})` to confirm the connection. If the drobek tools are missing
   or answer 401, ask the user to connect and sign in to their drobek MCP
   server (in Claude Code: `/mcp`), then stop.
2. List the artifact: text files (HTML, JS, CSS, JSON, SVG, JSX/TSX) and
   binaries (video, audio, images, fonts). `create_app({ name })` with a short
   name derived from the artifact — `template: "html"` for a page or a
   folder, `"react-ts"` for a single React component. Read the briefing.
3. Write every text file with `write_files({ app_id, files, reasoning })`,
   paths and content unchanged (1–20 files per call).
4. For every binary: its exact size (`stat`), then
   `create_asset_upload({ app_id, path, size })` at the SAME relative path the
   page uses, then `curl -fsS -T <file> '<upload_url>'`. Never put a binary
   or base64 into a tool call.
5. Check `compile.ok`, `list_assets({ app_id })` (every binary with its size)
   and fix what the skill's "What differs from the artifact sandbox" section
   names (CDN scripts, external `fetch`, `window.claude.*`).
6. Reply with the `preview_url` exactly as the tool returned it (never build
   an app URL yourself or assume `drobek.app`) and ask the user to open it
   and play the video. Do **not** call `publish` unless the user explicitly
   asks to go live, and call `set_gallery_listing` only after the user said
   yes to the gallery description you showed them.

Never put API keys, tokens or passwords in app files — if the artifact has
one, remove it and tell the user to set the secret in the drobek dashboard.
