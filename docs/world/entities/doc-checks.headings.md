---
id: doc-checks.headings
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "node bin/agent/doc-checks.mjs headings | grep -qx 'headings: ok'"
confidence: medium
sources: [bin/agent/doc-checks.mjs, test/doc-checks.test.mjs, README.md, guides/first-session.md]
supersedes: null
superseded_by: null
---

# A heading's pronoun is resolved in the section's first line

Within the prose set (`README.md`, `AGENTS.md`, `guides/`, `skills/`, `.agents/skills/`; the set
`docs/world/entities/doc-checks.one-term.md` defines), a section heading may not lean on a
pronoun the section never resolves.

A heading is a candidate when it contains a standalone pronoun: `it` or `its` always;
`this`, `that`, `these`, `those` only when no noun follows, because "this package" and
"that row" already name the thing. So `## Two things this tree does not contain` is fine and
`## Narrow it to a slice` is a candidate.

A candidate is resolved when the section's first non-empty line contains a backticked span or a
word from the canonical vocabulary plus `{package, tool, session, call, program, CLI, binary,
page, record, guide, tree, workspace, skill, check, checks}`. That is a proxy for "an antecedent",
not the thing itself: it accepts a line that names a canonical noun in any role, and it accepts
the name anywhere in the first line rather than the subject. The page's `confidence: medium` is
that honesty, and the fix it asks for is a rewrite of the heading or its lead line, not an
argument with the checker.

Two rewrites the rule forced, both improvements: `## What it installs` in `README.md` opened
straight on a table whose first row is `| path | what it is |`, so it gained the lead line "Each
path this package ships, and what it is for"; `## Prove it` in `.agents/skills/eyg-run/SKILL.md`
became `## Prove the CLI answers`. The guides pages' `## Not this` sections pass because their
first line names a `policy` or a path.

`test/doc-checks.test.mjs` plants a heading whose section names nothing and asserts the problem
names the heading and quotes the first line, and asserts the resolved fixture is quiet.

## Not this

- not grammar: no check of whether a sentence parses, and no rule about pronouns inside prose,
  only in headings;
- not the world model's lint, which requires a `## Not this` heading on entity pages - a
  requirement that is why the guides pages' copy of that heading was left alone while the rule
  was written (`docs/world/entities/doc-checks.one-term.md`);
- not a readability score: a heading that names its subject in the title passes without any
  lead line at all.
