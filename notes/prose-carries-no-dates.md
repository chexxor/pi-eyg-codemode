---
name: guides, README and skills carry no dated stamp; the date lives in the claim it measures
description: Why dated measurements were moved out of guides/README/skills and out of the generated surface file's header, what a capture tag names instead of a date, and what this costs a reader.
date: 2026-11-22
---

# The rule

Prose that tells a reader how to do something - `README.md`, `guides/`, `skills/` - carries no
date, no `@measured` stamp and no story about what a session saw. Every measurement stays in
`docs/world/`, in the record whose `verify:` command re-runs it. A guide states the rule and
links the record; the record carries the date and the command.

The same rule reaches two artifacts that are not prose:

- `guides/eyg-surface.tsv`, whose builtin rows are a dated capture. Its header names the page
  the capture came from and the page that records **when** (`test/fixtures/surface.PROVENANCE.md`);
  it does not carry the date itself. `node bin/agent/gen-surface.mjs --check` is what decides
  whether the rows are current, and `test/render-helpers.test.mjs` asserts that no date appears
  in the file, so the split cannot quietly collapse.
- The capture blocks in `guides/tool-reference.md`. Their tag reads
  `*[capture · the language repository]*` - where it was taken, never when. `docs/world/entities/overlay.policy-rules.md`
  carries the dates of those captures and of the language-page reads the same page quotes.

# Why

A date in instructional prose is read by a model as evidence about the present, and it rots
silently: nothing re-runs it, and its presence makes the sentence look checked. A date in a
generated data file says "someone refreshed this on <day>", which is a weaker claim than the one
the drift check actually supports. And a capture tag with a date invites a reader to weigh the
capture by its age, when what matters is that it was taken somewhere else and cannot be re-run
here.

The cost, stated honestly: a guide row no longer shows its own evidence, so answering "how do you
know?" is one hop away instead of zero, and the hop only works if the claim exists and still
passes. That is the failure mode this rule creates - a stamp deleted with nothing recording it -
and it is why the rule needs a gate over the prose rather than only an intention: the world-model
claim's `verify:` command is what says whether the number survived the move.

# What it does not mean

`docs/world/` and `notes/` keep their dates - they are the measurement record and the decision
record, and `AGENTS.md` prices its commands with dates for the same reason. `CHANGELOG.md` keeps
its history. And a dated fact may still be *true* in a guide, worded without the date:
"`eyg check` answers 0 for the shipped modules" is durable; "measured 2026-11-19, 0.43 s" is not.
