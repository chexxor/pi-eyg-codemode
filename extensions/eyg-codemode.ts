/**
 * EYG codemode - the agent's only channel to the outside world.
 *
 * The model calls one tool, `eyg`, with EYG source. The tool spawns the gated
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
 * operator answers - a preset or module path, roots to add, and a duration of one
 * tool call, N calls or the rest of the session. The grant is a session entry the
 * human's command appends, never a tool parameter, so a program cannot widen itself
 * (`notes/pi-codemode-session-grants.md`).
 *
 * Configure the runner and the policy with environment variables to point one
 * session at one policy without editing this file:
 *
 *   EYG_CODEMODE_RUNNER   absolute path to the runner (default: probe, below)
 *   EYG_POLICY            absolute path to the policy module (default: the package's)
 *   EYG_ALLOWED_ROOTS     comma separated absolute roots for the default policy
 *   EYG_CODEMODE_TIMEOUT  ms for one call (default 30000, capped at 120000)
 *
 * A runner must accept `run --policy <module.eyg>`: `--policy` is the whole
 * gate, and a run without it is ungated (`notes/pi_codemode_host_gate.md`
 * records why a policy inside the program is not a restriction). The probe is
 * the cheapest honest test that the gate exists at all.
 */

import { defineTool, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import {
  argumentPolicyPath,
  buildRegistry,
  callLines,
  childAnswer,
  childArgv,
  childCalls,
  childEnvOverrides,
  childRefusalRows,
  checkDeclaredEffects,
  classifyProbeOutput,
  DEPTH_ENV,
  describeGrant,
  effectLine,
  effectsUsed,
  findMetadata,
  formatDuration,
  grantEvents,
  GRANT_ENTRY,
  prepareCallArguments,
  probeProgram,
  refusalHints,
  replayGrants,
  resultLines,
  resolvePolicy,
  resolveRoots,
  runnerCandidates,
  rootsInside,
  sessionDepth,
  spawnerPolicy,
  spawnerRoots,
  subagentCallLines,
  subagentResultRows,
  suggestGrant,
  eygSettings,
  presetPath,
  POLICY_FIELDS,
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
const ACTIONS = ["run", "eval", "effects", "list_functions", "describe_function"];

/// What a call in this session gets from everything except the call's own argument:
/// the project settings, and the grants on this session's branch. `error` names what
/// is wrong in the settings instead of running a module nobody named. Both tools read
/// the chain, so the settings are validated one way.
type PolicyChain = {
  error: string | null;
  settings: { policy: string | null; roots: string[] };
  projectPreset: string | null;
  grants: ReturnType<typeof replayGrants>;
  depth: number;
};

function policyChain(pi: ExtensionAPI, ctx: unknown, dir: string | null): PolicyChain {
  const depth = sessionDepth(process.env);
  const settings = eygSettings(typeof pi.getSettings === "function" ? pi.getSettings() : {});
  const projectPreset = settings.policy === null ? null : presetPath(settings.policy, dir);
  const empty = replayGrants([]);
  if (settings.policy !== null && projectPreset === null) {
    return { error: `eyg.policy in the project settings must name a shipped preset or an absolute module path, got ${settings.policy}`, settings, projectPreset: null, grants: empty, depth };
  }
  const relativeRoot = settings.roots.find((root) => !root.startsWith("/"));
  if (relativeRoot !== undefined) {
    return { error: `every eyg.roots entry must be an absolute path, got ${relativeRoot}`, settings, projectPreset, grants: empty, depth };
  }
  return { error: null, settings, projectPreset, grants: grantState(ctx as { sessionManager?: { getBranch?: () => unknown[] } }), depth };
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

/// The presets this package ships, as the bare names a call may choose. A call may
/// narrow itself to one of these and may not name a module of its own: a program
/// that could write a permissive policy inside its own roots and hand the runner its
/// path would be granting itself, which is the route the grant loop closes
/// (`notes/pi-codemode-session-grants.md`).
function shippedPresets(dir: string | null): string[] {
  if (dir === null) return [];
  return listModules(join(dir, "policies")).map((file) => file.replace(/\.eyg$/, ""));
}

/// The grants in force for the branch this call is being made on. There is no grant
/// variable in this file: the records `/eyg-grant` appended and the eyg calls already
/// on the branch say what is in force now, so `/tree` and a fork replay a grant and a
/// truncated branch un-spends the calls it dropped. The current call is not on the
/// branch yet, so it is not counted against its own grant.
function grantState(ctx: { sessionManager?: { getBranch?: () => unknown[] } }) {
  const branch = ctx.sessionManager && typeof ctx.sessionManager.getBranch === "function" ? ctx.sessionManager.getBranch() : [];
  return replayGrants(grantEvents(branch as never[]));
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

/// The runner: named by the environment, otherwise the first candidate that
/// actually accepts the policy flag. `--policy` is the whole check, so probing
/// rather than assuming is the only way to know the check exists. The candidate
/// order lives in `runnerCandidates` in `lib/render-helpers.mjs`, where the tests
/// read it. Cached: the probe is one process, and a session makes many tool calls.
const runnerProbe: { candidates: string[]; runner: string | null } = {
  candidates: [],
  runner: null,
};

async function resolveRunner(
  candidates: string[],
  exec: (binary: string, args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>,
): Promise<string | null> {
  if (runnerProbe.candidates.length === candidates.length &&
    runnerProbe.candidates.every((c, i) => c === candidates[i])) {
    return runnerProbe.runner;
  }
  for (const candidate of candidates) {
    try {
      const probe = await exec(candidate, ["--help"]);
      if (/\-\-policy/.test(probe.stdout + probe.stderr)) {
        runnerProbe.candidates = candidates;
        runnerProbe.runner = candidate;
        return candidate;
      }
    } catch {
      // A candidate that cannot be spawned is not a runner.
    }
  }
  runnerProbe.candidates = candidates;
  runnerProbe.runner = null;
  return null;
}

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
      "To find files, pass libraries: [\"search\"] and call `search_lib.search({root, pattern, limit})`: it walks the roots with the effects the policy gates, so it cannot see outside them.",
      "`perform Search({path: \"/abs/dir\", pattern: \"**/*.eyg\", limit: 20})` is one host action that lists matching paths under a root; the policy decides it once for the whole walk.",
      "EYG has no infix operators - add integers with `!int_add(a, b)`; a bare `WriteFile(...)` is a function call and fails to parse.",
      "action selects what the call does: `run` (default) performs effects, `eval` is pure,",
      "`effects` answers what the policy in force decides for every effect the CLI can name,",
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
      "/eyg-grant and choose a preset (or an absolute module path), the roots to add and a",
      "duration - one tool call, N calls, or the rest of the session - with your recommendation",
      "(the narrowest that retries the refused program), then retry the same program.",
      "No parameter of this tool widens a policy: `policy` only narrows to a shipped preset.",
    ].join(" "),
    promptSnippet: "Run an EYG program whose every effect is decided by a host policy module",
    promptGuidelines: [
      "Use the eyg tool for every side effect in this session; it is the only channel to the outside world.",
      "When eyg returns a `denied by policy` message, change what the program asks for or report the refusal; do not search for another way to run a command.",
      "A refused eyg effect is a value, not a crash: bind it with a name you use (`let written = perform WriteFile(...)`) and report `written`, because `let _ =` discards the refusal and makes the call look like success when nothing was written.",
      "Use eyg mode eval for a pure computation and eyg mode run when the program performs effects.",
      "Write an eyg effect as `perform Name(argument)`, bound with `let name =` or `let _ =` when another expression follows; `Name(argument)` alone is a function call and fails to parse.",
      "Every eyg path must be absolute: the policy sees absolute paths, and relative paths are resolved from the session's working directory before the gate sees them.",
      "Find files with `perform Search({path, pattern, limit})` - one host action, one policy decision, absolute paths you can hand to ReadFile; a refusal is `Error(\"read_file denied by policy: /abs/root\")`.",
      "A search lists names under an allowed root, including names of files a read of would be refused for, so a listed path is not permission to read it.",
      "On a runtime without the `Search` effect, ask for the package's library instead of writing a walk: `libraries: [\"search\"]` and `search_lib.search({root, pattern, limit})`.",
      "Before writing a helper, call `action: \"list_functions\"` - the registry names re-usable EYG functions with their signature, description and required effects; a function you need may already exist.",
      "When a capability question is in the air, call `action: \"effects\"` once instead of probing effects one program at a time: it runs one probe per effect under the policy in force and answers effect | policy field | decision. Read `guides/cli_effects_reference.md` in the repository for the gate classes.",
      "Pass `timeout` in seconds when a run is longer than 30 s; the result says how long it took in wall time, so a timeout is visible rather than guessed.",
      "The effects listed for a registry function are advisory: availability is re-probed at each listing and the policy can change mid-session, and a run whose effect is refused simply gets the ordinary Error value.",
      "When an effect is refused, report what was refused and ask the operator for the grant the result names (/eyg-grant: one call, N calls, or the rest of the session), recommending the narrowest one that retries the refused program; then retry it. Never write a policy module of your own and never look for another channel.",
    ],

    parameters: Type.Object({
      code: Type.String({
        description: "EYG source. The last expression is the value; use Exit or the record `script` field for a status. Pass \"\" for action list_functions or describe_function.",
      }),
      action: Type.Optional(
        Type.String({
          description:
            "`run` (default, effects allowed by the policy), `eval` (pure, prints the value), `effects` (one probe per effect the CLI can name, answered by the policy in force), `list_functions` (the registry of re-usable functions) or `describe_function` (one of them by name).",
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
            "Name a preset this package ships (`agent-roots`, `deny-all`) to narrow this call to it. An absolute module path is refused: a wider policy comes from the operator's /eyg-grant, the project's eyg.policy key, or EYG_POLICY.",
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
      // session, the project's `eyg.policy` key, `EYG_POLICY`, the preset shipped
      // in this package - `resolvePolicy` in `lib/render-helpers.mjs` holds that
      // order and the tests read it. A program is never run without one: an
      // unchecked run performs every effect the host can reach, and a registry
      // availability probe is answered by the same policy that will run the program.
      const chain = policyChain(pi, ctx, dir);
      if (chain.error !== null) {
        return refuseToRun(chain.error);
      }
      const settings = chain.settings;
      const projectPreset = chain.projectPreset;
      const grants = chain.grants;
      const grantDetails = { grants: grants.grants, grantId: grants.active === null ? null : grants.active.id };
      const presets = shippedPresets(dir);
      const argumentPolicy = params.policy === undefined ? null : argumentPolicyPath(params.policy, dir);
      if (params.policy !== undefined && argumentPolicy === null) {
        return refuseToRun(
          `the policy argument may only narrow this call to a preset the package ships (${presets.join(", ") || "none"}), not name a module of its own: got ${params.policy}. ` +
            "A wider policy is the operator's to give: /eyg-grant for this session, eyg.policy in the project settings, or EYG_POLICY.",
        );
      }
      const chosen = resolvePolicy({
        argument: argumentPolicy,
        grant: grants.policy,
        spawner: spawnerPolicy(process.env, chain.depth),
        project: projectPreset,
        env: process.env.EYG_POLICY ?? null,
        packageDefault: defaultPolicy(),
      });
      const policy = chosen.policy ?? "";
      const policySource = chosen.source;
      if (policy === "") {
        return refuseToRun(
          "no policy module was configured and this package ships no preset. Set eyg.policy in the project settings, set EYG_POLICY to an absolute path, or pass policy. A program is never run ungated.",
        );
      }
      if (!policy.startsWith("/")) {
        return refuseToRun(`policy must be an absolute path, got ${policy}`);
      }
      if (!existsSync(policy)) {
        return refuseToRun(`policy module not found: ${policy}`);
      }

      const candidates = runnerCandidates(cwd, process.env);
      const exec = async (binary: string, args: string[]) => {
        const result = await pi.exec(binary, args, { signal: null, timeout: PROBE_TIMEOUT_MS, cwd });
        return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.code ?? 1 };
      };
      const runner = await resolveRunner(candidates, exec);
      if (runner === null) {
        return refuseToRun(
          `no runner that accepts \`--policy\` was found among ${candidates.join(", ")}. ` +
            "Checking happens in the runner, so an older CLI cannot be used: build the current one " +
            "(guides/install_from_source.md), put a checked runner at <cwd>/.local/eyg-checked, " +
            "or set EYG_CODEMODE_RUNNER to its absolute path.",
        );
      }

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
      // the answer comes from the same gate that will run the real program rather than
      // from a copy of the preset in this file. Probes are chosen by `probeArguments`
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
          const verdict = classifyProbeOutput(outcome.out);
          const answer =
            verdict === "available" ? "allowed for the probe value" :
            verdict === "refused" ? "refused by the policy in force" :
            "not implemented by this runner";
          rows.push(effectLine(name, field, answer));
        }
        const text = [
          `effects under ${policy} (${policySource}), roots ${roots}: ${probes} probes in ${formatDuration(Date.now() - startedAt)} wall. A path-gated effect was probed with a path under the first root, so \"allowed\" means the policy let it through for that value and not for every path.`,
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
      const text = [`eyg ${mode}: ${status}`, out, asks.join("\n")].filter((part) => part !== "").join("\n");
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
          prelude: prelude.map((line) => line.trim()),
        },
      };
    },
  }));

  // A second pi session, started by this one, that can do nothing this session could
  // not already do: the same channel, a policy this project's settings name or a
  // preset this package ships, and roots inside the roots this session has. The child
  // is started as argv with no shell in between, in this working directory, with only
  // the `eyg` tool declared, so delegating work cannot smuggle in reach or a shell.
  pi.registerTool(defineTool({
    name: "eyg_subagent",
    label: "EYG subagent",
    description: [
      "Spawn one pi subagent session in this working directory and report what it did.",
      "The child has only the eyg tool: every effect it performs is decided by a host policy",
      "module before the host performs it, exactly as yours are, and it has no bash, read,",
      "edit or write. It sees this project's files and none of this conversation, so `task`",
      "must carry the paths, what to do and what to report.",
      "The child's policy is the one this session's settings name, or one you name with",
      "`policy` - only a preset this package ships, never a module of your own. Its roots",
      "must be inside the roots this session has: name `roots` to narrow it to a slice.",
      "A subagent narrows your reach and never widens it. It is not a route around a",
      "refusal: it cannot be given a root you do not have, and a grant the operator made",
      "with /eyg-grant covers the session the operator is in, not a child session.",
      "You get back the child's final message, one line per eyg call it made, and every",
      "refusal its policy answered - the refusals are how you learn where its boundary was.",
      "A session that is itself a subagent cannot spawn one: the tree is one level deep.",
      `Pass \`timeout\` in SECONDS for the whole child session (default ${SUBAGENT_DEFAULT_TIMEOUT_S}, at most ${SUBAGENT_MAX_TIMEOUT_S}).`,
    ].join(" "),
    promptSnippet: "Spawn one pi subagent that works only through the eyg tool, under a policy you name",
    promptGuidelines: [
      "Use eyg_subagent for a self-contained chunk of work - a search over many files, a mechanical edit set - that you can state completely in `task`; the child sees no part of this conversation.",
      "Name the child's roots inside the roots this session has; expect the call to be refused and the outside root named back when you do not.",
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
          description: "Name a preset this package ships (`agent-roots`, `deny-all`) for the child. An absolute module path is refused: it must be a policy this package authored, not one you wrote.",
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
      // preset this package ships. A grant the operator made here is deliberately not
      // read - it covers calls in the session the operator said yes in, so a one-call
      // grant cannot be spent over and over by a child with no call limit.
      const presets = shippedPresets(dir);
      const argumentPolicy = params.policy === undefined ? null : argumentPolicyPath(params.policy, dir);
      if (params.policy !== undefined && argumentPolicy === null) {
        return refuseToRun(
          `the child's policy may only be a preset this package ships (${presets.join(", ") || "none"}), not a module of your own choosing: got ${params.policy}. ` +
            "A wider policy is the operator's to give: /eyg-grant in this session, eyg.policy in the project settings, or EYG_POLICY.",
        );
      }
      const child = resolvePolicy({
        argument: argumentPolicy,
        project: chain.projectPreset,
        env: process.env.EYG_POLICY ?? null,
        packageDefault: defaultPolicy(),
      });
      const childPolicy = child.policy ?? "";
      if (childPolicy === "") {
        return refuseToRun(
          "no policy module was configured for the child and this package ships no preset. Set eyg.policy in the project settings, set EYG_POLICY to an absolute path, or name a preset.",
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
      // The child is a pi session like this one. `pi` on PATH is the assumption,
      // `EYG_CODEMODE_PI` names it when PATH does not carry it.
      const binary = typeof process.env.EYG_CODEMODE_PI === "string" && process.env.EYG_CODEMODE_PI !== "" ? process.env.EYG_CODEMODE_PI : "pi";
      const wantedSeconds = params.timeout ?? SUBAGENT_DEFAULT_TIMEOUT_S;
      const timeout = Math.min(Math.max(Math.trunc(wantedSeconds * 1000), MIN_TIMEOUT_MS), SUBAGENT_MAX_TIMEOUT_S * 1000);
      const argv = childArgv({
        task,
        model: ctx.model && typeof ctx.model.id === "string" ? ctx.model.id : null,
        trusted: typeof ctx.isProjectTrusted === "function" ? ctx.isProjectTrusted() : false,
      });

      // `pi.exec` takes no `env`, so the child's boundary is set on this process for
      // the spawn and restored after it, as a checked run does for the roots. The depth
      // marker is what makes the child read `EYG_SUBAGENT_POLICY` and those roots as a
      // spawner's word rather than its project's.
      const overrides: Record<string, string> = childEnvOverrides({ policy: childPolicy, roots: childRoots.join(","), depth: chain.depth + 1 });
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
        policy: childPolicy,
        policySource: child.source,
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
      const text = [
        `eyg_subagent: ${status}`,
        `child under ${childPolicy} (${child.source}), roots ${childRoots.join(", ")}, tools: eyg only. Its policy comes from this session's settings or a shipped preset; a grant made here does not reach it.`,
        `child's final message:\n${answer === "" ? "(the child left no final message)" : answer}`,
        `child eyg calls: ${calls.length}${calls.length === 0 && stderr !== "" ? ` (stderr: ${stderr.split("\n").slice(-5).join(" | ")})` : ""}`,
        ...calls.map((call, index) => `  ${index + 1}. under ${call.policy ?? "?"} (${call.policySource ?? "?"}) roots ${call.roots ?? "?"} exit ${call.exit ?? "?"}${call.refusals.length > 0 ? ` refused ${call.refusals.map((hint) => `${hint.field} at ${hint.path}`).join(", ")}` : ""}`),
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
      const presets = shippedPresets(dir);
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
        } else if (policyName === null && (token.startsWith("/") || (dir !== null && presetPath(token, dir) !== null))) {
          policyName = token;
        }
      }

      if (policyName === null) {
        if (!ctx.hasUI) {
          return say(`which policy? /eyg-grant <${presets.join(" | ")} | an absolute module path> <one | N | session> [roots=/abs,/abs]. ${state()}`, "error");
        }
        const options = [...presets, "an absolute module path"];
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
      const policy = dir === null ? (policyName.startsWith("/") ? policyName : null) : presetPath(policyName, dir);
      if (policy === null) return say(`a policy is a preset this package ships (${presets.join(", ")}) or an absolute module path, not ${policyName}`, "error");
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
        const picked = await ctx.ui.select("Add roots for the preset that reads them?", ["no new roots (recommended)", "add absolute roots, comma separated"]);
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
        "the preset file is not changed and the program cannot widen itself: this entry is the widening";
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
