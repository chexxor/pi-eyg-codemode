---
id: ADR-002-handler-seam
type: adr
owner: human
status: superseded
verified_at: 2026-11-26
verify: "grep -q 'Plan first, then act' guides/tool-reference.md && grep -q '^superseded_by: ADR-006-guard-in-package' docs/world/decisions/ADR-002-handler-seam.md && grep -q 'ADR-002-handler-seam' docs/world/decisions/ADR-006-guard-in-package.md"
confidence: high
sources: [policies/agent-roots.eyg, policies/deny-all.eyg, README.md, notes/pi-codemode-handler-seam.md, guides/tool-reference.md]
supersedes: null
superseded_by: ADR-006-guard-in-package
---

# ADR-002: where an effect handler may be re-implemented

**Superseded 2026-11-22 by `docs/world/decisions/ADR-006-guard-in-package.md`.** The choice this
record made - that the seam sits in the policy module rather than in a program or a new tool
parameter - stands. What changed is where the handler loop runs: the decision this record assumed
lived in the run command, in a build that could load a policy module, and no installed build could.
ADR-006 puts the loop in `host/guard.eyg`, which this package ships, so the policy module is
imported by a host rather than handed to a runner. What still holds from here: `Pass(value)` may
rewrite the argument, `Mock` answers the program and the host performs nothing, `Mock` must return
the effect's own reply type, and the plan-then-act pair is two calls under two records.

## Context

An operator wants tools an agent can trust, and EYG separates an effect's *description* from
its *implementation* (`guides/syntax.md:349`, a mirror since deleted; "Scripts declare effects they need; the runner
decides what to do with them"), so more than one place could hold an implementation: the
policy module the host loads, a registry module the model calls, the CLI runtime's own effect
code in the language repository, or `handle EffectName` inside the program. Those are not
interchangeable - one of them is in the program, and a permission decided in the program is
not a permission. Each also costs something different: 0.06-0.07 s per checked call, one runner
start-up per call, or an escalation in the language repository.

## Decision

Re-implement handlers at the **policy module** and nowhere else in this package. A rule is a
function the host calls with the value the program asked for, and it answers
`Pass(value)` (perform, with a value that may be rewritten), `Mock(x)` (answer without the
host performing anything), or a wrapper that takes a rule and returns one. Composed tools are
registry modules bound through `libraries`, not a new dispatch layer in the tool. A staged
session is one program under two records: `policies/deny-all.eyg` to plan, `policies/agent-roots.eyg`
to act.

## Alternatives rejected

- **A `tools` parameter in the extension** that maps names to modules and dispatches them: a
  second answer to "what may this reach", which would disagree with the runner's decision. Same
  reasoning as the registry listing's advisory availability
  (`notes/pi_codemode_registry_probe.md`) - a second check would be a second answer.
- **`Mock` as the boundary of an act policy**: mocking `write_file` reports a successful run
  with nothing on disk, which is the failure mode an operator least wants. `Mock` belongs in a
  plan policy, where "nothing lands" is the point.
- **A new domain effect in the language** (`QueryKB`, `Snapshot`) to get the tool: an effect is
  an escalation in the language repository's rules, the 19 policy fields already decide the paths
  such a tool needs, and a new effect would need a rule in every policy anyway.
- **`handle EffectName` in the program** as the seam: it is the one route where the program
  supplies a handler, the language documents it in two lines for "advanced embedding
  scenarios", and whether it can shadow the host's rule is UNVERIFIED from this workspace
  (`docs/world/traps.md`, `docs/world/entities/overlay.policy-rules.md`). Nothing here relies on
  it, and it must not become the way trust is expressed.

## Consequences

+ The permission set is one record per session, readable where it is used, and a handler can
  substitute what the model asked for - a jailed path, a normalised URL, a header carrying a
  token the program cannot read.
+ "Think before you touch" costs one extra call and uses shipped artifacts: the plan run prints
  a plan and refuses everything, the act run is the one that changes the world.
+ A refusal names the effect and the path, so the model can read the permission it was refused
  rather than infer it.
- Simulating an effect is untyped-safe here: a `Mock` whose value is not the effect's type is a
  runtime error, not a refusal, and whether the host checks it before performing is
  UNVERIFIED - `host/guard.eyg` applies a rule and performs with the value the rule hands back, so
  a mock's value reaches that host untyped (`docs/world/entities/host.guard-boundary.md`).
- A staged session is two calls, so two runner start-ups and two rendered rows - fine at
  0.06-0.07 s each, and small next to a 44-142 s live session.
- The plan run and the act run can disagree if the roots changed between them; the expanded row
  prints policy, source and roots per call, which is what makes the pair checkable.
