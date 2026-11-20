---
name: the self-containment rule is enforced by a sweep in the traps page, not by tooling
description: why the "no other workspace in tracked files" rule is checked by a command recorded in docs/world/traps.md rather than by an npm script or a git hook, what that costs, and the trigger that would justify tooling.
date: 2026-11-20
---

**The choice.** The rule - no tracked file names another workspace by path or by name - is now
checkable: one command, recorded as trap-01 in `docs/world/traps.md`, whose `verify` is that same
command, so the trap page carries the check and the check carries the page. It sweeps paths
(`/home/[a-z]+/`, `/Users/[a-z]+/`, `Git/[a-z]`, `C:[\]Users`, `[~]/Git`) and names in the same
pass, and filters the one legitimate exception, `.pi/settings.json`. Measured 2026-11-20: 0.01 s,
and over the tracked tree it prints only that file.

**Why not an npm script or a git hook.** The operator chose the docs-only form. A `package.json`
script or a `bin/` script is app code in this tree - it ships in the package, needs a test, and
says something about the package's surface that it does not have; a pre-commit hook is host
configuration that cannot be committed without becoming that same surface, and a hook that only
exists on one machine silently enforces nothing anywhere else. The claim set is the enforcement
this repository already has: `world_verify.mjs` runs every recorded command, traps included, so a
trap-01 failure lands in the same report as every other claim and costs nothing new to run.

**What it costs.** A human or a session has to run it - it is not wired into `npm run test` or
into a commit, so forgetting is possible and the tree drifts (it did, twice, on 2026-11-20, once
in a claim whose own `verify` spelled a name and failed the sweep it was written to satisfy).
And a pattern in prose rots quietly if nobody re-runs it: that is why the entry's `verify` is the
command itself, and why a page that carries a pattern writes every literal with a bracket
(`docs/world/traps.md`, 2026-11-20).

**Trigger to add tooling.** The first time a session commits a leak the sweep would have caught -
one named file, one commit, no argument needed - put the same command in `bin/agent/audit.sh`
alongside the other gates, and move this note's command into it.
