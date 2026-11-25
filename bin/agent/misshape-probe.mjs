#!/usr/bin/env node
// One guarded program, CHECKED the way the eyg tool checks it before it runs it.
//
// `refusal-probe.mjs` runs the guarded program; this one stops at the check of the entry,
// which is the step the tool now takes first. That step is what makes a mis-shaped ask cost
// a quarter of a second instead of the spawn cap: the ask's run prints nothing at all, because
// the CLI's error report prints its whole interpreter state and on the guarded entry that state
// is the guard and the policy module imported in the body. The check of the same entry answers
// the mis-shape in 240 ms (`notes/pi-codemode-misshaped-ask.md`), so this probe prints what the
// tool would answer and never starts the run - the run this fixture would do costs 20 s of wall
// for 0 bytes, and is not run here.
//
// Nothing is written in this tree: the two files go under the system temporary directory and
// the directory is removed on the way out.
//
//   node bin/agent/misshape-probe.mjs                                 # the shipped mis-shape
//   node bin/agent/misshape-probe.mjs --program test/fixtures/refusal-probe.eyg
//   node bin/agent/misshape-probe.mjs --with-policy deny-all
//
// The last line is the verdict a check greps for; the script always exits 0.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contextLiteral, entryProgram, entryCheckArguments, entryCheckMisshapeRows, hostProtectedPaths, misshapedAskRows, programModule } from "../../lib/render-helpers.mjs";

const packageDir = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
};

const policyName = flag("with-policy", "agent-roots");
const programFile = flag("program", join(packageDir, "test/fixtures/misshaped-ask.eyg"));
const fields = flag("fields", "").split(",").filter((field) => field !== "");
const roots = [resolve(flag("roots", packageDir))];

const scratch = mkdtempSync(join(tmpdir(), "eyg-misshape-probe-"));
const guard = join(packageDir, "host/guard.eyg");
const policy = policyName.startsWith("/") ? resolve(policyName) : join(packageDir, "policies", `${policyName}.eyg`);
const cwd = roots[0];
const protectedPaths = hostProtectedPaths({ packageDir, policyPath: policy });
const ctx = contextLiteral({ roots, cwd, fields, protected: protectedPaths });
const programPath = join(scratch, "program.eyg");
const entryPath = join(scratch, "entry.eyg");

writeFileSync(programPath, programModule(
    readFileSync(programFile, "utf8")
      .replaceAll("{{root}}", roots[0])
      .replaceAll("{{cwd}}", cwd)
      .replaceAll("{{outside}}", scratch),
  ));
writeFileSync(entryPath, entryProgram({ guard, policy, ctx, program: programPath, record: join(scratch, "refusals.txt") }));

const started = Date.now();
let checked = "";
let code = 0;
try {
  checked = execFileSync("eyg", entryCheckArguments(entryPath), { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  code = error.status === undefined ? -1 : error.status;
  checked = `${error.stdout ?? ""}${error.stderr ?? ""}`;
}
const wall = Date.now() - started;
rmSync(scratch, { recursive: true, force: true });

const rows = entryCheckMisshapeRows(checked);
console.log(`argv: eyg ${entryCheckArguments(entryPath).join(" ")}`);
console.log(`policy: ${policy}  roots: ${roots.join(",")}  cwd: ${cwd}`);
console.log(`check answered exit=${code} in ${wall} ms wall, ${checked.length} bytes`);
for (const line of checked.trim().split("\n")) if (line !== "") console.log(`cli: ${line}`);
if (rows.length === 0) {
  console.log("no mis-shape: the check named no type mismatch, so the run would have started");
} else {
  console.log("what the tool answers, and no run started:");
  for (const line of misshapedAskRows(rows, { policy })) console.log(`  ${line}`);
}
console.log(`${rows.length} mis-shaped ask(s) named by the check in ${wall / 1000} s, 0 runs, 0 bytes of run output`);
process.exit(0);
