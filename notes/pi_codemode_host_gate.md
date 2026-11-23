---
name: the codemode checks are host-side, and a pure-EYG mediated runner cannot exist
description: Why the agent's restriction is installed on the runner that starts the interpreter rather than in the program or in a mediated EYG helper; the decision and the material that rules the alternatives out.
date: 2026-11-23
---
*(This note's subject was worked out in the language repository on 2026-11-15; it is carried here as the package's decision record, measured there, not re-run here. The paths it names are that workspace's.)*

# The decision: restrict in the process that starts the interpreter

An EYG program reaches the outside world only through effects
(`packages/loam/src/loam/platform/computer.gleam`), and one-shot evaluation
hands an unhandled effect straight to the host: `packages/loam/src/loam/execute.gleam`
turns it into `computer.extrinsic(effect, meta.origin)` and no policy is consulted.
So a policy written *inside* the program is a request, not a constraint - the
program that decides to skip its own check is the same program that asks. Nothing
about the interpreter changes that, and no EYG source can fix it.

The restriction therefore lives on the runner side:
`packages/gleam_cli/src/eyg/cli/policy_runner.gleam` evaluates the program through
the Pass/Mock loop that `packages/gleam_cli/src/eyg/cli/overlay.gleam` already binds
(`rule_mapping`, `overlay.setup`, `decide`), reached from `eyg run --policy <module.eyg>`.
`eyg_packages/codemode_policy/` states which policies of that vocabulary are safe for
an agent, and `pi-eyg-codemode/` puts a pi agent in front of that runner.

*(What changed here on 2026-11-22 is which process that runner is, not the rule: the package now puts
the agent in front of a host of its own, `host/guard.eyg`, an EYG program the installed CLI runs with
no flag. The deciding code is still outside the model's program - the tool generates the entry that
imports the guard around it - so the argument of this note is what made that move possible, and
`docs/world/decisions/ADR-006-guard-in-package.md` carries the choice.)*

# Why not an EYG mediated runner

The tempting design is an agent that talks to a helper process written in EYG, which
reads a request and runs it through a policy. It cannot work as a restriction: the
helper would need an effect that evaluates EYG source or calls a tool, and
`computer.effects()` has neither - the list is file, directory, network, time,
randomness, process input/output, environment and cryptography only
(`@measured 2026-11-15`: `grep -c 'Eval\|CallTool' packages/loam/src/loam/platform/computer.gleam` is 0).
Adding such an effect would be the largest hole in the language: an effect that
evaluates arbitrary EYG is an effect that performs every effect, including the ones
the policy exists to refuse. So the mediation is written in Gleam, on the host side,
where the effect loop is. This is a rejected alternative, not a deferred one.

# Consequences the code does not show

- The policy module is host-authored configuration, so `policy_runner.gleam` evaluates
  it with the *unchecked* evaluator: a policy may perform effects, such as reading an API
  token from the environment. The program under the policy cannot see that token, because
  `deny_all` answers `Env` with `None`, which is how `policy.with_header` injects a
  token on one host without the agent ever holding it.
- Paths are resolved to absolute before a check sees them
  (`resolve_policy_input` in `packages/gleam_cli/src/eyg/cli/overlay.gleam`), so a
  policy only ever reasons about absolute paths and a program cannot dodge a root with
  `..`.
- A refusal resumes the program with `Mock(Error(...))` rather than aborting it, because
  "this effect was refused" is a value the program can branch on and report. On the
  command line that would be silent, so `policy_runner.gleam` turns a program that ends
  on an unhandled `Error` into exit 1 with the reason on stderr: a denial is never
  silent at the shell.
- `DecodeJSON`, `EYGParse`, `Hash` and `Sign` are `Unchecked` in `rule_mapping`: no
  policy is consulted and none can forbid them. They compute and touch nothing outside
  the process, which is the reason they are exempt. Anything that must be refused has
  to be an effect that reaches outside the process.
- No new effect was added and no default in `eyg_packages/overlay/policy.eyg` changed;
  `eyg_packages/codemode_policy/index.eyg` only wraps `read_write`, `read_only`,
  `fetch_hosts`, `with_header` and `deny_all`. Adding an effect or changing a policy
  default is the operator's decision (AGENTS.md escalation list), and it was not needed.
- That every committed rule is actually needed is a test, not a note:
  `scripts/mutation-check.mjs` loosens one rule at a time and requires the suite to fail
  (5 of 5 rules necessary, 15.4 s wall `@measured 2026-11-15`).
