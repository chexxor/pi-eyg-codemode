---
id: gap.unchecked-effect-ask-costs-the-cap
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -qF 'let reply = perform DecodeJSON(value)' host/guard.eyg && eyg check test/fixtures/unchecked-ask-misshape.eyg 2>&1 | grep -q 'type mismatch' && node bin/agent/misshape-probe.mjs --program test/fixtures/unchecked-ask-misshape.eyg 2>&1 | grep -q 'no mis-shape'"
confidence: high
sources: [host/guard.eyg, test/fixtures/unchecked-ask-misshape.eyg, bin/agent/misshape-probe.mjs, notes/pi-codemode-misshaped-ask.md, test/fixtures/misshaped-ask.eyg, docs/world/entities/codemode.effect-surface.md, docs/world/traps.md]
supersedes: null
superseded_by: null
---
# Gap: a wrong-shaped ask against an unchecked effect costs the whole call cap and prints nothing

The four effects the CLI marks unchecked - `DecodeJSON`, `EYGParse`, `Hash`, `Sign` - are the four
whose guard clause hands the program's argument through with no type pinned:
`host/guard.eyg:673` reads `let reply = perform DecodeJSON(value)`. The entry check types the whole
call, and with the clause polymorphic in `value` there is nothing in it to disagree with, so the ask
is accepted and the run starts. `test/fixtures/unchecked-ask-misshape.eyg` asks
`DecodeJSON({json: "[1,2]"})`, where the effect wants a `Binary`:

| asked | answer |
| --- | --- |
| the fixture through the tool, cap 40 s | `eyg run: timed out after 40 s in 41.39 s wall`, 0 bytes of output |
| the same file through the CLI alone | `error: type mismatch given: Binary expected: {json: String}`, exit 1 |
| `eyg check` of that file alone | names the same mismatch, milliseconds |
| `node bin/agent/misshape-probe.mjs --program` on that file | `no mis-shape: the check named no type mismatch`, 0.426 s, 0 runs |

So the guarantee that a mis-shaped ask costs a named answer rather than the spawn cap holds for the
effects whose clause pins the argument type - the audit's row tests `test/fixtures/misshaped-ask.eyg`
alone - and not for these four. The cost of the miss is visible as a timeout row, whose advice
points at `guides/eyg-surface.tsv`, and that file names no argument shape
(`docs/world/entities/gap.surface-rows-name-no-argument.md`), so the second call spent on the ask
cannot learn what the first one got wrong. `notes/pi-codemode-misshaped-ask.md` carries why the run
prints nothing: the CLI's report is a value inspector over the interpreter state, and the guarded
entry is a large module graph.

**Trigger to close:** each of the four clauses asks for its own argument type, so the entry check
names the ask and the run never starts. The change is a type written where the clause already is -
the four effects stay unchecked, which is what keeps them available under every shipped policy
including the narrowest one. When that lands, this page's command fails and the audit's mis-shape
row gains a fixture per effect.

## Not this

- which effects no policy can forbid, and why `none` is the field column for these four:
  `docs/world/entities/codemode.effect-surface.md`;
- a name the language does not offer at all, which reaches nothing in milliseconds:
  `bin/agent/invented-effect-probe.mjs`;
- the mis-shape family the entry check does name before the run starts:
  `notes/pi-codemode-misshaped-ask.md`, `bin/agent/misshape-probe.mjs`;
- a run that answers nothing because it runs long and prints only at the end - the other meaning of
  the same timeout row: `guides/what-a-call-does.md`.
