#!/usr/bin/env node
// Build the scratch operator policy the `fetch` probes need, from a copy of the shipped one:
// the `fetch` row becomes `pass` (the network is open) or `one_host` (the rule in
// test/fixtures/fetch-host-pin.eyg, spliced in). Nothing under policies/ is touched - this writes
// to stdout and the caller redirects it wherever its scratch directory is.
//
//   node test/fixtures/fetch-operator-policy.mjs open       > <scratch>/policy-open.eyg
//   node test/fixtures/fetch-operator-policy.mjs pin        > <scratch>/policy-pinned.eyg
//   node test/fixtures/fetch-operator-policy.mjs token      > <scratch>/policy-token.eyg
//   node test/fixtures/fetch-operator-policy.mjs token-pin  > <scratch>/policy-token-pinned.eyg
import { readFileSync } from "node:fs";

const modes = { open: "pass", pin: "one_host", token: "attach_token(pass)", "token-pin": "attach_token(one_host)" };
const mode = process.argv[2];
if (!(mode in modes)) {
  console.log(`usage: fetch-operator-policy.mjs ${Object.keys(modes).join("|")}`);
  process.exit(1);
}

const shipped = readFileSync(new URL("../../policies/agent-roots.eyg", import.meta.url), "utf8");
const fragments = [];
if (mode.includes("pin")) fragments.push(readFileSync(new URL("fetch-host-pin.eyg", import.meta.url), "utf8").trimEnd());
if (mode.includes("token")) fragments.push(readFileSync(new URL("fetch-attach-token.eyg", import.meta.url), "utf8").trimEnd());

const out = [];
for (const line of shipped.split("\n")) {
  if (line.startsWith("    fetch: refuse(")) out.push(`    fetch: ${modes[mode]},`);
  else out.push(line);
  if (line === "let rules = (ctx) -> {") for (const fragment of fragments) out.push(fragment);
}
process.stdout.write(out.join("\n"));
