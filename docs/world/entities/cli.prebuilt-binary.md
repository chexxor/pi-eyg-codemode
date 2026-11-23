---
id: cli.prebuilt-binary
type: entity
owner: delegate
status: current
verified_at: 2026-11-23
verify: "test -x $HOME/.local/bin/eyg && $HOME/.local/bin/eyg --version 2>&1 | grep -q 'v0\\.1\\.0' && node bin/agent/refusal-probe.mjs 2>&1 | grep -q 'write_file denied by policy: /tmp/' && node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg 2>&1 | grep -q 'unhandled effect Foo'"
confidence: high
sources: [notes/pi_codemode_runner_probe.md, docs/world/entities/cli.checked-runner-on-this-host.md, docs/world/entities/gap.install-guides-name-no-policy.md, host/guard.eyg, bin/agent/refusal-probe.mjs]
supersedes: null
superseded_by: null
---

# The CLI this workspace can reach is prebuilt, and it runs every call this package makes

`command -v eyg` answers `$HOME/.local/bin/eyg` and `eyg --version` answers
`eyg v0.1.0` (measured 2026-11-18, again 2026-11-22). That build ships as one self-contained
executable per platform installed by `install.sh` into `$HOME/.local/bin/` - it is the release
asset, not a tree build - and it ships no host that decides another program's effects: what it
offers is `handle Name(...)` inside a program, which is where this package's guard lives.

Consequences for this workspace, stated as facts:

- the CLI can **type-check** this package's modules (`eyg check policies/agent-roots.eyg` and
  friends, 0.65 s for the three policies, the library and the guard);
- the CLI **runs a guarded call**: `node bin/agent/refusal-probe.mjs` asks the same entry a session
  asks and answers `write_file denied by policy: <a temporary path>` in 0.19 s, and
  `test/fixtures/unnamed-effect.eyg` answers `error: unhandled effect Foo({})` - the refusal and the
  closed row come from `host/guard.eyg`, not from the binary
  (`docs/world/entities/host.guard-boundary.md`);
- so every effect-level number in this tree is re-runnable here, and each still names the date it
  was measured. Before 2026-11-22 the opposite held: the flag this package used to ask for existed
  only in a development build it no longer has
  (`docs/world/entities/cli.checked-runner-on-this-host.md`, superseded), and that is why the
  effect tables in the older records carry a 2026-11-20 date.

## Not this

Not the install instructions for a user who wants the language: those are on the EYG
website (<https://eyg.run/guides/install-a-prebuilt-binary>,
<https://eyg.run/guides/install-from-source>) and the README points there rather than
repeating them. The offline copies of those pages this tree carried were deleted on 2026-11-22,
with the rest of the page copies (`docs/world/entities/guides.index.md`). Vendoring a runner here
is a decision with a trigger, recorded in `AGENTS.md` ("What is not here yet": re-capture the
recorded effect surface when an installed CLI's labels differ from `guides/eyg-surface.tsv`).
