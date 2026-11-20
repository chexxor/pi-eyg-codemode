---
name: checked-runner-build-script
description: Why getting a checked runner is a shell script a human runs, why it names no repository, and why it proves the artifact instead of asserting a ref
date: 2026-11-20
---
Three choices `bin/agent/build-checked-runner.sh` makes and does not argue.

**A script in `bin/`, run by a person, not an effect.** This package has no effect that starts a
shell command, and adding one to close an install gap would widen the surface the whole package
exists to narrow. So the build lives outside the gated channel: a file in the tree that an
operator runs at their own shell, next to the guide that says to run it
(`guides/how-to-get-a-checked-runner.md`). The cost is that nothing here can verify the build
succeeds on anyone's machine - the claims about it stay about the script's presence and syntax
(`bash -n`, @measured 2026-11-20), never about a build it performed.

**It names no repository.** ADR-003 makes the website the source for install steps, and
`guides/install_from_source.md` follows it by describing the build without a clone URL. A script
that hardcoded a URL would be a third copy of that fact, and the first one to drift when the
repository moves. So the operator passes `--source <checkout>` or `--clone-url <url>`, taken
from the page.

**It proves the artifact rather than naming a ref.** The checks are not on the language's default
branch (`gap.policy-runner-not-on-main`) and not in its release
(`gap.runner-release-lacks-policy`), so any ref the script hardcoded would be a guess about
another repository's branch state, dated the day it was written. Instead the script counts
`--policy` in the artifact's `--help` and then runs `test/fixtures/refusal-probe.eyg` under
`policies/deny-all.eyg`, and stops with the gap records named when either half fails - which is
the same two-step proof the README and the guide already ask of a runner, and the reason
`--ref` is an argument rather than a default.

Trigger to revisit: a language release whose `--help` mentions `--policy`. Then `--ref` becomes a
version pin the script can default to, the prebuilt route stops needing this script, and the
guide's stale trigger fires.
