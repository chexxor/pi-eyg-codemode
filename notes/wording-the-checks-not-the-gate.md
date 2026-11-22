---
name: the tree says "the checks", never "the gate", and the mirrors were reworded to match
description: Why every document in this package names the mechanism "the checks" (checked, unchecked) instead of "gate"/"gated"/"ungated", what had to move with the word, and what was deliberately left in the old vocabulary.
date: 2026-11-19
---

A new user reads the README, the guides and the claims; "the gate" is a word no page
defines, and it carries no meaning a reader can look up. Every document in this package
now says **the checks**, **checked** and **unchecked**, and README/AGENTS/guides were
reworded at the same time as the paragraphs were cut to say each fact once.

# What moved with the word

- Two entity claim ids moved, because the world-model lint requires an id to equal its
  filename stem (`pi-simple-world-model/lib/world_model.mjs:464`):
  `overlay.policy-gate` → `overlay.policy-rules`, `pi.codemode-gate` → `pi.codemode-tool`.
  Every pointer to them moved in the same commit (README, the page copy since deleted,
  ADR-002, `notes/pi-eyg-codemode-workspace-port.md`); `docs/world/00-map.md` is generated
  and was regenerated.
- Claim verify commands that grep prose moved with the prose, or the claim would read as
  suspect the day the wording changed: `ADR-003-doc-delegation` greps the install
  sentence, `ADR-003-doc-delegation` greps the install sentence, and a `traps.md` entry that
  grepped a page copy for that sentence now greps the claim record that carries it.
  `docs/world/traps.md` carries the trap and a verify
  command that answers 0 while the README is clean.
- The tier-0 index line "gate: `npm run world:lint`" is generated, so the generator
  template in `pi-simple-world-model/lib/world_model.mjs` was edited, not the output.
  That copy already drifts from the other two copies of the tool
  (`AGENTS.md`, "Three copies of the world model tool"); this is the third such edit.

# What stayed in the old vocabulary, and why

- `gated: true` in the tool's `details` record - a field name in `extensions/eyg-codemode.ts`,
  not prose. Renaming it would falsify every capture of a tool result in the docs and the
  test that pins those shapes.
- `bin/agent/gate.sh` and `gleam-gate` - names of things in the language repository, quoted
  as paths, never as instructions.
- `notes/pi_codemode_host_gate.md` keeps its filename; several claim `sources` lists and
  `test -f` checks name it, and a note's file name is not a sentence a reader parses.
- `gateable` in the spawner policy's prose (`policies/spawner-effects.eyg`,
  `notes/spawner-effect-allowlist.md`, `pi.spawner-policy`) names the set of effects that have
  a policy field, as against the four unchecked ones. It is a noun for that set, not the old
  word for the mechanism, and the four unchecked effects are the reason the set needs a name.
- `CHANGELOG.md` keeps the entries' substance; its header says the wording was replaced on
  2026-11-19, so the record does not claim the releases used this tree's words.
- The two `guides/` copies of the language's pages (`pi_codemode_agent.md`,
  `cli_effects_reference.md`, both deleted 2026-11-22) were reworded so a new user reading them
  hit no jargon;
  the guide's header note says the replacement happened on 2026-11-19 and that the page's
  wording is this tree's, not the website's. Rejected: leaving them verbatim, which keeps
  the biggest concentration of the word in the two files a new user reads most. Trigger
  to revisit: when the language's own page adopts the plainer word, the mirror should be
  re-taken from it rather than edited again.

# Moved later, same rule

On 2026-11-21 the milestone that added `bin/agent/audit.sh` broke the rule in its own new
lines - "six gates" in `AGENTS.md` and in the ADR-005 draft, "a red gate" for a failing check,
and a shell helper named `gate`. They now say six checks, a failing check, and `run_check`;
the sweep that catches this is `grep -rnE '\bgate(s|d|ing)?\b'` over the tree, minus
`policy-gated`, the language repository's `bin/agent/gate.sh` and `gleam-gate`, the field name
`gated: true`, and the 2026-11-19 entry in `docs/world/traps.md`, whose own `verify` quotes the
old wording on purpose.
