#!/usr/bin/env node
// world_map.mjs - generate the tier-0 index; never hand-written.
//
//   node pi-simple-world-model/bin/world_map.mjs              # rewrite the generated region
//   node pi-simple-world-model/bin/world_map.mjs --check      # exit 1 if it is stale
//   node pi-simple-world-model/bin/world_map.mjs --print      # print it, write nothing
//   node pi-simple-world-model/bin/world_map.mjs --init       # create docs/world/ for a new repo
//
// Hand-written sections of 00-map.md outside the markers are preserved.

import fs from "node:fs";
import path from "node:path";
import { generateMap, writeMap, scaffold, MARKERS } from "../lib/world_model.mjs";

const argv = process.argv.slice(2);
const root = argv.includes("--root") ? argv[argv.indexOf("--root") + 1] : (argv.find((a) => a.startsWith("--root=")) ?? "").slice(7) || process.cwd();

if (argv.includes("--init")) {
  const created = scaffold(root);
  console.log(created.length ? `created: ${created.join(", ")}` : "docs/world/ already exists; nothing created");
  console.log("fill roster.yaml before the lint will accept a page owner.");
  process.exit(0);
}

const mapFile = path.join(root, "docs", "world", "00-map.md");
if (!fs.existsSync(mapFile)) {
  console.error("error: docs/world/00-map.md does not exist. Run with --init to create the model.");
  process.exit(2);
}

if (argv.includes("--print")) {
  const text = fs.readFileSync(mapFile, "utf8");
  const start = text.indexOf(MARKERS.open);
  const end = text.indexOf(MARKERS.close);
  console.log(start === -1 ? "" : text.slice(start, end + MARKERS.close.length));
  process.exit(0);
}

if (argv.includes("--check")) {
  const generated = generateMap(root);
  const text = fs.readFileSync(mapFile, "utf8");
  const start = text.indexOf(MARKERS.open);
  const end = text.indexOf(MARKERS.close);
  if (start === -1 || end === -1) {
    console.error("error: 00-map.md has no generated region between the markers.");
    process.exit(1);
  }
  if (text.slice(start, end + MARKERS.close.length) === generated) {
    console.log("world map: current.");
    process.exit(0);
  }
  console.error("error: the generated region is stale. Run `npm run world:map` (no --check) to rewrite it, then commit.");
  process.exit(1);
}

const result = writeMap(root);
console.log(result.changed ? "world map: regenerated." : `world map: ${result.reason}`);
process.exit(result.changed ? 0 : 0);
