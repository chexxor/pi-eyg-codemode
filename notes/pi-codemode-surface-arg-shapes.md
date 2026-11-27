---
name: pi-codemode-surface-arg-shapes
description: Why the argument shapes on the effect rows come from a recorded fixture rather than from a CLI probe or from the guard alone
date: 2026-11-27
---
# Why a recorded fixture carries the effect argument shapes

The surface file's effect rows gained a column: the argument each effect's ask carries and what
the effect answers back. The hole was that a `type mismatch` refusal tells the model to re-read
the effect's row, and until now that row named only the effect and the policy field that decides
it - so the instruction cost a call and answered nothing (`docs/world/entities/gap.surface-rows-name-no-argument.md`).

Three ways to fill the column were considered; one was taken, two rejected with reasons the
code cannot show.

**Taken: a fixture of shapes, drift-checked.** `test/fixtures/effect-args.tsv` holds one row per
label; `bin/agent/gen-surface.mjs` reads it into the row's last column and `--check` requires a
row for every label in `POLICY_FIELDS` and none for an effect the package does not name. The
check stays offline and stays under a tenth of a second, and a shape that stops matching its
source reads as a failed drift row rather than as a stale sentence.

**Rejected: ask the installed CLI for the shapes.** It cannot give them. `eyg check` of
`perform ReadFile(0)` reports the type of the *argument written*, not the shape the effect wants -
sweeping `perform <Label>(0)` and `perform <Label>("x")` over all 23 labels printed only
`expected: Integer` and `expected: String` for every label except the three whose argument type
is already pinned (`DeleteFile`, `Exit`, `Random`, ...), and no record shape at all
(`@measured 2026-11-27 by looping the two probes over the labels of test/fixtures/rule_mapping.gleam`).
The effect's own ask shape is not in the type system; it is in the runtime's implementation and,
in prose, on the language's page. A probe would have cost the audit six seconds and answered
nothing about records.

**Rejected: derive the shapes from `host/guard.eyg` alone.** The guard names the *fields* - its
clauses read `request.path`, `request.contents`, `request.pattern` - so it can fill the field
names for the 19 effects a policy decides. It states no *type* for any of them, and types are
what a `type mismatch` needs: the message the CLI prints is `given: String expected: {path: String}`.
The four unchecked clauses do pin shapes, which is why those four rows are the ones the entry
check can already name - but for the other nineteen the guard is silent about types. Deriving from
the guard alone would ship half a row and answer half a question.

So: the language's page supplies the shapes and return types for the twenty-two effects the CLI
hosts - read live on 2026-11-27, recorded in `test/fixtures/effect-args.PROVENANCE.md` with the
capture's `md5` and the re-capture command - and `host/guard.eyg` supplies `Search`, which the
page does not name because the guard, not the CLI, is the host for that walk. Two rows keep the
page's own ellipses (`Fetch`'s `headers: List(...)`, `Sign`'s key pointing at `CreateKey`'s return)
rather than inventing an element type; that is stated in the provenance page so an empty-looking
shape reads as "the page was vague", not as "this package forgot".

**What it costs in exchange.** A fixture is a dated statement, and drift only shows when a label
appears or disappears - a runtime that changed `ReadFile`'s record while keeping the label keeps
`--check` green. The honest limit is written in the provenance page; the language page remains
the source, and the re-capture command is the refresh.
