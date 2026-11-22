#!/usr/bin/env node
// The one machine-readable surface this package ships, generated and checked.
//
// Why a generated file at all: this package used to carry offline copies of the language's
// prose pages. A prose copy is a second answer to "what is the surface", it drifts, and a
// model reads it as if it were current. The surface the tool prints - builtin names, effect
// names, the policy field that decides each effect - is data, so it lives in one data file
// with its provenance in its own header, and a command re-derives it.
//
// What the drift check actually compares (all offline, all under a second):
//   1. every `effect` row against `test/fixtures/rule_mapping.gleam`, the runtime's
//      `rule_mapping` recorded verbatim - the independent record of what the CLI names;
//   2. the same rows against `POLICY_FIELDS` in `lib/render-helpers.mjs`, the shape the tool
//      itself renders from - so the file and the code cannot disagree;
//   3. every `!builtin` this tree's own .eyg sources call against the `builtin` rows - the
//      names this package depends on at run time pin the list;
//   4. the file against what the generator rebuilds from its inputs, byte for byte.
// A planted rename anywhere in the generated region fails 1 or 4; a planted rename of a
// builtin this tree calls fails 3.
//
// Usage:
//   node bin/agent/gen-surface.mjs --check     drift check, no write
//   node bin/agent/gen-surface.mjs --write     rewrite the file from its inputs
//   node bin/agent/gen-surface.mjs --builtins <page.md> --write
//       re-capture the builtin rows from the language's builtins page saved as markdown,
//       and record where that capture came from in the header

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { POLICY_FIELDS, builtinRows } from "../../lib/render-helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(dirname(here));
const SURFACE = join(packageDir, "guides", "eyg-surface.tsv");
const RULE_MAPPING = join(packageDir, "test", "fixtures", "rule_mapping.gleam");

// The language's page the builtin rows came from, and the page that carries the effects and
// the syntax prose - named so a reader can check the surface at its source.
const BUILTINS_PAGE = "https://eyg.run/guides/builtins-reference";

const COLUMNS = ["kind", "name", "detail1", "detail2"];

/// The effect rows the runtime records: `#("ReadFile", policy.PolicyField("read_file"))` and
/// `#("Hash", policy.Unchecked)` become `effect` rows; an unchecked effect's field is `none`.
export function effectRowsFromRuleMapping(source) {
  const rows = [];
  for (const line of String(source).split("\n")) {
    const field = /#\("([A-Za-z0-9_]+)",\s*policy\.PolicyField\("([a-z_]+)"\)\)/.exec(line);
    if (field !== null) {
      rows.push({ kind: "effect", name: field[1], detail1: field[2], detail2: "" });
      continue;
    }
    const unchecked = /#\("([A-Za-z0-9_]+)",\s*policy\.Unchecked\)/.exec(line);
    if (unchecked !== null) {
      rows.push({ kind: "effect", name: unchecked[1], detail1: "none", detail2: "" });
    }
  }
  return rows;
}

/// The rows of the surface file itself. `#` lines are the header and are ignored.
export function surfaceRows(text) {
  const rows = [];
  for (const line of String(text ?? "").split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const cells = line.split("\t");
    if (!["builtin", "effect"].includes(cells[0])) continue;
    rows.push({ kind: cells[0], name: cells[1], detail1: cells[2] ?? "", detail2: cells[3] ?? "" });
  }
  return rows;
}

/// Strip an EYG `//` comment from a line. The quote count before the slashes decides: an even
/// number means the slashes are outside a string, so everything after them is a comment. A
/// comment is not a call - `libraries/search.eyg` says in prose that `!list_length` does not
/// exist, and a scanner that read comments would list it.
function stripComment(line) {
  const at = line.indexOf("//");
  if (at === -1) return line;
  const before = line.slice(0, at);
  const quotes = (before.match(/"/g) ?? []).length;
  const spans = (before.match(/`/g) ?? []).length;
  return quotes % 2 === 0 && spans % 2 === 0 ? before : line;
}

/// Every `!builtin` this tree's own EYG sources call, deduplicated. These are the names this
/// package depends on at run time, so they are the ones the list has to carry.
export function builtinsUsed(packageDirectory = packageDir) {
  let files = [];
  try {
    files = execFileSync("git", ["ls-files", "*.eyg"], { cwd: packageDirectory, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    files = [];
  }
  const names = new Set();
  for (const file of files) {
    const source = readFileSync(join(packageDirectory, file), "utf8");
    for (const line of source.split("\n")) {
      for (const match of stripComment(line).matchAll(/!(?:@)?([a-z][A-Za-z0-9_]*)/g)) names.add(`!${match[1]}`);
    }
  }
  return [...names].sort();
}

function header(capture) {
  return [
    "# eyg-surface - the surface this tool prints: one row per builtin, one row per effect.",
    "# Generated by bin/agent/gen-surface.mjs. Do not edit rows by hand; edit the inputs.",
    "#",
    "# effects: generated from test/fixtures/rule_mapping.gleam, the runtime's rule_mapping",
    "#   recorded verbatim (test/fixtures/rule_mapping.PROVENANCE.md: where it came from, its",
    "#   checksums, how to refresh it). `none` in the field column marks an effect no policy",
    "#   can forbid. The language's page on CLI effects,",
    "#   <https://eyg.run/guides/cli-effects-reference>, explains what each effect does; the",
    "#   syntax prose is <https://eyg.run/guides/eyg-syntax-guide>. This package copies no",
    "#   prose page: this file is the whole offline surface, and the compiler is the source",
    "#   under all of it.",
    "#",
    ...captureLines(capture),
    "#",
    "# drift: node bin/agent/gen-surface.mjs --check re-derives the effect rows from that",
    "#   fixture, requires them to equal POLICY_FIELDS in lib/render-helpers.mjs, requires every",
    "#   !builtin this tree's own .eyg sources call to be listed here, and compares the file",
    "#   byte for byte with what it rebuilds. Offline, under a second.",
    "#",
    COLUMNS.join("\t"),
  ];
}

function captureLines(capture) {
  if (capture === null) return [`# builtins: captured from <${BUILTINS_PAGE}>; --builtins <page.md> --write refreshes the rows.`];
  return [
    `# builtins: captured from <${BUILTINS_PAGE}> on ${capture.date}; md5 of the copy this tree`,
    `#   deleted is ${capture.md5}. The names and signatures are the page's, not this package's.`,
    `#   Re-capture with: node bin/agent/gen-surface.mjs --builtins <the page as markdown> --write`,
  ];
}

function render(rows, capture) {
  const lines = header(capture);
  for (const row of rows) lines.push(COLUMNS.map((key) => row[key] ?? "").join("\t"));
  return `${lines.join("\n")}\n`;
}

/// Read the capture provenance out of an existing surface file's header, so a rewrite does not
/// lose where the builtin rows came from.
function captureOf(text) {
  const date = /captured from <[^>]+> on (\d{4}-\d{2}-\d{2}); md5 of the copy this tree/.exec(text ?? "");
  const md5 = /deleted is ([0-9a-f]{32})/.exec(text ?? "");
  return date === null || md5 === null ? null : { date: date[1], md5: md5[1] };
}

function compareRows(want, have) {
  const problems = [];
  const key = (row) => `${row.kind}\t${row.name}\t${row.detail1}\t${row.detail2}`;
  const wantKeys = want.map(key);
  const haveKeys = have.map(key);
  for (const k of wantKeys) if (!haveKeys.includes(k)) problems.push(`missing row: ${k}`);
  for (const k of haveKeys) if (!wantKeys.includes(k)) problems.push(`row not in the inputs: ${k}`);
  return problems;
}

/// The four comparisons. Exported so the test suite can plant a rename in the rows and prove
/// the check answers it, without editing the file on disk.
export function surfaceDriftProblems(surfaceText) {
  const problems = [];
  const rows = surfaceRows(surfaceText);
  const effects = rows.filter((row) => row.kind === "effect");
  const builtins = rows.filter((row) => row.kind === "builtin");

  // 1. the runtime's recorded mapping.
  const recorded = effectRowsFromRuleMapping(readFileSync(RULE_MAPPING, "utf8"));
  problems.push(...compareRows(recorded, effects));

  // 2. the shape the tool renders from.
  problems.push(...compareRows(
    Object.entries(POLICY_FIELDS).map(
      ([name, field]) => ({ kind: "effect", name, detail1: field ?? "none", detail2: "" }),
    ),
    effects,
  ));

  // 3. the names this tree calls.
  const listed = new Set(builtins.map((row) => row.name));
  for (const used of builtinsUsed()) {
    if (!listed.has(used)) problems.push(`builtin this tree calls is not listed: ${used}`);
  }

  // 4. the file against its inputs, byte for byte: the builtin rows it carries and the effect
  //    rows the fixture records. Rebuilding the effect half from the file would compare the
  //    file with itself and miss a renamed row.
  const rebuilt = render(
    [...builtins, ...effectRowsFromRuleMapping(readFileSync(RULE_MAPPING, "utf8"))],
    captureOf(surfaceText),
  );
  if (rebuilt !== surfaceText) problems.push("the file does not match what the generator rebuilds");

  return problems;
}

/// Write the file from its inputs, or report what drifted. Returns the process status.
function main(argv) {
  const wantWrite = argv.includes("--write");
  const wantCheck = argv.includes("--check");
  const builtinsAt = argv.indexOf("--builtins");
  const captureSource = builtinsAt === -1 ? null : argv[builtinsAt + 1];

  if (captureSource !== null && !existsSync(captureSource)) {
    console.error(`no such file to capture: ${captureSource}`);
    return 2;
  }

  const current = existsSync(SURFACE) ? readFileSync(SURFACE, "utf8") : "";
  const existing = surfaceRows(current);
  const builtinRowsOut = captureSource === null
    ? existing.filter((row) => row.kind === "builtin")
    : builtinRows(readFileSync(captureSource, "utf8")).map((row) => ({
        kind: "builtin",
        name: `!${row.name.replace(/^!/, "")}`,
        detail1: row.section,
        detail2: row.signature,
      }));
  const capture = captureSource === null
    ? captureOf(current)
    : {
        date: argv.includes("--captured") ? argv[argv.indexOf("--captured") + 1] : new Date().toISOString().slice(0, 10),
        md5: createHash("md5").update(readFileSync(captureSource)).digest("hex"),
      };
  const effectRowsOut = effectRowsFromRuleMapping(readFileSync(RULE_MAPPING, "utf8"));

  if (builtinRowsOut.length === 0) {
    console.error("no builtin rows to write: pass --builtins <the page as markdown> the first time");
    return 2;
  }

  if (wantWrite) {
    writeFileSync(SURFACE, render([...builtinRowsOut, ...effectRowsOut], capture));
    console.log(`wrote ${SURFACE}: ${builtinRowsOut.length} builtins, ${effectRowsOut.length} effects`);
  }

  if (wantCheck || !wantWrite) {
    const text = wantWrite ? readFileSync(SURFACE, "utf8") : current;
    if (text === "") {
      console.error(`no surface file at ${SURFACE}`);
      return 1;
    }
    const problems = surfaceDriftProblems(text);
    if (problems.length > 0) {
      for (const problem of problems) console.log(`FAIL ${problem}`);
      console.log(`surface drift: ${problems.length} problem(s)`);
      return 1;
    }
    const rows = surfaceRows(text);
    console.log(
      `surface current: ${rows.filter((r) => r.kind === "builtin").length} builtins, ` +
        `${rows.filter((r) => r.kind === "effect").length} effects, all inputs agree`,
    );
  }
  return 0;
}

// Imported as a module (the test suite plants a rename and asks the drift check about it),
// this file defines its functions and touches nothing.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
