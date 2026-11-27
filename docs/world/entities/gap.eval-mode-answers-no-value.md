---
id: gap.eval-mode-answers-no-value
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "test \"$(eyg eval test/fixtures/eval-shape.eyg 2>/dev/null)\" = \"3\" && grep -qF 'record: mode === \"eval\" ? null : recordPath' extensions/eyg-codemode.ts"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/fixtures/eval-shape.eyg, notes/pi-codemode-new-user-persona.md, guides/tool-reference.md]
supersedes: null
superseded_by: null
---
# Gap: an `eval` call answers `[]`, so it cannot show a value or check a shape

`action: eval` answers `[]` for every program, whatever the program computes. The reason is in the
file the tool writes: `entryProgram` adds no record line in eval mode
(`extensions/eyg-codemode.ts:530`, `record: mode === "eval" ? null : recordPath`), which leaves the
entry's last expression as the `guard.build(...)` call - and that call's value is the list of
refusals it answered, empty when nothing was refused. The CLI, asked the same expression through a
file of its own, answers the value: `test/fixtures/eval-shape.eyg` holds `!int_add(1,2)` and
`eyg eval` prints `Integer` for a check of it and `3` for the eval of it
(`@measured 2026-11-26 by running both commands; eval 0.42 s wall`).

So the one thing `eval` is advertised for - "pure, prints the value", the wording of the tool's own
description (`lib/render-helpers.mjs:592`) - is not available to a session: a model that guesses a
builtin's shape cannot read back what the builtin answered, and burns a call on it. Measured in the
new-user run (`notes/pi-codemode-new-user-persona.md`), where an eval call and the calls around it
answered `[]` while the same values printed by a `run` program came back as text.

**What this is not.** It is not the CLI failing to evaluate: the bare file answers the value in
0.4 s. It is not a mis-shape, which is named before the run starts on the effects whose guard clause
pins the type. And it is not the silence of a run that hit its cap - an eval call finishes in
half a second and answers the empty refusal list, so nothing is hanging.

**Trigger to close:** the entry written for eval ends with the program's value rather than the
guard's refusal list, or the tool reads the value from a record of its own and prints it. Then this
page's command stops passing, and `guides/tool-reference.md` moves with the row it prints.

## Not this

- which rows a `run` call prints, and what stdout text becomes: `guides/tool-reference.md`;
- the refusal record the entry writes in run mode, and why it survives `deny-all`:
  `docs/world/entities/gap.policy-record-extension.md`;
- an ask whose types do not line up and whose run prints nothing for the whole cap:
  `docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md`;
- what an eval mode performs: nothing, so a program that performs an effect gets the unhandled-effect
  error (`extensions/eyg-codemode.ts:1240`).
