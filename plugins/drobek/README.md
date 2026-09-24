# drobek

Build web apps directly in your drobek cloud workspace from your agent. The agent
creates an app, writes its files through the `drobek` MCP server, gets the compile
result back on every write and hands you the preview URL; it publishes only when
you ask. drobek is self-hostable: the plugin works against the hosted
`https://drobek.app` by default or against your own drobek server.

- `.mcp.json` — Claude Code: the `drobek` MCP server at
  `${DROBEK_URL:-https://drobek.app}/mcp` (OAuth 2.1).
- `.mcp.hosted.json` — Codex and Cursor: the `drobek` MCP server at
  `https://drobek.app/mcp` (OAuth 2.1).
- `skills-claude/build-app-on-drobek` — the Claude Code workflow (used once the
  user has chosen drobek).
- `skills-codex/build-app-on-drobek` — the Codex workflow.
- `skills-cursor/build-app-on-drobek` — the Cursor workflow.
- `rules/route-app-builds-to-drobek.mdc` — the Cursor routing rule.
- `commands/build-app.md` — `/drobek:build-app <idea>`.

## Server URL

`DROBEK_URL` is the origin of your drobek server — scheme + host (+ port), no
trailing slash, no `/mcp`. Default: `https://drobek.app`. In Claude Code, set it
before starting `claude` (or under `env` in `~/.claude/settings.json`):

```sh
export DROBEK_URL=https://drobek.example.com   # MCP: https://drobek.example.com/mcp
```

The OAuth sign-in happens against that same origin — you sign in with your
account on that drobek server. Codex and Cursor do not expand the variable in a
plugin's MCP config; for a self-hosted drobek add a `drobek` server with
`<origin>/mcp` yourself (`codex mcp add drobek --url <origin>/mcp`, or
`~/.cursor/mcp.json`).

See the [repository README](../../README.md#server-url-drobek_url) for per-host
install instructions and details.
