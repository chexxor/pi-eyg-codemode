#!/usr/bin/env node
// Which effects a program handles for itself, read out of the syntax tree the binary parses.
//
// The `eyg` tool asks this question of every program it is about to run and refuses the call
// when the answer is not empty: a call has one host for its effects, the guard, so a `handle`
// clause in the program a call passes in is refused before anything runs
// (`extensions/eyg-codemode.ts`, boundary fact 7 of `docs/world/entities/host.guard-boundary.md`).
// This script is the same two steps - parse, walk - for a human or a check to run on a file.
//
//   node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg   # prints ReadFile
//   node bin/agent/handler-scan.mjs test/fixtures/refusal-probe.eyg   # prints nothing
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { handledEffectLabels, parseArguments } from "../../lib/render-helpers.mjs";

const file = process.argv[2];
if (file === undefined) {
  console.error("usage: node bin/agent/handler-scan.mjs <file.eyg>");
  process.exit(2);
}
const tree = JSON.parse(execFileSync("eyg", parseArguments(readFileSync(file, "utf8")), { encoding: "utf8" }));
for (const label of handledEffectLabels(tree)) console.log(label);
