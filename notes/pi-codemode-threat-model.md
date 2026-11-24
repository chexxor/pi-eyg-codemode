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
| a mis-shaped ask for any effect | **open** as to the answer, **bounded** as to the time | measured 2026-11-23 in this note's own probes: inside the guarded entry `perform ReadFile({path: "nope.txt"})` (no `offset`) printed nothing for 20 s and `perform Sleep("x")` aborted with a stack of `host/guard.eyg` lines 638-644; direct `eyg run` of the same text errors in 0.08 s. The bound is the tool's spawn timeout (`pi.exec` at `extensions/eyg-codemode.ts:489`, `timed out after N s` at `:1061`) |
| credential reach: the process environment | **holds** | `env` answers `Mock(None({}))` in `policies/agent-roots.eyg`; probed 2026-11-23: `perform Env("PATH")` came back `env answered None` under the shipped policy |
| credential reach by file spelling (`.env.eyg`) | **holds** for that spelling, **open** for any other | `hide_secrets` is a name test on `.env.eyg`; probed 2026-11-23: a file named `id_rsa` under the roots was read (`READ A SECRET-SHAPED FILE`). A policy that wants a directory secret-free must name the directory, not the extension |
| the network (`fetch`) | **holds** under the shipped policies, **open** for an operator policy that allows it | measured 2026-11-24: `node bin/agent/refusal-probe.mjs --program test/fixtures/fetch-probe.eyg` answers `fetch denied by policy` under `agent-roots` and under `deny-all` (`fetch: refuse("fetch")` in both), while the same program under a copy of the shipped policy with `fetch: pass` - written by `node test/fixtures/fetch-operator-policy.mjs open` - answers `FETCH LANDED` and `test/fixtures/fetch-listener.mjs` logs `GET /sent`, so the bytes left the process. A host-pinned copy answers `fetch denied by policy: 127.0.0.1`, so the pin recipe holds against loopback; the token recipe wrapped over `pass` puts the policy's `Authorization` header on whatever host the program asks for, and the same rule wrapped over the pin refuses it. Seven legs, 3.2 s: `docs/world/entities/pi.fetch-and-injection-exfiltration.md` |
| `standard_in`, `create_key` | **holds** | measured 2026-11-24 with two fixtures that use the tool's own probe argument shapes (`NO_PATH_PROBE_ARGUMENTS` in `lib/render-helpers.mjs`, `Eddsa({})` for `CreateKey`) so the ask reaches the rule instead of the runtime's shape check: `node bin/agent/refusal-probe.mjs --program test/fixtures/standard-in-probe.eyg` and `--program test/fixtures/create-key-probe.eyg`, each under `--with-policy agent-roots` and under `--with-policy deny-all`, answer `refused: standard_in denied by policy` and `refused: create_key denied by policy`, `exit=0` - four runs, all refused, 0.2 s each |
| writing a helper that a later call runs (persistence between calls) | **open**, **bounded** as to reach | `docs/world/entities/pi.registry-scope-persistence.md`, measured 2026-11-24: the plant lands (`PLANTED IN REGISTRY SCOPE`), the next call lists it with the writer's own `signature` and `description` printed verbatim, and a call that names it in `libraries` runs the planted code **inside** the guard, where its own effects are decided again (`inside: landed`, `outside: read_file denied by policy`); its `verify` runs the plant, the tool's own registry walk and the bound call in 0.43 s. What is planted is code, a name and listing text, not reach: the scopes are not shielded - `ctx.protected` covers only `host/` and `policies/` (`hostProtectedPaths`, `lib/render-helpers.mjs:326`) - and nothing under `.pi/` is gitignored, so a planted module is a committable artifact. A module planted in a scratch `$HOME` was offered as `[home]` to a walk over an empty workspace; the real home is UNVERIFIED, which has no such directory and no probe wrote there. |
| a subagent's surface (the spawned session's effects, roots, depth) | **holds** | `policies/spawner-effects.eyg` plus the audit's `refusals the shipped policies owe` row, which shows `write_file denied by policy: EYG_SUBAGENT_EFFECTS=...` |
| the grant loop as a vector on the operator's attention | **recorded, not bounded** | `docs/world/entities/pi.session-grants.md`: the ask is text read off the run's output, so a refusal prints an ask whether or not opening the path helps |
| time and space a call may spend | **bounded** | the tool caps the spawn: default 30 s, cap 120 s, `EYG_CODEMODE_TIMEOUT` in ms (`AGENTS.md`'s env row); `sleep`, `now`, `random`, `standard_out` are `pass`, so the cap is the whole answer - and the mis-shaped ask above shows a call reaching it without printing anything |
| an imported module the call did not author, performing effects (a published package) | **holds** as to reach, **not probed** for one installed through the language's package manager | `node bin/agent/refusal-probe.mjs --roots $t --program test/fixtures/registry-bind-probe.eyg` runs a module the model only named in `import`, and the effect inside it answers `inside: landed` and `outside: read_file denied by policy` - the chain in `docs/world/entities/pi.registry-scope-persistence.md`'s `verify`. What no probe here can answer is the install route itself: the only published scope installed on this host has no effect-calling code, so that half is UNVERIFIED in `docs/world/entities/host.guard-boundary.md` |
| path spellings the sweep does not cover: case-insensitive and Unicode-normalized names, trailing dots and spaces | **holds** byte-exact on this host, **open** for the secret spelling, **not probed** on a folding filesystem | measured 2026-11-24 by `node bin/agent/refusal-probe.mjs --roots $t --program test/fixtures/spelling-probe.eyg`, which writes and reads six spellings of one name inside a scratch root: `.env.eyg` -> `read_file denied by policy`, while `.ENV.EYG`, `.env.eyg.`, `.env.eyg ` and both encodings of `café.txt` (the precomposed `195 169` and the `e` plus combining acute `101 204 129`, built from bytes in the fixture) all answer `read landed` - `hide_secrets` (`policies/agent-roots.eyg:136`) is a suffix test on the exact path text, so it covers one spelling of a secret name. The two `café` spellings are two files here (`ls -b` shows both), so nothing normalizes: on a filesystem that folds case or composes names, the guard's comparison and the file's identity disagree about which file was decided - UNVERIFIED, because ext4 folds nothing and this tree reaches no mounting that does |

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

The `fetch` row is measured now, and it lands where the rating predicted: the shipped policies
close it, and an operator's copy of one opens it in a single well-shaped effect, so its fix is a
policy decision rather than a language ask - pin a host or keep the row refused. The injection half
of that route is two sessions of one model that did not take the bait (n=2, zero requests), which
is evidence about a model, not a bound on the package.

## What this note is not

The rules themselves - `docs/world/entities/host.guard-boundary.md`,
`docs/world/entities/codemode.effect-surface.md`, `policies/agent-roots.eyg`; the per-vector hole
records, which are the ones a `verify` command re-runs; and the grant mechanism, which is
`docs/world/entities/pi.session-grants.md`. This note joins them and adds two runs of its own: the
`env` and secret-spelling probes above, and the two mis-shaped asks.
