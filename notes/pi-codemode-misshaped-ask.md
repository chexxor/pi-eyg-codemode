---
name: pi-codemode-misshaped-ask
description: Why a mis-shaped ask inside the guarded entry answers nothing for the whole timeout, and why the tool pays one extra CLI start per model call to name that mis-shape before the run starts
date: 2026-11-25
---

A mis-shaped ask - `perform MakeDirectory({ path: "eyg-misshaped-ask" })`, a record where the
effect wants a `String` (`test/fixtures/misshaped-ask.eyg`) - used to answer nothing at all: the
guarded run spent the whole spawn timeout printing 0 bytes. The tool now names it in a quarter of a
second, and this note records what the fix is and what it costs.

**The mechanism: the CLI's error renderer, not a loop.** The CLI does not spin on the mis-shape -
it reaches the type error at once and then *prints its report*, and the report is the CLI's own
value inspector over its whole interpreter state. Every traced AST node carries the whole source
text of the file it came from, and every environment carries the builtins dictionary, so the report
grows with the size of the module graph, not with the size of the mistake. Probes on 2026-11-25:

- unguarded, one small file: the mis-shape errors in 80-129 ms and the report follows the padding
  of the file it lives in - 1 KB -> 23714 bytes, 4 KB -> 35654, 16 KB -> 65534
  (`.ai-work/security-docs/probes/pin2/`);
- on the entry this package writes, which imports 23.8 KB of `host/guard.eyg` and 9.8 KB of
  `policies/agent-roots.eyg` **inside the guarded body**, the report needs gigabytes: RSS read 584
  MB then 4.35 GB across 24 s at 0 output bytes, and under `ulimit -v 2000000` the run stops at
  14.8 s with `RangeError: Out of memory` inside the CLI's `inspect`/`#customType`/`map` (Bun v1.3.13);
- nothing about the guard loops: the same mis-shape under seven nested handler clauses in one small
  file errors in 0.076 s.

So the cost is a print, and the print is only big because the entry is big. The cheap answer was
already there: `eyg check` of the same entry names the same mis-shape in 240 ms with 458 bytes.

**The fix: check the entry before the run, and report only `error: type mismatch` rows.**
`entryCheckArguments(entry)` builds the second argv `[check, entry]`, `entryCheckMisshapeRows` keeps
the lines that start `error: type mismatch`, and `misshapedAskRows` adds the rows the tool prints -
the effect surface file and the language docs, plus a line saying nothing ran. The check of the
entry, not of the program, is the point: the entry is the file that imports the guard and the policy,
so its errors are about the arrangement the run is about to use, and the check costs the same either
way.

Soundness was measured, not assumed: 13 program shapes were each written into an entry exactly as the
tool writes it (`programModule`, the `libraries` prelude, a session-scope keep inlined, a file-scope
keep with its module actually written by `variableModule`) - every **well-shaped** entry answers
exactly one error line, `error: missing row 'Abort'`, at 234-246 ms and 408 bytes. That row is the
guard's own `perform Abort` for a label with no policy row, and the run names it better and cheaply,
so it is not a problem here. A parse failure answers `error: missing reference <scratch>/program.eyg`,
and a guarded run of a program that does not parse already answers cheaply. An invented effect label
and a non-effect type error both answer cheaply in the run. The measured stall family is exactly the
`error: type mismatch` rows, which is why the pre-flight reports only those and carries no named
exemption list (`.ai-work/security-docs/probes/entry-check-cases.mjs`).

**The channels that were rejected, with what they cost.** `eyg check <program.eyg>` alone is not a
pre-flight: 65-131 ms, it prints the inferred `run` type and no error line for the mis-shape, because
the mis-shape is only a type error once the effect's own record type is in scope - inside the entry.
Bounding the run's memory with `ulimit -v` is not a knob the tool has, and even under it the run
still took 14.8 s to answer a `RangeError`. Improving only the timeout message leaves the whole cap
in place and says nothing about the cause.

**What it costs the session.** One extra CLI start, `ENTRY_CHECK_TIMEOUT_MS` 5 s of its own, on the
model's own `run`/`eval` call only: 0.234-0.246 s measured per well-shaped entry. The probe sites
(the effect probes, the registry availability probes, the extern write program) pass `precheck:
false` - their programs are this package's own and their shapes are unit-tested - and the knob is
that per-site flag, never a widening of what the check reports. `bin/agent/misshape-probe.mjs` is the
re-runnable record: it runs the check of an entry and never starts the run, so a mis-shape costs it a
named row and a well-shaped entry costs it `0 mis-shaped ask(s)`.
