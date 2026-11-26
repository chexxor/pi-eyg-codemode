---
id: notes.format
type: entity
owner: delegate
status: current
verified_at: 2026-11-26
verify: "for f in notes/*.md; do grep -q ^name: $f || exit 1; done && grep -q ^date: notes/pi-codemode-policy-inlining.md && ls notes/pi-eyg-codemode-*.md"
confidence: high
sources: [notes/pi-codemode-policy-inlining.md, notes/pi_codemode_host_gate.md, AGENTS.md]
supersedes: null
superseded_by: null
---

# Notes are this workspace's decision record

`notes/` is where trade-offs go when they are not clear from the code: one file per
subject, `name:`, `description:` and `date:` in front-matter. There is no memory system
in this workspace; a decision that is not written down did not happen.

Notes go stale. Prefer a test or a `docs/world/` claim with a `verify` command over a
note, and delete a note once the code or a guide says the same thing. A note whose subject
was about another workspace says so in its first paragraph.

A new note that is about this package is named with this package's name -
`pi-eyg-codemode-<subject>.md`. The `pi_codemode_*` and `pi-codemode-*` files are an older
short form of the same name, carried in from the language repository, where this package
lived as a directory inside it; they are left as they are because a claim `sources` list or
`test -f` check often names one.

## Not this

Not the language reference (`guides/`), and not task state: a note is a settled decision,
not a plan.
