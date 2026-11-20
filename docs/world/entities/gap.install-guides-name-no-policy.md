---
id: gap.install-guides-name-no-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "grep -q -- '--policy' guides/how-to-get-a-checked-runner.md && grep -q -- '--policy' guides/how-to-point-the-tool-at-your-runner.md && ! grep -q -- '--policy' guides/install_prebuilt.md && ! grep -q -- '--policy' guides/install_from_source.md"
confidence: high
sources: [guides/install_prebuilt.md, guides/install_from_source.md, guides/how-to-get-a-checked-runner.md, guides/how-to-point-the-tool-at-your-runner.md, README.md, docs/world/decisions/ADR-003-doc-delegation.md, notes/checked-runner-build-script.md]
supersedes: null
superseded_by: null
---

# Gap: no install page says what this package needs from the CLI

Neither install route - the website's pages and this tree's mirrors, `guides/install_prebuilt.md` and `guides/install_from_source.md` - mentions `--policy` (both files answer `0` for that string, 2026-11-19). Both verify only `eyg eval -c '!int_add(1, 1)'`, which passes on a CLI this package rejects. So a new reader can finish an install guide "successfully" and still have nothing this package can start.

## What to do about it

The half this tree owns is closed as of 2026-11-20: two pages carry the requirement and its check. `guides/how-to-point-the-tool-at-your-runner.md` starts from a working CLI and ends with the tool finding it; `guides/how-to-get-a-checked-runner.md` starts from nothing, names the four places the tool probes, and points at `bin/agent/build-checked-runner.sh`, which a person runs (`notes/checked-runner-build-script.md`). The mirrors still answer `0` for `--policy`, which is correct: they are dated copies of the website's pages and ADR-003 says the website wins.

Upstream, the same gap sits in the language's install pages: their verify step proves the binary
runs (`eyg eval -c '!int_add(1, 1)'`), not that it answers for an effect. Filing it there is the
operator's, since this tree does not write to the language repository. Trigger: the next time one
of those website pages is edited.

## Not this

The install pages are not wrong about the language: they produce a CLI that evaluates. The gap is the extra requirement this package adds, which those pages do not carry. It is not about the
offline mirrors being stale - they are dated copies, and ADR-003 says the website wins.
