#!/usr/bin/env node
// Start a scratch project that loads this package, so a first session can be
// tried somewhere that is not this workspace.
//
// What a project needs is one file: `.pi/settings.json` whose `packages` array
// declares this package by absolute path (pi identifies a local package by its
// resolved absolute path, so the declaration resolves rather than copies), and
// whose `extensions` array drops pi's built-in coding tool so that the session
// has exactly one coding tool - this package's `eyg`. Everything else is
// pi's default.
//
//   node bin/agent/new-project.mjs /tmp/try-eyg
//   node bin/agent/new-project.mjs /tmp/try-eyg --package /abs/path/to/the/package
//
// The script writes that one file (and the directory that holds it) and prints
// the paths it wrote plus the command that starts a session in the project. It
// refuses to overwrite a `.pi/settings.json` that already exists, because the
// file that exists is a project someone already configured.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
  console.log("usage: node bin/agent/new-project.mjs <absolute project directory> [--package <absolute package path>]");
  process.exit(argv.length === 0 ? 1 : 0);
}

const project = argv[0];
if (!project.startsWith("/")) {
  console.log(`new-project: the project directory must be absolute: ${project}`);
  process.exit(1);
}
const at = argv.indexOf("--package");
const pkg = at === -1 ? fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "") : argv[at + 1];
if (!pkg.startsWith("/")) {
  console.log(`new-project: --package must be absolute: ${pkg}`);
  process.exit(1);
}

const settingsPath = join(project, ".pi", "settings.json");
if (existsSync(settingsPath)) {
  console.log(`new-project: ${settingsPath} exists, so this is a project someone already configured; nothing written`);
  process.exit(1);
}
if (!existsSync(join(pkg, "package.json"))) {
  console.log(`new-project: no package.json under ${pkg}, so there is nothing to declare there`);
  process.exit(1);
}

const settings = {
  packages: [pkg],
  extensions: ["-builtin:codemode"],
};
mkdirSync(join(project, ".pi"), { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

console.log(`project: ${project}`);
console.log(`wrote: ${settingsPath}`);
console.log(`declares: ${readFileSync(settingsPath, "utf8").trim()}`);
console.log(`check it resolves: cd ${project} && pi list --approve  # names ${pkg} as a project package`);
console.log(`start a session: cd ${project} && pi --print --tools eyg --model <the model your server serves>`);
console.log(
  "\nTwo things the printout does not do for you. pi reads a project's `.pi` files only after" +
  " project trust, so a project on a directory that is not trusted yet answers `pi list` with no" +
  " `Project packages:` section at all - name `--approve` (or let a session ask for trust) until the" +
  " project is trusted. And" +
  " a project that declares no package loads no `eyg` tool, so `pi --print --tools eyg` in " +
  "a directory with no `.pi/settings.json` answers with no such tool: the declaration above is " +
  "the whole difference between that and a session that can call it."
);
