#!/usr/bin/env node

/**
 * Runs `claude plugin validate --strict` over the skill and command FILES.
 *
 * Validating plugins/drobek checks its plugin.json, but the Claude CLI parses
 * skill and command frontmatter only in a directory laid out as `skills/` +
 * `commands/`. The plugin keeps one skill folder per host (skills-claude,
 * skills-codex, skills-cursor), so each variant is staged into a temporary
 * directory with that layout and validated there.
 */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "plugins", "drobek");
const variants = ["skills-claude", "skills-codex", "skills-cursor"];

let failed = 0;
for (const variant of variants) {
  const stage = mkdtempSync(path.join(tmpdir(), `drobek-${variant}-`));
  try {
    cpSync(path.join(pluginDir, variant), path.join(stage, "skills"), { recursive: true });
    cpSync(path.join(pluginDir, "commands"), path.join(stage, "commands"), { recursive: true });
    console.log(`\n== ${variant} + commands`);
    const run = spawnSync("claude", ["plugin", "validate", "--strict", stage], {
      stdio: "inherit",
    });
    if (run.error) {
      console.error(`ERROR: could not run the claude CLI: ${run.error.message}`);
      failed++;
    } else if (run.status !== 0) {
      failed++;
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`\nclaude plugin validate failed for ${failed} component set(s).`);
  process.exit(1);
}
console.log(`\nclaude plugin validate passed for ${variants.length} component sets.`);
