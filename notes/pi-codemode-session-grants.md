---
name: pi-codemode-session-grants
description: Why an in-session widening of the policy is a session entry the operator's command appends rather than tool state or a tool parameter, and what that costs
date: 2026-11-20
---

Four decisions the grant loop forces, argued here rather than in the code.

**The store is the branch, not a variable.** `/eyg-grant` appends a custom session entry
(`pi.appendEntry("eyg-grant", ...)`), which never reaches the model, and every eyg call that
reached a policy records the grant it ran under in its result `details.grantId`. A call reads
the branch (`ctx.sessionManager.getBranch()`), replays those records through `grantEvents` and
`replayGrants` in `lib/render-helpers.mjs`, and answers with what is in force now. What it
buys: a fork or a `/tree` jump replays the grant history exactly, and a branch that drops a
call un-spends it - the ledger is the history, so there is no cache to invalidate and no
`session_start` reconstruction to get wrong. What it costs: one replay per call (a walk over
the branch entries; measured as part of a 0.07 s checked call), and one more file to read to
understand a refusal. The pi docs suggest keeping state in tool `details`; that shape alone
would have lost the *records* themselves, which no tool call creates, so the entry and the
details are used together.

**The widening is the operator's act, and the tool's own parameter was narrowed to match.**
Until this change a call could pass `policy: <absolute path>`. A program that can write inside
its roots can write a permissive module there and hand the runner its path, so a "grant" that
the model could reach was not a boundary. Now `argumentPolicyPath` accepts only a policy this
package ships, and `resolvePolicy` honours that argument only when it names the policy the other
slots already chose or the narrowest shipped one (`NARROWEST_POLICY_FILE`, `deny-all.eyg`); every
other name is refused and the message names the name it refused. A wider module comes from
`/eyg-grant`, `eyg.policy` or `EYG_POLICY`, none of which a program writes. What it costs:
a one-off session that needs a hand-written module must set the project key or the environment
before it starts, or the operator must grant its path; the argument is no longer that lever.
This is also why the command takes an absolute path only through its own prompts, after a
`ctx.ui.confirm`.

**The argument had to be proved narrower, not merely shipped (2026-11-21).** The sentence above
was not yet true: naming `agent-roots` was accepted even in a project whose key named
`deny-all`, so a model could undo an operator's narrowing with a tool argument. Paths cannot be
ordered by permissiveness - `agent-roots.eyg` is wider than a hand-written module that happens to
sit next to it - so the rule is by name, not by comparison: the argument may name the module the
other slots already picked, or `NARROWEST_POLICY_FILE`, and `resolvePolicy` reports
`refusedArgument` instead of quietly running the wider one. What it costs: a session in a
`deny-all` project can no longer widen one call to `agent-roots`, which is the point, and a
spawner can no longer send a child somewhere wider than its own project names.

**A duration counts tool calls that reached a policy, not effects.** `one call` is spent by the
next call whose policy decided something; a call refused before the spawn (no runner, a bad
argument) and a call that ran under no grant spend nothing. What it buys: the operator's word
means what it says - the model cannot stretch "one call" by writing a bigger program, and the
capability question (`action: effects`, sixteen probes) is one call. What it costs: a session
that asks that question while a grant is in force burns it, so the recommendation the tool
prints is the narrowest retry, not a survey.

**A grant adds; it never replaces, and the newest answer.** Roots of a grant in force are unioned
onto the project and environment roots (`resolveRoots`), and the newest grant in force is the one
a call runs under, so an older grant reappears when a newer one expires. Narrowing is not what a
grant is for - that is the `policy` argument or the project key - and `revoke` exists because the
widest option, "the rest of the session", otherwise has no end the operator can reach without
restarting pi.

See `docs/world/entities/pi.session-grants.md` for what one live sequence did, and
`docs/world/entities/pi.policy-config.md` for the order a call's preset comes from.
