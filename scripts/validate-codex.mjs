#!/usr/bin/env node

/**
 * Codex plugin validator — ported from codex-rs/core/src/plugins/marketplace.rs
 * and codex-rs/core/src/plugins/manifest.rs.
 *
 * Adapted from langtail/macaly-code-plugin (MIT License, Copyright (c) 2026
 * Macaly) — see THIRD_PARTY_NOTICES.md. Changes: runs with plain Node;
 * interface.displayName is required; the interface URLs are validated when
 * present (websiteURL is required) instead of requiring every
 * directory-listing URL.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, dirname, basename, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

let errors = 0;
let warnings = 0;

function fail(message) {
  console.error(`ERROR: ${message}`);
  errors++;
}

function warn(message) {
  console.warn(`WARN: ${message}`);
  warnings++;
}

function loadJSON(path, context) {
  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    fail(`${context}: file not found at ${relative(root, path)}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`${context}: invalid JSON — ${err.message}`);
    return null;
  }
}

// --- Path validation (mirrors resolve_manifest_path / resolve_plugin_source_path) ---

function isValidRelativePath(path) {
  if (typeof path !== "string" || path.length === 0) return false;
  const stripped = path.startsWith("./") ? path.slice(2) : null;
  if (stripped === null) return false;
  if (stripped.length === 0) return false;
  // Must not contain .. or other non-normal components
  const segments = stripped.replace(/\/+$/, "").split("/");
  return segments.every((s) => s.length > 0 && s !== ".." && s !== ".");
}

// --- Marketplace validation (mirrors marketplace.rs) ---

function validateMarketplace() {
  const marketplacePath = resolve(
    root,
    ".agents",
    "plugins",
    "marketplace.json"
  );
  const marketplace = loadJSON(marketplacePath, "Marketplace");
  if (!marketplace) return;

  if (typeof marketplace.name !== "string" || marketplace.name.length === 0) {
    fail("Marketplace: missing or empty `name`");
  }

  if (!Array.isArray(marketplace.plugins)) {
    fail("Marketplace: `plugins` must be an array");
    return;
  }

  for (const [index, plugin] of marketplace.plugins.entries()) {
    const label = `Marketplace plugins[${index}]`;

    if (typeof plugin.name !== "string" || plugin.name.length === 0) {
      fail(`${label}: missing or empty \`name\``);
      continue;
    }

    const pluginLabel = `Marketplace plugin "${plugin.name}"`;

    // Validate source
    if (!plugin.source || typeof plugin.source !== "object") {
      fail(`${pluginLabel}: \`source\` must be an object`);
      continue;
    }

    if (plugin.source.source !== "local") {
      fail(
        `${pluginLabel}: \`source.source\` must be "local", got "${plugin.source.source}"`
      );
      continue;
    }

    const sourcePath = plugin.source.path;
    if (!isValidRelativePath(sourcePath)) {
      fail(
        `${pluginLabel}: \`source.path\` must be a relative path starting with "./" — got "${sourcePath}"`
      );
      continue;
    }

    // Resolve relative to marketplace root (2 levels up from .agents/plugins/marketplace.json)
    const pluginDir = resolve(root, sourcePath.slice(2));

    if (!existsSync(pluginDir) || !statSync(pluginDir).isDirectory()) {
      fail(`${pluginLabel}: source directory does not exist — ${sourcePath}`);
      continue;
    }

    // Validate policy
    const validInstallPolicies = [
      "NOT_AVAILABLE",
      "AVAILABLE",
      "INSTALLED_BY_DEFAULT",
    ];
    const validAuthPolicies = ["ON_INSTALL", "ON_USE"];

    if (plugin.policy) {
      if (
        plugin.policy.installation &&
        !validInstallPolicies.includes(plugin.policy.installation)
      ) {
        fail(
          `${pluginLabel}: invalid policy.installation "${plugin.policy.installation}"`
        );
      }
      if (
        plugin.policy.authentication &&
        !validAuthPolicies.includes(plugin.policy.authentication)
      ) {
        fail(
          `${pluginLabel}: invalid policy.authentication "${plugin.policy.authentication}"`
        );
      }
    }

    // Validate plugin manifest
    validatePluginManifest(pluginDir, plugin.name);
  }
}

// --- Plugin manifest validation (mirrors manifest.rs) ---

const MAX_SKILL_NAME_LENGTH = 64;
const MAX_FINAL_SHORT_DESCRIPTION_LENGTH = 30;
const MAX_FINAL_URL_LENGTH = 1024;
const MAX_DEFAULT_PROMPT_COUNT = 3;
const MAX_DEFAULT_PROMPT_LENGTH = 128;
const INTERFACE_URLS = [
  "websiteURL",
  "supportURL",
  "privacyPolicyURL",
  "termsOfServiceURL",
];
const REQUIRED_MCP_INTERFACE_URLS = new Set(["websiteURL"]);
const FINAL_DIRECTORY_CATEGORIES = new Set([
  "Productivity",
  "Creativity",
  "Developer Tools",
  "Business & Operations",
  "Data & Analytics",
  "Communication",
  "Education & Research",
  "Security",
  "Finance",
  "Healthcare",
  "Travel",
  "Entertainment",
  "Other",
]);

function validatePluginManifest(pluginDir, marketplaceName) {
  const manifestPath = resolve(pluginDir, ".codex-plugin", "plugin.json");
  const label = `Plugin "${marketplaceName}"`;
  const manifest = loadJSON(manifestPath, `${label} manifest`);
  if (!manifest) return;

  // Name validation
  if (typeof manifest.name === "string" && manifest.name.length > 0) {
    if (manifest.name !== marketplaceName) {
      fail(
        `${label}: marketplace name does not match plugin.json name "${manifest.name}"`
      );
    }
  }

  // Validate manifest paths (skills, mcpServers, apps)
  for (const field of ["skills", "mcpServers", "apps"]) {
    const value = manifest[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") {
      fail(`${label}: \`${field}\` must be a string path`);
      continue;
    }
    if (!isValidRelativePath(value)) {
      fail(
        `${label}: \`${field}\` must be a relative path starting with "./" — got "${value}"`
      );
      continue;
    }
    const resolved = resolve(pluginDir, value.slice(2));
    if (!existsSync(resolved)) {
      fail(`${label}: \`${field}\` references missing path "${value}"`);
    }
  }

  // Validate interface
  if (manifest.interface) {
    validatePluginInterface(
      pluginDir,
      label,
      manifest.interface,
      Boolean(manifest.mcpServers)
    );
  }

  // Validate skills
  validateSkills(pluginDir, label, manifest.skills);
}

function validatePluginInterface(pluginDir, label, iface, hasMcpServers) {
  if (
    typeof iface.shortDescription !== "string" ||
    iface.shortDescription.trim().length === 0
  ) {
    fail(`${label}: interface.shortDescription must be a non-empty string`);
  } else if (iface.shortDescription.length > MAX_FINAL_SHORT_DESCRIPTION_LENGTH) {
    fail(
      `${label}: interface.shortDescription exceeds the ${MAX_FINAL_SHORT_DESCRIPTION_LENGTH}-character final directory limit`
    );
  }

  if (!FINAL_DIRECTORY_CATEGORIES.has(iface.category)) {
    fail(
      `${label}: interface.category must be a supported final directory category`
    );
  }

  if (
    typeof iface.displayName !== "string" ||
    iface.displayName.trim().length === 0
  ) {
    fail(`${label}: interface.displayName must be a non-empty string`);
  }

  if (hasMcpServers) {
    for (const field of INTERFACE_URLS) {
      const value = iface[field];
      if (value === undefined && !REQUIRED_MCP_INTERFACE_URLS.has(field)) {
        continue;
      }
      if (typeof value !== "string" || value.length === 0) {
        fail(`${label}: interface.${field} is required for plugins with MCP servers`);
        continue;
      }
      if (value.length > MAX_FINAL_URL_LENGTH) {
        fail(
          `${label}: interface.${field} exceeds the ${MAX_FINAL_URL_LENGTH}-character final directory limit`
        );
        continue;
      }
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || !url.hostname) {
          fail(`${label}: interface.${field} must be a public HTTPS URL`);
        }
      } catch {
        fail(`${label}: interface.${field} must be a valid HTTPS URL`);
      }
    }
  }

  // Validate asset paths
  for (const field of ["composerIcon", "logo"]) {
    const value = iface[field];
    if (!value) continue;
    if (!isValidRelativePath(value)) {
      fail(
        `${label}: interface.${field} must be a relative path starting with "./" — got "${value}"`
      );
      continue;
    }
    const resolved = resolve(pluginDir, value.slice(2));
    if (!existsSync(resolved)) {
      fail(`${label}: interface.${field} references missing path "${value}"`);
    }
  }

  // Validate screenshots
  if (Array.isArray(iface.screenshots)) {
    for (const [i, screenshot] of iface.screenshots.entries()) {
      if (!isValidRelativePath(screenshot)) {
        fail(
          `${label}: interface.screenshots[${i}] must be a relative path starting with "./"`
        );
        continue;
      }
      const resolved = resolve(pluginDir, screenshot.slice(2));
      if (!existsSync(resolved)) {
        fail(
          `${label}: interface.screenshots[${i}] references missing path "${screenshot}"`
        );
      }
    }
  }

  // Validate defaultPrompt
  if (iface.defaultPrompt !== undefined) {
    const prompts = Array.isArray(iface.defaultPrompt)
      ? iface.defaultPrompt
      : typeof iface.defaultPrompt === "string"
        ? [iface.defaultPrompt]
        : null;

    if (prompts === null) {
      fail(
        `${label}: interface.defaultPrompt must be a string or array of strings`
      );
    } else {
      if (prompts.length > MAX_DEFAULT_PROMPT_COUNT) {
        warn(
          `${label}: interface.defaultPrompt has ${prompts.length} entries, maximum is ${MAX_DEFAULT_PROMPT_COUNT}`
        );
      }
      for (const [i, prompt] of prompts.entries()) {
        if (typeof prompt !== "string") {
          fail(
            `${label}: interface.defaultPrompt[${i}] must be a string`
          );
          continue;
        }
        const normalized = prompt.split(/\s+/).join(" ").trim();
        if (normalized.length > MAX_DEFAULT_PROMPT_LENGTH) {
          warn(
            `${label}: interface.defaultPrompt[${i}] exceeds ${MAX_DEFAULT_PROMPT_LENGTH} characters`
          );
        }
      }
    }
  }
}

// --- Skill validation (mirrors quick_validate.py) ---

function validateSkills(pluginDir, label, skillsPath) {
  const skillsDir = skillsPath
    ? resolve(pluginDir, skillsPath.replace(/^\.\//, ""))
    : resolve(pluginDir, "skills");

  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) return;

  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = resolve(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      warn(`${label}: skill "${entry.name}" is missing SKILL.md`);
      continue;
    }

    const content = readFileSync(skillMdPath, "utf-8").replace(/\r\n/g, "\n");
    if (!content.startsWith("---\n")) {
      fail(
        `${label}: skill "${entry.name}" SKILL.md missing YAML frontmatter`
      );
      continue;
    }

    const closingIndex = content.indexOf("\n---\n", 4);
    if (closingIndex === -1) {
      fail(
        `${label}: skill "${entry.name}" SKILL.md has unclosed frontmatter`
      );
      continue;
    }

    const frontmatter = parseFrontmatter(content.slice(4, closingIndex));
    const skillLabel = `${label} skill "${entry.name}"`;

    if (!frontmatter.name) {
      fail(`${skillLabel}: missing "name" in frontmatter`);
    } else {
      const name = frontmatter.name.trim();
      if (!/^[a-z0-9-]+$/.test(name)) {
        fail(
          `${skillLabel}: name "${name}" must be hyphen-case (lowercase letters, digits, hyphens)`
        );
      } else if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
        fail(
          `${skillLabel}: name "${name}" cannot start/end with hyphen or contain consecutive hyphens`
        );
      }
      if (name.length > MAX_SKILL_NAME_LENGTH) {
        fail(
          `${skillLabel}: name exceeds ${MAX_SKILL_NAME_LENGTH} characters`
        );
      }
    }

    if (!frontmatter.description) {
      fail(`${skillLabel}: missing "description" in frontmatter`);
    } else {
      const desc = frontmatter.description.trim();
      if (/<|>/.test(desc)) {
        fail(`${skillLabel}: description cannot contain angle brackets`);
      }
      if (desc.length > 1024) {
        fail(`${skillLabel}: description exceeds 1024 characters`);
      }
    }
  }
}

function parseFrontmatter(block) {
  const fields = {};
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return fields;
}

// --- Main ---

validateMarketplace();

if (errors > 0) {
  console.error(`\nCodex validation failed with ${errors} error(s).`);
  process.exit(1);
} else {
  if (warnings > 0) {
    console.log(`Codex validation passed with ${warnings} warning(s).`);
  } else {
    console.log("Codex validation passed.");
  }
}
