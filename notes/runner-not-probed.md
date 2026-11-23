---
name: runner-not-probed
description: Why the tool stopped asking the binary what it can do before running it, what that costs (one wasted spawn per capability question, detection by the runner's own output), and what the alternative would have promised
date: 2026-11-23
---

*(This replaces the probe half of `notes/pi_codemode_runner_probe.md`, which argued the opposite
from inside the language repository; that note's other two trade-offs - roots unset, and where the
context-budget package lives - still stand. It also continues `notes/official-installed-runner-only.md`,
which cut the candidate list to two names.)*

**Asking the binary in advance is a promise about versions.** The tool used to run
`<candidate> --help` once per session and keep the first candidate whose help mentioned `--policy`.
That looked like the cheapest honest test that the checks exist, and it was, at a price: it makes
the tool's behaviour depend on which flags a particular build advertises, so a version bump can
silently change which binary a session runs, and a build that *implements* the gate without
advertising it in help text is refused. It also put a second decision - "is this a runner?" - next
to the one decision the package is supposed to make: "what does the policy say about this effect?"

**What the tool does instead.** Every command line it builds is `<binary> <mode> <entry.eyg>`: one
file this package writes, importing the guard, the policy and the program (`runGuarded` in
`extensions/eyg-codemode.ts:465`), with the binary chosen by name only - `EYG_CODEMODE_RUNNER`, else
`eyg` on `PATH`. Nothing is asked of the binary beforehand, so the checks are not a flag a build may
or may not advertise; they are a module the entry imports. A binary with no command for the mode word
says so itself - it reads `run` as a file name and answers `error: no such file: <cwd>/run` - and
`runnerFailureLine` in `lib/render-helpers.mjs` turns that
into one line naming the install. `docs/world/entities/cli.runner-official-install-only.md` carries
the run, and the unit test pins the line against that recorded output and against an `ENOENT`.

**The cost, stated.** A capability question costs one spawn before it can be answered:
`action: "effects"` starts one probe program, and only when that run fails in one of the two ways
`runnerFailureLine` knows does the call stop instead of printing the same sentence once per effect. The
same holds for the spawner's effect allowlist, which asks the policy in force by running probe
programs of its own. And detection is by output shape, not by a flag in the runner's contract: a
future build that fails differently would print its own error and the install line would not appear.
The shape is pinned by a test precisely so that a change in the runner's wording fails the suite
rather than quietly removing the advice.

**Why not a version check instead.** A version comparison would be a table this package has to
update for every release, and it would be wrong for a binary built from an unnamed ref - which is
the only kind of binary that can carry the flag today. Reading what the binary did is one rule with
no table.
