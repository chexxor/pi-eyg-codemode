/**
 * EYG codemode - the agent's only channel to the outside world.
 *
 * The model calls one tool, `eyg`, with EYG source. The tool spawns the
 * runner (`eyg run --policy <module.eyg>`) so the interpreter stops at every
 * effect and the host policy module decides Pass or Mock before the host
 * performs it. A denied effect resumes the program with an EYG error such as
 * `write_file denied by policy: /abs/path`, which the model can act on; the
 * filesystem is unchanged because the host never performed the write.
 *
 * The tool renders like the built-in `bash` tool: the collapsed row names the
 * effects the program performs and shows the first lines of its source, and
 * expanding it (pi's `Ctrl+O` toggle, or a click) shows the whole program and
 * the whole output. Wall time is in both the render and the model-facing text.
 * `timeout` is in seconds, as bash spells it; the cap is still 120 s and
 * `EYG_CODEMODE_TIMEOUT` is still milliseconds.
 *
 * The tool also keeps a registry of re-usable EYG functions, one module per
 * function-set, read from three scopes (workspace, home, this package's own
 * `libraries/`) and listed with its signature, description, required effects
 * and whether the policy in force can currently perform each of them. The tool
 * only ever reads those scopes; a function's own author writes the file with
 * their normal effects. See README.md for the metadata shape and the scope
 * table.
 *
 * Nothing is configured by hand. With no `policy` argument, no grant and no
 * `EYG_POLICY` the tool uses the policy the installed package ships
 * (`<package>/policies/agent-roots.eyg`) and that policy's roots default to the
 * session working directory, so a first session can read and write its own
 * workspace and nothing else. `resolvePolicy` and `resolveRoots` in
 * `lib/render-helpers.mjs` hold the one order a call's policy and roots come from,
 * and every default below is named by the file it comes from; see the README table.
 *
 * A refusal is the start of a negotiation, not a dead end: the result names the
 * refused path and the exact grant that would allow it, and `/eyg-grant` is how the
 * operator answers - a policy or module path, roots to add, and a duration of one
 * tool call, N calls or the rest of the session. The grant is a session entry the
 * human's command appends, never a tool parameter, so a program cannot widen itself
 * (`notes/pi-codemode-session-grants.md`).
 *
 * Configure the runner and the policy with environment variables to point one
 * session at one policy without editing this file:
 *
 *   EYG_CODEMODE_RUNNER   absolute path to the runner (default: `eyg` on PATH)
 *   EYG_POLICY            absolute path to the policy module (default: the package's)
 *   EYG_ALLOWED_ROOTS     comma separated absolute roots for the default policy
 *   EYG_CODEMODE_TIMEOUT  ms for one call (default 30000, capped at 120000)
 *
 * The runner must accept `run --policy <module.eyg>`: `--policy` is what makes the run
 * checked, and a run without it is ungated (`notes/pi_codemode_host_gate.md`
 * records why a policy inside the program is not a restriction). Nothing is asked of the
 * binary in advance: every argv this tool builds carries the flag, and a binary too old
 * for it says so, which `runnerFailureLine` turns into one line the model can act on.
 */

import { defineTool, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import {
  argumentPolicyPath,
  budgetRefusal,
  buildRegistry,
  builtinErrors,
  builtinHintRows,
  callBudget,
  callLines,
  CHILD_TOOL_ALLOWLIST,
  childAnswer,
  childArgv,
  childCalls,
  childEnvOverrides,
  childRefusalRows,
  childTools,
  checkDeclaredEffects,
  classifyProbeOutput,
  DEPTH_ENV,
  describeGrant,
  EFFECT_ALLOWLIST_ENV,
  effectFieldsFor,
  effectLine,
  effectsUsed,
  eygCallCount,
  fieldsOutside,
  findMetadata,
  formatDuration,
  grantEvents,
  GRANT_ENTRY,
  LANGUAGE_DOCS,
  MAX_CALLS_ENV,
  prepareCallArguments,
  probeProgram,
  referenceLines,
  refusalHints,
  replayGrants,
  resultLines,
  resolvePolicy,
  resolveRoots,
  runnerCandidates,
  runnerFailureLine,
  rootsInside,
  sessionDepth,
  spawnerPolicy,
  spawnerRoots,
  subagentCallLines,
  subagentResultRows,
  suggestGrant,
  surfaceRows,
  SURFACE_FILE,
  eygSettings,
  shippedPolicyPath,
  POLICY_FIELDS,
  NARROWEST_POLICY_FILE,
  SPAWNER_POLICY_NEVER,
  SPAWNER_POLICY_NOOP,
  UNPROBED_EFFECTS,
} from "../lib/render-helpers.mjs";

/// The shape the tool reads for a registry module, after the file work.
interface RegistryEntry {
  name: string;
  scope: string;
  path: string;
  signature: string | null;
  description: string | null;
  declared: string[];
  performed: string[];
  mismatch: string[];
}

const DEFAULT_TIMEOUT_S = 30;
const MAX_TIMEOUT_S = 120;
const SUBAGENT_DEFAULT_TIMEOUT_S = 120;
const SUBAGENT_MAX_TIMEOUT_S = 300;
const MIN_TIMEOUT_MS = 100;
const PROBE_TIMEOUT_MS = 5_000;
const ACTIONS = ["run", "eval", "effects", "reference", "list_functions", "describe_function"];
/// The policy a spawner's effect allowlist is enforced by, and the policy it is a
/// narrowing of. Both live inside this package, so the two paths are resolved here
/// rather than written out.
const NARROWING_POLICY = "spawner-effects";
const BASE_POLICY = "agent-roots";

/// What a call in this session gets from everything except the call's own argument:
/// the project settings, and the grants on this session's branch. `error` names what
/// is wrong in the settings instead of running a module nobody named. Both tools read
/// the chain, so the settings are validated one way.
type PolicyChain = {
  error: string | null;
  settings: { policy: string | null; roots: string[] };
  projectPolicy: string | null;
  grants: ReturnType<typeof replayGrants>;
  depth: number;
};

function policyChain(pi: ExtensionAPI, ctx: unknown, dir: string | null): PolicyChain {
  const depth = sessionDepth(process.env);
  const settings = eygSettings(typeof pi.getSettings === "function" ? pi.getSettings() : {});
  const projectPolicy = settings.policy === null ? null : shippedPolicyPath(settings.policy, dir);
  const empty = replayGrants([]);
  if (settings.policy !== null && projectPolicy === null) {
    return { error: `eyg.policy in the project settings must name a shipped policy or an absolute module path, got ${settings.policy}`, settings, projectPolicy: null, grants: empty, depth };
  }
  const relativeRoot = settings.roots.find((root) => !root.startsWith("/"));
  if (relativeRoot !== undefined) {
    return { error: `every eyg.roots entry must be an absolute path, got ${relativeRoot}`, settings, projectPolicy, grants: empty, depth };
  }
  return { error: null, settings, projectPolicy, grants: grantState(ctx as { sessionManager?: { getBranch?: () => unknown[] } }), depth };
}

function refuseToRun(reason: string) {
  return {
    content: [{ type: "text", text: `eyg refused: ${reason}` }],
    details: { gated: true, ran: false },
  };
}

/// The directory of the package that carries this extension. An installed
/// package is loaded from its own path (`pi list` prints it), so the file this
/// module was loaded from is inside the package, and `policies/` is one level
/// up from `extensions/`. Null when the module was not loaded from a file on
/// disk, in which case the caller has to name the policy.
function packageDir(): string | null {
  const url = import.meta.url;
  if (typeof url !== "string" || !url.startsWith("file:")) {
    return null;
  }
  const module = fileURLToPath(url);
  const dir = dirname(dirname(module));
  return existsSync(join(dir, "package.json")) ? dir : null;
}

/// The shipped default policy, resolved inside the package rather than
/// hardcoded to an absolute path, so the same package works when installed
/// from npm, git or a local directory.
function defaultPolicy(): string | null {
  const dir = packageDir();
  if (dir === null) {
    return null;
  }
  const policy = join(dir, "policies", "agent-roots.eyg");
  return existsSync(policy) ? policy : null;
}

/// The registry scopes, in scope order, first match wins on a name clash.
/// `workspace` is the default scope: a function the agent wrote for this
/// session. `home` is the package scope the operator described - every
/// workspace that carries this package sees it. `package` is this package's
/// own shipped libraries, so `search` is listed like any other function.
/// The tool never writes to any of these; it reads them and stops.
function registryScopes(cwd: string, dir: string | null) {
  const scopes = [{ name: "workspace", dir: join(cwd, ".pi", "eyg-functions") }];
  const home = process.env.HOME;
  if (home && home !== "") {
    scopes.push({ name: "home", dir: join(home, ".pi", "eyg-functions") });
  }
  if (dir !== null) {
    scopes.push({ name: "package", dir: join(dir, "libraries") });
  }
  return scopes.filter((scope) => existsSync(scope.dir));
}

function listModules(dir: string): string[] {
  try {
    return readdirSync(dir).filter((file) => file.endsWith(".eyg")).sort();
  } catch {
    return [];
  }
}

/// The policies this package ships, as the bare names a call may choose. A call may
/// narrow itself to one of these and may not name a module of its own: a program
/// that could write a permissive policy inside its own roots and hand the runner its
/// path would be granting itself, which is the route the grant loop closes
/// (`notes/pi-codemode-session-grants.md`).
function shippedPolicies(dir: string | null): string[] {
  if (dir === null) return [];
  return listModules(join(dir, "policies")).map((file) => file.replace(/\.eyg$/, ""));
}

/// The entries on the branch this call is being made on, in the shape `grantEvents`
/// and `eygCallCount` read. One place reads the session store, so a grant and a call
/// budget are counted off the same records.
function sessionBranch(ctx: { sessionManager?: { getBranch?: () => unknown[] } }): unknown[] {
  return ctx.sessionManager && typeof ctx.sessionManager.getBranch === "function" ? ctx.sessionManager.getBranch() : [];
}

/// The grants in force for the branch this call is being made on. There is no grant
/// variable in this file: the records `/eyg-grant` appended and the eyg calls already
/// on the branch say what is in force now, so `/tree` and a fork replay a grant and a
/// truncated branch un-spends the calls it dropped. The current call is not on the
/// branch yet, so it is not counted against its own grant.
function grantState(ctx: { sessionManager?: { getBranch?: () => unknown[] } }) {
  return replayGrants(grantEvents(sessionBranch(ctx)));
}

/// The registry scopes that exist, in scope order. The scope order is the
/// whole rule: a name defined in the workspace and in the home resolves to the
/// workspace one. `buildRegistry` in `lib/render-helpers.mjs` walks these; the
/// reading of a module is done here, with the file system, because a test can
/// then walk a scope it invented.
function scopeFiles(cwd: string, dir: string | null) {
  return registryScopes(cwd, dir).map((scope) => {
    return {
      name: scope.name,
      dir: scope.dir,
      files: listModules(scope.dir).map((file) => join(scope.dir, file)),
    };
  });
}

/// Read every scope in order. A name defined twice is a shadow, not a merge:
/// the first scope wins and the later module is reported, so an agent that
/// redefined a home-scope function in the workspace can see what happened.
/// Reading one module's text. The tool only ever reads the registry scopes;
/// it never writes, moves or creates anything in them.
function readFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/// A library or registry function by name, resolved through the scope order so
/// `libraries: ["search"]` keeps working and a workspace module shadows the
/// package one. The entries come from `buildRegistry`, so the answer is the
/// module the listing showed the agent.
function functionSource(name: string, cwd: string, dir: string | null): string | null {
  const registry = buildRegistry(scopeFiles(cwd, dir), (path) => readFile(path));
  const byName = registry.entries.filter((entry) => entry.name === name);
  if (byName.length > 0) {
    return byName[0].path;
  }
  const byFile = registry.entries.filter((entry) => basename(entry.path).replace(/\.eyg$/, "") === name);
  return byFile.length > 0 ? byFile[0].path : null;
}

/// The tones `callLines` and `resultLines` name, painted with the theme. Only
/// this map belongs to the renderer: the text shapes live in
/// `lib/render-helpers.mjs`, where the tests read them without a theme.
const tones = {
  title: (theme: Theme, text: string) => theme.fg("toolTitle", theme.bold(text)),
  accent: (theme: Theme, text: string) => theme.fg("accent", text),
  dim: (theme: Theme, text: string) => theme.fg("dim", text),
  muted: (theme: Theme, text: string) => theme.fg("muted", text),
  warning: (theme: Theme, text: string) => theme.fg("warning", text),
  error: (theme: Theme, text: string) => theme.fg("error", text),
  success: (theme: Theme, text: string) => theme.fg("success", text),
  code: (_theme: Theme, text: string) => text,
};

function paint(theme: Theme, segments: { tone: string; text: string }[]) {
  return segments.map((segment) => {
    const tone = tones[segment.tone] ?? tones.code;
    return tone(theme, segment.text);
  }).join("");
}

/// The runner this call starts is the first candidate `runnerCandidates` names - the path
/// the operator named, else `eyg` on `PATH`. The candidate order lives in
/// `lib/render-helpers.mjs`, where the tests read it. Nothing is asked of the binary
/// before the run: `--policy` is in every argv this tool builds, and a binary that does
/// not know that command is answered with one line (`runnerFailureLine`).

export default function (pi: ExtensionAPI) {
  pi.registerTool(defineTool({
    name: "eyg",
    label: "EYG codemode",
    description: [
      "Run an EYG program. A program reaches the outside world only through EYG",
      "effects (ReadFile, WriteFile, AppendFile, DeleteFile, MakeDirectory, ReadDirectory, Search, Fetch, Env, Exit, StandardOut, ...) and the host policy module decides each one",
      "before the host performs it. A refused effect resumes the program with an EYG",
      "error such as `write_file denied by policy: /abs/path` and nothing on disk changes",
      "- treat that as a fact about the permission, not as a failure of the program.",
      "There is no shell, no package manager and no way to change the policy from inside",
      "a program; a program that needs a denied effect must ask for it and stop.",
      "By default the program runs under the package's policy over the session working",
      "directory: reads and writes inside that directory are performed, everything else",
      "is refused and reported. mode `eval` is pure and prints the value; mode `run`",
      "performs effects.",
      "An effect is performed with the `perform` keyword and one argument: `let text = perform ReadFile({path: \"/abs/file\", offset: 0, limit: 2000})`, `let written = perform WriteFile({path: \"/abs/file\", contents: !string_to_binary(\"text\")})`, `let found = perform ReadDirectory(\"/abs/dir\")`, `perform StandardOut(\"text\")` on the last line. A performed effect that is not the last line must be bound with `let`, otherwise the program does not parse.",
      "To find files, pass libraries: [\"search\"] and call `search_lib.search({root, pattern, limit})`: it walks the roots with the effects the policy decides, so it cannot see outside them.",
      "`perform Search({path: \"/abs/dir\", pattern: \"**/*.eyg\", limit: 20})` is one host action that lists matching paths under a root; the policy decides it once for the whole walk.",
      "EYG has no infix operators - add integers with `!int_add(a, b)`; a bare `WriteFile(...)` is a function call and fails to parse.",
      "action selects what the call does: `run` (default) performs effects, `eval` is pure,",
      "`effects` answers what the policy in force decides for every effect the CLI can name,",
      "`reference` prints every builtin the package's reference guide lists and the effect",
      "surface with the field that decides each one - it performs nothing and asks the policy",
      "nothing, so it answers even where no runner was found,",
      "`list_functions` lists the registry of re-usable EYG functions (pass code: \"\"), and",
      "`describe_function` describes one of them by name. Pass `timeout` in SECONDS for the wall",
      "time of one call (default 30, at most 120); every result says how long the run took",
      "in wall time.",
      "A registry function carries a description, a signature and the effects it needs;",
      "`list_functions` also says whether the policy in force can perform each of them, which",
      "is advisory only: running a function whose effect is refused is not blocked, the",
      "refusal surfaces as the ordinary Error(...) value inside the program.",
      "A refusal is an ask you make in chat, not a thing you work around: the result names",
      "the refused path and the exact grant that would allow it. Ask the operator to run",
      "/eyg-grant and choose a policy (or an absolute module path), the roots to add and a",
      "duration - one tool call, N calls, or the rest of the session - with your recommendation",
      "(the narrowest that retries the refused program), then retry the same program.",
      "No parameter of this tool widens a policy: `policy` may name only the policy this call already runs under, or the narrowest shipped policy (`deny-all`).",
    ].join(" "),
    promptSnippet: "Run an EYG program whose every effect is decided by a host policy module",
    promptGuidelines: [
      "Use the eyg tool for every side effect in this session; it is the only channel to the outside world.",
      "When eyg returns a `denied by policy` message, change what the program asks for or report the refusal; do not search for another way to run a command.",
      "A refused eyg effect is a value, not a crash: bind it with a name you use (`let written = perform WriteFile(...)`) and report `written`, because `let _ =` discards the refusal and makes the call look like success when nothing was written.",
      "Use eyg mode eval for a pure computation and eyg mode run when the program performs effects.",
      "Write an eyg effect as `perform Name(argument)`, bound with `let name =` or `let _ =` when another expression follows; `Name(argument)` alone is a function call and fails to parse.",
      "Every eyg path must be absolute: the policy sees absolute paths, and relative paths are resolved from the session's working directory before the policy decides.",
      "Find files with `perform Search({path, pattern, limit})` - one host action, one policy decision, absolute paths you can hand to ReadFile; a refusal is `Error(\"read_file denied by policy: /abs/root\")`.",
      "A search lists names under an allowed root, including names of files a read of would be refused for, so a listed path is not permission to read it.",
      "On a runtime without the `Search` effect, ask for the package's library instead of writing a walk: `libraries: [\"search\"]` and `search_lib.search({root, pattern, limit})`.",
      "Before writing a helper, call `action: \"list_functions\"` - the registry names re-usable EYG functions with their signature, description and required effects; a function you need may already exist.",
      "When a capability question is in the air, call `action: \"effects\"` once instead of probing effects one program at a time: it runs one probe per effect under the policy in force and answers effect | policy field | decision. `guides/eyg-surface.tsv` lists every effect the CLI names and the policy field that decides it.",
      "When a run answers `builtin undefined`, do not guess another name: the result rows name `guides/eyg-surface.tsv`, and `action: \"reference\"` prints the builtins and the effect surface in one call without performing an effect. pi's own `read` tool is not decided by a policy, so a session that has it can open that file directly; `ReadFile` reaches only the roots.",
      "Pass `timeout` in seconds when a run is longer than 30 s; the result says how long it took in wall time, so a timeout is visible rather than guessed.",
      "The effects listed for a registry function are advisory: availability is re-probed at each listing and the policy can change mid-session, and a run whose effect is refused simply gets the ordinary Error value.",
      "When an effect is refused, report what was refused and ask the operator for the grant the result names (/eyg-grant: one call, N calls, or the rest of the session), recommending the narrowest one that retries the refused program; then retry it. Never write a policy module of your own and never look for another channel.",
    ],

    parameters: Type.Object({
      code: Type.String({
        description: "EYG source. The last expression is the value; use Exit or the record `script` field for a status. Pass \"\" for action list_functions, describe_function or reference.",
      }),
      action: Type.Optional(
        Type.String({
          description:
            "`run` (default, effects allowed by the policy), `eval` (pure, prints the value), `effects` (one probe per effect the CLI can name, answered by the policy in force), `reference` (every builtin the shipped guide lists, plus the effect surface), `list_functions` (the registry of re-usable functions) or `describe_function` (one of them by name).",
        }),
      ),
      function: Type.Optional(
        Type.String({ description: "Function name for action describe_function." }),
      ),
      timeout: Type.Optional(
        Type.Number({
          description: `Wall time for the call in SECONDS, like the bash tool spells it: default ${DEFAULT_TIMEOUT_S}, at most ${MAX_TIMEOUT_S}.`,
        }),
      ),
      policy: Type.Optional(
        Type.String({
          description:
            "Name the policy this call already runs under, or `deny-all` (the narrowest policy this package ships), to narrow this call. Any other name is refused, and so is an absolute module path: a wider policy comes from the operator's /eyg-grant, the project's eyg.policy key, or EYG_POLICY.",
        }),
      ),
      libraries: Type.Optional(
        Type.Array(
          Type.String({
            description:
              "Names of modules to bind as `<name>_lib` before the program runs: library modules shipped in this package (`search`), or registry functions in the workspace, home or package scope.",
          }),
        ),
      ),
    }),

    /// `timeout` is in seconds now; `timeout_ms` is what a session resumed from an
    /// older version of this package sends, and `mode` is what it sent instead of
    /// `action`. Both are mapped here rather than added to the schema, so the
    /// model never sees a field it should not use.
    /// `timeout` is in seconds now; `timeout_ms` is what a session resumed from an
    /// older version of this package sends, and `mode` is what it sent instead of
    /// `action`. The mapping lives in `lib/render-helpers.mjs` so the tests read
    /// the same function, and no deprecated field is in the schema above.
    prepareArguments: (raw) => prepareCallArguments(raw),

    /// The collapsed row and the expanded row, in shapes `callLines` defines in
    /// `lib/render-helpers.mjs` so a test can assert them: collapsed is the effects
    /// the program performs plus the first lines of it, expanded is the whole
    /// program. Colour is applied here, per render, never cached across themes.
    renderCall: (args, theme, context) => {
      const lines = callLines(args, context.expanded);
      return new Text(lines.map((line) => paint(theme, line)).join("\n"), 0, 0);
    },

    /// The result row: the status line, the timing, and - when expanded - the
    /// whole output, in the shape `resultLines` defines. `context.durationMs` is
    /// pi's own measurement of the call and `details.durationMs` is this tool's
    /// measurement of the spawn; the two agree. A partial result answers with
    /// elapsed time so a long run is visibly long rather than silent.
    renderResult: (result, options, theme, context) => {
      const measured = context.durationMs ?? (result.details && typeof result.details.durationMs === "number" ? result.details.durationMs : undefined);
      const startedAt = context.state && typeof context.state.startedAt === "number" ? context.state.startedAt : undefined;
      const elapsed = options.isPartial && startedAt !== undefined ? Date.now() - startedAt : undefined;
      const rows = resultLines(result, options.expanded, measured, elapsed);
      return new Text(rows.map((row) => paint(theme, row)).join("\n"), 0, 0);
    },

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const startedAt = Date.now();
      const cwd = ctx.cwd || process.cwd();
      const dir = packageDir();
      const action = params.action ?? "run";
      if (!ACTIONS.includes(action)) {
        return refuseToRun(`action must be one of ${ACTIONS.join(", ")}, got ${action}`);
      }

      // The policy: the argument of this call, a grant the operator made this
      // session, the project's `eyg.policy` key, `EYG_POLICY`, the policy shipped
      // in this package - `resolvePolicy` in `lib/render-helpers.mjs` holds that
      // order and the tests read it. A program is never run without one: an
      // unchecked run performs every effect the host can reach, and a registry
      // availability probe is answered by the same policy that will run the program.
      const chain = policyChain(pi, ctx, dir);
      if (chain.error !== null) {
        return refuseToRun(chain.error);
      }

      // A child session spends the call budget the session that spawned it set. The
      // count comes from this session's own records, the same scan a grant is spent
      // by, so a call that never reached a policy spends nothing and a forked or
      // resumed session cannot forget what it already spent. The budget is the
      // spawner's to set: no parameter of a call can raise it, and a grant the
      // operator made never reaches a child session.
      const budget = callBudget(process.env, chain.depth);
      if (budget !== null) {
        const spent = eygCallCount(sessionBranch(ctx));
        if (spent >= budget) {
          return {
            content: [{ type: "text", text: `eyg refused: ${budgetRefusal(budget, spent)}` }],
            details: { gated: true, ran: false, budget, callsMade: spent, depth: chain.depth },
          };
        }
      }
      const settings = chain.settings;
      const projectPolicy = chain.projectPolicy;
      const grants = chain.grants;
      const grantDetails = { grants: grants.grants, grantId: grants.active === null ? null : grants.active.id };
      const shippedNames = shippedPolicies(dir);
      const argumentPolicy = params.policy === undefined ? null : argumentPolicyPath(params.policy, dir);
      if (params.policy !== undefined && argumentPolicy === null) {
        return refuseToRun(
          `the policy argument may only name a policy this package ships (${shippedNames.join(", ") || "none"}), not a module of its own: got ${params.policy}. ` +
            "A wider policy is the operator's to give: /eyg-grant for this session, eyg.policy in the project settings, or EYG_POLICY.",
        );
      }
      const chosen = resolvePolicy({
        argument: argumentPolicy,
        grant: grants.policy,
        spawner: spawnerPolicy(process.env, chain.depth),
        project: projectPolicy,
        env: process.env.EYG_POLICY ?? null,
        packageDefault: defaultPolicy(),
      });
      const policy = chosen.policy ?? "";
      const policySource = chosen.source;
      // The argument is the one policy slot a program controls, so it is the one slot
      // that has to be proved narrower: the module this call already runs under, or
      // `NARROWEST_POLICY_FILE`. Anything else is a widening the operator has to make,
      // and `resolvePolicy` says which name it refused rather than running the wider
      // module quietly (`notes/pi-codemode-session-grants.md`).
      if (chosen.refusedArgument !== null && chosen.refusedArgument !== undefined) {
        return refuseToRun(
          `the policy argument may only narrow: ${chosen.refusedArgument} is not the policy this call runs under (${policy} from ${policySource}) and is not the narrowest shipped policy (${NARROWEST_POLICY_FILE}), so it would widen the session. ` +
            "A wider policy is the operator's to give: /eyg-grant for this session, eyg.policy in the project settings, or EYG_POLICY.",
        );
      }
      if (policy === "") {
        return refuseToRun(
          "no policy module was configured and this package ships no policy of its own. Set eyg.policy in the project settings, set EYG_POLICY to an absolute path, or pass policy. A program is never run ungated.",
        );
      }
      if (!policy.startsWith("/")) {
        return refuseToRun(`policy must be an absolute path, got ${policy}`);
      }
      if (!existsSync(policy)) {
        return refuseToRun(`policy module not found: ${policy}`);
      }

      // `reference` answers the two questions a session whose only channel is effects
      // keeps asking - which builtins exist, and what the effect surface is - from the one
      // surface file this package ships and generates. It spawns no process, performs no
      // effect and asks the policy no question, so it answers on a machine with no runner
      // as well; `action: effects` is the call that asks the policy what it decides for
      // each effect, and it is offered in the last line of the answer.
      if (action === "reference") {
        const surfacePath = dir === null ? null : join(dir, SURFACE_FILE);
        const surfaceText = surfacePath !== null && existsSync(surfacePath) ? readFileSync(surfacePath, "utf8") : "";
        const lines = referenceLines(surfaceText, { policy, policySource });
        if (surfaceText === "") {
          lines.unshift(`this package carries no ${SURFACE_FILE}: <${LANGUAGE_DOCS}> does`);
        }
        const rows = surfaceRows(surfaceText);
        return {
          content: [{ type: "text", text: [`eyg reference: ${rows.filter((row) => row.kind === "builtin").length} builtins, ${rows.filter((row) => row.kind === "effect").length} effects, nothing performed`, ...lines].join("\n") }],
          details: {
            gated: true,
            ran: true,
            action,
            policy,
            policySource,
            builtinCount: rows.filter((row) => row.kind === "builtin").length,
            effectCount: rows.filter((row) => row.kind === "effect").length,
            ...grantDetails,
          },
        };
      }

      const candidates = runnerCandidates(cwd, process.env);
      const runner = candidates[0];

      // One spawned program: the mode, the source and the wall-time cap. The
      // roots the default policy reads from `EYG_ALLOWED_ROOTS` are set for the
      // call and restored after it, since a spawned child inherits `process.env`.
      // The project's `eyg.roots` win over an inherited `EYG_ALLOWED_ROOTS`, both
      // over the working directory, and a grant in force adds roots on top of the
      // result - `resolveRoots` holds that order.
      const roots = resolveRoots({ grant: grants.roots, spawner: spawnerRoots(process.env, chain.depth), project: settings.roots, env: process.env.EYG_ALLOWED_ROOTS ?? null, cwd });
      const spawn = async (mode: string, source: string, timeoutMs: number) => {
        const previousRoots = process.env.EYG_ALLOWED_ROOTS;
        process.env.EYG_ALLOWED_ROOTS = roots;
        const startedAt = Date.now();
        try {
          // A binary that is not there at all comes back as a failed spawn whose stderr
          // names `ENOENT` (`pi.exec` does not throw for it), which `runnerFailureLine`
          // turns into the one line the model can act on.
          const result = await pi.exec(runner, [mode, "--policy", policy, "-c", source], { signal, timeout: timeoutMs, cwd });
          return {
            result,
            out: [result.stdout, result.stderr].filter((text) => text !== "").join("\n"),
            durationMs: Date.now() - startedAt,
          };
        } finally {
          if (previousRoots === undefined) {
            delete process.env.EYG_ALLOWED_ROOTS;
          } else {
            process.env.EYG_ALLOWED_ROOTS = previousRoots;
          }
        }
      };

      // `effects` is the capability question one session keeps asking: which effects
      // the policy in force will perform. Every probe is a whole spawned program, so
      // the answer comes from the same policy that will decide the real program rather than
      // from a copy of the policy in this file. Probes are chosen by `probeArguments`
      // to fail at the host before they could change anything.
      if (action === "effects") {
        const probeTimeoutMs = Math.min(PROBE_TIMEOUT_MS, MAX_TIMEOUT_S * 1000);
        const probeRoot = roots.split(",")[0].trim();
        const rows: string[] = [];
        let probes = 0;
        const startedAt = Date.now();
        for (const name of Object.keys(POLICY_FIELDS)) {
          const field = POLICY_FIELDS[name];
          if (field === null) {
            rows.push(effectLine(name, null, "unchecked (computes over values it was given)"));
            continue;
          }
          const unprobed = UNPROBED_EFFECTS[name];
          if (unprobed !== undefined) {
            rows.push(effectLine(name, field, `unknown (${unprobed})`));
            continue;
          }
          const program = probeProgram(name, probeRoot);
          if (program === null) {
            rows.push(effectLine(name, field, "unknown (no probe argument is defined for this effect)"));
            continue;
          }
          const outcome = await spawn("run", program, probeTimeoutMs);
          probes = probes + 1;
          // One probe is enough to learn the binary cannot answer the question at all, in
          // which case the other rows would be the same sentence repeated.
          const cannotAnswer = outcome.result.code === 0 ? null : runnerFailureLine({ runner, mode: "run", output: outcome.out });
          if (cannotAnswer !== null) return refuseToRun(cannotAnswer);
          const verdict = classifyProbeOutput(outcome.out);
          const answer =
            verdict === "available" ? "allowed for the probe value" :
            verdict === "refused" ? "refused by the policy in force" :
            "not implemented by this runner";
          rows.push(effectLine(name, field, answer));
        }
        const text = [
          `effects under ${policy} (${policySource}), roots ${roots}: ${probes} probes in ${formatDuration(Date.now() - startedAt)} wall. An effect decided by a path was probed with a path under the first root, so \"allowed\" means the policy let it through for that value and not for every path.`,
          ...rows,
        ].join("\n");
        return {
          content: [{ type: "text", text }],
          details: { gated: true, ran: true, action, policy, policySource, runner, roots, ...grantDetails },
        };
      }

      if (action === "list_functions" || action === "describe_function") {
        const registry = buildRegistry(scopeFiles(cwd, dir), (path) => readFile(path));
        const wanted = (params.function ?? "").trim();
        if (action === "describe_function") {
          if (wanted === "") {
            return refuseToRun("describe_function needs the function name in `function`.");
          }
        }
        // Availability is re-probed here, on every registry query, rather than
        // cached for the session: the policy in force can change between calls.
        const probeTimeoutMs = Math.min(PROBE_TIMEOUT_MS, MAX_TIMEOUT_S * 1000);
        const probeRoot = roots.split(",")[0].trim();
        const availability = new Map<string, string>();
        const effectNames: string[] = [];
        for (const entry of registry.entries) {
          for (const name of entry.declared) {
            if (!effectNames.includes(name)) {
              effectNames.push(name);
            }
          }
          for (const name of entry.performed) {
            if (!effectNames.includes(name)) {
              effectNames.push(name);
            }
          }
        }
        for (const name of effectNames) {
          if (UNPROBED_EFFECTS[name] !== undefined) {
            availability.set(name, `unknown (${UNPROBED_EFFECTS[name]})`);
            continue;
          }
          if (POLICY_FIELDS[name] === null) {
            availability.set(name, "unchecked (computes over values it was given)");
            continue;
          }
          const program = probeProgram(name, probeRoot);
          if (program === null) {
            availability.set(name, "unknown (no probe argument is defined for this effect)");
            continue;
          }
          const probed = await spawn("run", program, probeTimeoutMs);
          const verdict = classifyProbeOutput(probed.out);
          if (verdict === "refused") {
            availability.set(name, "refused by the policy in force");
          } else if (verdict === "unavailable") {
            availability.set(name, "not implemented by this runner");
          } else {
            availability.set(name, "available");
          }
        }
        const effectText = (entry: RegistryEntry) => {
          const names = [...entry.declared, ...entry.performed.filter((name) => !entry.declared.includes(name))];
          return names.map((name) => `${name} (${availability.get(name) ?? "unknown"})`).join(", ");
        };

        if (action === "describe_function") {
          const match = registry.entries.filter((entry) => entry.name === wanted);
          if (match.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    `eyg describe_function: ${wanted} is not in the registry in ` +
                    `${registryScopes(cwd, dir).map((scope) => scope.dir).join(", ")}`,
                },
              ],
              details: { gated: true, ran: true, action, policy, policySource, runner, roots, ...grantDetails },
            };
          }
          const entry = match[0];
          const lines = [
            `eyg describe_function: ${entry.name} in ${formatDuration(Date.now() - startedAt)} wall`,
            `  scope: ${entry.scope}`,
            `  module: ${entry.path}`,
            `  signature: ${entry.signature ?? "(not declared)"}`,
            `  description: ${entry.description ?? "(not declared)"}`,
            `  effects: ${effectText(entry) || "(none)"}`,
            `  body performs: ${entry.performed.join(", ") || "(none)"}`,
          ];
          for (const problem of entry.mismatch) {
            lines.push(`  registry error: ${problem}`);
          }
          lines.push(
            "",
            "Bind it with libraries: [\"" + entry.name + "\"] and call `<name>_lib.<function>`;",
            "availability above is advisory - the probe just ran against " + policy + ", and a run whose effect is refused",
            "still goes ahead and gets the ordinary Error(\"... denied by policy: ...\") value.",
          );
          return {
            content: [{ type: "text", text: lines.join("\n") }],
            details: {
              gated: true,
              ran: true,
              action,
              function: wanted,
              policy,
              policySource,
              runner,
              roots,
              ...grantDetails,
              availability: Object.fromEntries(availability),
            },
          };
        }

        const header =
          `eyg list_functions: ${registry.entries.length} function${registry.entries.length === 1 ? "" : "s"}` +
          ` in ${formatDuration(Date.now() - startedAt)} wall`;
        const lines = [header];
        if (registry.entries.length > 0) {
          lines.push(
            "",
            "scopes read in order, first match wins: " +
              registryScopes(cwd, dir).map((scope) => `${scope.name} ${scope.dir}`).join(", "),
            "this tool never writes a registry scope; a function-set is one .eyg module with a",
            "`let metadata = {name, description, signature, effects}` record, written by whoever",
            "needs it with ordinary effects.",
            "",
          );
          for (const entry of registry.entries) {
            lines.push(`${entry.name}  [${entry.scope}] ${entry.path}`);
            lines.push(`  signature: ${entry.signature ?? "(not declared)"}`);
            lines.push(`  description: ${entry.description ?? "(not declared)"}`);
            lines.push(`  effects: ${effectText(entry) || "(none)"}`);
            for (const problem of entry.mismatch) {
              lines.push(`  registry error: ${problem}`);
            }
            lines.push("");
          }
        }
        for (const error of registry.errors) {
          lines.push(`registry error: ${error}`);
        }
        if (registry.entries.length === 0) {
          lines.push(
            "",
            "no function-set is in the registry yet. Write one as a module with a",
            "`let metadata = {name: \"...\", description: \"...\", signature: \"...\", effects: [\"...\"]}`",
            "record under <cwd>/.pi/eyg-functions/ or $HOME/.pi/eyg-functions/, then bind it",
            "with libraries: [\"<name>\"].",
          );
        }
        lines.push(
          "",
          "availability is advisory: it was re-probed against " + policy + " for this listing,",
          "and running a function whose effect is refused is not blocked - the refusal is the",
          "ordinary Error(\"<field> denied by policy: ...\") value inside the program.",
        );
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: {
            gated: true,
            ran: true,
            action,
            policy,
            policySource,
            runner,
            roots,
            ...grantDetails,
            scopes: registryScopes(cwd, dir),
            availability: Object.fromEntries(availability),
            errors: registry.errors,
          },
        };
      }

      const mode = action === "eval" ? "eval" : "run";
      const wantedSeconds = params.timeout ?? Number(process.env.EYG_CODEMODE_TIMEOUT ?? DEFAULT_TIMEOUT_S * 1000) / 1000;
      const timeout = Math.min(Math.max(Math.trunc(wantedSeconds * 1000), MIN_TIMEOUT_MS), MAX_TIMEOUT_S * 1000);

      // Libraries and registry functions bind the same way: an `import` of the
      // module's absolute path, bound as `<name>_lib`. A name that resolves in
      // no scope is refused rather than ignored, because the program the user
      // sees would otherwise fail on an unbound name for a reason they cannot
      // act on.
      const prelude: string[] = [];
      for (const name of params.libraries ?? []) {
        const file = functionSource(name, cwd, dir);
        if (file === null) {
          return refuseToRun(
            `no module named ${name} is shipped in this package or in the registry scopes ` +
              `${registryScopes(cwd, dir).map((scope) => scope.dir).join(", ")}. ` +
              "List the registry with action list_functions, or write the program without it.",
          );
        }
        prelude.push(`let ${name}_lib = import ${JSON.stringify(file)}\n`);
      }
      const code = `${prelude.join("")}${params.code}`;

      const spawnResult = await spawn(mode, code, timeout);
      const result = spawnResult.result;
      const out = spawnResult.out;
      const duration = formatDuration(spawnResult.durationMs);
      const status = result.killed ? `timed out after ${Math.round(timeout / 1000)} s in ${duration} wall` : result.code === 0 ? `ran in ${duration} wall` : `exit ${result.code} in ${duration} wall`;

      // A refusal is the ask. The model sees what was refused, where, and the exact
      // grant that would have allowed it - and that only the operator can make it,
      // because the tool has no field through which a program could widen itself.
      const refusals = refusalHints(out);
      const asks: string[] = [];
      for (const hint of refusals) {
        for (const line of suggestGrant(hint, { roots, policy })) {
          if (!asks.includes(line)) asks.push(line);
        }
      }
      // An invented builtin is the other failure this tool can answer: the runner's own
      // hint says "check the builtin name against the builtins reference" and names no
      // path, which a session that cannot read outside its roots cannot act on.
      const invented = builtinErrors(out);
      const hints = builtinHintRows(invented).map((row) => row.map((segment) => segment.text).join(""));
      // A run that failed because the binary does not know the command this tool built is
      // not a program error, and the fix is an install, not a rewrite of the program.
      const cannotRun = result.code === 0 ? null : runnerFailureLine({ runner, mode, output: out });
      const text = [`eyg ${mode}: ${status}`, out, cannotRun === null ? "" : cannotRun, asks.join("\n"), hints.join("\n")].filter((part) => part !== "").join("\n");
      return {
        content: [{ type: "text", text }],
        details: {
          gated: true,
          ran: true,
          mode,
          policy,
          policySource,
          runner,
          argv: [mode, "--policy", policy, "-c", code],
          exit: result.code,
          killed: result.killed,
          truncated: result.truncated,
          timeoutMs: timeout,
          durationMs: spawnResult.durationMs,
          duration,
          roots,
          ...grantDetails,
          refusals,
          builtins: invented,
          prelude: prelude.map((line) => line.trim()),
        },
      };
    },
  }));

  // A second pi session, started by this one, that can do nothing this session could
  // not already do: the same channel, a policy this project's settings name or a
  // policy this package ships, and roots inside the roots this session has. The child
  // is started as argv with no shell in between, in this working directory, with only
  // the `eyg` tool declared, so delegating work cannot smuggle in reach or a shell.
  pi.registerTool(defineTool({
    name: "eyg_subagent",
    label: "EYG subagent",
    description: [
      "Spawn one pi subagent session in this working directory and report what it did.",
      "The child works only through the tools you name: `eyg` always, plus `read` if you",
      "give it. Every effect it performs is decided by a host policy module before the",
      "host performs it, exactly as yours are, and it has no bash, edit or write. It sees",
      "this project's files and none of this conversation, so `task` must carry the paths,",
      "what to do and what to report.",
      "You bound it in three places: `roots` to a slice of the roots this session has;",
      "`effects` to the effects it may perform, enforced by the `spawner-effects` policy,",
      "which is the agent-roots policy narrowed to those fields, so a name you omit is",
      "refused; and `max_calls` to the eyg calls it may spend, after which it is refused",
      "and told to report what it has. `policy` may only be a policy this package ships.",
      "A subagent narrows your reach and never widens it: it cannot be given a root, an",
      "effect or a tool you do not have, and a grant the operator made with /eyg-grant",
      "covers the session the operator is in, not a child session.",
      "You get back the child's final message, one line per eyg call it made, and every",
      "refusal its policy answered - the refusals are how you learn where its boundary was.",
      "A session that is itself a subagent cannot spawn one: the tree is one level deep.",
      `Pass \`timeout\` in SECONDS for the whole child session (default ${SUBAGENT_DEFAULT_TIMEOUT_S}, at most ${SUBAGENT_MAX_TIMEOUT_S}).`,
    ].join(" "),
    promptSnippet: "Spawn one pi subagent bounded in tools, effects, roots and calls",
    promptGuidelines: [
      "Use eyg_subagent for a self-contained chunk of work - a search over many files, a mechanical edit set - that you can state completely in `task`; the child sees no part of this conversation.",
      "Name the child's roots inside the roots this session has; expect the call to be refused and the outside root named back when you do not.",
      "Name `effects` as the shortest list the task needs, and include StandardOut if you want the child to print anything; `Search` is the same field as `ReadFile`, so a child that can search can read.",
      "Do not grant the child `read` to give it reach: `read` is pi's own tool, no policy decides it, and it hands the child this session's read reach. The default child tool list is `eyg` alone.",
      "Give `max_calls` when the task is a survey rather than a task with a known end; a child stopped by its budget reports what it found.",
      "Never spawn a subagent to get past a refusal: the child is bounded by your reach, and a grant you hold does not reach it. Ask the operator for the grant and do the work yourself.",
      "Read the child's refusals in the result before deciding what to do next; they name the field, the path and the policy that refused it.",
      "A subagent session costs a model run of its own: one spawn per chunk of work, not one per question.",
    ],

    parameters: Type.Object({
      task: Type.String({
        description: "What the child should do, completely: the absolute paths it may touch, the work, and what to report back. It sees this project's files and none of this conversation.",
      }),
      policy: Type.Optional(
        Type.String({
          description: "Name a policy this package ships (`agent-roots`, `deny-all`) for the child. An absolute module path is refused: it must be a policy this package authored, not one you wrote. An `effects` list is enforced by the `spawner-effects` policy, which is agent-roots narrowed, so it combines only with agent-roots.",
        }),
      ),
      tools: Type.Optional(
        Type.Array(
          Type.String({
            description: "Tools the child session gets. Only `eyg` and `read` may be named and `eyg` must be among them: a child whose only tool is `read` would be a session no policy module decides. `read` is pi's own tool and is not decided by a policy, so granting it hands the child this session's read reach. Default: `eyg` alone.",
          }),
        ),
      ),
      effects: Type.Optional(
        Type.Array(
          Type.String({
            description: 'Effect names the child may perform, e.g. ["ReadFile","Search","StandardOut"]. Each must be an effect the policy in force already performs for this session, and the list is enforced by the spawner-effects policy - agent-roots narrowed to those fields - so every name you omit is refused and no name can open the network. `Search` shares the `read_file` field with `ReadFile`. DecodeJSON, EYGParse, Hash and Sign are not policy fields and no policy can forbid them, so naming or omitting them changes nothing. Omit the list to leave the child its policy\'s whole surface.',
          }),
        ),
      ),
      max_calls: Type.Optional(
        Type.Number({
          description: "How many eyg calls the child may make before it is refused and told to report what it has. 0 means think and report, do not call. No limit by default.",
        }),
      ),
      roots: Type.Optional(
        Type.Array(
          Type.String({
            description: "Absolute roots for the child, each one already under a root this session has. Omit to give it the roots this session has.",
          }),
        ),
      ),
      timeout: Type.Optional(
        Type.Number({
          description: `Wall time for the whole child session in SECONDS: default ${SUBAGENT_DEFAULT_TIMEOUT_S}, at most ${SUBAGENT_MAX_TIMEOUT_S}.`,
        }),
      ),
    }),

    renderCall: (args, theme, context) => {
      const lines = subagentCallLines(args, context.expanded);
      return new Text(lines.map((line) => paint(theme, line)).join("\n"), 0, 0);
    },

    renderResult: (result, options, theme, context) => {
      const measured = context.durationMs ?? (result.details && typeof result.details.durationMs === "number" ? result.details.durationMs : undefined);
      const startedAt = context.state && typeof context.state.startedAt === "number" ? context.state.startedAt : undefined;
      if (options.isPartial && startedAt !== undefined) {
        const rows = [[{ tone: "warning", text: `subagent session running, ${formatDuration(Date.now() - startedAt)} so far` }]];
        return new Text(rows.map((line) => paint(theme, line)).join("\n"), 0, 0);
      }
      const rows = subagentResultRows(result, options.expanded, measured);
      return new Text(rows.map((line) => paint(theme, line)).join("\n"), 0, 0);
    },

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const startedAt = Date.now();
      const cwd = ctx.cwd || process.cwd();
      const dir = packageDir();
      const chain = policyChain(pi, ctx, dir);
      if (chain.error !== null) {
        return refuseToRun(chain.error);
      }
      if (chain.depth >= 1) {
        return refuseToRun(
          `this session is itself a subagent (depth ${chain.depth}), and a subagent gets no children: the tree this package spawns is one level deep. Do the work here, or report what you found to the session that started you.`,
        );
      }
      const task = (params.task ?? "").trim();
      if (task === "") {
        return refuseToRun("task must say what the child should do and what to report: it sees this project's files and none of this conversation.");
      }

      // What the child may run under: the policy this session's settings name, or a
      // policy this package ships. A grant the operator made here is deliberately not
      // read - it covers calls in the session the operator said yes in, so a one-call
      // grant cannot be spent over and over by a child with no call limit.
      const shippedNames = shippedPolicies(dir);
      const argumentPolicy = params.policy === undefined ? null : argumentPolicyPath(params.policy, dir);
      if (params.policy !== undefined && argumentPolicy === null) {
        return refuseToRun(
          `the child's policy may only be a policy this package ships (${shippedNames.join(", ") || "none"}), not a module of your own choosing: got ${params.policy}. ` +
            "A wider policy is the operator's to give: /eyg-grant in this session, eyg.policy in the project settings, or EYG_POLICY.",
        );
      }
      const child = resolvePolicy({
        argument: argumentPolicy,
        project: chain.projectPolicy,
        env: process.env.EYG_POLICY ?? null,
        packageDefault: defaultPolicy(),
      });
      // The same narrowing rule as a call's own `policy` argument: a spawner may send a
      // child under the policy this session's settings name or under the narrowest one
      // shipped, never under a wider one the operator did not choose.
      if (child.refusedArgument !== null && child.refusedArgument !== undefined) {
        return refuseToRun(
          `the child's policy may only narrow: ${child.refusedArgument} is not the policy this session runs under (${child.policy} from ${child.source}) and is not the narrowest shipped policy (${NARROWEST_POLICY_FILE}), so it would widen the child. ` +
            "A wider policy is the operator's to give: /eyg-grant in this session, eyg.policy in the project settings, or EYG_POLICY.",
        );
      }
      const childPolicy = child.policy ?? "";
      if (childPolicy === "") {
        return refuseToRun(
          "no policy module was configured for the child and this package ships no policy. Set eyg.policy in the project settings, set EYG_POLICY to an absolute path, or name a policy.",
        );
      }
      if (!childPolicy.startsWith("/") || !existsSync(childPolicy)) {
        return refuseToRun(`the child's policy module was not found: ${childPolicy}`);
      }

      // The boundary the child gets sits inside the boundary this session has, grant
      // roots excluded for the same reason the granted policy is.
      const parentRoots = resolveRoots({ project: chain.settings.roots, env: process.env.EYG_ALLOWED_ROOTS ?? null, cwd }).split(",");
      const requested = params.roots === undefined || params.roots.length === 0 ? parentRoots : params.roots;
      const badRoot = requested.find((root) => typeof root !== "string" || !root.startsWith("/"));
      if (badRoot !== undefined) {
        return refuseToRun(`every roots entry must be an absolute path, got ${badRoot}`);
      }
      const inside = rootsInside(requested, parentRoots);
      if (!inside.ok) {
        return refuseToRun(
          `the child's roots must be inside the roots this session has (${parentRoots.join(", ")}); these are outside: ${inside.outside.join(", ")}. ` +
            "A subagent narrows your reach, it does not widen it: a root you do not have is the operator's /eyg-grant to give, and a grant is given to this session, not to a child.",
        );
      }
      const childRoots = requested;

      // The child's tools: the allowlist, `eyg` required, and never a tool this
      // session does not have itself. `read` is pi's own tool and no policy decides it,
      // so granting it hands the child this session's read reach - which is why the
      // default is one tool and the allowlist is two names.
      const parentTools = typeof pi.getActiveTools === "function" ? pi.getActiveTools() : null;
      const given = childTools(params.tools === undefined ? ["eyg"] : params.tools, parentTools);
      if (given.unknown.length > 0) {
        return refuseToRun(
          `the child's tools may only be ${CHILD_TOOL_ALLOWLIST.join(", ")}; these are not: ${given.unknown.join(", ")}. ` +
            "A child with bash, edit or write is a session whose effects this package does not check.",
        );
      }
      if (given.withoutEyg) {
        return refuseToRun(`the child's tools must include eyg: with only ${given.tools.join(", ") || "nothing"} the child would work through tools no policy module decides.`);
      }
      if (given.parentMissing.length > 0) {
        return refuseToRun(
          `a child cannot be given a tool this session does not have: ${given.parentMissing.join(", ")} is not active here. ` +
            "A subagent narrows your reach, it does not hand out tools you were not given.",
        );
      }

      // The effect allowlist. Effect names come in; policy fields go out to the
      // policy. Two names share one field (`Search` is decided by the `read_file` field), the four
      // unchecked effects are outside every policy, and three names are refused here
      // rather than left for the child to discover, because the narrowing policy keeps
      // the plain refusals its base policy gives them.
      const requestedEffects = params.effects === undefined ? [] : params.effects;
      const mapped = effectFieldsFor(requestedEffects);
      if (mapped.unknown.length > 0) {
        return refuseToRun(
          `effects must be effects the CLI can name: not ${mapped.unknown.join(", ")}. ` +
            'The `eyg` tool\'s action "reference" prints the whole surface with the field that decides each one.',
        );
      }
      const namedNever = requestedEffects.filter((name) => SPAWNER_POLICY_NEVER.includes(name));
      if (namedNever.length > 0) {
        return refuseToRun(
          `an effect allowlist removes reach, it does not add it: policies/${NARROWING_POLICY}.eyg keeps the plain refusals ${BASE_POLICY}.eyg gives ${SPAWNER_POLICY_NEVER.join(", ")}, allowlist or not. ` +
            `Names it cannot grant: ${namedNever.join(", ")}. Ask the operator for a policy that has them (/eyg-grant, eyg.policy, EYG_POLICY) instead.`,
        );
      }
      const namedNoop = requestedEffects.filter((name) => SPAWNER_POLICY_NOOP.includes(name) || mapped.unchecked.includes(name));
      const checkedEffects = requestedEffects.filter((name) => !SPAWNER_POLICY_NOOP.includes(name) && !mapped.unchecked.includes(name));
      const effectFields = effectFieldsFor(checkedEffects).fields;

      // An allowlist is enforced by the narrowing policy this package ships, which is
      // the base policy with an allowlist over its fields. It may only replace the base
      // policy: replacing a policy this project made narrower would widen it.
      const narrowingPolicy = dir === null ? null : shippedPolicyPath(NARROWING_POLICY, dir);
      const basePolicy = dir === null ? null : shippedPolicyPath(BASE_POLICY, dir);
      if (checkedEffects.length > 0) {
        if (narrowingPolicy === null || !existsSync(narrowingPolicy)) {
          return refuseToRun(`this package ships no policies/${NARROWING_POLICY}.eyg, so an effect allowlist could not be enforced: omit effects, or restore the policy.`);
        }
        if (childPolicy !== basePolicy) {
          return refuseToRun(
            `an effect allowlist is enforced by policies/${NARROWING_POLICY}.eyg, the ${BASE_POLICY} policy with an allowlist over its fields, and this child's policy resolves to ${childPolicy} (${child.source}). ` +
              `Replacing a policy the project made narrower with the narrowing policy would widen it, so effects combines with ${BASE_POLICY} only: omit effects to let the child run under ${childPolicy}, or ask the operator for eyg.policy ${BASE_POLICY}.`,
          );
        }
      }

      // The list is then checked against the reach this session actually has, with the
      // same probe `action: effects` answers with. A field this session's own policy
      // refuses would not widen the child - the policy can only take fields away - but
      // naming it would spend the child's calls on a refusal nobody could act on.
      const effectNotes: string[] = [];
      if (checkedEffects.length > 0) {
        const parent = resolvePolicy({
          grant: chain.grants.policy,
          spawner: spawnerPolicy(process.env, chain.depth),
          project: chain.projectPolicy,
          env: process.env.EYG_POLICY ?? null,
          packageDefault: defaultPolicy(),
        });
        const parentPolicy = parent.policy ?? "";
        const reachableRoots = resolveRoots({ grant: chain.grants.roots, project: chain.settings.roots, env: process.env.EYG_ALLOWED_ROOTS ?? null, cwd });
        const candidates = runnerCandidates(cwd, process.env);
        // The policy reads its roots from the environment, so a probe is run with this
        // session's roots set for the call and restored after it, exactly as a checked
        // run does. Probing without them would ask the policy what it allows with no
        // roots at all, and answer that - which is what this call used to report.
        const exec = async (binary: string, args: string[]) => {
          const previousRoots = process.env.EYG_ALLOWED_ROOTS;
          process.env.EYG_ALLOWED_ROOTS = reachableRoots;
          try {
            const probed = await pi.exec(binary, args, { signal: null, timeout: PROBE_TIMEOUT_MS, cwd });
            return { stdout: probed.stdout ?? "", stderr: probed.stderr ?? "", code: probed.code ?? 1 };
          } finally {
            if (previousRoots === undefined) {
              delete process.env.EYG_ALLOWED_ROOTS;
            } else {
              process.env.EYG_ALLOWED_ROOTS = previousRoots;
            }
          }
        };
        const runner = candidates[0];
        const probeRoot = reachableRoots.split(",")[0].trim();
        const performed: string[] = [];
        for (const name of checkedEffects) {
          const field = POLICY_FIELDS[name];
          if (typeof field !== "string") continue;
          if (UNPROBED_EFFECTS[name] !== undefined) {
            effectNotes.push(`${name}: not probed (${UNPROBED_EFFECTS[name]}), so the policy's own rule for it stands`);
            if (!performed.includes(field)) performed.push(field);
            continue;
          }
          const program = probeProgram(name, probeRoot);
          if (program === null) {
            effectNotes.push(`${name}: no probe argument is defined, so its availability was not checked`);
            continue;
          }
          const probed = await exec(runner, ["run", "--policy", parentPolicy, "-c", program]);
          if (probed.code !== 0) {
            const cannotAnswer = runnerFailureLine({ runner, mode: "run", output: probed.stdout + "\n" + probed.stderr });
            if (cannotAnswer !== null) {
              return refuseToRun(
                `an effect allowlist is checked by asking the policy in force what it performs, and this session cannot ask it. ${cannotAnswer} ` +
                  "Omit effects to spawn the child under its policy un-narrowed.",
              );
            }
          }
          if (classifyProbeOutput(probed.stdout + "\n" + probed.stderr) === "refused") continue;
          if (!performed.includes(field)) performed.push(field);
        }
        const outside = fieldsOutside(effectFields, performed);
        if (!outside.ok) {
          return refuseToRun(
            `this session's own policy (${parentPolicy}, ${parent.source}) refuses ${outside.outside.join(", ")} for the roots it has, so naming it in a child's allowlist asks the child for reach you do not have. ` +
              `Fields it performs for those roots: ${performed.join(", ") || "none"}. A wider policy is the operator's to give: /eyg-grant here, eyg.policy in the project settings, or EYG_POLICY.`,
          );
        }
      }
      if (namedNoop.length > 0) {
        effectNotes.push(`${namedNoop.join(", ")}: no policy can forbid it (DecodeJSON, EYGParse, Hash, Sign) or the answer is the same named or not (Env), so naming it changes nothing`);
      }

      // The call budget, passed to the child as a marker and spent there by the
      // child's own copy of this tool, because pi has no flag that caps a session's
      // calls and only the session knows how many it has made.
      const maxCalls = params.max_calls === undefined || params.max_calls === null ? null : params.max_calls;
      if (maxCalls !== null && (!Number.isInteger(maxCalls) || maxCalls < 0)) {
        return refuseToRun(`max_calls must be a whole number of eyg calls (0 means the child may not call at all), got ${params.max_calls}`);
      }

      // The child is a pi session like this one. `pi` on PATH is the assumption,
      // `EYG_CODEMODE_PI` names it when PATH does not carry it.
      const binary = typeof process.env.EYG_CODEMODE_PI === "string" && process.env.EYG_CODEMODE_PI !== "" ? process.env.EYG_CODEMODE_PI : "pi";
      const wantedSeconds = params.timeout ?? SUBAGENT_DEFAULT_TIMEOUT_S;
      const timeout = Math.min(Math.max(Math.trunc(wantedSeconds * 1000), MIN_TIMEOUT_MS), SUBAGENT_MAX_TIMEOUT_S * 1000);
      const argv = childArgv({
        task,
        model: ctx.model && typeof ctx.model.id === "string" ? ctx.model.id : null,
        trusted: typeof ctx.isProjectTrusted === "function" ? ctx.isProjectTrusted() : false,
        tools: given.tools,
      });

      // `pi.exec` takes no `env`, so the child's boundary is set on this process for
      // the spawn and restored after it, as a checked run does for the roots. The depth
      // marker is what makes the child read `EYG_SUBAGENT_POLICY`, those roots, the
      // effect allowlist and the call budget as a spawner's word rather than its
      // project's.
      const runPolicy = checkedEffects.length > 0 && narrowingPolicy !== null ? narrowingPolicy : childPolicy;
      const policySource = checkedEffects.length > 0 ? `${child.source} narrowed to the fields named` : child.source;
      const overrides: Record<string, string> = childEnvOverrides({ policy: runPolicy, roots: childRoots.join(","), depth: chain.depth + 1, effects: effectFields, maxCalls });
      const previous: Record<string, string | undefined> = {};
      for (const key of Object.keys(overrides)) {
        previous[key] = process.env[key];
        process.env[key] = overrides[key] as string;
      }
      let result;
      try {
        result = await pi.exec(binary, argv, { signal, timeout, cwd });
      } catch (error) {
        return refuseToRun(
          `could not start the child session with \`${binary}\`: ${error instanceof Error ? error.message : String(error)}. ` +
            "Set EYG_CODEMODE_PI to the absolute path of the pi CLI.",
        );
      } finally {
        for (const key of Object.keys(overrides)) {
          if (previous[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = previous[key] as string;
          }
        }
      }

      const calls = childCalls(result.stdout + "\n" + result.stderr);
      const answer = childAnswer(result.stdout);
      const refusals: { field: string; path: string }[] = [];
      for (const call of calls) {
        for (const hint of call.refusals) {
          if (!refusals.some((seen) => seen.field === hint.field && seen.path === hint.path)) refusals.push(hint);
        }
      }
      const durationMs = Date.now() - startedAt;
      const duration = formatDuration(durationMs);
      const status = result.killed
        ? `timed out after ${Math.round(timeout / 1000)} s in ${duration} wall`
        : result.code === 0
          ? `answered in ${duration} wall`
          : `exit ${result.code} in ${duration} wall`;
      const details = {
        gated: true,
        ran: true,
        depth: chain.depth,
        childDepth: chain.depth + 1,
        task,
        policy: runPolicy,
        policySource,
        basePolicy: checkedEffects.length > 0 ? childPolicy : null,
        tools: given.tools,
        parentTools,
        effects: checkedEffects,
        effectFields,
        effectNotes,
        maxCalls,
        roots: childRoots.join(","),
        parentRoots: parentRoots.join(","),
        binary,
        argv,
        exit: result.code,
        killed: result.killed,
        truncated: result.truncated,
        timeoutMs: timeout,
        durationMs,
        duration,
        calls,
        refusals,
        answer,
      };
      const asks = childRefusalRows(details).map((row) => row.map((segment) => segment.text).join(""));
      const stderr = (result.stderr ?? "").trim();
      const budgetLine = maxCalls === null ? "call budget: none" : `call budget: ${maxCalls}${calls.some((call) => call.budget !== null) ? ", spent" : ", not spent"}`;
      const text = [
        `eyg_subagent: ${status}`,
        `child under ${runPolicy} (${policySource}), roots ${childRoots.join(", ")}, tools ${given.tools.join(", ")}, ${budgetLine}. Its policy comes from this session's settings or a shipped policy; a grant made here does not reach it.`,
        `child's final message:\n${answer === "" ? "(the child left no final message)" : answer}`,
        `child eyg calls: ${calls.length}${calls.length === 0 && stderr !== "" ? ` (stderr: ${stderr.split("\n").slice(-5).join(" | ")})` : ""}`,
        ...calls.map((call, index) => `  ${index + 1}. under ${call.policy ?? "?"} (${call.policySource ?? "?"}) roots ${call.roots ?? "?"} exit ${call.exit ?? "?"}${call.budget !== null ? ` out of calls (budget ${call.budget})` : ""}${call.refusals.length > 0 ? ` refused ${call.refusals.map((hint) => `${hint.field} at ${hint.path}`).join(", ")}` : ""}`),
        ...(effectFields.length > 0 ? [`effects the child was given: ${effectFields.join(", ")}`] : []),
        ...effectNotes.map((note) => `note: ${note}`),
        ...asks,
      ].join("\n");
      return { content: [{ type: "text", text }], details };
    },
  }));

  // The operator's side of the loop. `/eyg-grant` is the only way a grant comes to
  // exist: it is a command the human types, its choices go through ctx.ui, and the
  // tool's own parameters carry no grant field, so a program cannot widen itself.
  // The grant is appended to the session as a custom entry, which does not reach the
  // model and lives on the branch, so a fork or a `/tree` jump decides what it covered.
  pi.registerCommand("eyg-grant", {
    description: "grant the eyg tool a wider policy for one call, N calls or the rest of the session (operator only)",
    handler: async (args, ctx) => {
      const dir = packageDir();
      const shippedNames = shippedPolicies(dir);
      const inForce = grantState(ctx).grants;
      const tokens = (args ?? "").trim().split(/\s+/).filter((token) => token !== "");
      const say = (message: string, kind: "info" | "warning" | "error" = "info") => ctx.ui.notify(message, kind);

      const state = () =>
        inForce.length === 0
          ? "no grant is in force now"
          : `grants in force now: ${inForce.map((grant) => describeGrant(grant)).join(" | ")}`;

      if (tokens[0] === "revoke") {
        if (inForce.length === 0) return say("no grant is in force to revoke.", "warning");
        let id = tokens[1] ?? null;
        if (id === null) {
          if (!ctx.hasUI) return say(`revoke needs the grant id: /eyg-grant revoke <${inForce.map((grant) => grant.id).join(" | ")}>`, "error");
          const labels = inForce.map((grant) => describeGrant(grant));
          const picked = await ctx.ui.select("Revoke which grant?", labels);
          if (picked === undefined) return say("revoke cancelled.");
          id = inForce[labels.indexOf(picked)].id;
        }
        pi.appendEntry(GRANT_ENTRY, { op: "revoke", id });
        return say(`grant ${id} is revoked: the next eyg call runs under the policy the settings name again.`);
      }

      // What the caller already typed is not asked for again, so the same command
      // works headless: /eyg-grant deny-all 3 roots=/tmp answers without prompting.
      let policyName: string | null = null;
      let calls: number | null = null;
      let sessionLong = false;
      let roots: string[] = [];
      for (const token of tokens) {
        if (token.startsWith("roots=")) {
          roots = token.slice("roots=".length).split(",").map((root) => root.trim()).filter((root) => root !== "");
        } else if (/^[0-9]+$/.test(token)) {
          calls = Number(token);
        } else if (token === "one" || token === "1") {
          calls = 1;
        } else if (token === "session") {
          sessionLong = true;
        } else if (policyName === null && (token.startsWith("/") || (dir !== null && shippedPolicyPath(token, dir) !== null))) {
          policyName = token;
        }
      }

      if (policyName === null) {
        if (!ctx.hasUI) {
          return say(`which policy? /eyg-grant <${shippedNames.join(" | ")} | an absolute module path> <one | N | session> [roots=/abs,/abs]. ${state()}`, "error");
        }
        const options = [...shippedNames, "an absolute module path"];
        const picked = await ctx.ui.select("Which policy do the next eyg calls run under?", options);
        if (picked === undefined) return say("grant cancelled.");
        if (picked === "an absolute module path") {
          const typed = await ctx.ui.input("Absolute path to the policy module", "/abs/path/policy.eyg");
          if (typed === undefined || typed.trim() === "") return say("grant cancelled.");
          policyName = typed.trim();
        } else {
          policyName = picked;
        }
      }
      const policy = dir === null ? (policyName.startsWith("/") ? policyName : null) : shippedPolicyPath(policyName, dir);
      if (policy === null) return say(`a policy is one this package ships (${shippedNames.join(", ")}) or an absolute module path, not ${policyName}`, "error");
      if (!existsSync(policy)) return say(`no policy module at ${policy}`, "error");

      if (calls === null && !sessionLong) {
        if (!ctx.hasUI) return say(`for how long? /eyg-grant ${policyName} <one | N | session> [roots=/abs,/abs]. ${state()}`, "error");
        const picked = await ctx.ui.select(
          "For how long?",
          ["one tool call (recommended: retry exactly the refused program)", "a number of tool calls", "the rest of the session (widest: every later call)"],
        );
        if (picked === undefined) return say("grant cancelled.");
        if (picked.startsWith("one")) {
          calls = 1;
        } else if (picked.startsWith("the rest")) {
          sessionLong = true;
        } else {
          const typed = await ctx.ui.input("How many tool calls?", "3");
          if (typed === undefined || !/^[0-9]+$/.test(typed.trim())) return say("a number of calls, or cancel.", "error");
          calls = Number(typed.trim());
        }
      }

      const badRoot = roots.find((root) => !root.startsWith("/"));
      if (badRoot !== undefined) return say(`every root must be an absolute path, got ${badRoot}`, "error");
      if (roots.length === 0 && ctx.hasUI) {
        const picked = await ctx.ui.select("Add roots for the policy that reads them?", ["no new roots (recommended)", "add absolute roots, comma separated"]);
        if (picked === undefined) return say("grant cancelled.");
        if (picked.startsWith("add")) {
          const typed = await ctx.ui.input("Roots to add, comma separated, absolute", "/abs/one,/abs/two");
          if (typed === undefined) return say("grant cancelled.");
          roots = typed.split(",").map((root) => root.trim()).filter((root) => root !== "");
          const relative = roots.find((root) => !root.startsWith("/"));
          if (relative !== undefined) return say(`every root must be an absolute path, got ${relative}`, "error");
        }
      }

      const duration = sessionLong ? "the rest of the session" : `${calls} tool call${calls === 1 ? "" : "s"}`;
      const summary =
        `${policy}\nfor ${duration}${roots.length > 0 ? `, adding roots ${roots.join(", ")}` : ""}\n${state()}\n` +
        "the policy file is not changed and the program cannot widen itself: this entry is the widening";
      if (ctx.hasUI && !(await ctx.ui.confirm("Grant this policy?", summary))) return say("grant cancelled.");

      const id = `g${Date.now().toString(36)}`;
      pi.appendEntry(GRANT_ENTRY, { op: "grant", id, policy, calls: sessionLong ? null : calls, roots });
      const next = sessionLong
        ? "Every later eyg call runs under it"
        : `The next ${calls} eyg call${calls === 1 ? "" : "s"} run${calls === 1 ? "s" : ""} under it`;
      say(
        `grant ${id}: ${policy} for ${duration}${roots.length > 0 ? ` (roots + ${roots.join(", ")})` : ""}. ` +
          `${next} - ask the model to retry the refused program.`,
      );
    },
  });
}
