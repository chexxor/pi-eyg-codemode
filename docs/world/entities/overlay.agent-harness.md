---
id: overlay.agent-harness
type: entity
owner: delegate
status: suspect
verified_at: 2026-11-22
verify: "grep -q 'policy_runner.gleam' notes/pi_codemode_host_gate.md && grep -q '\"--policy\"' extensions/eyg-codemode.ts && grep -q 'action === \"effects\"' extensions/eyg-codemode.ts && grep -q 'eyg-functions' extensions/eyg-codemode.ts && grep -q 'eyg_packages/overlay/policy.eyg' notes/pi-codemode-policy-inlining.md && test -f notes/pi-eyg-codemode-vs-overlay.md"
confidence: high
sources: [notes/pi_codemode_host_gate.md, notes/pi-codemode-policy-inlining.md, notes/pi-eyg-codemode-vs-overlay.md, extensions/eyg-codemode.ts, test/fixtures/rule_mapping.gleam, docs/world/entities/overlay.policy-rules.md, docs/world/entities/gap.policy-runner-not-on-main.md, README.md]
supersedes: null
superseded_by: null
---

# The language ships its own agent harness, Overlay; this package is the other end of the checks

Overlay is the EYG repository's own agent. Three Gleam packages (`packages/overlay`,
`packages/overlay_llm`, `packages/overlay_web`) and an EYG config library
(`eyg_packages/overlay/`: `policy.eyg` 199 lines, `skills.eyg` 119, `wc -l` 2026-11-19) are
started with `eyg overlay <file>`, and a `.overlay.eyg` returns `{llm, policy, context}`
(`packages/overlay/README.md:24,74`). This package registers one tool inside pi's agent and
reaches the same per-effect checks through the CLI. Both put the loop outside the program for
one reason, recorded here as the language's: a policy inside a program is a request, not a
constraint (`notes/pi_codemode_host_gate.md`).

The lineage is one change, not two designs. The operator reports (2026-11-19, from the language
repository) that commit `0b28819` on that repository's non-default branch (which one, and how it
relates to `main`, is recorded once at `gap.policy-runner-not-on-main`), 2026-11-15, added
`packages/gleam_cli/src/eyg/cli/policy_runner.gleam` (182 lines), which imports
`eyg/cli/overlay` as `gate` and reuses `gate.rule_mapping`, `overlay.setup` and `decide` - the
same loop `pi_codemode_host_gate.md` names. **UNVERIFIED from this workspace**: that file is not
in the checkout on this machine and `AGENTS.md` forbids running `git` there, so the commit, the
branch and the line count are reported, not measured. This workspace has its own history from
that date: `git log -1 --format=%s cf6d079` here is the extraction commit, and its subject names
a checkout this page does not repeat.

| | EYG Overlay (the language repository) | pi-eyg-codemode |
| --- | --- | --- |
| the agent loop | Gleam's: `outer_loop`/`inner_loop` in `cli/overlay.gleam`, 711 lines (`wc -l` 2026-11-19), its own truncation, its own terminal and web front ends | pi's: loop, history, TUI, compaction and model choice stay pi's; this package contributes one tool |
| model access | its own HTTP client - Ollama `/api/chat` (`packages/overlay_llm/src/overlay/llm/provider/ollama.gleam:42`), Mistral `/v1/chat/completions` (`…/mistral.gleam:32`) | none: any model pi is configured with |
| the tool the model sees | `agent.tools()` is `[run.spec()]` (`packages/overlay/src/overlay/agent.gleam:172-173`); what a capability is stays prose in the system prompt (`describe_effect`, same file:98) | `code`, `action`, `function`, `timeout`, `policy`, `libraries` and `promptGuidelines` (`extensions/eyg-codemode.ts:276-324`); `action` adds host-side probes - `eval`, `effects`, `list_functions`, `describe_function` |
| process model | one long-running session: the rules are matched once at `setup`, `execute.State` threaded through the conversation | one runner spawn per call, `[mode, "--policy", policy, "-c", code]` with no shell between, and no state kept |
| where the policy comes from | part of the agent config, in the same record as the model | separate from the model: `policy` argument, `EYG_POLICY`, the package's `policies/agent-roots.eyg`, else refuse to run anything |
| how a policy is written | composes helpers from the config library: `policy.read_only(roots)`, `{..policy.allow_all}`, `policy.with_header(host, key, value, otherwise)` (`eyg_packages/overlay/README.md`) | presets written out in full - 18 rules in `policies/agent-roots.eyg` - because the package imports nothing outside itself (`notes/pi-codemode-policy-inlining.md`, `invariant.policy-self-contained`) |
| where the roots come from | code: arguments to `read_only`/`read_write` | configuration: `EYG_ALLOWED_ROOTS`, with no per-project place for them yet (`gap.roots-have-no-config-file`) |
| reuse of code | the `context` record in scope for every run, published `@package` refs, skills appended to `context.readme` (`eyg_packages/overlay/skills.eyg`) | three read-only registry scopes bound as `<name>_lib`, asked through `list_functions` before a helper is written |
| what the model reads | skills loaded by the config into the prompt | `skills/eyg-codemode/SKILL.md` plus the offline mirror in `guides/` (`guides.index`) |

What is shared is the checking, and this page does not restate it: the vocabulary and the rule
table are `overlay.policy-rules`, the capability question is `codemode.effect-surface`, and the
recorded `rule_mapping` snapshot is the table the Overlay harness matches rules against.
`Pass`/`Mock`, paths resolved to absolute before a check sees them, and a refusal that resumes
with `Error(...)` rather than crashing are the same on both sides. The one place they were
measured to differ is which effects the table names, and that is
`gap.policy-runner-not-on-main`.

## Not this

Not the effect surface - `codemode.effect-surface` owns it, and neither harness adds to it.
Not the mechanism or its `Pass`/`Mock` contract - `overlay.policy-rules`. Not whether the
build of the kind this package starts exists today - `gap.runner-release-lacks-policy`.
Not the argument for choosing one harness over the other - that trade-off is
`notes/pi-eyg-codemode-vs-overlay.md`; this page only says what each owns.
