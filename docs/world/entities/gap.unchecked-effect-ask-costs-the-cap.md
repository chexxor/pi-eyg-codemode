---
id: gap.unchecked-effect-ask-costs-the-cap
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -qF 'handle Hash(({algorithm, bytes}, resume)' host/guard.eyg && node bin/agent/misshape-probe.mjs --program test/fixtures/unchecked-ask-misshape-sign.eyg 2>&1 | grep -q '1 mis-shaped ask(s) named by the check' && node bin/agent/refusal-probe.mjs --program test/fixtures/unchecked-ask-wellshaped.eyg 2>&1 | grep -q 'the four unchecked effects answered'"
confidence: high
sources: [host/guard.eyg, notes/pi-codemode-unchecked-effect-pins.md, test/fixtures/unchecked-ask-misshape.eyg, test/fixtures/unchecked-ask-misshape-eygparse.eyg, test/fixtures/unchecked-ask-misshape-hash.eyg, test/fixtures/unchecked-ask-misshape-sign.eyg, test/fixtures/unchecked-ask-wellshaped.eyg, bin/agent/misshape-probe.mjs, bin/agent/refusal-probe.mjs, notes/pi-codemode-misshaped-ask.md, docs/world/entities/codemode.effect-surface.md, docs/world/traps.md]
supersedes: null
superseded_by: null
---
# Closed 2026-11-27: a wrong-shaped ask against an unchecked effect now costs a named row

The hole was this: the four effects no policy field decides - `DecodeJSON`, `EYGParse`, `Hash`,
`Sign` - had guard clauses that re-performed the ask with whatever the program handed them
(`let reply = perform DecodeJSON(value)`), so `value` was a type variable and the entry check had
nothing in the clause to disagree with. A wrong-shaped ask then reached the host, and because the
CLI's error printer walks its whole interpreter state, the guarded run printed 0 bytes for the call's
whole cap - 41.39 s wall measured on a 40 s cap - while the same file through the CLI alone named
`error: type mismatch given: Binary expected: {json: String}` in 0.09 s.

What exists now: each of the four clauses states the shape the effect takes, so `eyg check <the entry>`
names the ask and the run never starts. `Binary` and `String` are stated by measuring the value
(`let _ = !binary_size(value)`, `let _ = !string_length(value)`); `Hash` and `Sign` by naming their
fields in the clause pattern. EYG takes no type annotation in a pattern position, so a builtin that
already demands the type is how the shape is demanded, and the record effects rebuild their record on
the re-perform (`notes/pi-codemode-unchecked-effect-pins.md`). The audit's mis-shape row gained a
fixture per effect, so a regression starts failing there.

| asked today | answer |
| --- | --- |
| `DecodeJSON({json: "[1,2]"})` guarded | `error: type mismatch given: Binary expected: {json: String}`, 1 mis-shaped ask named in 0.44 s, 0 runs |
| `EYGParse(1)` guarded | `given: String expected: Integer`, 0.367 s |
| `Hash({algorithm: "SHA256", bytes: "hello"})` guarded | `given: Binary expected: String`, 0.353 s |
| `Sign({data: "hello"})` guarded | `given: Binary expected: String`, 0.417 s |
| the four in their own shape, guarded (`test/fixtures/unchecked-ask-wellshaped.eyg`) | `the four unchecked effects answered`, refusals: (none recorded), exit=0, 0.292 s |

(`@measured 2026-11-27 by `node bin/agent/misshape-probe.mjs --program <fixture>` and by
`node bin/agent/refusal-probe.mjs --program test/fixtures/unchecked-ask-wellshaped.eyg``; this page's
command re-runs one mis-shape probe and the well-shaped run.)

**What this change did not do.** The four effects keep no policy field, so they stay available under
every shipped policy including the narrowest one - stating a shape in a clause decides nothing about
reach, and a guard edit may not widen what a call may do.

## Not this

- which effects no policy field decides, and why `none` is their field column:
  `docs/world/entities/codemode.effect-surface.md`;
- the mis-shape family the entry check already named before the run starts, on the effects whose
  clause pinned the type: `notes/pi-codemode-misshaped-ask.md`, `bin/agent/misshape-probe.mjs`;
- a name the language does not offer at all, which reaches nothing in milliseconds:
  `bin/agent/invented-effect-probe.mjs`;
- a run that answers nothing because it runs long and prints only at the end: `guides/what-a-call-does.md`.
