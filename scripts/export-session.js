#!/usr/bin/env node
/*
 * Export a Claude Code session to a readable, redacted text file.
 *
 *   node scripts/export-session.js [--out <file>] [--session <file.jsonl>]
 *
 * Defaults: the newest session transcript for this project, written to
 * .claude/session-logs/<date>_<time>-session.txt (git-ignored via ".claude/").
 *
 * Keeps what you and the assistant said and one line per tool call. Tool output,
 * internal reminders and image data are left out. Anything that looks like a
 * secret (access token, sync URL id, sheet id) is replaced with [REDACTED].
 * No dependencies.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const MAX_BLOCK = 8000; // characters kept per message block

// Ordered: each rule keeps the surrounding text and hides only the secret value.
const REDACTIONS = [
  [/(token=)[A-Za-z0-9._~%-]+/g, '$1[REDACTED]'],
  [/(macros\/s\/)[A-Za-z0-9_-]{20,}/g, '$1[REDACTED]'],
  [/(spreadsheets\/d\/)[A-Za-z0-9_-]{20,}/g, '$1[REDACTED]'],
  [/AKfycb[A-Za-z0-9_-]{20,}/g, '[REDACTED-DEPLOYMENT-ID]'],
  [/budget-planner-private-[A-Za-z0-9_-]+/g, '[REDACTED-TOKEN]'],
  [/((?:ACCESS_TOKEN|SPREADSHEET_ID)\s*=\s*['"])(?!PASTE_)[^'"\n]+(['"])/g, '$1[REDACTED]$2'],
  [/((?:ACCESS_TOKEN|SPREADSHEET_ID)\s*=\s*\n\s*['"])(?!PASTE_)[^'"\n]+(['"])/g, '$1[REDACTED]$2'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/g, '[REDACTED-GITHUB-TOKEN]'],
];
const redact = (text) => REDACTIONS.reduce((t, [re, rep]) => t.replace(re, rep), text);

function tidy(text) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<ide_selection>[\s\S]*?<\/ide_selection>/g, '[IDE selection omitted]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const clip = (text) => text.length > MAX_BLOCK ? `${text.slice(0, MAX_BLOCK)}\n[... ${text.length - MAX_BLOCK} characters omitted ...]` : text;

function findSession() {
  const dir = path.join(os.homedir(), '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'));
  if (!fs.existsSync(dir)) throw new Error(`No transcript folder at ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error(`No .jsonl transcripts in ${dir}`);
  return files[0].f;
}

const stamp = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('sv-SE').slice(0, 16); };
const toolLine = (b) => {
  const i = b.input || {};
  const what = i.description || i.file_path || i.path || i.pattern || i.query || i.url || (i.command ? String(i.command).split('\n')[0] : '') || (i.action || '');
  return `  [tool] ${b.name}${what ? `: ${String(what).slice(0, 140)}` : ''}`;
};

const sessionFile = opt('--session') || findSession();
const turns = [];
let first = '', last = '';
for (const line of fs.readFileSync(sessionFile, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  if ((o.type !== 'user' && o.type !== 'assistant') || o.isSidechain || !o.message) continue;
  const c = o.message.content;
  const parts = [];
  for (const b of typeof c === 'string' ? [{ type: 'text', text: c }] : (Array.isArray(c) ? c : [])) {
    if (b.type === 'text') { const t = tidy(b.text || ''); if (t) parts.push(clip(t)); }
    else if (b.type === 'image') parts.push('[image attached]');
    else if (b.type === 'tool_use' && o.type === 'assistant') parts.push(toolLine(b));
    // tool_result and thinking blocks are intentionally skipped
  }
  if (!parts.length) continue;
  const when = stamp(o.timestamp);
  first = first || when; last = when || last;
  turns.push(`===== ${o.type === 'user' ? 'USER' : 'ASSISTANT'}${when ? `  ${when}` : ''} =====\n${parts.join('\n')}`);
}

const header = [
  'CLAUDE CODE SESSION EXPORT (redacted)',
  `Project: ${path.basename(process.cwd())}`,
  `Source: ${path.basename(sessionFile)}`,
  `Period: ${first} to ${last}`,
  `Turns: ${turns.length}`,
  'Tool output and internal reminders are omitted; secrets are replaced with [REDACTED].',
  '='.repeat(72), '',
].join('\n');

const now = new Date().toLocaleString('sv-SE').replace(' ', '_').replace(/:/g, '').slice(0, 15);
const out = opt('--out') || path.join('.claude', 'session-logs', `${now}-session.txt`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, redact(`${header}\n${turns.join('\n\n')}\n`));
console.log(`${out}  (${turns.length} turns)`);
