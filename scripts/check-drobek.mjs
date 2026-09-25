#!/usr/bin/env node

/**
 * drobek-specific checks on top of the host validators:
 *
 * - every skill variant (Claude, Codex, Cursor) names every drobek MCP tool and
 *   carries the rules a cold agent needs (preview_url after a compile, publish
 *   only on an explicit request, single writer, the skill_info rule
 *   (SKILL_INFO_RULE in @drobek/agent-dx, verbatim), no secrets, untrusted
 *   read_file content, the llms-full.txt reference);
 * - the three variants share the same body from "## The loop" on, so they
 *   cannot drift apart;
 * - the /drobek:build-app command takes $ARGUMENTS and uses only drobek tools;
 * - all manifests carry the same version; the server origin is configurable
 *   (DROBEK_URL, default https://drobek.app): Claude Code's .mcp.json expands
 *   ${DROBEK_URL:-https://drobek.app}/mcp, Codex and Cursor (no env expansion
 *   with a default in a plugin's MCP config) use .mcp.hosted.json with the
 *   hosted endpoint, and the skills never assume drobek.app for app hosts;
 * - no file in the repository contains a drobek API key (drk_…).
 *
 * The tool list mirrors TOOL_DOCS in @drobek/agent-dx (freema/drobek) — keep
 * them equal when the drobek MCP tool surface changes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "plugins", "drobek");

const TOOLS = [
  "list_apps",
  "create_app",
  "get_app",
  "read_file",
  "write_files",
  "restore_version",
  "skill_info",
  "configure_module",
  "query_data",
  "get_logs",
  "publish",
];
const DEFAULT_ORIGIN = "https://drobek.app";
const HOSTED_MCP_URL = `${DEFAULT_ORIGIN}/mcp`;
const CLAUDE_MCP_URL = `\${DROBEK_URL:-${DEFAULT_ORIGIN}}/mcp`;
/** Which MCP config each host's manifest points at, and the URL it must carry. */
const MCP_CONFIGS = {
  "plugins/drobek/.claude-plugin/plugin.json": { file: "./.mcp.json", url: CLAUDE_MCP_URL },
  "plugins/drobek/.cursor-plugin/plugin.json": { file: "./.mcp.hosted.json", url: HOSTED_MCP_URL },
  "plugins/drobek/.codex-plugin/plugin.json": { file: "./.mcp.hosted.json", url: HOSTED_MCP_URL },
};
const SKILL_INFO_RULE =
  "Before using a backend (login, stored data, forms, email, file uploads, external APIs), call `skill_info` and follow the skill; `create_app`/`get_app` list the available skills.";
const REQUIRED_PHRASES = [
  "preview_url",
  "compile.errors",
  "Publish only when the user explicitly asks",
  "Never\n   publish on your own initiative",
  "app_locked",
  "3 minutes",
  "secret_in_source",
  "drobek dashboard",
  "untrusted",
  "restore_version({ app_id, version })",
  "write_files({ app_id, files, reasoning })",
  "1–20",
  "≤ 300 characters",
  "react-ts",
  "https://drobek.app/llms-full.txt",
  "`<slug>.<APPS_DOMAIN>`",
  "never assume `drobek.app`",
  SKILL_INFO_RULE,
  "confirm_url",
  "secrets_missing",
  "app_locked_by_admin",
  "get_logs({ app_id, kind:",
  "`start`",
  "`debug`",
  "`ui`",
];

let errors = 0;
function fail(message) {
  console.error(`ERROR: ${message}`);
  errors++;
}

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

// --- skills ---------------------------------------------------------------
const variants = ["skills-claude", "skills-codex", "skills-cursor"];
const bodies = new Map();
for (const variant of variants) {
  const rel = `plugins/drobek/${variant}/build-app-on-drobek/SKILL.md`;
  const md = read(rel);
  if (!/^---\nname: build-app-on-drobek\n/.test(md)) {
    fail(`${rel}: frontmatter must start with name: build-app-on-drobek`);
  }
  for (const tool of TOOLS) {
    if (!md.includes(`\`${tool}\``) && !md.includes(`${tool}(`)) {
      fail(`${rel}: does not mention the ${tool} tool`);
    }
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!md.includes(phrase)) fail(`${rel}: missing required text: ${JSON.stringify(phrase)}`);
  }
  if (!md.includes(HOSTED_MCP_URL)) fail(`${rel}: does not name the default MCP endpoint ${HOSTED_MCP_URL}`);
  const loop = md.indexOf("## The loop");
  if (loop === -1) fail(`${rel}: missing "## The loop"`);
  else bodies.set(variant, md.slice(loop));
}
const [first, ...rest] = variants;
for (const variant of rest) {
  if (bodies.has(first) && bodies.has(variant) && bodies.get(first) !== bodies.get(variant)) {
    fail(`${variant}: the body from "## The loop" on differs from ${first} — keep the variants in sync`);
  }
}
const claudeSkill = read("plugins/drobek/skills-claude/build-app-on-drobek/SKILL.md");
if (!claudeSkill.includes("only after the user has chosen drobek")) {
  fail("skills-claude: the Claude variant must only act after the user has chosen drobek");
}
if (!claudeSkill.includes("`DROBEK_URL`")) fail("skills-claude: must name the DROBEK_URL setting");
const codexSkill = read("plugins/drobek/skills-codex/build-app-on-drobek/SKILL.md");
if (!codexSkill.includes("codex mcp add drobek --url")) {
  fail("skills-codex: must say how to connect a self-hosted drobek (codex mcp add drobek --url)");
}
const cursorSkill = read("plugins/drobek/skills-cursor/build-app-on-drobek/SKILL.md");
if (!cursorSkill.includes("~/.cursor/mcp.json")) {
  fail("skills-cursor: must say how to connect a self-hosted drobek (~/.cursor/mcp.json)");
}

// --- command + rule -------------------------------------------------------
const command = read("plugins/drobek/commands/build-app.md");
if (!command.includes("$ARGUMENTS")) fail("commands/build-app.md: must use $ARGUMENTS");
for (const tool of ["list_apps", "create_app", "write_files", "publish"]) {
  if (!command.includes(tool)) fail(`commands/build-app.md: does not mention ${tool}`);
}
if (!command.includes("preview_url")) fail("commands/build-app.md: must return the preview_url");
if (!/Do \*\*not\*\* call `publish` unless the user explicitly asks/.test(command)) {
  fail("commands/build-app.md: must forbid publishing without an explicit request");
}
const rule = read("plugins/drobek/rules/route-app-builds-to-drobek.mdc");
if (!rule.includes("keep the work local")) fail("rules/route-app-builds-to-drobek.mdc: must keep local work local");

// --- manifests: one version, one endpoint --------------------------------
const manifests = [
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
  "plugins/drobek/.claude-plugin/plugin.json",
  "plugins/drobek/.cursor-plugin/plugin.json",
  "plugins/drobek/.codex-plugin/plugin.json",
  "package.json",
];
const versions = new Map();
for (const rel of manifests) {
  const json = JSON.parse(read(rel));
  const version = json.version ?? json.metadata?.version;
  versions.set(rel, version);
}
const distinct = new Set(versions.values());
if (distinct.size !== 1) {
  fail(`manifest versions differ: ${JSON.stringify(Object.fromEntries(versions))}`);
}
for (const [rel, expected] of Object.entries(MCP_CONFIGS)) {
  const manifest = JSON.parse(read(rel));
  if (manifest.mcpServers !== expected.file) {
    fail(`${rel}: mcpServers must be ${expected.file} (got ${JSON.stringify(manifest.mcpServers)})`);
    continue;
  }
  const mcpRel = path.posix.join("plugins/drobek", expected.file);
  const server = JSON.parse(read(mcpRel)).mcpServers?.drobek;
  if (server?.url !== expected.url) fail(`${mcpRel}: mcpServers.drobek.url must be ${expected.url}`);
  if (server?.headers) fail(`${mcpRel}: must not carry headers (OAuth only; no credentials in the plugin)`);
}

// --- the server URL setting is documented --------------------------------
for (const rel of ["README.md", "plugins/drobek/README.md"]) {
  const readme = read(rel).replace(/\s+/g, " ");
  for (const phrase of ["DROBEK_URL", DEFAULT_ORIGIN, "no trailing slash", "no `/mcp`", "drobek.example.com", "happens against that same origin"]) {
    if (!readme.includes(phrase)) fail(`${rel}: the DROBEK_URL section is missing ${JSON.stringify(phrase)}`);
  }
}

// --- no API keys anywhere -------------------------------------------------
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  if (/drk_[A-Za-z0-9_-]{16,}/.test(text)) fail(`${path.relative(root, file)}: contains something that looks like a drobek API key`);
}

if (errors > 0) {
  console.error(`\ndrobek checks failed with ${errors} error(s).`);
  process.exit(1);
}
console.log(`drobek checks passed (${variants.length} skills, ${manifests.length} manifests, version ${[...distinct][0]}).`);
