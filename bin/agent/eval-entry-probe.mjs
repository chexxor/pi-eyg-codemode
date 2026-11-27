#!/usr/bin/env node
// PURPOSE: prove what an `eval` entry answers. The tool writes this entry for an `action:
// eval` call and spawns `eyg eval` on it; the probe writes the same entry outside the tool
// and runs both the check and the eval, so a claim can quote the rows without a session.
// A program that performs an effect here answers `unhandled effect` and performs nothing,
// which is the reason the entry needs no guard.
//
// Usage: node bin/agent/eval-entry-probe.mjs [--fixture <file>] [--perform]
// --fixture defaults to test/fixtures/eval-shape.eyg (one expression, `!int_add(1,2)`).
// --perform swaps in a fixture that asks for an effect, to show eval performs nothing.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { entryProgram, programModule } from "../../lib/render-helpers.mjs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const argv = process.argv;
const i = argv.indexOf("--fixture");
const fixture = i >= 0 ? argv[i + 1] : "test/fixtures/eval-shape.eyg";
const source = readFileSync(fixture, "utf8");
const dir = join("/tmp", "pi-eyg-eval-entry-probe");
mkdirSync(dir, { recursive: true });
const programPath = join(dir, "program.eyg");
const entryPath = join(dir, "entry.eyg");
writeFileSync(programPath, programModule(source));
writeFileSync(entryPath, entryProgram({
  guard: "host/guard.eyg",
  policy: "policies/agent-roots.eyg",
  ctx: "{roots: [], cwd: \"/work\", fields: [], protected: []}",
  program: programPath,
  record: null,
  pure: true,
}));

const rows = [];
for (const mode of ["check", "eval"]) {
  const started = Date.now();
  const run = spawnSync("eyg", [mode, entryPath], { encoding: "utf8" });
  const secs = ((Date.now() - started) / 1000).toFixed(3);
  const out = [(run.stdout ?? ""), (run.stderr ?? "")].filter((t) => t !== "").join("\n").trim();
  rows.push({ mode, secs, code: run.exitCode, out });
}
for (const r of rows) {
  console.log(`${r.mode}: exit=${r.code} in ${r.secs} s wall`);
  console.log(r.out === "" ? "(no output)" : r.out);
}
const value = rows[1].out.split("\n")[0];
console.log(value === "3" ? "eval answers 3 for !int_add(1,2)" : `eval answers ${JSON.stringify(value)}, not 3`);
process.exit(value === "3" ? 0 : 1);
