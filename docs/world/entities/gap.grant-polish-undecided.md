---
id: gap.grant-polish-undecided
type: entity
owner: delegate
status: current
verified_at: 2026-11-25
verify: "grep -q 'UNVERIFIED: the N-calls duration' docs/world/entities/pi.session-grants.md && grep -q 'grant.used < grant.calls' lib/render-helpers.mjs && grep -q 'tokens\\[0\\] === \"status\"' extensions/eyg-codemode.ts && grep -q 'no roots addition covers it' lib/render-helpers.mjs && grep -q '/eyg-grant <' guides/tool-reference.md && grep -q 'gap.grant-polish-undecided' docs/world/runbooks/runbook.next-milestone.md"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, docs/world/entities/pi.session-grants.md, docs/world/runbooks/runbook.next-milestone.md, notes/pi-codemode-session-grants.md, notes/pi-codemode-ask-last-resort.md, guides/how-to-write-a-policy.md, guides/tool-reference.md]
supersedes: null
superseded_by: null
---

# Gap: two pieces of grant polish landed; a live proof and a time bound are still owed

The mechanism is recorded and partly measured in `docs/world/entities/pi.session-grants.md`:
a refusal carries the ask template, the operator answers with `/eyg-grant`, the grant is a session
entry the branch replays. Four pieces of polish were left out when the milestone that gave a spawner
control over its child parked them here. Two landed on 2026-11-24 and are recorded below with what
they cost; two remain open, each with the step that closes it and the cost of that step. `verify`
goes red when a piece lands or when an open piece stops being open, which is how this record
retires.

**1. The N-call duration has never been run live.** The 2026-11-20 session drove a one-call
grant and a session grant; "a number of tool calls" is pinned only by the unit test (the assert
`an N-call grant counts the calls it covered` in `test/render-helpers.test.mjs`, in the test named
"the grant store"), and `pi.session-grants.md` says so itself:
`UNVERIFIED: the N-calls duration is pinned by the unit test and was not run live`. First step, and
its cost: the shape of the run already on record, `pi --mode rpc` over a gitignored scratch project
with a typed `/eyg-grant agent-roots 2 roots=/tmp`, then three calls at the same refused path -
calls 1 and 2 expected granted, call 3 expected refused with `grantId: null` - about two minutes of
wall for the driving, and the record replaces that sentence. Trigger: the next goal turn that
budgets an RPC driver, since a `pi --print` session cannot answer the dialogs a typed grant still
asks for when it is not headless.

**2. Nothing bounds a grant in time.** A grant ends by spend or by revoke:
`grants.filter((grant) => grant.calls === null || grant.used < grant.calls)`
(`lib/render-helpers.mjs:707`, read 2026-11-21), and `Date.now()` appears in the grant path only to
name the id (`extensions/eyg-codemode.ts:1798`). A session grant therefore keeps widening an hour
later, and across any idle gap, until someone revokes it or cuts the branch. No field carries a
deadline, and the shape is a decision rather than a patch: a wall-clock deadline per grant or an
idle timeout; what the entry stores; and what a replayed branch does with a deadline that passed
after the entries were written - a recorded `expiresAt` is re-evaluated against the wall clock, so
replaying an old session could un-run a grant that was in force when it ran, which is the opposite
of what the branch-as-store is for. Cost: one field, one comparison in `replayGrants`, and a
decision about replay before any of it can be written. Trigger to decide: the first grant left in
force across a break by accident, or the first unattended run (`pi --print`) that takes a grant
nobody is there to revoke.

**3. Landed: the operator can see what is widened without starting a grant.** What exists now:
`grantStatusLine` in `lib/render-helpers.mjs:714`, answering `no grant is in force now` or one line
per grant in force, oldest first, each with its spend and the id to revoke it with; `/eyg-grant
status` (`extensions/eyg-codemode.ts:1703`) prints it as its own subcommand, before `revoke`
(`:1707`), and the command's two error paths and its confirmation summary use the same function
rather than a second phrasing. The argument grammar is a row in `guides/tool-reference.md`.
`/eyg-grant` with no arguments still opens the four dialogs, because the dialog flow is what the
2026-11-20 measurement recorded on `pi.session-grants.md` and a listing must not replace it. Pinned
by three asserts in "the grant store": one grant, two grants oldest first, and the empty answer.

**4. Landed: the ask says what the refusal actually named.** `refusalHints` in
`lib/render-helpers.mjs:735` matches `<field> denied by policy` with the value after the colon
optional, and answers `{field, value}` - `value: null` when the rule quoted nothing - where it used
to require a path and invent one when the reason was a rule rather than a route: measured
2026-11-22, a `standard_in` refusal whose reason was `EYG_SUBAGENT_EFFECTS=read_file,standard_out...`
came back suggesting the root `/EYG_SUBAGENT_EFFECTS=read_file,standard_out...`. `describeRefusal`
(`:626`) is the one phrase - `write_file at /tmp/x`, `fetch asked for 127.0.0.1`, `fetch` - and
`suggestGrant` (`:654`) now chooses among three asks: the first directory no root covers, "the
refusal is a rule of `<policy>`, not a root" for a path already under one, and "no roots addition
covers it" for a value that is not a path. Pinned by `test/render-helpers.test.mjs`
("what a refusal names"). Trigger to revisit: a policy that refuses with a shape neither phrase
fits.

## Not this

- the mechanism itself, and which parts of it were driven live: `docs/world/entities/pi.session-grants.md`;
- the four trade-offs behind the loop, including why the store is the session branch: `notes/pi-codemode-session-grants.md`;
- why the ask is a judgment rather than a refusal counter: `notes/pi-codemode-ask-last-resort.md`;
- who may widen a policy: the operator, host-side, through a command a program cannot reach. This page proposes no program-reachable grant, and `argumentPolicyPath` keeps a call's `policy` argument inside the shipped policies;
- a child session's surface (`eyg_subagent`'s `tools`, `effects`, `max_calls`): `docs/world/entities/pi.subagent-spawn.md`. A grant made in the parent does not reach a child;
- any change to a shipped policy. Every piece here sits in the command and its replay, not in `policies/`.
