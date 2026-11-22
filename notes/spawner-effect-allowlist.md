---
name: spawner-effect-allowlist
description: Why the child's effect allowlist is a whole copied policy reading one environment variable, why an unset list refuses everything, why the call budget is counted in the child's own tool, and why `read` is on the tool allowlist at all
date: 2026-11-20
---

Six decisions the child surface forces, argued here rather than in the code.

**A whole copied policy, not an import.** `policies/spawner-effects.eyg` is `agent-roots.eyg` with an
allowlist over each field, written out in full. A policy module may import nothing outside this package
(`docs/world/invariants.md`, `notes/pi-codemode-policy-inlining.md`), so "narrow a policy" cannot mean
"wrap the module that sits beside it": the runner loads one module and that module has to carry every rule. Cost,
stated plainly: the two files can drift - a rule fixed in `agent-roots.eyg` stays wrong in the copy
until someone mirrors it. What guards it: both files carry one field per entry of `POLICY_FIELDS`,
which the drift guard already compares against the recorded `rule_mapping` snapshot, and the policy
claim's `verify` type-checks the copy and asks it two questions
(`docs/world/entities/pi.spawner-policy.md`). Trigger to do better than a manual mirror: the first
time a session commits a rule change to `agent-roots.eyg` and the copy is still behind - then a
generated policy is worth its complexity.

**One variable, not one policy per set of effects.** Nine gateable fields is 512 subsets; a policy per
subset is 512 files to keep in sync, and a policy per *useful* subset would still be a list someone
invents. `EYG_SUBAGENT_EFFECTS` is read by the policy module itself at load, so the allowlist is still
the policy's decision rather than the program's, and the tool passes it exactly as it passes
`EYG_ALLOWED_ROOTS`. Cost: one more variable a proof has to pin, and a project that names
`spawner-effects` as its own `eyg.policy` gets an allowlist knob too - which is not a widening,
because the policy can only take fields away from the rules it already carries.

**Unset means refuse, not "no opinion".** A missing list names no field, so every gateable effect is
refused. The alternative - missing means everything the base policy allows - would make the wide
behaviour the default and the narrow one the thing you have to remember, which is backwards for a
policy whose whole purpose is narrowing. The refusal text says `EYG_SUBAGENT_EFFECTS=` with the empty
list, so the narrow default is loud rather than silent, and `deny-all` remains the policy for "nothing
at all" (`docs/world/entities/pi.policy-config.md`).

**Field names in the variable, effect names at the tool.** The policy speaks the record's vocabulary
(`read_file`), the model speaks the CLI's (`ReadFile`), and the mapping lives in one place
(`effectFieldsFor` in `lib/render-helpers.mjs`). Cost, in the open: `Search` and `ReadFile` are one
field, so a spawner cannot hand a child "search but not read" - and the parameter description says so
instead of implying a distinction the runtime does not have. The same mapping is why the four unchecked
effects are reported as no-ops rather than refused: no policy can forbid them
(`docs/world/entities/codemode.effect-surface.md`).

**The budget is counted in the child's own `eyg` tool, from the session records.** pi has no flag that
caps tool calls, a policy module has no per-session counter, and a new effect to ask "how many calls
have I made" is a change to the language, not to this package. So `max_calls` travels as
`EYG_SUBAGENT_MAX_CALLS` and the child's copy of the tool compares it with `eygCallCount` over the
session's own records - the same scan that spends a grant - counting only results that carry
`ran: true`, so a call refused before it reached a policy, and the budget refusal itself, spend
nothing. Cost: the budget is enforced by this package's tool rather than by the host, so it binds a
session this package started and not a `pi` a human starts by hand; and the child is stopped by a
refusal it can read, not by a killed process - the row tells it to report what it has, which is what
makes a spent budget a useful answer instead of a truncation.

**`read` is on the tool allowlist, and that is the risky part.** pi's own `read` tool is not decided by
any policy module, so a child given `read` can read what the parent's `read` can reach, outside the
roots and outside the allowlist. It is allowed anyway because the alternative is worse for the task the
child exists for: an effect-only child that wants this package's guides cannot open them and burns
calls guessing (`docs/world/entities/usability.without-language-skill.md`). The guard rails are that
`eyg` must be present, `read` is off by default, and a child can never be given a tool the parent's
session does not already have (`childTools` against `pi.getActiveTools()`), so widening a child's tools
is never wider than the session the operator is looking at.
