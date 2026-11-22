---
name: the README is an overview and the package's own reference sits in one guides page
description: Why the README stopped carrying the tool's knobs, rows, probes and captures, and why that content went to one page (guides/tool-reference.md) instead of a Diátaxis re-layout of guides/.
date: 2026-11-19
---

The README grew to 422 lines whose middle sections were reference: the knobs table, the
environment table, the policy vocabulary, the probe surface, the row rendering, the two
verbatim captures and the rule that marks them. A reader installing the package pays that
wall before their first command, while the reader at work (the model, or an agent in this
repo) pays it every time. The audit's decision (ADR-004) is that the README is an overview
and the reference lives where a reader at work reads it.

**One page, not a re-layout.** `guides/tool-reference.md` is a new file this package writes,
and it holds the whole middle of the old README nearly as it was written. The alternative -
split it across pages named by Diátaxis kind - was rejected in the same commit the audit
landed in: the world-model lint requires a claim id to equal its filename stem, so moving
pages moves ids, pointers and verify commands; and the two `guides/install_*.md` files would
stop being mirrors of the website's pages and stop being checkable against them. A page this
package writes carries no "copied from the language repository" note, so the mirror record in
`guides/pi_codemode_agent.md` and `guides/cli_effects_reference.md` stays the only such note
in `guides/`, and `guides/PURPOSE` says which set each file belongs to.

What stays in the README is what only the README can carry: what the package is, who reads
it, the words a reader cannot look up elsewhere, the one fact that has to be true on their
machine (no published release build knows the flag that carries a policy, and the README says so),
what the package installs, and the pointer to `AGENTS.md`'s command table. Everything else is
a link.

**What it costs.** A session that reads only the README now reads one more file, and every
how-to page links the reference so the cost is paid once per question rather than once per
README read. Two claim verifies (`ADR-002-handler-seam`, `traps.md` trap-04) grepped strings
that moved, so their targets moved in the same commit - `docs/world/traps.md` carries the
command that catches the next one.

Trigger to revisit: a reader who cannot find the reference they need, or a second package that
wants the same split - then the reference pages become a published set rather than a file per
package.
