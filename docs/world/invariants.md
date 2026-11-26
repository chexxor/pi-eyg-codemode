# Invariants - what must never become false

Owner-edited only. Each entry carries a verify command that can fail.

---
id: invariant.eyg-over-bash
type: invariant
owner: human
status: current
verified_at: 2026-11-26
verify: "grep -q 'does not have an effect to run shell' AGENTS.md"
confidence: high
sources: [AGENTS.md]
supersedes: null
superseded_by: null
---

EYG is the language this package runs its agent in, and it does not have an effect to run shell
commands. Bash here is for reading the tree and for work EYG cannot express, not for doing
the work the operator asked for. A tool that spawned a shell would be a tool with no check.

---
id: invariant.notes-frontmatter
type: invariant
owner: human
status: current
verified_at: 2026-11-26
verify: "for f in notes/*.md; do grep -q ^name: $f || exit 1; done"
confidence: high
sources: [notes/pi-codemode-policy-inlining.md, AGENTS.md]
supersedes: null
superseded_by: null
---

Every note carries `name:` front-matter. A note without it cannot be found by the next
session, and an unfound decision is a decision that did not happen. There is no memory
system in this workspace.

---
id: invariant.purpose-every-dir
type: invariant
owner: human
status: current
verified_at: 2026-11-26
verify: "for d in */; do test -f ${d}PURPOSE || exit 1; done"
confidence: high
sources: [docs/PURPOSE, pi-simple-world-model/lib/world_model.mjs]
supersedes: null
superseded_by: null
---

Every top-level directory has a `PURPOSE` file, so the generated tier-0 map can name what
each one is for. The lint refuses the tree when one is missing, and both the lint and the
map read `git ls-files`, so an untracked directory is invisible to both.

---
id: invariant.policy-self-contained
type: invariant
owner: human
status: current
verified_at: 2026-11-26
verify: "! grep -q 'import \"' policies/agent-roots.eyg && ! grep -q 'import \"' policies/deny-all.eyg"
confidence: high
sources: [policies/agent-roots.eyg, policies/deny-all.eyg, notes/pi-codemode-policy-inlining.md]
supersedes: null
superseded_by: null
---

A policy module in this package imports nothing outside the package. The policy is written
out where it is used, so a session's permissions cannot change because some other
workspace moved, and the whole decision is readable in one file.
