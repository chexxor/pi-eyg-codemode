#!/usr/bin/env node
// bin/agent/secret-rule-probe.mjs - does the hidden-name rule still refuse, in every
// direction, and does it still let the ordinary files through?
//
// `policies/agent-roots.eyg` refuses a path that passes through a directory named in
// `secret_directory_names`, or that ends in `secret_file_suffix`, for all seven path
// effects - read, write, append, delete, make_directory, read_directory, search -
// before the roots are consulted. A suffix test on one extension is beaten by the
// spelling of a name; a directory a path has to pass through is not (`notes/pi-codemode-threat-model.md`,
// family A). This script builds a root in the system temporary directory, runs
// `test/fixtures/secret-directory-probe.eyg` through the same guarded entry a session
// uses (`bin/agent/refusal-probe.mjs`), and prints one `holds`/`DRIFT` row per ask.
//
// It is written so it can fail: `--policy <module>` points the call at a policy of your
// own, and a copy of the shipped one whose `hidden` answers False turns the hidden rows
// into `DRIFT` and the exit code to 1. Nothing is written in this tree; the temporary
// root is removed on the way out.
//
//   node bin/agent/secret-rule-probe.mjs
//   node bin/agent/secret-rule-probe.mjs --policy .ai-work/hidden-off.eyg
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/+$/, "");
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
};
const policy = flag("policy", join(packageDir, "policies", "agent-roots.eyg"));

// Every ask the fixture makes, with what the shipped rule owes it: `hidden` for a path
// the rule refuses, `open` for a path it must let through.
const EXPECTED = [
  ["read ordinary/nested/file.txt", "open"],
  ["write ordinary/nested/new.txt", "open"],
  ["read secrets/id_rsa", "hidden"],
  ["write secrets/planted", "hidden"],
  ["append secrets/id_rsa", "hidden"],
  ["delete secrets/id_rsa", "hidden"],
  ["mkdir secrets/sub", "hidden"],
  ["list secrets", "hidden"],
  ["search rooted at secrets", "hidden"],
  ["search rooted at the root itself", "open"],
  ["read .ssh/config", "hidden"],
  ["read .env.eyg", "hidden"],
  ["read ordinary/id_rsa (the bound: a secret-shaped name)", "open"],
  ["read ordinary/secrets (the cost: a file named like the directory)", "hidden"],
];

const scratch = mkdtempSync(join(tmpdir(), "eyg-secret-rule-probe-"));
const root = join(scratch, "root");
const rows = [];
let code = 0;
let out = "";
try {
  mkdirSync(join(root, "ordinary", "nested"), { recursive: true });
  mkdirSync(join(root, "secrets"), { recursive: true });
  mkdirSync(join(root, ".ssh"), { recursive: true });
  writeFileSync(join(root, "ordinary", "nested", "file.txt"), "x");
  writeFileSync(join(root, "secrets", "id_rsa"), "SECRET");
  writeFileSync(join(root, "ordinary", "id_rsa"), "SECRET");
  writeFileSync(join(root, "ordinary", "secrets"), "a file named like the directory");
  writeFileSync(join(root, ".ssh", "config"), "Host x\n");
  writeFileSync(join(root, ".env.eyg"), "TOKEN=1\n");

  try {
    out = execFileSync(
      "node",
      [
        join(packageDir, "bin", "agent", "refusal-probe.mjs"),
        "--roots", root,
        "--with-policy", policy,
        "--program", join(packageDir, "test", "fixtures", "secret-directory-probe.eyg"),
      ],
      { cwd: packageDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    code = error.status === undefined ? -1 : error.status;
    out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }

  for (const [label, owed] of EXPECTED) {
    const line = out.split("\n").find((l) => l.startsWith(`${label}:`));
    if (!line) {
      rows.push(`DRIFT  ${label}: the probe printed no row for it (exit ${code})`);
      continue;
    }
    const answer = line.slice(label.length + 2);
    const refused = answer.includes("denied by policy");
    const performed = answer === "landed";
    if (owed === "hidden" && refused) {
      rows.push(`holds  ${label}: refused, nothing written (${answer})`);
    } else if (owed === "open" && performed) {
      rows.push(`holds  ${label}: performed as the policy allows`);
    } else {
      rows.push(`DRIFT  ${label}: owed ${owed}, got ${answer}`);
    }
  }

  // The refusals have to be real: the refused targets are still there, untouched, and
  // the planted write never landed.
  const planted = join(root, "secrets", "planted");
  rows.push(readExists(planted) ? "DRIFT  secrets/planted exists on disk after a refused write" : "holds  nothing was written where the rule refused");
  rows.push(readFile(join(root, "secrets", "id_rsa")) === "SECRET" ? "holds  the refused read left the secret file alone" : "DRIFT  the secret file changed during the run");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

function readExists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

function readFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

for (const row of rows) console.log(row);
const drifted = rows.filter((r) => r.startsWith("DRIFT")).length;
console.log(`secret rule: ${rows.length - drifted}/${rows.length} rows hold${drifted ? `, ${drifted} drifted` : ""}`);
process.exit(drifted === 0 ? 0 : 1);
