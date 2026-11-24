---
name: pi-codemode-threat-model
description: The one place the package's security answers are rated per attack vector: what reaches, what holds, what has not been probed, and the command that shows each rating
date: 2026-11-23
---

# The vectors, and where this implementation sits on each

The question this note answers is "list the attack vectors, analyze them, and show where the
implementation rates along them". Nothing here was such a list before: the boundary facts, the
gap records and the refusal probes exist per mechanism, and no page joined them into vectors. This
note is the join; each row's evidence lives on the page the row names, with a command that re-runs.

A rating is one of four words, used the same way in every row:

- **holds** - a probe shows the boundary refusing, and the code that refuses it is quoted on that page;
- **open** - a probe shows it reaching, and the record naming the hole carries the run;
- **bounded** - it reaches, but a parameter caps the cost (the cap is named in the row);
- **not probed** - the row is reasoning from the code, with no run. Nobody has run this vector.

Paths in the probes are written as `<pkg>` for this package and `/work` for any other tree: the
audit's tracked-path sweep greps tracked files for a real home-directory shape and fails on one.

| vector | rating | the evidence, and the command that shows it |
| --- | --- | --- |
| escape the roots by path text (`..`, absolute paths) | **holds** | `absolute` (`host/guard.eyg:165`) collapses `.` and `..` before any rule sees the path; `node bin/agent/refusal-probe.mjs` answers `write_file denied by policy: /tmp/...` |
| escape the roots through a symlink standing inside a root | **open** | `docs/world/entities/gap.symlinks-escape-the-roots.md` - read, write, directory listing and the `Search` walk all follow the link; its `verify` runs the three probes in a temporary directory and goes red when the hole is closed |
| change the files that decide the call (`host/`, `policies/`) | **holds** against path text, **open** through a link | boundary fact 6 (`docs/world/entities/host.guard-boundary.md`): four `denied by the host` answers, `test ! -e` on both targets; the shield compares path text, so the link route in the gap record above reaches the same directory |
| a program that hosts its own effects instead of asking the host (`handle`) | **holds** for the text the tool assembles, **open** for a module that text imports | fact 7 and `docs/world/entities/gap.one-host-check-not-transitive.md`; `node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg` prints `ReadFile`, the same on the imported module's program prints nothing |
| an effect at module top level, or import-time configuration | **holds** (fail-closed) | fact 4: a top-level effect answers `unhandled effect` guard or no guard, so a module cannot pre-configure a way out |
| a label the guard does not name, reaching the host ungarded | **holds** | `test/host-coverage.test.mjs` compares the guard's clauses with the 23 effect rows of `guides/eyg-surface.tsv`; a label no host has stops the run with `unhandled effect Foo` |
| the four effects no policy field can refuse (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) | **bounded**, reach-wise | they take and return values only - `test/fixtures/rule_mapping.gleam` prints them as `policy.Unchecked`, and `with_hash` (`host/guard.eyg:619`) re-performs without asking the policy; a well-shaped ask answers in 0.2 s |
| a mis-shaped ask for any effect | **open** as to the answer, **bounded** as to the time | measured 2026-11-23 in this note's own probes: inside the guarded entry `perform ReadFile({path: "nope.txt"})` (no `offset`) printed nothing for 20 s and `perform Sleep("x")` aborted with a stack of `host/guard.eyg` lines 638-644; direct `eyg run` of the same text errors in 0.08 s. The bound is the tool's spawn timeout (`pi.exec` at `extensions/eyg-codemode.ts:487`, `timed out after N s` at `:1059`) |
| credential reach: the process environment | **holds** | `env` answers `Mock(None({}))` in `policies/agent-roots.eyg`; probed 2026-11-23: `perform Env("PATH")` came back `env answered None` under the shipped policy |
| credential reach by file spelling (`.env.eyg`) | **holds** for that spelling, **open** for any other | `hide_secrets` is a name test on `.env.eyg`; probed 2026-11-23: a file named `id_rsa` under the roots was read (`READ A SECRET-SHAPED FILE`). A policy that wants a directory secret-free must name the directory, not the extension |
| the network (`fetch`) | **holds** under the shipped policies, **not probed** for an operator policy that allows it | `fetch: refuse(...)` in `policies/agent-roots.eyg`; with `fetch` open, a read of a file that carries an instruction plus a fetch of it is exfiltration, and no probe of that combination exists here |
| `standard_in`, `create_key` | **holds** offline, **not probed** | both refused by name in `policies/agent-roots.eyg`; no fixture asks them |
| writing a helper that a later call runs (persistence between calls) | **open** by construction | the workspace registry scope `<cwd>/.pi/eyg-functions` and the kept-binding scope `<cwd>/.pi/eyg-variables/` sit inside a session's roots and are not in `ctx.protected` (`hostProtectedPaths`, `lib/render-helpers.mjs:326`), which covers only `host/` and `policies/`; the home scope `$HOME/.pi/eyg-functions` runs in every workspace on the machine, and whether a session may write it is decided by its roots alone - not probed which session can |
| a subagent's surface (the spawned session's effects, roots, depth) | **holds** | `policies/spawner-effects.eyg` plus the audit's `refusals the shipped policies owe` row, which shows `write_file denied by policy: EYG_SUBAGENT_EFFECTS=...` |
| the grant loop as a vector on the operator's attention | **recorded, not bounded** | `docs/world/entities/pi.session-grants.md`: the ask is text read off the run's output, so a refusal prints an ask whether or not opening the path helps |
| time and space a call may spend | **bounded** | the tool caps the spawn: default 30 s, cap 120 s, `EYG_CODEMODE_TIMEOUT` in ms (`AGENTS.md`'s env row); `sleep`, `now`, `random`, `standard_out` are `pass`, so the cap is the whole answer - and the mis-shaped ask above shows a call reaching it without printing anything |
| a published package that performs effects, imported by the model | **not probed** | UNVERIFIED in `docs/world/entities/host.guard-boundary.md`; the guard would decide its effects, so this row is about who authored them, not about reach |
| path spellings the sweep does not cover: case-insensitive and Unicode-normalized names, trailing dots and spaces | **not probed** | the guard compares strings; a filesystem that folds them would make two rules disagree about one file, and nothing here has asked |

## What the ratings mean for the next fix

Two **open** rows cost reach and neither is a documentation hole: the symlink route (it lets a
program read outside every root, write outside every root, and write under the shielded paths,
which is what the next call's rules are made of) and the secret-spelling row (a policy that
refuses `.env.eyg` by name still reads a key file). Both are narrowings, and both need a question
the language does not answer today - what a path *is*, or what a directory holds - so the fix is a
design decision, not a patch: ask the language for a `stat`-like effect or a `realpath` builtin, or
resolve the roots and the shielded paths in the tool before it writes `ctx`. That decision is the
operator's; the three shapes and their costs are on the gap record.

Three **open** rows cost the honesty of a run's answer rather than its reach: an imported module's
`handle` clause, a mis-shaped ask stalling the call instead of erroring, and the fabrication a
program can produce in plain code. They do not widen what a policy allows, so they rate below the
two above, and they are what a report to the operator can lose.

One **not probed** row is the largest unknown by reach: an operator policy that opens `fetch`,
combined with a read of a file that carries instructions. It is the only vector where the shipped
policy is not the whole answer, and the fix for it is a policy decision rather than a language
ask, so it is the first one worth a session.

## What this note is not

The rules themselves - `docs/world/entities/host.guard-boundary.md`,
`docs/world/entities/codemode.effect-surface.md`, `policies/agent-roots.eyg`; the per-vector hole
records, which are the ones a `verify` command re-runs; and the grant mechanism, which is
`docs/world/entities/pi.session-grants.md`. This note joins them and adds two runs of its own: the
`env` and secret-spelling probes above, and the two mis-shaped asks.
