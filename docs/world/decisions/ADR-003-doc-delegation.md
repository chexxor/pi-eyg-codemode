---
id: ADR-003-doc-delegation
type: adr
owner: human
status: accepted
verified_at: 2026-11-19
verify: "grep -q 'eyg.run/guides/install-a-prebuilt-binary' README.md && ! grep -q 'not from this README' README.md && test -f guides/install_prebuilt.md"
confidence: high
sources: [README.md, guides/install_prebuilt.md, guides/install_from_source.md, guides/syntax.md, guides/cli_effects_reference.md, docs/world/entities/guides.index.md]
supersedes: null
superseded_by: null
---

# ADR-003: how-to is delegated to the EYG website, this tree documents only its own contract

## Context

A new user of this package needs two different things: how to get an EYG CLI onto their
machine, and what this package requires once they have one. The first is the language's
answer - it is published at <https://eyg.run> (guides index, `install-a-prebuilt-binary`,
`install-from-source`, `eyg-syntax-guide`, `cli-effects-reference`, `builtins-reference`,
`advanced-effects`, `effect-access-policies`; read 2026-11-18, the install pages name a
one-line installer that writes `$HOME/.local/bin` and a source build that needs Gleam >= 1.7
and Bun). Reproducing those steps in the README puts the same fact in two places, and the
copy is wrong the day the site changes - the trap that covers "a fact in two places drifts".

## Decision

The README states **only this package's contract** - what has to be true on your machine
(a runner that accepts `--policy`), where the tool looks for it (the three places, in order,
with `EYG_CODEMODE_RUNNER` first), what the probe accepts, and what is UNVERIFIED until such a
runner runs here - and links the website for every step of getting the CLI. Install commands
are not quoted in the README. The offline copies in `guides/` stay in the tree as a mirror for
a session that cannot load a page, and are labelled as copies with the date they were taken,
never presented as current instructions.

## Alternatives rejected

- **Reproducing the install steps in the README:** one more copy of a moving fact, and the
  README is the file most likely to be read by a new user, so it drifts first.
- **Deleting the offline guide copies:** the world model's `sources` and several claim verify
  commands read those files, and a session with no network would lose the effect and syntax
  reference mid-task. Keeping them as labelled mirrors keeps the claim honest ("copied 2026-11-18").
- **Pointing only at the language workspace's copies:** that repository is not on a new user's
  machine, and a path into it is one more thing that does not resolve.

## Consequences

+ A new user follows one authoritative, current source for the language; this README stays
  short and stays about the gate.
+ The copies remain useful offline, and their staleness window is dated on their face.
- Two documents describe the same how-to, so a guide copy and its page can disagree; the
  README says which one wins (the website), and `docs/world/traps.md` carries the trap.
- This package's claims still verify against the local copies (`guides/install_prebuilt.md`
  and friends), because those files are the local, checkable artefact - the README does not
  have to be the place that carries them.
