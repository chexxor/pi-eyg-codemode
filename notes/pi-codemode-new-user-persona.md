---
name: pi-codemode-new-user-persona
description: A fresh session run as a first-time user of this package, what it hit, the four issues that are this package's to fix, and the command that re-runs the experiment
date: 2026-11-26
---

## The experiment

One scratch project under `.ai-work/personas/2026-11-26-todo-mari/project/`, its
`.pi/settings.json` declaring this package and turning the builtin codemode off, and
one fresh session with `--tools eyg` and no context files, asked to build a JavaScript
to-do app. The persona is a developer with modest software experience, passing EYG
knowledge, and prior habit with Pi and Claude Code; its six expectations are in
`personas/2026-11-26-todo-mari/persona.md`. Re-run:

```
pi --print --mode json --approve --no-context-files --tools eyg \
  --provider strata-server --model qwen3.8-flash-next-iq3_xxs --thinking medium \
  "<the persona prompt>"
```

Cost: 440 s wall is the budget for a three-call session, and this one spent 32 calls, so
budget for the calls and run it in the background. The artifacts it left: `index.js`
(2374 B), `README.md` (845 B). The transcript is `.ai-work/personas/2026-11-26-todo-mari/run.jsonl`
- untracked, so the record of the run is this note plus that file on disk.

## What the transcript says

The run answered 32 `eyg` calls: 12 performed, 2 parse refusals, 9 type mismatches,
3 guard refusals, 1 timeout at the 30 s cap, 5 info actions. Counted by replaying the
transcript, not by the model: its own final report said 24 calls, and the transcript
says 32. **A session's self-count of its calls is not evidence**; the tally comes from
the `toolResult` parts in `run.jsonl`.

## The issues that are this package's to fix

1. `action: eval` never prints the value. `code: "!int_add(1,2)"` in eval mode answers
   `[]`; the same file through the CLI on PATH answers `Integer` and `3`
   (`printf '!int_add(1,2)\n' > /tmp/ev.eyg; eyg eval /tmp/ev.eyg`). `resultLines`
   (`lib/render-helpers.mjs:1397`) prints stdout text and refusal rows, and eval writes
   no refusal record (`extensions/eyg-codemode.ts:530`), so nothing carries the value.
   A model cannot use eval to check a builtin's shape, which is what the tool's own
   description promises ("eval is pure, prints the value").
2. A mis-shaped ask against an **unchecked** effect costs the whole call cap and prints
   nothing. `perform DecodeJSON({json: "[1,2]"})` guarded: `eyg run: timed out after 40 s
   in 41.39 s wall`. The same program bare answers `error: type mismatch given: Binary
   expected: {json: String}` in milliseconds, and `bin/agent/misshape-probe.mjs --program`
   on it names no mis-shape in 0.43 s. The reason is in the guard: `host/guard.eyg:673`
   hands `DecodeJSON` its `value` with no type pinned, so the entry check cannot see the
   mismatch. The audit row "a mis-shaped ask costs a named answer, not the spawn cap"
   tests only `test/fixtures/misshaped-ask.eyg`, so the guarantee holds for the effects
   whose clause pins the type and not for the four unchecked ones.
3. The surface file cannot answer the question the refusal text sends a model to it for.
   Every type-mismatch row says to re-check the ask against the effect's own row in
   `guides/eyg-surface.tsv`; the 23 effect rows carry the name and the policy field and
   nothing else (`awk -F'\t' '$1=="effect"{print NF"|"$4}' guides/eyg-surface.tsv` answers
   `4|` for all 23). So `DeleteFile`'s bare-`String` argument and `WriteFile`'s
   `{path, contents: Binary}` are learnable nowhere in the offline surface, and the persona
   needed three calls to get one deletion right.
4. The CLI's own hint for an effect the runtime does not implement points at the route this
   package forbids. `perform RunProcess({...})` answers `error: unhandled effect RunProcess(...)`
   with `hint: handle this effect or run the program in a runtime that supports it`, and the
   next thing the model tries is a `handle` clause, which the tool refuses. `bin/agent/invented-effect-probe.mjs`
   proves the effect reaches nothing, so the safety is right; the wording is the language's and
   the package can add a row that names the boundary instead.

## What is not this package's to fix

The persona could not run the thing it wrote: there is no effect that starts a process, by
design, and no policy field would grant one. It asked for `Env` too and got the refusal text
that says no roots addition covers it, which is the intended answer. Whether the read refusal
for `guides/eyg-surface.tsv` (a project cwd is not under the package's roots) names
`action: reference` as the reachable route is unchecked here - the persona hit it, and the
row's own text is the thing to read before deciding it is a fix.
