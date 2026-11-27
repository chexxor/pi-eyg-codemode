---
id: gap.duplication-literals-in-prose
type: entity
owner: delegate
status: superseded
verified_at: 2026-11-27
verify: "grep -qF 'line-count' bin/agent/doc-checks.mjs && ! grep -qF '75 appear verbatim' notes/pi-eyg-codemode-policy-record-extension.md"
confidence: high
sources: [notes/pi-eyg-codemode-policy-record-extension.md, bin/agent/doc-checks.mjs, policies/agent-roots.eyg, policies/spawner-effects.eyg, docs/world/entities/gap.policy-record-extension.md, notes/spawner-effect-allowlist.md]
supersedes: null
superseded_by: doc-checks.line-count
---
# Gap: prose still prints a line count, and no check fails when such a count rots

`notes/pi-eyg-codemode-policy-record-extension.md` stated the duplication as a number:
"Of the non-comment lines of `policies/agent-roots.eyg`, 75 appear verbatim in `policies/spawner-effects.eyg`",
measured 2026-11-21. The same command measured on 2026-11-26 answered 93 verbatim lines, of 108 in
the parent policy, against 140 in the copy. The number was a snapshot of a file that had since grown,
and the sentence that carried it read as a fact about the two files.

Nothing in the tree noticed: `bin/agent/doc-checks.mjs` held five prose checks, none of them over
a number in prose, and the note was outside the last milestone's in-scope list.

**Closed by `doc-checks.line-count`.** The note names the command that prints the count -
`grep -v '^//' policies/agent-roots.eyg | sed '/^ *$/d' | grep -Fxc -f policies/spawner-effects.eyg` -
and `bin/agent/doc-checks.mjs` carries `line-count`, which refuses any sentence that states a line
count of a tracked file while leaving a run's counts and a written budget quiet. The three places
that printed the count in the last audit already name the command.

## Not this

- the duplication itself, and the shape that would remove it: `docs/world/entities/gap.policy-record-extension.md`, `notes/spawner-effect-allowlist.md`;
- a dated measurement with its command, which is a fact about a run: the cost column of `AGENTS.md`'s command table.
