/**
 * Pure helpers shared by the `eyg` codemode tool and its tests.
 *
 * Plain JavaScript rather than TypeScript so that `node --test pi-eyg-codemode/test/`
 * can import exactly what `extensions/eyg-codemode.ts` imports - one definition, so a
 * test cannot drift from what the tool does. Nothing here touches the file system or
 * a process: the tool does that work, these functions only shape text.
 */

import { join } from "node:path";

/// The effects the CLI implements and the policy field each is checked against.
/// Ground truth: `rule_mapping` in packages/gleam_cli/src/eyg/cli/overlay.gleam
/// (read 2026-11-16, 23 pairs). `null` is that effect's `policy.Unchecked` entry:
/// it computes over values it was given, so no policy field gates it. `Search` is
/// checked as `read_file`, the same field as `ReadFile`.
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
  Search: "read_file",
  Sign: null,
  Sleep: "sleep",
  StandardError: "standard_error",
  StandardIn: "standard_in",
  StandardOut: "standard_out",
  WriteFile: "write_file",
};

/// Effects the availability probe never attempts, with the reason:
/// `Exit` would end the probe process, `StandardIn` would swallow the runner's
/// stdin, `Env` reads the caller's environment. Their availability is reported
/// as `unknown` rather than guessed.
export const UNPROBED_EFFECTS = {
  Env: "reading the environment is not probed",
  Exit: "the probe process would stop",
  StandardIn: "the probe has no standard input",
};

/// Effects whose probe needs no path: they compute, sleep, or talk to a host
/// that can never resolve (`Fetch` names a host under the reserved TLD
/// `.invalid`).
export const NO_PATH_PROBE_ARGUMENTS = {
  Sleep: "0",
  CWD: "{}",
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
/// where this repo's runners run (`packages/gleam_cli`, the prebuilt CLI).
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

/// One effect as a whole program: the effect is the last expression, so a
/// refusal prints its reason (`<field> denied by policy: <arg>`) and the
/// runner's exit status carries the answer. `null` means no probe is defined,
/// which the tool reports as `unknown` rather than guessing.
export function probeProgram(effect, root) {
  const argument = probeArguments(effect, root);
  return argument === undefined ? null : `perform ${effect}(${argument})`;
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
/// one the CLI gates - the test in `test/render-helpers.test.mjs` compares this
/// record against the recorded `rule_mapping` snapshot in `test/fixtures/rule_mapping.gleam`,
/// and against the live runtime source when `EYG_RULE_SOURCE` names one.
export function effectLine(name, field, verdict) {
  return `${name} | ${field === null ? "none" : field} | ${verdict}`;
}

/// The reference pages this package ships. The tool names them in its rows and its
/// `reference` answer prints them, because a session that reaches the world only through
/// effects cannot read them with `ReadFile` unless the roots cover this package - and pi's
/// own `read` tool, which no policy gates, is the other half of that sentence.
export const GUIDE_BUILTINS = "guides/builtins_reference.md";
export const GUIDE_SYNTAX = "guides/syntax.md";
export const GUIDE_EFFECTS = "guides/cli_effects_reference.md";

/// The builtins a reference page lists, as rows: the `##` section it sits under, its
/// name, and the rest of its table row (signature then notes). The scan reads only the
/// first cell, because a signature may contain `|` - `(a, a) -> True({}) | False` - and a
/// cell split on `|` would cut it in half. A row that does not start with a `!name` in
/// backticks is a header, a separator or prose, and is skipped.
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

/// The effect surface as rows: each effect, and the policy field that decides it or
/// `none` when no preset can forbid it. Unlike `action: effects` this asks the policy
/// nothing - it reports the shape of the surface, which is the same whatever a preset
/// then decides inside it.
export function surfaceLines() {
  return Object.entries(POLICY_FIELDS).map(
    ([name, field]) => `  ${name} | ${field === null ? "none (no preset can forbid it)" : field}`,
  );
}

/// What `action: "reference"` answers: the builtins the shipped guide lists, the effect
/// surface with the field that gates each effect, the policy in force, and where the
/// prose lives. It performs no effect, spawns no process and asks the policy nothing, so
/// it answers on a machine with no runner as well as one with one.
export function referenceLines(markdown, { policy = null, policySource = null } = {}) {
  const rows = builtinRows(markdown);
  const lines = [`builtins: ${rows.length}, from ${GUIDE_BUILTINS} (an offline mirror of the language's page; the compiler is the source)`];
  let section = null;
  for (const row of rows) {
    if (row.section !== section) {
      section = row.section;
      lines.push(`  ## ${section}`);
    }
    lines.push(`  ${row.name} ${row.signature}`);
  }
  lines.push(`effects: ${Object.keys(POLICY_FIELDS).length} the CLI names, each with the policy field that decides it`);
  lines.push(...surfaceLines());
  if (policy !== null) {
    lines.push(`policy in force: ${policy}${policySource === null ? "" : ` (${policySource})`} - what it decides effect by effect is action "effects"`);
  }
  lines.push(`prose: ${GUIDE_SYNTAX} (syntax), ${GUIDE_EFFECTS} (every effect), ${GUIDE_BUILTINS} (builtins). pi's own read tool is not policy-gated; ReadFile is decided by the preset and reaches only the roots.`);
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
/// path, name the action that prints the list without leaving the tool, and say that pi's
/// `read` tool is not policy-gated - the fact a session has to guess at otherwise.
export function builtinHintRows(names) {
  if (!Array.isArray(names) || names.length === 0) return [];
  return [
    [{ tone: "warning", text: `no such builtin: ${names.join(", ")}` }],
    [{ tone: "warning", text: `every builtin is listed in ${GUIDE_BUILTINS} - action "reference" prints the list without leaving this tool` }],
    [{ tone: "muted", text: `the surface syntax is ${GUIDE_SYNTAX}; pi's own read tool is not policy-gated, so a session that has it can open the guide itself, while ReadFile reaches only the roots` }],
  ];
}

/// The effect names `rule_mapping` lists, in file order, from either half of its
/// entries - `policy.PolicyField("field")` or `policy.Unchecked`. Parsed from the
/// Gleam source rather than copied, so an effect added to the runtime fails the
/// comparison test instead of going unnoticed.
/**
 * Where the tool looks for a runner that checks effects, in the order it tries them.
 * `EYG_CODEMODE_RUNNER` names one path and ends the search. Otherwise: the CLI on
 * PATH; the language CLI's own build output under the working directory; and
 * `.local/eyg-checked` in the working directory, the place for a runner this machine
 * has and PATH does not carry. Every candidate is still probed for `--policy`, so a
 * candidate that is not a checked runner is simply not chosen.
 */
export function runnerCandidates(cwd, env = {}) {
  const configured = env.EYG_CODEMODE_RUNNER;
  if (configured !== undefined && configured !== "") return [configured];
  return [
    "eyg",
    join(cwd, "packages", "gleam_cli", "dist", "eyg"),
    join(cwd, ".local", "eyg-checked"),
  ];
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

/// A preset named in the settings resolves inside this package when it is a bare
/// name (`agent-roots`, `deny-all`), and is taken as given when it is an absolute
/// path. Anything else resolves to nothing, so the caller can say which key is wrong
/// instead of running a module nobody named.
export function presetPath(policy, packageDirectory) {
  if (typeof policy !== "string" || policy === "") return null;
  if (policy.startsWith("/")) return policy;
  if (/^[a-z][a-z0-9-]*$/.test(policy)) return join(packageDirectory, "policies", `${policy}.eyg`);
  return null;
}

/// Which policy checks this call, first name wins. The order is the whole rule and
/// is stated once here: the argument of the call, a grant the operator made this
/// session, the policy the spawner of a subagent session named, the project's
/// `eyg.policy` key, `EYG_POLICY`, the preset shipped in this package, and nothing if
/// none of them names a module - a program is never run unchecked. The grant slot is
/// filled from the session branch (`grantEvents`, `replayGrants`); the spawner slot is
/// filled from the environment only for a session this package started, which is why a
/// subagent can be narrowed by whoever started it even in a project that names its own
/// preset (`notes/pi-codemode-session-grants.md`).
export function resolvePolicy({ argument = null, grant = null, spawner = null, project = null, env = null, packageDefault = null } = {}) {
  const steps = [
    ["argument", argument],
    ["session grant", grant],
    ["spawner", spawner],
    ["project settings", project],
    ["EYG_POLICY", env],
    ["package default", packageDefault],
  ];
  for (const [source, value] of steps) {
    if (typeof value === "string" && value !== "") return { policy: value, source };
  }
  return { policy: null, source: "none" };
}

/// Which roots the preset reads. Roots a spawner narrowed this session to win, then
/// the project's `eyg.roots`, then `EYG_ALLOWED_ROOTS`, then the working directory,
/// and whatever roots a grant the operator made this session adds on top. Answered as
/// the comma-separated list the shipped preset parses, deduplicated so a grant that
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

/// One grant as one line, with what it costs the session still to spend.
export function describeGrant(grant) {
  const duration = grant.calls === null
    ? "for the rest of the session"
    : `for ${grant.calls} tool call${grant.calls === 1 ? "" : "s"} (${grant.used} used)`;
  const roots = grant.roots.length > 0 ? ` roots + ${grant.roots.join(", ")}` : "";
  return `${grant.id}: ${grant.policy} ${duration}${roots}`;
}

/// The refusals in a run's output, as `{field, path}` pairs, one per distinct pair.
/// The marker is the one the runtime prints (`<field> denied by policy: <path>`),
/// already relied on by `classifyProbeOutput`.
export function refusalHints(output) {
  const hints = [];
  for (const match of String(output ?? "").matchAll(/\b([a-z_]+) denied by policy: ([^\s"]+)/g)) {
    const hint = { field: match[1], path: match[2] };
    if (!hints.some((seen) => seen.field === hint.field && seen.path === hint.path)) hints.push(hint);
  }
  return hints;
}

/// The first directory of `path` that no root in force covers: the root an operator
/// would have to add to let `path` through a roots-driven preset. `null` when the
/// path is already under a root, which means the refusal is a rule of the preset and
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
/// point of the loop. When no root would help, the honest answer is that the preset's
/// own rule refused the value.
export function suggestGrant(hint, { roots, policy }) {
  const root = outsideRoot(hint.path, String(roots ?? "").split(","));
  const what = root === null
    ? `a policy module whose ${hint.field} rule admits ${hint.path} (the refusal is a rule of ${policy}, not a root: no ${roots} addition covers it)`
    : `policy agent-roots (or one of your own) with roots + ${root}`;
  return [
    `refused: ${hint.field} at ${hint.path} under ${policy}`,
    `to allow it the operator runs /eyg-grant and chooses ${what}, for one tool call, N calls, or the rest of the session`,
    "you cannot grant it yourself: ask, then retry the same program",
  ];
}

/// A policy named in a tool call argument. A model may choose among the presets this
/// package ships - both of them narrower-or-equal to what the session already has -
/// and may not name a module of its own: `WriteFile` inside the roots plus an
/// absolute path here would let a program write its own permission and hand it to the
/// runner, which is the route the grant loop exists to close (`notes/pi-codemode-session-grants.md`).
export function argumentPolicyPath(value, packageDirectory) {
  if (typeof value !== "string" || value === "" || value.startsWith("/")) return null;
  if (!/^[a-z][a-z0-9-]*$/.test(value) || packageDirectory === null) return null;
  return join(packageDirectory, "policies", `${value}.eyg`);
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
/// operator has to see the ask without opening the row.
export function refusalRows(details) {
  const rows = [];
  for (const hint of (details && Array.isArray(details.refusals) ? details.refusals : [])) {
    const lines = suggestGrant(hint, { roots: (details && details.roots) || "", policy: (details && details.policy) || "" });
    rows.push([{ tone: "warning", text: lines[0] }]);
    rows.push([{ tone: "warning", text: lines[1] }]);
  }
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
export const SPAWNER_PRESET_NEVER = ["CreateKey", "Fetch", "StandardIn"];

/// The effects naming in the allowlist cannot change the answer for. `Env` returns an
/// Option, so `Mock(None({}))` - the honest "unset" - is the only refusal the effect's
/// own type allows, and it is what the preset answers named or not.
export const SPAWNER_PRESET_NOOP = ["Env"];

/// The tools a spawner may hand a child. `eyg` is this package's channel and must be
/// there: a child with only `read` would be a session whose every effect is decided by
/// the harness rather than by a policy module, which is the promise this package exists
/// to keep. `read` is pi's own tool and no policy gates it, so granting it hands the
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

/// The effects a spawner names are effect names; the preset decides by field, and two
/// names share a field (`Search` is gated as `read_file`, the field `ReadFile` is
/// decided by). `unknown` is a name the CLI does not have; `unchecked` is one of the
/// four no preset can forbid, reported rather than enforced.
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

/// The effect fields the child's narrowing preset performs, comma separated. The preset
/// reads it the way `agent-roots.eyg` reads `EYG_ALLOWED_ROOTS`: the runner evaluates the
/// policy module outside the program's own gate, so the child's program cannot read it,
/// and an unset or empty value names no field at all.
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
/// preset parses them.
export function spawnerRoots(env = {}, depth = sessionDepth(env)) {
  if (depth < 1) return [];
  const value = env?.EYG_ALLOWED_ROOTS;
  if (typeof value !== "string") return [];
  return value.split(",").map((root) => root.trim()).filter((root) => root !== "");
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
  lines.push([{ tone: "dim", text: `tools: ${tools.join(", ")}${tools.includes("read") ? " (pi's read tool is not policy-gated)" : ""}` }]);
  const effects = Array.isArray(params.effects) ? params.effects.filter((effect) => typeof effect === "string" && effect !== "") : [];
  if (effects.length > 0) {
    const mapped = effectFieldsFor(effects);
    lines.push([{ tone: "accent", text: `effects: ${mapped.fields.join(", ") || "none"} under the spawner allowlist preset` }]);
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
    rows.push([{ tone: "warning", text: `child refused: ${hint.field} at ${hint.path} under ${(details && details.policy) || ""}` }]);
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
