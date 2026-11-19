#!/usr/bin/env node
// world_verify.mjs - the staleness gate. Runs each claim's own verify command and
// reports what still holds.
//
//   node pi-simple-world-model/bin/world_verify.mjs --all                     # every claim
//   node pi-simple-world-model/bin/world_verify.mjs --changed-from origin/main # claims whose sources moved
//   node pi-simple-world-model/bin/world_verify.mjs docs/world/entities/entity.ledger.md
//   node pi-simple-world-model/bin/world_verify.mjs --all --jsonl             # machine-readable
//   node pi-simple-world-model/bin/world_verify.mjs --all --dry-run           # report, write nothing
//
// A failing command sets status: suspect and prints the claim, the command, the
// stderr tail and the last commit that touched the source. verified_at is written
// on a pass. A suspect claim is never auto-promoted back to current: only the page
// owner or the human does that, after reading the source.
//
// Exit 0 when every selected claim passed, 1 when one did not, 2 when the run could
// not start (bad ref, no docs/world).

import { verify, allRecords } from "../lib/world_model.mjs";

function parse(argv) {
  const options = { all: false, changedFrom: null, files: [], jsonl: false, dryRun: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") options.all = true;
    else if (arg === "--changed-from") options.changedFrom = argv[++i];
    else if (arg.startsWith("--changed-from=")) options.changedFrom = arg.slice(15);
    else if (arg === "--jsonl") options.jsonl = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--root") options.root = argv[++i];
    else if (arg.startsWith("--root=")) options.root = arg.slice(7);
    else if (arg.startsWith("--")) throw new Error(`unknown flag ${arg}; use --all, --changed-from=<ref>, <file>, --jsonl, --dry-run, --root`);
    else options.files.push(arg);
  }
  if (!options.all && !options.changedFrom && options.files.length === 0) options.all = true;
  return options;
}

const options = parse(process.argv.slice(2));
if (options.files.length) options.all = false;

let results;
try {
  results = verify(options.root, { all: options.all, changedFrom: options.changedFrom, files: options.files, dryRun: options.dryRun });
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(2);
}

if (options.jsonl) {
  for (const result of results) console.log(JSON.stringify(result));
  process.exit(results.some((result) => result.result !== "pass") ? 1 : 0);
}

console.log(`| claim | status | verify | result | source | source commit |`);
console.log(`| --- | --- | --- | --- | --- | --- |`);
for (const result of results) {
  console.log(`| ${result.id} | ${result.status} | \`${result.command ?? "none"}\` | ${result.result} | ${(result.sources ?? []).join(", ") || "-"} | ${result.commit || "-"} |`);
}
const failed = results.filter((result) => result.result !== "pass");
console.log(`${results.length} claim(s) checked, ${failed.length} failed${options.dryRun ? " (dry run: nothing written)" : ""}.`);
for (const result of failed) console.log(`FAIL ${result.id}: ${result.command} -> ${result.stderr || "non-zero exit"}`);
process.exit(failed.length ? 1 : 0);
