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
import { callLines, checkDeclaredEffects, classifyProbeOutput, COLLAPSED_SOURCE_LINES, effectLine, effectsUsed, eygSettings, findMetadata, formatDuration, prepareCallArguments, presetPath, probeArguments, probeProgram, POLICY_FIELDS, resolvePolicy, resolveRoots, resultLines, ruleMappingEffects, runnerCandidates } from "../lib/render-helpers.mjs";
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
