---
id: pi.reference-action
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "grep -q '\"reference\"' extensions/eyg-codemode.ts && grep -q 'export function referenceLines' lib/render-helpers.mjs && grep -q 'SURFACE_FILE = \"guides/eyg-surface.tsv\"' lib/render-helpers.mjs && grep -q 'no such builtin' lib/render-helpers.mjs && grep -q 'not policy-gated' lib/render-helpers.mjs && grep -q 'surfaceDriftProblems' test/render-helpers.test.mjs && grep -q 'referenceLines' test/render-helpers.test.mjs"
confidence: medium
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, guides/eyg-surface.tsv, bin/agent/gen-surface.mjs, guides/tool-reference.md, skills/eyg-codemode/SKILL.md, docs/world/entities/usability.without-language-skill.md, notes/reference-answer-shape.md]
supersedes: null
superseded_by: null
---

# The tool answers "what builtins and effects do I have" without leaving EYG

`action: "reference"` (`code: ""`) prints the language surface the session is writing against:
`eyg reference: 29 builtins, 23 effects, nothing performed`, then one line per builtin with its
signature and notes grouped under the sections the capture took them from, then one line per effect with the
policy field that decides it (`none` for the four no policy can forbid). It performs no effect,
spawns no process and asks the policy no question, so it answers on a machine where no runner was
found as well as one where one was; `action: "effects"` stays the call that asks the policy what
it decides for each effect, and the answer says so.

Both halves come from one generated file, `guides/eyg-surface.tsv`: the builtin rows are a dated
capture, the effect rows are generated from the recorded `rule_mapping` and checked against
`POLICY_FIELDS` (`docs/world/entities/guides.surface-file.md`). Two consequences are stated in the
answer itself: the builtin rows are a capture, so the compiler is the source, and pi's own `read`
tool is not policy-gated while `ReadFile` reaches only the roots - the sentence a session had to
guess at before
(`docs/world/entities/usability.without-language-skill.md`).

A run that named a builtin the runtime does not have now carries the same pointer in its rows. The
runner's error is `error: builtin undefined: !str_len` with a hint that names no path; the tool
adds `no such builtin: !str_len`, the path of the surface file named twice (names and syntax live in
the one file), and `action "reference"` as the way to print them without leaving the tool. `builtinErrors` and
`builtinHintRows` in `lib/render-helpers.mjs` build those rows and the unit test pins them, the
reference lines and the guide parse together with everything else the renderer shows.

## What one run measured

The same task, model and thinking level as the baseline table in
`docs/world/entities/usability.without-language-skill.md`, in the same scratch project, with
nothing in the prompt telling the session to open a reference first
(`@measured 2026-11-20 by pi --print --mode json --offline --approve --no-session
--no-context-files --tools eyg,read --model strata/qwen3.8-flash-next-iq3_s --thinking low
"$(cat .ai-work/usability/task-off.txt)"`, transcript `.ai-work/usability/ab/reference-task.jsonl`,
gitignored):

| measure | this change | the baseline in the claim above |
| --- | --- | --- |
| tool calls | 20 | 41, 93, 44 |
| calls with a non-zero exit | 12 | 26, 85, 28 |
| `builtin undefined` | 0 | 19, 57, 16 |
| wall | 353 s | 130, 418, 157 s |

The session called `action: "reference"` on its own, on its fourth call, before writing arithmetic;
it never hit an invented builtin, so the hint rows never had to fire. It still wrote the right
total (`36`) and quoted the refusal text, as every baseline round did - the cost of guessing was
always calls and time, not correctness. A separate probe asked the action directly and answered
the builtin count, the `read_file` field behind `ReadFile` and the name of the integer-add builtin
in one call, 39 s of session (`@measured 2026-11-20`, `.ai-work/usability/ab/reference-smoke.jsonl`).

UNVERIFIED: n=1 for the task run, one model, one thinking level, and the wall time is the slowest
of the four rounds measured so far, so the drop in calls is not yet shown to come with a time
saving. The hint rows are pinned by the unit test, not by a live run - this round never produced an
undefined builtin to attach them to. Whether a session that never thinks to ask finds the action at
all is untested; what is tested is that the error rows name it.

## Not this

- what the policy decides for one effect: `overlay.policy-rules`, and `action: effects` for the live answer;
- the baseline measurement and why the language-skill declaration loads nothing:
  `docs/world/entities/usability.without-language-skill.md`;
- where the capture comes from and who owns the upstream page: `guides.index`,
  `test/fixtures/surface.PROVENANCE.md`, `docs/world/decisions/ADR-003-doc-delegation.md`;
- the shape of the effect surface itself: `codemode.effect-surface`.
