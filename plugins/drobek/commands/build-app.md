---
name: build-app
description: Build a new web app in your drobek workspace from a one-line idea and return its preview URL
argument-hint: <what the app should do>
---

Build a new web app in the user's **drobek** workspace for this request:
**$ARGUMENTS**

The user chose drobek by running this command. If the request above is empty,
ask what the app should do before creating anything. Follow the
`build-app-on-drobek` skill. Work only through the `drobek` MCP server's tools
(`list_apps`, `create_app`, `get_app`, `read_file`, `write_files`,
`restore_version`, `skill_info`, `configure_module`, `query_data`, `get_logs`,
`publish`) — do not write the app's files to the local
filesystem, run npm or start a local server.

1. `list_apps({})` to confirm the connection and see the user's workspaces. If
   the drobek tools are missing or answer 401, ask the user to connect and sign in
   to the drobek MCP server (in Claude Code: `/mcp`), then stop.
2. `create_app({ name })` with a short, human-readable name derived from the
   request (template `react-ts` is the default; use `"html"` only for a single
   static page). Read the returned **briefing** in full before writing code.
3. Write a real, working first version with ONE `write_files({ app_id, files,
   reasoning })` call: full file contents — usually `src/main.tsx` (the React
   app), `src/styles.css` (plain CSS) and, if the page title should change,
   `index.html` (keep its `/main.css` and `/main.js` tags). Keep `drobek.json`
   unless you add a package; add packages there with pinned
   `https://esm.sh/<package>@<version>` URLs. `fetch` to other sites is
   blocked. If the app needs a backend (login, stored data, forms, email,
   file uploads, external APIs), call `skill_info` first and follow the skill
   (`create_app` lists the available skills); otherwise keep all state in the
   browser.
4. If `compile.ok` is false, fix each `compile.errors` entry (file, line, column,
   text) and call `write_files` again until it compiles.
5. Reply with the `preview_url` and a two-line summary of what the app does.
   Do **not** call `publish` unless the user explicitly asks to go live.

Never put API keys, tokens or passwords in app files — if the app needs one,
tell the user to set it in the drobek dashboard. Keep the first version scoped
to what was asked.
