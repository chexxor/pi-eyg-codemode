// The guard must name every effect the surface lists, and every policy field the
// guard reads must be a field every shipped policy returns. This is the coverage
// test that replaces the old "the CLI's rule_mapping has a rule per effect" check:
// the checks live in this package now, so this package proves its own table is
// complete. Offline, no runner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { contextLiteral, entryProgram, ENTRY_FILE, GUARD_FILE, hostProtectedPaths, programModule, PROGRAM_FILE } from "../lib/render-helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const tree = join(here, "..");

const read = (...parts) => readFileSync(join(tree, ...parts), "utf8");

// The effect rows of the surface file: `kind` is `effect`, `name` is the label a
// program performs.
function surface_effects() {
  const rows = read("guides", "eyg-surface.tsv")
    .split("\n")
    .filter((line) => !line.startsWith("#") && line.trim() !== "")
    .slice(1); // the header row is `kind name detail1 detail2`
  return rows
    .map((line) => line.split("\t"))
    .filter((cells) => cells[0] === "effect")
    .map((cells) => cells[1]);
}

// `handle Label(` - the labels the guard installs a clause for. A label it does
// not name is left to the host, so the list is the whole boundary.
function handled_labels(source) {
  return [...source.matchAll(/\bhandle ([A-Za-z][A-Za-z0-9]*)\(/g)].map((m) => m[1]);
}

// `policy.field` - the fields the guard asks a policy for.
function guard_fields(source) {
  return [...source.matchAll(/\bpolicy\.([a-z_]+)/g)].map((m) => m[1]);
}

// The keys of the record a policy module's `rules` function returns, by walking the
// braces from `let rules = (ctx) -> {` to the expression that closes the module.
function policy_rule_fields(source) {
  const start = source.indexOf("let rules = (ctx) -> {");
  assert.ok(start >= 0, "the policy module exports no `rules` function");
  let depth = 0;
  let i = source.indexOf("{", start);
  const body_start = i;
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = source.slice(body_start, i);
  return [...body.matchAll(/^ {4}([a-z_]+):/gm)].map((m) => m[1]);
}

const sorted = (items) => [...new Set(items)].sort();

// Only the code counts: the prose above a rule names the very words this file is
// looking for.
const code_only = (source) => {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
};

test("the guard names every effect in the surface file", () => {
  const guard = code_only(read("host", "guard.eyg"));
  assert.deepEqual(sorted(handled_labels(guard)), sorted(surface_effects()));
});

test("every shipped policy returns a rule for every field the guard reads", () => {
  const fields = sorted(guard_fields(code_only(read("host", "guard.eyg"))));
  for (const name of ["agent-roots.eyg", "deny-all.eyg", "spawner-effects.eyg"]) {
    assert.deepEqual(sorted(policy_rule_fields(code_only(read("policies", name)))), fields, name);
  }
});

test("no shipped policy reads the environment or imports outside the package", () => {
  for (const name of ["agent-roots.eyg", "deny-all.eyg", "spawner-effects.eyg"]) {
    const code = code_only(read("policies", name));
    // A policy module is evaluated before the guard is installed, so an effect at
    // its top level is refused outright; it must ask for nothing.
    assert.equal(/\bperform\b/.test(code), false, `${name} performs an effect`);
    assert.equal(/\bimport\b/.test(code), false, `${name} imports a module`);
  }
});

// The other half of the boundary: what the tool writes and spawns for one call. The
// guard only decides a program that runs inside it, so the entry and the argv are part
// of the contract, and they are pinned here rather than only in the TypeScript.
test("one call is three files and one argv, with the guard around the program", () => {
  const tool = read("extensions", "eyg-codemode.ts");
  assert.equal((tool.match(/pi\.exec\(runner, \[mode, entryPath\]/g) ?? []).length, 1, "one place spawns the eyg binary");
  assert.equal((tool.match(/runGuarded\(pi, \{/g) ?? []).length, 2, "a call and an allowlist probe both go through the guard");
  assert.equal(/pi\.exec\([^)]*"--/.test(tool), false, "no flag appears in an argv the tool builds");
  for (const file of [GUARD_FILE, PROGRAM_FILE, ENTRY_FILE]) {
    assert.ok(tool.includes(file), `the tool names ${file} as one of the files a call is made of`);
  }
  // A spawner's effect allowlist reaches the policy as a ctx value, not as an
  // environment variable the policy reads for itself.
  assert.ok(tool.includes("spawnerEffects(process.env, chain.depth)"), "the fields a spawner named travel in ctx");

  const entry = entryProgram({
    guard: "/pkg/host/guard.eyg",
    policy: "/pkg/policies/agent-roots.eyg",
    ctx: contextLiteral({ roots: ["/work a"], cwd: "/work", fields: ["read_file"], protected: hostProtectedPaths({ packageDir: "/pkg", policyPath: "/pkg/policies/agent-roots.eyg" }) }),
    program: "/tmp/call-1/program.eyg",
  });
  assert.ok(entry.indexOf("let guard = import") < entry.indexOf("let policy = import"), "the guard is imported first");
  assert.ok(
    entry.indexOf("guard.build(policy.rules(ctx), ctx, (_) -> {") < entry.indexOf('let program = import "/tmp/call-1/program.eyg"'),
    "the program is imported inside the guarded body, never outside it",
  );
  assert.ok(entry.trimEnd().endsWith("})"), "the body calls the program and closes the guard");
  assert.ok(
    entry.includes('{roots: ["/work a"], cwd: "/work", fields: ["read_file"], protected: ["/pkg/host", "/pkg/policies"]}'),
    "ctx reaches the policy as a literal, with the paths the guard refuses to change",
  );
  assert.equal(entry.includes("--"), false, "the entry passes no flag to anything");
  assert.equal(entry.includes("perform"), false, "the entry itself performs no effect");

  const source = 'let answer = !int_add(1, 2)\nanswer';
  const wrapped = programModule(source);
  assert.ok(wrapped.includes(source), "the program text travels verbatim");
  assert.ok(wrapped.startsWith("let run = (_) -> {") && wrapped.endsWith("{run}\n"), "one exported `run` function carries it");
});

// The files that decide a call are inside the roots of a session run in this package, so
// the call must not be able to change them. The list is the tool's to name and the guard's
// to enforce: a policy cannot open them, because the guard checks before any rule runs.
test("a call cannot change the files that decide it", () => {
  assert.deepEqual(
    hostProtectedPaths({ packageDir: "/pkg", policyPath: "/pkg/policies/agent-roots.eyg" }),
    ["/pkg/host", "/pkg/policies"],
    "the package's own guard directory and policy directory, and nothing else",
  );
  assert.deepEqual(
    hostProtectedPaths({ packageDir: "/pkg", policyPath: "/operator/strict.eyg" }),
    ["/pkg/host", "/pkg/policies", "/operator/strict.eyg"],
    "a policy of the operator's own outside the package is protected by name, not by its directory",
  );
  assert.deepEqual(hostProtectedPaths({}), [], "with no package and no policy there is nothing to name");

  const guard = read(GUARD_FILE);
  for (const effect of ["write_file", "append_file", "delete_file", "make_directory"]) {
    assert.ok(guard.includes(`shield("${effect}", ctx, path,`), `the guard shields ${effect} itself, before the rule`);
  }
  assert.equal(guard.includes('shield("read_file"'), false, "a read is not shielded: a program reads the rules it runs under");

  const tool = read("extensions", "eyg-codemode.ts");
  assert.equal((tool.match(/protected: hostProtectedPaths\(\{ packageDir: dir, policyPath:/g) ?? []).length, 2, "a call and an allowlist probe both hand the guard the protected paths");
});

// One host per call, checked before the call: the tool asks the binary what the program
// handles for itself and refuses the call when the answer is not empty.
test("a call parses its program before it runs it", () => {
  const tool = read("extensions", "eyg-codemode.ts");
  assert.ok(tool.includes("pi.exec(runner, parseArguments(code)"), "the parse question is asked through argv, like the run");
  assert.ok(
    tool.indexOf("parseArguments(code)") < tool.indexOf("await spawn(mode, code, timeout)"),
    "the program is parsed before anything of it runs",
  );
  assert.equal((tool.match(/pi\.exec\(runner,/g) ?? []).length, 2, "a call starts the binary twice: the parse and the guarded run");
  assert.equal(/parseArguments\([^)]*--/.test(tool), false, "the parse argv carries no flag");
});
