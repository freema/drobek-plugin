# drobek plugins for coding agents

[drobek](https://drobek.app) is an open-source cloud workspace for web apps built
by agents. With the **drobek** plugin, your agent (Claude Code, Codex or Cursor)
works directly in your drobek workspace: it creates an app, writes its files, gets
the server-side compile result back on every write and hands you a live preview
URL. Every change is an immutable version, and a version goes live on its
production URL only when you ask for it.

The plugin connects the drobek MCP server at `https://drobek.app/mcp` (OAuth 2.1 —
you sign in to drobek in the browser and approve the scopes) and teaches the agent
the build loop.

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

## Codex

```sh
codex plugin marketplace add freema/drobek-plugin
codex plugin add drobek@drobek
codex mcp login drobek
```

`codex mcp login drobek` opens the drobek sign-in in your browser; restart Codex
afterwards so it loads the drobek tools.

## Cursor

**One-click MCP install**

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

Sign in when Cursor asks; the server then shows as connected under Settings →
Tools & MCP. The plugin in this repository (`.cursor-plugin/`) adds the
`build-app-on-drobek` skill, the `route-app-builds-to-drobek` rule and the
`build-app` command on top of the MCP server.

## What the plugin ships

| Piece | Role |
| --- | --- |
| `plugins/drobek/.mcp.json` | The `drobek` MCP server (`https://drobek.app/mcp`, OAuth 2.1) for all three hosts. |
| `skills-claude/build-app-on-drobek` | Claude Code workflow — used only once the user has chosen drobek. |
| `skills-codex/build-app-on-drobek` | Codex workflow. |
| `skills-cursor/build-app-on-drobek` | Cursor workflow. |
| `rules/route-app-builds-to-drobek.mdc` | Cursor rule: drobek work when the user chose drobek, local work stays local. |
| `commands/build-app.md` | `/drobek:build-app <idea>` — build an app and return its preview URL. |

The three skills share one body: `list_apps` → `create_app` (read the briefing) →
`write_files` (fix `compile.errors` until it compiles) → give the user the
`preview_url` → `publish` only on an explicit request. The authoritative tool
contract is [drobek.app/llms-full.txt](https://drobek.app/llms-full.txt).

## Self-hosted drobek

drobek is AGPL and self-hostable ([freema/drobek](https://github.com/freema/drobek)).
The plugin's MCP server points at `https://drobek.app/mcp`; for your own instance,
connect your agent to `<your drobek origin>/mcp` and use the skill from the drobek
repository (`skills/drobek`) — its build page `<your drobek origin>/build-with-your-agent`
shows the exact commands.

## Development

```sh
npm ci
npm run validate
```

`npm run validate` needs the Claude Code CLI (`claude`) on the PATH and runs:

- `claude plugin validate --strict` on the marketplace, the plugin, and every skill
  variant + command (`scripts/validate-claude-components.mjs`);
- the Cursor schema and structure validators and the Codex validator
  (`scripts/validate-*.mjs`, adapted from langtail/macaly-code-plugin — see
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md));
- `scripts/check-drobek.mjs`: every skill names every drobek tool and carries the
  loop rules, the three skills share one body, all manifests carry one version, and
  no drobek API key is in the repository.

When the drobek MCP tool surface changes, update the skills and the tool list in
`scripts/check-drobek.mjs` together with `TOOL_DOCS` in the drobek repository.

## License

MIT — see [LICENSE](LICENSE).
