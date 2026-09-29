# drobek plugins for coding agents

[drobek](https://github.com/freema/drobek) is an open-source (AGPL) cloud
workspace for web apps built by agents. Use the hosted instance at
[drobek.app](https://drobek.app) or run your own server.

The drobek plugin lets Claude Code, Codex or Cursor build apps directly in your
drobek workspace. The agent writes the files, checks the server's compile result
after each write and gives you a live preview URL. Every change creates an
immutable version. The agent publishes a version to its production URL only
when you ask.

The plugin connects to your drobek server at `<origin>/mcp` and provides the
agent's build workflow. It uses OAuth 2.1: you sign in through your browser and
approve the requested scopes. The default origin is `https://drobek.app`;
to connect to your own server, see
[Server URL](#server-url-drobek_url).

## Why I built this

At work, almost everyone has started vibecoding: landing pages, internal tools,
small websites and reports for colleagues. I wanted us to have an answer to
where those apps run, who can access them and where the API keys end up.

I built drobek for that. It grew out of something we run internally, and I
released it as open source so others can host it too. People bring the coding
agent they already use; drobek compiles, versions and hosts the frontend.
Backend features go through modules, and the app owner sets secrets in the
dashboard.

This plugin connects that workflow to Claude Code, Codex and Cursor. The agent
can build an app, fix compile errors and return a preview in the same
conversation. You decide when it goes live.

## Quick start with npx

```sh
npx drobek-plugin                                        # setup steps for Claude Code, Codex and Cursor
npx drobek-plugin cursor --url https://drobek.example.com # one agent, a self-hosted drobek
```

The npm package [`drobek-plugin`](https://www.npmjs.com/package/drobek-plugin)
prints setup instructions. It does not edit your agent's config or ask for a
key. It also includes the plugin, so Claude Code can load it without the
marketplace:

```sh
claude --plugin-dir "$(npx -y drobek-plugin path)"
```

## Claude Code

```sh
claude plugin marketplace add freema/drobek-plugin
claude plugin install drobek@drobek
```

Inside Claude Code, use `/plugin marketplace add freema/drobek-plugin`
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

The agent copies the text files unchanged and uploads videos, images and fonts
to the paths the page already uses. Binary files go through single-use upload
URLs (`curl -T`), never through the model. The agent then returns the preview URL.

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
add your endpoint under the same name before signing in. A `drobek` server in
your `~/.codex/config.toml` takes the place of the plugin's:

```sh
codex mcp add drobek --url https://drobek.example.com/mcp
codex mcp login drobek
```

## Cursor

Install the hosted drobek MCP server with this link:

[Add drobek to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=drobek&config=eyJ1cmwiOiJodHRwczovL2Ryb2Jlay5hcHAvbWNwIn0=)

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=drobek&config=eyJ1cmwiOiJodHRwczovL2Ryb2Jlay5hcHAvbWNwIn0=
```

You can also add the server manually in `~/.cursor/mcp.json`:

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
shows as connected under Settings > Tools & MCP.

The plugin in this repository (`.cursor-plugin/`) adds the
`build-app-on-drobek` and `port-artifact-to-drobek` skills, the
`route-app-builds-to-drobek` rule and the `build-app` and `port-artifact`
commands on top of the MCP server. It also bundles the hosted
server (`https://drobek.app/mcp`); with a self-hosted drobek, keep your own
`drobek` entry and turn the plugin's server off under Settings > Tools & MCP.

## What the plugin ships

| Piece | Role |
| --- | --- |
| `plugins/drobek/.mcp.json` | Claude Code: the `drobek` MCP server at `${DROBEK_URL:-https://drobek.app}/mcp` (OAuth 2.1). |
| `plugins/drobek/.mcp.hosted.json` | Codex and Cursor: the `drobek` MCP server at `https://drobek.app/mcp` (neither expands an env var with a default in a plugin's MCP config). |
| `skills-claude/build-app-on-drobek` | Claude Code workflow, used only after the user chooses drobek. |
| `skills-codex/build-app-on-drobek` | Codex workflow. |
| `skills-cursor/build-app-on-drobek` | Cursor workflow. |
| `skills-{claude,codex,cursor}/port-artifact-to-drobek` | Move a Claude artifact to drobek, preserving text files and uploading binaries at the same paths. Covers differences in CSP, runtime APIs (no `window.claude.*`) and limits. |
| `rules/route-app-builds-to-drobek.mdc` | Cursor rule: use drobek when the user chooses it; keep local work local. |
| `commands/build-app.md` | `/drobek:build-app <idea>`: build an app and return its preview URL. |
| `commands/port-artifact.md` | `/drobek:port-artifact <path>` (Cursor: `port-artifact`): move a Claude artifact to drobek and return its preview URL. |

The three build skills share the same workflow. The agent calls `list_apps`,
creates the app with `create_app` and reads its briefing. It then calls
`write_files`, fixes any `compile.errors` and returns the `preview_url`.
It calls `publish` only on an explicit request and lists the app in the public
gallery only after the user agrees (`user_confirmed: true`).

Video, audio, images and fonts go through `create_asset_upload`, which returns
a single-use URL for `curl -T`. They must never be sent as base64 in a tool call.
The agent uses URLs from tool results; it never assumes `drobek.app` because app
hosts are `<slug>.<APPS_DOMAIN>` on the connected server. The tool contract is
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
| `write_files` | write | destructive | Applies 1–20 file changes, creates one version and returns its server-side compile result. |
| `restore_version` | write | destructive | A new version that copies an old one (history is never rewritten). |
| `skill_info` | read | read-only | The server's skills: the list, or one skill's Markdown with SDK types, config schema and limits. |
| `configure_module` | write | destructive, idempotent | A platform module's config for one app (a partial merge patch); sensitive changes wait for the owner's confirmation. |
| `query_data` | read | read-only | Records of one of the app's data collections (≤ 100 per call), inside an untrusted envelope. |
| `get_logs` | read | read-only | Browser errors (`runtime`), the compile history (`compile`) or request stats (`requests`). |
| `create_asset_upload` | write | not destructive | A single-use upload URL (30 minutes) for one video, audio file, image or font at `/<path>` of the app. Upload with `curl -T <file> '<url>'`, never base64. |
| `list_assets` | read | read-only | The app's assets (path, size, type) and its asset quota. |
| `delete_asset` | write | destructive, idempotent | Removes one asset. |
| `list_domains` | read | read-only | The app's custom domains: status (pending / verified), primary, the two DNS records to create and the last check. |
| `add_domain` | write | not destructive, idempotent | Attaches a domain the user owns and returns the CNAME and TXT records to create. |
| `verify_domain` | write | not destructive, idempotent, open world | Looks both records up; `domain_not_verified` names the missing or wrong one (DNS can take up to 48 hours). |
| `remove_domain` | write | destructive, idempotent, open world | Detaches a domain. A verified domain requires `user_confirmed: true`. |
| `list_upstreams` | read (workspace admins) | read-only | The workspace's proxy upstreams: base URL, allowed methods and path prefixes, auth type, whether a key is stored and the apps allowed to call each. |
| `register_upstream` | write (workspace admins) | not destructive, idempotent | Registers an external API for the proxy module. `auth_type: "none"` registers immediately; `bearer` / `header` return `secret_url`, a prefilled dashboard form where the user enters the key. Keys never pass through MCP. |
| `remove_upstream` | write (workspace admins) | destructive, idempotent | Removes an upstream and its key with `user_confirmed: true`. Apps calling it stop working immediately. |
| `publish` | publish | destructive, idempotent, open world | Puts a compiled version on the production URL when the user asks. `publish_blocked` means the operator disabled publishing for the workspace; `publish_not_approved` means operator approval is required. Both errors name the operator in `contact`. |
| `set_gallery_listing` | publish | not destructive, idempotent, open world | Lists a published app in the server's public gallery with `user_confirmed: true` after the user agrees, or removes it from the gallery. |
| `duplicate_app` | write | not destructive | Copies a gallery app whose owner allows duplicates into a new, unpublished app in your workspace (published files as version 1); module settings that need a confirmation come back with a `confirm_url`. Only when the user asks. |
| `set_primary_domain` | publish | not destructive, idempotent, open world | Makes a verified domain the app's primary address (the production URL redirects there) or clears it. Requires `user_confirmed: true`. |
| `set_workspace_publishing` | publish (super-admins only) | not destructive, idempotent | Sets a workspace's publishing to `default` (the server mode decides), `allowed` or `blocked`. Requires `user_confirmed: true`. |

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
| `start` | general | creating or changing an app: files, `drobek.json`, writing, previewing and publishing |
| `debug` | general | a write did not compile, the preview is broken, or a module call fails |
| `ui` | general | styling and screens: Tailwind from esm.sh, responsive and accessible layout |
| `port-artifact` | general | moving a Claude artifact to drobek: text files unchanged, binaries through upload URLs |

## Server URL (`DROBEK_URL`)

drobek is AGPL and self-hostable ([freema/drobek](https://github.com/freema/drobek)).
The plugin talks to one drobek server, set by its origin:

Set `DROBEK_URL` to the origin only: scheme, host and optional port, with no
trailing slash and no `/mcp`. For example: `https://drobek.example.com`.
The default is `https://drobek.app`, and the MCP endpoint is `$DROBEK_URL/mcp`.

Claude Code expands `${DROBEK_URL:-https://drobek.app}/mcp` in the plugin's
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
shows the URL in use. Codex and Cursor do not expand a variable with a
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
  (`scripts/validate-*.mjs`, adapted from langtail/macaly-code-plugin; see
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md));
- `scripts/check-drobek.mjs`, which checks the tool names and workflow rules,
  matching bodies across the build skills and across the three
  `port-artifact-to-drobek` variants, and `$ARGUMENTS` and publishing restrictions
  in both commands. It also checks that manifest versions match, each host uses
  the correct MCP URL (`DROBEK_URL` for Claude Code, the hosted endpoint for Codex
  and Cursor), both READMEs document `DROBEK_URL`, and the repository contains no
  drobek API keys.

When the drobek MCP tool surface changes, update the skills and the tool list in
`scripts/check-drobek.mjs` together with `TOOL_DOCS` in the drobek repository.

## Releasing to npm

Bump the version in `package.json` and in every plugin and marketplace manifest
(`npm run check` fails when they differ), commit, then tag and push:

```sh
npm pack --dry-run   # the package holds bin/, plugins/, the marketplaces and the docs
git tag v0.2.10 && git push origin v0.2.10
```

The tag runs `.github/workflows/release.yml`. The workflow tests the package,
checks that the tag matches the `package.json` version, publishes to npm with
provenance through Trusted Publishing (OIDC), and creates a GitHub Release.
It needs no npm token in the repository. Check that the release appears as
Latest under Releases; if the job did not run, create the release manually.
The npm package trusts this workflow through Settings > Trusted Publisher on
npmjs.com.

## License

MIT. See [LICENSE](LICENSE).
