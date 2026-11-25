#!/usr/bin/env node
// bin/agent/policy-flag-sweep.mjs - keep a retired mechanism retired.
//
// On 2026-11-22 the per-effect checks moved from the runner's command line into
// `host/guard.eyg` (`docs/world/decisions/ADR-006-guard-in-package.md`): the tool's argv
// became `[mode, entry.eyg]` and no CLI flag carries a policy module any more. Nothing
// catches a note that still tells a reader to hand one over - `bin/agent/doc-checks.mjs`
// excludes `notes/` and `pi-simple-world-model/bin/world_lint.mjs` never reads them, which
// is the drift trap recorded in `docs/world/traps.md`. This sweep covers those files.
//
// What it calls a violation: the retired flag written as a command line you could run
// today - one of the CLI's mode words immediately followed by the flag. A mention that
// sits under a heading that carries a date is history and is allowed: the note says when
// the run was taken, and a dated capture stays true after the mechanism it captured is
// gone. A dated CHANGELOG section passes; a bare instruction in a note does not.
//
//   node bin/agent/policy-flag-sweep.mjs                 -> 0.02 s wall, exit 0 when clean
//   node bin/agent/policy-flag-sweep.mjs <file> ...      -> scan the named files instead
// The named-file form is how the check is proved to bite: plant the retired command line
// in a scratch file under `.ai-work/` and run it - the row prints and the exit is 1.
// This package's own scripts still take a policy module as an argument
// (`bin/agent/secret-rule-probe.mjs`); that flag belongs to a script of this package, not
// to the CLI, so it is not the retired spelling and the sweep does not report it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FLAG = "-" + "-policy";
const DATE = /20\d\d-\d\d-\d\d/;
const MODE = /(?:\b(?:run|eval|script))\s*$/;

const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let files;
if (named.length > 0) {
  files = named;
} else {
  files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(md|mjs|ts|eyg|sh|json|jsonl|yaml|tsv|txt)$/.test(f))
    .filter((f) => !f.includes("policy-flag-sweep"));
}

const live = [];
const history = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  let heading = 0;
  for (let n = 0; n < lines.length; n++) {
    if (lines[n].startsWith("#")) heading = n;
    const line = lines[n];
    let at = line.indexOf(FLAG);
    while (at !== -1) {
      const before = line.slice(Math.max(0, at - 24), at);
      const block = lines.slice(heading, n + 1).join("\n");
      const row = `${file}:${n + 1}: ${line.trim()}`;
      if (MODE.test(before)) {
        if (DATE.test(block)) history.push(row);
        else live.push(row);
      }
      at = line.indexOf(FLAG, at + FLAG.length);
    }
  }
}

for (const row of live) console.log(row);
console.log(
  `policy flag: retired ${live.length === 0}, ${live.length} live command-line mention${
    live.length === 1 ? "" : "s"
  }, ${history.length} dated history mention${history.length === 1 ? "" : "s"}`,
);
process.exit(live.length === 0 ? 0 : 1);
