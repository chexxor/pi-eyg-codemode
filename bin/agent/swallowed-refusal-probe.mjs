#!/usr/bin/env node
// One guarded run of a program that SWALLOWS a refusal, and what the call answers.
//
// A refusal is a value: `let _ = perform WriteFile(...)` prints nothing, the run
// exits 0 and the program's own text says nothing about the refusal. The guard
// keeps the refusals it made as its own value (`build` returns the record lines)
// and the entry writes them to the call's fourth file as its last line, outside
// the guard - so the CLI's own host performs that write and no policy decides or
// refuses it. The tool reads that file and turns the refusals the program never
// reported into rows in the result. This probe runs the entry the tool writes,
// with the real helpers the tool uses, and prints those rows.
//
//   node bin/agent/swallowed-refusal-probe.mjs            # the run, and the rows
//   node bin/agent/swallowed-refusal-probe.mjs --no-record # the same run, no record file
//
// `--no-record` asks the entry for no record, which is what an entry without the
// trailer looks like: the program printed nothing, so nothing names the refusal,
// and this script exits non-zero. That is what makes the audit row falsifiable -
// the row fails when the record stops being written, not only when the refusal
// stops happening.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contextLiteral, entryProgram, hostProtectedPaths, programModule } from "../../lib/render-helpers.mjs";
import { recordedRefusalHint, refusalHints, refusalRecordLines, swallowedRefusals, swallowedRows } from "../../lib/render-helpers.mjs";

const packageDir = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");
const argv = process.argv.slice(2);
const noRecord = argv.includes("--no-record");

const scratch = mkdtempSync(join(tmpdir(), "eyg-swallowed-probe-"));
const roots = [resolve(packageDir)];
const cwd = scratch;
const guard = join(packageDir, "host", "guard.eyg");
const policy = join(packageDir, "policies", "agent-roots.eyg");
const programPath = join(scratch, "program.eyg");
const entryPath = join(scratch, "entry.eyg");
const recordPath = join(scratch, "refusals.txt");
const target = join(scratch, "swallowed-landing.txt");

// The ask is outside every root, so the shipped policy refuses it, and the program
// binds the answer to `_` and prints nothing: the refusal is swallowed.
const source = [
  `let _ = perform WriteFile({path: ${JSON.stringify(target)}, contents: !string_to_binary("the program asked for a write")})`,
  '"done"',
].join("\n");

let code = 0;
let out = "";
let record = "";
const started = Date.now();
try {
  writeFileSync(programPath, programModule(source));
  writeFileSync(entryPath, entryProgram({
    guard,
    policy,
    ctx: contextLiteral({ roots, cwd, fields: [], protected: hostProtectedPaths({ packageDir, policyPath: policy }) }),
    program: programPath,
    record: noRecord ? null : recordPath,
  }));
  try {
    out = execFileSync("eyg", ["run", entryPath], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    code = error.status === undefined ? -1 : error.status;
    out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  record = existsSync(recordPath) ? readFileSync(recordPath, "utf8") : "";
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
const wall = (Date.now() - started) / 1000;

// The rows the tool builds for this call, built the way the tool builds them.
const recorded = refusalRecordLines(record).map((row) => recordedRefusalHint(row));
const swallowed = swallowedRefusals(recorded, refusalHints(out));
const rows = swallowedRows(swallowed, { roots: roots.join(","), policy });

console.log(`one guarded run: argv eyg run ${entryPath}  wall ${wall} s  exit=${code}`);
console.log(`the program itself: stdout ${out.length} bytes - it bound the refusal to _ and printed nothing`);
console.log(`the guard's record file holds ${recorded.length} refusal line(s): ${record.trim()}`);
for (const line of rows) console.log(line);

let holds = true;
if (code !== 0) {
  console.log(`DRIFT  the run did not exit 0: a swallowed refusal must not end the call`);
  holds = false;
}
if (out !== "") {
  console.log(`DRIFT  the program printed ${out.length} bytes: the probe asks it to print nothing`);
  holds = false;
}
if (existsSync(target)) {
  console.log(`DRIFT  a file landed at the refused path: the write was performed`);
  holds = false;
}
if (swallowed.length !== 1) {
  console.log(`DRIFT  ${swallowed.length} refusals named for the program to swallow: the guard's record must name the one`);
  holds = false;
}

console.log(`${swallowed.length} swallowed refusal(s) named by the guard, ${holds ? "" : "DRIFT "}1 run, ${wall} s`);
process.exit(holds ? 0 : 1);
