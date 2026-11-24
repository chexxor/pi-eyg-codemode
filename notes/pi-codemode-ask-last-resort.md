---
name: pi-codemode-ask-last-resort
description: Why a policy refusal is something a session solves around rather than reports, and what putting the judgment with the model costs the operator
date: 2026-11-23
---

The tool used to say "a program that needs a denied effect must ask for it and stop" and "a refusal is
an ask you make in chat". Every refusal therefore became a message to the operator. It is not: the
description, the promptGuidelines, `skills/eyg-codemode/SKILL.md` and the guides now say a refusal is a
fact about one path, that the session keeps solving inside what the policy allows, and that the ask comes
only when the refusal blocks the task and the routes inside the policy are spent - and when it comes it
names the addition (the policy field, the path or root, the duration), why the task needs it, and what it
will be used for. `guides/what-a-call-does.md` prints what the rows carry;
`docs/world/entities/pi.session-grants.md` records the loop.

**Why the judgment sits with the model, and not with a counter.** A host-side refusal ledger was the
option considered and not taken: the tool already sees each `<field> denied by policy: <path>`, so it
could count them and treat the Nth as earned. Three reasons it did not.

- The count would be a count of text. `refusalHints` scans the run's output for that sentence, and a
  program that matches the refusal value and prints words of its own reports nothing - measured
  2026-11-23, `refusals: []` for a write the guard had refused. A ledger built on that channel would
  reward exactly the sessions that hide a refusal, which is the failure
  `docs/world/entities/gap.one-host-check-not-transitive.md` is about.
- Exhaustion is about the task, not the number. One refusal at the only path a task needs blocks it on
  the first call; twenty refusals at paths the task never needed block nothing.
- It would put a second authority over the operator's attention in the hands of the harness. The scarce
  thing is the operator's attention, not the model's calls.

**What it costs, said plainly.** The operator hears less. A session can now spend many calls inside what
is allowed and never mention a refusal, so a boundary that is genuinely in the way surfaces late, and the
only signal left is what the model chose to report - the same channel that record says is not honest. This
change does not fix that and weakens the reporting side a little: fewer reports arrive, and each one is
less checkable against the host. What bounds the cost: the refusal rows still render collapsed in the tool
output a person can open, every call's `details` still carries `refusals` and `grantId`, and the template
in the rows is what makes a late ask complete instead of vague.

**Trigger to revisit.** The first real session caught quietly working around a boundary that mattered.
The fix then is a refusal record the guard writes - it knows what it refused, without waiting for the
program to say so - not a stronger instruction to report more.
