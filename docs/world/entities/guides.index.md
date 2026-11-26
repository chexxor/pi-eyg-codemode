---
id: guides.index
type: entity
owner: delegate
status: current
verified_at: 2026-11-26
verify: "test -f guides/first-session.md && test -f guides/tool-reference.md && test -f guides/what-a-call-does.md && test -f guides/how-to-share-functions.md && test -f guides/how-to-write-a-policy.md && test -f guides/how-to-spawn-a-subagent.md && test -f guides/how-to-point-the-tool-at-your-runner.md && test -f guides/how-to-read-in-slices.md && test -f guides/eyg-surface.tsv && ! ls guides | grep -qE '^(syntax|builtins_reference|cli_effects_reference|install_prebuilt|install_from_source|pi_codemode_agent)\.md$' && grep -q 'eyg-surface.tsv' README.md"
confidence: high
sources: [guides/PURPOSE, guides/first-session.md, guides/tool-reference.md, guides/what-a-call-does.md, guides/how-to-write-a-policy.md, guides/eyg-surface.tsv, README.md, bin/agent/gen-surface.mjs]
supersedes: null
superseded_by: null
---

# Guides are this package's own prose plus one generated surface file

`guides/` holds what an agent reads before writing EYG, and it is one set now: prose this
package wrote, plus `eyg-surface.tsv`, the machine-readable surface. `first-session.md` is the
tutorial a new user follows to one call; the `how-to-*.md` pages carry the five things the
surface implies (point the tool at your binary, write a policy, read in slices, share
functions, spawn a subagent); `tool-reference.md` is this package's own reference - the knobs,
the rows, the probes and the seam it cannot check; `what-a-call-does.md` is the explanation, one
call walked in the order the tool does it, each step with the command that shows it from a shell.
The README links all of them and carries none of their content.

`eyg-surface.tsv` is generated, not written: `bin/agent/gen-surface.mjs` builds it and
`--check` re-derives it from `test/fixtures/rule_mapping.gleam`, from `POLICY_FIELDS` in
`lib/render-helpers.mjs`, from the `!builtins` this tree's own `.eyg` sources call, and byte
for byte against its own rebuild (`docs/world/entities/guides.surface-file.md`). Its header
names the page that records when its builtin rows were captured, and
`test/fixtures/surface.PROVENANCE.md` is that page and carries the how-to re-capture it.

The language's prose is not here. <https://eyg.run/guides> carries install, syntax, the CLI
effect reference, the builtins reference, `advanced-effects` (program-level handlers) and
`effect-access-policies` (the `overlay.access` vocabulary); this package used to copy six of
those pages and stopped, because a second copy of a surface is a second answer to "what is the
surface" and a model reads either as current (`docs/world/decisions/ADR-003-doc-delegation.md`
records the decision to copy them, and the sentence in it that no longer holds).

No guide tells anyone to build something. `guides/how-to-point-the-tool-at-your-runner.md`
starts from a binary you already have, and the install routes end at the website with the check
to run before believing an install worked
(`docs/world/entities/gap.install-guides-name-no-policy.md`). `bin/` carries one script,
`agent/audit.sh`, which a person or a cron runs (`AGENTS.md`).

Read the surface before inventing syntax. It disagreeing with the compiler is a bug in the
capture, and `--check` is what says whether it still holds; a compiler built here is the only
thing that could re-capture the builtin rows from a build you trust
(`docs/world/entities/gap.policy-runner-not-on-main.md`).

## Not this

Not the implementation and not the spec: the rules an implementation follows live in the
language repository, not in `guides/`. Not the language's prose either - that stays upstream.
