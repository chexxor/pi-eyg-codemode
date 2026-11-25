---
id: pi.session-grants
type: entity
owner: delegate
status: current
verified_at: 2026-11-25
verify: "grep -q 'Ask the operator for a grant only when' extensions/eyg-codemode.ts && grep -q 'why the task needs it, and what you would use it for' lib/render-helpers.mjs && grep -q 'only when the refusal blocks the task' skills/eyg-codemode/SKILL.md && grep -q GRANT_ENTRY lib/render-helpers.mjs && grep -q argumentPolicyPath extensions/eyg-codemode.ts && grep -q 'notes/pi-codemode-ask-last-resort' docs/world/entities/pi.session-grants.md && grep -q 'tokens\\[0\\] === \"status\"' extensions/eyg-codemode.ts && node --test test/render-helpers.test.mjs && node -e 'import(\"./lib/render-helpers.mjs\").then(m=>{const rows=m.suggestGrant({field:\"write_file\",value:\"/tmp/x\"},{roots:\"/work\",policy:\"/p\"});const byRule=m.suggestGrant({field:\"fetch\",value:null},{roots:\"/work\",policy:\"/p\"});const scanned=m.refusalHints(\"write_file denied by policy: /tmp/x\").length===1&&m.refusalHints(\"REFUSED-BY-GUARD\").length===0&&m.refusalHints(\"fetch denied by policy\")[0].value===null;process.exit(rows.length===4&&rows[1].includes(\"/eyg-grant\")&&rows[3].includes(\"why the task needs it\")&&byRule[1].includes(\"no roots addition covers it\")&&scanned?0:1)})'"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, notes/pi-codemode-session-grants.md, notes/pi-codemode-ask-last-resort.md, guides/how-to-write-a-policy.md, guides/tool-reference.md, guides/what-a-call-does.md]
---
# The in-session grant loop

A refused effect is a value the program gets back, not a report the model owes the operator: the tool
description, the prompt guidelines, `skills/eyg-codemode/SKILL.md` and the guides tell a session to keep
solving inside what the policy allows, and it asks the operator - in chat, answered by `/eyg-grant`,
registered by `extensions/eyg-codemode.ts` - only when a refusal blocks the task and the routes inside the
policy are spent. The grant widens the policy for a duration the
operator chooses - one tool call, N calls, or the rest of the session - and can be revoked. Why that
judgment sits with the model, and what it costs the operator, is `notes/pi-codemode-ask-last-resort.md`.

- **The rows carry the ask template.** A call whose output contains `<field> denied by policy`, with
  or without a value after the colon, returns rows naming the field, what the policy was given
  (`refusalHints` answers `{field, value}`, `value: null` when the rule quoted nothing), the policy that
  refused it and the exact grant that would have allowed it (`describeRefusal`, `outsideRoot`,
  `suggestGrant` in `lib/render-helpers.mjs`). A path outside every root gets the first directory no
  root covers; a path already under one gets "the refusal is a rule of <policy>, not a root"; a value
  that is not a path - a host, an environment name, or nothing - gets "no roots addition covers it". They render collapsed as well as expanded, and the
  row that no root would fix says so instead of guessing one. The two rows after the grant say the
  refusal does not end the call, and what the ask has to name once it is made: the addition above, why
  the task needs it, and what it would be used for (`refusalRows` prints all four for the first refusal
  and the first two for each later one).
- **The ask is read off what the run printed.** Those rows come from scanning the run's output for
  that sentence, so a program that catches the refusal value and prints words of its own reports no
  refusal at all: measured 2026-11-23 in a fresh one-shot session, a `WriteFile` at a path outside
  the roots, in a program that matched `Error(why)` and printed its own marker, came back with
  `refusals: []` and `grantId: null` even though the guard had refused it. Nothing host-side records
  that a refusal happened, so the loop depends on the program quoting it.
- **The durations, and who chooses.** `/eyg-grant` bare asks through `ctx.ui.select`: the policy
  (or an absolute module path via `ctx.ui.input`), then "one tool call (recommended: retry exactly
  the refused program)", "a number of tool calls", or "the rest of the session (widest: every
  later call)", then roots, then `ctx.ui.confirm`. Typed with its arguments
  (`/eyg-grant agent-roots 3 roots=/tmp`) it asks only for the confirmation; `/eyg-grant revoke`
  picks among the grants in force. The tool's parameters carry no grant field, and
  `argumentPolicyPath` limits the call's `policy` argument to a policy this package ships, so a
  program cannot reach the widening (`notes/pi-codemode-session-grants.md`).
- **The store is the branch.** A grant is a custom session entry
  (`pi.appendEntry("eyg-grant", ...)`), which does not reach the model; a call that ran under one
  records its id in `details.grantId`, and every call's `details.grants` lists what is in force.
  `grantEvents` + `replayGrants` rebuild the state from
  `ctx.sessionManager.getBranch()` on each call, so a fork or a `/tree` jump replays the history
  and a truncated branch un-spends the calls it dropped. The unit test pins each duration, expiry
  by use, revoke, the newest-grant-wins stack, and that a call refused before the spawn spends
  nothing.

Measured 2026-11-20 in one RPC-driven session over a scratch project (`.ai-work` is
gitignored; the session's runner was a development build of the language CLI this tree no longer
has, `docs/world/entities/cli.runner-official-install-only.md`): the program that writes
`/tmp/eyg-grant-probe.txt` came back
`write_file denied by policy: /tmp/eyg-grant-probe.txt` with
`policySource: project settings`, roots = the project only, `refusals: [{write_file,
/tmp/eyg-grant-probe.txt}]` and the rows naming `/eyg-grant ... roots + /tmp`; `/eyg-grant` then
answered four dialogs (policy, duration, roots, confirm) and notified
`grant gmwos5ksd: <package>/policies/agent-roots.eyg for 1 tool call (roots + /tmp)`; the same
program next ran under `policySource: session grant` with roots `<project>,/tmp` and printed
`wrote /tmp/eyg-grant-probe.txt`, and the file existed; the same program again was refused,
`grantId: null`, the one-call grant spent. A second grant, typed as
`/eyg-grant agent-roots session roots=/tmp` with only a confirmation, let a third call through;
`/eyg-grant revoke` through the select ended it and the fourth call was refused again. The same
session file replayed through `grantEvents`/`replayGrants` reproduces each of those states, and a
branch cut before the first grant record replays with no grant in force at all.

Measured 2026-11-23 in a fresh one-shot session over a scratch project under `.ai-work` (`pi --print
--mode json --offline --approve --no-session --no-context-files --tools eyg --model
strata/qwen3.8-flash-next-iq3_s --thinking off`, 440 s wall, three `eyg` calls): asked to put a file at
`/tmp/ask-last-resort-report.txt` with the roots at the project only, the session's first program failed
to parse, its second performed the `WriteFile` and printed the answer, and came back `exit 1` with
`refusals: [{write_file, /tmp/ask-last-resort-report.txt}]`, `grantId: null` and the four rows; its next
call was `action: "effects"` rather than a report - it went to check that no other effect reaches that
path - and its final message was one ask naming the addition (`/eyg-grant`, `agent-roots`, `roots + /tmp`,
one tool call), why nothing inside the policy reaches it, and what the grant would be used for, with the
in-roots fallback offered in the same message. The first call is the old limit again: a program that
performs the write and returns its answer without printing it comes back with no refusal rows at all.

Measured 2026-11-24 in a fresh one-shot session over a scratch project under `.ai-work` whose
`.pi/settings.json` declares this package with `eyg: { policy: "agent-roots", roots: [] }`, so the
project is its only root (the same command with the model this host serves, 642 s wall, 17 `eyg`
calls, `rc 0`): asked for one report line at `/tmp/ask-alt-report.txt` from two notes inside the
project, it read the notes, then attempted the `/tmp` write twice - the first call matched
`Error(why)` and returned it without printing, so it came back with the status line and `refusals:
[]` alone, the limit above repeated - and the second printed it, which is where the rows appeared:
`refused: write_file at /tmp/ask-alt-report.txt under <package>/policies/agent-roots.eyg`, the grant
that would have allowed it with `roots + /tmp`, and the two rows saying the refusal does not end the
call and what an ask must name. Its next call wrote the same line inside the project root and read it
back. Only its final message named `/eyg-grant` - the policy, the root, "one tool call" - as what the
operator could do once the task was already done in roots: the alternative first, the ask last. The
`/tmp` file did not exist when the run ended, and a run in a scratch project with no
`.pi/settings.json` at all was void - no package declared, no `eyg` tool, zero calls.

UNVERIFIED: the N-calls duration is pinned by the unit test and was not run live; a `/tree` jump
in a real session was not driven, only the replay over the recorded session file. That live proof and
a time bound on a grant are owed work, carried as
`docs/world/entities/gap.grant-polish-undecided.md` with a row in
`docs/world/runbooks/runbook.next-milestone.md`. What landed instead is the operator's view: `/eyg-grant
status` answers the line `grantStatusLine` builds (`lib/render-helpers.mjs:714`), the same line the
command's own errors already carried, and every row of `details.refusals` now names the value the
policy was given rather than pretending it is always a path.

## Not this

- the order a call's policy and roots come from: `docs/world/entities/pi.policy-config.md` and
  `guides/how-to-write-a-policy.md`;
- why a rule lives in the policy module at all: `docs/world/decisions/ADR-002-handler-seam.md`;
- the four trade-offs behind the loop: `notes/pi-codemode-session-grants.md`.

@measured 2026-11-20 by `node .ai-work/grant-loop/drive.mjs` (one `pi --mode rpc` session, five
prompts, seven dialogs answered by the driver; verdict in `.ai-work/grant-loop/report.json`), by
replaying that session file through `grantEvents`/`replayGrants`, and by
`node --test 'test/*.mjs'`; the 2026-11-23 and 2026-11-24 one-shot sessions by
`sh .ai-work/ask-alt/drive.sh` over `.ai-work/ask-alt/proj`, whose `parse.mjs` counts the calls, the
`denied by policy` lines and the write paths, with the verdict in `.ai-work/ask-alt/run.status`.
