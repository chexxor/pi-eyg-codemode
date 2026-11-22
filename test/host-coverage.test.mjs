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
