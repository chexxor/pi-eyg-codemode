---
id: gap.duplication-literals-in-prose
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -q 'appear verbatim' notes/pi-eyg-codemode-policy-record-extension.md && ! grep -qF 'line-count' bin/agent/doc-checks.mjs"
confidence: high
sources: [notes/pi-eyg-codemode-policy-record-extension.md, bin/agent/doc-checks.mjs, policies/agent-roots.eyg, policies/spawner-effects.eyg, docs/world/entities/gap.policy-record-extension.md, notes/spawner-effect-allowlist.md]
supersedes: null
superseded_by: null
---
# Gap: prose still prints a line count, and no check fails when such a count rots

`notes/pi-eyg-codemode-policy-record-extension.md:14` states the duplication as a number:
"Of the non-comment lines of `policies/agent-roots.eyg`, 75 appear verbatim in `policies/spawner-effects.eyg`",
measured 2026-11-21. The same command measured on 2026-11-26 answers 93 verbatim lines, of 108 in
the parent policy, against 140 in the copy (`@measured 2026-11-26 by
`grep -v '^//' policies/agent-roots.eyg | sed '/^ *$/d' | grep -Fxc -f policies/spawner-effects.eyg``).
The number is a snapshot of a file that has since grown, and the sentence that carries it reads as a
fact about the two files.

Nothing in the tree notices. `bin/agent/doc-checks.mjs` holds this package's five prose checks - one
term, citations, headings, mirrors, dated prose - and none of them compares a number in prose against
a count in a file; `world_lint.mjs` checks record structure, and `world_verify.mjs` runs the commands
the records name. The three places that printed the count in the last audit were rewritten to name
the command instead, which left this one - the note is outside that milestone's in-scope list, so no
check looked at it.

**First step, and the second.** Replace the number with the command that computes it, in the same
commit as any policy line moves; then add a sixth prose check that fails when scanned prose asserts
a line count of a tracked file, so the class cannot come back by being written again. The check costs
what the others cost - the five run in 0.07 s wall over the whole prose set.

## Not this

- the duplication itself, and the shape that would remove it (an extension of the loaded policy record,
  which the language does not carry): `docs/world/entities/gap.policy-record-extension.md`,
  `notes/spawner-effect-allowlist.md`;
- the three places that already name the command rather than a number, one of them a record's `verify`:
  `docs/world/entities/gap.policy-record-extension.md`, `notes/pi-codemode-threat-model.md`,
  `notes/pi-codemode-policy-shape.md`;
- a dated measurement with its command, which is a fact about a run and not a count of a file: the
  cost column of `AGENTS.md`'s command table.

**Trigger to close:** the note names the command and `bin/agent/doc-checks.mjs` carries a check over
line-count assertions; this page's command fails on either half, and the row moves with the new
evidence.
