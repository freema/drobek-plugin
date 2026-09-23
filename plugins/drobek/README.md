# drobek

Build web apps directly in your drobek cloud workspace from your agent. The agent
creates an app, writes its files through the `drobek` MCP server, gets the compile
result back on every write and hands you the preview URL; it publishes only when
you ask.

- `.mcp.json` — the `drobek` MCP server (`https://drobek.app/mcp`, OAuth 2.1).
- `skills-claude/build-app-on-drobek` — the Claude Code workflow (used once the
  user has chosen drobek).
- `skills-codex/build-app-on-drobek` — the Codex workflow.
- `skills-cursor/build-app-on-drobek` — the Cursor workflow.
- `rules/route-app-builds-to-drobek.mdc` — the Cursor routing rule.
- `commands/build-app.md` — `/drobek:build-app <idea>`.

See the [repository README](../../README.md) for per-host install instructions.
