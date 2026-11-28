#!/usr/bin/env node
// bin/agent/persona-run.mjs - one persona pass, tallied from its own transcript.
//
// A persona pass is a fresh pi session in a scratch project that declares this
// package, given a persona prompt, with `--tools eyg` and no context files. What a
// session says about itself is not evidence: the first pass reported 24 calls in its
// own summary while its transcript holds 32. So the tally here is read from the
// transcript's `tool_execution_start` and `tool_execution_end` rows, never from the
// model's report.
//
//   node bin/agent/persona-run.mjs --persona <persona.md> --project <abs dir> \
//       [--model <name>] [--provider <name>] [--thinking <low|medium|high>] \
//       [--timeout <seconds>] [--out <run.jsonl>]
//   node bin/agent/persona-run.mjs --transcript <run.jsonl>     tally a pass already run
//
// The first form starts the session (pi writes the JSONL to stdout, which this script
// parks in `--out`, default `<project>/run.jsonl`) and then tallies it. The second
// form reads a transcript and prints the same tally, so a pass already on disk can be
// re-counted without spending a session.
//
// Offline: the tally reads a file and runs nothing. Starting a pass spawns `pi` by
// argv - no shell - and only when a persona and a project are named.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// What each eyg call turned out to be, in the order the checks apply. A call is one
// thing: the first row that matches decides the bucket, so a run whose program both
// mis-shaped an ask and hit the cap is counted once, as the mis-shape.
const BUCKETS = [
  ["info action", (text, args) => ["config", "effects", "reference", "list_functions", "describe_function"].includes(args.action)],
  ["parse refusal", (text) => /parsing it answered exit 1|error: unexpected|error: expected/.test(text)],
  ["type mismatch", (text) => /error: type mismatch/.test(text)],
  ["timeout", (text) => /timed out after/.test(text)],
  ["guard refusal", (text) => /refused by policy|denied by policy|the guard refused/.test(text)],
  ["performed", (text) => /\bran in .* wall\b/.test(text) || /\bexit 1 in .* wall\b/.test(text)],
];

function parseJsonl(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      rows.push({ type: "unparseable", text: line.slice(0, 200) });
    }
  }
  return rows;
}

function textOf(result) {
  const parts = result?.content ?? [];
  return parts.map((p) => p.text ?? "").join("\n");
}

function classify(text, args) {
  for (const [name, test] of BUCKETS) {
    if (test(text, args)) return name;
  }
  return "other";
}

function tally(rows) {
  const ends = new Map();
  for (const row of rows) {
    if (row.type === "tool_execution_end") ends.set(row.toolCallId, row);
  }
  const calls = [];
  for (const row of rows) {
    if (row.type !== "tool_execution_start") continue;
    const end = ends.get(row.toolCallId);
    const text = end ? textOf(end.result) : "";
    calls.push({ tool: row.toolName, args: row.args ?? {}, text, bucket: classify(text, row.args ?? {}) });
  }
  const counts = {};
  for (const call of calls) counts[call.bucket] = (counts[call.bucket] ?? 0) + 1;
  return { calls, counts };
}

// The questions a persona pass is run to answer: how often the tool surprised it,
// and what the answer to each surprise looked like.
const FRICTIONS = [
  ["a call that hit the wall", /timed out after/],
  ["a type mismatch sent to the surface file", /the argument an effect wants is its own row/],
  ["a refusal that reads as a crash", /unhandled effect/],
  ["a path outside the roots", /outside|not under any allowed root|denied by policy/],
  ["an eval call that printed nothing", /^eyg eval: ran in .* wall$/m],
  ["a builtin name a model invented", /unknown builtin|builtin undefined/],
];

function printTally({ calls, counts }, transcriptPath) {
  console.log(`transcript: ${transcriptPath}`);
  console.log(`calls: ${calls.length}`);
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name}: ${count}`);
  }
  console.log("friction greps (calls whose answer matches):");
  for (const [name, pattern] of FRICTIONS) {
    const hits = calls.filter((call) => pattern.test(call.text));
    console.log(`  ${name}: ${hits.length}`);
    for (const hit of hits) {
      console.log(`    #${calls.indexOf(hit) + 1} ${hit.bucket} :: ${hit.text.replace(/\s+/g, " ").slice(0, 120)}`);
    }
  }
  console.log("every call, in order:");
  calls.forEach((call, i) => {
    const code = String(call.args.code ?? "").replace(/\s+/g, " ").slice(0, 80);
    console.log(`  #${i + 1} ${call.bucket} action=${call.args.action ?? "run"} :: ${code} :: ${call.text.replace(/\s+/g, " ").slice(0, 120)}`);
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "dry-run") {
      out.dryRun = true;
      continue;
    }
    out[name] = argv[i + 1];
    i += 1;
  }
  return out;
}

function runPass(args) {
  const persona = args.persona;
  const project = args.project;
  if (!persona || !project) {
    console.log("persona-run: --persona <file> and --project <absolute dir>, or --transcript <run.jsonl>");
    process.exit(2);
  }
  if (!project.startsWith("/")) {
    console.log(`persona-run: --project must be absolute: ${project}`);
    process.exit(2);
  }
  const prompt = readFileSync(persona, "utf8");
  const out = args.out ?? join(project, "run.jsonl");
  const argv = ["--print", "--mode", "json", "--approve", "--no-context-files", "--tools", "eyg"];
  if (args.model) argv.push("--model", args.model);
  if (args.provider) argv.push("--provider", args.provider);
  if (args.thinking) argv.push("--thinking", args.thinking);

  if (args.dryRun) {
    console.log(`persona-run: would run pi in ${project} with argv: ${argv.join(" ")} <prompt of ${prompt.length} chars>`);
    console.log(`persona-run: transcript would be written to ${out}`);
    return;
  }

  console.log(`persona-run: starting a pass in ${project}; transcript to ${out}`);
  const child = spawn("pi", [...argv, prompt], { cwd: project });
  const chunks = [];
  const errChunks = [];
  child.stdout.on("data", (c) => chunks.push(c));
  child.stderr.on("data", (c) => errChunks.push(c));
  const cap = Number(args.timeout ?? 900) * 1000;
  const timer = setTimeout(() => {
    console.log(`persona-run: the pass passed ${Number(args.timeout ?? 900)} s; killing it and tallying what it wrote`);
    child.kill();
  }, cap);
  child.on("close", (code) => {
    clearTimeout(timer);
    const text = Buffer.concat(chunks).toString("utf8");
    writeFileSync(out, text);
    if (errChunks.length) writeFileSync(join(project, "run.err"), Buffer.concat(errChunks).toString("utf8"));
    console.log(`persona-run: pi exit ${code}, ${text.length} bytes of transcript`);
    printTally(tally(parseJsonl(text)), out);
  });
}

const args = parseArgs(process.argv.slice(2));
if (args.transcript) {
  printTally(tally(parseJsonl(readFileSync(args.transcript, "utf8"))), args.transcript);
} else {
  runPass(args);
}
