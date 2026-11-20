---
name: pi-codemode-subagent-spawn
description: Why a spawned subagent is a separate headless pi session bounded by the spawner's own reach, why a grant is not inherited by it, and what each of those costs
date: 2026-11-20
---

Five decisions the spawn forces, argued here rather than in the code.

**A separate process, not `ctx.executeTool`.** pi gives an extension `ctx.executeTool(name, args)`,
which runs another tool inside this session and records it as a nested call. That is the cheaper
mechanism and it was rejected: it runs with *this* session's policy, this session's roots and this
process's environment, so a "subagent" through it would be this session with a longer prompt. The
point of the spawn is a second session with its own boundary, and a boundary in this package is
carried by the environment of the runner (`EYG_POLICY`, `EYG_ALLOWED_ROOTS`) plus the depth marker.
`pi.exec` takes no `env`, so the boundary is set on the process for the spawn and restored in a
`finally` - the same shape as one checked call. Cost: one child session costs a model run of its
own (the measured child took 1:01 wall and made 11 calls), and the child sees none of the
conversation, so `task` has to carry everything.

**The bound is "nothing the spawner could not do for itself", not a numeric narrowing.** Roots are
compared for real (`rootsInside`: every child root under a parent root). Policies cannot be
compared for real - a rule is a function - so the child's policy is limited to the module this
session's settings name or a preset this package ships, which is exactly the set the spawner could
already pass to its own `policy` argument (`argumentPolicyPath`). Cost, stated plainly: a session
whose project names `deny-all` can hand a child the shipped `agent-roots` over roots it already
has. That is not a widening of what the spawner could reach; it is a widening relative to the
policy the operator chose for the parent, and the operator's lever against it is the project key,
which a model cannot change. The alternative - refusing any child policy but the parent's own
module - would make the tool useless for the case it exists for: one chunk of work under the
narrowest shipped preset.

**A grant is not inherited.** The child's policy and roots are computed with the parent's session
grant excluded from both. A grant is the operator answering a refusal *in this session*, and its
duration counts calls in this session; a child has no call limit and no operator in front of it, so
inheriting a one-call grant would let one yes buy unlimited calls. Cost: a session running under a
grant cannot delegate granted work - it must do that work itself, and the refusal rows say so
instead of sending the model looking for a channel.

**The depth marker, not the environment variable, is what carries a spawner's standing.**
`EYG_SUBAGENT_POLICY` and the spawner's roots slot are read only when `EYG_CODEMODE_DEPTH` says
this package started the process. A project that sets the variables in its own environment gets
nothing from them, and the child still cannot go wider than its own `EYG_POLICY` fallback. Cost:
one more variable to keep straight, and one more thing a proof has to pin - which is why the unit
test asserts the depth slots and why the depth-1 refusal was run live.

**No grandchildren, and the child sees no spawner tool.** A session at depth >= 1 is refused a
child, and `--tools eyg` means the child does not even have `eyg_subagent` declared. Cost: a task
that wants a two-level decomposition has to be done in one session, which is the honest answer
when the alternative is a tree of sessions nobody authorized. Benefit: the delegation the operator
imagined when they trusted a project is one level deep, and a runaway model cannot fork the
machine into sessions.
