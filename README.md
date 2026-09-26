# drobek plugins for coding agents

[drobek](https://github.com/freema/drobek) is an open-source (AGPL),
self-hostable cloud workspace for web apps built by agents — use the hosted
instance at [drobek.app](https://drobek.app) or run your own. With the
**drobek** plugin, your agent (Claude Code, Codex or Cursor) works directly in
your drobek workspace: it creates an app, writes its files, gets
the server-side compile result back on every write and hands you a live preview
URL. Every change is an immutable version, and a version goes live on its
production URL only when you ask for it.

The plugin connects the MCP server of your drobek server, `<origin>/mcp` (OAuth
2.1 — you sign in to that drobek in the browser and approve the scopes), and
teaches the agent the build loop. The origin defaults to the hosted
`https://drobek.app`; to use a self-hosted drobek, see
[Server URL](#server-url-drobek_url).

## Quick start with npx

```sh
npx drobek-plugin                                        # setup steps for Claude Code, Codex and Cursor
npx drobek-plugin cursor --url https://drobek.example.com # one agent, a self-hosted drobek
```

The npm package [`drobek-plugin`](https://www.npmjs.com/package/drobek-plugin)
only prints: it never edits your agent's config and never asks for a key. It
also carries the plugin itself, so Claude Code can load it without the
marketplace:

```sh
claude --plugin-dir "$(npx -y drobek-plugin path)"
```

## Claude Code

```sh
claude plugin marketplace add freema/drobek-plugin
claude plugin install drobek@drobek
```

Inside Claude Code the same works as `/plugin marketplace add freema/drobek-plugin`
and `/plugin install drobek@drobek`. Then run `/mcp`, select the drobek server and
sign in. Build an app:

```text
/drobek:build-app a tip calculator that splits the bill between friends
```

The agent replies with the app's preview URL. Ask it to publish when you want the
app live.

Move a Claude artifact (a page, a React component, or a folder with its images
and video) to drobek:

```text
/drobek:port-artifact ./family-film
```

The agent writes the text files unchanged, uploads every video, image and font
through a single-use upload URL (`curl -T`, never through the model) at the path
the page already uses, and replies with the preview URL.

For a self-hosted drobek, start Claude Code with `DROBEK_URL` set to its origin
(see [Server URL](#server-url-drobek_url)).

## Codex

```sh
codex plugin marketplace add freema/drobek-plugin
codex plugin add drobek@drobek
codex mcp login drobek
```

`codex mcp login drobek` opens the drobek sign-in in your browser; restart Codex
afterwards so it loads the drobek tools. Codex has no plugin commands: ask it to
build an app on drobek, or to move a Claude artifact to drobek (the
`port-artifact-to-drobek` skill).

Codex does not expand environment variables in a plugin's MCP config, so the
plugin connects the hosted `https://drobek.app/mcp`. For a self-hosted drobek,
add your endpoint under the same name before the login — a `drobek` server in
your `~/.codex/config.toml` takes the place of the plugin's:

```sh
codex mcp add drobek --url https://drobek.example.com/mcp
codex mcp login drobek
```

## Cursor

**One-click MCP install** (the hosted drobek)

[Add drobek to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=drobek&config=eyJ1cmwiOiJodHRwczovL2Ryb2Jlay5hcHAvbWNwIn0=)

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=drobek&config=eyJ1cmwiOiJodHRwczovL2Ryb2Jlay5hcHAvbWNwIn0=
```

**Or add the server by hand** in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "drobek": {
      "url": "https://drobek.app/mcp"
    }
  }
}
```

For a self-hosted drobek, put your origin in `url` instead
(`https://drobek.example.com/mcp`), or read it from the environment with
Cursor's interpolation: `"url": "${env:DROBEK_URL}/mcp"` (`DROBEK_URL` must
then be set wherever Cursor starts). Sign in when Cursor asks; the server then
shows as connected under Settings → Tools & MCP.

The plugin in this repository (`.cursor-plugin/`) adds the
`build-app-on-drobek` and `port-artifact-to-drobek` skills, the
`route-app-builds-to-drobek` rule and the `build-app` and `port-artifact`
commands on top of the MCP server. It also bundles the hosted
server (`https://drobek.app/mcp`); with a self-hosted drobek, keep your own
`drobek` entry and turn the plugin's server off under Settings → Tools & MCP.

## What the plugin ships

| Piece | Role |
| --- | --- |
| `plugins/drobek/.mcp.json` | Claude Code: the `drobek` MCP server at `${DROBEK_URL:-https://drobek.app}/mcp` (OAuth 2.1). |
| `plugins/drobek/.mcp.hosted.json` | Codex and Cursor: the `drobek` MCP server at `https://drobek.app/mcp` (neither expands an env var with a default in a plugin's MCP config). |
| `skills-claude/build-app-on-drobek` | Claude Code workflow — used only once the user has chosen drobek. |
| `skills-codex/build-app-on-drobek` | Codex workflow. |
| `skills-cursor/build-app-on-drobek` | Cursor workflow. |
| `skills-{claude,codex,cursor}/port-artifact-to-drobek` | Move a Claude artifact to drobek: text files unchanged, every binary through an upload URL at the same path, the artifact ↔ drobek differences (CSP, no `window.claude.*`, limits). |
| `rules/route-app-builds-to-drobek.mdc` | Cursor rule: drobek work when the user chose drobek, local work stays local. |
| `commands/build-app.md` | `/drobek:build-app <idea>` — build an app and return its preview URL. |
| `commands/port-artifact.md` | `/drobek:port-artifact <path>` (Cursor: `port-artifact`) — move a Claude artifact to drobek and return its preview URL. |

The three skills share one body: `list_apps` → `create_app` (read the briefing) →
`write_files` (fix `compile.errors` until it compiles) → give the user the
`preview_url` → `publish` only on an explicit request → the public gallery only
after the user's explicit yes (`user_confirmed: true`). Video, audio, images and
fonts go through `create_asset_upload` (a single-use upload URL for `curl -T`),
never as base64 through a tool call. They take every URL from
the tool results and never assume `drobek.app` — app hosts are
`<slug>.<APPS_DOMAIN>` of the server you use. The authoritative tool contract is
`<origin>/llms-full.txt` of your drobek server (hosted:
[drobek.app/llms-full.txt](https://drobek.app/llms-full.txt)).

## The drobek MCP tools

The server shows each client only the tools its grant allows (`read`, `write`,
`publish` on the consent screen). Every tool carries the MCP annotations
`readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint`.

| Tool | Scope | Annotations | What it does |
| --- | --- | --- | --- |
| `list_apps` | read | read-only | You, your workspaces with your role, and the apps in them. Start here. |
| `create_app` | write | not destructive | A new app with a compiling version 1 (`react-ts` or `html`), its `preview_url`, the briefing and the skills list. |
| `get_app` | read | read-only | One app: briefing, files, last 20 versions, module configs (secrets as `hasSecret` only), the write lock. |
| `read_file` | read | read-only | One file of a version, inside an untrusted envelope. |
| `write_files` | write | destructive | 1–20 file changes → one new version → one server-side compile (the result comes back). |
| `restore_version` | write | destructive | A new version that copies an old one (history is never rewritten). |
| `skill_info` | read | read-only | The server's skills: the list, or one skill's Markdown with SDK types, config schema and limits. |
| `configure_module` | write | destructive, idempotent | A platform module's config for one app (a partial merge patch); sensitive changes wait for the owner's confirmation. |
| `query_data` | read | read-only | Records of one of the app's data collections (≤ 100 per call), inside an untrusted envelope. |
| `get_logs` | read | read-only | Browser errors (`runtime`), the compile history (`compile`) or request stats (`requests`). |
| `create_asset_upload` | write | not destructive | A single-use upload URL (30 minutes) for one video, audio file, image or font at `/<path>` of the app — `curl -T <file> '<url>'`, never base64. |
| `list_assets` | read | read-only | The app's assets (path, size, type) and its asset quota. |
| `delete_asset` | write | destructive, idempotent | Removes one asset. |
| `publish` | publish | destructive, idempotent, open world | Puts a compiled version on the production URL — only when the user asks. |
| `set_gallery_listing` | publish | not destructive, idempotent, open world | Lists a published app in the server's public gallery — only with `user_confirmed: true` after the user said yes — or takes it out. |

## The skills `skill_info` offers

With the six built-in platform modules active (the production compose default)
`skill_info()` lists ten skills; a self-hosted server lists the modules it runs.
An opt-in module (`availability: "opt-in"`) works only in the workspaces the
operator enabled it for: `skill_info({ name, app_id })` says
`enabled_for_workspace`, and `configure_module` answers `module_not_enabled`
elsewhere.

| Skill | Kind | Use when |
| --- | --- | --- |
| `auth` | module | people must sign in to the app (invited e-mails, a company domain, admins, per-user data) |
| `data` | module | the app stores records (lists, todos, entries, votes) |
| `forms` | module | visitors fill in a form and the answers must be kept or e-mailed to the owner |
| `email` | module | the app must tell its owners about something by e-mail |
| `files` | module | people upload files the app keeps (photos, PDFs, CSVs) |
| `proxy` | module | the app calls an external API that needs a secret key |
| `start` | general | creating or changing an app: files, `drobek.json`, the write → preview → publish loop |
| `debug` | general | a write did not compile, the preview is broken, or a module call fails |
| `ui` | general | styling and screens: Tailwind from esm.sh, responsive and accessible layout |
| `port-artifact` | general | moving a Claude artifact to drobek: text files unchanged, binaries through upload URLs |

## Server URL (`DROBEK_URL`)

drobek is AGPL and self-hostable ([freema/drobek](https://github.com/freema/drobek)).
The plugin talks to one drobek server, set by its origin:

- **Setting:** `DROBEK_URL` — the origin only: scheme + host (+ port), no
  trailing slash, no `/mcp`. Example: `https://drobek.example.com`.
- **Default:** `https://drobek.app` (the hosted drobek).
- **MCP endpoint:** `$DROBEK_URL/mcp`.

**Claude Code** expands `${DROBEK_URL:-https://drobek.app}/mcp` in the plugin's
`.mcp.json` when it starts. Set the variable in your shell:

```sh
export DROBEK_URL=https://drobek.example.com
claude
```

or for every session in `~/.claude/settings.json`:

```json
{ "env": { "DROBEK_URL": "https://drobek.example.com" } }
```

Leave it unset for the hosted drobek. `claude mcp get plugin:drobek:drobek`
shows the URL in use. **Codex** and **Cursor** do not expand a variable with a
default in a plugin's MCP config: add your endpoint as described under
[Codex](#codex) and [Cursor](#cursor).

The OAuth sign-in (`/mcp` in Claude Code, `codex mcp login drobek`, Cursor's
sign-in) happens against that same origin: you sign in with your account on
that drobek server and approve the scopes on its consent screen. After changing
the URL, sign in again. The server's own setup page,
`<origin>/build-with-your-agent`, shows its MCP endpoint.

## Development

```sh
npm ci
npm test          # the npx CLI
npm run validate
```

`npm run validate` needs the Claude Code CLI (`claude`) on the PATH and runs:

- `claude plugin validate --strict` on the marketplace, the plugin, and every skill
  variant + command (`scripts/validate-claude-components.mjs`);
- the Cursor schema and structure validators and the Codex validator
  (`scripts/validate-*.mjs`, adapted from langtail/macaly-code-plugin — see
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md));
- `scripts/check-drobek.mjs`: every skill names every drobek tool and carries the
  loop rules, the three skills share one body, the three
  `port-artifact-to-drobek` variants carry the port procedure and share one body,
  both commands take `$ARGUMENTS` and forbid publishing without a request, all manifests carry one version,
  each host's MCP config carries its URL (`DROBEK_URL` for Claude Code, the hosted
  endpoint for Codex and Cursor), both READMEs document `DROBEK_URL`, and no
  drobek API key is in the repository.

When the drobek MCP tool surface changes, update the skills and the tool list in
`scripts/check-drobek.mjs` together with `TOOL_DOCS` in the drobek repository.

## Releasing to npm

Bump the version in `package.json` and in every plugin and marketplace manifest
(`npm run check` fails when they differ), commit, then tag and push:

```sh
npm pack --dry-run   # the package holds bin/, plugins/, the marketplaces and the docs
git tag v0.2.2 && git push origin v0.2.2
```

The tag runs `.github/workflows/release.yml`, which tests the package and
publishes it with npm Trusted Publishing (OIDC, provenance attached) — no npm
token lives in the repository. The npm package trusts that workflow under
*Settings → Trusted Publisher* on npmjs.com.

## License

MIT — see [LICENSE](LICENSE).
