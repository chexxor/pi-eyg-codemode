---
id: host.guard-boundary
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "node --test test/host-coverage.test.mjs > /dev/null && grep -q '^let build = (policy, ctx, body) -> {' host/guard.eyg && node bin/agent/refusal-probe.mjs 2>&1 | grep -q 'write_file denied by policy: /tmp/' && node bin/agent/refusal-probe.mjs --program test/fixtures/secret-probe.eyg --inside-roots 2>&1 | grep -q 'read_file denied by policy: .*\\.env\\.eyg' && node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg 2>&1 | grep -q 'unhandled effect Foo'"
confidence: high
sources: [host/guard.eyg, host/PURPOSE, lib/render-helpers.mjs, extensions/eyg-codemode.ts, test/host-coverage.test.mjs, test/fixtures/refusal-probe.eyg, test/fixtures/secret-probe.eyg, test/fixtures/unnamed-effect.eyg, guides/tool-reference.md, notes/pi-codemode-host-guard-contract.md]
supersedes: null
superseded_by: null
---
# The guard holds: a handler per effect, and the model's code cannot get outside it

`host/guard.eyg` is an EYG program, run by the ordinary installed CLI with no flag, that decides
every effect of a call. Five boundary facts make it a boundary rather than a convention; each was
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
   all - `perform Foo({})` - stops the run with `error: unhandled effect Foo({})`.
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

Two consequences the package had to build for:

- **Paths arrive as written.** The CLI hands a rule `./secrets.env`, not a resolved path, so the
  guard resolves every path to an absolute one with no `.` or `..` segment before the rule sees it
  and performs the effect with that path.
- **A program cannot run at module top level**, so the model's source has to be wrapped as a
  function and called from the entry. A program must also end with an expression: a trailing `let`
  is a parse error inside the generated `program.eyg`.

UNVERIFIED: an *effectful* published package imported by the model. `@standard` resolves offline and
its functions are pure; the only published scope installed here has no effect-calling code, so the
mechanism is inferred from facts 1 and 5 rather than observed. Trigger: a published package that
performs effects exists to install.

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
session's scratch directory quoted in `notes/pi-codemode-host-guard-contract.md`.
