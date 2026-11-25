---
id: host.closed-effect-set
type: entity
owner: delegate
status: current
verified_at: 2026-11-25
verify: "node bin/agent/invented-effect-probe.mjs > /dev/null && node bin/agent/gen-surface.mjs --check > /dev/null"
confidence: high
sources: [bin/agent/invented-effect-probe.mjs, test/fixtures/invented-effect.eyg, test/fixtures/invented-effect-handler.eyg, bin/agent/handler-scan.mjs, bin/agent/refusal-probe.mjs, bin/agent/gen-surface.mjs, guides/eyg-surface.tsv, host/guard.eyg, test/host-coverage.test.mjs, docs/world/entities/host.guard-boundary.md, docs/world/entities/codemode.effect-surface.md, docs/world/entities/gap.one-host-check-not-transitive.md, notes/pi-codemode-threat-model.md]
supersedes: null
superseded_by: null
---
# A program cannot invent an effect, and a handler it writes for one performs nothing

The question this answers: the tool runs EYG, EYG lets a program name an effect and install a
handler for it, so what stops a program from naming `Bash`, hosting it, and running whatever it
wants on the host's command line? Four separate things stop it, and they are different things -
one answer that names only one of them is not an answer. `node bin/agent/invented-effect-probe.mjs`
runs all five rows below (the four walls plus the guarded call) and prints `holds` or `DRIFT` per
row; the whole run costs 0.55 s and writes nothing (`@measured 2026-11-24`).

| # | the wall | the run | the answer |
| --- | --- | --- | --- |
| 1 | the effect set is closed before a program runs | `eyg check test/fixtures/invented-effect.eyg` | `error: missing row 'Bash'`, exit 1, 0.07 s - the name does not exist in the language's row, so the text is refused at check time |
| 2 | a label with no host stops the run | `eyg run` of the same file | `error: unhandled effect Bash({command: "id"})`, exit 1, 0.07 s, no stdout - naming an effect is not giving it a host |
| 3 | a program **can** write its own handler for that label | `node bin/agent/handler-scan.mjs test/fixtures/invented-effect-handler.eyg` | `Bash`, exit 0, 0.10 s - the parse accepts the clause, so this is not a refusal of the text |
| 4 | that handler can only decline | `eyg run` of that file | `error: unhandled effect Bash({command: "id"})` at the clause's own re-perform, exit 1, 0.09 s, 0 bytes of stdout - the branch that would have reported a performed command is never reached |
| 5 | inside a call the invented ask walks this package's guard | `node bin/agent/refusal-probe.mjs --program test/fixtures/invented-effect.eyg` | the same `unhandled effect Bash`, 0.20 s, with a trace naming `host/guard.eyg:638-660` - the 23 nested clauses, none of them `Bash` |

Wall 4 is the one worth reading twice. A `handle` clause receives an ask and a `resume`; the only
ask of `Bash` this program can make is the `perform Bash(request)` inside its own clause, and that
perform reaches the same host that has no `Bash`. So the clause can refuse an ask it invented, and
it cannot perform one: `resume(x)` answers the program, it is never an allow (boundary fact 2 of
`docs/world/entities/host.guard-boundary.md`). An invented handler is a way to decline, not a way
to act.

And the walls are not the only reason the answer is "no command line". Among the labels the
language does offer - the 23 effect rows of `guides/eyg-surface.tsv`, checked against the installed
CLI by `node bin/agent/gen-surface.mjs --check` - none runs a process, the only effect that leaves
the machine is `fetch`, and both policies this package ships refuse it by name
(`docs/world/entities/pi.fetch-and-injection-exfiltration.md`). EYG has no effect that runs shell
commands, so the package has no route from a call to a command line to close in the first place
(`docs/world/entities/codemode.effect-surface.md`).

## What this answer does not cover

Two limits that a reader should get with the walls, both rated on
`notes/pi-codemode-threat-model.md`:

- **A clause inside a module the program imports is not caught by the call's own parse check**, and
  it can report an effect the host never performed. That is a hole in the honesty of a run's answer,
  not a route to a command line: the clause still cannot make the host perform what the policy
  refuses. The run and what would close it are `docs/world/entities/gap.one-host-check-not-transitive.md`.
- **Four effects - `DecodeJSON`, `EYGParse`, `Hash`, `Sign` - have no policy field at all**, so the
  host performs them whatever a policy says. They take and return values and reach nothing outside
  the program's own bytes; a policy cannot refuse them and does not need to
  (`docs/world/entities/codemode.effect-surface.md`).

A language release that added a process-running label would turn wall 1 red before anything else
here moved, which is why the probe asserts the check answer and not only the run answer.
`test/host-coverage.test.mjs` is the other half: it compares `host/guard.eyg`'s clauses with the
surface file, so a label the language already has cannot be missing a clause.

## Not this

- whether a clause the model writes inside the guarded body can widen what a policy allows: it
  cannot, boundary fact 5 of `docs/world/entities/host.guard-boundary.md`;
- the hole in the one-host check and what would close it:
  `docs/world/entities/gap.one-host-check-not-transitive.md`;
- which labels exist and which policy field decides each:
  `docs/world/entities/codemode.effect-surface.md`, `guides/eyg-surface.tsv`;
- the per-vector ratings, including this vector's row: `notes/pi-codemode-threat-model.md`.

@measured 2026-11-24 by `node bin/agent/invented-effect-probe.mjs` (five rows, all `holds`, 0.55 s,
0 bytes of stdout from the invented handler) and `node bin/agent/gen-surface.mjs --check`
(`surface current: 29 builtins, 23 effects, all inputs agree`, 0.04 s).
