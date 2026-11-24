---
id: doc-checks.citations
type: entity
owner: delegate
status: suspect
verified_at: 2026-11-24
verify: "node bin/agent/doc-checks.mjs citations | grep -qx 'citations: ok'"
confidence: high
sources: [bin/agent/doc-checks.mjs, test/doc-checks.test.mjs, AGENTS.md, notes/pi-eyg-codemode-workspace-port.md]
supersedes: null
superseded_by: null
---

# A `file.ext:NNN` citation names a line that holds the name written for it

Every markdown file in the tree is scanned (except the session's own goal and note state under
`.pi/goals/` and `.notes/`, which is not documentation). A citation is a backticked span that
reads `path:NNN` or `path:NNN-NNN`; a bare `` `:NNN` `` inherits the path of the previous
citation on the same line, which is how `AGENTS.md` writes "(`narrows` in
`lib/render-helpers.mjs:323`, used at `:361`)".

Three things must hold of a citation:

- the file exists in this package: a path whose first segment is not a top-level entry of this
  tree belongs to another repository and is not resolved here, which is what keeps the language
  repository's `packages/...` and `.gleam` paths citable without this package being able to open
  them (`docs/world/entities/gap.policy-runner-not-on-main.md`);
- the line number is inside the file;
- when the text between this citation and the previous one names something in backticks - an
  identifier, a function, a field - at least one of those names occurs in the cited range. The
  answer names where each anchor actually is, so a fix is a number change rather than a hunt.

The anchor window is what makes the rule precise rather than noisy: an earlier version held every
backticked name on the line against every citation on it, which flagged
`` `resolvePolicy` in `lib/render-helpers.mjs:344`, used at `extensions/eyg-codemode.ts:501` ``
because `policy` is a word on the line and not what the second citation cites.

Four skips, each in the checker and each cheap to re-derive: a line containing `deleted` (a
citation kept as evidence of a page that is gone, such as the guides mirror quoted in
`docs/world/decisions/ADR-002-handler-seam.md`); a line carrying `doc-check:ignore citations`
(the three historical line ranges in `notes/pi-eyg-codemode-workspace-port.md`, which record an
old README rather than pointing at the current one); a path containing `<` or `*` (a template);
and a path outside this package.

What it caught when it went in: `AGENTS.md` pointing at four line numbers that had moved
(`packageDir`, `resolvePolicy`, `narrows`, `refusedArgument`, and the two `runnerCandidates`
call sites), `docs/world/entities/gap.grant-polish-undecided.md` pointing at two, and
`docs/world/traps.md` pointing at three lines of the vendored world-model tool that the vendored
copy no longer has at that offset.

## Not this

- not a link checker for URLs: `<https://eyg.run/guides>` is upstream's to keep valid
  (`docs/world/entities/guides.index.md`);
- not a check that a citation supports its sentence: only that the line it names exists and
  contains the name it credits;
- not the citation style: a bare `:NNN` is allowed, and a path quoted in prose without a line
  number is not a citation at all.
