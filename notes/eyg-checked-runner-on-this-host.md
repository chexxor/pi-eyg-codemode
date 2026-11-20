---
name: eyg-checked-runner-on-this-host
description: Why the tool probes `.local/eyg-checked` for a runner, why the checked runner here is a symlink rather than a vendored binary, and what that does and does not prove
date: 2026-11-20
---
Three trade-offs the code states but does not argue. Measured 2026-11-20
(`docs/world/entities/cli.checked-runner-on-this-host.md`).

**A candidate inside the working directory, not a path to another workspace.** A checked runner
exists on this machine, and it is a build output of the language workspace. Naming that path in
the extension, a guide or a claim would put a machine-specific path in tracked files, which this
tree already forbids. So the tool probes `<cwd>/.local/eyg-checked`: the operator puts a symlink
or a copy there, the tree stays silent about where it came from, and the probe still decides -
a candidate without `--policy` is simply not chosen. The cost is one more thing a machine has to
set up, and a claim whose verify runs the runner fails on a machine that has not done it; that
failure is the honest answer, not a skipped check.

**Not vendored.** The runner is a single self-contained executable of about 110 MB. Vendoring it
would make this package's whole safety property depend on a binary no one here built or audited,
and would not survive the next release. A symlink is cheap, and the probe re-checks it every
session.

**What this proves, and what it does not.** The runner here reports `eyg dev` and was built from
the language workspace's non-default branch. That is enough to observe what the shipped presets
actually do - allowed, refused, and the refusal text - and it retires the sentence "no checked
call has ever been seen here". It is not evidence about the released CLI, which carries no
`--policy` (`gap.runner-release-lacks-policy`), and it is not evidence that the checks exist on
the language's default branch (`gap.policy-runner-not-on-main`).

Trigger to revisit: a release of the language CLI whose `--help` mentions `--policy`. Then delete
the `.local/` symlink, re-capture `test/fixtures/rule_mapping.gleam` as
`test/fixtures/rule_mapping.PROVENANCE.md` describes, and move `cli.prebuilt-binary` and the two
gap records in the same commit.
