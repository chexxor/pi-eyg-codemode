#!/usr/bin/env node
// world_model.mjs - the one reader of docs/world/, shared by the three CLIs, the Pi
// extension and the test suite.
//
// Why one parser instead of three: the map, the lint and the verify step all have to
// agree on what a claim is. Two parsers that drift produce the worst failure this
// system has - a claim lint accepts and verify never runs, so it reads as current
// forever. (ADR-000, Consequences.)
//
// A record is a YAML front-matter block delimited by lines that are exactly `---`,
// followed by prose. `invariants.md` carries one record per claim in a single file;
// entity, decision and runbook pages carry exactly one. `traps.md` is append-only
// prose, so a trap carries its verify command inline.
//
// Node standard library only. No dependency, no network. Deviation from the artifact's
// "python3 + pyyaml" is recorded in docs/world/decisions/ADR-000-world-model.md: the
// Pi package and the repo CLI must run the same parser, and this project's runtime is
// Node (ADR-0004).
//
// Cost @measured 2026-11-14: lint over the tracked model 0.10-0.14 s wall; `--all`
// verify 2.2-2.6 s wall, dominated by the commands the claims name, not by parsing.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TYPES = new Set(["entity", "invariant", "runbook", "trap", "adr"]);
const STATUSES = new Set(["draft", "current", "suspect", "superseded"]);
// A decision record carries the state of a decision, not of a claim about code.
// The artifact's own §4 lists these; §2 lists the four above. Both are honoured,
// and the deviation is recorded in ADR-000.
const ADR_STATUSES = new Set([...STATUSES, "proposed", "accepted", "rejected"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);
const REQUIRED = ["id", "type", "owner", "status", "verified_at", "verify", "confidence", "sources"];
const OPTIONAL = ["supersedes", "superseded_by"];
const BODY_LIMIT = { entity: 120, invariant: 120, runbook: 120, trap: 120, adr: 200 };
const MAP_LIMIT = 150;
const VERIFY_TIMEOUT_MS = 20_000;
const MARKER_OPEN = "<!-- BEGIN GENERATED: do not edit -->";
const MARKER_CLOSE = "<!-- END GENERATED -->";
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /-----BEGIN/,
  /\bpassword\s*=\s*[^"'\s]+/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

export const MARKERS = { open: MARKER_OPEN, close: MARKER_CLOSE, mapLimit: MAP_LIMIT };

function worldDir(root) {
  return path.join(root, "docs", "world");
}

function rel(root, file) {
  return path.relative(root, file);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name !== ".gitkeep") out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- YAML subset ----

// The front-matter grammar we accept: scalars, inline lists, block lists, nested
// maps. Enough for the schema and the roster, and nothing else, so a record that
// needs YAML beyond this is a lint failure rather than a silent misread.
function unescape(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = text[i + 1];
    if (next === "n") out += "\n";
    else if (next === "t") out += "\t";
    else if (next === "r") out += "\r";
    else if (next === "\"" || next === "'" || next === "\\") out += next;
    else out += char + (next ?? ""); // an escape we do not know stays as written
    i += 1;
  }
  return out;
}

function scalar(raw) {
  const value = String(raw).trim();
  if (value === "" || value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith('"') && value.endsWith('"')) {
    // A double-quoted YAML scalar honours backslash escapes; a single-quoted one does not.
    // Without this, a verify command containing quotes reaches the shell still escaped.
    return unescape(value.slice(1, -1));
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitList(inner).map(scalar);
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function splitList(inner) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = "";
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "[" || ch === "]") {
      depth += ch === "[" ? 1 : -1;
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

export function parseYaml(text) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "))
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  const indentOf = (line) => line.length - line.trimStart().length;

  function parseBlock(index, indent) {
    if (index >= lines.length) return [null, index];
    const first = lines[index].trim();
    if (first.startsWith("- ")) return parseList(index, indent);
    return parseMap(index, indent);
  }

  function parseMap(index, indent) {
    const result = {};
    while (index < lines.length) {
      const line = lines[index];
      const lineIndent = indentOf(line);
      if (lineIndent < indent) break;
      if (lineIndent > indent) {
        return [result, index]; // deeper than this map: malformed, caller reports it
      }
      const content = line.trim();
      const colon = content.indexOf(":");
      if (colon === -1) return [result, index];
      const key = content.slice(0, colon).trim();
      const rest = content.slice(colon + 1).trim();
      if (rest !== "") {
        result[key] = scalar(rest);
        index += 1;
        continue;
      }
      // Nested block: a list or a map, or nothing.
      if (index + 1 < lines.length && indentOf(lines[index + 1]) > indent) {
        const [value, next] = parseBlock(index + 1, indentOf(lines[index + 1]));
        result[key] = value;
        index = next;
      } else {
        result[key] = null;
        index += 1;
      }
    }
    return [result, index];
  }

  function parseList(index, indent) {
    const result = [];
    while (index < lines.length) {
      const line = lines[index];
      const lineIndent = indentOf(line);
      if (lineIndent < indent) break;
      if (lineIndent > indent) return [result, index];
      const content = line.trim();
      if (!content.startsWith("- ")) return [result, index];
      const rest = content.slice(2).trim();
      if (rest === "") {
        if (index + 1 < lines.length && indentOf(lines[index + 1]) > indent) {
          const [value, next] = parseBlock(index + 1, indentOf(lines[index + 1]));
          result.push(value);
          index = next;
        } else {
          result.push(null);
          index += 1;
        }
        continue;
      }
      if (/^[A-Za-z0-9_.-]+:\s/.test(rest) || /^[A-Za-z0-9_.-]+:$/.test(rest)) {
        // A mapping inside a list item, e.g. "operator: [invariants, 00-map]".
        const inner = parseMap(index, indent + 2);
        // parseMap consumes the single line; keep it in list form.
        result.push(inner[0]);
        index = Math.max(index + 1, inner[1]);
        continue;
      }
      result.push(scalar(rest));
      index += 1;
    }
    return [result, index];
  }

  return parseBlock(0, 0)[0];
}

// ------------------------------------------------------------- record parsing ----

export function recordsFromFile(root, file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== "---") {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "---") j += 1;
    if (j >= lines.length) {
      out.push({ file: rel(root, file), line: i + 1, end: i + 1, bodyLine: i + 1, body: "", data: null, error: "front-matter opens with `---` and never closes" });
      break;
    }
    let data = null;
    let error = null;
    try {
      const parsed = parseYaml(lines.slice(i + 1, j).join("\n"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
      else error = "front-matter is not a mapping of fields";
    } catch (problem) {
      error = `front-matter does not parse: ${problem.message}`;
    }
    let k = j + 1;
    while (k < lines.length && lines[k].trim() !== "---") k += 1;
    out.push({
      file: rel(root, file),
      line: i + 1,
      end: j + 1,
      bodyLine: j + 2,
      body: lines.slice(j + 1, k).join("\n"),
      data,
      error,
    });
    i = k;
  }
  return out;
}

const TRAP_RE = /^- (\d{4}-\d{2}-\d{2})(.*)$/;
const INLINE_VERIFY_RE = /verify:\s*`([^`]+)`/;

export function trapRecords(root, file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const out = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const match = TRAP_RE.exec(lines[i]);
    if (!match) {
      i += 1;
      continue;
    }
    let j = i + 1;
    // An entry is the run of lines from its dash to the next dash, heading or blank line.
    // Counting a file's trailing blank line as part of the last entry made a three-line trap
    // read as four, and a clean model fail its own lint (P151).
    while (j < lines.length && lines[j].trim() && !TRAP_RE.test(lines[j]) && !lines[j].startsWith("#")) j += 1;
    const entry = lines.slice(i, j).join("\n");
    const found = INLINE_VERIFY_RE.exec(entry);
    out.push({
      file: rel(root, file),
      line: i + 1,
      end: j,
      bodyLine: i + 1,
      body: entry,
      trapLines: j - i,
      error: null,
      data: {
        id: `trap-${String(++n).padStart(2, "0")}`,
        type: "trap",
        owner: "any",
        status: "current",
        verified_at: match[1],
        verify: found ? found[1] : null,
        confidence: "medium",
        sources: [],
      },
    });
    i = j;
  }
  return out;
}

export function allRecords(root) {
  const out = [];
  for (const file of walk(worldDir(root))) {
    const name = path.basename(file);
    if (name === "roster.yaml") continue;
    if (!file.endsWith(".md")) continue;
    if (name === "traps.md") out.push(...trapRecords(root, file));
    else out.push(...recordsFromFile(root, file));
  }
  return out;
}

export function readRoster(root) {
  const file = path.join(worldDir(root), "roster.yaml");
  if (!fs.existsSync(file)) return { owners: new Set(), owned: {}, error: "docs/world/roster.yaml does not exist" };
  let data;
  try {
    data = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (problem) {
    return { owners: new Set(), owned: {}, error: `roster.yaml does not parse: ${problem.message}` };
  }
  if (!data || typeof data !== "object") return { owners: new Set(), owned: {}, error: "roster.yaml is not a mapping" };
  const owners = new Set();
  const owned = {};
  for (const section of ["human", "humans", "agents", "roles"]) {
    const value = data[section];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [name, ids] of Object.entries(value)) {
        owners.add(name);
        owned[name] = Array.isArray(ids) ? ids.map(String) : [String(ids)];
      }
    } else if (Array.isArray(value) || typeof value === "string") {
      owners.add(section);
    }
  }
  const librarian = data.librarian;
  if (typeof librarian === "string" && librarian !== "rotating" && librarian !== "") owners.add(librarian);
  return { owners, owned, error: null };
}

function codeBlocks(body) {
  const blocks = [];
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith("```")) {
      const start = i;
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) i += 1;
      blocks.push({ line: start + 1, length: i - start - 1 });
    }
    i += 1;
  }
  return blocks;
}

function isTriviallyTrue(command) {
  const cmd = String(command ?? "").trim();
  if (!cmd) return true;
  if (/^(true|:|exit 0)$/.test(cmd)) return true;
  if (/^echo/.test(cmd) && !/;|&&|\|\|/.test(cmd)) return true;
  return false;
}

// -------------------------------------------------------------------- lint ----

export function lint(root) {
  const problems = [];
  const add = (file, line, rule, message) => problems.push({ file, line, rule, message });

  if (!fs.existsSync(worldDir(root))) {
    return [{ file: "docs/world", line: 0, rule: "world-model", message: "docs/world/ does not exist; run `node pi-simple-world-model/bin/world_map.mjs --init` to create it" }];
  }

  const roster = readRoster(root);
  if (roster.error) add("docs/world/roster.yaml", 1, "roster", roster.error);

  const tracked = new Set(spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout.split("\n"));
  const idsSeen = new Map();

  for (const file of walk(worldDir(root))) {
    const name = path.basename(file);
    const relative = rel(root, file);
    if (name === "roster.yaml") continue;
    if (!file.endsWith(".md")) continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n");

    lines.forEach((line, index) => {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(line)) add(relative, index + 1, "secret", `line matches a credential pattern: ${line.trim().slice(0, 60)}`);
      }
      if (/\bTODO\b/.test(line)) add(relative, index + 1, "todo", "task state does not belong in the world model (rule: no TODOs)");
    });

    if (name === "00-map.md") {
      if (lines.length > MAP_LIMIT) add(relative, 1, "map-too-long", `00-map.md is ${lines.length} lines; tier-0 is capped at ${MAP_LIMIT}`);
      if (!text.includes(MARKER_OPEN) || !text.includes(MARKER_CLOSE)) add(relative, 1, "map-markers", "the generated region is missing its BEGIN/END markers");
      continue;
    }

    if (name === "traps.md") {
      for (const trap of trapRecords(root, file)) {
        if (!trap.data.verify) add(trap.file, trap.line, "trap-no-verify", "a trap without a verify command cannot be re-checked: add `verify: `...``");
        if (trap.trapLines > 3) add(trap.file, trap.line, "trap-too-long", `trap entry is ${trap.trapLines} lines; the cap is 3`);
      }
      continue;
    }

    const records = recordsFromFile(root, file);
    // The folder inside docs/world decides the type a page must carry. "entities",
    // not "docs/world/entities".
    const section = relative.replace(/^docs\/world\//, "").split("/")[0];
    if (records.length === 0) {
      add(relative, 1, "front-matter", "no record: a page under docs/world must begin with a `---` front-matter block");
      continue;
    }

    for (const record of records) {
      const singleRecord = records.length === 1;
      if (record.error) {
        add(record.file, record.line, "front-matter", record.error);
        continue;
      }
      const data = record.data;
      for (const key of REQUIRED) {
        if (!(key in data)) add(record.file, record.line, "key-missing", `${key} is required and missing`);
      }
      for (const key of Object.keys(data)) {
        if (!REQUIRED.includes(key) && !OPTIONAL.includes(key)) add(record.file, record.line, "key-extra", `${key} is not part of the schema`);
      }

      const id = data.id;
      if (typeof id !== "string" || !id) {
        add(record.file, record.line, "id", "id must be a non-empty string");
      } else {
        const stem = name.replace(/\.md$/, "");
        // invariants.md and traps.md are containers: by design they hold several
        // records, so they cannot be named after one of them. Every other page is
        // one record, and its id is its filename.
        const container = name === "invariants.md" || name === "traps.md";
        if (!container && stem !== id) add(record.file, record.line, "id-filename", `id "${id}" must equal the filename stem "${stem}"`);
        if (idsSeen.has(id)) add(record.file, record.line, "id-duplicate", `id "${id}" also appears in ${idsSeen.get(id)}`);
        else idsSeen.set(id, record.file);
      }

      if (data.type && !TYPES.has(data.type)) add(record.file, record.line, "bad-type", `type "${data.type}" is not one of ${[...TYPES].join(", ")}`);
      if (data.status && !(data.type === "adr" ? ADR_STATUSES : STATUSES).has(data.status)) {
        add(record.file, record.line, "bad-status", `status "${data.status}" is not one of ${[...(data.type === "adr" ? ADR_STATUSES : STATUSES)].join(", ")}`);
      }
      if (data.confidence && !CONFIDENCES.has(data.confidence)) add(record.file, record.line, "bad-confidence", `confidence "${data.confidence}" is not high, medium or low`);
      if (data.verified_at != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.verified_at))) add(record.file, record.line, "bad-date", `verified_at "${data.verified_at}" is not YYYY-MM-DD`);

      const directory = section;
      const expectedType = { entities: "entity", decisions: "adr", runbooks: "runbook", proposed: null }[directory];
      if (expectedType && data.type !== expectedType) add(record.file, record.line, "type-directory", `${relative} sits in ${directory}/, so its type must be "${expectedType}"`);
      if (directory === "entities" && typeof id === "string" && !/^[a-z][a-z0-9.-]*\.[a-z0-9.-]+$/.test(id)) {
        add(record.file, record.line, "entity-id", `entity ids are dotted and stable; "${id}" is not`);
      }

      if (typeof data.verify !== "string" || data.verify.trim() === "") {
        add(record.file, record.line, "verify-empty", "verify must be a single non-interactive shell command");
      } else {
        if (isTriviallyTrue(data.verify)) add(record.file, record.line, "verify-always-true", `verify "${data.verify}" can never fail; a claim that cannot be disproved is not a claim`);
        if (/\b(curl|wget)\b/.test(data.verify)) add(record.file, record.line, "verify-network", "verify commands run offline; no network calls allowed");
      }

      if (data.owner != null && roster.owners.size && !roster.owners.has(String(data.owner))) {
        add(record.file, record.line, "owner-unknown", `owner "${data.owner}" is not in roster.yaml`);
      }

      if (Array.isArray(data.sources)) {
        for (const source of data.sources) {
          if (typeof source !== "string") { add(record.file, record.line, "source-missing", `source ${JSON.stringify(source)} is not a path or commit:<sha>`); continue; }
          if (source.startsWith("commit:")) {
            const sha = source.slice(7);
            const check = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root, encoding: "utf8" });
            if (check.status !== 0) add(record.file, record.line, "source-missing", `commit:${sha} does not exist in this repository`);
            continue;
          }
          if (!fs.existsSync(path.join(root, source))) add(record.file, record.line, "source-missing", `source ${source} does not exist`);
        }
      } else if (data.sources != null) {
        add(record.file, record.line, "source-missing", "sources must be a list of repo-relative paths or commit:<sha>");
      }

      const bodyLines = record.body.split("\n");
      const limit = BODY_LIMIT[data.type] ?? 120;
      if (bodyLines.length > limit) add(record.file, record.bodyLine, "body-too-long", `body is ${bodyLines.length} lines; the cap for type ${data.type} is ${limit}`);
      for (const block of codeBlocks(record.body)) {
        if (block.length > 5) add(record.file, record.bodyLine + block.line, "code-block", `${block.length}-line code block; the cap is 5 lines, link the source instead`);
      }

      if (data.type === "entity" && !/^## Not this$/m.test(record.body)) {
        add(record.file, record.line, "not-this", "every entity page needs a `## Not this` section naming what it is not responsible for");
      }

      for (const [index, line] of bodyLines.entries()) {
        for (const match of line.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
          const target = match[2];
          if (/^(https?:|mailto:|#)/.test(target)) continue;
          const candidate = path.isAbsolute(target) ? target : path.join(path.dirname(file), target);
          const fallback = path.isAbsolute(target) ? target : path.join(root, target);
          if (!fs.existsSync(candidate) && !fs.existsSync(fallback)) {
            add(record.file, record.bodyLine + index, "broken-link", `[${match[1]}](${target}) points at a file that is not there`);
          }
        }
      }

      if (data.status === "suspect") {
        const verified = String(data.verified_at ?? "");
        const days = verified ? (Date.now() - Date.parse(verified)) / 86_400_000 : Infinity;
        const fix = path.join(worldDir(root), "proposed", `${id}.md`);
        if (days > 7 && !fs.existsSync(fix)) {
          add(record.file, record.line, "suspect-stale", `suspect since ${verified || "unknown"} with no proposed/${id}.md to fix it`);
        }
      }
    }

    if (section === "proposed") {
      const body = records[0]?.body ?? "";
      if (!/^## Why$/m.test(body)) add(relative, 1, "proposal-why", "a proposal must state `## Why`");
      if (!/^## Verification performed$/m.test(body)) add(relative, 1, "proposal-verification", "a proposal must show `## Verification performed` with the command and its exit code");
    }
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const inTree = tracked.has(`${entry.name}/`) || [...tracked].some((line) => line.startsWith(`${entry.name}/`));
    if (!inTree && !fs.existsSync(path.join(root, entry.name, "PURPOSE"))) continue;
    if (!fs.existsSync(path.join(root, entry.name, "PURPOSE"))) {
      add(path.join(entry.name, "PURPOSE"), 0, "purpose-missing", `${entry.name}/ has no PURPOSE file; the generated map cannot say what it is for`);
    }
  }

  return problems;
}

// ------------------------------------------------------------------- verify ----

function sourceCommit(root, source) {
  if (!source || source.startsWith("commit:")) return source.startsWith("commit:") ? source.slice(7) : "";
  const run = spawnSync("git", ["log", "-1", "--format=%h", "--", source], { cwd: root, encoding: "utf8" });
  return (run.stdout || "").trim();
}

function runCommand(root, command, timeoutMs = VERIFY_TIMEOUT_MS) {
  const run = spawnSync("sh", ["-c", command], { cwd: root, encoding: "utf8", timeout: timeoutMs });
  if (run.error) return { ok: false, timedOut: true, stderr: run.error.message };
  // spawnSync kills the child on timeout; the exit status is then null and the signal
  // is set. Reading only the status would read a killed check as a passing one.
  if (run.signal) return { ok: false, timedOut: true, stderr: `killed after ${timeoutMs} ms (${run.signal})` };
  return { ok: run.status === 0, timedOut: false, stderr: run.stderr || "", stdout: run.stdout || "" };
}

function patchRecord(root, record, changes) {
  const file = path.join(root, record.file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = record.line; i < record.end - 1; i += 1) {
    const match = /^(\s*)([a-z_]+):\s*(.*)$/.exec(lines[i]);
    if (match && Object.prototype.hasOwnProperty.call(changes, match[2])) {
      lines[i] = `${match[1]}${match[2]}: ${changes[match[2]]}`;
    }
  }
  fs.writeFileSync(file, lines.join("\n"));
}

export function changedPaths(root, ref) {
  const run = spawnSync("git", ["diff", "--name-only", ref, "HEAD"], { cwd: root, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git cannot compare against ${ref}: ${run.stderr.trim() || "the ref does not exist in this clone"}`);
  return run.stdout.split("\n").filter(Boolean);
}

export function selectForChanges(records, paths) {
  const out = [];
  for (const record of records) {
    if (!Array.isArray(record.data?.sources)) continue;
    for (const source of record.data.sources) {
      if (typeof source !== "string" || source.startsWith("commit:")) continue;
      if (paths.some((changed) => changed === source || changed.startsWith(source) || source.startsWith(changed))) {
        out.push(record);
        break;
      }
    }
  }
  return out;
}

export function verify(root, { all = false, changedFrom = null, files = [], dryRun = false } = {}) {
  const records = allRecords(root);
  let selected = records;
  if (files.length) {
    selected = records.filter((record) => files.includes(record.file));
  } else if (changedFrom) {
    selected = selectForChanges(records, changedPaths(root, changedFrom));
  }

  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const record of selected) {
    const command = record.data?.verify;
    if (typeof command !== "string" || !command.trim()) {
      results.push({ id: record.data?.id ?? record.file, status: record.data?.status ?? "unknown", result: "no-verify", command: null, source: null, commit: "", stderr: "" });
      continue;
    }
    const run = runCommand(root, command);
    const newest = (record.data?.sources ?? []).filter((s) => typeof s === "string" && !s.startsWith("commit:")).map((s) => sourceCommit(root, s)).filter(Boolean).sort().join(" ");
    results.push({
      id: record.data?.id ?? record.file,
      type: record.data?.type,
      status: record.data?.status,
      verified_at: record.data?.verified_at,
      result: run.ok ? "pass" : "fail",
      command,
      sources: record.data?.sources ?? [],
      commit: newest,
      stderr: run.timedOut ? `timed out after ${VERIFY_TIMEOUT_MS / 1000} s` : (run.stderr || "").trim().split("\n").slice(-3).join(" | "),
    });

    if (dryRun) continue;
    if (run.ok) {
      // verified_at moves with a passing check. status is never moved back to
      // current here: only a human or the page owner promotes a suspect claim.
      patchRecord(root, record, { verified_at: today });
    } else {
      patchRecord(root, record, { status: "suspect", verified_at: today });
    }
  }
  return results;
}

// --------------------------------------------------------------------- map ----

function topDirs(root) {
  const tracked = new Set(spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout.split("\n"));
  const seen = new Set();
  for (const line of tracked) {
    if (!line.includes("/")) continue; // a root file needs no PURPOSE; a directory does
    const first = line.split("/")[0];
    if (first && !first.startsWith(".") && fs.existsSync(path.join(root, first))) seen.add(first);
  }
  if (seen.size) return [...seen].sort();
  // Not a git repository, or an empty one: describe the folders that are actually there.
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
    .map((entry) => entry.name)
    .sort();
}

// A summary is the first sentence, not the first 90 characters. A table row that
// ends mid-word is read as a claim that got cut.
function firstSentence(body) {
  const text = body.replace(/^#.*$/m, "").replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim();
  const sentence = (text.split(/(?<=[.?!])\s/)[0] || text).trim();
  if (sentence.length <= 120) return sentence;
  return sentence.slice(0, 120).replace(/\s\S*$/, "") + " ...";
}

export function generateMap(root) {
  const records = allRecords(root);
  const entities = records.filter((record) => record.data?.type === "entity");
  const decisions = records.filter((record) => record.data?.type === "adr");
  const runbooks = records.filter((record) => record.data?.type === "runbook");
  const invariants = records.filter((record) => record.data?.type === "invariant");
  const traps = records.filter((record) => record.data?.type === "trap");
  const suspects = records.filter((record) => record.data?.status === "suspect");

  const out = [];
  out.push(MARKER_OPEN);
  out.push("## Layout - what is in this repository");
  out.push("");
  out.push("| directory | purpose |");
  out.push("| --- | --- |");
  for (const dir of topDirs(root)) {
    const purposeFile = path.join(root, dir, "PURPOSE");
    const purpose = fs.existsSync(purposeFile) ? fs.readFileSync(purposeFile, "utf8").split("\n")[0].trim() : "no PURPOSE file - add one";
    out.push(`| ${dir}/ | ${purpose} |`);
  }
  out.push("");

  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    let scripts = {};
    try {
      scripts = JSON.parse(fs.readFileSync(pkgPath, "utf8")).scripts ?? {};
    } catch {
      scripts = {};
    }
    out.push("## Commands you can run");
    out.push("");
    out.push("| command | what it does |");
    out.push("| --- | --- |");
    for (const [name, command] of Object.entries(scripts)) {
      out.push(`| \`npm run ${name}\` | \`${String(command).slice(0, 90)}\` |`);
    }
    out.push("");
  }

  out.push("## Claim index");
  out.push("");
  out.push(`| id | one line | owner | verified_at |`);
  out.push("| --- | --- | --- | --- |");
  for (const record of [...entities, ...invariants, ...decisions, ...runbooks]) {
    out.push(`| ${record.data.id} | ${firstSentence(record.body)} | ${record.data.owner} | ${record.data.verified_at} |`);
  }
  out.push("");
  out.push(`## Where to look for a claim`);
  out.push("");
  out.push(`- entities: ${entities.length} · invariants: ${invariants.length} · decisions: ${decisions.length} · runbooks: ${runbooks.length} · traps: ${traps.length}`);
  out.push(`- suspect right now: ${suspects.length ? suspects.map((record) => record.data.id).join(", ") : "none"}`);
  out.push(`- re-check everything: \`npm run world\` · gate: \`npm run world:lint\` · regenerate this index: \`npm run world:map\``);
  out.push(MARKER_CLOSE);
  return out.join("\n");
}

export function writeMap(root) {
  const file = path.join(worldDir(root), "00-map.md");
  if (!fs.existsSync(file)) return { changed: false, reason: "00-map.md does not exist; run with --init first" };
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf(MARKER_OPEN);
  const end = text.indexOf(MARKER_CLOSE);
  if (start === -1 || end === -1 || end < start) return { changed: false, reason: "00-map.md has no generated region between the markers" };
  const generated = generateMap(root);
  const next = text.slice(0, start) + generated + text.slice(end + MARKER_CLOSE.length);
  if (next === text) return { changed: false, reason: "the generated region is current" };
  fs.writeFileSync(file, next);
  return { changed: true, reason: "the generated region was rewritten" };
}

// ---------------------------------------------------------------- scaffold ----

// The starting pages for a repository that has no world model yet. They live in
// templates/ so a published package ships them, and a reader can see the shape of a
// record before writing one.
const TEMPLATE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "templates");

const TEMPLATE_PLACEMENT = {
  "ADR-000-world-model.md": "decisions/ADR-000-world-model.md",
};

export function scaffold(root) {
  const created = [];
  fs.mkdirSync(worldDir(root), { recursive: true });
  for (const dir of ["entities", "decisions", "runbooks", "proposed"]) {
    const full = path.join(worldDir(root), dir);
    if (fs.existsSync(full)) continue;
    fs.mkdirSync(full, { recursive: true });
    fs.writeFileSync(path.join(full, ".gitkeep"), "");
    created.push(rel(root, path.join(full, ".gitkeep")));
  }
  if (fs.existsSync(TEMPLATE_DIR)) {
    for (const name of fs.readdirSync(TEMPLATE_DIR).sort()) {
      const file = path.join(worldDir(root), TEMPLATE_PLACEMENT[name] ?? name);
      if (fs.existsSync(file)) continue;
      fs.writeFileSync(file, fs.readFileSync(path.join(TEMPLATE_DIR, name), "utf8"));
      created.push(rel(root, file));
    }
  }
  writeMap(root);
  return created;
}

export { worldDir, rel, VERIFY_TIMEOUT_MS, MAP_LIMIT, runCommand };
