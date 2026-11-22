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
 */

import assert from "node:assert/strict";
import { argumentPolicyPath, budgetRefusal, builtinErrors, builtinHintRows, builtinRows, callBudget, callLines, checkDeclaredEffects, CHILD_TOOL_ALLOWLIST, classifyProbeOutput, COLLAPSED_SOURCE_LINES, childAnswer, childArgv, childCalls, childEnvOverrides, childRefusalRows, childTools, describeGrant, EFFECT_ALLOWLIST_ENV, effectFieldsFor, effectLine, effectsUsed, eygCallCount, eygSettings, findMetadata, fieldsOutside, formatDuration, grantEvents, GRANT_ENTRY, GUIDE_BUILTINS, GUIDE_EFFECTS, GUIDE_SYNTAX, isUnder, MAX_CALLS_ENV, outsideRoot, prepareCallArguments, shippedPolicyPath, probeArguments, probeProgram, POLICY_FIELDS, referenceLines, refusalHints, replayGrants, resolvePolicy, resolveRoots, resultLines, ruleMappingEffects, rootsInside, runnerCandidates, sessionDepth, spawnerPolicy, spawnerRoots, subagentCallLines, subagentResultRows, suggestGrant } from "../lib/render-helpers.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const flat = (rows) => rows.map((row) => row.map((segment) => segment.text).join("")).join("\n");
const tones = (rows) => rows.map((row) => row.map((segment) => segment.tone).join("+")).join("\n");

const program = `let found = perform Search({path: "/repo", pattern: "*.eyg", limit: 20})
let text = perform ReadFile({path: "/repo/README.md", offset: 0, limit: 100})
perform StandardOut(!int_to_string(!string_length(text)))
perform AppendFile({path: "/repo/log", contents: !string_to_binary("a")})
perform DeleteFile("/repo/log")`;

// --- the call row: effects used, the first lines, and nothing else cut ---

{
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
}

// --- the expanded call row: the whole program, no marker ---

{
  const rows = callLines({ code: program, timeout: 60 }, true);
  const codeRows = rows.filter((row) => row[0].tone === "code");
  assert.equal(codeRows.length, program.split("\n").length, "every source line is rendered");
  assert.doesNotMatch(flat(rows), /more lines/, "nothing is truncated in the expanded row");
}

// --- the result row: summary, timing, and the whole output when expanded ---

{
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
}

// --- wall time: seconds, and minutes when it crosses a minute ---

{
  assert.equal(formatDuration(420), "0.42 s");
  assert.equal(formatDuration(1240), "1.24 s");
  assert.equal(formatDuration(59_999), "60.00 s");
  assert.equal(formatDuration(60_000), "1:00", "a run over a minute is minutes and seconds");
  assert.equal(formatDuration(123_000), "2:03");
  assert.equal(formatDuration(3_723_000), "1:02:03", "and hours when it crosses one");
}

// --- the effect scan ---

{
  assert.equal(
    effectsUsed("let a = perform ReadFile({})\nperform StandardOut(a)\n// a note about perform Fetch\nlet b = !int_add(1, 2)").join(","),
    "ReadFile,StandardOut,Fetch",
    "names in order of first appearance, and a comment mentioning an effect counts",
  );
  assert.equal(effectsUsed("let plain = search_lib.search({root: \"/\"})").join(""), "", "a library call is not an effect");
}

// --- the registry metadata of the shipped module, and a broken one ---

{
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
}

// --- probe programs: what the availability probe asks, and how the answer is read ---

{
  const read = probeProgram("ReadFile", "/abs/root");
  assert.match(read, /^perform ReadFile\(\{path: "\/abs\/root\/\.eyg-codemode-probe", offset: 0, limit: 0\}\)$/, "a read at a path that cannot exist, under the root the policy advertises");
  assert.equal(probeArguments("WriteFile", "/abs/root").includes("/abs/root\""), true, "a write names the root itself, a directory, so it cannot create a file");
  assert.equal(probeArguments("MakeDirectory", "/abs/root"), "\"/abs/root\"", "a directory that already exists is made without changing anything");
  assert.equal(probeProgram("Env", "/abs/root"), null, "an effect that must not be probed answers unknown");
  const fetch = probeProgram("Fetch", "/abs/root");
  assert.match(fetch, /^perform Fetch\(/, "Fetch is probed as a whole program");
  assert.match(fetch, /eyg-codemode-probe\.invalid/, "against a host under the reserved TLD, which can never resolve");
  const fallback = probeProgram("ReadDirectory", "");
  assert.match(fallback, /\/dev\/null/, "with no root the impossible path is /dev/null, which is never a directory");
}

// --- back-compat for a session resumed from an older version of the package ---

{
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
}

// --- the probe verdict ---

{
  assert.equal(classifyProbeOutput("read_file denied by policy: /abs/x"), "refused", "the policy said no");
  assert.equal(classifyProbeOutput("unhandled effect ReadFile({})"), "unavailable", "the runner does not implement it");
  assert.equal(classifyProbeOutput("No such file or directory"), "available", "the policy let it through and the host failed");
  assert.equal(classifyProbeOutput("Ok(\"/abs/cwd\")"), "available", "a safe effect printed its value");
}

// --- the effect surface `action: effects` prints, and the drift guard ---

{
  const fixture =
    `  #("AppendFile", policy.PolicyField("append_file")),\n` +
    `  #("DecodeJSON", policy.Unchecked),\n` +
    `  #("WriteFile", policy.PolicyField("write_file")),`;
  assert.equal(ruleMappingEffects(fixture).join(","), "AppendFile,DecodeJSON,WriteFile", "both halves of the mapping parse, in file order");
  assert.equal(effectLine("Search", "read_file", "allowed for the probe value"), "Search | read_file | allowed for the probe value", "one row per effect");
  assert.equal(effectLine("Hash", null, "unchecked (computes over values it was given)"), "Hash | none | unchecked (computes over values it was given)", "an unchecked effect names no field");

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

  // The config surface: what the project's `eyg` key says, and which of the six
  // names wins for the policy and for the roots. Every step of both orders is
  // pinned, because the whole point of the key is that a project can say "this
  // directory, this policy" and mean it (`pi.policy-config`). The one slot a model
  // controls is the call's `policy` argument, so it is pinned too: it may only
  // narrow, which means naming the policy the session already runs under or naming
  // the narrowest shipped policy (`notes/pi-codemode-session-grants.md`).
  const choice = (policy, source) => ({ policy, source, refusedArgument: null });
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
  assert.equal(resolveRoots({ project: ["/p1", "/p2"], env: "/e", cwd: "/c" }), "/p1,/p2", "the project roots win, as a list the preset parses");
  assert.equal(resolveRoots({ project: [], env: "/e", cwd: "/c" }), "/e", "then EYG_ALLOWED_ROOTS");
  assert.equal(resolveRoots({ project: [], env: null, cwd: "/c" }), "/c", "then the working directory");

// --- the grant store: durations, expiry, revoke, and the branch it lives on ---

{
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
}

// --- what a refusal names: the path, and the exact grant that would clear it ---

{
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
}

// --- a model may narrow to a shipped preset and may not name a module ---

{
  assert.equal(argumentPolicyPath("deny-all", "/pkg"), join("/pkg", "policies", "deny-all.eyg"), "a bare preset name resolves inside the package");
  assert.equal(argumentPolicyPath("/tmp/my-policy.eyg", "/pkg"), null, "an absolute module path is not the model's to choose");
  assert.equal(argumentPolicyPath("../outside.eyg", "/pkg"), null, "nor is a path that walks out of it");
  assert.equal(argumentPolicyPath("deny-all", null), null, "and with no package directory there is nothing to resolve against");
}

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
  assert.equal(EFFECT_ALLOWLIST_ENV, "EYG_SUBAGENT_EFFECTS", "the environment name the narrowing preset reads");
  assert.deepEqual(childTools(["read", "eyg"]).tools, ["read", "eyg"], "requested order, deduplicated");
  assert.equal(childTools(["eyg"]).ok, true, "the default is the whole channel and nothing else");
  assert.equal(childTools(["eyg", "bash"]).ok, false, "a shell tool is refused: this package spawns no session that has one");
  assert.deepEqual(childTools(["eyg", "bash"]).unknown, ["bash"], "and the name outside the allowlist is the answer");
  assert.equal(childTools(["read"]).ok, false, "a child with no eyg is a session no policy gates");
  assert.equal(childTools(["read"]).withoutEyg, true, "named that way");
  assert.deepEqual(childTools(["eyg", "read"], ["eyg", "eyg_subagent"]).parentMissing, ["read"], "a tool the parent session does not have is named back");
  assert.equal(childTools(["eyg", "read"], ["eyg", "read"]).ok, true, "and granting one the parent has is fine");
  assert.equal(childTools(["read"], null).parentChecked, false, "when the harness does not say what the parent has, that half of the check is skipped and says so");
  assert.deepEqual(
    effectFieldsFor(["ReadFile", "Search", "StandardOut", "NoSuchEffect", "Hash"]).fields,
    ["read_file", "standard_out"],
    "effect names map to policy fields, and Search shares read_file with ReadFile, so the field list deduplicates",
  );
  assert.deepEqual(effectFieldsFor(["NoSuchEffect"]).unknown, ["NoSuchEffect"], "an effect the CLI does not have is named back");
  assert.deepEqual(effectFieldsFor(["Hash"]).unchecked, ["Hash"], "an effect no preset can forbid is reported, not enforced");
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
  assert.deepEqual(spawnerRoots({ EYG_ALLOWED_ROOTS: "/a, /b" }, 1), ["/a", "/b"], "the roots a spawner gave, split the way the preset parses them");
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

  // The rows the subagent tool renders: the ask, and what came back.
  const asked = subagentCallLines({ task: "l1\nl2\nl3\nl4\nl5", roots: ["/work/sub"], timeout: 90, policy: "deny-all" }, false);
  assert.match(flat(asked), /eyg_subagent \(timeout: 90s\) ?policy: deny-all/, "the timeout and the named preset in the head");
  assert.match(flat(asked), /roots: \/work\/sub/, "the roots the child was given");
  assert.ok(!flat(asked).includes("l5"), "collapsed shows the first lines of the task only");
  assert.match(flat(asked), /\.\.\. 1 more lines/, "and says how many it dropped");
  assert.match(flat(subagentCallLines({ task: "l1\nl2\nl3\nl4\nl5", roots: [] }, true)), /l5/, "expanded shows the whole task");
  assert.match(flat(subagentCallLines({ task: "t" }, false)), /roots: inherited: the roots this session has/, "with no roots named the child inherits them");
  const narrowed = subagentCallLines({ task: "t", tools: ["eyg", "read"], effects: ["ReadFile", "WriteFile"], max_calls: 3 }, false);
  assert.match(flat(narrowed), /tools: eyg, read \(pi's read tool is not policy-gated\)/, "the tools, with the fact that makes them worth narrowing");
  assert.match(flat(narrowed), /effects: read_file, write_file under the spawner allowlist preset/, "effect names shown as the fields the preset reads");
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

  // The drift guard. This workspace is the pi package on its own, so the runtime
  // that owns `rule_mapping` is not in this tree: the guard compares `POLICY_FIELDS`
  // against the recorded snapshot in test/fixtures/rule_mapping.gleam (provenance in
  // test/fixtures/rule_mapping.PROVENANCE.md), and when EYG_RULE_SOURCE names a real
  // runtime source it reads that as well and fails if the runtime drifted from the
  // snapshot. Without the variable the live check is skipped and says so below.
  const snapshot = readFileSync(join(import.meta.dirname, "fixtures", "rule_mapping.gleam"), "utf8");
  const advertised = Object.keys(POLICY_FIELDS).join(",");
  assert.equal(ruleMappingEffects(snapshot).join(","), advertised, "the advertised surface is the recorded rule_mapping, in order");
  const live = process.env.EYG_RULE_SOURCE;
  if (live !== undefined) {
    const gleam = readFileSync(live, "utf8");
    assert.equal(ruleMappingEffects(gleam).join(","), advertised, "the live runtime rule_mapping still matches the recorded snapshot");
  }
  const unchecked = Object.keys(POLICY_FIELDS).filter((name) => POLICY_FIELDS[name] === null).join(",");
  assert.equal(unchecked, "DecodeJSON,EYGParse,Hash,Sign", "exactly four effects carry no policy field and are available under every preset");
}

// --- the reference answer: the builtins the shipped guide lists, and the effect surface ---

{
  const guide = readFileSync(join(import.meta.dirname, "..", "guides", "builtins_reference.md"), "utf8");
  const rows = builtinRows(guide);
  assert.ok(rows.length >= 25, `the shipped guide yields its builtin rows, got ${rows.length}`);
  for (const row of rows) {
    assert.match(row.name, /^![a-z0-9_]+$/, `${row.name} is a builtin name`);
    assert.ok(row.signature !== "", `${row.name} carries its signature and notes`);
  }
  const byName = new Map(rows.map((row) => [row.name, row]));
  for (const name of ["!int_add", "!string_split_once", "!binary_size", "!list_pop", "!never"]) {
    assert.ok(byName.has(name), `${name} is listed`);
  }
  assert.equal(byName.get("!int_add").section, "Integers", "the section heading travels with the row");
  assert.match(byName.get("!equal").signature, /True\(\{\}\) \| False/, "a signature containing | survives a row that is itself |-delimited");
  assert.ok(!rows.some((row) => row.section === "Common idioms"), "a prose section adds no rows");
  assert.ok(!byName.get("!int_add").signature.endsWith("|"), "an empty notes cell leaves no dangling |");

  const lines = referenceLines(guide, { policy: "/pkg/policies/agent-roots.eyg", policySource: "project settings" });
  assert.match(lines[0], new RegExp(`builtins: ${rows.length}, from ${GUIDE_BUILTINS}`), "the count and the file it came from");
  for (const name of Object.keys(POLICY_FIELDS)) {
    assert.ok(lines.some((line) => line.startsWith(`  ${name} | `)), `${name} is in the effect surface`);
  }
  assert.ok(lines.some((line) => line.includes("DecodeJSON | none")), "an unchecked effect says no preset can forbid it");
  assert.ok(lines.some((line) => line.includes('policy in force: /pkg/policies/agent-roots.eyg (project settings)')), "the preset in force is named");
  assert.ok(lines.some((line) => line.includes('action "effects"')), "and the call that asks it what it decides, effect by effect");
  assert.ok(lines.some((line) => line.includes("read tool is not policy-gated")), "the harness read tool's standing is stated");
  assert.ok(!/\| (allowed|refused|unavailable|unknown)/.test(lines.join("\n")), "it reports no verdict, so it asked the policy nothing");
}

// --- the rows a failed run adds when it named a builtin the runtime does not have ---

{
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
  assert.ok(shown.includes(GUIDE_BUILTINS), "the row names the guide path");
  assert.match(shown, /action "reference"/, "and the action that prints the list without leaving the tool");
  assert.ok(shown.includes("read tool is not policy-gated"), "and says pi's own read tool is not policy-gated");
  assert.ok(shown.includes(GUIDE_SYNTAX), "the syntax guide is named too, since invented syntax is the other failure");
  assert.equal(builtinHintRows([]).length, 0, "no invented builtin, no lecture");

  const result = {
    content: [{ type: "text", text: "eyg run: exit 1 in 0.10 s wall\nerror: builtin undefined: !str_len" }],
    details: { ran: true, exit: 1, builtins: ["!str_len"] },
  };
  const collapsed = flat(resultLines(result, false, 100));
  assert.match(collapsed, /no such builtin: !str_len/, "the hint shows collapsed, where the model reads it");
  const clean = flat(resultLines({ content: [{ type: "text", text: "eyg run: ran in 0.10 s wall\n2" }], details: { ran: true, exit: 0 } }, false, 100));
  assert.ok(!clean.includes("no such builtin"), "a run that named no invented builtin gets no hint row");
}
