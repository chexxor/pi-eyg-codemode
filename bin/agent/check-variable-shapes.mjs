#!/usr/bin/env node
// Prove the text this package generates for a kept binding is valid EYG, and that a
// binding written as a module can be read back by the next call's prelude.
//
// What it checks, in order:
//   1. the bindings of one sample program are the ones the tool would keep, and the
//      sample is written so a wrong scan shows up (a `let` inside a function body, a
//      bracket in a comment, a destructuring `let`, a quote, a backslash, a tab and a
//      newline inside a string);
//   2. the write program `variableWriteProgram` builds parses and type-checks
//      (`eyg check`), and running it creates the directory and the modules
//      (`eyg run`, which needs no policy: see what it does not prove below);
//   3. the `variablePrelude` lines plus one call import those modules back and answer
//      what the source computes (`eyg eval`), which is the round trip a later call does.
//
// What it does not prove: that a policy decided the write. The `eyg run` here is
// started with no policy at all, so it performs the writes the program asks for; the
// policy deciding them is a separate fact, and the only way to see it is a call of this
// package's tool under a policy module (`docs/world/entities/pi.variable-scopes.md`
// says which of these was seen how).
//
// The scratch directory is inside this workspace and gitignored; it is removed unless
// `--keep` is passed. Nothing here writes outside it.
//
// Cost: about half a second with the officially installed CLI on PATH.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bindingOrder,
  eygStringLiteral,
  referencedNames,
  topLevelBindings,
  variableDir,
  variableModule,
  variablePrelude,
  variableWriteOutcomes,
  variableWriteProgram,
} from "../../lib/render-helpers.mjs";

const packageDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const keep = process.argv.includes("--keep");
const root = join(packageDir, ".ai-work", "check-variable-shapes");
const variables = variableDir("workspace", { cwd: root });
const cli = process.env.EYG_CHECK_CLI || "eyg";

// One sample program that exercises every part of the scan. The string in `signature`
// carries a quote, a backslash, a tab and a newline, so a literal written by
// `eygStringLiteral` that mangled any of them fails step 3.
const SAMPLE = [
  'let signature = "a\\"b\\\\c\\td\\ne"',
  "let greet = (who) -> {",
  "  // the ( bracket in this comment is not a bracket",
  "  let inner = !string_append(signature, who)",
  "  inner",
  "}",
  "let {unused_left, unused_right} = {unused_left: 1, unused_right: 2}",
  'let greeting = greet("!")',
  "greeting",
].join("\n");

const EXPECTED = "a\"b\\c\td\ne!";

const failures = [];
const say = (ok, line) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};

function run(args) {
  const started = spawnSync(cli, args, { cwd: root, encoding: "utf8", timeout: 20_000 });
  if (started.error !== undefined) return { code: 127, out: String(started.error.message) };
  return {
    code: started.status,
    out: [started.stdout, started.stderr].filter((part) => part !== "" && part !== undefined).join("\n"),
  };
}

const flat = (text) => String(text).replace(/\s+/g, " ").slice(0, 140);

rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const present = run(["--version"]);
if (present.code !== 0) {
  console.log(`FAIL ${cli} is not runnable here: ${flat(present.out)}`);
  process.exit(1);
}

const scanned = topLevelBindings(SAMPLE);
const names = scanned.bindings.map((binding) => binding.name);
say(
  names.join(",") === "signature,greet,greeting",
  `the scan kept ${names.join(", ") || "(nothing)"} and reported the destructuring let as ${scanned.skipped.join(", ") || "(nothing)"}`,
);
say(scanned.problems.length === 0 && scanned.unbalanced === false, "no top-level let in the sample went unrecognised");

const ordered = bindingOrder(
  scanned.bindings.map((binding) => ({
    ...binding,
    references: names
      .filter((name) => name !== binding.name)
      .filter((name) => referencedNames(binding.source, [name]).includes(name)),
  })),
);
say(
  ordered.ordered.map((binding) => binding.name).join(",") === "signature,greet,greeting" && ordered.cyclic.length === 0,
  `the dependency order is ${ordered.ordered.map((binding) => binding.name).join(", ")}, cycles ${ordered.cyclic.length}`,
);
const greet = ordered.ordered.find((binding) => binding.name === "greet");
say(
  greet !== undefined && greet.references.join(",") === "signature",
  `greet names ${greet === undefined ? "(nothing)" : greet.references.join(", ") || "(no other binding)"} as a dependency`,
);

const files = ordered.ordered.map((binding) => ({
  path: join(variables, `${binding.name}.eyg`),
  contents: variableModule(binding),
}));
const program = variableWriteProgram({ dir: variables, files });
const programPath = join(root, "write.eyg");
const readerPath = join(root, "use.eyg");
const prelude = ordered.ordered.map((binding) => variablePrelude({ ...binding, path: join(variables, `${binding.name}.eyg`) }));
const reader = `${prelude.join("\n")}\ngreet("!")\n`;
writeFileSync(programPath, program);
writeFileSync(readerPath, reader);

// Step 2: the generated program is valid EYG, and run it lays down the directory and
// the modules. The program it runs is the one this package generated above, nothing else.
const checked = run(["check", programPath]);
say(checked.code === 0, `the write program type-checks (${flat(checked.out)})`);
const ran = run(["run", programPath]);
const written = files.filter((file) => existsSync(file.path));
say(ran.code === 0 && written.length === files.length, `running it wrote ${written.length} of ${files.length} modules (${flat(ran.out)})`);

// Step 3: the modules read back through the prelude answer what the source computes.
const back = run(["eval", readerPath]);
say(back.code === 0 && back.out.trim() === eygStringLiteral(EXPECTED), `the prelude imports them back and answers ${flat(back.out)} for the call greet("!")`);
const moduleText = existsSync(join(variables, "greet.eyg")) ? readFileSync(join(variables, "greet.eyg"), "utf8") : "";
say(
  moduleText.includes('let {signature} = import "./signature.eyg"') && !/[A-Za-z]:[\\/]|\/home\/|\/Users\/|\/tmp\//.test(moduleText),
  "a written module reaches a sibling of its own scope by relative path, so it carries no machine path",
);
const readerText = readFileSync(readerPath, "utf8");
say(
  readerText.includes(`let {greet} = import ${JSON.stringify(join(variables, "greet.eyg"))}`) &&
    readerText.split("\n").filter((line) => line !== "").length === ordered.ordered.length + 1,
  "the reader program is one prelude line per binding, each importing its module by absolute path, plus the call",
);

// Step 4: a write that does not land. The failure here is the host's - the directory
// above the file does not exist - not a policy's, and no policy ran in this script; what
// it proves is that the write program prints the answer for its path and that the
// outcome built from that output and the directory listing says the binding was kept.
const unreachable = join(root, "no-such-dir", "note.eyg");
const failingFiles = [{ path: unreachable, contents: 'let note = "x"\n{note}\n' }];
const failingProgram = join(root, "write-failing.eyg");
writeFileSync(failingProgram, variableWriteProgram({ dir: root, files: failingFiles }));
const failing = run(["run", failingProgram]);
const outcome = variableWriteOutcomes({
  scope: "workspace",
  keep: [{ name: "note", source: '"x"', references: [] }],
  files: failingFiles,
  output: failing.out,
  present: existsSync(unreachable) ? [unreachable] : [],
  code: failing.code,
  killed: false,
})[0];
say(
  failing.out.includes(`write ${unreachable}: `) && !failing.out.includes(`write ${unreachable}: ok`) && outcome.written === false,
  `a write that does not land is printed with its reason and reported as not kept (${flat(failing.out)})`,
);
say(existsSync(join(root, ".pi", "eyg-variables")) && !existsSync(join(root, ".pi", "functions")), "the kept bindings landed in the scope directory and nowhere else");

if (!keep) rmSync(root, { recursive: true, force: true });
console.log(failures.length === 0 ? "variable shapes: ok" : `variable shapes: ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
