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
import { argumentPolicyPath, callLines, checkDeclaredEffects, classifyProbeOutput, COLLAPSED_SOURCE_LINES, childAnswer, childArgv, childCalls, childEnvOverrides, describeGrant, effectLine, effectsUsed, eygSettings, findMetadata, formatDuration, grantEvents, GRANT_ENTRY, isUnder, outsideRoot, prepareCallArguments, presetPath, probeArguments, probeProgram, POLICY_FIELDS, refusalHints, replayGrants, resolvePolicy, resolveRoots, resultLines, ruleMappingEffects, rootsInside, runnerCandidates, suggestGrant } from "../lib/render-helpers.mjs";
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
  // search; otherwise the order is the CLI on PATH, the language CLI's build output
  // under the working directory, and `.local/eyg-checked` inside it - the place for a
  // runner this machine has and PATH does not carry (`cli.checked-runner-on-this-host`).
  assert.deepEqual(
    runnerCandidates("/work", { EYG_CODEMODE_RUNNER: "/opt/eyg" }),
    ["/opt/eyg"],
    "a named runner is the only candidate",
  );
  assert.deepEqual(
    runnerCandidates("/work", { EYG_CODEMODE_RUNNER: "" }),
    ["eyg", join("/work", "packages", "gleam_cli", "dist", "eyg"), join("/work", ".local", "eyg-checked")],
    "an empty variable names nothing, so the search order stands",
  );
  assert.deepEqual(
    runnerCandidates("/work", {}),
    ["eyg", join("/work", "packages", "gleam_cli", "dist", "eyg"), join("/work", ".local", "eyg-checked")],
    "three candidates, in that order, when nothing is configured",
  );

  // The config surface: what the project's `eyg` key says, and which of the five
  // names wins for the policy and for the roots. Every step of both orders is
  // pinned, because the whole point of the key is that a project can say "this
  // directory, this preset" and mean it (`pi.policy-config`).
  assert.deepEqual(eygSettings(undefined), { policy: null, roots: [] }, "no settings is no configuration");
  assert.deepEqual(eygSettings({ eyg: { policy: "deny-all", roots: ["/a", "", 5, "/b"] } }), { policy: "deny-all", roots: ["/a", "/b"] }, "a named preset and absolute roots, junk dropped");
  assert.deepEqual(eygSettings({ eyg: { roots: "/only" } }), { policy: null, roots: ["/only"] }, "one root may be written without a list");
  assert.deepEqual(eygSettings({ eyg: "nonsense" }), { policy: null, roots: [] }, "a key of the wrong shape is no configuration");
  assert.equal(presetPath("deny-all", "/pkg"), join("/pkg", "policies", "deny-all.eyg"), "a bare name resolves inside the package");
  assert.equal(presetPath("/srv/my.eyg", "/pkg"), "/srv/my.eyg", "an absolute path is taken as given");
  assert.equal(presetPath("../outside.eyg", "/pkg"), null, "a relative path names nothing, so the caller can say which key is wrong");
  assert.deepEqual(
    resolvePolicy({ argument: "/a", grant: "/g", project: "/p", env: "/e", packageDefault: "/d" }),
    { policy: "/a", source: "argument" },
    "the argument of the call wins",
  );
  assert.deepEqual(
    resolvePolicy({ grant: "/g", project: "/p", env: "/e", packageDefault: "/d" }),
    { policy: "/g", source: "session grant" },
    "then the grant the operator made this session",
  );
  assert.deepEqual(
    resolvePolicy({ project: "/p", env: "/e", packageDefault: "/d" }),
    { policy: "/p", source: "project settings" },
    "then the project's eyg.policy",
  );
  assert.deepEqual(
    resolvePolicy({ env: "/e", packageDefault: "/d" }),
    { policy: "/e", source: "EYG_POLICY" },
    "then the environment",
  );
  assert.deepEqual(
    resolvePolicy({ packageDefault: "/d" }),
    { policy: "/d", source: "package default" },
    "then the preset shipped in the package",
  );
  assert.deepEqual(resolvePolicy({}), { policy: null, source: "none" }, "and nothing to run at all if none of them names a module");
  assert.deepEqual(resolvePolicy({ grant: "", project: "/p" }), { policy: "/p", source: "project settings" }, "an empty name names nothing");
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
  assert.equal(childAnswer(childRecords), "wrote it, /tmp was refused", "and its last words");
  assert.deepEqual(childCalls(undefined), [], "no output is no calls, not a crash");

  // A grant adds roots on top of what the project and the environment say, and a
  // model may not name the module it is checked against.
  assert.deepEqual(
    resolvePolicy({ grant: "/g", spawner: "/s", project: "/p", env: "/e", packageDefault: "/d" }),
    { policy: "/g", source: "session grant" },
    "the operator's grant outranks what a spawner chose",
  );
  assert.deepEqual(
    resolvePolicy({ spawner: "/s", project: "/p", env: "/e", packageDefault: "/d" }),
    { policy: "/s", source: "spawner" },
    "then the policy the spawner of a subagent session named, which outranks the project key",
  );
  assert.equal(rootsInside(["/work/a", "/work/b"], ["/work"]).ok, true, "several slices are fine");

  assert.equal(resolveRoots({ grant: ["/tmp"], project: ["/p1"], env: "/e", cwd: "/c" }), "/p1,/tmp", "the grant widens, it does not replace");
  assert.equal(resolveRoots({ grant: ["/p1"], project: ["/p1"], env: null, cwd: "/c" }), "/p1", "and cannot duplicate a root");
  assert.equal(resolveRoots({ grant: ["/tmp"], env: "/a, /b", cwd: "/c" }), "/a,/b,/tmp", "an environment list is split and trimmed first");

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
