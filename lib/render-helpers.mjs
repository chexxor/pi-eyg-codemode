/**
 * Pure helpers shared by the `eyg` codemode tool and its tests.
 *
 * Plain JavaScript rather than TypeScript so that `node --test pi-eyg-codemode/test/`
 * can import exactly what `extensions/eyg-codemode.ts` imports - one definition, so a
 * test cannot drift from what the tool does. Nothing here touches the file system or
 * a process: the tool does that work, these functions only shape text.
 */

import { basename, join } from "node:path";

/// The effects a program can perform and the policy field this package decides each one
/// under. The labels come from the runtime: the recorded `rule_mapping` snapshot in
/// `test/fixtures/rule_mapping.gleam` (where to re-capture it from:
/// `test/fixtures/rule_mapping.PROVENANCE.md`) names the 23 of them, and `null` here is that
/// effect's `policy.Unchecked` entry - it computes over values it was given, so no policy
/// field decides it. The field names are this package's own: `host/guard.eyg` reads
/// `policy.<field>` for each effect it names, and `test/host-coverage.test.mjs` proves the
/// two agree. `Search` has a field of its own (`search`): the installed CLI performs no
/// `Search`, so the guard is the host for that walk and one rule decides its root while the
/// `read_directory` rule decides each directory it lists.
export const POLICY_FIELDS = {
  AppendFile: "append_file",
  CreateKey: "create_key",
  CWD: "cwd",
  DecodeJSON: null,
  DeleteFile: "delete_file",
  Env: "env",
  Exit: "exit",
  EYGParse: null,
  Fetch: "fetch",
  Flip: "flip",
  Hash: null,
  MakeDirectory: "make_directory",
  Now: "now",
  Random: "random",
  ReadDirectory: "read_directory",
  ReadFile: "read_file",
  Search: "search",
  Sign: null,
  Sleep: "sleep",
  StandardError: "standard_error",
  StandardIn: "standard_in",
  StandardOut: "standard_out",
  WriteFile: "write_file",
};

/// Effects the availability probe never attempts, with the reason:
/// `Exit` would end the probe process, `StandardIn` would swallow the runner's
/// stdin, `Env` reads the caller's environment. A refusal of `CWD`, `Sleep`,
/// `StandardOut` or `StandardError` is answered with the same value a pass is
/// (`{}`, or an error with no text), so no probe of them could tell the two
/// apart. Their availability is reported as `unknown` rather than guessed.
export const UNPROBED_EFFECTS = {
  Env: "reading the environment is not probed",
  Exit: "the probe process would stop",
  StandardIn: "the probe has no standard input",
  CWD: "a refusal is answered with the same value a pass is",
  Sleep: "a refusal is answered with the same value a pass is",
  StandardOut: "a refusal is answered with the same value a pass is",
  StandardError: "a refusal is answered with the same value a pass is",
};

/// Effects whose probe needs no path: they compute, or talk to a host
/// that can never resolve (`Fetch` names a host under the reserved TLD
/// `.invalid`).
export const NO_PATH_PROBE_ARGUMENTS = {
  Now: "{}",
  Random: "{}",
  Flip: "{}",
  StandardOut: '""',
  StandardError: '""',
  Fetch:
    '{method: GET({}), scheme: HTTP({}), host: "eyg-codemode-probe.invalid", ' +
    'port: None({}), path: "", query: None({}), headers: [], body: !string_to_binary("")}',
  DecodeJSON: '!string_to_binary("{}")',
  EYGParse: '!string_to_binary("")',
  Hash: '{algorithm: SHA256({}), bytes: !string_to_binary("")}',
  CreateKey: "Eddsa({})",
  Sign: '{key: {}, data: !string_to_binary("")}',
};

/// EYG arguments for one availability probe, chosen so the effect fails at the
/// host BEFORE it could change anything, and so that under the roots this tool
/// advertises the policy *does* answer the effect - which is the question the
/// listing answers: can the session perform it, not can it perform it at an
/// impossible path.
///
/// Path probes are written against the first root the tool advertises
/// (`EYG_ALLOWED_ROOTS`, otherwise the session working directory):
///   * a read, a search or a delete names `<root>/.eyg-codemode-probe`, a path
///     that does not exist, so the host errors without touching anything;
///   * a write names `<root>` itself, a directory, so opening it to write errors;
///   * `MakeDirectory` names `<root>`, which already exists, so it succeeds and
///     creates nothing.
/// With no root, the same shapes fall back to `/dev/null`, a character device
/// that is never a directory, so nothing under it can exist - unix, which is
/// where the officially installed CLI runs.
export function probeArguments(effect, root) {
  const constant = NO_PATH_PROBE_ARGUMENTS[effect];
  if (constant !== undefined) {
    return constant;
  }
  const missing = JSON.stringify(`${root || "/dev/null"}/.eyg-codemode-probe`);
  const target = JSON.stringify(root || "/dev/null");
  switch (effect) {
    case "ReadFile":
      return `{path: ${missing}, offset: 0, limit: 0}`;
    case "ReadDirectory":
      return missing;
    case "Search":
      return `{path: ${missing}, pattern: "*", limit: 0}`;
    case "WriteFile":
    case "AppendFile":
      return `{path: ${target}, contents: !string_to_binary("")}`;
    case "DeleteFile":
      return missing;
    case "MakeDirectory":
      return target;
    default:
      return undefined;
  }
}

/// The effects whose guard handler answers a refusal with `Error(reason)`: the
/// refusal is the reply's `Error` branch, so it is only visible to a probe that
/// looks at the reply. `run` prints no value, so a probe that only performs the
/// effect - the shape that worked when the CLI's own policy answered - prints
/// nothing and the refusal reads as a pass.
export const ERROR_BRANCH_PROBE_EFFECTS = [
  "AppendFile",
  "CreateKey",
  "DeleteFile",
  "Fetch",
  "MakeDirectory",
  "ReadDirectory",
  "ReadFile",
  "Search",
  "WriteFile",
];

/// One effect as a whole program, in the shape that makes a policy refusal
/// visible in the output the tool classifies. For an effect answered with
/// `Error(reason)` the probe binds the reply and aborts with it, so the reason -
/// which carries `<field> denied by policy` - reaches the runner's error output
/// whatever the `standard_out` rule says; the host's own failure text reaches the
/// same place and is not the marker, so it still counts as a pass. For the rest
/// the effect is the last expression: a refusal there is an `Abort` the runtime
/// prints itself.
///
/// `null` means no probe is defined, which the tool reports as `unknown` rather
/// than guessing.
export function probeProgram(effect, root) {
  if (UNPROBED_EFFECTS[effect] !== undefined) return null;
  const argument = probeArguments(effect, root);
  if (argument === undefined) return null;
  if (!ERROR_BRANCH_PROBE_EFFECTS.includes(effect)) return `perform ${effect}(${argument})`;
  return [
    `let probe_reply = perform ${effect}(${argument})`,
    "match probe_reply {",
    "  Error(why) -> { !never(perform Abort(why)) }",
    "  Ok(_) -> { {} }",
    "}",
  ].join("\n");
}

/// A probe's output answers one question: was the effect refused? A refusal
/// carries the marker `denied by policy` (verified against a run of a path
/// outside the roots on 2026-11-16); a runtime that does not implement the
/// effect says `unhandled effect`. Anything else - a host error such as
/// `No such file or directory`, or the printed value of a safe effect - means
/// the policy let the effect through, which is what "available" means here.
export function classifyProbeOutput(output) {
  if (/denied by policy/.test(output)) {
    return "refused";
  }
  if (/unhandled effect/.test(output)) {
    return "unavailable";
  }
  return "available";
}

/// One row of `action: effects`: the effect, the policy field it is decided under
/// (`none` when the CLI marks it unchecked), and what the probe answered. One row
/// per name in `POLICY_FIELDS`, so the effect surface the tool advertises is the
/// one the CLI decides - the test in `test/render-helpers.test.mjs` compares this
/// record against the recorded `rule_mapping` snapshot in `test/fixtures/rule_mapping.gleam`,
/// and against the live runtime source when `EYG_RULE_SOURCE` names one.
export function effectLine(name, field, verdict) {
  return `${name} | ${field === null ? "none" : field} | ${verdict}`;
}

/// The one machine-readable surface this package ships: one row per builtin the language
/// reference lists, one row per effect the CLI names. It is generated and drift-checked, not
/// copied: `bin/agent/gen-surface.mjs` writes it and `--check` re-derives it. The tool names
/// it in its rows because a session that reaches the world only through effects cannot read
/// it with `ReadFile` unless the roots cover this package - and pi's own `read` tool, which
/// no policy decides, is the other half of that sentence.
export const SURFACE_FILE = "guides/eyg-surface.tsv";
export const LANGUAGE_DOCS = "https://eyg.run/guides";
export const GENERATED_MARK = "bin/agent/gen-surface.mjs";

/// The builtins of the language's builtins page, as rows: the `##` section it sits under,
/// its name, and the rest of its table row (signature then notes). Only the capture uses
/// this - `bin/agent/gen-surface.mjs --builtins <the page as markdown>` - because the
/// surface this package ships afterwards is `SURFACE_FILE`, not the page. The scan reads
/// only the first cell, because a signature may contain `|` - `(a, a) -> True({}) | False`
/// - and a cell split on `|` would cut it in half. A row that does not start with a `!name`
/// in backticks is a header, a separator or prose, and is skipped.
export function builtinRows(markdown) {
  const rows = [];
  let section = "";
  for (const line of String(markdown ?? "").split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      section = heading[1];
      continue;
    }
    const row = /^\|\s*`(![A-Za-z0-9_]+)`\s*\|(.*)$/.exec(line);
    if (row === null) continue;
    rows.push({ section, name: row[1], signature: row[2].replace(/(\s*\|)+\s*$/, "").replace(/\s+/g, " ").trim() });
  }
  return rows;
}

/// The rows of `SURFACE_FILE`: `kind` (builtin or effect), `name`, and the two detail
/// columns - for a builtin its section and its signature, for an effect its policy field
/// (or `none`) and its note. `#` lines are its header and are not rows.
export function surfaceRows(text) {
  const rows = [];
  for (const line of String(text ?? "").split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const cells = line.split("\t");
    if (cells.length < 2) continue;
    // The file's own column line names its columns for a human reader; it is not a row.
    if (!["builtin", "effect"].includes(cells[0])) continue;
    rows.push({ kind: cells[0], name: cells[1], detail1: cells[2] ?? "", detail2: cells[3] ?? "" });
  }
  return rows;
}

/// One effect row of the surface file as the tool prints it: the name, and the policy field
/// that decides it or `none` when no policy can forbid it. Unlike `action: effects` this
/// asks the policy nothing - it reports the shape of the surface, which is the same whatever
/// a policy then decides inside it.
export function effectRowLine(row) {
  return `  ${row.name} | ${row.detail1 === "none" ? "none (no policy can forbid it)" : `policy field \`${row.detail1}\`${row.detail2 === "" ? "" : `: ${row.detail2}`}`}`;
}

/// Where the effect half of the surface comes from, and how it is kept true. Printed in full,
/// because the claim that a generated file is current is only worth its re-check command.
export function surfaceFileLines() {
  return [
    `  generated by ${GENERATED_MARK} - node ${GENERATED_MARK} --check re-derives it from test/fixtures/rule_mapping.gleam and POLICY_FIELDS, and fails on drift`,
  ];
}

/// What `action: "reference"` answers: the builtins the surface file lists, the effect
/// surface with the field that decides each effect, the policy in force, and where the
/// prose lives now that this package copies none of it. It performs no effect, spawns no
/// process and asks the policy nothing, so it answers on a machine with no runner as well
/// as one with one.
export function referenceLines(surfaceText, { policy = null, policySource = null } = {}) {
  const rows = surfaceRows(surfaceText);
  const builtins = rows.filter((row) => row.kind === "builtin");
  const effects = rows.filter((row) => row.kind === "effect");
  const lines = [`builtins: ${builtins.length}, read from ${SURFACE_FILE} (a capture of the language's page; the compiler is the source under it)`];
  let section = null;
  for (const row of builtins) {
    if (row.detail1 !== section) {
      section = row.detail1;
      lines.push(`  ## ${section}`);
    }
    lines.push(`  ${row.name} ${row.detail2}`);
  }
  lines.push(`effects: ${effects.length} the CLI names, each with the policy field that decides it, from ${SURFACE_FILE}`);
  lines.push(...effects.map(effectRowLine));
  lines.push(...surfaceFileLines());
  if (policy !== null) {
    lines.push(`policy in force: ${policy}${policySource === null ? "" : ` (${policySource})`} - what it decides effect by effect is action "effects"`);
  }
  lines.push(`prose: syntax, effects and installation are at <${LANGUAGE_DOCS}>; this package copies none of it. pi's own read tool is not decided by a policy; ReadFile is decided by the policy and reaches only the roots.`);
  return lines;
}

/// The builtins a run named that the runtime does not have, as the runner printed them
/// (`error: builtin undefined: !str_len`), deduplicated and each prefixed with `!`.
export function builtinErrors(output) {
  const names = [];
  for (const match of String(output ?? "").matchAll(/builtin undefined:\s*!?([A-Za-z0-9_]+)/g)) {
    const entry = `!${match[1]}`;
    if (!names.includes(entry)) names.push(entry);
  }
  return names;
}

/// The rows a failed run adds when it named a builtin that does not exist. The runner's
/// own hint says only "check the builtin name against the builtins reference" and names
/// no path, which a session that cannot read files cannot act on; these rows name the
/// surface file, name the action that prints the list without leaving the tool, and say
/// that pi's `read` tool is not decided by a policy - the fact a session has to guess at otherwise.
export function builtinHintRows(names) {
  if (!Array.isArray(names) || names.length === 0) return [];
  return [
    [{ tone: "warning", text: `no such builtin: ${names.join(", ")}` }],
    [{ tone: "warning", text: `every builtin is listed in ${SURFACE_FILE} - action "reference" prints the list without leaving this tool` }],
    [{ tone: "muted", text: `invented syntax is the other failure: read ${SURFACE_FILE} for the names, and <${LANGUAGE_DOCS}> for the prose. pi's own read tool is not decided by a policy, while ReadFile reaches only the roots` }],
  ];
}

/// The files a call is made of, under one directory the tool writes for that call: the
/// guard (shipped in this package), the program and the entry, written fresh for every
/// call, so the model's text reaches the guard only as a module the entry imports. The
/// record is the fourth and is not written before the run: the entry writes it as its own
/// last line, from the refusals the guard answered, which is what makes a refusal the
/// program bound to `_` and never printed still reach the tool.
export const GUARD_FILE = "host/guard.eyg";
export const PROGRAM_FILE = "program.eyg";
export const ENTRY_FILE = "entry.eyg";
export const RECORD_FILE = "refusals.txt";

/// The paths that decide a call, and so must not be files the call can change: this
/// package's `host/` (the guard every entry imports) and `policies/` (the policy modules
/// this package ships), plus the
/// policy module resolved for this call when it lives outside the package. A session whose
/// roots are this package has these paths inside its roots, so the check cannot live in a
/// policy - the thing being protected cannot decide its own protection - and the tool hands
/// the list to the guard, which refuses the four change effects under it before any rule
/// runs. `host/guard.eyg` holds the check; `notes/guard-self-protection.md` why.
export function hostProtectedPaths({ packageDir = null, policyPath = null }) {
  const dirs = [];
  if (typeof packageDir === "string" && packageDir !== "") {
    dirs.push(join(packageDir, "host"), join(packageDir, "policies"));
  }
  const paths = [...dirs];
  if (typeof policyPath === "string" && policyPath !== "" && !dirs.some((dir) => policyPath.startsWith(`${dir}/`))) {
    paths.push(policyPath);
  }
  return paths;
}

/// The record the guard and the policy module read for one call, as EYG source text:
/// `roots` (absolute paths the policy lets file effects through), `cwd` (the directory the
/// program runs in), `fields` (the effect fields a spawner named for this session, empty
/// when a human started it) and `protected` (the paths the guard refuses to let the call
/// change, whatever a policy says). A policy module is imported before the guard is
/// installed, so it cannot ask the host for any of this: the tool writes it as a literal.
export function contextLiteral({ roots = [], cwd, fields = [], protected: protectedPaths = [] }) {
  const list = (items) => `[${(items ?? []).map((item) => eygStringLiteral(item)).join(", ")}]`;
  return `{roots: ${list(roots)}, cwd: ${eygStringLiteral(cwd)}, fields: ${list(fields)}, protected: ${list(protectedPaths)}}`;
}

/// The model's program as a module the guard can import: one `run` function whose body is
/// the program text exactly as the call wrote it, and the record that exports it. Nothing
/// of the program text is spliced into the guard or into the entry.
export function programModule(source) {
  return `let run = (_) -> {\n${String(source ?? "")}\n}\n{run}\n`;
}

/// The argv that asks the binary for a program's syntax tree: one host action, no shell, no
/// flag that changes what is parsed.
export function parseArguments(code) {
  return ["parse", "-c", String(code ?? "")];
}

/// The effect labels a program handles for itself, read out of the tree `eyg parse` writes.
/// The compiler's tagged form marks a handler of a label as `{"0": "h", "l": "<Label>"}`;
/// `perform` is the same shape under `p`, a record field under `e`, a tag constructor under
/// `t`, a match pattern under `m` and a string under `s`, so `h` names handlers and nothing
/// else. The tool asks this question before it runs anything: the guard is the one host for
/// a call's effects, so a program that installs its own clause is refused with the labels
/// named (`handledEffectRefusal`, and boundary fact 7 of
/// `docs/world/entities/host.guard-boundary.md`).
export function handledEffectLabels(parsed) {
  const labels = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (value["0"] === "h" && typeof value.l === "string" && !labels.includes(value.l)) labels.push(value.l);
    for (const key of Object.keys(value)) walk(value[key]);
  };
  walk(parsed);
  return labels;
}

/// What a call answers when its own program handles an effect: the labels, why they are
/// refused, and the change the agent can make. The caller adds the `eyg refused: ` prefix
/// (`refuseToRun`), so this text does not carry it.
export function handledEffectRefusal(labels) {
  const named = labels.join(", ");
  return (
    `the program handles ${labels.length} effect(s) for itself (${named}), and a call has one host for its effects: the guard. ` +
    "Remove the `handle` clause and perform the effect directly - the policy decides it, a refusal comes back as a value you can match, " +
    "and what is refused is listed by action \"effects\". A wider host is the operator's to give (/eyg-grant), never a clause in the program."
  );
}

/// The per-call entry, and the one shape of it: import the guard and the policy this call
/// runs under, hand the policy its `ctx`, and import the program inside the guarded body.
/// With a `record` path it also binds `build`'s result - the refusals the guard answered -
/// and writes it last, which is the fourth file a call is made of.
/// Every path is an absolute literal, because an imported module evaluates before the
/// guard is installed and can ask the host for nothing. The guard names one handler per
/// effect and refuses any label it does not name, so an entry that skipped the guard would
/// run the program unchecked: the argv this package builds always starts here.
export function entryProgram({ guard, policy, ctx, program, record = null }) {
  const lines = [
    `let guard = import ${eygStringLiteral(guard)}`,
    `let policy = import ${eygStringLiteral(policy)}`,
    `let ctx = ${ctx}`,
    "guard.build(policy.rules(ctx), ctx, (_) -> {",
    `  let program = import ${eygStringLiteral(program)}`,
    "  program.run({})",
    "})",
  ];
  // The record of what the guard refused. `build` returns the refusals it answered as
  // a list - EYG has no mutable cell a handler could add to, so the list threads out
  // with the continuations - and this entry is the only thing that can turn it into a
  // file the tool reads: the write sits after the guarded body, so no handler and no
  // policy decides it, which is what makes the record survive `deny-all`. It is also
  // outside every root, so the program cannot read or overwrite it. The write has to be
  // the LAST line of the entry: an unbound `perform` is only legal there (`[]` on the
  // last line is a parse error), which is why nothing follows it.
  if (typeof record !== "string" || record === "") return lines.join("\n") + "\n";
  return lines
    .join("\n")
    .replace(
      /^guard\.build\(/m,
      "let refusal_record = guard.build("
    )
    .split("\n")
    .concat([
      'let record_text = !list_fold(refusal_record, "", (line, acc) -> {',
      '  !string_append(acc, !string_append(line, "\\n"))',
      "})",
      `perform WriteFile({path: ${eygStringLiteral(record)}, contents: !string_to_binary(record_text)})`,
    ])
    .join("\n") + "\n";
}

/// The argv that type-checks the entry this package just wrote, before the run starts: the
/// same binary, the same file, one host action and no shell. It is a check of the whole call,
/// not of the model's program alone - the entry is what imports the guard and the policy, so
/// this is the one `check` whose errors are about the arrangement the run will use.
export function entryCheckArguments(entry) {
  return ["check", String(entry ?? "")];
}

/// The `check` rows that say the run would answer nothing: only the lines that start `error:
/// type mismatch`. Measured 2026-11-25 over 13 program shapes in `.ai-work/security-docs/probes/entry-check-cases.mjs`,
/// each entry written exactly as `entryProgram` writes it: every well-shaped entry answers exactly
/// ONE other error line, `error: missing row 'Abort'`, because `host/guard.eyg` performs `Abort`
/// and `Abort` names no policy row - the surface's 23 effect rows have no such label. A program
/// that does not parse answers `error: missing reference <scratch>/program.eyg`, and the guarded
/// run of it already names that cheaply (`Aborted with reason: "failed to parse source from location`).
/// A `type mismatch` is the one family whose RUN prints 0 bytes to the spawn cap, because the CLI's
/// error report prints its whole interpreter state (`notes/pi-codemode-misshaped-ask.md`); the other
/// two families are left to the run because the run names them better and in milliseconds.
export function entryCheckMisshapeRows(output) {
  const rows = [];
  for (const line of String(output ?? "").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("error: type mismatch") && !rows.includes(trimmed)) rows.push(trimmed);
  }
  return rows;
}

/// What the tool answers when the check of the entry names a mis-shaped ask: the CLI's own rows
/// verbatim (they name the value the program gave and the type the effect wants), then the one
/// place that states an effect's argument record, then why there is no run output to read. The
/// caller adds the `eyg refused: ` prefix (`refuseToRun`), so this text does not carry it.
export function misshapedAskRows(rows, { policy }) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return [];
  return [
    ...list,
    `the argument an effect wants is its own row in ${SURFACE_FILE} - that row names the fields and their types; \`action: reference\` prints the rows without leaving this tool, and the prose for the effects is at <${LANGUAGE_DOCS}>`,
    `nothing ran and nothing was decided: the run was not started, because a mis-shape inside the guard prints no report at all - the CLI's error printer walks its whole interpreter state, and on this entry that state is the guard and the policy module (${policy}) imported in the body`,
  ];
}

/// One line of the refusal record as `{label, reason}`. A line is `<label>|<reason>`,
/// split at the FIRST `|` because a reason may hold `|` (a host refusal names a path
/// and a sentence). A line with no label before the `|` is not a record line and is
/// dropped, so a truncated file reads as fewer refusals rather than as a wrong one.
export function refusalRecordLines(text) {
  const rows = [];
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    const at = trimmed.indexOf("|");
    if (at > 0) rows.push({ label: trimmed.slice(0, at), reason: trimmed.slice(at + 1) });
  }
  return rows;
}

/// A recorded refusal in the `{field, value}` shape `describeRefusal` and `suggestGrant`
/// read: the guard's own label is the field, and the value is what the reason quoted
/// after `denied by policy:` or `denied by the host:` - a path, or a host. No value means
/// the rule refused the effect itself, which no roots addition covers.
export function recordedRefusalHint(row) {
  const match = /denied by (?:policy|the host): (\S*)/.exec(row && row.reason ? row.reason : "");
  return { field: row && row.label ? row.label : "", value: match === null ? null : match[1] };
}

/// The recorded refusals the program never showed the tool: a hint already present in
/// what the program printed, matched on field and value, is not counted twice. The
/// recorded set comes from the guard, so a program that bound a refusal to `_` and printed
/// nothing still has a hint here.
export function swallowedRefusals(recorded, grepped) {
  const seen = Array.isArray(grepped) ? grepped : [];
  return (Array.isArray(recorded) ? recorded : []).filter((hint) => !seen.some((other) => other.field === hint.field && other.value === hint.value));
}

/// The rows for refusals the guard made but the program never printed: a line naming how
/// many, then the ask for each (the full four-line grant ask once, two lines per further
/// refusal, as `refusalRows` shapes them). These rows are what a run that swallowed every
/// refusal still gets, because the guard wrote them rather than the program.
export function swallowedRows(hints, { roots, policy }) {
  const list = Array.isArray(hints) ? hints : [];
  if (list.length === 0) return [];
  const lines = [`the guard refused ${list.length} effect(s) the program did not report: ${list.map(describeRefusal).join(", ")}`];
  list.forEach((hint, n) => {
    const grant = suggestGrant(hint, { roots, policy });
    for (const line of n === 0 ? grant : grant.slice(0, 2)) {
      if (!lines.includes(line)) lines.push(line);
    }
  });
  return lines;
}

/**
 * Where the tool looks for the binary to run a call in, in the order it tries them.
 * `EYG_CODEMODE_RUNNER` names one path and ends the search. Otherwise the only candidate
 * is the CLI on `PATH`: this package depends on the officially installable `eyg` and
 * reaches no build output or private artifact of its own, and asks nothing of it but the
 * mode word and a file it wrote (`cli.runner-official-install-only`). A binary that is not
 * there, or that does not take a file in that position, gets one line naming the install
 * (`runnerFailureLine`). The working directory stays in the signature because callers pass
 * it; no candidate is built from it.
 */
export function runnerCandidates(cwd, env = {}) {
  const configured = env.EYG_CODEMODE_RUNNER;
  if (configured !== undefined && configured !== "") return [configured];
  return ["eyg"];
}

/// The `eyg` key of pi's effective settings, shaped. pi merges the global and the
/// project file and keeps keys it does not know (measured 2026-11-20: a probe
/// extension read back `"eyg": {"policy": "deny-all", "roots": [...]}` unchanged),
/// so this reads what is there and fills what is missing. A `roots` entry that is
/// not a non-empty string is dropped rather than guessed at.
export function eygSettings(settings) {
  const raw = settings && typeof settings === "object" && settings.eyg && typeof settings.eyg === "object"
    ? settings.eyg
    : {};
  const listed = Array.isArray(raw.roots) ? raw.roots : typeof raw.roots === "string" ? [raw.roots] : [];
  return {
    policy: typeof raw.policy === "string" && raw.policy !== "" ? raw.policy : null,
    roots: listed.filter((root) => typeof root === "string" && root !== ""),
  };
}

/// A policy named in the settings resolves inside this package when it is a bare
/// name (`agent-roots`, `deny-all`), and is taken as given when it is an absolute
/// path. Anything else resolves to nothing, so the caller can say which key is wrong
/// instead of running a module nobody named.
export function shippedPolicyPath(policy, packageDirectory) {
  if (typeof policy !== "string" || policy === "") return null;
  if (policy.startsWith("/")) return policy;
  if (/^[a-z][a-z0-9-]*$/.test(policy)) return join(packageDirectory, "policies", `${policy}.eyg`);
  return null;
}

/// The shipped policy that lets the least through, by file name. A call may always
/// name this one, whatever the session was configured to run under, because choosing
/// it can only take reach away.
export const NARROWEST_POLICY_FILE = "deny-all.eyg";

/// Whether one policy path may narrow the call that named it: it is the module the
/// call already runs under, or it is `NARROWEST_POLICY_FILE`. Nothing else can be
/// proved narrower by looking at paths, and a name that cannot be proved narrower is
/// a widening the operator has to make (`argumentPolicyPath` refuses a module of the
/// model's own; this refuses a shipped one that would widen).
function narrows(argument, inForce) {
  if (argument === inForce) return true;
  return basename(argument) === NARROWEST_POLICY_FILE;
}

/// Which policy checks this call, first name wins. The prose statement of the order
/// is the table "Which policy a call gets" in `guides/how-to-write-a-policy.md`; what
/// follows is the reading this function does, in that order: a grant the operator made
/// this session, the policy the spawner of a subagent session named, the project's
/// `eyg.policy` key, `EYG_POLICY`, the policy shipped in this package, and nothing if
/// none of them names a module - a program is never run unchecked. The grant slot is
/// filled from the session branch (`grantEvents`, `replayGrants`); the spawner slot is
/// filled from the environment only for a session this package started, which is why a
/// subagent can be narrowed by whoever started it even in a project that names its own
/// policy (`notes/pi-codemode-session-grants.md`).
///
/// The argument is the one slot the model controls, so it may only narrow: it is
/// honoured when it names the policy the other slots already chose, or the narrowest
/// shipped policy, and otherwise the other slots win and `refusedArgument` carries the
/// name the call asked for so the caller can say why it was refused. A wider policy
/// comes from a grant, the project key or the environment, none of which a program
/// writes.
export function resolvePolicy({ argument = null, grant = null, spawner = null, project = null, env = null, packageDefault = null } = {}) {
  const steps = [
    ["session grant", grant],
    ["spawner", spawner],
    ["project settings", project],
    ["EYG_POLICY", env],
    ["package default", packageDefault],
  ];
  const named = (value) => typeof value === "string" && value !== "";
  let inForce = { policy: null, source: "none" };
  for (const [source, value] of steps) {
    if (named(value)) {
      inForce = { policy: value, source };
      break;
    }
  }
  if (!named(argument)) return { ...inForce, refusedArgument: null };
  if (inForce.policy === null || narrows(argument, inForce.policy)) return { policy: argument, source: "argument", refusedArgument: null };
  return { ...inForce, refusedArgument: argument };
}

/// Which roots the policy reads. Roots a spawner narrowed this session to win, then
/// the project's `eyg.roots`, then `EYG_ALLOWED_ROOTS`, then the working directory,
/// and whatever roots a grant the operator made this session adds on top. Answered as
/// the comma-separated list the shipped policy parses, deduplicated so a grant that
/// adds a root the project already names cannot duplicate it. A spawner's roots
/// replace rather than add, which is what lets it hand a child a slice of its own
/// reach in a project that names roots of its own (`sessionDepth`, `spawnerRoots`).
export function resolveRoots({ grant = [], spawner = [], project = [], env = null, cwd }) {
  const base = Array.isArray(spawner) && spawner.length > 0
    ? spawner
    : Array.isArray(project) && project.length > 0
    ? project
    : typeof env === "string" && env !== ""
      ? env.split(",").map((root) => root.trim()).filter((root) => root !== "")
      : [cwd];
  const extra = Array.isArray(grant) ? grant : [];
  const seen = [];
  for (const root of [...base, ...extra]) {
    if (typeof root === "string" && root !== "" && !seen.includes(root)) seen.push(root);
  }
  return seen.join(",");
}

/// The custom entry type a grant is recorded under. `pi.appendEntry` writes it, it
/// does not reach the model, and it lives on the session branch, so `/tree` and a
/// fork decide what a grant did and did not cover.
export const GRANT_ENTRY = "eyg-grant";

/// The two records a grant is made of, as the session carries them:
/// `{op: "grant", id, policy, calls, roots}` and `{op: "revoke", id}`.
/// `calls` is 1 for one tool call, N for N calls, or null for the rest of the
/// session.
///
/// The store is the branch, not a variable in the extension: this reads the
/// entries back and counts consumption out of the eyg tool results, so branching
/// replays grants and truncating a branch un-consumes the calls it dropped.
export function grantEvents(entries) {
  const events = [];
  for (const entry of entries ?? []) {
    if (entry.type === "custom" && entry.customType === GRANT_ENTRY) {
      const data = entry.data;
      if (data && (data.op === "grant" || data.op === "revoke")) events.push(data);
    } else if (
      entry.type === "message" && entry.message && entry.message.role === "toolResult" &&
      entry.message.toolName === "eyg" && entry.message.details && entry.message.details.ran === true
    ) {
      // A call that never reached a policy - no runner, a bad argument - is not a
      // call against a grant, so it does not spend one.
      const grantId = entry.message.details.grantId;
      events.push({ op: "call", grantId: typeof grantId === "string" ? grantId : null });
    }
  }
  return events;
}

/// The grants in force, replayed from those events, oldest first. A grant is in
/// force until its calls are used up or it is revoked; the newest grant in force is
/// the one the next call runs under, and an older one reappears when it expires.
export function replayGrants(events) {
  const grants = [];
  for (const event of events ?? []) {
    if (event.op === "grant" && typeof event.policy === "string" && event.policy !== "") {
      grants.push({
        id: typeof event.id === "string" && event.id !== "" ? event.id : `g${grants.length + 1}`,
        policy: event.policy,
        calls: Number.isFinite(event.calls) ? event.calls : null,
        roots: Array.isArray(event.roots) ? event.roots.filter((root) => typeof root === "string" && root !== "") : [],
        used: 0,
      });
    } else if (event.op === "revoke") {
      const at = grants.findIndex((grant) => grant.id === event.id);
      if (at >= 0) grants.splice(at, 1);
    } else if (event.op === "call" && event.grantId !== null && event.grantId !== undefined) {
      const grant = grants.find((candidate) => candidate.id === event.grantId);
      if (grant) grant.used += 1;
    }
  }
  const inForce = grants.filter((grant) => grant.calls === null || grant.used < grant.calls);
  const active = inForce.length > 0 ? inForce[inForce.length - 1] : null;
  return { grants: inForce, active, policy: active === null ? null : active.policy, roots: active === null ? [] : active.roots };
}

/// What the command answers when the operator asks what is widened right now, and the
/// id to hand back to `revoke`. The same line the command's own errors carry.
export function grantStatusLine(grants) {
  const inForce = grants ?? [];
  if (inForce.length === 0) return "no grant is in force now";
  return `grants in force now: ${inForce.map(describeGrant).join(" | ")} - revoke with /eyg-grant revoke <${inForce.map((grant) => grant.id).join(" | ")}>`;
}

/// One grant as one line, with what it costs the session still to spend.
export function describeGrant(grant) {
  const duration = grant.calls === null
    ? "for the rest of the session"
    : `for ${grant.calls} tool call${grant.calls === 1 ? "" : "s"} (${grant.used} used)`;
  const roots = grant.roots.length > 0 ? ` roots + ${grant.roots.join(", ")}` : "";
  return `${grant.id}: ${grant.policy} ${duration}${roots}`;
}

/// The refusals in a run's output, as `{field, value}` pairs, one per distinct pair.
/// The marker is the one the policies print, in both of its shapes: a rule that reads a
/// path quotes it (`<field> denied by policy: <path>`), and a rule that refuses the
/// effect itself - `fetch`, `create_key`, `standard_in` in the shipped policy - names no
/// value at all, which is a refusal the earlier scan missed entirely and the operator
/// saw no ask for. A host is a value too: `fetch denied by policy: 127.0.0.1`.
export function refusalHints(output) {
  const hints = [];
  for (const match of String(output ?? "").matchAll(/\b([a-z_]+) denied by policy(?:: ([^\s",)]+))?/g)) {
    const hint = { field: match[1], value: match[2] === undefined ? null : match[2] };
    if (!hints.some((seen) => seen.field === hint.field && seen.value === hint.value)) hints.push(hint);
  }
  return hints;
}

/// One refusal as a phrase: the field, and what the policy was given when it quoted one.
export function describeRefusal(hint) {
  const value = hint.value ?? null;
  if (value === null) return hint.field;
  return `${hint.field} ${value.startsWith("/") ? "at" : "asked for"} ${value}`;
}

/// The first directory of `path` that no root in force covers: the root an operator
/// would have to add to let `path` through a roots-driven policy. `null` when the
/// path is already under a root, which means the refusal is a rule of the policy and
/// no amount of roots will change it.
export function outsideRoot(path, roots) {
  const covered = (roots ?? []).filter((root) => typeof root === "string" && root !== "");
  const under = (candidate) => covered.some((root) => candidate === root || candidate.startsWith(root.endsWith("/") ? root : `${root}/`));
  const parts = String(path ?? "").split("/").filter((part) => part !== "");
  let prefix = "";
  for (const part of parts) {
    prefix = `${prefix}/${part}`;
    if (!under(prefix)) return prefix;
  }
  return null;
}

/// The grant that would have let this call through, spelled as the command the
/// operator runs. The model cannot run it: only the operator can, which is the whole
/// point of the loop. When no root would help, the honest answer is that the policy's
/// own rule refused the value. The last two rows are the ask template: a refusal is not
/// a report in itself, and when one does block the task the ask has to name the addition
/// above, the reason and the intended use.
export function suggestGrant(hint, { roots, policy }) {
  const value = hint.value ?? null;
  // A root is a directory that a path-reading rule compares against. When the refusal
  // names no path - a field the policy refuses outright, or a host - no root an operator
  // could add covers it, and saying so is the honest ask.
  const path = typeof value === "string" && value.startsWith("/") ? value : null;
  const root = path === null ? null : outsideRoot(path, String(roots ?? "").split(","));
  let what;
  if (path === null) {
    what = `a policy module whose ${hint.field} rule admits ${value === null ? "this effect" : value} (${value === null ? `${policy} refuses ${hint.field} outright` : `the refusal names ${value}, not a path`}: no roots addition covers it)`;
  } else if (root === null) {
    what = `a policy module whose ${hint.field} rule admits ${path} (the refusal is a rule of ${policy}, not a root: no ${roots} addition covers it)`;
  } else {
    what = `policy agent-roots (or one of your own) with roots + ${root}`;
  }
  return [
    `refused: ${describeRefusal(hint)} under ${policy}`,
    `to allow it the operator runs /eyg-grant and chooses ${what}, for one tool call, N calls, or the rest of the session`,
    "you cannot grant it yourself, and this refusal does not end the call: keep solving inside what the policy allows",
    `when a refusal is what blocks the task and the other routes are spent, the ask names the addition above, why the task needs it, and what you would use it for`,
  ];
}

/// A policy named in a tool call argument. A model may choose among the policies this
/// package ships - both of them narrower-or-equal to what the session already has -
/// and may not name a module of its own: `WriteFile` inside the roots plus an
/// absolute path here would let a program write its own permission and hand it to the
/// runner, which is the route the grant loop exists to close (`notes/pi-codemode-session-grants.md`).
export function argumentPolicyPath(value, packageDirectory) {
  if (typeof value !== "string" || value === "" || value.startsWith("/")) return null;
  if (!/^[a-z][a-z0-9-]*$/.test(value) || packageDirectory === null) return null;
  return join(packageDirectory, "policies", `${value}.eyg`);
}

/// The one line for a spawn that ran no program at all. Two ways that happens, and both
/// are install problems rather than program errors, so the line names the install and not
/// the code, and the only lever either way is the binary the operator names:
///
/// - the binary is not where the tool looks, which the spawn reports as `ENOENT`;
/// - the binary read the mode word as a file name, because it has no such command to
///   match the argv this tool builds, so it fell back to running "this file" (measured
///   2026-11-22: `eyg bogus entry.eyg` answers `error: no such file: <cwd>/bogus`).
///
/// `mode` is the word the tool puts first in the argv (`run` or `eval`) and `entry` the file
/// it puts second, so the line quotes the exact command that was run.
export function runnerFailureLine({ runner, mode, entry = null, output }) {
  const text = String(output ?? "");
  if (/\bENOENT\b/.test(text)) {
    return `no eyg binary found at ${runner}: install the EYG CLI so that \`eyg\` is on PATH, or name one with EYG_CODEMODE_RUNNER=<absolute path>.`;
  }
  if (new RegExp(`no such file:[^\\n]*\\b${mode}\\b`, "i").test(text)) {
    const command = entry === null ? `${runner} ${mode} <the file this package wrote>` : `${runner} ${mode} ${entry}`;
    return `the binary at ${runner} has no \`${mode}\` command, so it read \`${mode}\` as a file name and ran nothing: \`${command}\` is the command this package runs for every call. Install the EYG CLI (see <${LANGUAGE_DOCS}>), or name a binary that takes a file after the mode word with EYG_CODEMODE_RUNNER=<absolute path>.`;
  }
  return null;
}

/// The effect names `rule_mapping` lists, in file order, from either half of its
/// entries - `policy.PolicyField("field")` or `policy.Unchecked`. Parsed from the
/// Gleam source rather than copied, so an effect added to the runtime fails the
/// comparison test instead of going unnoticed.
export function ruleMappingEffects(source) {
  const names = [];
  const pattern = /#\("([A-Z][A-Za-z]*)", policy\.(?:PolicyField\(|Unchecked)/g;
  let match = pattern.exec(source);
  while (match !== null) {
    names.push(match[1]);
    match = pattern.exec(source);
  }
  return names;
}

/// Wall time as the tool prints it in both places: `1.24 s` under a minute,
/// `2:03` past one, `1:02:03` past an hour. Seconds with minutes when it
/// crosses a minute is the shape the operator asked for.
export function formatDuration(milliseconds) {
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) {
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/// The effect names a program performs, in order of first appearance. The scan
/// is textual - `perform` followed by a name starting with a capital letter -
/// so a mention inside a comment counts too. That is acceptable here: the
/// renderer tells the reader what the program may ask the policy about, and an
/// over-estimate never hides an effect. Keep prose free of `perform Foo`.
export function effectsUsed(source) {
  const found = [];
  for (const match of source.matchAll(/\bperform\s+([A-Z][A-Za-z0-9_]*)/g)) {
    if (!found.includes(match[1])) {
      found.push(match[1]);
    }
  }
  return found;
}

/// The metadata record a registry module carries, read by a tolerant scan of
/// the module text: `let metadata = { ... }` with the keys `name`, `description`,
/// `signature` and `effects`. There is no EYG parser in this process, so the scan
/// is deliberately narrow - one key per line, strings in double quotes, `effects`
/// a list of double-quoted names - and a module written in another shape is
/// reported as an error rather than misread. Documented in the README so a
/// function author reads the shape from one place.
export function findMetadata(source) {
  const record = /let\s+metadata\s*=\s*\{([\s\S]*?)\n\s*\}/.exec(source);
  if (!record) {
    return { found: false, name: null, description: null, signature: null, effects: null };
  }
  const body = record[1];
  const text = (key) => {
    const match = new RegExp(`\\b${key}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(body);
    return !match ? null : match[1];
  };
  const list = /effects\s*:\s*\[([^\]]*)\]/.exec(body);
  const effects = !list ? null : list[1].split(",").map((item) => item.trim().replace(/^"|"$/g, "")).filter((item) => item !== "");
  return {
    found: true,
    name: text("name"),
    description: text("description"),
    signature: text("signature"),
    effects,
  };
}

/// A function's declared effects against the `perform` names its body actually
/// contains. Both directions matter, and neither is a silent pass: an effect the
/// body performs but the record does not declare is an effect the listing would
/// not warn about, and one declared but not performed is a stale annotation.
export function checkDeclaredEffects(source, declared) {
  const performed = effectsUsed(source);
  const undeclared = performed.filter((name) => !declared.includes(name));
  const unperformed = declared.filter((name) => !performed.includes(name));
  return { performed, undeclared, unperformed };
}

/// The row for a tool call, as text rather than as theme colours: a list of
/// lines, each a list of `{tone, text}` segments. The renderer paints the
/// segments with the theme; the shapes live here so a test can assert what the
/// collapsed row shows (effects used, first lines of the program) and what the
/// expanded row shows (the whole program, nothing dropped).
export const COLLAPSED_SOURCE_LINES = 4;

export function callLines(args, expanded) {
  const action = args.action || "run";
  const code = args.code || "";
  const head = [{ tone: "title", text: "eyg " }];
  if (action !== "run") {
    head.push({ tone: "accent", text: `${action} ` });
  }
  if (args.timeout !== undefined && args.timeout !== null) {
    head.push({ tone: "dim", text: `(timeout: ${args.timeout}s)` });
  }
  if (args.libraries && args.libraries.length > 0) {
    head.push({ tone: "dim", text: ` uses: ${args.libraries.join(", ")}` });
  }
  if (args.extern !== undefined && args.extern !== null && args.extern !== "") {
    head.push({ tone: "dim", text: ` extern: ${args.extern}` });
  }
  const lines = [head];
  if (action === "describe_function") {
    lines.push([{ tone: "accent", text: `  ${args.function || "(no function named)"}` }]);
  }
  const effects = effectsUsed(code);
  if (effects.length > 0) {
    lines.push([{ tone: "dim", text: `performs: ${effects.join(", ")}` }]);
  }
  const source = code === "" ? [] : code.split("\n");
  const shown = expanded ? source : source.slice(0, COLLAPSED_SOURCE_LINES);
  for (const line of shown) {
    lines.push([{ tone: "code", text: `  ${line}` }]);
  }
  if (!expanded && source.length > COLLAPSED_SOURCE_LINES) {
    lines.push([{ tone: "muted", text: `  ... ${source.length - COLLAPSED_SOURCE_LINES} more lines` }]);
  }
  return lines;
}

/// The rows a refused call adds: what was refused, where, and the grant that would
/// have let it through. They show collapsed as well as expanded, because the
/// operator has to see the ask without opening the row. The two rows telling a model
/// what to do with a refusal ride once per call, whatever the number of refusals.
export function refusalRows(details) {
  const rows = [];
  const hints = details && Array.isArray(details.refusals) ? details.refusals : [];
  hints.forEach((hint, n) => {
    const lines = suggestGrant(hint, { roots: (details && details.roots) || "", policy: (details && details.policy) || "" });
    for (const line of n === 0 ? lines : lines.slice(0, 2)) {
      rows.push([{ tone: "warning", text: line }]);
    }
  });
  return rows;
}

/// The row naming the grants in force for this call, if any.
export function grantRows(details) {
  const grants = details && Array.isArray(details.grants) ? details.grants : [];
  if (grants.length === 0) return [];
  return [[{ tone: "warning", text: `grants in force: ${grants.map(describeGrant).join(" | ")}` }]];
}

/// A path is under a root when it is the root or sits below it.
export function isUnder(path, root) {
  return path === root || path.startsWith(root.endsWith("/") ? root : `${root}/`);
}

/// The roots a subagent may be given: every one of them must already be under a root
/// the spawner has, so a session can hand a child a slice of its reach and never more.
/// Named back rather than dropped silently.
export function rootsInside(requested, allowed) {
  const covered = (allowed ?? []).filter((root) => typeof root === "string" && root !== "");
  const outside = (requested ?? []).filter((root) => !covered.some((root2) => isUnder(root, root2)));
  return { ok: outside.length === 0, outside };
}

/// The effects the spawner's allowlist can never grant. `policies/spawner-effects.eyg`
/// is `agent-roots.eyg` with an allowlist over its fields, and these three keep the
/// plain refusal agent-roots gives them: an allowlist removes reach, it does not add it.
/// Naming one is refused where it is asked for, rather than left for the child to find.
export const SPAWNER_POLICY_NEVER = ["CreateKey", "Fetch", "StandardIn"];

/// The effects naming in the allowlist cannot change the answer for. `Env` returns an
/// Option, so the guard's own reply for a refused `Env` is `None({})` - the honest "unset" -
/// which is what both shipped policies answer named or not.
export const SPAWNER_POLICY_NOOP = ["Env"];

/// The tools a spawner may hand a child. `eyg` is this package's channel and must be
/// there: a child with only `read` would be a session whose every effect is decided by
/// the harness rather than by a policy module, which is the promise this package exists
/// to keep. `read` is pi's own tool and no policy decides it, so granting it hands the
/// child the parent's read reach - which is why the list stops at these two names.
export const CHILD_TOOL_ALLOWLIST = ["eyg", "read"];

/// The tools a child is actually given: every requested name must be on the allowlist,
/// `eyg` must be among them, and a name the parent session does not have active is
/// named back rather than given (`parentTools` is `pi.getActiveTools()`, or `null` when
/// the harness does not say, in which case that check is skipped and `parentChecked`
/// says so). Names are kept in the order asked, deduplicated.
export function childTools(requested, parentTools = null) {
  const names = [];
  for (const name of requested ?? []) {
    const tool = typeof name === "string" ? name.trim() : "";
    if (tool !== "" && !names.includes(tool)) names.push(tool);
  }
  const unknown = names.filter((tool) => !CHILD_TOOL_ALLOWLIST.includes(tool));
  const withoutEyg = !names.includes("eyg");
  const parentMissing = Array.isArray(parentTools) ? names.filter((tool) => !parentTools.includes(tool)) : [];
  return { ok: unknown.length === 0 && !withoutEyg && parentMissing.length === 0, tools: names, unknown, withoutEyg, parentMissing, parentChecked: Array.isArray(parentTools) };
}

/// The effects a spawner names are effect names; the policy decides by field, and two
/// names share a field (`Search` is decided by `read_file`, the field `ReadFile` is
/// decided by). `unknown` is a name the CLI does not have; `unchecked` is one of the
/// four no policy can forbid, reported rather than enforced.
export function effectFieldsFor(names) {
  const fields = [];
  const unknown = [];
  const unchecked = [];
  for (const name of names ?? []) {
    const effect = typeof name === "string" ? name.trim() : "";
    if (effect === "") continue;
    if (!Object.prototype.hasOwnProperty.call(POLICY_FIELDS, effect)) {
      if (!unknown.includes(effect)) unknown.push(effect);
      continue;
    }
    const field = POLICY_FIELDS[effect];
    if (field === null) {
      if (!unchecked.includes(effect)) unchecked.push(effect);
      continue;
    }
    if (!fields.includes(field)) fields.push(field);
  }
  return { fields, unknown, unchecked };
}

/// The fields an allowlist names that the policy in force does not perform. Naming a
/// field the parent's own policy refuses would only waste the child's calls, so the
/// spawn is refused and the field named back.
export function fieldsOutside(fields, allowed) {
  const known = (allowed ?? []).filter((field) => typeof field === "string" && field !== "");
  const outside = (fields ?? []).filter((field) => !known.includes(field));
  return { ok: outside.length === 0, outside };
}

/// The environment this package marks a subagent session with, and the depth it marks.
/// `EYG_SUBAGENT_POLICY` outranks the project key only while `EYG_CODEMODE_DEPTH` says
/// the process was started by this package, so a project cannot claim a spawner's
/// standing by setting the variable itself.
export const DEPTH_ENV = "EYG_CODEMODE_DEPTH";
export const SPAWNER_POLICY_ENV = "EYG_SUBAGENT_POLICY";

/// The effect fields the child's narrowing policy performs, comma separated. The tool
/// reads it and writes the list into the `ctx` record its entry hands the policy, so the
/// child's own program never sees it as an environment variable, and an unset or empty
/// value names no field at all.
export const EFFECT_ALLOWLIST_ENV = "EYG_SUBAGENT_EFFECTS";

/// How many eyg calls a child session may make. Read only under the same depth marker
/// as the spawner's policy and roots, so it is the spawner's word and not the project's.
export const MAX_CALLS_ENV = "EYG_SUBAGENT_MAX_CALLS";

/// How deep this session sits: 0 for one a human started, N for one this package
/// started N levels down. A missing or nonsense marker reads as 0, and a session at
/// depth 1 or more gets no children of its own, so the tree a spawn can build is one
/// level deep.
export function sessionDepth(env = {}) {
  const depth = Number(env?.[DEPTH_ENV] ?? 0);
  return Number.isFinite(depth) && depth > 0 ? Math.trunc(depth) : 0;
}

/// The policy a spawner named for this session, read only in a session this package
/// started. A project that sets the variable in its own environment gets nothing: the
/// depth marker is what makes the variable a spawner's word rather than the project's
/// claim to a spawner's standing.
export function spawnerPolicy(env = {}, depth = sessionDepth(env)) {
  if (depth < 1) return null;
  const value = env?.[SPAWNER_POLICY_ENV];
  return typeof value === "string" && value !== "" ? value : null;
}

/// The roots a spawner gave this session, under the same condition, split the way the
/// policy parses them.
export function spawnerRoots(env = {}, depth = sessionDepth(env)) {
  if (depth < 1) return [];
  const value = env?.EYG_ALLOWED_ROOTS;
  if (typeof value !== "string") return [];
  return value.split(",").map((root) => root.trim()).filter((root) => root !== "");
}

/// The effect fields a spawner named for this session, under the same depth marker as its
/// policy and roots. An unset or empty value names nothing, which `spawner-effects.eyg`
/// reads as every field refused.
export function spawnerEffects(env = {}, depth = sessionDepth(env)) {
  if (depth < 1) return [];
  const value = env?.[EFFECT_ALLOWLIST_ENV];
  if (typeof value !== "string") return [];
  return value.split(",").map((field) => field.trim()).filter((field) => field !== "");
}

/// The call budget for this session: `null` when there is no marker, when the depth
/// marker says a human started this session, or when the value is not a whole number.
/// `0` is a real budget: a child that may think and report but not call.
export function callBudget(env = {}, depth = sessionDepth(env)) {
  if (depth < 1) return null;
  const value = Number(env?.[MAX_CALLS_ENV]);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/// How many eyg calls this session has already made, counted off the session's own
/// records - the same scan `grantEvents` uses to spend a grant, so a call that never
/// reached a policy (refused argument, no runner, over budget) does not spend anything.
export function eygCallCount(entries) {
  let calls = 0;
  for (const entry of entries ?? []) {
    if (
      entry.type === "message" && entry.message && entry.message.role === "toolResult" &&
      entry.message.toolName === "eyg" && entry.message.details && entry.message.details.ran === true
    ) {
      calls += 1;
    }
  }
  return calls;
}

/// What a child is told when it runs out of calls. The budget belongs to whoever
/// spawned the session and the child cannot widen it, so the message sends it back
/// with what it has rather than letting it spin.
export function budgetRefusal(budget, calls) {
  return `this session has made ${calls} eyg call${calls === 1 ? "" : "s"} and its spawner set a budget of ${budget}. The budget is the spawner's to set and not yours to widen, and no grant reaches a child session. Report what you have: the paths you read, what they say, the numbers, and what you did not get to.`;
}

export function childEnvOverrides({ policy, roots, depth, effects = null, maxCalls = null }) {
  const overrides = {
    EYG_POLICY: policy,
    [SPAWNER_POLICY_ENV]: policy,
    EYG_ALLOWED_ROOTS: roots,
    [DEPTH_ENV]: String(depth),
  };
  if (Array.isArray(effects) && effects.length > 0) {
    overrides[EFFECT_ALLOWLIST_ENV] = effects.join(",");
  }
  if (maxCalls !== null && maxCalls !== undefined) {
    overrides[MAX_CALLS_ENV] = String(maxCalls);
  }
  return overrides;
}

/// How the child is started: a whole `pi` invocation built as argv, with no shell in
/// between, in the spawner's working directory, with only the tools the spawner was
/// allowed to name, and told to print JSON records so the spawner can read what the
/// child's calls answered. The child inherits this project's package declaration, so
/// the extension is there again; `--approve` is passed only when the spawner's own
/// project is already trusted.
export function childArgv({ task, model = null, trusted = false, tools = CHILD_TOOL_ALLOWLIST.slice(0, 1), extra = [] }) {
  const names = Array.isArray(tools) && tools.length > 0 ? tools : CHILD_TOOL_ALLOWLIST.slice(0, 1);
  const argv = ["--print", "--mode", "json", "--tools", names.join(",")];
  if (model !== null && model !== "") argv.push("--model", model);
  if (trusted) argv.push("--approve");
  return [...argv, ...extra, task];
}

/// The call row for `eyg_subagent`: what the child was asked, and the boundary it was
/// given. Collapsed shows the first lines of the task; expanded shows the whole task.
export function subagentCallLines(params, expanded) {
  const head = [{ tone: "title", text: "eyg_subagent " }];
  if (params.timeout !== undefined && params.timeout !== null) {
    head.push({ tone: "dim", text: `(timeout: ${params.timeout}s) ` });
  }
  if (typeof params.policy === "string" && params.policy !== "") {
    head.push({ tone: "accent", text: `policy: ${params.policy}` });
  }
  const lines = [head];
  const roots = Array.isArray(params.roots) ? params.roots.filter((root) => typeof root === "string" && root !== "") : [];
  lines.push([{ tone: "dim", text: `roots: ${roots.length > 0 ? roots.join(", ") : "inherited: the roots this session has"}` }]);
  const tools = Array.isArray(params.tools) ? params.tools.filter((tool) => typeof tool === "string" && tool !== "") : ["eyg"];
  lines.push([{ tone: "dim", text: `tools: ${tools.join(", ")}${tools.includes("read") ? " (pi's read tool is not decided by a policy)" : ""}` }]);
  const effects = Array.isArray(params.effects) ? params.effects.filter((effect) => typeof effect === "string" && effect !== "") : [];
  if (effects.length > 0) {
    const mapped = effectFieldsFor(effects);
    lines.push([{ tone: "accent", text: `effects: ${mapped.fields.join(", ") || "none"} under the spawner allowlist policy` }]);
  }
  if (params.max_calls !== undefined && params.max_calls !== null) {
    lines.push([{ tone: "dim", text: `max_calls: ${params.max_calls}` }]);
  }
  const task = String(params.task ?? "").split("\n");
  const shown = expanded ? task : task.slice(0, COLLAPSED_SOURCE_LINES);
  for (const line of shown) {
    lines.push([{ tone: "code", text: `  ${line}` }]);
  }
  if (!expanded && task.length > COLLAPSED_SOURCE_LINES) {
    lines.push([{ tone: "muted", text: `  ... ${task.length - COLLAPSED_SOURCE_LINES} more lines` }]);
  }
  return lines;
}

/// What a child's refusal means to the session that spawned it. `/eyg-grant` widens
/// the session the operator is in, never a child session, so the honest answer names
/// what the spawner can do instead.
export function childRefusalRows(details) {
  const rows = [];
  for (const hint of details && Array.isArray(details.refusals) ? details.refusals : []) {
    rows.push([{ tone: "warning", text: `child refused: ${describeRefusal(hint)} under ${(details && details.policy) || ""}` }]);
  }
  if (rows.length > 0) {
    rows.push([{ tone: "warning", text: "a grant does not reach a child: /eyg-grant widens this session, so do the refused work here or give the child a task inside the roots you gave it" }]);
  }
  if (details && Array.isArray(details.calls) && details.calls.some((call) => call.budget !== null && call.budget !== undefined)) {
    rows.push([{ tone: "warning", text: "the child spent its call budget and was told to report what it has: raise max_calls, give it a smaller task, or do the rest here" }]);
  }
  return rows;
}

/// The result row for `eyg_subagent`: how the child ended, how many eyg calls it
/// made, what its policy refused, and when expanded the argv the child was started
/// with and the whole report the model gets back.
export function subagentResultRows(result, expanded, durationMs) {
  const details = (result && result.details) || {};
  const first = result && result.content && result.content[0];
  const body = first && first.type === "text" ? first.text : "";
  const lines = body === "" ? [] : body.split("\n");
  const status = lines.length > 0 ? lines[0] : "subagent produced no text";
  const exit = typeof details.exit === "number" ? details.exit : undefined;
  const failed = details.ran === false || details.killed === true || (exit !== undefined && exit !== 0);
  const calls = Array.isArray(details.calls) ? details.calls : [];
  const head = [{ tone: failed ? "error" : "success", text: status }];
  if (details.ran !== false) {
    head.push({ tone: "dim", text: ` (${calls.length} eyg call${calls.length === 1 ? "" : "s"})` });
  }
  if (typeof details.maxCalls === "number") {
    head.push({ tone: "dim", text: ` of a budget of ${details.maxCalls}` });
  }
  if (durationMs !== undefined && durationMs !== null && !/wall/.test(status)) {
    head.push({ tone: "dim", text: ` in ${formatDuration(durationMs)} wall` });
  }
  if (details.truncated === true) {
    head.push({ tone: "warning", text: " [truncated]" });
  }
  const rows = [head];
  rows.push(...childRefusalRows(details));
  if (expanded) {
    if (Array.isArray(details.argv)) {
      rows.push([{ tone: "muted", text: `argv: ${details.binary ?? "pi"} ${details.argv.join(" ")}` }]);
    }
    for (const line of lines.slice(1)) {
      rows.push([{ tone: "dim", text: line }]);
    }
  }
  return rows;
}

/// What a child's JSON records say about one eyg call: the policy it ran under, the
/// roots it had, and what the policy refused. The refusals are how the parent learns
/// where the child's boundary was, without reading the child's whole transcript.
export function childCalls(output) {
  const calls = [];
  for (const line of String(output ?? "").split("\n")) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type !== "tool_execution_end" || record.toolName !== "eyg") continue;
    const details = (record.result && record.result.details) || {};
    calls.push({
      policy: details.policy ?? null,
      policySource: details.policySource ?? null,
      roots: details.roots ?? null,
      refusals: details.refusals ?? [],
      exit: details.exit ?? null,
      // Only a call the child's own budget refused carries a budget, which is how the
      // spawner learns the child ran out rather than simply stopped.
      budget: typeof details.budget === "number" ? details.budget : null,
    });
  }
  return calls;
}

/// The child's last words, from the JSON records: the text of its final assistant
/// message, which is what the parent gets back along with the call rows.
export function childAnswer(output) {
  let answer = "";
  for (const line of String(output ?? "").split("\n")) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const message = record.message ?? (record.type === "message" ? record : null);
    if (!message || message.role !== "assistant") continue;
    const parts = Array.isArray(message.content) ? message.content : [];
    const text = parts.filter((part) => part && part.type === "text").map((part) => part.text).join("");
    if (text !== "") answer = text;
  }
  return answer;
}

/// The row for a result, in the same shape. `elapsedMs` is set while the run
/// is still going, and answers with elapsed time rather than a silent row;
/// `durationMs` is the finished wall time. A status line that already names
/// wall time (`eyg run: ran in 1.24 s wall`) is not given it a second time.
export function resultLines(result, expanded, durationMs, elapsedMs) {
  if (elapsedMs !== undefined && elapsedMs !== null) {
    return [[{ tone: "warning", text: `eyg running, ${formatDuration(elapsedMs)} so far` }]];
  }
  const first = result.content && result.content[0];
  const body = first && first.type === "text" ? first.text : "";
  const details = result.details;
  const refused = !!(details && details.ran === false);
  const exit = details && typeof details.exit === "number" ? details.exit : undefined;
  const lines = body === "" ? [] : body.split("\n");
  const status = lines.length > 0 ? lines[0] : "eyg produced no text";
  const head = [{ tone: refused || (exit !== undefined && exit !== 0) ? "error" : "success", text: status }];
  if (lines.length > 1) {
    head.push({ tone: "dim", text: ` (${lines.length - 1} output lines)` });
  }
  if (durationMs !== undefined && durationMs !== null && !/wall/.test(status)) {
    head.push({ tone: "dim", text: ` in ${formatDuration(durationMs)} wall` });
  }
  if (details && details.truncated === true) {
    head.push({ tone: "warning", text: " [truncated]" });
  }
  const rows = [head];
  rows.push(...refusalRows(details));
  rows.push(...builtinHintRows(details && details.builtins));
  rows.push(...variableRows(details));
  rows.push(...grantRows(details));
  if (expanded) {
    for (const line of lines.slice(1)) {
      rows.push([{ tone: "dim", text: line }]);
    }
    if (details && details.policy) {
      rows.push([
        {
          tone: "muted",
          text: `policy: ${details.policy} (${details.policySource || "?"}) runner: ${details.runner || "?"} roots: ${details.roots || "?"}`,
        },
      ]);
    }
  }
  return rows;
}

/// Raw tool-call arguments to the shape this version of the tool declares. A
/// session resumed from an older version sent `timeout_ms` (milliseconds)
/// instead of `timeout` (seconds), and `mode` instead of `action`; both are
/// mapped here, before schema validation, so no deprecated field has to appear
/// in the schema the model sees. Every other key is carried over unchanged,
/// because a misspelt field must reach validation as an error the model can
/// fix rather than be dropped silently.
export function prepareCallArguments(raw) {
  let given = {};
  if (typeof raw === "string") {
    try {
      given = JSON.parse(raw);
    } catch {
      given = {};
    }
  } else if (typeof raw === "object" && raw !== null) {
    given = raw;
  }
  if (given === null || typeof given !== "object") {
    given = {};
  }
  const copy = { ...given };
  if (typeof copy.code !== "string") {
    // `code` is the only required field, and a registry query needs no program:
    // an omitted one reads as an empty program rather than a validation error.
    copy.code = "";
  }
  if (copy.timeout === undefined && typeof copy.timeout_ms === "number") {
    copy.timeout = copy.timeout_ms / 1000;
  }
  delete copy.timeout_ms;
  if (typeof copy.action !== "string" && (copy.mode === "run" || copy.mode === "eval")) {
    copy.action = copy.mode;
  }
  delete copy.mode;
  return copy;
}

/// The scopes a named binding may be kept in, furthest first: the operator's home
/// directory, this workspace's tracked directory, and this session's own records. A
/// nearer scope wins on a name, which is the rule the registry scopes already follow.
export const VARIABLE_SCOPES = ["user", "workspace", "session"];

/// The directory a file scope keeps its bindings in, beside the registry scope of the
/// same name. `session` has no directory: its bindings are entries on the session
/// branch (`VARIABLE_ENTRY`), not files. Reading a scope is host-side work the tool
/// does, as it does for a registry scope; writing one is the effect the policy decides.
export function variableDir(scope, { cwd, home = null }) {
  if (scope === "workspace") return join(String(cwd), ".pi", "eyg-variables");
  if (scope === "user") return home === null || home === "" ? null : join(home, ".pi", "eyg-variables");
  return null;
}

/// The custom entry type a session-scope binding is recorded under. `pi.appendEntry`
/// writes it, the model never sends it, and it lives on the session branch, so a fork
/// or a `/tree` jump replays the bindings the branch carries and a truncated branch
/// drops the ones it cut.
export const VARIABLE_ENTRY = "eyg-variable";

/// The binding records a session branch carries, oldest first: `{op: "define", name,
/// source}`. Mirrors `grantEvents`: one scan of the branch, so the replay and the
/// store cannot drift.
export function variableEvents(entries) {
  const events = [];
  for (const entry of entries ?? []) {
    if (entry.type === "custom" && entry.customType === VARIABLE_ENTRY) {
      const data = entry.data;
      if (data && data.op === "define" && typeof data.name === "string" && typeof data.source === "string") {
        events.push({ op: "define", name: data.name, source: data.source });
      } else if (data && data.op === "revoke" && typeof data.name === "string") {
        events.push({ op: "revoke", name: data.name });
      }
    }
  }
  return events;
}

/// The bindings a session branch defines, replayed oldest first. A later definition of
/// the same name replaces the earlier one, so re-`extern`ing a name is how a session
/// updates its own binding.
export function replayVariables(events) {
  const byName = new Map();
  for (const event of events ?? []) {
    if (event.op === "define") byName.set(event.name, event.source);
    else if (event.op === "revoke") byName.delete(event.name);
  }
  return [...byName.entries()].map(([name, source]) => ({ name, source }));
}

/// The words the EYG parser reserves for its own forms, so a binding may not be called
/// one of them: `eyg check -c 'let handle = 5'` rejects each name in this list.
export const EYG_RESERVED_NAMES = ["let", "handle", "perform", "match", "import"];

/// A binding name as EYG can bind it: lower snake_case, a letter first, and not one of
/// the parser's own words. `problem` says what to call it instead, because a name in
/// another case is the most common mistake and `myWebSearch` becomes `my_web_search`.
export function variableName(name) {
  const given = typeof name === "string" ? name.trim() : "";
  if (given === "") return { ok: false, name: given, problem: "a binding name cannot be empty" };
  if (!/^[a-z][a-z0-9_]*$/.test(given)) {
    const snake = given
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const suggest = snake !== "" && snake !== given && /^[a-z][a-z0-9_]*$/.test(snake) ? `, so name it ${snake}` : "";
    return { ok: false, name: given, problem: `${given} is not a name EYG can bind: a binding name is lower snake_case - a letter first, then letters, digits and underscores${suggest}` };
  }
  if (EYG_RESERVED_NAMES.includes(given)) {
    return { ok: false, name: given, problem: `${given} is a word the EYG parser reserves, so it cannot be a binding name` };
  }
  if (given.endsWith("_lib")) {
    return { ok: false, name: given, problem: `${given} ends in _lib, the suffix a call's libraries argument binds its modules as, so it would collide with one` };
  }
  return { ok: true, name: given, problem: null };
}

/// Walk program text once, tracking strings, `//` comments and bracket depth, and call
/// `at(index, depth)` for every character the parser reads at that depth. Everything
/// that has to know where a top-level statement is uses this one walk, so the
/// extraction and the reference scan cannot disagree about what a string holds.
function walkSource(text, at) {
  let i = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inComment = false;
  while (i < text.length) {
    const char = text[i];
    if (inComment) {
      if (char === "\n") inComment = false;
      at(i, depth, { skipped: true });
      i += 1;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      at(i, depth, { skipped: true });
      i += 1;
      continue;
    }
    if (char === "/" && text[i + 1] === "/") {
      inComment = true;
      i += 2;
      continue;
    }
    if (char === '"') inString = true;
    if (char === "(" || char === "[" || char === "{") depth += 1;
    if (char === ")" || char === "]" || char === "}") depth -= 1;
    at(i, depth, { skipped: false });
    i += 1;
  }
  return depth;
}

/// The end of one top-level statement's value: the FIRST newline that arrives with
/// every bracket closed. A value spanning lines - a function body - is followed to its
/// closing bracket, and a value whose brackets never close comes back with
/// `balanced: false` so the caller reports it rather than guessing at the text.
function statementEnd(text, from) {
  let i = from;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inComment = false;
  while (i < text.length) {
    const char = text[i];
    if (inComment) {
      if (char === "\n" && depth === 0) return { end: i, balanced: true };
      if (char === "\n") inComment = false;
      i += 1;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      i += 1;
      continue;
    }
    if (char === "/" && text[i + 1] === "/") {
      inComment = true;
      i += 2;
      continue;
    }
    if (char === '"') inString = true;
    if (char === "(" || char === "[" || char === "{") depth += 1;
    if (char === ")" || char === "]" || char === "}") depth -= 1;
    if (char === "\n" && depth === 0) return { end: i, balanced: true };
    if (depth < 0) return { end: i, balanced: false };
    i += 1;
  }
  return { end: i, balanced: depth === 0 && !inString && !inComment };
}

/// The top-level `let name = <value>` bindings of a program, with the text of each
/// value: what an `extern` call persists. A `let` inside a function body is not a
/// binding of the program, a bracket inside a string or a comment moves nothing, and a
/// destructuring `let` is reported in `skipped` because its value is a pattern, not one
/// expression this could write back out.
export function topLevelBindings(source) {
  const text = String(source ?? "");
  const bindings = [];
  const skipped = [];
  const problems = [];
  let index = 0;
  let depth = 0;
  walkSource(text, (at, level, state) => {
    if (state.skipped || level !== 0) return;
    if (index > at) return;
    if (text[at] !== "l" || !/^let\b/.test(text.slice(at)) || (at > 0 && /[A-Za-z0-9_]/.test(text[at - 1]))) return;
    const rest = text.slice(at);
    const plain = /^let\s+([a-z][a-z0-9_]*)\s*=(?!=)/.exec(rest);
    if (plain === null) {
      const pattern = /^let\s*\{/.test(rest) ? /^let\s*\{([^}]*)\}/.exec(rest) : null;
      if (pattern !== null) {
        const names = pattern[1].split(",").map((part) => part.trim().split(":")[0].trim()).filter((part) => part !== "");
        skipped.push(names.length > 0 ? names.join(", ") : "(a destructuring let)");
        index = at + pattern[0].length;
        return;
      }
      problems.push(rest.split("\n")[0].slice(0, 60));
      index = at + 3;
      return;
    }
    const closed = statementEnd(text, at + plain[0].length);
    bindings.push({ name: plain[1], source: text.slice(at + plain[0].length, closed.end).trim() });
    index = closed.end;
    depth = 0;
  });
  const unbalanced = text.length > 0 && walkSource(text, () => {}) !== 0;
  return { bindings, skipped, problems, unbalanced };
}

/// The binding names a source text mentions as whole words, outside strings and
/// comments. A persisted binding that mentions another binding of its scope needs that
/// name in its own module, so this decides which import lines to write.
export function referencedNames(source, names) {
  const text = String(source ?? "");
  const found = [];
  walkSource(text, (at, level, state) => {
    if (state.skipped) return;
    for (const name of names ?? []) {
      if (typeof name !== "string" || name === "" || found.includes(name)) continue;
      if (!text.startsWith(name, at)) continue;
      const before = at > 0 ? text[at - 1] : "";
      const after = text[at + name.length] ?? "";
      if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) continue;
      found.push(name);
    }
  });
  return found;
}

/// The order to define bindings in so each one sees the names its source mentions:
/// dependencies first, a name that refers to itself or to a cycle reported in `cyclic`.
/// This is the order a session's prelude injects them in, and the order the import
/// lines of a written module record.
export function bindingOrder(bindings) {
  const byName = new Map((bindings ?? []).map((binding) => [binding.name, binding]));
  const ordered = [];
  const cyclic = [];
  const visiting = [];
  const visit = (name, stack) => {
    if (ordered.some((binding) => binding.name === name)) return;
    if (stack.includes(name)) {
      cyclic.push([...stack.slice(stack.indexOf(name)), name].join(" -> "));
      return;
    }
    const binding = byName.get(name);
    if (binding === undefined) return;
    for (const dep of binding.references ?? []) visit(dep, [...stack, name]);
    ordered.push(binding);
  };
  for (const binding of byName.keys()) visit(binding, []);
  return { ordered, cyclic };
}

/// The five escape sequences the language decodes. A backslash before anything else is
/// a parse error (`invalid escape sequence`), so this writes none of the others and
/// every other byte goes through a string literal raw, which the CLI accepts.
const EYG_ESCAPES = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t" };

/// One EYG string literal carrying `text` exactly: the five escapes above, everything
/// else raw.
export function eygStringLiteral(text) {
  const escaped = String(text ?? "").replace(/[\\"\n\r\t]/g, (char) => EYG_ESCAPES[char]);
  return `"${escaped}"`;
}

/// What an `extern: <scope>` call keeps and what it refuses to keep.
///
/// `keep` is the program's own top-level bindings, ordered so each one comes after the
/// names it refers to, with `references` set to the bindings of the same scope its source
/// names - the ones already kept included, since a written module imports a sibling by
/// relative path. `refused` names a binding this package will not write and why: a name
/// EYG cannot bind, a self-reference (a module cannot import itself), or a use of a
/// `<name>_lib` alias, which comes from the call's `libraries` argument and so is not in
/// scope inside a module written for a later call. `problems` reports the rest of what
/// the scan could not make sense of, so a call never keeps less than the model asked for
/// without saying so.
export function externBindings({ source, existing = [] }) {
  const scanned = topLevelBindings(source);
  const keep = [];
  const refused = [];
  for (const binding of scanned.bindings) {
    const checked = variableName(binding.name);
    if (!checked.ok) {
      refused.push({ name: binding.name, problem: checked.problem });
      continue;
    }
    const aliases = libraryAliases(binding.source);
    if (aliases.length > 0) {
      refused.push({ name: binding.name, problem: `it uses ${aliases.join(", ")}, an alias a call's libraries argument binds, which is not in scope inside a kept module: import the module inside the source instead` });
      continue;
    }
    if (referencedNames(binding.source, [binding.name]).includes(binding.name)) {
      refused.push({ name: binding.name, problem: "it names itself: a kept module cannot import itself, and recursion in EYG goes through `!fix`" });
      continue;
    }
    keep.push({ name: binding.name, source: binding.source, references: [] });
  }
  const names = [...(existing ?? []), ...keep.map((binding) => binding.name)];
  for (const binding of keep) {
    binding.references = referencedNames(binding.source, names.filter((name) => name !== binding.name));
  }
  const ordered = bindingOrder(keep);
  for (const cycle of ordered.cyclic) {
    refused.push({ name: cycle.split(" -> ")[0], problem: `bindings refer to each other (${cycle}), so no module can be written for them` });
  }
  const problems = [
    ...scanned.problems.map((text) => `cannot read the binding in \`${text}\`: it is not a plain \`let name = value\` at the top level`),
    ...scanned.skipped.map((names) => `the destructuring let (${names}) is not one binding this keeps`),
  ];
  if (scanned.unbalanced) problems.push("a top-level let never closes, so the text of its value is not certain");
  if (keep.length === 0 && scanned.bindings.length === 0) problems.push("the program defines no top-level `let` binding to keep");
  return { keep: ordered.ordered, refused, problems };
}

/// One binding as the module the tool writes: a comment naming what the file is, an
/// import for each binding of the same scope its source mentions, the `let` line whose
/// value is the source text exactly as the call wrote it, and the record that exports
/// it. The import of a sibling is relative, because an import resolves from the
/// importing file's directory and a written file must not carry this machine's paths.
export function variableModule(binding) {
  const lines = [
    "// A binding kept by the eyg tool's extern argument; a policy decided this write.",
    "// Only the source text below is kept: a call that uses this name imports this file,",
    "// so the value is computed again on that call rather than stored.",
  ];
  for (const dep of binding.references ?? []) {
    lines.push(`let {${dep}} = import ${JSON.stringify(`./${dep}.eyg`)}`);
  }
  lines.push(`let ${binding.name} = ${binding.source}`);
  lines.push(`{${binding.name}}`);
  return `${lines.join("\n")}\n`;
}

/// The line that gives a call a kept binding: a file scope's binding is its module's
/// export destructured by name, a session binding is its source text inline. Both are
/// evaluated by the call that uses them, which is why a binding of either kind answers
/// with what its source computes now, not with what it computed when it was written.
export function variablePrelude(binding) {
  if (typeof binding.path === "string" && binding.path !== "") {
    return `let {${binding.name}} = import ${JSON.stringify(binding.path)}`;
  }
  return `let ${binding.name} = ${binding.source}`;
}

/// The program that keeps a scope's files: make the directory, then write each module.
/// Every step is an ordinary effect, so the policy in force decides it and a refusal
/// arrives as the ordinary `<field> denied by policy: <path>` value - this tool has no
/// other way to write a file. Each step's answer is printed by the program itself,
/// because `run` never prints a program's value: the rows are what the caller reads, and
/// a refused write cannot read as success. The last line leaves the results as the
/// program's value as well.
export function variableWriteProgram({ dir, files }) {
  const written = files ?? [];
  if ((dir === null || dir === undefined) && written.length === 0) return null;
  const steps = [];
  if (dir !== null && dir !== undefined) {
    steps.push({ name: "made", what: "mkdir", path: dir, call: `perform MakeDirectory(${eygStringLiteral(dir)})` });
  }
  written.forEach((file, position) => {
    steps.push({
      name: `write_${position + 1}`,
      what: "write",
      path: file.path,
      call: `perform WriteFile({path: ${eygStringLiteral(file.path)}, contents: !string_to_binary(${eygStringLiteral(file.contents)})})`,
    });
  });
  const lines = [
    "// Each step is an effect, so the policy in force decides it, and each answer is",
    "// printed: a run shows what was refused rather than only an exit status.",
    "let said = (what, path, result) -> {",
    "  match result {",
    "    Ok(_) -> {",
    '      !string_append(what, !string_append(" ", !string_append(path, ": ok")))',
    "    }",
    "    Error(why) -> {",
    '      !string_append(what, !string_append(" ", !string_append(path, !string_append(": ", why))))',
    "    }",
    "  }",
    "}",
  ];
  for (const step of steps) {
    lines.push(`let ${step.name} = ${step.call}`);
    lines.push(
      `let _ = perform StandardOut(!string_append(said(${eygStringLiteral(step.what)}, ${eygStringLiteral(step.path)}, ${step.name}), "\\n"))`,
    );
  }
  lines.push(`[${steps.map((step) => step.name).join(", ")}]`);
  return `${lines.join("\n")}\n`;
}

/// What an `extern` write program left behind, one row per binding it was asked to keep,
/// in the order the `files` were given. A binding counts as kept only when both halves
/// agree: its path appears nowhere in the program's refusals, the program finished, and
/// the file is there afterwards - `present` is the scope directory read after the write,
/// which is the half the printed rows cannot show when a policy refuses `StandardOut`
/// along with the write. `null` paths and a program that did not finish are reported
/// with what stopped them, never as kept.
export function variableWriteOutcomes({ scope, keep, files, output, present, code, killed }) {
  const denied = refusalHints(output);
  const there = new Set(present ?? []);
  const pairs = files ?? [];
  return (keep ?? []).map((binding, position) => {
    const path = position < pairs.length ? pairs[position].path : null;
    const refusal = denied.find((hint) => hint.value === path);
    const finished = code === 0 && !killed;
    const exists = path !== null && there.has(path);
    const written = refusal === undefined && finished && exists;
    let problem = null;
    if (!written) {
      if (refusal !== undefined) problem = `${refusal.field} denied by the policy in force`;
      else if (exists) problem = `the write program exited ${code}${killed ? " (timed out)" : ""}`;
      else problem = `no file at ${path} after the write program ran`;
    }
    return { name: binding.name, scope, path, written, problem };
  });
}

/// The `<name>_lib` aliases a source text mentions outside strings and comments. A
/// kept binding may not use one: the alias comes from the call's `libraries` argument,
/// which is not in scope inside a module written for the next call.
export function libraryAliases(source) {
  const text = String(source ?? "");
  const found = [];
  walkSource(text, (at, level, state) => {
    if (state.skipped) return;
    const word = /^[a-z][a-z0-9_]*/.exec(text.slice(at));
    if (word === null || !word[0].endsWith("_lib")) return;
    if (at > 0 && /[A-Za-z0-9_]/.test(text[at - 1])) return;
    if (!found.includes(word[0])) found.push(word[0]);
  });
  return found;
}

/// The variable modules a run could not read. A hand-edited or half-written binding
/// file aborts every later call that imports it, and the runner's abort names the file
/// but not what to do about it, so this is the row that says so.
export function variableImportProblems(output, paths) {
  const rows = [];
  const known = paths ?? [];
  for (const match of String(output ?? "").matchAll(/failed to parse source from location: ([^\s"]+)([^"]*)/g)) {
    const file = match[1];
    // Only a module this session kept is a kept binding: the program this call
    // wrote is parsed too, and blaming it for its own parse error sends the
    // model off to redefine a binding that was never kept.
    if (!known.includes(file)) continue;
    const reason = match[2].trim().replace(/^error:\s*/, "");
    rows.push(`the kept binding in ${file} is not readable EYG:${reason === "" ? "" : ` ${reason}`}`);
    rows.push(`fix it before the next call: define ${file.split("/").pop().replace(/\.eyg$/, "")} again with an extern call, or delete the file with DeleteFile`);
  }
  return rows;
}

/// The rows naming what an `extern` call kept and what it did not, so the write and its
/// refusal are visible in the collapsed row as well as the expanded one.
export function variableRows(details) {
  const kept = details && Array.isArray(details.variables) ? details.variables : [];
  return kept.map((binding) => {
    const where = binding.path === null ? `${binding.scope} scope (this session's records)` : binding.path;
    const tone = binding.written === true || binding.scope === "session" ? "dim" : "warning";
    const said = binding.written === true || binding.scope === "session" ? `kept ${binding.name} in ${where}` : `did not keep ${binding.name}: ${binding.problem || "the write was refused"}`;
    return [{ tone, text: said }];
  });
}

/// One module as the registry sees it: its metadata record cross-checked
/// against the `perform` names in its text. The scan covers the whole module,
/// helpers included, so `effects` names the effects of the function-set as a
/// whole - what a caller needs to know before calling it. `text` comes from
/// the caller, so a test can hand a module it invented rather than a file.
export function readModule(scope, path, text) {
  const metadata = findMetadata(text);
  const declared = metadata.effects ?? [];
  const check = checkDeclaredEffects(text, declared);
  const mismatch = [];
  if (!metadata.found) {
    mismatch.push("no `let metadata = { ... }` record: name, description, signature and effects are not declared");
  }
  for (const name of check.undeclared) {
    mismatch.push(`performs ${name} but does not declare it`);
  }
  for (const name of check.unperformed) {
    mismatch.push(`declares ${name} but the body does not perform it`);
  }
  const fallback = path.replace(/\.eyg$/, "").split("/").pop();
  return {
    name: metadata.name && metadata.name !== "" ? metadata.name : fallback,
    scope,
    path,
    signature: metadata.signature,
    description: metadata.description,
    declared,
    performed: check.performed,
    mismatch,
  };
}

/// The registry, walked in scope order: a name defined in the workspace and in
/// the home resolves to the workspace one, and the later module is reported
/// rather than dropped silently.
export function buildRegistry(scopes, read) {
  const entries = [];
  const errors = [];
  const seen = {};
  for (const scope of scopes) {
    for (const path of scope.files) {
      const entry = readModule(scope.name, path, read(path));
      if (seen[entry.name]) {
        errors.push(`${path}: ${entry.name} is shadowed by ${seen[entry.name].path}`);
        continue;
      }
      seen[entry.name] = entry;
      entries.push(entry);
    }
  }
  return { entries, errors };
}
