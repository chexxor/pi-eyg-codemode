---
name: pi-eyg-codemode and the language repository's Overlay harness
description: Two harnesses sit on one set of checks; when to use which, what wrapping an external runner costs this package, and what this package still cannot show offline
date: 2026-11-23
---
*(The comparison was read off the language repository on 2026-11-19 by reading that checkout
read-only; the lineage commit and its line count are the operator's report from there and cannot
be re-run here. What each harness owns is the claim `overlay.agent-harness`; this note is only
the trade-off.)*

# One set of checks, two harnesses

The language repository's Overlay harness and this package are neither competitors nor
duplicates: they are the two sides of one seam. Overlay runs the agent loop in Gleam and hands
the program to the runtime's own `Pass`/`Mock` loop; this package leaves the loop to pi and runs one
EYG program through a guard of its own (`host/guard.eyg`), which answers in that same vocabulary. A
model in either one gets the
same kind of answer to a refused effect - `Error("<effect> denied by policy: <path>")` as a value
it can branch on - because that shape comes from the checks, not from the harness in front of
them.

**Choose Overlay** when the harness itself should be EYG-shaped: a `.overlay.eyg` per project
(nested configs such as `.overlay.planner.eyg`, operator-reported), a browser variant, a `fetch`
rule that injects a token host-side with `policy.with_header` while the program never holds it, a
typed `context` record in scope for every run. None of that is this package's shape, and nothing
here should grow it.

**Choose this package** when pi's loop, TUI, history and context budget are what you want to keep
and the only thing to change is the model's channel to the host: one `eyg` tool, roots as
configuration, and - for a session that must not have a shell - a project whose `defaultTools`
names nothing and whose `extensions` carries `"-builtin:codemode"`. This repository's own
`.pi/settings.json` keeps the built-in file tools, because a session here edits this tree; that
is a development setting, not something the package installs.

# What the split costs

Overlay lives inside the language repository, so its effect table is whatever the runtime has
today. This package wraps a binary that may sit anywhere on the machine, so it pays twice: it
names one binary and reads what that binary says back (`notes/runner-not-probed.md`), and it carries a
recorded copy of the table with a guard that fails when the copy drifts
(`test/fixtures/rule_mapping.PROVENANCE.md`). That duplication is the price, and it is not a
one-off: re-capturing the fixture is a manual step at every language release, and the live half of
the guard only runs when `EYG_RULE_SOURCE` names a checkout - pointed at the one on this host it
fails by a single `Search` row, which reads as a broken package and is not
(`gap.policy-runner-not-on-main`, and the trap in `docs/world/traps.md`).

# What this package still cannot show

The language's checked one-shot run - `eyg run --policy <module>` - is still not in a release and
still not in the language's `main` (`gap.runner-release-lacks-policy`,
`gap.policy-runner-not-on-main`), and this package no longer waits for it: the checks live in
`host/guard.eyg`, an EYG program the installed release runs with no flag, so a refusal is re-runnable
by anyone with `eyg` on `PATH` (`node bin/agent/refusal-probe.mjs`, `ADR-006-guard-in-package.md`).
What is still not shown here is the comparison with the live runtime. Offline, the only evidence that
this package's effect table matches the runtime's is the recorded snapshot
(`test/fixtures/rule_mapping.PROVENANCE.md`), and the live comparison needs a checkout named by
`EYG_RULE_SOURCE` - pointed at the one on this host it fails by a single `Search` row, because that
checkout sits on `main` (`gap.policy-runner-not-on-main`, and the trap in `docs/world/traps.md`). The
other thing no check here reaches is extended use: the package is a first draft (`pi.first-draft`).
Trigger to revisit: the first release whose `--help` mentions `--policy` - then re-capture the
fixture, re-run the live comparison, and move `cli.prebuilt-binary`, `gap.runner-release-lacks-policy`
and this paragraph together.
