# drobek

Your agent builds web apps in your drobek cloud workspace through the `drobek`
MCP server. It creates the app, writes its files and checks the compile result
after each write, then gives you a preview URL. It publishes only when you ask.
The plugin connects to `https://drobek.app` by default. You can also connect it
to your own drobek server.

- `.mcp.json`: Claude Code's `drobek` MCP server at
  `${DROBEK_URL:-https://drobek.app}/mcp` (OAuth 2.1).
- `.mcp.hosted.json`: Codex and Cursor's `drobek` MCP server at
  `https://drobek.app/mcp` (OAuth 2.1).
- `skills-claude/build-app-on-drobek`: the Claude Code workflow (used once the
  user has chosen drobek).
- `skills-codex/build-app-on-drobek`: the Codex workflow.
- `skills-cursor/build-app-on-drobek`: the Cursor workflow.
- `skills-{claude,codex,cursor}/port-artifact-to-drobek`: move a Claude
  artifact to drobek (text files unchanged, every binary through a single-use
  upload URL at the same path).
- `rules/route-app-builds-to-drobek.mdc`: the Cursor routing rule.
- `commands/build-app.md`: `/drobek:build-app <idea>`.
- `commands/port-artifact.md`: `/drobek:port-artifact <path>`.

## Server URL

`DROBEK_URL` is the origin of your drobek server: scheme, host and optional port,
with no trailing slash and no `/mcp`. It defaults to `https://drobek.app`.
In Claude Code, set it before starting `claude` (or under `env` in `~/.claude/settings.json`):

```sh
export DROBEK_URL=https://drobek.example.com   # MCP: https://drobek.example.com/mcp
```

The OAuth sign-in happens against that same origin. You sign in with your
account on that drobek server. Codex and Cursor do not expand the variable in a
plugin's MCP config; for a self-hosted drobek add a `drobek` server with
`<origin>/mcp` yourself (`codex mcp add drobek --url <origin>/mcp`, or
`~/.cursor/mcp.json`).

See the [repository README](../../README.md#server-url-drobek_url) for per-host
installation instructions.
