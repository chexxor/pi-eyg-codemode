#!/usr/bin/env node
// Walk the function-registry scopes and print what a call would be offered.
//
// The scope order is the tool's: `registryScopes` in `extensions/eyg-codemode.ts`
// (workspace = <cwd>/.pi/eyg-functions, then home = $HOME/.pi/eyg-functions, then
// package = <pkg>/libraries), `scopeFiles` lists each one's `.eyg` modules, and
// `buildRegistry` in `lib/render-helpers.mjs` reads them, first name wins, a later
// module of the same name is reported as shadowed. This script reads; it writes
// nothing, so you can point it at a scratch directory tree instead of at a real
// workspace and see the answer without starting a session.
//
//   node bin/agent/registry-walk.mjs                      # this workspace, this HOME
//   node bin/agent/registry-walk.mjs --cwd /tmp/probe-root --home /tmp/probe-home
//   node bin/agent/registry-walk.mjs --no-package         # skip <pkg>/libraries
import { buildRegistry, registryScopeLegend, scopeOwner } from "../../lib/render-helpers.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
};

const packageDir = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");
const cwd = flag("cwd", process.cwd());
const home = flag("home", process.env.HOME);
const withPackage = !argv.includes("--no-package");

const scopes = [];
scopes.push(join(cwd, ".pi", "eyg-functions"));
if (home && home !== "") scopes.push(join(home, ".pi", "eyg-functions"));
if (withPackage) scopes.push(join(packageDir, "libraries"));
const names = ["workspace", "home", "package"];

const listed = scopes.map((dir, i) => ({ name: names[i], dir })).filter((scope) => existsSync(scope.dir));
const files = (dir) => {
  try {
    return readdirSync(dir).filter((file) => file.endsWith(".eyg")).sort().map((file) => join(dir, file));
  } catch {
    return [];
  };
};
const scopeFiles = listed.map((scope) => ({ name: scope.name, dir: scope.dir, files: files(scope.dir) }));
const registry = buildRegistry(scopeFiles, (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
});

for (const line of registryScopeLegend()) {
  console.log(`legend: ${line}`);
}
for (const scope of scopeFiles) {
  console.log(`scope ${scope.name}: ${scope.dir} (${scope.files.length} module(s))`);
}
for (const entry of registry.entries) {
  console.log(`entry ${entry.name} [${entry.scope}] ${scopeOwner(entry.scope)} ${entry.path} ${entry.signature} - ${entry.description}`);
}
for (const error of registry.errors) {
  console.log(`shadow: ${error}`);
}
