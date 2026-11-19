#!/usr/bin/env node
// world_lint.py's successor: the schema gate. Shape-based only, never similarity
// based - a similarity gate rejects exactly the claims this system exists to
// reconcile (ADR-000, §14 of the design it came from).
//
//   node pi-simple-world-model/bin/world_lint.mjs                 # lint the working tree
//   node pi-simple-world-model/bin/world_lint.mjs --root /path    # lint another repo
//
// Exit 1 with one `file:line: rule: message` line per problem. Exit 0 = clean.

import { lint } from "../lib/world_model.mjs";

const argv = process.argv.slice(2);
const root = argv.includes("--root") ? argv[argv.indexOf("--root") + 1] : (argv.find((a) => a.startsWith("--root=")) ?? "").slice(7) || process.cwd();

const problems = lint(root);
if (problems.length === 0) {
  console.log(`world lint: clean (${root}/docs/world)`);
  process.exit(0);
}
for (const problem of problems) {
  console.log(`${problem.file}:${problem.line}: ${problem.rule}: ${problem.message}`);
}
console.log(`world lint: ${problems.length} problem(s). Fix them before the claim is read by anyone.`);
process.exit(1);
