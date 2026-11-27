---
id: doc-checks.line-count
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "node bin/agent/doc-checks.mjs line-count | grep -qx 'line-count: ok'"
confidence: high
sources: [bin/agent/doc-checks.mjs, test/doc-checks.test.mjs, notes/pi-eyg-codemode-policy-record-extension.md, docs/world/entities/gap.duplication-literals-in-prose.md]
supersedes: null
superseded_by: null
---

# A prose line count is refused; the command that prints it is named

`bin/agent/doc-checks.mjs` now holds this package's six prose checks, one name each: `one-term`,
`citations`, `headings`, `mirrors`, `dated-prose`, `line-count`. The sixth refuses a sentence
that states how many lines a tracked file has: `75 lines`, `93 verbatim lines`, `108 non-comment
lines`. A count of a file is a snapshot of a file that grows, and the sentence that carries it
reads as a fact about the file; nothing notices when the file moves. The rule, from
`docs/world/entities/gap.duplication-literals-in-prose.md`, is to name the command that prints
the count, not the count.

The allow is a written budget (`a body stays under 120 lines`) and the counts a run reports
(`s wall`, `rows`, `tests`, `claims`): those are facts about a run, not snapshots of a file, and
`AGENTS.md` prices commands this way by design. The matcher is `\d+\s+(?:non-comment |code |raw |total |verbatim )*lines\b`, and the allow line must also contain one of the allow tokens.

What the rule caught: the `75 appear verbatim` in `notes/pi-eyg-codemode-policy-record-extension.md`, which measured 93 on the next day, the same command printing both. The note now names the command that prints the count, and the check refuses the class by construction.

`test/doc-checks.test.mjs` plants one line that states a count and asserts the problem names the file, the line and the count, and plants a priced table and a written budget that stay quiet.

## Not this

- not a rule for records: `docs/world/` keeps dates and counts because they are the claims those carry, each with a command;
- not a ban on saying when a run finished: the cost column of `AGENTS.md`'s command table, which is a fact about a run;
- not a rule for the code itself: `bin/agent/doc-checks.mjs` refuses prose, and the counts in `AGENTS.md`'s table are priced in the same file.
