---
id: ADR-003-doc-delegation
type: adr
owner: human
status: accepted
verified_at: 2026-11-23
verify: "grep -q 'eyg.run/guides/install-a-prebuilt-binary' README.md && ! grep -q 'not from this README' README.md && ! test -f guides/install_prebuilt.md && test -f guides/eyg-surface.tsv"
confidence: high
sources: [README.md, docs/world/entities/guides.index.md, guides/eyg-surface.tsv]
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
(a CLI that runs a file), where the tool looks for it (`EYG_CODEMODE_RUNNER` first, else `PATH`), what
a call answers when the binary it starts is missing, and what was UNVERIFIED while the checks lived in
a build of the language rather than here - and links the website for
every step of getting the CLI. Install commands are not quoted in the README.

**Amended 2026-11-22, and this is the half that changed.** The offline copies do not stay. What a
session with no network needs is the *surface* - builtin names, effect names, the policy field that
decides each - and that is now one generated file, `guides/eyg-surface.tsv`, whose builtin rows keep
this decision's labelling discipline (a capture, with its date and checksum in the file's own
header) and whose effect rows are re-derived from a recorded snapshot
(`docs/world/entities/guides.surface-file.md`). The prose those pages carried is not reproduced in
any form; a page this package did not write is a link, not a copy. The README-contract half of this
decision - the README states only this package's contract and links the website for the rest - is
unchanged.

## Alternatives rejected

- **Reproducing the install steps in the README:** one more copy of a moving fact, and the
  README is the file most likely to be read by a new user, so it drifts first.
- **Deleting the offline guide copies** (rejected in 2026-11-18 for these reasons, adopted on
  2026-11-22): the world model's `sources` and several claim verify commands read those files, and a
  session with no network would lose the effect and syntax reference mid-task. Both reasons went
  away the same way: the `sources` and verifies moved to the generated file and the snapshot, and
  the offline reference a session needs is rows, which the file carries, rather than prose, which it
  does not.
- **Pointing only at the language repository's copies:** that repository is not on a new user's
  machine, and a path into it is one more thing that does not resolve.

## Consequences

+ A new user follows one authoritative, current source for the language; this README stays
  short and stays about the checks.
+ The copies remain useful offline, and their staleness window is dated on their face.
- Two documents describe the same how-to, so a guide copy and its page can disagree; the
  README says which one wins (the website), and `docs/world/traps.md` carries the trap.
- *(2026-11-18)* This package's claims verified against the local copies, because those files
  were the local, checkable artefact. *(2026-11-22)* The artefact is `guides/eyg-surface.tsv` and
  `test/fixtures/rule_mapping.gleam`; a claim that greps a page copy is a claim that can only go
  stale, and every one of those verifies moved.
