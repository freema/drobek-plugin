#!/usr/bin/env node
// drobek-plugin — set up the drobek plugin for Claude Code, Codex or Cursor.
//
//   npx drobek-plugin                 setup steps for every agent (hosted drobek.app)
//   npx drobek-plugin claude|codex|cursor [--url https://drobek.example.com]
//   npx drobek-plugin path            absolute path of the bundled plugin directory
//
// It only prints: it never edits your agent's config and never asks for a key.
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOSTED = 'https://drobek.app';
const REPO = 'freema/drobek-plugin';
const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'drobek');

/** The origin from --url, then DROBEK_URL, then the hosted drobek. Scheme + host only. */
export function resolveOrigin(argv, env) {
  const i = argv.findIndex((a) => a === '--url' || a.startsWith('--url='));
  const raw = i < 0 ? env.DROBEK_URL : argv[i].includes('=') ? argv[i].slice(6) : argv[i + 1];
  if (!raw) return HOSTED;
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`not a URL: ${raw} (expected an origin like https://drobek.example.com)`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`use http(s): ${raw}`);
  return u.origin;
}

/** Cursor's one-click MCP install link for this origin. */
export function cursorLink(origin) {
  const config = Buffer.from(JSON.stringify({ url: `${origin}/mcp` })).toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=drobek&config=${encodeURIComponent(config)}`;
}

function claude(origin) {
  const env = origin === HOSTED ? '' : `\nSelf-hosted: start Claude Code with the origin set (or put it under "env" in ~/.claude/settings.json):\n  export DROBEK_URL=${origin}\n`;
  return `Claude Code
  claude plugin marketplace add ${REPO}
  claude plugin install drobek@drobek
${env}Then run /mcp, pick drobek and sign in. Try: /drobek:build-app a tip calculator
Local copy without the marketplace: claude --plugin-dir "${PLUGIN_DIR}"
`;
}

function codex(origin) {
  const own = origin === HOSTED ? '' : `  codex mcp add drobek --url ${origin}/mcp\n`;
  return `Codex
  codex plugin marketplace add ${REPO}
  codex plugin add drobek@drobek
${own}  codex mcp login drobek
Restart Codex after the login so it loads the drobek tools.
`;
}

function cursor(origin) {
  return `Cursor
  One-click MCP install (${origin}/mcp):
  ${cursorLink(origin)}
  Or in ~/.cursor/mcp.json: { "mcpServers": { "drobek": { "url": "${origin}/mcp" } } }
The skill, rule and command come with the plugin from github.com/${REPO} (.cursor-plugin/).
`;
}

function main(argv, env) {
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') i++;
    else if (!argv[i].startsWith('-')) positional.push(argv[i]);
  }
  const cmd = positional[0] ?? 'all';
  if (cmd === 'help' || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(`drobek-plugin [claude|codex|cursor|path] [--url <origin>]\nDefault origin: $DROBEK_URL or ${HOSTED}. Docs: https://github.com/${REPO}\n`);
    return 0;
  }
  if (cmd === 'path') {
    if (!existsSync(PLUGIN_DIR)) throw new Error(`plugin directory missing: ${PLUGIN_DIR}`);
    process.stdout.write(`${PLUGIN_DIR}\n`);
    return 0;
  }
  const origin = resolveOrigin(argv, env);
  const parts = { claude, codex, cursor };
  if (cmd !== 'all' && !parts[cmd]) throw new Error(`unknown command: ${cmd} (claude, codex, cursor, path)`);
  const pick = cmd === 'all' ? Object.values(parts) : [parts[cmd]];
  process.stdout.write(`drobek at ${origin} — MCP endpoint ${origin}/mcp (you sign in with OAuth in the browser)\n\n${pick.map((f) => f(origin)).join('\n')}`);
  return 0;
}

// npx runs the bin through a symlink in node_modules/.bin — compare real paths.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    process.exitCode = main(process.argv.slice(2), process.env);
  } catch (err) {
    process.stderr.write(`drobek-plugin: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  }
}
