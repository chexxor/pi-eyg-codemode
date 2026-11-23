---
id: gap.one-host-check-not-transitive
type: entity
owner: delegate
status: current
verified_at: 2026-11-23
verify: "node bin/agent/refusal-probe.mjs --program test/fixtures/imported-handler.eyg 2>&1 | grep -q 'the program reports a write the host never performed' && ! node bin/agent/refusal-probe.mjs --program test/fixtures/imported-handler.eyg 2>&1 | grep -q 'denied by policy' && test -z \"$(node bin/agent/handler-scan.mjs test/fixtures/imported-handler.eyg)\" && node bin/agent/handler-scan.mjs test/fixtures/imported-handler-lib.eyg | grep -qx WriteFile && node bin/agent/refusal-probe.mjs 2>&1 | grep -q 'write_file denied by policy: /tmp/'"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/fixtures/imported-handler.eyg, test/fixtures/imported-handler-lib.eyg, bin/agent/refusal-probe.mjs, bin/agent/handler-scan.mjs, docs/world/entities/host.guard-boundary.md, notes/one-host-per-call.md]
supersedes: null
superseded_by: null
---

# Gap: the one-host check reads the text a call passes in, not the modules that text imports

Boundary fact 7 of `docs/world/entities/host.guard-boundary.md` refuses a program whose parse names
a `handle` clause. The text that gets parsed is the prelude the tool assembles - one `import` line
per `libraries` entry and one per kept binding - followed by the program
(`extensions/eyg-codemode.ts:1007-1030`, parsed at `:1039`). A module's **body** is not in that
text, so a clause written inside an imported module installs inside the guarded body and the check
never sees it.

Measured 2026-11-23 with two fixtures, through `node bin/agent/refusal-probe.mjs`, which writes the
same three files the tool writes and starts the installed CLI:

| run | answer |
| --- | --- |
| `--program test/fixtures/imported-handler.eyg` | `the program reports a write the host never performed`, `exit=0`, no `denied by policy` text anywhere in the output, nothing at the target path |
| the same write with no clause (`test/fixtures/refusal-probe.eyg`) | `write_file denied by policy: /tmp/eyg-refusal-probe-<random>/eyg-probe-refused.txt` |
| `node bin/agent/handler-scan.mjs test/fixtures/imported-handler.eyg` | prints nothing - the program text names no clause |
| `node bin/agent/handler-scan.mjs test/fixtures/imported-handler-lib.eyg` | prints `WriteFile` - the clause is in the module |

The same day the route was run through the tool itself, in a fresh one-shot session
(`pi --print --mode json --tools eyg --model <model>`, `policySource: project settings`, roots =
this tree): the call importing `test/fixtures/imported-handler-lib.eyg` answered
`FABRICATED-BY-IMPORTED-CLAUSE`, `exit=0`, `refusals: []`, `grantId: null`, and nothing existed at
the target path, while the same write with no clause in the program answered `REFUSED-BY-GUARD`. So
the probe's answer is not an artifact of the harness.

Two routes reach a module, and neither needs a privilege the session lacks. A program can write
`let lib = import "<absolute path>"` in its own text - the probe's module sat in this tree, and a
second run imported one from `/tmp`, outside every root, and it ran: an `import` is not an effect,
so no policy field decides it. Or a session can use the documented `libraries` and `extern`
mechanisms, since the workspace registry scope `<cwd>/.pi/eyg-functions` is inside a session's roots
and is not in `ctx.protected`, which covers only the package's `host/` and `policies/` (fact 6).

**What this is not.** It is not an escalation. Boundary fact 5 still holds: a clause cannot make the
host perform what the policy refuses, and its re-perform reaches the guard and is decided again. What
it breaks is the honesty of the answer and of the ask. The guard's refusal never reaches the tool, and
the ask is read off the run's output text (`docs/world/entities/pi.session-grants.md`), so no grant
suggestion is emitted and the session never makes the ask the design depends on; and the run's own
output reports an effect the host did not perform. The same fabrication is already
available in plain code - a function that returns a made-up string where a read would have gone - so
this route adds no new capability, only a typed one that survives the check. It also does not need an
adversarial model: a helper written by an earlier session can carry a clause that a later session
calls without knowing.

**Why this package cannot close it.** To know what an imported module handles, the tool would have to
resolve imports the way the compiler does and parse every module transitively - and a program may
import any path, so the set is not bounded by the tool's own `libraries` list.

**Why the type row does not close it either.** Per an operator-supplied report read off the language
repository (UNVERIFIED here, no path in this tree resolves it): `handle L` deletes `L` from the
effect row (`rewrite_effect` in `packages/gleam_analysis/src/eyg/analysis/type_/binding/unify.gleam`),
but the row cannot distinguish "already handled" from "never needed" - both print `(N <..M>) -> R`,
and even a function with no effects gets an open tail. The row is closed against the platform only
where it is closed at all: at the top level (`infer.with_effects(interface.types(computer.effects()))`
in `check.gleam`) and in builtin positions typed with an empty row (`fix()` in `contextual.gleam`).
There is no ascription in the language - no `::` in the parser's lexer, no annotation node in the IR
tree - so "this argument must be effect-free" cannot be written. The row is a requirement, not a
record of what a function did.

**Option considered and not taken:** refuse any `import` whose resolved path is not one the tool put
in the prelude, i.e. allow only the package's shipped `libraries/`. It is a narrowing and it closes
the route, and it was refused anyway: it breaks the documented `extern` file scopes and any program
that imports a module of its own, to close a reporting hole plain code can already imitate.

**Trigger to close:** a `parse` or `check` that reports the handler labels of a program *and of the
modules it imports*, or a language-level way to demand an empty effect row of a module. Then the tool
asks that question instead of the local one, `test/fixtures/imported-handler.eyg` is refused before it
runs, and this record moves with the new evidence.

## Not this

- whether a clause can widen what the policy allows: boundary fact 5 of
  `docs/world/entities/host.guard-boundary.md`, which it cannot;
- the rule that refuses a clause in the text a call passes in, and why that question goes to the
  parser: boundary fact 7 of the same page and `notes/one-host-per-call.md`;
- which files a call may not change: boundary fact 6;
- the effect surface and its policy fields: `docs/world/entities/codemode.effect-surface.md`.
