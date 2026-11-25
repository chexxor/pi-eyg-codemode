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
| escape the roots by path text (`..`, an absolute path) | `perform WriteFile({ path: "../outside", contents: ... })` | the guard resolves the path, then the policy's `write_file` field | **holds** | `absolute` (`host/guard.eyg:184`) collapses `.` and `..` before any rule sees the path; `node bin/agent/refusal-probe.mjs` answers `write_file denied by policy: /tmp/...` |
| escape the roots through a symlink standing inside a root | `test/fixtures/symlink-read-probe.eyg`, `symlink-write-probe.eyg`, `symlink-directory-probe.eyg` run with `--roots` at the link | nothing: the guard decides the link's own path text and the host follows it | **open** | `docs/world/entities/gap.symlinks-escape-the-roots.md` - read, write, directory listing and the `Search` walk all follow the link; its `verify` runs the three probes in a temporary directory and goes red when the hole is closed |
| change the files that decide the call (`host/`, `policies/`) | `test/fixtures/self-write-probe.eyg` with `--inside-roots` | the host shield, before the policy is consulted | **holds** against path text, **open** through a link | boundary fact 6 of `docs/world/entities/host.guard-boundary.md`: four `denied by the host` answers, `test ! -e` on both targets; the shield compares path text, so the link route above reaches the same directory |
| credential reach by file spelling (`.env.eyg`) | `test/fixtures/secret-probe.eyg` with `--inside-roots` | the policy's `read_file` field, wrapped in `hide_secrets` | **holds** | `hide_secrets` (`policies/agent-roots.eyg:190`) refuses the name before the roots are consulted; `node bin/agent/secret-rule-probe.mjs` prints `holds` for it, 0.48 s (`@measured 2026-11-25`) |
| credential reach by directory, in every direction: read, write, append, delete, mkdir, list, search | `test/fixtures/secret-directory-probe.eyg`, run by `node bin/agent/secret-rule-probe.mjs` against a root it builds in the system temporary directory | the same wrapper, applied to all seven path fields | **holds** | measured 2026-11-25: `read_file`, `write_file`, `append_file`, `delete_file`, `make_directory`, `read_directory` and `search` each answered `<effect> denied by policy: <path> (a name this policy hides)` for a path through `secrets/` and through `.ssh/`, while an ordinary nested file read and wrote; the refused write left nothing at the path and the refused read left the file unchanged - 16/16 rows hold |
| the other spellings of a secret name: case, Unicode composition, a trailing dot or space | `test/fixtures/spelling-probe.eyg` writes and reads six spellings of one name | the suffix half of `hidden`, on exact bytes | **closed by the directory rule, not by the suffix test** | measured 2026-11-24 against the suffix-only rule: `.ENV.EYG`, `.env.eyg.` and `.env.eyg ` all answered `read landed` while plain `.env.eyg` was refused - a name test is beaten by the name. A path effect now refuses any path with a segment in `secret_directory_names` (`policies/agent-roots.eyg:152`), so spelling a file's own name no longer matters for those directories. **open** for a secret kept in a directory nobody named, and **bounded** by the cost the rule accepts: a *file* named `secrets` is refused too, which the probe records as `the cost: a file named like the directory` |
| a secret in a directory the policy did not name | `perform ReadFile` of `ordinary/id_rsa` under the roots | nothing - there is no rule for it | **open**, and the rule's stated bound | `node bin/agent/secret-rule-probe.mjs` row `the bound: a secret-shaped name` answers `landed`. The rule names directories, not secrets; `notes/pi-codemode-policy-shape.md` carries what an operator would have to edit to add one |

## B. The guard's own surface - what decides an ask

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| invent an effect the language does not offer, host it yourself, and reach a command line | `perform Bash({ command: "id" })`, then the same with a `handle Bash` clause: `test/fixtures/invented-effect.eyg` and `test/fixtures/invented-effect-handler.eyg` | the CLI's type check, then the CLI's lack of a host for the label | **holds** | `docs/world/entities/host.closed-effect-set.md`; `node bin/agent/invented-effect-probe.mjs` prints five rows - `check`, `run`, `clause`, `decline`, `guarded` - all `holds`, 0.55 s (`@measured 2026-11-24`), and a planted stand-in that runs turns three of them `DRIFT` |
| a label the guard does not name, reaching the host ungarded | `perform Foo({})` (`test/fixtures/unnamed-effect.eyg`) | the guard names one clause per effect row; the CLI has no host for a label outside that set | **holds** | `test/host-coverage.test.mjs` compares the guard's clauses with the 23 effect rows of `guides/eyg-surface.tsv`; a label no host has stops the run with `unhandled effect Foo` |
| a program that hosts its own effects instead of asking the host (`handle`) | `test/fixtures/inner-handler.eyg` (a clause inside the guarded body); `test/fixtures/imported-handler.eyg` (one inside an imported module) | the tool's parse of the text it assembles; then the guard, for a clause it cannot see | **holds** for the text a call passes in, **open** for a module that text imports | fact 7 of `docs/world/entities/host.guard-boundary.md` and `docs/world/entities/gap.one-host-check-not-transitive.md`; `node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg` prints `ReadFile` and the same on the imported program prints nothing; the reasoning is `notes/one-host-per-call.md` |
| an effect at module top level, or import-time configuration | an `perform ReadFile(...)` at the top of an imported module | the CLI: a top-level effect has no host at all | **holds** (fail-closed) | fact 4 of `docs/world/entities/host.guard-boundary.md`: `unhandled effect` guard or no guard, so a module cannot pre-configure a way out |
| a mis-shaped ask for any effect | `perform MakeDirectory({ path: "eyg-misshaped-ask" })` - a record where the effect wants a `String` (`test/fixtures/misshaped-ask.eyg`) | the tool's own check of the entry it wrote, before the run starts | **holds** since 2026-11-25 (was **open** as to the answer) | `node bin/agent/misshape-probe.mjs --program test/fixtures/misshaped-ask.eyg` answers `1 mis-shaped ask(s) named by the check in 0.25 s, 0 runs, 0 bytes of run output` and the same probe on a well-shaped fixture answers `0 mis-shaped ask(s)`; the run never started, so the ask never spent the cap. The CLI does not loop - it prints its whole state, and that print is what cost the run. Unguarded the mis-shape errors in 80-129 ms and the report is the CLI's value inspector over the interpreter state: `.ai-work/security-docs/probes/pin2/` pads one `handle` clause's own file and the report follows the padding - 1 KB -> 23714 bytes, 4 KB -> 35654, 16 KB -> 65534 - because every traced AST node carries the whole source text of the file it came from and every environment carries the builtins dictionary. The entry this package writes imports 23.8 KB of `host/guard.eyg` and 9.8 KB of `policies/agent-roots.eyg` inside the guarded body, so the report needs gigabytes: RSS read 584 MB then 4.35 GB across 24 s at **0 output bytes**, and under `ulimit -v 2000000` the run stops at 14.8 s with `RangeError: Out of memory` inside the CLI's `inspect`/`#customType`/`map` (Bun v1.3.13) - `@measured 2026-11-25`. Nothing about the guard loops: the same mis-shape under seven nested handler clauses in one small file errors in 0.076 s. `eyg check` of that same guarded entry answers the same mis-shape in 238 ms with 449 bytes (`error: type mismatch given: String expected: {path: String}`). The 2026-11-24 runs through `.ai-work/security-docs/probes/stall-diagnose.mjs` printed 0 bytes to 15-20 s caps and created no file, and that same fixture re-measured on 2026-11-25 hit the 20 s cap at 20.22 s wall with 0 output bytes; the time bound was the tool's spawn timeout (`pi.exec` at `extensions/eyg-codemode.ts:536`, `timed out after N s` at `:1136`). `notes/pi-codemode-misshaped-ask.md` carries the pre-flight, its cost, and the channels it rejected |

## C. Effects that reach nothing outside the program's own bytes

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| the four effects no policy field can refuse (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) | `perform Hash("x")` | the CLI hosts them; no policy field exists | **bounded**, reach-wise | they take and return values only - `test/fixtures/rule_mapping.gleam` prints them as `policy.Unchecked`, and `with_hash` (`host/guard.eyg:686`) re-performs without asking the policy; a well-shaped ask answers in 0.2 s |
| credential reach: the process environment | `perform Env("PATH")` | the policy's `env` field | **holds** | `env: refuse("env")` in `policies/agent-roots.eyg`, so the guard hands the program `None({})`; probed 2026-11-23: `env answered None` under the shipped policy |
| the network (`fetch`) | `test/fixtures/fetch-probe.eyg` | the policy's `fetch` field - under the shipped policies, the operator's own copy of a policy otherwise | **holds** under the shipped policies, **open** for an operator policy that allows it | measured 2026-11-24: refused under `agent-roots` and under `deny-all` (`fetch: refuse("fetch")` in both); the same program under a copy with `fetch: pass` answers `FETCH LANDED` while `test/fixtures/fetch-listener.mjs` logs `GET /sent`, so the bytes left the process; a host-pinned copy refuses `127.0.0.1`. Seven legs, 3.2 s: `docs/world/entities/pi.fetch-and-injection-exfiltration.md` |
| `standard_in`, `create_key` | `test/fixtures/standard-in-probe.eyg`, `test/fixtures/create-key-probe.eyg` | the `standard_in` and `create_key` fields | **holds** | four runs (both fixtures, both shipped policies) answer `refused: standard_in denied by policy` and `refused: create_key denied by policy`, 0.2 s each; the fixtures use the tool's own probe argument shapes (`NO_PATH_PROBE_ARGUMENTS` in `lib/render-helpers.mjs`, `Eddsa({})`) so the ask reaches the rule and not a shape check |

## D. Persistence and delegation - code and sessions that outlive the call

| vector | the minimal attempt | what decides it | rating | the evidence |
| --- | --- | --- | --- | --- |
| write a helper that a later call runs | `test/fixtures/registry-plant-probe.eyg` writes into `<cwd>/.pi/eyg-functions`, then a call names it in `libraries` | the guard again, for the planted code; nothing at all, for the plant itself | **open**, **bounded** as to reach | `docs/world/entities/pi.registry-scope-persistence.md`: the plant lands, the next call lists the writer's own `signature` and `description` verbatim, and the planted code runs **inside** the guard (`inside: landed`, `outside: read_file denied by policy`). What is planted is code and listing text, not reach; the scopes are not shielded - `ctx.protected` covers only `host/` and `policies/` (`hostProtectedPaths`, `lib/render-helpers.mjs:330`) - and nothing under `.pi/` is gitignored. A module planted in a scratch `$HOME` was offered as `[home]`; the real home is UNVERIFIED, has no such directory, and no probe wrote there |
| an imported module the call did not author, performing effects | `test/fixtures/registry-bind-probe.eyg` names a module in `import` | the guard, once the module's effect is performed | **holds** as to reach, **not probed** for one installed through the language's package manager | the same chain answers `inside: landed`, `outside: read_file denied by policy`. No probe here can answer the install route: the only published scope installed on this host has no effect-calling code, so that half is UNVERIFIED in `docs/world/entities/host.guard-boundary.md` |
| keep a binding whose source performs an effect, so every later call re-performs it | `let noise = (_) -> { perform WriteFile({ path: "/tmp/x", contents: ... }) }` kept with `extern: "workspace"` (`test/render-helpers.test.mjs` plants it) | the tool's own scan of the binding's source, at the keep and again at the read | **holds** since 2026-11-25 (was a rule only the prose stated) | `not kept: noise - it performs WriteFile: ...` names the module, names `eyg-functions/noise.eyg` as the way out, and leaves `details.externProgram: null` plus `variables: []`, so the write program never started; a module already on disk that performs is reported once per call and left out of `details.prelude`, which stays `[]` while the file sits there and nothing lands at `/tmp` (`.ai-work/keep-proof/PROOF-keep-2026-11-25.md` quotes both halves). The scan is `effectsUsed`, textual over `perform`, so the look over-estimates and the direction is the safe one (`notes/pi-codemode-kept-bindings.md`) |
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
| the secret spelling (A) | **done 2026-11-25**: `policies/agent-roots.eyg` now refuses every path effect for a path with a segment in `secret_directory_names` or ending `secret_file_suffix`, written out whole, `agent-roots` narrowed only | a whole-file rewrite plus `node bin/agent/secret-rule-probe.mjs` (0.48 s) | closed; the probe is an audit row |
| a secret in a directory nobody named (A) | the list is data, so the fix is an operator copying the policy and adding a name; a rule that could *find* secrets needs an effect the language does not have | one operator edit of one list; nothing to write here | the first operator whose secrets live elsewhere |
| the child session's policy (A, D) | `policies/spawner-effects.eyg` carries the older suffix test only, so a spawned session can read `.ssh/config` under its roots; narrowing it means duplicating the rule again - 68 of its 84 non-comment lines are already `agent-roots` verbatim (`docs/world/entities/gap.policy-record-extension.md`) | a whole-file rewrite of that policy plus its probe rows | the shape decision kept the record of rules (`notes/pi-codemode-policy-shape.md`), so the fix stays a whole-file rewrite: the data shape shares 84 lines with `agent-roots` either way |
| a mis-shaped ask (B, E) | **done 2026-11-25**: the tool answers `check <entry.eyg>` on the entry it wrote before it spawns `run`, and reports only the `error: type mismatch` rows plus the surface file and the language docs (`entryCheckArguments` in `lib/render-helpers.mjs`, `notes/pi-codemode-misshaped-ask.md`) | one extra CLI start per model call (0.234-0.407 s), and the row is an audit row (`node bin/agent/misshape-probe.mjs`) | closed; the same fixture that hit the 20 s cap now answers in 0.25 s |
| an imported module's `handle` clause (B) | a `parse` or `check` that reports the handler labels of a program *and of the modules it imports*, which is the language's half; this package's half is stating the bound where a reader will hit it | an upstream ask; the bound is already written | the trigger on `docs/world/entities/gap.one-host-check-not-transitive.md` |
| a planted registry module (D) | state the reach bound in the tool's own listing - a workspace or home entry labelled as such - and leave the plant refused only by the guard | a listing change plus a grep over the script's source | `task-ux-onboarding` of this goal |
| an operator policy that allows `fetch` (C) | pin a host in the policy, or keep the row refused | a policy decision, not a code change | the first operator who wants `fetch` allowed |
| the grant loop (D) | bound a grant's lifetime, and prove a multi-call grant live - the live proof needs one `/eyg-grant` run from the operator | one operator action; the bound is a tool change | `docs/world/entities/gap.grant-polish-undecided.md` |

## What the ratings mean for the next fix

One **open** row costs reach: the symlink route (read outside every root, write outside every root,
write under the shielded paths, which is what the next call's rules are made of). It needs a
question the language does not answer today - what a path *is*, or what a directory holds - so it is
a design decision and the operator's; the three shapes and their costs are on the gap record. The
secret-spelling rows next to it needed no answer from the language at all, and that is what closed
them on 2026-11-25: a rule that refuses every path passing through a named directory, instead of
testing one extension, answers all seven path effects and stops the name's spelling mattering. What
the closed rule leaves open is stated as its bound rather than hidden: it knows the directories it
was given (`policies/agent-roots.eyg:151`) and nothing else, so a secret kept in a directory nobody
named is still reachable under a root, and a *file* named `secrets` is refused - the price of a rule
that reads path text and never looks inside a path.

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
