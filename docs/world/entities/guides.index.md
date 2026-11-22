---
id: guides.index
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "grep -q '^name: EYG syntax guide' guides/syntax.md && grep -q '^name: Builtins reference' guides/builtins_reference.md && test -f guides/pi_codemode_agent.md && test -f guides/cli_effects_reference.md && test -f guides/first-session.md && test -f guides/tool-reference.md && test -f guides/how-to-share-functions.md && test -f guides/how-to-write-a-policy.md && test -f guides/how-to-spawn-a-subagent.md && test -f guides/how-to-point-the-tool-at-your-runner.md && grep -q 'first-session.md' README.md && grep -q 'how-to-point-the-tool-at-your-runner.md' README.md"
confidence: high
sources: [guides/syntax.md, guides/builtins_reference.md, guides/cli_effects_reference.md, guides/pi_codemode_agent.md, guides/first-session.md, guides/tool-reference.md, guides/how-to-share-functions.md, guides/how-to-spawn-a-subagent.md, guides/how-to-point-the-tool-at-your-runner.md, README.md]
supersedes: null
superseded_by: null
---

# Guides are the language reference and this package's own how-tos

`guides/` holds the prose an agent reads before writing EYG, in two sets. The **language set**
is the offline mirror: `syntax.md` is the surface syntax, `builtins_reference.md` catalogues
every `!builtin`, `cli_effects_reference.md` is the full effect reference for the CLI runtime,
`pi_codemode_agent.md` is how to run a policy-checked codemode session, and
`install_from_source.md` plus `install_prebuilt.md` say how the CLI reaches a user - they
describe the language repository's build, not a command that runs here.

The **package set** was written here and is not a copy of anything: `first-session.md`
is the tutorial a new user follows to one call, the `how-to-*.md` pages carry the five things the
reference implies (point the tool at your binary, write a policy, read in
slices, share functions, spawn a subagent), and `tool-reference.md` is this package's own
reference - the knobs, the rows, the probes and the seam it cannot check. The README links all of
them and carries none of their content.

No guide tells anyone to build something. `guides/how-to-point-the-tool-at-your-runner.md` starts
from a binary you already have, and the install routes end at the website with the check to run
before believing an install worked (`docs/world/entities/gap.install-guides-name-no-policy.md`), and
`bin/` carries one script,
`agent/audit.sh`, which a person or a cron runs (`AGENTS.md`).

**The website is the source; `guides/` is an offline mirror.** The EYG documentation lives at
<https://eyg.run> - <https://eyg.run/guides> carries install, syntax, the CLI effect reference,
the builtins reference, `advanced-effects` (program-level handlers) and `effect-access-policies`
(the `overlay.access` vocabulary). The copies here were taken from the language repository on
2026-11-18 and are only for a session that cannot load a page; the README points at the website,
not at the copies, so a guide and its page can disagree without either being wrong today
(`docs/world/traps.md`).

Read the guide before inventing syntax. A guide that disagrees with the compiler is a
guide bug; report it, do not code to the guide. Guides were copied from the language
workspace on 2026-11-18 and have not been re-checked against a compiler built here -
this workspace type-checks modules, it does not build a compiler.

## Not this

Not the implementation and not the spec: the rules an implementation follows live in the
language repository, not in `guides/`.
