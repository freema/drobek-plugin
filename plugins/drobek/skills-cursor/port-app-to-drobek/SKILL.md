---
name: port-app-to-drobek
description: Move a project exported from Lovable, Bolt, v0 or any Vite + React app (a repo, a zip or a folder) into the user's drobek workspace as a new app, paths unchanged and backend calls moved to drobek modules. Use when the user asks to move, port or host such a project on drobek, or runs the port-app command.
---

# Move a Lovable, Bolt, v0 or Vite + React app to drobek

Lovable, Bolt, v0 and StackBlitz export a Vite + React + TypeScript project,
often with Tailwind, shadcn/ui and a Supabase client. Most of its files move to
drobek unchanged: drobek compiles the TSX on the server, `drobek.json` `paths`
resolves the `@/` alias and the packages load from esm.sh. Read the project's
files on this machine and transfer them through the `drobek` MCP server
(`list_apps`, `create_app`, `write_files`, `read_file`, `skill_info`,
`configure_module`, `create_records`, `create_asset_upload`, `list_assets`,
`get_app`, `get_logs`, `publish`); the drobek server fetches nothing. Follow
`build-app-on-drobek` for the build workflow and rules. If `skill_info()`
lists `port-app`, read `skill_info('port-app')` for the server's version of
this procedure.

## When to use this

Use this when the user asks to move, port or host such a project on drobek,
or runs the drobek `port-app` command. The drobek tools must be connected; if
they are missing or answer 401, ask the user to sign in to the drobek server
under Cursor Settings > Tools & MCP, then stop.

A Claude artifact goes through `port-artifact-to-drobek` instead. Next.js,
Remix, SvelteKit, Nuxt or Astro with server code (route handlers, server
components or actions) does not port: tell the user at once that the server
part stays behind; its client components can be rebuilt as a `react-ts` app.

## The procedure

1. Inventory the project: the `package.json` dependencies, the routes
   (`<Route path>`), every `import.meta.env`, every backend call
   (`supabase.`, `fetch('https://…')`), `public/` and the `<head>` of
   `index.html`. Show the user the plan as a table (what moves unchanged,
   what becomes a drobek module, what is left out) and ask once: "Move
   <project> to drobek as a new app?" (and which workspace, if `list_apps`
   shows more than one).
2. `create_app({ name, template: "react-ts", workspace? })` and read the
   briefing: it has this server's limits.
3. `drobek.json`: each dependency the code imports, pinned to the version of
   `package.json` as an esm.sh URL. React stays on the export's version and
   every package that imports React gets `?deps=react@<version>,react-dom@<version>`
   (one React on the page); `"paths": { "@/*": ["src/*"] }` resolves the
   shadcn/ui alias:

   ```json
   {
     "imports": {
       "react": "https://esm.sh/react@18.3.1",
       "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
       "react-dom": "https://esm.sh/react-dom@18.3.1?deps=react@18.3.1",
       "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
       "react-router-dom": "https://esm.sh/react-router-dom@6.26.2?deps=react@18.3.1,react-dom@18.3.1",
       "lucide-react": "https://esm.sh/lucide-react@0.462.0?deps=react@18.3.1"
     },
     "paths": { "@/*": ["src/*"] }
   }
   ```

4. `index.html` loads `/main.js` and `/main.css` (not `/src/main.tsx`) and
   Tailwind v4's browser build from esm.sh. The `tailwind.config` colors and
   the `@apply` rules move into a `<style type="text/tailwindcss">` in the
   `<head>`; the `:root` / `.dark` variables stay in `src/index.css` without
   the `@tailwind` lines:

   ```html
   <script type="module" src="https://esm.sh/@tailwindcss/browser@4.1.11"></script>
   <style type="text/tailwindcss">
     @custom-variant dark (&:is(.dark *));
     @theme inline {
       --color-background: hsl(var(--background));
       --color-foreground: hsl(var(--foreground));
       --color-primary: hsl(var(--primary));
       --color-border: hsl(var(--border));
       --radius-lg: var(--radius);
     }
     @layer base { * { @apply border-border; } body { @apply bg-background text-foreground; } }
   </style>
   <link rel="stylesheet" href="/main.css" />
   ```

   Keep `<div id="root">` and `<script type="module" src="/main.js">` in the
   `<body>`, plus a `<title>`, a description and a favicon.
5. `write_files({ app_id, files, reasoning })` in parts (1–20 files per call),
   paths unchanged: first everything except `src/main.tsx` and `src/App.tsx`
   (`drobek.json`, `index.html`, `src/index.css`, `src/lib/*`,
   `src/components/*`, the pages; nothing imports them yet, so the
   template's `src/main.tsx` still compiles), then those two, deleting the
   template's `src/styles.css`. Fix every `compile.errors` entry.
6. `public/x` is served at `/x`: text files (`.svg`, `robots.txt`, a
   manifest) go through `write_files` at `x`; images and fonts through
   `create_asset_upload({ app_id, path: "x", size })` and `curl -fsS -T`,
   never base64 through a tool call.
7. Move each backend call to a drobek module, each after its `skill_info`:

   | in the export | on drobek |
   | --- | --- |
   | Supabase Auth (`supabase.auth.*`, a sign-in page) | `auth`: `<LoginGate>`, `drobek.auth.me()` |
   | Supabase tables, RLS policies | `data`: a collection per table, policies → `rules`, columns → `schema`; rows from the user's CSV/JSON export through `create_records` (≤ 500 per call), or a `sync` source on the table's REST API |
   | Supabase Storage | `files` |
   | Edge Functions, an API called with a key | a `proxy` upstream (the owner sets the key in the dashboard), or leave it out and tell the user |
   | Resend / Mailgun / EmailJS in the client | `email` |
   | a form posting to a third party | `forms` |
   | incoming webhooks (Stripe, GitHub) | `webhooks` |
   | `import.meta.env.VITE_*` | a public value → a constant in the code; a secret → the key of a proxy upstream |

   `supabase.from('messages').select('*')` becomes
   `drobek.data.collection('messages').list()` (its `records`); `row.id` and `row.created_at`
   become `_id` and `_created_at`. Declare each collection with
   `configure_module`; a sensitive change waits for the owner's
   confirmation (`confirm_url`).
   Before using a backend (login, stored data, forms, email, file uploads, external APIs), call `skill_info` and follow the skill; `create_app`/`get_app` list the available skills.
8. Check `compile.warnings` (`blocked_by_csp`, `missing_reference`) and the
   `type_error` warnings `get_app` lists a few seconds after a write, give the
   user the `preview_url`, and after they opened it read
   `get_logs({ app_id, kind: "browser" })` (the preview's errors with the
   stack mapped to your `src/…` lines). Checklist: every route renders (a
   deep link too), no request outside the app and esm.sh, a phone width, dark
   mode when the original had it.
9. Publish only when the user explicitly asks: call `publish({ app_id })` and
   give them the `published_url`.

## What does not port

- Never port `vite.config.*`, `tailwind.config.*`, `postcss.config.*`,
  `tsconfig*.json`, `components.json`, `.env*`, lockfiles, `node_modules`,
  `supabase/`, server code, `src/vite-env.d.ts` or the third-party scripts
  of `index.html` (analytics, `cdn.gpteng.co`): the app's Content Security
  Policy blocks them.
- Scripts load only from the app and https://esm.sh, and `fetch` reaches only
  the app and esm.sh: a Supabase or Firebase client cannot work.
- Without `?deps=react@<version>` esm.sh serves a second React and rendering
  fails (React error #31). Do not use `?external=react`: it leaves a bare
  `import "react"` the browser cannot resolve.
- Tailwind's browser build has no `@plugin` and no config file:
  `@plugin "tailwindcss-animate"` stops all styles, so leave it out
  (`animate-*` classes then do nothing). A few v3 names differ (`shadow-sm` →
  `shadow-xs`, `outline-none` → `outline-hidden`). `@tailwind` and `@apply`
  in a bundled `.css` file do nothing.
- `import.meta.env` is undefined at run time (a `TypeError`), and a key never
  goes into a file. A path without an extension serves `index.html`, so
  client-side routing works.

## Errors

A failed call returns `{ code, message, hint }`. Follow the `hint`.
`unresolved_import`: a package missing from `imports` (add its pinned esm.sh
URL) or `@/…` without `paths`. `invalid_config`: `paths` is not shaped
`{ "@/*": ["src/*"] }`. `blocked_by_csp`: a third-party script or a
`fetch('https://…')`; drop the script, call the API through the proxy module.
`missing_reference`: a `public/` file neither written nor uploaded.
`secret_in_source`: a key from `.env` in the code; remove it, the owner sets
it on a proxy upstream. `limit_exceeded`: a version over the file or size
limit (200 files and 5 MiB by default); leave out the `components/ui/*` files
nothing imports.

Give the user every URL exactly as a tool returned it (`preview_url`,
`published_url`, `confirm_url`, `upload_url`); never assume `drobek.app` for
an app host. The full contract is `/llms-full.txt` on the origin of the
user's drobek server (hosted: https://drobek.app/llms-full.txt).
