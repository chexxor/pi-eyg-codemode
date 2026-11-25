---
name: pi-codemode-threat-model
description: The one place the package's security answers are grouped by mechanism and rated per attack vector, each row naming the minimal attempt, what decides it, and the command that shows the rating
date: 2026-11-24
---

# The vectors, grouped by what they attack, and where this implementation sits on each

The question this note answers is "list the attack vectors, analyze them, and show where the
implementation rates along them". Nothing here was such a list before: the boundary facts, the
gap records and the refusal probes exist per mechanism, and no page joined them into vectors. This
note is the join; each row's evidence lives on the page the row names, with a command that re-runs.

A rating is one of four words, used the same way in every row:

- **holds** - a probe shows the boundary refusing, and the code that refuses it is quoted on that page;
- **open** - a probe shows it reaching, and the record naming the hole carries the run;
- **bounded** - it reaches, but a parameter caps the cost (the cap is named in the row);
- **not probed** - the row is reasoning from the code, with no run. Nobody has run this vector.

**The minimal attempt** column is the smallest well-shaped try that exercises the row: one line a
reader can type, or the fixture that holds that line. **What decides it** names the thing that says
no - the CLI's own check, the CLI's lack of a host, a guard rule, a policy field, the host shield
that runs before any policy, the tool's spawn cap, or the operator.

Paths in the probes are written as `<pkg>` for this package and `/work` for any other tree: the
audit's tracked-path sweep greps tracked files for a real home-directory shape and fails on one.

## A. Paths and roots - what a path reaches

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| escape the roots by path text (`..`, an absolute path) | `perform WriteFile({ path: "../outside", contents: ... })` | the guard resolves the path, then the policy's `write_file` field | **holds** | `absolute` (`host/guard.eyg:165`) collapses `.` and `..` before any rule sees the path; `node bin/agent/refusal-probe.mjs` answers `write_file denied by policy: /tmp/...` |
| escape the roots through a symlink standing inside a root | `test/fixtures/symlink-read-probe.eyg`, `symlink-write-probe.eyg`, `symlink-directory-probe.eyg` run with `--roots` at the link | nothing: the guard decides the link's own path text and the host follows it | **open** | `docs/world/entities/gap.symlinks-escape-the-roots.md` - read, write, directory listing and the `Search` walk all follow the link; its `verify` runs the three probes in a temporary directory and goes red when the hole is closed |
| change the files that decide the call (`host/`, `policies/`) | `test/fixtures/self-write-probe.eyg` with `--inside-roots` | the host shield, before the policy is consulted | **holds** against path text, **open** through a link | boundary fact 6 of `docs/world/entities/host.guard-boundary.md`: four `denied by the host` answers, `test ! -e` on both targets; the shield compares path text, so the link route above reaches the same directory |
| credential reach by file spelling (`.env.eyg`) | `test/fixtures/secret-probe.eyg` with `--inside-roots` | the policy's `read_file` field, wrapped in a name test | **holds** for that spelling, **open** for any other | `hide_secrets` (`policies/agent-roots.eyg:136`) is a suffix test; probed 2026-11-23: a file named `id_rsa` under the roots was read (`READ A SECRET-SHAPED FILE`) |
| the other spellings of that secret name: case, Unicode composition, a trailing dot or space | `test/fixtures/spelling-probe.eyg` writes and reads six spellings of one name | the same suffix test, on exact bytes | **holds** byte-exact on this host, **open** for the secret spelling, **not probed** on a folding filesystem | measured 2026-11-24: `.env.eyg` is refused while `.ENV.EYG`, `.env.eyg.`, `.env.eyg ` and both encodings of `café.txt` all answer `read landed`; the two `café` spellings are two files on ext4, so nothing normalizes here - UNVERIFIED on a filesystem that folds or composes, which this tree reaches no mount of |

## B. The guard's own surface - what decides an ask

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| invent an effect the language does not offer, host it yourself, and reach a command line | `perform Bash({ command: "id" })`, then the same with a `handle Bash` clause: `test/fixtures/invented-effect.eyg` and `test/fixtures/invented-effect-handler.eyg` | the CLI's type check, then the CLI's lack of a host for the label | **holds** | `docs/world/entities/host.closed-effect-set.md`; `node bin/agent/invented-effect-probe.mjs` prints five rows - `check`, `run`, `clause`, `decline`, `guarded` - all `holds`, 0.55 s (`@measured 2026-11-24`), and a planted stand-in that runs turns three of them `DRIFT` |
| a label the guard does not name, reaching the host ungarded | `perform Foo({})` (`test/fixtures/unnamed-effect.eyg`) | the guard names one clause per effect row; the CLI has no host for a label outside that set | **holds** | `test/host-coverage.test.mjs` compares the guard's clauses with the 23 effect rows of `guides/eyg-surface.tsv`; a label no host has stops the run with `unhandled effect Foo` |
| a program that hosts its own effects instead of asking the host (`handle`) | `test/fixtures/inner-handler.eyg` (a clause inside the guarded body); `test/fixtures/imported-handler.eyg` (one inside an imported module) | the tool's parse of the text it assembles; then the guard, for a clause it cannot see | **holds** for the text a call passes in, **open** for a module that text imports | fact 7 of `docs/world/entities/host.guard-boundary.md` and `docs/world/entities/gap.one-host-check-not-transitive.md`; `node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg` prints `ReadFile` and the same on the imported program prints nothing; the reasoning is `notes/one-host-per-call.md` |
| an effect at module top level, or import-time configuration | an `perform ReadFile(...)` at the top of an imported module | the CLI: a top-level effect has no host at all | **holds** (fail-closed) | fact 4 of `docs/world/entities/host.guard-boundary.md`: `unhandled effect` guard or no guard, so a module cannot pre-configure a way out |
| a mis-shaped ask for any effect | `perform MakeDirectory({ path: "eyg-misshaped-ask" })` - a record where the effect wants a `String` (`test/fixtures/misshaped-ask.eyg`) | the guard's handler chain, and then the tool's spawn cap | **open** as to the answer, **bounded** as to the time | measured 2026-11-24 through `.ai-work/security-docs/probes/stall-diagnose.mjs`: `MakeDirectory` and `DeleteFile` given a record and `ReadFile` given a bare string each printed **0 bytes** and ran to the full 15-20 s cap, 8 such runs, and no file was created; the same programs outside the guard error in 0.085 s with `unexpected term, expected: String got: {path: ...}`, and `!string_starts_with`, `!string_split`, `!string_append` reject the same value in 0.06-0.09 s, so it is not a builtin - UNVERIFIED as to the looping construct inside the guard. The bound is the tool's spawn timeout (`pi.exec` at `extensions/eyg-codemode.ts:489`, `timed out after N s` at `:1061`) |

## C. Effects that reach nothing outside the program's own bytes

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| the four effects no policy field can refuse (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) | `perform Hash("x")` | the CLI hosts them; no policy field exists | **bounded**, reach-wise | they take and return values only - `test/fixtures/rule_mapping.gleam` prints them as `policy.Unchecked`, and `with_hash` (`host/guard.eyg:619`) re-performs without asking the policy; a well-shaped ask answers in 0.2 s |
| credential reach: the process environment | `perform Env("PATH")` | the policy's `env` field | **holds** | `env` answers `Mock(None({}))` in `policies/agent-roots.eyg`; probed 2026-11-23: `env answered None` under the shipped policy |
| the network (`fetch`) | `test/fixtures/fetch-probe.eyg` | the policy's `fetch` field - under the shipped policies, the operator's own copy of a policy otherwise | **holds** under the shipped policies, **open** for an operator policy that allows it | measured 2026-11-24: refused under `agent-roots` and under `deny-all` (`fetch: refuse("fetch")` in both); the same program under a copy with `fetch: pass` answers `FETCH LANDED` while `test/fixtures/fetch-listener.mjs` logs `GET /sent`, so the bytes left the process; a host-pinned copy refuses `127.0.0.1`. Seven legs, 3.2 s: `docs/world/entities/pi.fetch-and-injection-exfiltration.md` |
| `standard_in`, `create_key` | `test/fixtures/standard-in-probe.eyg`, `test/fixtures/create-key-probe.eyg` | the `standard_in` and `create_key` fields | **holds** | four runs (both fixtures, both shipped policies) answer `refused: standard_in denied by policy` and `refused: create_key denied by policy`, 0.2 s each; the fixtures use the tool's own probe argument shapes (`NO_PATH_PROBE_ARGUMENTS` in `lib/render-helpers.mjs`, `Eddsa({})`) so the ask reaches the rule and not a shape check |

## D. Persistence and delegation - code and sessions that outlive the call

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| write a helper that a later call runs | `test/fixtures/registry-plant-probe.eyg` writes into `<cwd>/.pi/eyg-functions`, then a call names it in `libraries` | the guard again, for the planted code; nothing at all, for the plant itself | **open**, **bounded** as to reach | `docs/world/entities/pi.registry-scope-persistence.md`: the plant lands, the next call lists the writer's own `signature` and `description` verbatim, and the planted code runs **inside** the guard (`inside: landed`, `outside: read_file denied by policy`). What is planted is code and listing text, not reach; the scopes are not shielded - `ctx.protected` covers only `host/` and `policies/` (`hostProtectedPaths`, `lib/render-helpers.mjs:326`) - and nothing under `.pi/` is gitignored. A module planted in a scratch `$HOME` was offered as `[home]`; the real home is UNVERIFIED, has no such directory, and no probe wrote there |
| an imported module the call did not author, performing effects | `test/fixtures/registry-bind-probe.eyg` names a module in `import` | the guard, once the module's effect is performed | **holds** as to reach, **not probed** for one installed through the language's package manager | the same chain answers `inside: landed`, `outside: read_file denied by policy`. No probe here can answer the install route: the only published scope installed on this host has no effect-calling code, so that half is UNVERIFIED in `docs/world/entities/host.guard-boundary.md` |
| a subagent's surface (the spawned session's effects, roots, depth) | an `eyg_subagent` call asking for a root or an effect the spawner lacks | `policies/spawner-effects.eyg`, plus the tool's own bounds on roots, tools and depth | **holds** | the audit's `refusals the shipped policies owe` row shows `write_file denied by policy: EYG_SUBAGENT_EFFECTS=...`; `docs/world/entities/pi.spawner-policy.md` and `docs/world/entities/pi.subagent-spawn.md` |
| the grant loop as a vector on the operator's attention | refuse one probe under a root that would not have helped anyway | the operator, who runs `/eyg-grant` | **recorded, not bounded** | `docs/world/entities/pi.session-grants.md`: the ask is text read off the run's output, so a refusal prints an ask whether or not opening the path helps |

## E. Time and space a call may spend

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| run long, print nothing, hold the session | `perform Sleep("x")`, or the mis-shaped ask in family B | the tool's spawn cap | **bounded** | default 30 s, cap 120 s, `EYG_CODEMODE_TIMEOUT` in ms (`AGENTS.md`'s env row); `sleep`, `now`, `random`, `standard_out` are `pass`, so the cap is the whole answer - and the mis-shaped ask shows a call reaching it without printing anything |
| write or read without bound inside the roots | `perform WriteFile` in a loop under the cwd | the roots, and the same spawn cap | **bounded** | the same cap; nothing else limits a call that stays inside its roots, which is what a root grant means |

## The open rows, and the next step for each

| open row | the next step | cost | trigger |
| --- | --- | --- | --- |
| the symlink route (A) | one of the three shapes on `docs/world/entities/gap.symlinks-escape-the-roots.md`: resolve the path in the guard before the rule sees it (needs a `stat`/`realpath`-like effect the language does not have), resolve the roots and the shield in the tool before it writes `ctx`, or refuse a path whose final component is a link. **This is the operator's decision**; probes keep running around it | one guard or tool change plus a re-run of the gap record's `verify`; the language half is an upstream ask | the operator's choice, or a release that carries a path-resolving effect |
| the secret spelling (A) | a directory-scoped rule written out whole - name the directory the secrets live in and refuse every path under it, instead of a suffix test on one extension | a rewrite of `policies/agent-roots.eyg` in full, one handler per effect, `agent-roots` narrowed only; ~1 s of probes to prove it | the next policy change to this file |
| the other spellings of a secret name (A) | the same directory-scoped rule, since it stops being a name test at all | as above | follows the row above |
| a mis-shaped ask (B, E) | name the looping construct inside the guard's chain, then make the tool say the cause and point at `guides/eyg-surface.tsv` instead of timing out | a diagnosis (probes are `.ai-work/security-docs/probes/`) plus a tool-side message and a timed before/after run | already measured this goal; the fix is `task-ux-misshaped` of the same goal |
| an imported module's `handle` clause (B) | a `parse` or `check` that reports the handler labels of a program *and of the modules it imports*, which is the language's half; this package's half is stating the bound where a reader will hit it | an upstream ask; the bound is already written | the trigger on `docs/world/entities/gap.one-host-check-not-transitive.md` |
| a planted registry module (D) | state the reach bound in the tool's own listing - a workspace or home entry labelled as such - and leave the plant refused only by the guard | a listing change plus a grep over the script's source | `task-ux-onboarding` of this goal |
| an operator policy that allows `fetch` (C) | pin a host in the policy, or keep the row refused | a policy decision, not a code change | the first operator who wants `fetch` allowed |
| the grant loop (D) | bound a grant's lifetime, and prove a multi-call grant live - the live proof needs one `/eyg-grant` run from the operator | one operator action; the bound is a tool change | `docs/world/entities/gap.grant-polish-undecided.md` |

## What the ratings mean for the next fix

One **open** row costs reach: the symlink route (read outside every root, write outside every root,
write under the shielded paths, which is what the next call's rules are made of). It needs a
question the language does not answer today - what a path *is*, or what a directory holds - so it is
a design decision and the operator's; the three shapes and their costs are on the gap record. The
secret-spelling rows next to it need no answer from the language at all: a rule that refuses every
path under a named directory instead of testing one extension closes all four spellings at once,
which is why they rate as policy work and not as an upstream ask.

Three **open** rows cost the honesty of a run's answer rather than its reach: an imported module's
`handle` clause, a mis-shaped ask stalling the call instead of erroring, and the fabrication a
program can produce in plain code. They do not widen what a policy allows, so they rate below the
reach rows, and they are what a report to the operator can lose.

The `fetch` row lands where its rating predicted: the shipped policies close it and an operator's
copy of one opens it in a single well-shaped effect, so its fix is a policy decision rather than a
language ask - pin a host or keep the row refused. The injection half of that route is two sessions
of one model that did not take the bait (n=2, zero requests), which is evidence about a model, not
a bound on the package.

## What this note is not

The rules themselves - `docs/world/entities/host.guard-boundary.md`,
`docs/world/entities/codemode.effect-surface.md`, `policies/agent-roots.eyg`; the per-vector hole
records, which are the ones a `verify` command re-runs; the grant mechanism, which is
`docs/world/entities/pi.session-grants.md`; and the answer to the invented-effect question, which is
`docs/world/entities/host.closed-effect-set.md`. This note joins them and adds runs of its own: the
`env` and secret-spelling probes, the mis-shaped asks, and the invented-effect rows.
