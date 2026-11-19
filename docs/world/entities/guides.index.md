---
id: guides.index
type: entity
owner: delegate
status: current
verified_at: 2026-11-19
verify: "grep -q '^name: EYG syntax guide' guides/syntax.md && grep -q '^name: Builtins reference' guides/builtins_reference.md && test -f guides/pi_codemode_agent.md && test -f guides/cli_effects_reference.md && grep -q 'https://eyg.run/guides/install-a-prebuilt-binary' README.md"
confidence: high
sources: [guides/syntax.md, guides/builtins_reference.md, guides/cli_effects_reference.md, guides/pi_codemode_agent.md]
supersedes: null
superseded_by: null
---

# Guides are the language reference

`guides/` holds the prose an agent reads before writing EYG: `syntax.md` is the surface
syntax, `builtins_reference.md` catalogues every `!builtin`, `cli_effects_reference.md` is
the full effect reference for the CLI runtime, and `pi_codemode_agent.md` is how to run a
policy-gated codemode session. `install_from_source.md` and `install_prebuilt.md` say how
the CLI reaches a user; they describe the language workspace's build, not a command that
runs here.

**The website is the source; `guides/` is an offline mirror.** The EYG documentation lives at
<https://eyg.run> - <https://eyg.run/guides> carries install, syntax, the CLI effect reference,
the builtins reference, `advanced-effects` (program-level handlers) and `effect-access-policies`
(the `overlay.access` vocabulary). The copies here were taken from the language workspace on
2026-11-18 and are only for a session that cannot load a page; the README points at the website,
not at the copies, so a guide and its page can disagree without either being wrong today
(`docs/world/traps.md`). Read the website when you can; read the copy when you cannot.

Read the guide before inventing syntax. A guide that disagrees with the compiler is a
guide bug; report it, do not code to the guide. Guides were copied from the language
workspace on 2026-11-18 and have not been re-checked against a compiler built here -
this workspace type-checks modules, it does not build a compiler.

## Not this

Not the implementation and not the spec: the rules an implementation follows live in the
language workspace, not in `guides/`.
