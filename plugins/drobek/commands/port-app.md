---
name: port-app
description: Move a Lovable, Bolt, v0 or Vite + React project (a repo, a zip or a folder) into your drobek workspace as a new app and return its preview URL
argument-hint: <path to the project's folder or zip>
---

Move this Lovable, Bolt, v0 or Vite + React project into the user's drobek
workspace as a new app:
$ARGUMENTS

The user chose drobek by running this command. If no path is given above, ask
where the project's files are (an exported repo, a zip or a folder with
`package.json` and `src/`) before creating anything. Follow the
`port-app-to-drobek` skill. Work only through the `drobek` MCP server's tools
(`list_apps`, `create_app`, `get_app`, `read_file`, `write_files`,
`skill_info`, `configure_module`, `create_records`, `create_asset_upload`,
`list_assets`, `get_logs`, `publish`) plus reading the project's files and
running `stat` and `curl` for the uploads. Do not run npm, start a local
server or change the project's files on disk.

1. `list_apps({})` to confirm the connection. If the drobek tools are missing
   or answer 401, ask the user to connect and sign in to their drobek MCP
   server (in Claude Code: `/mcp`), then stop.
2. Inventory the project: `package.json` dependencies, routes, every
   `import.meta.env`, every backend call (`supabase.`, `fetch('https://…')`)
   and `public/`. A Next.js, Remix or SvelteKit server part does not port:
   say so at once. Show the user the plan and ask before creating the app.
3. `create_app({ name, template: "react-ts" })` with a short name derived
   from the project. Read the briefing.
4. Write the files with `write_files({ app_id, files, reasoning })`, paths
   unchanged (1–20 files per call): `drobek.json` with every dependency as a
   pinned esm.sh URL (`?deps=react@<version>,react-dom@<version>` on every
   package that imports React) and `"paths": { "@/*": ["src/*"] }`, an
   `index.html` that loads `/main.js`, `/main.css` and Tailwind's browser
   build, then the components and pages, `src/main.tsx` and `src/App.tsx`
   last. Never port build config, `.env` files or lockfiles.
5. Upload `public/` images and fonts with `create_asset_upload({ app_id,
   path, size })` at the same path and `curl -fsS -T <file> '<upload_url>'`.
   Never put a binary or base64 into a tool call.
6. Move Supabase Auth, tables, Storage and Edge Functions to the `auth`,
   `data`, `files` and `proxy` modules, each after its `skill_info`. Fix
   `compile.errors` and `compile.warnings` until the version compiles clean.
7. Reply with the `preview_url` exactly as the tool returned it (never build
   an app URL yourself or assume `drobek.app`) and ask the user to click
   through every route. Do **not** call `publish` unless the user explicitly
   asks to go live.

Never put API keys, tokens or passwords in app files. If the project has one
(an `.env` value), leave it out and tell the user to set the secret in the
drobek dashboard.
