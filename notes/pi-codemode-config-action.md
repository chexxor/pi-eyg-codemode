---
name: pi-codemode-config-action
description: Why action "config" prints from the functions the next call reads instead of a config-only copy, what a config call costs against a grant, and why the answer counts a guard that must exist
date: 2026-11-25
---

`action: "config"` answers "what would my next call run under" - the runner, the policy in force
and the slot that chose it, the roots and their source, the grants, the registry scopes, the
timeout. Three choices in it do not show in the code, and this note carries them.

## The rows read the slot functions, not a copy of them

`configLines` (`lib/render-helpers.mjs`) is fed by `policySlots` and `rootSlots` (same file),
`runnerCandidates`, `registryScopes` and `grantStatusLine`; `resolvePolicy` and `resolveRoots` were
changed to *consume* the two slot lists rather than restate the order in their bodies. The
alternative - a config helper that walks the slots itself - duplicates the order in two places, and
the day the order changes in one and not the other the answer tells a session to change a slot the
call does not read. One order, two readers, is the cheap half of that guarantee; the day the two
disagree, the unit test over `resolvePolicy` and `configLines` is red rather than a session acting
on a stale row.

Cost paid: `rootSlots` now returns `{source, base, slots}` instead of the bare winner, so `resolveRoots`
destructures `{base}` and the losing slots are printable. The whole point of printing them is the
question a session actually has - "I set `EYG_POLICY` and it had no effect" - and the answer is the
slot above it and what it holds. `resolvePolicy`'s own return shape stayed `{policy, source,
refusedArgument}` because the renderer tests assert `deepEqual` on it; the slot list reaches the
caller, not the return record.

## A config call spends a grant call

Its details carry `ran: true`, so a grant of N calls counts a config call against N, like
`reference`, `effects` and `list_functions`. `ran` names "this call consumed a grant slot", which is
what `eygCallCount` counts, not "a process was spawned": the answer spawns nothing and asks the
policy nothing, and prints on a machine where no runner was found. Letting the cheap questions be
free would mean a grant of 3 calls could be spent entirely on asking what is in force, and the
operator's budget then means something the operator did not write.

## The narrow-to row compares stems

`this call may narrow to` lists the in-force policy and the narrowest shipped one, out of
`shippedPolicies` (`extensions/eyg-codemode.ts`) with `.eyg` stripped, against
`NARROWEST_POLICY_FILE`, which keeps it. Comparing the strings raw made the row answer `nothing`
for every real session - a wrong answer, not a cosmetic one, since the row is the way a session
learns what it may ask. The fix is `basename(x).replace(/\.eyg$/, "")` on both sides. The
alternative - one shared list of shipped *names* - is the same change seen from the other file, and
it would make `NARROWEST_POLICY_FILE` stop naming a file that exists; the stems stay the comparison
and the constants stay paths.

## The branch sits after the guard check, and says so

`config` answers after the guard-exists check, so a package whose `host/guard.eyg` is missing
refuses the call with the guard message rather than printing a configuration nothing will run
under. A package without the guard has no checks, so the row would describe a call whose checks
cannot exist - the refusal is the honest answer there, and it is why the guard's own path is one of
the rows: the answer is only meaningful because every call runs inside it.

Proved live 2026-11-25: two fresh one-shot sessions over scratch projects that differ only in the
project keys - `@measured 2026-11-25 by pi --print --mode json --tools eyg --offline --no-session
'<one config call>'` from each, 3 min wall for the pair; the rows are quoted in
`docs/world/entities/pi.config-action.md` and the transcripts sit in `.ai-work/config-proof/`,
which the tree keeps untracked.
