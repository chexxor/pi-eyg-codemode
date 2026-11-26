---
id: gap.install-guides-name-no-policy
type: entity
owner: delegate
status: superseded
verified_at: 2026-11-26
verify: "grep -q 'install-a-prebuilt-binary' README.md && node bin/agent/doc-checks.mjs mirrors > /dev/null && grep -qF 'export function entryProgram' lib/render-helpers.mjs && ! grep -rq -- '--pol' README.md guides/ skills/ extensions/ lib/"
confidence: high
sources: [docs/world/entities/cli.runner-official-install-only.md, guides/how-to-point-the-tool-at-your-runner.md, README.md, docs/world/decisions/ADR-003-doc-delegation.md, docs/world/decisions/ADR-006-guard-in-package.md]
supersedes: null
superseded_by: cli.runner-official-install-only
---

# Gap closed: what the language's install pages prove is now enough

This page recorded the hole: neither install page at <https://eyg.run/guides> -
`install-a-prebuilt-binary` and `install-from-source`, the index read again on 2026-11-22 - said
anything about loading a policy module, and both verify only that the binary runs a program
(`eyg eval -c '!int_add(1, 1)'`). That was a gap because this package needed more than the pages
guaranteed: a new reader could finish an install guide "successfully" and still have nothing this
package could start.

It closed on 2026-11-22 from this side: the per-effect checks live in `host/guard.eyg`, so the one
thing this package needs from an installed CLI is what the install pages already prove - a binary that
runs a file (`docs/world/decisions/ADR-006-guard-in-package.md`,
`docs/world/entities/cli.runner-official-install-only.md`). The command above checks the opposite of
what it used to: it passes because no page in this tree asks for more of the CLI than "run this file",
and because `guides/` still links the install pages instead of copying them
(`docs/world/decisions/ADR-003-doc-delegation.md`).

What is left upstream is smaller than what was recorded here: the install pages describe a CLI, not a
host, so a reader who wants per-effect checks still has to be told where they come from - in this
package's docs, not the language's. Trigger to reopen a record about the language's pages: the language
ships a host of its own, or one of those pages is edited.

## Not this

The install pages are not wrong about the language: they produce a CLI that evaluates. What they do
not carry is the concept of a host deciding an effect, and that concept is this package's
(`docs/world/entities/host.guard-boundary.md`). It is not about copies going stale - the copies are
gone, and ADR-003 says the website wins.
