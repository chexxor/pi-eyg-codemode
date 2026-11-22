#!/usr/bin/env node
// One guarded program, run the way the eyg tool runs every call, from a shell.
//
// It writes the same three files the tool writes (the program module, the entry that puts
// `host/guard.eyg` around it, and the `ctx` the policy reads) under the system temporary
// directory, starts the installed CLI with `<mode> <entry>`, and prints what came back.
// Nothing is written in this tree and the scratch directory is removed on the way out, so
// the refusal you see is the refusal a session sees, and the command costs a fifth of a
// second.
//
//   node bin/agent/refusal-probe.mjs                        # the shipped write probe, under policies/agent-roots.eyg
//   node bin/agent/refusal-probe.mjs --with-policy deny-all # the narrowest policy
//   node bin/agent/refusal-probe.mjs --fields read_file,standard_out --with-policy spawner-effects
//   node bin/agent/refusal-probe.mjs --program test/fixtures/secret-probe.eyg --inside-roots
//
// The program runs with its working directory outside the roots unless `--inside-roots`
// says otherwise, which is what makes the write probe's relative path land outside them.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { contextLiteral, entryProgram, programModule } from "../../lib/render-helpers.mjs";

const packageDir = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
};

const policyName = flag("with-policy", "agent-roots");
const fields = flag("fields", "").split(",").filter((field) => field !== "");
const programFile = flag("program", join(packageDir, "test/fixtures/refusal-probe.eyg"));
const insideRoots = argv.includes("--inside-roots");

const scratch = mkdtempSync(join(tmpdir(), "eyg-refusal-probe-"));
const roots = [packageDir];
const cwd = insideRoots ? packageDir : scratch;
const programPath = join(scratch, "program.eyg");
const entryPath = join(scratch, "entry.eyg");
const guard = join(packageDir, "host/guard.eyg");
const policy = join(packageDir, "policies", `${policyName}.eyg`);
const ctx = contextLiteral({ roots, cwd, fields });

let code = 0;
let out = "";
try {
  writeFileSync(programPath, programModule(
    readFileSync(programFile, "utf8")
      .replaceAll("{{root}}", roots[0])
      .replaceAll("{{cwd}}", cwd)
      .replaceAll("{{outside}}", scratch),
  ));
  writeFileSync(entryPath, entryProgram({ guard, policy, ctx, program: programPath }));
  try {
    out = execFileSync("eyg", ["run", entryPath], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    code = error.status === undefined ? -1 : error.status;
    out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`argv: eyg run ${entryPath}`);
console.log(`policy: ${policy}  roots: ${roots.join(",")}  cwd: ${cwd}  fields: ${fields.join(",") || "(none)"}`);
console.log(out.trimEnd());
console.log(`exit=${code}`);
// The caller's verdict comes from what it greps for, not from this script's status.
process.exit(0);
