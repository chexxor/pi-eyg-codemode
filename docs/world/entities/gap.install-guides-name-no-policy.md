---
id: gap.install-guides-name-no-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "grep -q -- '--policy' guides/how-to-point-the-tool-at-your-runner.md && grep -q -- '--policy' README.md && grep -q 'install-a-prebuilt-binary' README.md"
confidence: high
sources: [docs/world/entities/cli.runner-official-install-only.md, guides/how-to-point-the-tool-at-your-runner.md, README.md, docs/world/decisions/ADR-003-doc-delegation.md]
supersedes: null
superseded_by: null
---

# Gap: no install page says what this package needs from the CLI

Neither install page at <https://eyg.run/guides> - `install-a-prebuilt-binary` and `install-from-source`, the index read again on 2026-11-22 - mentions `--policy`; the copies this tree carried of them answered `0` for that string (2026-11-19) and are deleted now. Both pages verify only `eyg eval -c '!int_add(1, 1)'`, which passes on a CLI this package rejects. So a new reader can finish an install guide "successfully" and still have nothing this package can start.

## What to do about it

The half this tree owns is closed: two pages carry the requirement and its check.
`guides/how-to-point-the-tool-at-your-runner.md` starts from a binary you have and ends with the
tool finding it, quoting the one line a call ends with when the binary does not know the flag;
README.md's install section states the check to run before believing an install worked, and names
the page a reader should be on. Nothing in this tree copies those pages any more, so there is no
second install text here to drift.

Upstream, the same gap sits in the language's install pages: their verify step proves the binary
runs (`eyg eval -c '!int_add(1, 1)'`), not that it knows `--policy`. Filing it there is the
operator's, since this tree does not write to the language repository. Trigger: the next time one
of those website pages is edited.

## Not this

The install pages are not wrong about the language: they produce a CLI that evaluates. The gap is the extra requirement this package adds, which those pages do not carry. It is not about the
copies going stale - the copies are gone, and ADR-003 says the website wins.
