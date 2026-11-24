---
id: host.guard-boundary
type: entity
owner: delegate
status: current
verified_at: 2026-11-24
verify: "node --test test/host-coverage.test.mjs > /dev/null && grep -q '^let build = (policy, ctx, body) -> {' host/guard.eyg && node bin/agent/refusal-probe.mjs 2>&1 | grep -q 'write_file denied by policy: /tmp/' && node bin/agent/refusal-probe.mjs --program test/fixtures/secret-probe.eyg --inside-roots 2>&1 | grep -q 'read_file denied by policy: .*\\.env\\.eyg' && node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg 2>&1 | grep -q 'unhandled effect Foo' && node bin/agent/refusal-probe.mjs --program test/fixtures/inner-handler.eyg 2>&1 | grep -q 'what the program was answered: read_file denied by policy: /tmp/' && node bin/agent/refusal-probe.mjs --program test/fixtures/abort-probe.eyg 2>&1 | grep -q 'Aborted with reason' && test \"$(node bin/agent/refusal-probe.mjs --program test/fixtures/self-write-probe.eyg --inside-roots | grep -o 'denied by the host' | wc -l)\" = 4 && test ! -e policies/self-write-probe.eyg && test ! -e host/self-write-probe && node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg | grep -qx ReadFile && test -z \"$(node bin/agent/handler-scan.mjs test/fixtures/refusal-probe.eyg)\""
confidence: high
sources: [host/guard.eyg, host/PURPOSE, lib/render-helpers.mjs, extensions/eyg-codemode.ts, test/host-coverage.test.mjs, test/fixtures/refusal-probe.eyg, test/fixtures/secret-probe.eyg, test/fixtures/unnamed-effect.eyg, test/fixtures/inner-handler.eyg, test/fixtures/abort-probe.eyg, test/fixtures/self-write-probe.eyg, bin/agent/handler-scan.mjs, guides/tool-reference.md, guides/what-a-call-does.md, notes/pi-codemode-host-guard-contract.md, notes/guard-self-protection.md]
supersedes: null
superseded_by: null
---
# The guard holds: a handler per effect, and the model's code cannot get outside it

`host/guard.eyg` is an EYG program, run by the ordinary installed CLI with no flag, that decides
every effect of a call. Seven boundary facts make it a boundary rather than a convention; each was
probed on the installed CLI (`eyg v0.1.0`) on 2026-11-22 by running a probe file with `eyg run <file>`,
and each is re-runnable here through `node bin/agent/refusal-probe.mjs`, which builds the same three
files the tool builds.

1. **A `handle` clause intercepts a host computer effect.** The clause receives the effect's record
   and a `resume`; the program's own `perform` never reaches the host unless the clause sends it
   back. Probed: a body that performed `WriteFile` under a clause answering `resume(Error(...))`
   printed the refusal and no file appeared.
2. **A clause allows by re-performing.** An effect performed inside a clause of that same label is
   not re-caught by it: the host performs it once and its reply comes back through `resume(reply)`.
   `resume(x)` on its own only *answers* the program - it is the refusal shape, never an allow.
3. **Default-deny is a construction, not a freebie.** A label the guard does not name reaches the
   host ungarded, so the guard names one clause per effect row of `guides/eyg-surface.tsv`, and the
   handler list is compared with that file by `test/host-coverage.test.mjs`. A label no host has at
   all - `perform Foo({})` - stops the run with `error: unhandled effect Foo({})`. One label sits
   outside that rule and is harmless: the runtime's own `Abort`, for which the guard names no
   clause, so a program that performs it reaches the host and the run stops with
   `error: Aborted with reason: ...`, performing nothing outside the program - which is why the
   closed set is the effect rows of the surface file and not every label in the binary.
4. **Model text cannot break out.** It goes into its own module (`program.eyg`), never into the file
   that holds the guard: spliced into the guard's file the same text closed the guard's call and
   performed an effect at the entry's top level, which the host performed. In its own module that
   text is a parse error, and an effect at a module's **top level** is never performed at all -
   `unhandled effect`, guard or no guard - so import time is fail-closed and a module cannot
   pre-configure its own way out. The entry (`entryProgram` in `lib/render-helpers.mjs`) is the only
   file that imports anything, and it is generated, not modelled.
5. **An inner handler can only decline.** A clause the model writes inside the guarded body sees the
   effect first, and its re-perform reaches the outer guard, which decides; with the guard refusing,
   the effect is never performed. The same holds for an effect raised inside a builtin's callback.
   Re-runnable: `node bin/agent/refusal-probe.mjs --program test/fixtures/inner-handler.eyg` - the
   model's own `handle ReadFile` clause re-performs the read, the answer the program gets is
   `read_file denied by policy: /tmp/eyg-inner-handler-probe.txt`, `exit=0`, and no file exists at
   that path (`@measured 2026-11-22`, 0.2 s).
6. **A call cannot change the files that decide it.** The entry imports the guard and the policy by
   absolute path, and a session's roots are its working directory, so a session run inside this
   package has `host/guard.eyg` and `policies/*.eyg` inside its own roots - a program that rewrote
   either would be writing the rules of its next call. The guard refuses `write_file`, `append_file`,
   `delete_file` and `make_directory` for any path under `ctx.protected` **before the policy rule is
   consulted**, and the tool writes that list as the package's `host/` and `policies/` plus the
   resolved policy module wherever it lives (`hostProtectedPaths` in `lib/render-helpers.mjs`,
   `shield` in `host/guard.eyg`), so no policy - the operator's own included - opens those paths and
   a wider root does not either. The refusal says `denied by the host`, which is how a program tells
   it from one a rule made. Reads are not shielded: reading the guard and the policies is how a
   program learns what it may ask for. Re-runnable: `node bin/agent/refusal-probe.mjs --program
   test/fixtures/self-write-probe.eyg --inside-roots` - four `denied by the host` answers, one
   `read_file guard: allowed`, `exit=0`, and no file at either target path (`@measured 2026-11-23`,
   0.4 s). The targets are names that do not exist, so a run that ever performed them leaves a stray
   file instead of damaging a tracked one. This holds against path text and not against what the text
   is: a symlink standing inside a root is decided by the link's own path and the host follows it, so
   a write reaches `policies/` that way (`docs/world/entities/gap.symlinks-escape-the-roots.md`).
7. **A call parses its program before it runs it, and refuses one that handles an effect.** The
   tool asks the same binary for the program's syntax tree (`parseArguments` in
   `lib/render-helpers.mjs`) and refuses a program whose tree names a `handle` clause, naming the
   labels it handled (`handledEffectLabels`, `handledEffectRefusal`); a parse that exits non-zero or
   prints something that is not JSON stops the call too, so a program whose effects were never
   listed is not run. A clause inside the guarded body could not widen what the policy allows (fact
   5), but it answers the program instead of asking the host, and answering-instead-of-asking is the
   boundary. The question goes to the compiler's parser rather than a text scan, so `handle` in a
   string or a function named `handle` is not a refusal. The check covers the text the tool
   assembles - the prelude of imports and the program - and not the body of a module that text
   imports, so a clause inside an imported module installs inside the guarded body unnamed
   (`docs/world/entities/gap.one-host-check-not-transitive.md`, which carries that run and what
   would close it). Re-runnable: `node
   bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg` prints `ReadFile` and the same
   command on `test/fixtures/refusal-probe.eyg` prints nothing (`@measured 2026-11-23`, 0.15 s each).
   The refusal reaching a model was proved in a fresh one-shot session (`pi --print --mode json
   --model <the model this session runs on> --tools eyg`, 22.5 s, `@measured 2026-11-23`) handed a
   program with a `handle ReadFile` clause: the tool answered `the program handles 1 effect(s) for
   itself (ReadFile)` and ran nothing.

Two consequences the package had to build for:

- **Paths arrive as written.** The CLI hands a rule `./secrets.env`, not a resolved path, so the
  guard resolves every path to an absolute one with no `.` or `..` segment before the rule sees it
  and performs the effect with that path.
- **A program cannot run at module top level**, so the model's source has to be wrapped as a
  function and called from the entry. A program must also end with an expression: a trailing `let`
  is a parse error inside the generated `program.eyg`.

UNVERIFIED: an *effectful* package installed through the language's package manager. `@standard`
resolves offline and its functions are pure, and no other published scope is installed here. The
mechanism is observed for an imported module the call did not author -
`docs/world/entities/pi.registry-scope-persistence.md` runs one inside the guarded body and the
`ReadFile` inside it answers `read_file denied by policy` for a path outside the roots - but not for
a module the language's own installer fetched. Trigger: a published package that performs effects
exists to install.

## Not this

- which policy a call gets and what it decides: `docs/world/entities/pi.policy-config.md`,
  `docs/world/entities/codemode.effect-surface.md`;
- the tool's argv and the three files it writes: `docs/world/entities/pi.codemode-tool.md`;
- why this seam was chosen over the runner flag: `docs/world/decisions/ADR-006-guard-in-package.md`;
- how to point the tool at a binary: `guides/how-to-point-the-tool-at-your-runner.md`.

@measured 2026-11-22 by `node bin/agent/refusal-probe.mjs` (write probe: `write_file denied by policy:
/tmp/eyg-refusal-probe-<random>/eyg-probe-refused.txt`, `exit=0`, 0.17 s, nothing left at the path),
`--program test/fixtures/secret-probe.eyg --inside-roots` (`read_file denied by policy: <tree>/.env.eyg`,
0.15 s), `--program test/fixtures/unnamed-effect.eyg` (`error: unhandled effect Foo({})`),
`node --test test/host-coverage.test.mjs` (3 pass, 0 fail, 0.1 s), and the probe files under the
session's scratch directory quoted in `notes/pi-codemode-host-guard-contract.md`; and 2026-11-23 by
`--program test/fixtures/self-write-probe.eyg --inside-roots` (four `denied by the host` answers naming
`<tree>/policies/self-write-probe.eyg` and `<tree>/host/self-write-probe`, then `read_file guard:
allowed`, `exit=0`, 0.4 s, and `git status --porcelain policies host` empty afterwards); and
2026-11-23 by `node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg` (prints `ReadFile`),
the same on `test/fixtures/refusal-probe.eyg` (prints nothing), 0.15 s each.
