#!/usr/bin/env node
// bin/agent/doc-checks.mjs - the checks over this package's prose.
//
// Six checks, one per rule this package's documentation guidance states:
//
//   one-term      one word per concept, from the one canonical-term table in
//                 `README.md`; a rival word for a covered concept is a violation.
//   citations     every `path/to/file.ext:NNN` citation names a line that exists, and
//                 when the citing line names an identifier in backticks, that name
//                 occurs in the cited range.
//   headings      a heading carrying a standalone pronoun ("it", "this", "these") is
//                 resolved only if the section's first line names the thing.
//   mirrors       no upstream documentation page is copied into `guides/`, and every
//                 in-tree path the prose mentions exists.
//   dated-prose   guides, README and the skills carry no dated stamp.
//   line-count    no sentence states how many lines a tracked file has: a count of a
//                 file is a snapshot, and it reads as a fact about the file.
//
// Scope, and why each exemption exists:
//
//   * PROSE is README.md, AGENTS.md, guides/**, skills/**, .agents/skills/**.
//   * CODE is extensions, lib, policies, libraries, bin, test, host.
//   * `docs/world` and `notes/` are NOT in these checks: `world_lint.mjs` checks the
//     records, and a note is allowed to discuss a word in order to ban it.
//   * `CHANGELOG.md` is NOT in these checks: it is the history of names this package
//     has already dropped, and rewriting it would destroy that.
//   * `AGENTS.md` is exempt from `dated-prose` only: its command table prices each
//     command with the date the cost was measured, which is what makes the price honest.
//   * a line in a skill's front matter starting `verified:` is exempt from
//     `dated-prose`: it is pi's own metadata for the skill file, not prose.
//   * the token `gated:` is exempt from `one-term`: it is a field name in the tool's
//     own `details` record, and renaming it would change the tool's output contract.
//   * `bin/agent/doc-checks.mjs` is exempt from `one-term`: it holds the patterns.
//   * any line carrying `doc-check:ignore` is skipped, so an exemption is visible in
//     the file that needs it rather than hidden in this script.
//
// Usage:
//   node bin/agent/doc-checks.mjs <check>     one check, violations on stdout, exit 1
//   node bin/agent/doc-checks.mjs --all       all six, one section each
// Offline: reads files under the package directory and runs nothing.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";

const SKIP_DIRS = new Set([".git", ".ai-work", "node_modules", ".local", "dist", "target"]);
const CODE_DIRS = ["extensions", "lib", "policies", "libraries", "bin", "test", "host"];
const PROSE_FILES = ["README.md", "AGENTS.md"];
const PROSE_DIRS = ["guides", "skills", ".agents/skills"];
const SELF = "bin/agent/doc-checks.mjs";

// The words this package bans for concepts its canonical table already names.
const RIVAL_WORDS = [
  { name: "preset", pattern: /\bpresets?\b/i },
  { name: "gate", pattern: /\bgates?\b|\bgated\b|\bgating\b/i },
];
// Literal substrings that are not the rival term: a field name in the tool's output.
const RIVAL_EXEMPT_TOKENS = ["gated:"];
// The terms the canonical table must carry a row for; a deleted row fails the check.
const EXPECTED_TERMS = ["runner", "policy", "roots", "the checks", "checked, unchecked", "registry scope"];
// Words that name a thing outright, so a pronoun in a heading resolves to them.
const ANTECEDENT_WORDS = [
  ...EXPECTED_TERMS,
  "package", "tool", "session", "call", "program", "CLI", "binary", "page", "record",
  "guide", "tree", "workspace", "skill", "policy", "policies", "check", "checks",
];
const STANDALONE_PRONOUNS = /\b(it|its|this|that|these|those)\b/i;
const DETERMINER_BEFORE_NOUN = /\b(this|that|these|those)\s+[a-z]/i;
const DATED_PROSE = /\b(?:19|20)\d{2}-\d{2}-\d{2}\b|@measured|\bmeasured \d|\b(?:dev(?:elopment)?) build\b|this machine had parked/i;

// Slugs of the upstream documentation pages, live and once-copied. A file under
// guides/ named after one of them is an offline copy of a page this package does not own.
const UPSTREAM_SLUGS = [
  "syntax", "builtins_reference", "cli_effects_reference", "install_prebuilt",
  "install_from_source", "pi_codemode_agent", "eyg-syntax-guide", "builtins-reference",
  "cli-effects-reference", "install-a-prebuilt-binary", "install-from-source",
  "effect-access-policies", "advanced-effects", "file-resolution", "writing-tests-with-aok",
];
const KNOWN_EXTENSIONS = [".md", ".ts", ".mjs", ".eyg", ".gleam", ".json", ".sh", ".tsv"];
// `tsv` before `ts`, or a `.tsv` path is read as a `.ts` one.
const PATH_MENTION = /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.<>*-]+\.(?:tsv|md|mjs|ts|eyg|gleam|json|sh)/g;
const CITATION = /\b((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|mjs|eyg|gleam|md|json)):(\d+)(?:-(\d+))?/g;
// A bare `:NNN` inherits the file of the last path citation before it on the same line.
const BARE_CITATION = /`:(\d+)(?:-(\d+))?`/g;

// Session state, not documentation: the goal file and the note-taking skill's own notes
// quote paths as they were when the session wrote them, and a session cannot edit them.
const NOT_DOCUMENTATION = [/^\.pi\/goals\//, /^\.notes\//];

function isDocumentation(rel) {
  return !NOT_DOCUMENTATION.some((re) => re.test(rel));
}

function walk(root, rel = "") {
  const out = [];
  for (const entry of readdirSync(join(root, rel))) {
    if (rel === "" && SKIP_DIRS.has(entry)) continue;
    const relPath = rel === "" ? entry : `${rel}/${entry}`;
    const st = statSync(join(root, relPath));
    if (st.isDirectory()) out.push(...walk(root, relPath));
    else out.push(relPath);
  }
  return out.sort();
}

// Top-level directories and files of the package: a path whose first segment is not one
// of these belongs to another repository and is not this package's to resolve.
function topLevel(root) {
  return new Set(readdirSync(root).filter((entry) => !SKIP_DIRS.has(entry)));
}

function proseFiles(root) {
  const files = walk(root);
  return files.filter(
    (f) =>
      f.endsWith(".md") &&
      (PROSE_FILES.includes(f) || PROSE_DIRS.some((d) => f.startsWith(`${d}/`))),
  );
}

function proseAndCodeFiles(root) {
  const files = walk(root);
  return files.filter(
    (f) =>
      PROSE_FILES.includes(f) ||
      PROSE_DIRS.some((d) => f.startsWith(`${d}/`)) ||
      CODE_DIRS.some((d) => f.startsWith(`${d}/`)),
  );
}

function markdownFiles(root) {
  return walk(root).filter((f) => f.endsWith(".md") && isDocumentation(f));
}

function read(root, rel) {
  return readFileSync(join(root, rel), "utf8");
}

function linesOf(text) {
  return text.split(/\r?\n/);
}

function ignoreLine(line) {
  return line.includes("doc-check:ignore");
}

// --- check 1: one word per concept, from one canonical table ----------------------

function canonicalHeading(line) {
  return /^#{1,6}\s+.*(words this package uses|canonical terms?|glossary)/i.test(line.trim());
}

function tableFirstColumn(lines, headingIndex) {
  const rows = [];
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("|")) {
      const cell = line.split("|")[1]?.trim() ?? "";
      if (cell && !/^(-{3,}|:?-+:?|word|term)$/i.test(cell)) rows.push(cell.replace(/`/g, ""));
    } else if (rows.length && line === "") {
      break;
    } else if (rows.length === 0 && line !== "" && !line.startsWith("|")) {
      break;
    }
  }
  return rows;
}

export function checkOneTerm({ root, files = proseAndCodeFiles(root) }) {
  const problems = [];
  const hosts = [];
  for (const rel of files) {
    const lines = linesOf(read(root, rel));
    lines.forEach((line, i) => {
      if (canonicalHeading(line)) hosts.push(`${rel}:${i + 1} ${line.trim()}`);
    });
  }
  if (hosts.length === 0) problems.push(`no canonical-term table: no file carries a heading this check recognises (expected one in README.md)`);
  if (hosts.length > 1) problems.push(`more than one canonical-term table: ${hosts.join(", ")}`);

  if (hosts.length === 1) {
    const [host] = hosts[0].split(":");
    const lines = linesOf(read(root, host));
    const headingIndex = lines.findIndex((line) => canonicalHeading(line));
    const terms = tableFirstColumn(lines, headingIndex);
    for (const want of EXPECTED_TERMS) {
      if (!terms.includes(want)) problems.push(`${host}: the canonical table has no row for \`${want}\``);
    }
    // The sentence that defines `Pass` is said once, in that table.
    const passSaid = files
      .filter((rel) => rel !== SELF)
      .map((rel) => [rel, (read(root, rel).match(/record of effect-handlers/gi) ?? []).length])
      .filter(([, n]) => n > 0);
    const total = passSaid.reduce((sum, [, n]) => sum + n, 0);
    if (total !== 1) problems.push(`the definition of a policy as a record of effect-handlers appears ${total} times (${passSaid.map(([f, n]) => `${f} x${n}`).join(", ")}); it is said once`);
  }

  for (const rel of files) {
    if (rel === SELF) continue;
    linesOf(read(root, rel)).forEach((line, i) => {
      if (ignoreLine(line)) return;
      let text = line;
      for (const token of RIVAL_EXEMPT_TOKENS) text = text.split(token).join("");
      for (const { name, pattern } of RIVAL_WORDS) {
        if (pattern.test(text)) problems.push(`${rel}:${i + 1} uses the rival word \`${name}\` where the canonical table names the concept: ${line.trim().slice(0, 110)}`);
      }
    });
  }
  return problems;
}

// --- check 2: every file:line citation resolves -----------------------------------

function inThisPackage(path, top) {
  const first = path.split("/")[0];
  return top.has(first) || top.has(path);
}

function identifierTokens(text) {
  return [...text.matchAll(/`([^`]+)`/g)]
    .map((a) => a[1].replace(/[(].*$/, "").trim())
    .filter((a) => /^[A-Za-z_][A-Za-z0-9_.-]{2,}$/.test(a));
}

// The names written for one citation: the backticked spans between it and the previous
// citation on the line. The bounds fall inside the two citation spans, so each end can
// carry one backtick that closes or opens a citation rather than an anchor span.
function anchorsBetween(line, from, to) {
  return identifierTokens(line.slice(from, to).replace(/^`/, "").replace(/`$/, ""));
}

export function checkCitations({ root, files = markdownFiles(root) }) {
  const top = topLevel(root);
  const cache = new Map();
  const contents = (rel) => {
    if (!cache.has(rel)) cache.set(rel, linesOf(read(root, rel)));
    return cache.get(rel);
  };
  const problems = [];
  for (const rel of files) {
    linesOf(read(root, rel)).forEach((line, i) => {
      if (ignoreLine(line) || /deleted/i.test(line)) return;
      // One pass over the line's citations, path form and bare `:NNN` form together, so
      // each citation's anchors are the names written *for it* - the span between the
      // previous citation and this one - rather than every name mentioned nearby.
      const found = [];
      for (const m of line.matchAll(CITATION)) {
        found.push({ start: m.index, end: m.index + m[0].length, path: m[1], from: Number(m[2]), to: Number(m[3] ?? m[2]) });
      }
      for (const m of line.matchAll(BARE_CITATION)) {
        const inherited = found.filter((c) => c.start < m.index).pop();
        if (!inherited) continue;
        found.push({ start: m.index, end: m.index + m[0].length, path: inherited.path, from: Number(m[1]), to: Number(m[2] ?? m[1]) });
      }
      found.sort((a, b) => a.start - b.start);
      found.forEach((cite, n) => {
        const { path, from, to } = cite;
        if (path.includes("<") || path.includes("*")) return;
        if (!inThisPackage(path, top)) return; // the language repository's own path
        let target;
        try {
          target = contents(path);
        } catch {
          problems.push(`${rel}:${i + 1} cites ${path}:${from}${to !== from ? `-${to}` : ""}, which is not a file in this package`);
          return;
        }
        if (from > target.length || to > target.length) {
          problems.push(`${rel}:${i + 1} cites ${path}:${from}${to !== from ? `-${to}` : ""}, but that file has ${target.length} lines`);
          return;
        }
        const anchors = anchorsBetween(line, n === 0 ? 0 : found[n - 1].end, cite.start);
        if (anchors.length === 0) return;
        const cited = target.slice(from - 1, to).join("\n");
        if (anchors.some((a) => cited.includes(a))) return;
        const where = anchors
          .map((a) => `${a} -> ${target.map((l, k) => (l.includes(a) ? k + 1 : 0)).filter(Boolean).slice(0, 4).join(", ") || "not in the file"}`)
          .join("; ");
        problems.push(`${rel}:${i + 1} cites ${path}:${from}${to !== from ? `-${to}` : ""}, which holds none of: ${where}`);
      });
    });
  }
  return problems;
}

// --- check 3: a heading's pronoun names the thing in its first line ----------------

export function checkHeadings({ root, files = proseFiles(root) }) {
  const problems = [];
  for (const rel of files) {
    const lines = linesOf(read(root, rel));
    for (let i = 0; i < lines.length; i += 1) {
      const heading = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (!heading) continue;
      const title = heading[2];
      if (!STANDALONE_PRONOUNS.test(title)) continue;
      // "this package", "that row": a determiner in front of a noun already names the thing.
      const standalone = title.replace(DETERMINER_BEFORE_NOUN, "");
      if (!STANDALONE_PRONOUNS.test(standalone)) continue;
      let first = "";
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j].trim();
        if (line === "" || line.startsWith("#") || /^\|?\s*-{3,}/.test(line)) continue;
        first = line;
        break;
      }
      const named = /`[^`]+`/.test(first) || ANTECEDENT_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(first));
      if (!named) {
        problems.push(`${rel}:${i + 1} heading \`${title}\` points at a pronoun; the section's first line names nothing: \`${first.slice(0, 90) || "(empty)"}\``);
      }
    }
  }
  return problems;
}

// --- check 4: no upstream page copy, no dangling path -----------------------------

export function checkMirrors({ root, files = proseFiles(root) }) {
  const top = topLevel(root);
  const problems = [];
  for (const rel of walk(root)) {
    if (!rel.startsWith("guides/")) continue;
    const base = rel.split("/").pop().replace(/\.md$/, "");
    if (UPSTREAM_SLUGS.includes(base)) problems.push(`${rel}: a copy of the upstream page \`${base}\`; link it instead of copying it`);
  }
  for (const rel of files) {
    linesOf(read(root, rel)).forEach((line, i) => {
      if (ignoreLine(line) || /deleted/i.test(line)) return;
      for (const m of line.matchAll(PATH_MENTION)) {
        const path = m[0];
        if (path.includes("<") || path.includes("*")) continue;
        if (!inThisPackage(path, top)) continue;
        if (!KNOWN_EXTENSIONS.some((ext) => path.endsWith(ext))) continue;
        let exists = true;
        try {
          statSync(join(root, path));
        } catch {
          exists = false;
        }
        if (!exists) problems.push(`${rel}:${i + 1} mentions ${path}, which is not in the tree`);
      }
    });
  }
  return problems;
}

// --- check 5: no dated stamp in the prose -----------------------------------------

export function checkDatedProse({ root, files = proseFiles(root).filter((f) => f !== "AGENTS.md") }) {
  const problems = [];
  for (const rel of files) {
    linesOf(read(root, rel)).forEach((line, i) => {
      if (ignoreLine(line)) return;
      if (/^verified:/.test(line)) return; // pi's own skill front matter, not prose
      const m = line.match(DATED_PROSE);
      if (m) problems.push(`${rel}:${i + 1} carries a dated stamp \`${m[0]}\`: ${line.trim().slice(0, 100)}`);
    });
  }
  return problems;
}

// --- check 6: no prose states how many lines a tracked file has -------------------

// A count of a file is a snapshot of a file that grows; the sentence that carries it reads
// as a fact about the file, and nothing notices when the file moves. The rule from
// `docs/world/entities/gap.duplication-literals-in-prose.md`: name the command that prints
// the count, not the count. A written budget (`a body under 120 lines`) is an instruction to a
// reader, not a count of a file, and a run's counts (`s wall`, `rows`, `tests`) are facts about
// a run - AGENTS.md prices commands this way by design.
const LINE_COUNT = /\b\d+\s+(?:non-comment |code |raw |total |verbatim )*lines\b/i;
const LINE_COUNT_ALLOW = /\b(?:s wall|ms wall|rows\b|tests\b|claims?\b)|(?:under|at most|within|no more than|fewer than)\s+\d+/i;

export function checkLineCount({ root, files = proseFiles(root) }) {
  const problems = [];
  for (const rel of files) {
    linesOf(read(root, rel)).forEach((line, i) => {
      if (ignoreLine(line)) return;
      const m = line.match(LINE_COUNT);
      if (m && !LINE_COUNT_ALLOW.test(line)) {
        problems.push(`${rel}:${i + 1} states a line count \`${m[0]}\`: name the command that prints it - ${line.trim().slice(0, 100)}`);
      }
    });
  }
  return problems;
}

// --- cli -------------------------------------------------------------------------

const CHECKS = {
  "one-term": checkOneTerm,
  citations: checkCitations,
  headings: checkHeadings,
  mirrors: checkMirrors,
  "dated-prose": checkDatedProse,
  "line-count": checkLineCount,
};

function parseArgs(argv) {
  let root = process.cwd();
  const names = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root") {
      root = posix.normalize(argv[i + 1] ?? process.cwd());
      i += 1;
    } else {
      names.push(argv[i]);
    }
  }
  return { root, names };
}

function main() {
  const { root, names } = parseArgs(process.argv.slice(2));
  const chosen = names.length === 0 || names.includes("--all") ? Object.keys(CHECKS) : names;
  for (const name of chosen) {
    const check = CHECKS[name];
    if (!check) {
      console.error(`doc-checks: unknown check ${name}; choose from ${Object.keys(CHECKS).join(", ")}`);
      process.exitCode = 2;
      continue;
    }
    let problems = [];
    try {
      problems = check({ root });
    } catch (error) {
      console.error(`doc-checks ${name}: ${error.message}`);
      process.exitCode = 2;
      continue;
    }
    if (problems.length === 0) {
      console.log(`${name}: ok`);
      continue;
    }
    process.exitCode = 1;
    console.log(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    for (const problem of problems) console.log(`  ${problem}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
