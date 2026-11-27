---
id: runbook.persona-issue-triage
type: runbook
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -q 'gap.surface-rows-name-no-argument' docs/world/runbooks/runbook.persona-issue-triage.md && grep -q 'gap.unchecked-effect-ask-costs-the-cap' docs/world/runbooks/runbook.persona-issue-triage.md && grep -q 'gap.eval-mode-answers-no-value' docs/world/runbooks/runbook.persona-issue-triage.md && grep -q 'gap.duplication-literals-in-prose' docs/world/runbooks/runbook.persona-issue-triage.md && grep -qF '32 calls' notes/pi-codemode-new-user-persona.md && grep -qF 'unhandled effect' bin/agent/invented-effect-probe.mjs"
confidence: high
sources: [notes/pi-codemode-new-user-persona.md, docs/world/entities/gap.eval-mode-answers-no-value.md, docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md, docs/world/entities/gap.surface-rows-name-no-argument.md, docs/world/entities/gap.duplication-literals-in-prose.md, docs/world/runbooks/runbook.next-milestone.md]
supersedes: null
superseded_by: null
---
# Triage: the findings the new-user run left, ranked by what each costs a session

The experiment that produced these rows is recorded in `notes/pi-codemode-new-user-persona.md`: one
fresh session, tools limited to `eyg`, a scratch project that declares this package, asked for a
JavaScript to-do app. Its transcript answered 32 calls - 12 performed, 9 type mismatches, 2 parse
refusals, 3 refusals the guard named, 1 call that spent the 30 s cap, 5 information actions - and the
model's own report of the run counted 24 calls, so the transcript is the record and the report is not.

Each row is a claim whose `verify` passes while the hole is open, in the same rule as
`docs/world/runbooks/runbook.next-milestone.md`: when a row's command starts failing, the fix landed.

| row | what it costs a session | the fix this package owns alone | what it costs |
| --- | --- | --- | --- |
| `docs/world/entities/gap.surface-rows-name-no-argument.md` | 9 type mismatches, and three calls to land one deletion | an argument-shape column on the 23 effect rows, generated and drift-checked | 2-3 h, 0.04 s on the surface check |
| `docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md` | one call that costs the cap and prints nothing, per wrong ask against the four unchecked effects | the four guard clauses ask for their argument type; the entry check then names the ask | ~1 h, 0.5 s on the audit |
| `docs/world/entities/gap.eval-mode-answers-no-value.md` | a call that spends half a second to answer `[]` | the entry written for eval ends with the program's value | ~1 h, plus 440 s to prove it in a fresh session |
| `docs/world/entities/gap.duplication-literals-in-prose.md` | one number in a note that reads as a fact about two files | the note names the command; a sixth prose check fails on the class | minutes, 0.01 s |

**Reported, and not this package's to fix.** The persona could not run what it wrote: no effect starts
a process, and no policy field would grant one, so a process effect is an operator's decision
recorded as an open question rather than a row here. The CLI's own answer for an effect the runtime
does not implement suggests handling it, which the one-host rule then refuses; the effect reaches
nothing either way (`bin/agent/invented-effect-probe.mjs`), so the wording is the language's and the
package can only add a row next to it. A read of `guides/eyg-surface.tsv` from a project whose root is
the project alone is refused; whether the refusal's own text names `action: reference` as the
reachable route is unchecked here, so it stays a question rather than a row.

**The two passes that end the work.** Both run after the fixes, each in a fresh one-shot session,
each tallied from its own transcript by the harness in `bin/agent/`: the to-do persona again
(`.ai-work/personas/2026-11-26-todo-mari/persona.md`), and a second persona written as a maintainer
of an existing JavaScript repository - read a file in slices, change one function in place, rename
across two files, never write an app fresh - because the first run created files and never edited one,
never read a slice, and never wrote a policy.

## Not this

- the holes the documentation audit found before this experiment, and the first step for each:
  `docs/world/runbooks/runbook.next-milestone.md`;
- the measurement itself, the persona's expectations, and its friction list:
  `notes/pi-codemode-new-user-persona.md`;
- what the tool prints for each effect, and what a refusal row says: `guides/tool-reference.md`;
- the effect surface and its policy fields: `docs/world/entities/codemode.effect-surface.md`.
