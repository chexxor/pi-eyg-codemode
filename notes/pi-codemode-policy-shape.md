---
name: pi-codemode-policy-shape
description: The decision on what a policy module is - a record with one rule per effect, kept because one generic decide(effect, value) field does not type-check, a policy that forgets a field does not fail closed, and the data-list shape copies as many lines as the shipped one
date: 2026-11-25
---

The question: must a policy be a record of rules, or can it be data - a few named lists
plus derivations - or one field the guard calls with the effect's name? Three shapes were
put to the compiler and to a guarded run here on 2026-11-25, and the shipped shape stays.

| shape | what was measured | what it costs |
| --- | --- | --- |
| a record with one rule per effect, the rule composed from derivations (`policies/agent-roots.eyg`: 108 non-comment lines of 224) | what runs today; `node bin/agent/secret-rule-probe.mjs` answers `16/16 rows hold` | the whole decision readable in one file; `test/host-coverage.test.mjs` checks the guard names every effect row of `guides/eyg-surface.tsv` |
| the same record, its decision content driven by named lists and two derivations (`test/fixtures/policy-data-shape.eyg`: 114 non-comment lines of 145) | `node bin/agent/secret-rule-probe.mjs --policy "$PWD/test/fixtures/policy-data-shape.eyg"` prints the same 16 rows and the same refusal text as the shipped policy | 84 of its non-comment lines are lines `policies/agent-roots.eyg` already has, so a second policy of this shape copies about as much as a second policy of the shipped shape |
| one field for every effect, called with the effect's name | `eyg check test/fixtures/policy-generic-decide.eyg` answers `error: Recursive` / `this expression has a recursive type which is not supported`: one rule would take `DeleteFile`'s String value and `ReadFile`'s record value at once; `eyg check test/fixtures/policy-named-decide.eyg` answers `error: unexpected "delete_file"` - a string is not a match pattern, so the name cannot drive the lookup either | not expressible in this language today |
| a record with FEWER fields, the rest defaulted by the guard | `timeout 25 node bin/agent/refusal-probe.mjs --with-policy "$PWD/test/fixtures/policy-missing-row.eyg" --program test/fixtures/search-walk.eyg --inside-roots` prints nothing (0 bytes) and exits 124, killed at 25 s: asked for `Search` with no `search` row the run sits inside the guard, and asked for an effect the record does carry it is performed | a missing row is a hole, not a refusal, so a guard-side default is a new contract in `host/guard.eyg` rather than a smaller policy file |

Why the record of rules stays. The rule is a function because the effect's VALUE differs by
effect - a path, a record with a `path` row, a `Fetch` request, the name of an environment
variable - and the type system is what makes a rule read the right one. Move that out of the
record and you are asking the language for a sum type over effect values, which is a
language act, not a package act. What the record does NOT buy is reach: the content of the
decision is already data in the shipped policy - `secret_directory_names` and
`secret_file_suffix` (`policies/agent-roots.eyg:151`, `:154`) are lists an operator edits and
nothing else - so the shape answer is "the record is the interface, the lists are the decision",
which is what the shipped files already do.

Pros of keeping the shipped shape: the guard's per-effect field read is what makes
"every effect has a decision" a checkable claim, and `test/host-coverage.test.mjs` keeps that
check against the generated surface; nothing in `host/guard.eyg` changes, so the security
contract of this goal is unchanged by the decision; `action: effects` rows name the field that
answered, which only exists while fields are per effect. Cons: a policy of your own is a file
you own, and the derivations are copied into it - 68 of the 84 non-comment lines of
`policies/agent-roots.eyg` are already verbatim in `policies/spawner-effects.eyg`, and the
data shape does not lower that number, because a policy module imports nothing
(`invariant.policy-self-contained`).

Recommendation, more simple rather than more general: keep the shipped record. Keep the
alternative as one fixture - `test/fixtures/policy-data-shape.eyg`, proved against the shipped
policy by the audit row `the alternative policy shape decides the same rows` - so an operator
who prefers lists starts from it and edits five named lists, while the default stays the file
whose rules read in order. The row is falsifiable: a copy of the fixture with `hidden`
returning `False({})` printed 12 `DRIFT` rows, exit 1, two of them a file that landed on disk.

Trigger to revisit: a language release in which an effect's value is one type the policy can
match on, or one in which a policy module extends the record another module returned
(`docs/world/entities/gap.policy-record-extension.md`) - either one makes the lists the whole
policy and the copying the thing this note counted goes away.
