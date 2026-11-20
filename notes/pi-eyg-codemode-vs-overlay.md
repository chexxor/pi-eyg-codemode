---
name: pi-eyg-codemode and the language repository's Overlay harness
description: Two harnesses sit on one set of checks; when to use which, what wrapping an external runner costs this package, and what it still cannot show on a machine without a checked runner
date: 2026-11-19
---
*(The comparison was read off the language repository on 2026-11-19 by reading that checkout
read-only; the lineage commit and its line count are the operator's report from there and cannot
be re-run here. What each harness owns is the claim `overlay.agent-harness`; this note is only
the trade-off.)*

# One set of checks, two harnesses

The language repository's Overlay harness and this package are neither competitors nor
duplicates: they are the two sides of one seam. Overlay runs the agent loop in Gleam and hands
the program to the same `Pass`/`Mock` loop that `eyg run --policy` reaches; this package leaves
the loop to pi and hands one EYG program to that runner per call. A model in either one gets the
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
probes the runner instead of assuming it (`notes/pi_codemode_runner_probe.md`), and it carries a
recorded copy of the table with a guard that fails when the copy drifts
(`test/fixtures/rule_mapping.PROVENANCE.md`). That duplication is the price, and it is not a
one-off: re-capturing the fixture is a manual step at every language release, and the live half of
the guard only runs when `EYG_RULE_SOURCE` names a checkout - pointed at the one on this host it
fails by a single `Search` row, which reads as a broken package and is not
(`gap.policy-runner-not-on-main`, and the trap in `docs/world/traps.md`).

# What this package still cannot show

The checked one-shot runner is the piece the second harness does not have of its own: `eyg run
--policy` is the loop Overlay already runs, and the language carries it as source on a branch
(operator-reported; absent from the checkout here, `gap.policy-runner-not-on-main`). Until a
release carries the flag, this package is honest but unusable on a machine that installed the
prebuilt binary: every call dies at the runner probe, and no refusal has been observed end to end
here (`pi.first-draft`). Trigger to revisit: the first release whose `--help` mentions `--policy`
- then re-run the availability probes, re-capture the fixture, and move
`cli.prebuilt-binary`, `gap.runner-release-lacks-policy` and this paragraph together.
