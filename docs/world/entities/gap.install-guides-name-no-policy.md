---
id: gap.install-guides-name-no-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "! grep -q -- '--policy' guides/install_prebuilt.md && ! grep -q -- '--policy' guides/install_from_source.md"
confidence: high
sources: [guides/install_prebuilt.md, guides/install_from_source.md, README.md, docs/world/decisions/ADR-003-doc-delegation.md]
supersedes: null
superseded_by: null
---

# Gap: no install page says what this package needs from the CLI

Neither install route - the website's pages and this tree's mirrors, `guides/install_prebuilt.md` and `guides/install_from_source.md` - mentions `--policy` (both files answer `0` for that string, 2026-11-19). Both verify only `eyg eval -c '!int_add(1, 1)'`, which passes on a CLI this package rejects. So a new reader can finish an install guide "successfully" and still have nothing this package can start.

## What to do about it

The package's own contract already names the remedy in the refusal: build the current CLI and set `EYG_CODEMODE_RUNNER`. The missing piece is a page - `guides/how-to-point-the-tool-at-your-runner.md` - that starts from a working CLI and ends with the tool finding it, plus the one check that proves it (`<the binary> --help 2>&1 | grep -c -- --policy`, `0` means every call will be refused).

Upstream, the same gap sits in the language's install pages: their verify step proves the binary
runs, not that it answers for an effect. Filing it there is the operator's, since this tree does
not write to the language repository. Trigger: the next time one of those website pages is edited.

## Not this

The install pages are not wrong about the language: they produce a CLI that evaluates. The gap is the extra requirement this package adds, which those pages do not carry. It is not about the
offline mirrors being stale - they are dated copies, and ADR-003 says the website wins.
