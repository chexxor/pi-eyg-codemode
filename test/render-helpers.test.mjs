/**
 * Tests for the pure shapes the `eyg` tool renders and probes with.
 *
 *     node --test 'test/*.mjs'          (or: node --test test/render-helpers.test.mjs)
 *
 * These cover the parts of the tool that can be checked without a pi session:
 * the row shapes `renderCall` and `renderResult` hand to the theme, the wall
 * time format, the effect scan, the metadata record of a registry module, and
 * the probe programs. The collapsed-and-expanded toggle itself is pi's, so the
 * operator's interactive check is the other half of the evidence.
 *
 * One named test per group, so a failure names the group it came from instead of
 * stopping the file at its first assert.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { surfaceDriftProblems } from "../bin/agent/gen-surface.mjs";
import { argumentPolicyPath, bindingOrder, budgetRefusal, externBindings, builtinErrors, builtinHintRows, builtinRows, callBudget, callLines, checkDeclaredEffects, CHILD_TOOL_ALLOWLIST, classifyProbeOutput, COLLAPSED_SOURCE_LINES, childAnswer, childArgv, childCalls, childEnvOverrides, childRefusalRows, childTools, describeGrant, EFFECT_ALLOWLIST_ENV, effectFieldsFor, effectLine, effectsUsed, eygCallCount, eygSettings, findMetadata, fieldsOutside, formatDuration, grantEvents, GRANT_ENTRY, GENERATED_MARK, VARIABLE_ENTRY, isUnder, LANGUAGE_DOCS, libraryAliases, MAX_CALLS_ENV, outsideRoot, prepareCallArguments, shippedPolicyPath, probeArguments, probeProgram, POLICY_FIELDS, referenceLines, refusalHints, replayGrants, replayVariables, resolvePolicy, resolveRoots, resultLines, ruleMappingEffects, rootsInside, runnerCandidates, runnerFailureLine, sessionDepth, spawnerPolicy, spawnerRoots, subagentCallLines, subagentResultRows, suggestGrant, surfaceFileLines, surfaceRows, SURFACE_FILE, eygStringLiteral, topLevelBindings, variableDir, variableEvents, variableImportProblems, variableModule, variableName, variablePrelude, VARIABLE_SCOPES, variableRows, variableWriteOutcomes, variableWriteProgram } from "../lib/render-helpers.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const flat = (rows) => rows.map((row) => row.map((segment) => segment.text).join("")).join("\n");
const tones = (rows) => rows.map((row) => row.map((segment) => segment.tone).join("+")).join("\n");

const choice = (policy, source) => ({ policy, source, refusedArgument: null });

const program = `let found = perform Search({path: "/repo", pattern: "*.eyg", limit: 20})
let text = perform ReadFile({path: "/repo/README.md", offset: 0, limit: 100})
perform StandardOut(!int_to_string(!string_length(text)))
perform AppendFile({path: "/repo/log", contents: !string_to_binary("a")})
perform DeleteFile("/repo/log")`;

test("the call row: effects used, the first lines, and nothing else cut", () => {
  const rows = callLines({ code: program, timeout: 60 }, false);
  const shown = flat(rows);
  assert.match(rows[0][0].text, /^eyg $/, "the row names the tool");
  assert.equal(rows[0][1].text, "(timeout: 60s)", "the agent-set limit is visible");
  const effectLine = rows.filter((row) => row[0].tone === "dim" && row[0].text.startsWith("performs: "));
  assert.equal(effectLine.length, 1, "the effects used appear exactly once");
  for (const name of ["Search", "ReadFile", "StandardOut", "AppendFile", "DeleteFile"]) {
    assert.match(effectLine[0][0].text, new RegExp(name), `${name} is named in the collapsed row`);
  }
  const sourceLines = program.split("\n");
  const codeRows = rows.filter((row) => row[0].tone === "code");
  assert.equal(codeRows.length, COLLAPSED_SOURCE_LINES, "the collapsed row shows the first lines only");
  assert.equal(
    codeRows.map((row) => row[0].text).join("\n"),
    sourceLines.slice(0, COLLAPSED_SOURCE_LINES).map((line) => `  ${line}`).join("\n"),
    "and shows them in order, indented",
  );
  assert.match(flat(rows), /\.\.\. \d+ more lines/, "the rest is counted, not hidden silently");
});

test("the expanded call row: the whole program, no marker", () => {
  const rows = callLines({ code: program, timeout: 60 }, true);
  const codeRows = rows.filter((row) => row[0].tone === "code");
  assert.equal(codeRows.length, program.split("\n").length, "every source line is rendered");
  assert.doesNotMatch(flat(rows), /more lines/, "nothing is truncated in the expanded row");
});

test("the result row: summary, timing, and the whole output when expanded", () => {
  const result = {
    content: [{ type: "text", text: "eyg run: ran in 1.24 s wall\nfirst line of output\nsecond line" }],
    details: { ran: true, exit: 0, durationMs: 1240, policy: "/abs/policy.eyg", policySource: "package default", runner: "eyg", roots: "/abs/cwd" },
  };
  const collapsed = resultLines(result, false, 1240, undefined);
  assert.equal(flat(collapsed).split("\n").length, 1, "collapsed is the summary line only");
  assert.equal(collapsed[0][0].tone, "success", "a clean run reads as success");
  assert.match(flat(collapsed), /\(2 output lines\)/, "the summary counts the output");
  assert.doesNotMatch(flat(collapsed), /in 1\.24 s wall in /, "wall time is not repeated twice");

  const expanded = resultLines(result, true, 1240, undefined);
  assert.equal(flat(expanded), "eyg run: ran in 1.24 s wall (2 output lines)\nfirst line of output\nsecond line\npolicy: /abs/policy.eyg (package default) runner: eyg roots: /abs/cwd", "expanded is the summary line plus the whole output");

  const failed = resultLines({ content: [{ type: "text", text: "eyg run: exit 1 wall\nread_file denied by policy: /abs/x" }], details: { ran: true, exit: 1, durationMs: 30 } }, false, 30, undefined);
  assert.equal(failed[0][0].tone, "error", "a failed run reads as an error");

  const refused = resultLines({ content: [{ type: "text", text: "eyg refused: no policy" }], details: { ran: false, gated: true } }, false, undefined, undefined);
  assert.equal(refused[0][0].tone, "error", "a refusal reads as an error");

  const partial = resultLines({ content: [], details: {} }, false, undefined, 92_000);
  assert.equal(flat(partial), "eyg running, 1:32 so far", "a run in flight says how long it has gone");
});

test("wall time: seconds, and minutes when it crosses a minute", () => {
  assert.equal(formatDuration(420), "0.42 s");
  assert.equal(formatDuration(1240), "1.24 s");
  assert.equal(formatDuration(59_999), "60.00 s");
  assert.equal(formatDuration(60_000), "1:00", "a run over a minute is minutes and seconds");
  assert.equal(formatDuration(123_000), "2:03");
  assert.equal(formatDuration(3_723_000), "1:02:03", "and hours when it crosses one");
});

test("the effect scan", () => {
  assert.equal(
    effectsUsed("let a = perform ReadFile({})\nperform StandardOut(a)\n// a note about perform Fetch\nlet b = !int_add(1, 2)").join(","),
    "ReadFile,StandardOut,Fetch",
    "names in order of first appearance, and a comment mentioning an effect counts",
  );
  assert.equal(effectsUsed("let plain = search_lib.search({root: \"/\"})").join(""), "", "a library call is not an effect");
});

test("the registry metadata of the shipped module, and a broken one", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "libraries", "search.eyg"), "utf8");
  const metadata = findMetadata(source);
  assert.equal(metadata.found, true, "the shipped module carries a metadata record");
  assert.equal(metadata.name, "search");
  assert.equal(metadata.effects.join(","), "ReadDirectory");
  assert.ok(metadata.description && metadata.description.length > 20, "it has a description");
  const check = checkDeclaredEffects(source, metadata.effects);
  assert.equal(check.undeclared.join(""), "", "the record declares what the module performs");
  assert.equal(check.unperformed.join(""), "", "and nothing stale");

  const broken = `let f = (x) -> { perform WriteFile({path: x, contents: !string_to_binary("")}) }
let metadata = {
  name: "broken",
  description: "declares the wrong effects",
  signature: "f(x)",
  effects: ["ReadFile"]
}`;
  const brokenCheck = checkDeclaredEffects(broken, ["ReadFile"]);
  assert.equal(brokenCheck.undeclared.join(","), "WriteFile", "an effect the body performs but does not declare is reported");
  assert.equal(brokenCheck.unperformed.join(","), "ReadFile", "and so is a stale annotation");
  assert.equal(findMetadata(broken).found, true, "the record itself is still read");
  assert.equal(findMetadata("let x = 1\n{x}").found, false, "a module with no record is reported as such");
});

test("probe programs: what the availability probe asks, and how the answer is read", () => {
  const read = probeProgram("ReadFile", "/abs/root");
  assert.match(read, /perform ReadFile\(\{path: "\/abs\/root\/\.eyg-codemode-probe", offset: 0, limit: 0\}\)/, "a read at a path that cannot exist, under the root the policy advertises");
  assert.match(read, /let probe_reply = /, "the reply is bound, because the refusal is the Error branch of it");
  assert.match(read, /Error\(why\) -> \{ !never\(perform Abort\(why\)\) \}/, "the refusal is aborted with, so its text reaches the output whatever the standard_out rule says");
  assert.equal(probeArguments("WriteFile", "/abs/root").includes("/abs/root\""), true, "a write names the root itself, a directory, so it cannot create a file");
  assert.equal(probeArguments("MakeDirectory", "/abs/root"), "\"/abs/root\"", "a directory that already exists is made without changing anything");
  assert.equal(probeProgram("Env", "/abs/root"), null, "an effect that must not be probed answers unknown");
  for (const name of ["CWD", "Sleep", "StandardOut", "StandardError"]) {
    assert.equal(probeProgram(name, "/abs/root"), null, `${name} answers a refusal with the same value a pass is, so no probe tells them apart`);
  }
  const fetch = probeProgram("Fetch", "/abs/root");
  assert.match(fetch, /perform Fetch\(/, "Fetch is probed as a whole program");
  assert.match(fetch, /eyg-codemode-probe\.invalid/, "against a host under the reserved TLD, which can never resolve");
  const fallback = probeProgram("ReadDirectory", "");
  assert.match(fallback, /\/dev\/null/, "with no root the impossible path is /dev/null, which is never a directory");
  const now = probeProgram("Now", "/abs/root");
  assert.equal(now, "perform Now({})", "an effect the guard refuses by aborting needs no wrapper: the runtime prints the reason");
});

test("back-compat for a session resumed from an older version of the package", () => {
  const old = prepareCallArguments({ code: "perform CWD({})", mode: "eval", timeout_ms: 1500 });
  assert.equal(old.timeout, 1.5, "timeout_ms becomes timeout in seconds");
  assert.equal(old.action, "eval", "mode becomes action");
  assert.equal(Object.keys(old).includes("timeout_ms"), false, "the old field does not survive");
  assert.equal(Object.keys(old).includes("mode"), false, "and neither does the old mode");
  const current = prepareCallArguments({ code: "perform CWD({})", action: "eval", timeout: 20 });
  assert.equal(current.timeout, 20, "a current call is carried over unchanged");
  assert.equal(prepareCallArguments('{"code": "x", "timeout_ms": 2500}').timeout, 2.5, "even as the JSON string a model sometimes sends");
  assert.equal(prepareCallArguments("not json").code, "", "unparseable arguments answer with the defaults rather than throwing");
  assert.equal(prepareCallArguments({ code: "x", pathe: "/misspelt" }).pathe, "/misspelt", "an unknown field is left for validation to report");
});

test("the probe verdict", () => {
  assert.equal(classifyProbeOutput("read_file denied by policy: /abs/x"), "refused", "the policy said no");
  assert.equal(classifyProbeOutput("unhandled effect ReadFile({})"), "unavailable", "the runner does not implement it");
  assert.equal(classifyProbeOutput("No such file or directory"), "available", "the policy let it through and the host failed");
  assert.equal(classifyProbeOutput("Ok(\"/abs/cwd\")"), "available", "a safe effect printed its value");
});

test("the effect surface: the recorded rule_mapping parses, one row per effect", () => {
  const fixture =
    `  #("AppendFile", policy.PolicyField("append_file")),\n` +
    `  #("DecodeJSON", policy.Unchecked),\n` +
    `  #("WriteFile", policy.PolicyField("write_file")),`;
  assert.equal(ruleMappingEffects(fixture).join(","), "AppendFile,DecodeJSON,WriteFile", "both halves of the mapping parse, in file order");
  assert.equal(effectLine("Search", "search", "allowed for the probe value"), "Search | search | allowed for the probe value", "one row per effect");
  assert.equal(effectLine("Hash", null, "unchecked (computes over values it was given)"), "Hash | none | unchecked (computes over values it was given)", "an unchecked effect names no field");

});
test("where the tool looks for a runner, and the one line a spawn that ran nothing gets", () => {
  // Where the tool looks for a runner that checks effects. A named path ends the
  // search; otherwise the only candidate is the CLI on PATH, because this package
  // depends on the officially installable `eyg` and reaches no build output or other
  // private artifact of its own (`cli.runner-official-install-only`,
  // `gap.runner-release-lacks-policy`).
  assert.deepEqual(
    runnerCandidates("/work", { EYG_CODEMODE_RUNNER: "/opt/eyg" }),
    ["/opt/eyg"],
    "a named runner is the only candidate",
  );
  assert.deepEqual(
    runnerCandidates("/work", { EYG_CODEMODE_RUNNER: "" }),
    ["eyg"],
    "an empty variable names nothing, so the CLI on PATH stands",
  );
  assert.deepEqual(
    runnerCandidates("/work", {}),
    ["eyg"],
    "one candidate when nothing is configured: the installed CLI on PATH",
  );

  // The one line a spawn gets when it ran no program at all (`runnerFailureLine`).
  // The first case is measured output of a binary with no such command: `eyg bogus
  // entry.eyg` answers `no such file: <cwd>/bogus`, because the CLI's fallback form is
  // `<file> [args...]` and it read the mode word as a file name (2026-11-22).
  assert.match(
    runnerFailureLine({
      runner: "eyg",
      mode: "eval",
      entry: "/tmp/pi-eyg-codemode/1/entry.eyg",
      output: "error: no such file: /srv/app/eval\nhint: check the path and that the file exists, relative to the current working directory",
    }) ?? "",
    /has no `eval` command.*`eyg eval \/tmp\/pi-eyg-codemode\/1\/entry\.eyg`.*EYG_CODEMODE_RUNNER=<absolute path>/s,
    "a binary that reads the mode as a file name gets the install line, quoting the command it ran",
  );
  assert.equal(
    runnerFailureLine({ runner: "/opt/eyg", mode: "run", output: "spawn /opt/eyg ENOENT" }),
    "no eyg binary found at /opt/eyg: install the EYG CLI so that `eyg` is on PATH, or name one with EYG_CODEMODE_RUNNER=<absolute path>.",
    "a binary that is not there names where the tool looks",
  );
  assert.equal(
    runnerFailureLine({ runner: "eyg", mode: "run", output: "error: builtin undefined: !nope_such" }),
    null,
    "a program error is not reported as an install problem",
  );
  assert.equal(
    runnerFailureLine({ runner: "eyg", mode: "run", output: "error: no such file: /srv/app/notes.md" }),
    null,
    "a missing file inside a program is not the mode word, so no install line",
  );

});
test("the project settings key: the policy slots in order, and the roots order", () => {
  // The config surface: what the project's `eyg` key says, and which of the six
  // names wins for the policy and for the roots. Every step of both orders is
  // pinned, because the whole point of the key is that a project can say "this
  // directory, this policy" and mean it (`pi.policy-config`). The one slot a model
  // controls is the call's `policy` argument, so it is pinned too: it may only
  // narrow, which means naming the policy the session already runs under or naming
  // the narrowest shipped policy (`notes/pi-codemode-session-grants.md`).
  assert.deepEqual(eygSettings(undefined), { policy: null, roots: [] }, "no settings is no configuration");
  assert.deepEqual(eygSettings({ eyg: { policy: "deny-all", roots: ["/a", "", 5, "/b"] } }), { policy: "deny-all", roots: ["/a", "/b"] }, "a named shipped policy and absolute roots, junk dropped");
  assert.deepEqual(eygSettings({ eyg: { roots: "/only" } }), { policy: null, roots: ["/only"] }, "one root may be written without a list");
  assert.deepEqual(eygSettings({ eyg: "nonsense" }), { policy: null, roots: [] }, "a key of the wrong shape is no configuration");
  assert.equal(shippedPolicyPath("deny-all", "/pkg"), join("/pkg", "policies", "deny-all.eyg"), "a bare name resolves inside the package");
  assert.equal(shippedPolicyPath("/srv/my.eyg", "/pkg"), "/srv/my.eyg", "an absolute path is taken as given");
  assert.equal(shippedPolicyPath("../outside.eyg", "/pkg"), null, "a relative path names nothing, so the caller can say which key is wrong");
  assert.deepEqual(
    resolvePolicy({ argument: "/pkg/policies/agent-roots.eyg", grant: "/pkg/policies/agent-roots.eyg", project: "/p", env: "/e", packageDefault: "/d" }),
    choice("/pkg/policies/agent-roots.eyg", "argument"),
    "the argument of the call wins when it names the policy the other slots already chose",
  );
  assert.deepEqual(
    resolvePolicy({ argument: "/pkg/policies/deny-all.eyg", project: "/pkg/policies/agent-roots.eyg", packageDefault: "/d" }),
    choice("/pkg/policies/deny-all.eyg", "argument"),
    "and wins when it names the narrowest shipped policy, which can only take reach away",
  );
  assert.deepEqual(
    resolvePolicy({ argument: "/pkg/policies/agent-roots.eyg", project: "/pkg/policies/deny-all.eyg" }),
    { policy: "/pkg/policies/deny-all.eyg", source: "project settings", refusedArgument: "/pkg/policies/agent-roots.eyg" },
    "an argument that would widen an operator-narrowed session loses, and the refused name comes back so the caller can say why",
  );
  assert.deepEqual(
    resolvePolicy({ argument: "/mine.eyg", project: "/pkg/policies/deny-all.eyg" }),
    { policy: "/pkg/policies/deny-all.eyg", source: "project settings", refusedArgument: "/mine.eyg" },
    "a module of the model's own is refused for the same reason: nothing proves it narrower",
  );
  assert.deepEqual(
    resolvePolicy({ argument: "/pkg/policies/spawner-effects.eyg", packageDefault: "/pkg/policies/agent-roots.eyg" }),
    { policy: "/pkg/policies/agent-roots.eyg", source: "package default", refusedArgument: "/pkg/policies/spawner-effects.eyg" },
    "and so is a shipped policy that is neither the one in force nor the narrowest one",
  );
  assert.deepEqual(
    resolvePolicy({ grant: "/g", project: "/p", env: "/e", packageDefault: "/d" }),
    choice("/g", "session grant"),
    "then the grant the operator made this session",
  );
  assert.deepEqual(
    resolvePolicy({ project: "/p", env: "/e", packageDefault: "/d" }),
    choice("/p", "project settings"),
    "then the project's eyg.policy",
  );
  assert.deepEqual(
    resolvePolicy({ env: "/e", packageDefault: "/d" }),
    choice("/e", "EYG_POLICY"),
    "then the environment",
  );
  assert.deepEqual(
    resolvePolicy({ packageDefault: "/d" }),
    choice("/d", "package default"),
    "then the policy shipped in the package",
  );
  assert.deepEqual(resolvePolicy({}), choice(null, "none"), "and nothing to run at all if none of them names a module");
  assert.deepEqual(resolvePolicy({ grant: "", project: "/p" }), choice("/p", "project settings"), "an empty name names nothing");
  assert.equal(resolveRoots({ project: ["/p1", "/p2"], env: "/e", cwd: "/c" }), "/p1,/p2", "the project roots win, as a list the policy parses");
  assert.equal(resolveRoots({ project: [], env: "/e", cwd: "/c" }), "/e", "then EYG_ALLOWED_ROOTS");
  assert.equal(resolveRoots({ project: [], env: null, cwd: "/c" }), "/c", "then the working directory");

});

test("the grant store: durations, expiry, revoke, and the branch it lives on", () => {
  const grant = (id, calls, policy = "/p/wide.eyg", roots = []) => ({ op: "grant", id, policy, calls, roots });
  const call = (grantId) => ({ op: "call", grantId });

  const one = replayGrants([grant("g1", 1)]);
  assert.equal(one.policy, "/p/wide.eyg", "a one-call grant is in force until the call spends it");
  assert.equal(one.grants.length, 1, "and says so before the call");
  assert.equal(replayGrants([grant("g1", 1), call("g1")]).policy, null, "one call is spent by one call");

  const three = replayGrants([grant("g2", 3), call("g2"), call("g2")]);
  assert.equal(three.active.used, 2, "an N-call grant counts the calls it covered");
  assert.equal(three.active.calls, 3, "and remembers what it was sold as");
  assert.equal(describeGrant(three.active), "g2: /p/wide.eyg for 3 tool calls (2 used)", "and says so in one line");

  const session = replayGrants([grant("g3", null), call("g3"), call("g3"), call("g3")]);
  assert.equal(session.policy, "/p/wide.eyg", "a session grant is still in force after three calls");
  assert.equal(describeGrant(session.active), "g3: /p/wide.eyg for the rest of the session", "and is described without a counter");

  const revoked = replayGrants([grant("g4", null), call("g4"), { op: "revoke", id: "g4" }, call(null)]);
  assert.deepEqual(revoked.grants, [], "revoke ends it before its calls run out");

  const stack = replayGrants([grant("wide", null), grant("narrow", 1), call("narrow")]);
  assert.equal(stack.active.id, "wide", "the newest grant wins, and the older one is still underneath it");
  assert.equal(stack.grants.map((g) => g.id).join(","), "wide", "the spent one drops out of what is in force");

  assert.equal(replayGrants([grant("g5", 2), { op: "call", grantId: null }]).active.used, 0, "a call that ran under no grant spends nothing");
  assert.deepEqual(replayGrants([]).grants, [], "no events, no grants");

  // The branch, not a variable: the entries come back as pi shapes, and a call that
  // never reached a policy is not one the grant paid for.
  const entries = [
    { type: "custom", customType: GRANT_ENTRY, data: grant("g6", 2, "/p/wide.eyg", ["/extra"]) },
    { type: "message", message: { role: "toolResult", toolName: "eyg", details: { ran: false } } },
    { type: "message", message: { role: "toolResult", toolName: "bash", details: { ran: true } } },
    { type: "message", message: { role: "toolResult", toolName: "eyg", details: { ran: true, grantId: "g6" } } },
  ];
  assert.deepEqual(grantEvents(entries).map((event) => event.op), ["grant", "call"], "only the grant records and the eyg calls that reached a policy");
  const rebuilt = replayGrants(grantEvents(entries));
  assert.equal(rebuilt.active.used, 1, "so a refused call does not spend the grant");
  assert.deepEqual(rebuilt.roots, ["/extra"], "and a grant carries roots as well as a policy");
  assert.equal(replayGrants(grantEvents([{ type: "custom", customType: "other", data: grant("gX", 1) }])).policy, null, "an entry that is not on this extension's type is not a grant");
});

test("what a refusal names: the path, and the exact grant that would clear it", () => {
  const output = "eyg run: exit 1 in 0.11 s wall\nError(\"write_file denied by policy: /tmp/outside\")\nError(\"write_file denied by policy: /tmp/outside\")";
  const hints = refusalHints(output);
  assert.deepEqual(hints, [{ field: "write_file", path: "/tmp/outside" }], "one hint per distinct refusal");
  assert.equal(outsideRoot("/tmp/outside", ["/work"]), "/tmp", "the first directory no root covers");
  assert.equal(outsideRoot("/work/sub/file.eyg", ["/work"]), null, "a path already under a root needs a rule, not a root");
  const lines = suggestGrant(hints[0], { roots: "/work", policy: "/pkg/policies/agent-roots.eyg" });
  assert.match(lines[0], /write_file at \/tmp\/outside/, "the row names the path");
  assert.match(lines[1], /\/eyg-grant/, "and the command that would allow it");
  assert.match(lines[1], /roots \+ \/tmp/, "naming the root to add");
  assert.match(lines[1], /one tool call, N calls, or the rest of the session/, "and the durations offered");
  assert.match(lines[2], /cannot grant it yourself/, "and who may grant it");
  const inside = suggestGrant({ field: "read_file", path: "/work/.env.eyg" }, { roots: "/work", policy: "/p" });
  assert.match(inside[1], /a rule of \/p, not a root/, "when no root would help it says so instead of guessing one");

  // The rows are visible collapsed: the operator has to see the ask to answer it.
  const refused = resultLines({
    content: [{ type: "text", text: "eyg run: exit 1 in 0.11 s wall\nError(\"write_file denied by policy: /tmp/outside\")" }],
    details: { ran: true, exit: 1, policy: "/pkg/policies/agent-roots.eyg", policySource: "package default", roots: "/work", refusals: hints, grants: replayGrants([{ op: "grant", id: "g9", policy: "/p/wide.eyg", calls: 2, roots: ["/tmp"] }]).grants },
  }, false, 110, undefined);
  const shown = flat(refused);
  assert.match(shown, /refused: write_file at \/tmp\/outside/, "the refusal row names the path");
  assert.match(shown, /grants in force: g9: \/p\/wide\.eyg for 2 tool calls \(0 used\) roots \+ \/tmp/, "and every call names the grants in force");
  assert.equal(refused[0][0].tone, "error", "the status line is still the status line");
  assert.match(flat(refused.filter((row) => row[0].tone === "warning")), /one tool call, N calls/, "with the durations to choose from");
});

test("a model may narrow to a shipped policy and may not name a module", () => {
  assert.equal(argumentPolicyPath("deny-all", "/pkg"), join("/pkg", "policies", "deny-all.eyg"), "a bare policy name resolves inside the package");
  assert.equal(argumentPolicyPath("/tmp/my-policy.eyg", "/pkg"), null, "an absolute module path is not the model's to choose");
  assert.equal(argumentPolicyPath("../outside.eyg", "/pkg"), null, "nor is a path that walks out of it");
  assert.equal(argumentPolicyPath("deny-all", null), null, "and with no package directory there is nothing to resolve against");
});

test("a subagent: argv, tools, effect fields and the environment it starts with", () => {
  // A subagent: how it is started, what it may be given, and what comes back.
  assert.deepEqual(
    childArgv({ task: "write the file", model: "strata/qwen3.8-flash", trusted: true }),
    ["--print", "--mode", "json", "--tools", "eyg", "--model", "strata/qwen3.8-flash", "--approve", "write the file"],
    "argv, no shell, only the eyg tool, the task last",
  );
  assert.deepEqual(childArgv({ task: "t" }), ["--print", "--mode", "json", "--tools", "eyg", "t"], "no model, no trust, no --approve");
  assert.deepEqual(
    childArgv({ task: "t", tools: ["eyg", "read"] }),
    ["--print", "--mode", "json", "--tools", "eyg,read", "t"],
    "the tools a spawner named reach argv, comma separated, no shell",
  );
  assert.equal(CHILD_TOOL_ALLOWLIST.join(","), "eyg,read", "the child's tool allowlist is these two names and no more");
  assert.equal(EFFECT_ALLOWLIST_ENV, "EYG_SUBAGENT_EFFECTS", "the environment name the narrowing policy reads");
  assert.deepEqual(childTools(["read", "eyg"]).tools, ["read", "eyg"], "requested order, deduplicated");
  assert.equal(childTools(["eyg"]).ok, true, "the default is the whole channel and nothing else");
  assert.equal(childTools(["eyg", "bash"]).ok, false, "a shell tool is refused: this package spawns no session that has one");
  assert.deepEqual(childTools(["eyg", "bash"]).unknown, ["bash"], "and the name outside the allowlist is the answer");
  assert.equal(childTools(["read"]).ok, false, "a child with no eyg is a session no policy decides");
  assert.equal(childTools(["read"]).withoutEyg, true, "named that way");
  assert.deepEqual(childTools(["eyg", "read"], ["eyg", "eyg_subagent"]).parentMissing, ["read"], "a tool the parent session does not have is named back");
  assert.equal(childTools(["eyg", "read"], ["eyg", "read"]).ok, true, "and granting one the parent has is fine");
  assert.equal(childTools(["read"], null).parentChecked, false, "when the harness does not say what the parent has, that half of the check is skipped and says so");
  assert.deepEqual(
    effectFieldsFor(["ReadFile", "Search", "StandardOut", "NoSuchEffect", "Hash"]).fields,
    ["read_file", "search", "standard_out"],
    "effect names map to policy fields, and a search has its own field, so naming ReadFile does not grant Search",
  );
  assert.deepEqual(effectFieldsFor(["NoSuchEffect"]).unknown, ["NoSuchEffect"], "an effect the CLI does not have is named back");
  assert.deepEqual(effectFieldsFor(["Hash"]).unchecked, ["Hash"], "an effect no policy can forbid is reported, not enforced");
  assert.deepEqual(fieldsOutside(["write_file", "read_file"], ["read_file"]), { ok: false, outside: ["write_file"] }, "a field the policy in force refuses is named back");
  assert.equal(fieldsOutside(["read_file"], ["read_file"]).ok, true, "a field it performs is not");
  assert.deepEqual(
    childEnvOverrides({ policy: "/p/spawner-effects.eyg", roots: "/a,/b", depth: 1, effects: ["read_file", "standard_out"], maxCalls: 2 }),
    { EYG_POLICY: "/p/spawner-effects.eyg", EYG_SUBAGENT_POLICY: "/p/spawner-effects.eyg", EYG_ALLOWED_ROOTS: "/a,/b", EYG_CODEMODE_DEPTH: "1", EYG_SUBAGENT_EFFECTS: "read_file,standard_out", EYG_SUBAGENT_MAX_CALLS: "2" },
    "the effect allowlist and the call budget travel to the child the way the roots do",
  );
  assert.deepEqual(
    childEnvOverrides({ policy: "/p/wide.eyg", roots: "/a,/b", depth: 1 }),
    { EYG_POLICY: "/p/wide.eyg", EYG_SUBAGENT_POLICY: "/p/wide.eyg", EYG_ALLOWED_ROOTS: "/a,/b", EYG_CODEMODE_DEPTH: "1" },
    "the policy, the roots and the depth the child runs at",
  );
  assert.deepEqual(rootsInside(["/work/sub"], ["/work"]), { ok: true, outside: [] }, "a slice of the spawner's reach is allowed");
  assert.deepEqual(rootsInside(["/work", "/tmp"], ["/work"]).outside, ["/tmp"], "a root outside it is named back");
  assert.equal(isUnder("/workx", "/work"), false, "a sibling directory is not under the root");
  assert.equal(isUnder("/", "/work"), false, "and neither is its parent");
  assert.equal(isUnder("/work", "/work"), true, "a root covers itself");
  const childRecords = [
    JSON.stringify({ type: "tool_execution_end", toolName: "eyg", result: { details: { policy: "/p.eyg", policySource: "spawner", roots: "/work", exit: 0, refusals: [{ field: "write_file", path: "/tmp/x" }] } } }),
    JSON.stringify({ type: "message", message: { role: "assistant", content: [{ type: "text", text: "wrote it, /tmp was refused" }] } }),
    "not json",
  ].join("\n");
  assert.deepEqual(childCalls(childRecords).map((call) => call.policySource), ["spawner"], "the child's calls, read out of its JSON records");
  assert.deepEqual(childCalls(childRecords)[0].refusals, [{ field: "write_file", path: "/tmp/x" }], "and its refusals reach the parent");
  assert.equal(childCalls(childRecords)[0].budget, null, "a call that merely ran carries no budget");
  const budgetRecord = JSON.stringify({ type: "tool_execution_end", toolName: "eyg", result: { details: { ran: false, budget: 2, callsMade: 2 } } });
  assert.equal(childCalls(budgetRecord)[0].budget, 2, "a call the budget refused carries the budget, which is how the spawner knows the child ran out");
  assert.equal(childAnswer(childRecords), "wrote it, /tmp was refused", "and its last words");
  assert.deepEqual(childCalls(undefined), [], "no output is no calls, not a crash");

});
test("a spawner's slots: depth, roots and call budget, with a grant on top", () => {
  // A grant adds roots on top of what the project and the environment say, and a
  // model may not name the module it is checked against.
  assert.deepEqual(
    resolvePolicy({ grant: "/g", spawner: "/s", project: "/p", env: "/e", packageDefault: "/d" }),
    choice("/g", "session grant"),
    "the operator's grant outranks what a spawner chose",
  );
  assert.deepEqual(
    resolvePolicy({ spawner: "/s", project: "/p", env: "/e", packageDefault: "/d" }),
    choice("/s", "spawner"),
    "then the policy the spawner of a subagent session named, which outranks the project key",
  );
  assert.equal(rootsInside(["/work/a", "/work/b"], ["/work"]).ok, true, "several slices are fine");

  assert.equal(resolveRoots({ grant: ["/tmp"], project: ["/p1"], env: "/e", cwd: "/c" }), "/p1,/tmp", "the grant widens, it does not replace");
  assert.equal(resolveRoots({ grant: ["/p1"], project: ["/p1"], env: null, cwd: "/c" }), "/p1", "and cannot duplicate a root");
  assert.equal(resolveRoots({ grant: ["/tmp"], env: "/a, /b", cwd: "/c" }), "/a,/b,/tmp", "an environment list is split and trimmed first");

  // The depth marker decides which slots a spawner fills: a project that sets the
  // variables in its own environment gets no spawner standing.
  assert.equal(sessionDepth({}), 0, "a session a human started sits at depth 0");
  assert.equal(sessionDepth({ EYG_CODEMODE_DEPTH: "2" }), 2, "a session this package started sits where the marker says");
  assert.equal(sessionDepth({ EYG_CODEMODE_DEPTH: "nonsense" }), 0, "a nonsense marker reads as depth 0, not NaN");
  assert.equal(spawnerPolicy({ EYG_SUBAGENT_POLICY: "/s.eyg" }), null, "a project that sets the variable itself gets nothing");
  assert.equal(spawnerPolicy({ EYG_SUBAGENT_POLICY: "/s.eyg" }, 1), "/s.eyg", "in a session this package started it is the spawner's word");
  assert.deepEqual(spawnerRoots({ EYG_ALLOWED_ROOTS: "/a, /b" }, 1), ["/a", "/b"], "the roots a spawner gave, split the way the policy parses them");
  assert.deepEqual(spawnerRoots({ EYG_ALLOWED_ROOTS: "/a" }), [], "and not in a session a human started");
  assert.equal(resolveRoots({ spawner: ["/work/sub"], project: ["/p1"], env: "/e", cwd: "/c" }), "/work/sub", "a spawner's roots replace the project's, which is how it hands over a slice");
  assert.equal(resolveRoots({ grant: ["/tmp"], spawner: ["/work/sub"], cwd: "/c" }), "/work/sub,/tmp", "and a grant in that session still adds on top");

  // The call budget is the spawner's word, read only under the depth marker, and is
  // spent by the calls the child's own session records.
  assert.equal(callBudget({ [MAX_CALLS_ENV]: "2" }, 1), 2, "a spawner's budget in a session this package started");
  assert.equal(callBudget({ [MAX_CALLS_ENV]: "2" }), null, "a project that sets the variable itself gets no budget");
  assert.equal(callBudget({ [MAX_CALLS_ENV]: "0" }, 1), 0, "zero is a real budget: think and report, do not call");
  assert.equal(callBudget({ [MAX_CALLS_ENV]: "soon" }, 1), null, "and a nonsense one is no budget rather than NaN");
  assert.equal(callBudget({}, 1), null, "with no marker there is no budget");
  const branch = [
    { type: "message", message: { role: "toolResult", toolName: "eyg", details: { ran: true } } },
    { type: "message", message: { role: "toolResult", toolName: "eyg", details: { ran: false } } },
    { type: "message", message: { role: "toolResult", toolName: "read", details: {} } },
    { type: "message", message: { role: "assistant", content: [] } },
  ];
  assert.equal(eygCallCount(branch), 1, "only a call that reached a policy spends the budget, the same rule a grant is spent by");
  assert.equal(eygCallCount(undefined), 0, "an empty session is zero calls");
  assert.match(budgetRefusal(2, 2), /budget of 2/, "the child is told the number it ran out of");
  assert.match(budgetRefusal(2, 2), /not yours to widen/, "and that the budget belongs to the spawner");

});
test("the rows a subagent spawn renders: the ask, and what came back", () => {
  // The rows the subagent tool renders: the ask, and what came back.
  const asked = subagentCallLines({ task: "l1\nl2\nl3\nl4\nl5", roots: ["/work/sub"], timeout: 90, policy: "deny-all" }, false);
  assert.match(flat(asked), /eyg_subagent \(timeout: 90s\) ?policy: deny-all/, "the timeout and the named policy in the head");
  assert.match(flat(asked), /roots: \/work\/sub/, "the roots the child was given");
  assert.ok(!flat(asked).includes("l5"), "collapsed shows the first lines of the task only");
  assert.match(flat(asked), /\.\.\. 1 more lines/, "and says how many it dropped");
  assert.match(flat(subagentCallLines({ task: "l1\nl2\nl3\nl4\nl5", roots: [] }, true)), /l5/, "expanded shows the whole task");
  assert.match(flat(subagentCallLines({ task: "t" }, false)), /roots: inherited: the roots this session has/, "with no roots named the child inherits them");
  const narrowed = subagentCallLines({ task: "t", tools: ["eyg", "read"], effects: ["ReadFile", "WriteFile"], max_calls: 3 }, false);
  assert.match(flat(narrowed), /tools: eyg, read \(pi's read tool is not decided by a policy\)/, "the tools, with the fact that makes them worth narrowing");
  assert.match(flat(narrowed), /effects: read_file, write_file under the spawner allowlist policy/, "effect names shown as the fields the policy reads");
  assert.match(flat(narrowed), /max_calls: 3/, "and the budget");
  assert.match(flat(subagentCallLines({ task: "t" }, false)), /tools: eyg/, "a child left at the default has one tool");
  assert.ok(!flat(subagentCallLines({ task: "t" }, false)).includes("effects:"), "and no effect allowlist line when none was named");

  const childResult = {
    content: [{ type: "text", text: "eyg_subagent: answered in 1.20 s wall\nchild under /p.eyg (project settings), roots /work" }],
    details: {
      ran: true,
      exit: 0,
      argv: ["--print", "--mode", "json", "--tools", "eyg", "t"],
      policy: "/p.eyg",
      calls: [{ policy: "/p.eyg", policySource: "spawner", roots: "/work", exit: 0, refusals: [{ field: "write_file", path: "/tmp/x" }] }],
      refusals: [{ field: "write_file", path: "/tmp/x" }],
    },
  };
  const answered = subagentResultRows(childResult, false, 1200);
  assert.ok(flat(answered).split("\n")[0].startsWith("eyg_subagent: answered in 1.20 s wall"), "the status line is the first line of the report");
  assert.match(flat(answered), /\(1 eyg call\)/, "and how many calls the child made");
  assert.match(flat(answered), /child refused: write_file at \/tmp\/x under \/p\.eyg/, "a child's refusal shows collapsed");
  assert.match(flat(answered), /a grant does not reach a child/, "with the honest reason for it");
  assert.ok(!flat(answered).includes("argv:"), "the argv belongs to the expanded row");
  assert.match(flat(subagentResultRows(childResult, true, 1200)), /argv: pi --print --mode json --tools eyg t/, "and shows there");
  assert.ok(flat(subagentResultRows(childResult, true, 1200)).includes("child under /p.eyg"), "expanded carries the whole report");
  assert.equal(childRefusalRows({ policy: "/p.eyg", refusals: [{ field: "read_file", path: "/x" }] }).length, 2, "the refusal and the reason it stands");
  assert.equal(childRefusalRows({ policy: "/p.eyg", refusals: [] }).length, 0, "no refusal, no lecture");
  const refusedSpawn = subagentResultRows({ content: [{ type: "text", text: "eyg refused: a subagent gets no children" }], details: { gated: true, ran: false } }, false, undefined);
  assert.equal(tones(refusedSpawn).split("\n")[0], "error", "a refused spawn is an error row");
  const out = JSON.parse(JSON.stringify(childResult));
  out.details.maxCalls = 2;
  out.details.calls.push({ policy: "/p.eyg", policySource: "spawner", roots: "/work", exit: null, refusals: [], budget: 2 });
  assert.match(flat(subagentResultRows(out, false, 1200)), /of a budget of 2/, "a budgeted child's row says what it was bounded by");
  assert.match(flat(subagentResultRows(out, false, 1200)), /spent its call budget/, "and that it ran out");
  assert.ok(!flat(subagentResultRows(childResult, false, 1200)).includes("call budget"), "a child that never hit one is not told about one");

});
test("the drift guard: POLICY_FIELDS against the recorded rule_mapping", () => {
  // The drift guard. This workspace is the pi package on its own, so the runtime
  // that owns `rule_mapping` is not in this tree: the guard compares the effect labels
  // and the unchecked set of `POLICY_FIELDS` against the recorded snapshot in
  // test/fixtures/rule_mapping.gleam (provenance in test/fixtures/rule_mapping.PROVENANCE.md),
  // and when EYG_RULE_SOURCE names a real runtime source it reads that as well and fails
  // if the runtime drifted from the snapshot. Without the variable the live check is
  // skipped and says so below. The snapshot's field column is not compared: the checks run
  // in `host/guard.eyg` now, and its fields are this package's, which
  // `test/host-coverage.test.mjs` proves are the fields the guard reads.
  const snapshot = readFileSync(join(import.meta.dirname, "fixtures", "rule_mapping.gleam"), "utf8");
  const advertised = Object.keys(POLICY_FIELDS).join(",");
  assert.equal(ruleMappingEffects(snapshot).join(","), advertised, "the advertised surface is the recorded rule_mapping, in order");
  const live = process.env.EYG_RULE_SOURCE;
  if (live !== undefined) {
    const gleam = readFileSync(live, "utf8");
    assert.equal(ruleMappingEffects(gleam).join(","), advertised, "the live runtime rule_mapping still matches the recorded snapshot");
  }
  const unchecked = Object.keys(POLICY_FIELDS).filter((name) => POLICY_FIELDS[name] === null).join(",");
  assert.equal(unchecked, "DecodeJSON,EYGParse,Hash,Sign", "exactly four effects carry no policy field and are available under every policy");
});

test("the reference answer: the surface file, both halves of it", () => {
  const text = readFileSync(join(import.meta.dirname, "..", SURFACE_FILE), "utf8");
  const rows = surfaceRows(text);
  const builtins = rows.filter((row) => row.name.startsWith("!"));
  const effects = rows.filter((row) => !row.name.startsWith("!"));
  assert.ok(builtins.length >= 25, `the surface file yields its builtin rows, got ${builtins.length}`);
  for (const row of builtins) {
    assert.match(row.name, /^![a-z0-9_]+$/, `${row.name} is a builtin name`);
    assert.ok(row.signature !== "", `${row.name} carries its signature and notes`);
    assert.ok(!/\|$/.test(row.signature), `${row.name} carries no dangling table separator`);
  }
  const byName = new Map(builtins.map((row) => [row.name, row]));
  for (const name of ["!int_add", "!string_split_once", "!binary_size", "!list_pop", "!never"]) {
    assert.ok(byName.has(name), `${name} is listed`);
  }
  assert.equal(byName.get("!int_add").detail1, "Integers", "the section heading travels with the row");
  assert.ok(!builtins.some((row) => row.detail1 === "Common idioms"), "a prose section adds no rows");
  // The effect half is generated from the recorded rule_mapping, so it is the
  // advertised surface exactly, in order, with what the policy decides for each.
  assert.deepEqual(effects.map((row) => row.name), Object.keys(POLICY_FIELDS), "its effect rows are POLICY_FIELDS, in order");
  for (const [name, field] of Object.entries(POLICY_FIELDS)) {
    const row = effects.find((r) => r.name === name);
    assert.equal(row.detail1, field ?? "none", `${name} carries the policy field that decides it, or none`);
  }
  assert.ok(text.includes(GENERATED_MARK), "the file says it is generated, and by what");
  assert.ok(text.includes(LANGUAGE_DOCS), "and names the language's pages rather than copying them");
  assert.match(
    text,
    /test\/fixtures\/surface\.PROVENANCE\.md/,
    "the builtin rows name the page that records their capture",
  );
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(text), "the generated file carries no date: --check decides currency, the provenance page carries the date");

  const lines = referenceLines(text, { policy: "/pkg/policies/agent-roots.eyg", policySource: "project settings" });
  assert.match(lines[0], new RegExp(`builtins: ${builtins.length}, read from ${SURFACE_FILE}`), "the count and the file it came from");
  for (const name of Object.keys(POLICY_FIELDS)) {
    assert.ok(lines.some((line) => line.startsWith(`  ${name} | `)), `${name} is in the effect surface`);
  }
  assert.ok(lines.some((line) => line.includes("DecodeJSON | none")), "an unchecked effect says no policy can forbid it");
  assert.ok(lines.some((line) => line.startsWith("effects:") && line.includes(SURFACE_FILE)), "the effect half names the file it was generated into");
  assert.ok(lines.some((line) => line.startsWith(surfaceFileLines()[0])), "and points at the generator that keeps it true");
  assert.ok(lines.some((line) => line.includes('policy in force: /pkg/policies/agent-roots.eyg (project settings)')), "the policy in force is named");
  assert.ok(lines.some((line) => line.includes('action "effects"')), "and the call that asks it what it decides, effect by effect");
  assert.ok(lines.some((line) => line.includes("read tool is not decided by a policy")), "the harness read tool's standing is stated");
  assert.ok(!/\| (allowed|refused|unavailable|unknown)/.test(lines.join("\n")), "it reports no verdict, so it asked the policy nothing");
});

test("the drift check over the surface file: four inputs, and a planted rename answers", () => {
  const text = readFileSync(join(import.meta.dirname, "..", SURFACE_FILE), "utf8");
  assert.deepEqual(surfaceDriftProblems(text), [], "the file agrees with the fixture, POLICY_FIELDS, this tree's calls and its own rebuild");

  const renamed = surfaceDriftProblems(text.replace("effect\tWriteFile\twrite_file", "effect\tWriteFileX\twrite_file"));
  assert.ok(renamed.some((p) => p.includes("missing row: effect\tWriteFile\twrite_file")), "a renamed effect row is a missing row");
  assert.ok(renamed.some((p) => p.includes("row not in the inputs: effect\tWriteFileX")), "and an invented one is an extra row");
  assert.ok(renamed.some((p) => p === "the file does not match what the generator rebuilds"), "and the byte-for-byte rebuild notices");

  const dropped = surfaceDriftProblems(text.replace("effect\tSearch\tsearch\t\n", ""));
  assert.ok(dropped.some((p) => p.includes("missing row: effect\tSearch")), "a deleted effect row is caught by the recorded mapping");

  const builtinRenamed = surfaceDriftProblems(text.replace("builtin\t!int_add\tIntegers\t", "builtin\t!int_addx\tIntegers\t"));
  assert.ok(
    builtinRenamed.some((p) => p === "builtin this tree calls is not listed: !int_add"),
    "a renamed builtin this tree calls is caught by the sources that call it",
  );
});

test("the rows a failed run adds when it named a builtin the runtime does not have", () => {
  const out = "error: builtin undefined: !str_len\nhint: check the builtin name against the builtins reference\n\n\u2192 in <inline>:1";
  assert.deepEqual(builtinErrors(out), ["!str_len"], "the runner's own error text is what is scanned");
  assert.deepEqual(
    builtinErrors("builtin undefined: !inspect\nbuiltin undefined: !inspect\nbuiltin undefined: unwrap"),
    ["!inspect", "!unwrap"],
    "deduplicated, and normalised with a leading !",
  );
  assert.deepEqual(builtinErrors("ran fine"), [], "no such error, nothing to say");

  const rows = builtinHintRows(builtinErrors(out));
  const shown = flat(rows);
  assert.match(shown, /no such builtin: !str_len/, "the name is repeated back");
  assert.ok(shown.includes(SURFACE_FILE), "the row names the surface file");
  assert.match(shown, /action "reference"/, "and the action that prints the list without leaving the tool");
  assert.ok(shown.includes("read tool is not decided by a policy"), "and says pi's own read tool is not decided by a policy");
  assert.equal(shown.split(SURFACE_FILE).length - 1, 2, "builtins and syntax share one file, so it is named twice and no guide path is invented");
  assert.equal(builtinHintRows([]).length, 0, "no invented builtin, no lecture");

  const result = {
    content: [{ type: "text", text: "eyg run: exit 1 in 0.10 s wall\nerror: builtin undefined: !str_len" }],
    details: { ran: true, exit: 1, builtins: ["!str_len"] },
  };
  const collapsed = flat(resultLines(result, false, 100));
  assert.match(collapsed, /no such builtin: !str_len/, "the hint shows collapsed, where the model reads it");
  const clean = flat(resultLines({ content: [{ type: "text", text: "eyg run: ran in 0.10 s wall\n2" }], details: { ran: true, exit: 0 } }, false, 100));
  assert.ok(!clean.includes("no such builtin"), "a run that named no invented builtin gets no hint row");
});

// The kept bindings: what an `extern` call stores, and what the next call sees.
// The scan, the module text, the write program and the replay are all pure, so all of
// this is checkable here; that a policy decides the write is not, and
// `docs/world/entities/pi.variable-scopes.md` says what was seen how.

const keptProgram = `let signature = "a\\"b\\\\c\\td\\ne"
let greet = (who) -> {
  // the ( bracket in this comment is not a bracket
  let inner = !string_append(signature, who)
  inner
}
let {unused_left, unused_right} = {unused_left: 1, unused_right: 2}
let greeting = greet("!")
greeting`;

test("kept bindings: the scan keeps a program's top-level lets and nothing else", () => {
  const scanned = topLevelBindings(keptProgram);
  assert.deepEqual(
    scanned.bindings.map((binding) => binding.name),
    ["signature", "greet", "greeting"],
    "a `let` inside a function body is not a binding of the program",
  );
  const greet = scanned.bindings.find((binding) => binding.name === "greet");
  assert.equal(
    greet.source,
    "(who) -> {\n  // the ( bracket in this comment is not a bracket\n  let inner = !string_append(signature, who)\n  inner\n}",
    "the value of a multi-line let is its text, bracket to bracket, comment kept",
  );
  assert.deepEqual(scanned.skipped, ["unused_left, unused_right"], "a destructuring let is named, not guessed at");
  assert.deepEqual(scanned.problems, [], "every other top-level line was a plain binding");
  assert.equal(scanned.unbalanced, false, "and nothing was left open");

  const broken = topLevelBindings("let open = (a) -> {\n  a");
  assert.equal(broken.unbalanced, true, "a value that never closes is reported");
  assert.deepEqual(topLevelBindings("greeting").bindings, [], "a program with no let keeps nothing");
});

test("kept bindings: the names EYG can bind, and the snake_case name it suggests", () => {
  assert.equal(variableName("my_web_search").ok, true, "lower snake_case is what the parser binds");
  assert.equal(variableName("a1").ok, true, "a digit after the first letter is fine");
  const camel = variableName("myWebSearch");
  assert.equal(camel.ok, false, "camelCase is not a name EYG can bind");
  assert.match(camel.problem, /name it my_web_search/, "the answer says what to call it instead");
  for (const rejected of ["9lives", "two words", "Dashed", "", "handle", "perform", "match", "import", "let"]) {
    assert.equal(variableName(rejected).ok, false, `${rejected || "(empty)"} is not bindable`);
  }
  assert.match(variableName("search_lib").problem, /_lib/, "a name ending in _lib would collide with a libraries alias");
});

test("kept bindings: the module written for a file scope, and the prelude that reads it back", () => {
  const module = variableModule({ name: "greet", source: '(who) -> { !string_append("hi", who) }', references: ["signature"] });
  const lines = module.split("\n");
  assert.ok(lines[0].startsWith("//"), "the file says what it is, so a person opening it is not guessing");
  assert.ok(module.includes('let {signature} = import "./signature.eyg"'), "a sibling of the same scope is imported by relative path");
  assert.ok(!/[A-Za-z]:[\\/]|\/home\/|\/Users\/|\/operator-home\//.test(module), "and the written file carries no machine path");
  assert.ok(module.includes('let greet = (who) -> { !string_append("hi", who) }'), "the source text is the binding, unchanged");
  assert.equal(lines[lines.length - 2], "{greet}", "the module exports the name it is named for");

  const fromFile = variablePrelude({ name: "greet", path: "/work/.pi/eyg-variables/greet.eyg" });
  assert.equal(fromFile, 'let {greet} = import "/work/.pi/eyg-variables/greet.eyg"', "a file scope is aliased by importing its module");
  const fromSession = variablePrelude({ name: "greet", path: null, source: '(who) -> { who }' });
  assert.equal(fromSession, "let greet = (who) -> { who }", "a session binding is aliased by its source text");
});

test("kept bindings: the write is a program of effects, so a policy decides every step", () => {
  const program = variableWriteProgram({
    dir: "/operator-home/.pi/eyg-variables",
    files: [{ path: "/operator-home/.pi/eyg-variables/note.eyg", contents: 'let note = "x"\n{note}\n' }],
  });
  assert.ok(program.includes('perform MakeDirectory("/operator-home/.pi/eyg-variables")'), "the directory is made by an effect");
  assert.ok(program.includes("perform WriteFile({path: \"/operator-home/.pi/eyg-variables/note.eyg\", contents: !string_to_binary("), "and the file is written by an effect");
  assert.ok(program.trimEnd().endsWith("[made, write_1]"), "the program leaves both results as its value");
  assert.equal((program.match(/perform StandardOut/g) ?? []).length, 2, "and prints one row per step, since a run prints no value of its own");
  assert.ok(program.includes('said("write", "/operator-home/.pi/eyg-variables/note.eyg", write_1)'), "each printed row names the path it answered for");
  assert.equal(variableWriteProgram({ dir: null, files: [] }), null, "nothing to write is not a program");

  const scanned = variableDir("user", { cwd: "/work", home: "/operator-home" });
  assert.equal(scanned, "/operator-home/.pi/eyg-variables", "user scope is the operator's home directory");
  assert.equal(variableDir("workspace", { cwd: "/work", home: "/operator-home" }), "/work/.pi/eyg-variables", "workspace scope is this workspace");
  assert.equal(variableDir("session", { cwd: "/work", home: "/operator-home" }), null, "session scope has no directory: it is this session's records");
  assert.equal(variableDir("user", { cwd: "/work", home: null }), null, "and with no home there is nothing to write to");
  const userModule = `${variableDir("user", { cwd: "/work", home: "/operator-home" })}/note.eyg`;
  assert.ok(!isUnder(userModule, "/work"), "user scope sits outside the roots the shipped policy gives a session, so its write is refused until a root reaches the home directory");
  assert.ok(isUnder(variableDir("workspace", { cwd: "/work" }) + "/note.eyg", "/work"), "while the workspace scope's write is inside them");
});

test("kept bindings: a session branch replays its own definitions", () => {
  const entries = [
    { type: "custom", customType: "other", data: { op: "define", name: "ignored", source: "1" } },
    { type: "custom", customType: VARIABLE_ENTRY, data: { op: "define", name: "note", source: '"first"' } },
    { type: "message", message: { role: "toolResult", toolName: "eyg" } },
    { type: "custom", customType: VARIABLE_ENTRY, data: { op: "define", name: "note", source: '"second"' } },
    { type: "custom", customType: VARIABLE_ENTRY, data: { op: "define", name: "other", source: "2" } },
  ];
  assert.deepEqual(replayVariables(variableEvents(entries)), [
    { name: "note", source: '"second"' },
    { name: "other", source: "2" },
  ], "the newest definition of a name wins and a foreign entry is not one");
  assert.deepEqual(
    replayVariables(variableEvents([...entries, { type: "custom", customType: VARIABLE_ENTRY, data: { op: "revoke", name: "note" } }])),
    [{ name: "other", source: "2" }],
    "a revoke drops it",
  );
  assert.deepEqual(replayVariables(variableEvents([])), [], "an empty branch keeps nothing");
});

test("kept bindings: a refused write is reported as the refused effect it is", () => {
  const output = 'mkdir /operator-home/.pi/eyg-variables: ok\nwrite /operator-home/.pi/eyg-variables/note.eyg: write_file denied by policy: /operator-home/.pi/eyg-variables/note.eyg\n';
  const hints = refusalHints(output);
  assert.deepEqual(hints, [{ field: "write_file", path: "/operator-home/.pi/eyg-variables/note.eyg" }], "the refusal is the row the write program printed");
  const keep = [{ name: "note", source: '"x"', references: [] }];
  const files = [{ path: "/operator-home/.pi/eyg-variables/note.eyg", contents: 'let note = "x"\n{note}\n' }];
  const refused = variableWriteOutcomes({ scope: "user", keep, files, output, present: [], code: 0, killed: false });
  assert.deepEqual(refused, [
    { name: "note", scope: "user", path: "/operator-home/.pi/eyg-variables/note.eyg", written: false, problem: "write_file denied by the policy in force" },
  ], "a refused write is not kept, and the row names the field that refused it");
  const kept = variableWriteOutcomes({
    scope: "user",
    keep,
    files,
    output: "mkdir /operator-home/.pi/eyg-variables: ok\nwrite /operator-home/.pi/eyg-variables/note.eyg: ok\n",
    present: ["/operator-home/.pi/eyg-variables/note.eyg"],
    code: 0,
    killed: false,
  });
  assert.equal(kept[0].written, true, "the refusal absent, the program finished and the file present is a kept binding");
  const silent = variableWriteOutcomes({ scope: "user", keep, files, output: "", present: [], code: 0, killed: false });
  assert.match(silent[0].problem, /no file at .* after the write program ran/, "a program that printed nothing and wrote nothing is not a success");
  const half = variableWriteOutcomes({ scope: "user", keep, files, output: "", present: files.map((file) => file.path), code: 1, killed: false });
  assert.equal(half[0].written, false, "a file left by a program that did not finish is not kept either");
  assert.match(half[0].problem, /exited 1/, "and the row says which");
  const rows = variableRows({
    variables: [
      { name: "note", scope: "user", path: "/operator-home/.pi/eyg-variables/note.eyg", written: false, problem: "write_file denied by the policy in force" },
    ],
  });
  const shown = flat(rows);
  assert.match(shown, /did not keep note/, "the row says what was not kept");
  assert.equal(rows[0][0].tone, "warning", "and shows it in the colour an ask gets");
  assert.match(flat(resultLines({
    content: [{ type: "text", text: "eyg run: ran in 0.10 s wall\n5" }],
    details: { ran: true, exit: 0, variables: [{ name: "note", scope: "workspace", path: "/work/.pi/eyg-variables/note.eyg", written: true, problem: null }] },
  }, false, 100)), /kept note in \/work\/\.pi\/eyg-variables\/note\.eyg/, "a kept binding is named in the collapsed row too");
});

test("kept bindings: a module that does not parse comes back with the fix", () => {
  const abort = 'eyg run: exit 1 in 0.10 s wall\nerror: Aborted with reason: "failed to parse source from location: /work/.pi/eyg-variables/note.eyg error: unexpected end of input hint: program must end with valid expression"';
  const rows = variableImportProblems(abort, ["/work/.pi/eyg-variables/note.eyg"]);
  assert.equal(rows.length, 2, "one line for what is wrong, one for what to do");
  assert.match(rows[0], /the kept binding in \/work\/\.pi\/eyg-variables\/note\.eyg is not readable EYG: unexpected end of input/, "the file and the runner's reason");
  assert.match(rows[1], /define note again with an extern call, or delete the file with DeleteFile/, "and the fix, in this tool's own terms");
  const scratch = 'error: Aborted with reason: "failed to parse source from location: /tmp/pi-eyg-codemode/1-a-1/program.eyg error: unexpected `}` at position 94"';
  assert.deepEqual(variableImportProblems(scratch, []), [], "a program this call wrote is not a kept binding: its own parse error is the runner's message, not an ask to redefine a binding");
  assert.deepEqual(variableImportProblems(abort, ["/elsewhere/module.eyg"]), [], "a parse error in some other file is not blamed on a kept binding");
  assert.deepEqual(variableImportProblems("eyg run: ran in 0.10 s wall\n5", []), [], "a run that parsed everything says nothing");
});

test("kept bindings: what an extern call refuses to keep, and why", () => {
  const wanted = externBindings({ source: keptProgram, existing: ["signature"] });
  assert.deepEqual(wanted.keep.map((binding) => binding.name), ["signature", "greet", "greeting"], "the order defines each name after the ones it uses");
  assert.deepEqual(wanted.keep[2].references, ["greet"], "a binding records the names of its scope its own text refers to");
  assert.deepEqual(wanted.problems, ["the destructuring let (unused_left, unused_right) is not one binding this keeps"], "the destructuring let is reported, not silently dropped");

  const aliased = externBindings({ source: 'let helper = (root) -> { search_lib.search({root, pattern: "*", limit: 5}) }\nhelper("/work")', existing: [] });
  assert.deepEqual(aliased.refused[0].name, "helper", "a binding that uses a libraries alias is refused");
  assert.match(aliased.refused[0].problem, /search_lib/, "and named back with the alias it used");

  const self = externBindings({ source: 'let loop = !string_append(loop, "x")\nloop', existing: [] });
  assert.equal(self.keep.length, 0, "a binding that names itself is not kept");
  assert.match(self.refused[0].problem, /names itself/, "because a module cannot import itself");

  const circular = externBindings({ source: "let a = b\nlet b = a\nb", existing: [] });
  assert.match(circular.refused.map((refusal) => refusal.problem).join(" "), /refer to each other/, "two bindings that use each other cannot be modules");

  assert.deepEqual(externBindings({ source: "perform StandardOut(\"hi\\n\")", existing: [] }).problems, ["the program defines no top-level `let` binding to keep"], "a call with nothing to keep says so");
});

test("kept bindings: one string literal, five escapes, and a round trip", () => {
  const text = 'a"b\\c\td\ne\rf \u00e9 \u79fb end';
  const literal = eygStringLiteral(text);
  assert.equal(JSON.parse(literal), text, "the literal decodes back to the text exactly (the five escapes are JSON escapes too)");
  assert.equal(literal.replace(/\\"|\\\\|\\n|\\t|\\r/g, ""), `"${text.replace(/["\\\n\r\t]/g, "")}"`, "and only those five escapes were written");
  assert.equal(eygStringLiteral("a\u000bb"), `"a\u000bb"`, "a character with no escape goes through raw, which is what the CLI reads");
  assert.deepEqual(libraryAliases('let f = (x) -> { search_lib.go(x) } // note: other_lib here\nlet s = "no_lib in a string"'), ["search_lib"], "the alias scan reads what the program runs, not its comments or strings");
});

test("kept bindings: the argument and the rows", () => {
  assert.match(flat(callLines({ code: "let note = 1\nnote", extern: "workspace" }, false)), /extern: workspace/, "the ask is visible in the collapsed call row");
  assert.ok(!flat(callLines({ code: "note" }, false)).includes("extern"), "a call that keeps nothing says nothing about it");
  assert.deepEqual(prepareCallArguments({ code: "let note = 1", extern: "session" }).extern, "session", "the argument survives the argument mapping");
  assert.deepEqual(VARIABLE_SCOPES, ["user", "workspace", "session"], "furthest to nearest, the order a nearer scope shadows in");
});
