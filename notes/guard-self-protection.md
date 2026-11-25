---
name: guard-self-protection
description: Why the guard, not a policy, refuses writes to the package's own `host/` and `policies/`; why the tool names those paths in `ctx`; why reads stay open; and what the fix deliberately leaves open
date: 2026-11-23
---

A session run inside this package gets this package as its roots, and the per-call entry
imports `host/guard.eyg` and the policy module by absolute path inside that same tree. So
before this note, a program in such a session could rewrite the module the *next* call
imports: measured 2026-11-22 by hand-building the same files the tool writes and running them
with the installed CLI, where a new file under `policies/`, a rewrite of
`policies/deny-all.eyg` and a rewrite of `host/guard.eyg` were all performed (`git status`
showed ` M host/guard.eyg`, restored with `git checkout --`). The fixture that re-runs the
attempt is `test/fixtures/self-write-probe.eyg`; boundary fact 6 of
`docs/world/entities/host.guard-boundary.md` carries the command.

**The check is in the guard, not in a policy.** A policy is one of the things being
protected, and the operator can point the tool at a policy of their own (`eyg.policy`,
`EYG_POLICY`, a grant). A rule in `policies/agent-roots.eyg` would leave every other policy
open, and a grant that adds a root would open the protected paths in whatever policy is in
force. `shield` in `host/guard.eyg` runs before the rule for the four change effects, so the
refusal is the same under every policy and no grant opens it. The refusal text says
`denied by the host` rather than `denied by policy` so a program can tell the two apart and
does not ask for a grant that cannot help.

**The tool names the paths; the guard does not know the package layout.** A module imported
by the entry evaluates before any handler is installed and can perform nothing, so the guard
cannot ask where it lives, and `ctx.cwd` is the program's working directory, not the
package's. `hostProtectedPaths` in `lib/render-helpers.mjs` therefore turns the package
directory the extension already resolved into `<package>/host` and `<package>/policies`, and
adds the resolved policy module itself when it sits outside the package - by file, not by its
directory, so an operator's policy directory stays theirs.

**Reads stay open.** A program is meant to read the guard and the policies: that is how it
learns what it may ask for, and a read changes nothing. Shielding reads would also break the
`guides/` instruction to read the policy before writing a program.

**Why not the alternatives.** Copying the guard and the policy into the per-call scratch
directory and importing the copies stops a swap *during* a call and nothing else: the tool
re-reads both files from the package for every call, so a rewrite still takes effect on the
next one. Refusing to run when the resolved roots cover `host/` or `policies/` is louder but
refuses the default session in this very workspace, which is where the package is developed.
Hashing the two files detects a rewrite after it happened.

**What stays open, on purpose.** pi's own tools are not decided by a policy: an operator
session in this tree can edit `host/guard.eyg` with them, and that is the operator editing
their own package, which is the point. `extensions/` and `lib/` are not in the protected
list either: nothing in the guarded chain imports them, so a change there reaches a later
session through pi's package load rather than through the guard - package integrity is pi's
question, not this guard's. Trigger to widen the list to the whole package directory: a
deployment where an EYG program is the only channel a session has into a tree that contains
an installed copy of this package. The sibling rule of the same boundary - a program may not
handle an effect for itself - is in `notes/one-host-per-call.md`.
