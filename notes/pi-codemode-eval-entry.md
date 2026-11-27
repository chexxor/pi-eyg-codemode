---
name: pi-codemode-eval-entry
description: Why the entry an `eval` call writes carries no guard, and what that leaves the call able to do
date: 2026-11-27
---
# Why the eval entry carries no guard

`action: eval` used to answer `[]` for every program. The entry the tool wrote ended with
`guard.build(...)`, and that call's value is the list of refusals the guard answered - empty
when nothing was refused. So the one thing eval is advertised for, printing what the program
computed, was never available to a session.

`entryProgram` now takes `pure`. For `pure: true` it writes two lines: import the program
module, then `program.run({})`. The entry's last expression is the program's own value, which
is the only thing `eyg eval` prints. `runGuarded` passes `pure: mode === "eval"` - the same
condition that decides the record path, so one branch of one argument pair covers both files
a call is made of.

**The guard is missing on one side and that needs a reason.** `host/guard.eyg` decides
effects; `eyg eval` has no host for any effect at all, so there is nothing to decide. Proved,
not reasoned: a program that performs `WriteFile` run as `eyg eval <its file>` answers
`error: unhandled effect WriteFile(...)` and the file it asked for does not exist
(`@measured 2026-11-27 by running the eval of a fixture that asks for a write and listing the
path it named`). So the pure entry adds no reach: an eval call cannot write, cannot read,
cannot start a process. The check of the same entry still runs before it, so a mis-shape in an
eval program is still named before the call answers.

**What this does not buy.** An eval call still cannot see a file, a directory or the
environment - `run` is the only mode that performs. A program that performs an effect and is
run as eval gets the unhandled-effect error, which the tool appends the hint for
(`evalHint` in `extensions/eyg-codemode.ts`), and that hint is unchanged. The refusal record
- the fourth file a call is made of - stays a run-mode file: eval refuses everything, so its
record would be empty, and a trailer write in eval mode would itself be refused and answer
`unhandled effect`.

**Why not a record read instead.** The other way to close the gap was to keep the guarded
entry and print the program's value out of a file the entry writes. That costs a write inside
the guarded body, which a policy could refuse, and a value that arrives after the fact rather
than the one the CLI already has. The entry's last expression is that value already; the
guarded entry stays for `run`, where the refusals are the answer.

Read it with `docs/world/entities/gap.eval-mode-answers-no-value.md`, which the fix supersedes,
and `docs/world/entities/pi.eval-action.md`, which carries the run that proves it.
