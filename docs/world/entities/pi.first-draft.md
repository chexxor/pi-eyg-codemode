---
id: pi.first-draft
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "head -20 README.md | grep -qi 'first draft' && ! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'"
confidence: high
sources: [README.md, package.json, CHANGELOG.md, docs/world/entities/gap.runner-release-lacks-policy.md, docs/world/entities/gap.policy-runner-not-on-main.md, AGENTS.md]
supersedes: null
superseded_by: null
---

# The package is a first draft, and the README says so where a new reader hits it

`README.md` opens with a status line calling the package a first draft that has not been proved
in extended use, and the command above re-checks both halves of that: the sentence is in the
first 20 lines, and no runner that accepts `--policy` exists on this host, which is why the
draft status cannot be retired from here.

What "first draft" covers, precisely:

- **No use in a real project.** The evidence in this tree is measurements of single calls -
  `eyg check` on the shipped modules, `node --test 'test/*.mjs'`, the world-model commands — with
  costs in `AGENTS.md`'s table. Nothing here is a long session, and no comparison against the
  built-in JavaScript codemode has been measured.
- **The checks have never been seen working here.** The presets type-check and the drift guard
  passes against its snapshot; no refusal has been observed end to end, because the runner probe
  fails (`gap.runner-release-lacks-policy`, `gap.policy-runner-not-on-main`).
- **Version numbers say nothing about this.** `package.json` carries `1.5.0`, and `CHANGELOG.md`
  records 1.5.0 as the move to a standalone workspace - a packaging history, not a maturity claim.

Trigger to move this record: a runner on this host whose `--help` mentions `--policy`, plus
sessions in real use. Then replace the README's status line, re-run `action: effects` once and
record what the presets then allow.

## Not this

Not a claim that the tool is broken - a runner that accepts the flag and is named by
`EYG_CODEMODE_RUNNER` runs the presets as written, and what happens when it does is exactly what
is UNVERIFIED here. Not the gap records themselves: they say which hole is open, this one says
how much of this package's own prose is provisional.
