// The unit test over `bin/agent/doc-checks.mjs`.
//
// Each check gets two asserts: it stays quiet on a fixture tree that obeys the rule, and
// it reports the violation when the fixture plants one. The fixture trees live in the
// system temp directory, so a planted word is never a line of this repository - which
// matters because this file is itself inside the scope of the check it drives. The words
// that would trip a check are therefore built from fragments below.
//
// The last block runs every check over this package, which is the half of the contract
// that says the checks pass on the tree.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkCitations,
  checkDatedProse,
  checkHeadings,
  checkLineCount,
  checkMirrors,
  checkOneTerm,
} from "../bin/agent/doc-checks.mjs";

const PACKAGE = dirname(dirname(fileURLToPath(import.meta.url)));

// The one canonical-term table, as `README.md` carries it. A check that requires a term
// row needs this fixture, and deleting a row from it must fail the check.
const CANONICAL = `## The words this package uses

| word | what it is |
| --- | --- |
| \`runner\` | the program the tool spawns |
| \`policy\` | a record of effect-${"handlers"} |
| \`roots\` | the directories a session may work in |
| \`the checks\` | the rows \`bin/agent/audit.sh\` prints |
| \`checked, unchecked\` | whether a policy field decides an effect |
| \`registry scope\` | where a re-usable program lives |
`;

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "pi-eyg-doc-checks-"));
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  return root;
}

// The two rival words, built from fragments so this file never contains them: the check
// that bans them scans `test/`, and a planted word belongs in a fixture file, not here.
const WORD_A = `pre${"set"}`;
const WORD_B = `ga${"te"}`;

test("one-term: the table is single, complete, and no rival word is in scope", () => {
  const clean = fixture({
    "README.md": `${CANONICAL}\n`,
    "guides/how-to.md": "# How to\n\nName the policy the call runs under.\n",
  });
  try {
    assert.deepEqual(checkOneTerm({ root: clean }), [], "a tree with one table and no rival word passes");

    writeFileSync(
      join(clean, "guides", "other.md"),
      `## Canonical terms\n\nThe \`${WORD_A}\` runs through the ${WORD_B}.\n`,
    );
    const rival = checkOneTerm({ root: clean });
    assert.equal(rival.length, 3, `one rival heading and two rival words: ${rival.join(" | ")}`);
    assert.match(rival[0], /more than one canonical-term table/);
    const named = rival.slice(1).map((problem) => problem.match(/rival word `([a-z]+)`/)[1]).sort();
    assert.deepEqual(named, [WORD_B, WORD_A].sort(), "both rival words are named, with their file and line");
    assert.match(rival[1], /guides\/other\.md:3 uses the rival word/);

    rmSync(join(clean, "guides", "other.md"));
    writeFileSync(join(clean, "README.md"), CANONICAL.replace(/^\| `roots`.*\n/m, ""));
    const missing = checkOneTerm({ root: clean });
    assert.equal(missing.length, 1, missing.join(" | "));
    assert.match(missing[0], /no row for `roots`/);
  } finally {
    rmSync(clean, { recursive: true, force: true });
  }
});

test("one-term: the definition of a policy is said once", () => {
  const root = fixture({
    "README.md": `${CANONICAL}\n`,
    "guides/twice.md": `# Twice\n\nA policy is a record of effect-${"handlers"}, which is the same sentence again.\n`,
  });
  try {
    const problems = checkOneTerm({ root });
    assert.equal(problems.length, 1, problems.join(" | "));
    assert.match(problems[0], /appears 2 times .*README\.md x1, guides\/twice\.md x1/s);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("citations: a cited line exists and holds the name written for it", () => {
  const root = fixture({
    "lib/tool.mjs": "export function resolvePolicy() {}\nexport function narrows() {}",
    "README.md": [
      "Use `resolvePolicy` (`lib/tool.mjs:1`) and `narrows` (`lib/tool.mjs:2`).",
      "The old page `guides/gone.md:9` is deleted, so its number is not re-checked.",
      "A moved symbol: `resolvePolicy` lives at `lib/tool.mjs:2`. <!-- doc-check:ignore citations -->",
    ].join("\n"),
  });
  try {
    assert.deepEqual(checkCitations({ root }), [], "resolving citations pass");

    writeFileSync(
      join(root, "README.md"),
      [
        "A stale number: `narrows` at `lib/tool.mjs:9`.",
        "A wrong name: `resolvePolicy` at `lib/tool.mjs:2`.",
        "A missing file: `lib/never.mjs:1` for `resolvePolicy`.",
      ].join("\n"),
    );
    const problems = checkCitations({ root });
    assert.deepEqual(
      problems,
      [
        "README.md:1 cites lib/tool.mjs:9, but that file has 2 lines",
        "README.md:2 cites lib/tool.mjs:2, which holds none of: resolvePolicy -> 1",
        "README.md:3 cites lib/never.mjs:1, which is not a file in this package",
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("headings: a pronoun in a heading is resolved in the section's first line", () => {
  const root = fixture({
    "README.md": `${CANONICAL}\n## What it opens\n\nThe first line names the \`policy\`, so the heading resolves.\n`,
    "guides/none.md": "## What it opens\n\nThe first line names nothing at all.\n",
  });
  try {
    assert.deepEqual(checkHeadings({ root, files: ["README.md"] }), [], "a resolved pronoun passes");
    const problems = checkHeadings({ root, files: ["guides/none.md"] });
    assert.equal(problems.length, 1, problems.join(" | "));
    assert.match(problems[0], /guides\/none\.md:1 heading `What it opens`.*names nothing/s);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mirrors: no upstream page under guides/, no dangling path in the prose", () => {
  const clean = fixture({
    "README.md": "Read `guides/how-to.md` and `policies/deny-all.eyg`; a template such as `policies/<new>.eyg` is not checked.\n",
    "guides/how-to.md": "# How to\n\nWrite the record.\n",
    "policies/deny-all.eyg": "// the narrowest policy\n",
  });
  const dirty = fixture({
    "README.md": "Read `guides/gone.md` for the forms.\n",
    "guides/syntax.md": "# syntax\n\nan offline copy of a page this package does not own\n",
  });
  try {
    assert.deepEqual(checkMirrors({ root: clean }), [], "a linked tree with existing paths passes");
    const problems = checkMirrors({ root: dirty });
    assert.deepEqual(
      problems,
      [
        "guides/syntax.md: a copy of the upstream page `syntax`; link it instead of copying it",
        "README.md:1 mentions guides/gone.md, which is not in the tree",
      ],
    );
  } finally {
    rmSync(clean, { recursive: true, force: true });
    rmSync(dirty, { recursive: true, force: true });
  }
});

test("dated-prose: no dated stamp in the prose; AGENTS.md prices its commands with dates", () => {
  const root = fixture({
    "AGENTS.md": "# Commands\n\n| command | cost | measured |\n| --- | --- | --- |\n| npm test | 0.1 s | 2026-01-02 |\n",
    "guides/how-to.md": "# How to\n\nRun the check; the record carries the date it was measured.\n",
    ".agents/skills/one/SKILL.md": "---\nname: one\ndescription: two\nverified: 2026-01-02\n---\n\nRun it.\n",
  });
  try {
    assert.deepEqual(checkDatedProse({ root }), [], "AGENTS.md's dated table and skill front matter are exempt");
    writeFileSync(join(root, "guides", "how-to.md"), "# How to\n\nMeasured 2026-01-02 by hand, and again @measured 2026-01-03.\n");
    const problems = checkDatedProse({ root });
    assert.deepEqual(
      problems,
      [
        "guides/how-to.md:3 carries a dated stamp `Measured 2`: Measured 2026-01-02 by hand, and again @measured 2026-01-03.",
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("line-count: no prose states how many lines a file has; a run's counts stay", () => {
  const clean = fixture({
    "AGENTS.md": "# Commands\n\n| command | cost | measured |\n| --- | --- | --- |\n| npm test | 0.16 s wall, 46 tests | 2026-01-02 |\n",
    "guides/how-to.md": "# How to\n\nRun the check and read what it prints. A skill may say a body stays under 120 lines.\n",
  });
  try {
    assert.deepEqual(checkLineCount({ root: clean }), [], "a priced table and a written budget pass");
    writeFileSync(join(clean, "guides", "how-to.md"), "# How to\n\nThe copy repeats 75 verbatim lines of `policies/agent-roots.eyg`.\n");
    const problems = checkLineCount({ root: clean });
    assert.deepEqual(
      problems,
      ["guides/how-to.md:3 states a line count `75 verbatim lines`: name the command that prints it - The copy repeats 75 verbatim lines of `policies/agent-roots.eyg`."],
    );
  } finally {
    rmSync(clean, { recursive: true, force: true });
  }
});

test("the six checks pass on this package", () => {
  for (const [name, check] of [
    ["one-term", checkOneTerm],
    ["citations", checkCitations],
    ["headings", checkHeadings],
    ["mirrors", checkMirrors],
    ["dated-prose", checkDatedProse],
    ["line-count", checkLineCount],
  ]) {
    assert.deepEqual(check({ root: PACKAGE }), [], `${name} reports nothing against the tree`);
  }
});
