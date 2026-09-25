import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { cursorLink, resolveOrigin } from '../bin/drobek-plugin.mjs';

const BIN = new URL('../bin/drobek-plugin.mjs', import.meta.url).pathname;

test('origin: --url, then DROBEK_URL, then the hosted drobek; path and slash dropped', () => {
  assert.equal(resolveOrigin([], {}), 'https://drobek.app');
  assert.equal(resolveOrigin([], { DROBEK_URL: 'https://d.example.com/' }), 'https://d.example.com');
  assert.equal(resolveOrigin(['--url', 'https://x.example.com/mcp'], { DROBEK_URL: 'https://d.example.com' }), 'https://x.example.com');
  assert.equal(resolveOrigin(['--url=http://localhost:3041'], {}), 'http://localhost:3041');
  assert.throws(() => resolveOrigin(['--url', 'ftp://x'], {}), /http/);
  assert.throws(() => resolveOrigin(['--url', 'nope'], {}), /not a URL/);
});

test('cursor link carries the MCP endpoint', () => {
  const link = cursorLink('https://d.example.com');
  const config = decodeURIComponent(link.split('config=')[1]);
  assert.deepEqual(JSON.parse(Buffer.from(config, 'base64').toString()), { url: 'https://d.example.com/mcp' });
});

test('the bin prints setup for one agent and the plugin path', () => {
  const out = execFileSync(process.execPath, [BIN, 'codex', '--url', 'https://d.example.com'], { encoding: 'utf8' });
  assert.match(out, /codex mcp add drobek --url https:\/\/d\.example\.com\/mcp/);
  assert.doesNotMatch(out, /Claude Code/);
  const path = execFileSync(process.execPath, [BIN, 'path'], { encoding: 'utf8' }).trim();
  assert.match(path, /plugins\/drobek$/);
});
