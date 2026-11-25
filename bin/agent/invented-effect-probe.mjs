#!/usr/bin/env node
// bin/agent/invented-effect-probe.mjs - can a program invent an effect, host it, and reach a command line?
//
// The question this answers is the one a reader asks first: the tool runs EYG, EYG lets a program
// name an effect and install a handler for it, so what stops a program from naming `Bash`, hosting
// it, and running whatever it wants on the host? Four walls, each a run of a file under
// `test/fixtures/`, and one wall that shows the invented ask reaching this package's guard:
//
//   1 check     the effect set is closed before a run: `eyg check` refuses the text with
//               `missing row 'Bash'`, exit non-zero.
//   2 run       a label with no host stops the run: `eyg run` of the same text answers
//               `unhandled effect Bash({command: "id"})` and the program never executes.
//   3 clause    a program CAN install its own handler for the invented label - the parse accepts
//               it, so `bin/agent/handler-scan.mjs` prints `Bash` - the clause is real, not refused.
//   4 decline   that clause can only decline: the only ask of `Bash` the program can make is its
//               own re-perform inside the clause, which has no host either, so the run stops
//               there and nothing is printed - the branch that would report a performed command
//               is never reached.
//   5 guarded   inside a real call the invented ask walks the guard's own handler chain
//               (`host/guard.eyg`, one clause per effect row of `guides/eyg-surface.tsv`) and
//               stops with the same `unhandled effect`: no rule is skipped, because no rule is
//               named for a label that does not exist.
//
// Each wall prints its answer and its wall time; the exit is 0 only while all five answers are
// what this file expects. A language release that added a `Bash` row would turn wall 1 red here
// first, which is the point of running it.
//
//   node bin/agent/invented-effect-probe.mjs
//
// Offline: it starts the installed CLI on four fixture files and this package's own probe script,
// and writes nothing.

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");
const fixture = (name) => join(packageDir, "test", "fixtures", name);

// Run one command, capture both streams and its exit code; a non-zero exit is an answer here.
// Both streams are piped, never inherited: `eyg check` answers on stdout and `eyg run` on stderr,
// so a wall that reads only one of them reads nothing. `maxBuffer` is raised because the run of
// `test/fixtures/invented-effect-handler.eyg` prints the parsed closure it could not host, which
// is a 60 KB answer.
function run(argv) {
  const started = Date.now();
  const options = { encoding: "utf8", cwd: packageDir, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 };
  try {
    const stdout = execFileSync(argv[0], argv.slice(1), options);
    return { code: 0, stdout, stderr: "", ms: Date.now() - started };
  } catch (error) {
    return {
      code: typeof error.status === "number" ? error.status : 1,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : String(error.message),
      ms: Date.now() - started,
    };
  }
}

const text = (result) => `${result.stdout}${result.stderr}`;
const firstLine = (value) => (value.split("\n").find((line) => line.trim() !== "") ?? "").trim();

const rows = [];
let failed = 0;
function wall(name, argv, expect, check) {
  const result = run(argv);
  const answer = firstLine(text(result));
  const ok = check(result, expect);
  if (!ok) failed += 1;
  rows.push({ name, answer, exit: result.code, ms: result.ms, ok });
}

// 1. The effect set is closed at check time.
wall(
  "check",
  ["eyg", "check", fixture("invented-effect.eyg")],
  "missing row 'Bash'",
  (r, want) => r.code !== 0 && text(r).includes(want),
);

// 2. A label with no host stops the run.
wall(
  "run",
  ["eyg", "run", fixture("invented-effect.eyg")],
  "unhandled effect Bash({command: \"id\"})",
  (r, want) => r.code !== 0 && text(r).includes(want) && r.stdout === "",
);

// 3. A program can install its own handler for that label: the parse names it.
wall(
  "clause",
  [process.execPath, "bin/agent/handler-scan.mjs", fixture("invented-effect-handler.eyg")],
  "Bash",
  (r, want) => r.code === 0 && r.stdout.split("\n").map((l) => l.trim()).includes(want),
);

// 4. The clause can only decline: its own re-perform has no host, and nothing is printed.
wall(
  "decline",
  ["eyg", "run", fixture("invented-effect-handler.eyg")],
  "unhandled effect Bash({command: \"id\"})",
  (r, want) => r.code !== 0 && text(r).includes(want) && r.stdout === "",
);

// 5. Inside a call the ask walks the guard's clauses and stops there.
wall(
  "guarded",
  [process.execPath, "bin/agent/refusal-probe.mjs", "--program", fixture("invented-effect.eyg")],
  "unhandled effect Bash",
  (r, want) => text(r).includes(want) && text(r).includes("host/guard.eyg") && !r.stdout.includes("the host ran a command"),
);

for (const row of rows) {
  console.log(
    `${row.ok ? "holds" : "DRIFT"}  ${row.name.padEnd(8)}  exit ${String(row.exit).padEnd(2)}  ${(row.ms / 1000).toFixed(2)} s  ${row.answer.slice(0, 90)}`,
  );
}

// The fourth wall's proof is that its handler never answered: the fixture's Ok branch prints, so
// an empty stdout is the answer.
const handler = run(["eyg", "run", fixture("invented-effect-handler.eyg")]);
console.log(`stdout bytes from the invented handler: ${Buffer.byteLength(handler.stdout)}`);

if (failed > 0) {
  console.log(`${failed} of ${rows.length} walls drifted from the answer this file expects`);
  process.exitCode = 1;
} else {
  console.log(`all ${rows.length} walls hold: an invented effect names nothing the host performs`);
}
