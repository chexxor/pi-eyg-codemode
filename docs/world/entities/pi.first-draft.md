---
id: pi.first-draft
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "head -20 README.md | grep -qi 'first draft' && head -20 README.md | grep -qi 'no long-running session' && test -f docs/world/entities/cli.checked-runner-on-this-host.md"
confidence: high
sources: [README.md, package.json, CHANGELOG.md, docs/world/entities/gap.runner-release-lacks-policy.md, docs/world/entities/gap.policy-runner-not-on-main.md, AGENTS.md]
supersedes: null
superseded_by: null
---

# The package is a first draft, and the README says so where a new reader hits it

`README.md` opens with a status line calling the package a first draft that has not been proved
in extended use, and the command above re-checks both halves of that: the sentence is in the
first 20 lines, and the reason named there is use, not the missing runner - a checked call has
been observed here since 2026-11-20 (`cli.checked-runner-on-this-host`).

What "first draft" covers, precisely:

- **No use in a real project.** The evidence in this tree is measurements of single calls -
  `eyg check` on the shipped modules, `node --test 'test/*.mjs'`, the world-model commands — with
  costs in `AGENTS.md`'s table. Nothing here is a long session, and no comparison against the
  built-in JavaScript codemode has been measured.
- **The checks have been seen working; the package has not been used.** The presets type-check,
  the drift guard passes against its snapshot, and under a checked run made on 2026-11-20 through
  a development build of the language CLI this tree no longer has, a write inside the roots
  performed and a write outside them came back
  `write_file denied by policy` (`cli.checked-runner-on-this-host`, superseded). What is
  still missing is time: nothing here is a long session, and no comparison against the built-in
  JavaScript codemode has been measured.
- **Version numbers say nothing about this.** `package.json` carries `1.5.0`, and `CHANGELOG.md`
  records 1.5.0 as the move to a standalone workspace - a packaging history, not a maturity claim.

Trigger to move this record: sessions in real use, and a measured comparison against the built-in
JavaScript codemode. Then replace the README's status line. The runner half of the old trigger was
met once, on 2026-11-20, and is superseded: no build this package reaches carries the flag
(`cli.runner-official-install-only`).

## Not this

Not a claim that the tool is broken - a runner that accepts the flag and is named by
`EYG_CODEMODE_RUNNER` runs the presets as written, and what
happened when one did is recorded in `cli.checked-runner-on-this-host` (superseded). Not the gap records
themselves: they say which hole is open, this one says how much of this package's own prose is
provisional.
