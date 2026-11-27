---
name: pi-codemode-unchecked-effect-pins
description: Why the four guard clauses for the effects no policy field decides now state their argument shape, and what stating it costs
date: 2026-11-27
---
# Why the four unchecked clauses state the shape they take

`host/guard.eyg` had `let reply = perform DecodeJSON(value)` for each of `DecodeJSON`, `EYGParse`,
`Hash`, `Sign`: no policy field decides them, so the clause only re-performs the ask with what the
program handed it. That clause is the whole reason a wrong-shaped ask against one of those four
costs the call's cap: the handler's `value` is a type variable, so `eyg check <the entry>` has
nothing in the clause to disagree with, the run starts, and the CLI's error printer - a value
inspector over its whole interpreter state - walks the guard and the policy module imported in the
body and prints nothing for 20 s to 41 s (`docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md`
carries the two measured figures).

The change states the shape where the clause already is. `Binary` and `String` are pinned by
measuring the value (`let _ = !binary_size(value)`, `let _ = !string_length(value)`); `Hash` and
`Sign` by naming their fields in the clause pattern (`({algorithm, bytes}, resume)`) and measuring
the `Binary` field. EYG has no type annotation in a pattern position - `handle DecodeJSON((value:
Binary, resume) -> ...` fails with `unexpected \`:\`` - so a builtin that already demands the type
is the way to demand it, and the call's result is discarded. The pattern for the two record effects
rebuilt the record on the re-perform, which is what keeps their answers unchanged.

Pros: a mis-shaped ask costs 0.35-0.44 s and a named row, so the second call the model spends on the
ask can read what it got wrong; the four effects stay available under every shipped policy, which is
what `docs/world/traps.md` line 32 says they must. Cons: the two record clauses now reject a payload
with an extra field, which the CLI rejected before as well and the check rejects earlier; and
`let _ = !binary_size(value)` is a line whose only job is to state a type, so it needs the comment
above the four clauses to stay readable.
