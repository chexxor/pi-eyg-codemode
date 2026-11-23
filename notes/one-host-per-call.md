---
name: one-host-per-call
description: Why a program that handles its own effects is refused by parsing it before the run, why the check is the compiler's parse tree rather than a text scan or a type, and what the rule deliberately does not catch
date: 2026-11-23
---

The operator asked for a check on "the type of the expression passed into the `eyg-codemode`
tool", so that an agent cannot handle its own effects, with the execution refused and the reason
communicated back so the agent can fix it. What shipped is a parse of the program before the run
(`parseArguments`, `handledEffectLabels`, `handledEffectRefusal` in `lib/render-helpers.mjs`,
used by `extensions/eyg-codemode.ts`), because in EYG effect handling is a **syntactic
construct**, not a type: `handle Label(clause, body)` is a form the parser marks, and no type in
the language says "this expression installs a handler". The parse tree is where that fact lives.

**What the rule is actually for.** A `handle` clause inside the guarded body could never widen
what the policy allows: the guard sits outside it, and an effect the clause re-performs reaches
the guard and is decided again (boundary fact 5 of
`docs/world/entities/host.guard-boundary.md`, probed before this rule existed). What a clause
*can* do is answer the program instead of asking the host - print "the read was performed" for a
file nobody read, or swallow a refusal the tool would otherwise turn into an ask. That is a
falsified answer rather than an escalation, and it is invisible in the result rows, since the
program's own text reports the fabrication. So the check protects the honesty of what the model
is told, not the reach of the call.

**Why the compiler's parser.** A text scan for `handle` fires on the word in a string, in a
comment, and on any function named `handle`. The tree the binary prints for `-c <source>` is
tagged JSON, and the handler node is `{"0": "h", "l": "<Label>"}`; the tags were read off real
parses rather than assumed (`perform` is the same shape under `p`, a record field under `e`, a
tag constructor under `t`, a match pattern under `m`, a string under `s`), which is what makes
`h` a list of handlers and nothing else. `bin/agent/handler-scan.mjs` runs the two steps - parse,
walk - on a file, and `bin/agent/audit.sh` keeps a row that proves the refused fixture is still
named.

**Why it fails closed.** A parse that exits non-zero, or prints something that is not JSON,
refuses the call. That means a program whose effects were never listed is not run, which also
means the rule is a hard dependency on the binary answering `parse`. The officially installed CLI
does; a binary that does not stops every call rather than quietly running unchecked ones, which is
the same choice the package already makes about a missing policy or a missing guard.

**What it does not catch, and cannot.** The check is not transitive over imports: the parse covers
the text the tool assembles - the prelude of `import` lines and the program - and a clause written
inside a module that text imports installs inside the guarded body unnamed, which is measured in
`docs/world/entities/gap.one-host-check-not-transitive.md`. Closing that would mean the tool resolving
imports the way the compiler does, over a set the program itself chooses by naming paths. The type
row is no help either: per an operator-supplied report read off the language repository (UNVERIFIED
here), `handle L` deletes `L` from the effect row, but a function that handled an effect and one that
never needed one print identically, the row is closed against the platform only at the top level and
in a few builtin positions, and the language has no ascription, so "this module must be effect-free"
cannot be written. And a program can still simulate an effect in plain code - a function that returns
a made-up string where a read would have gone - and nothing in the host can tell that from a real one,
because the host only ever sees the effects that were performed. The rule removes the language's own
escape hatch, which is the one that is checkable; the rest is a model lying in its output, which is a
review question rather than a policy one. That is also why the limit above costs honesty and not
reach: the fabrication an imported clause performs is one the model could type out itself.

**Rejected.** Letting the clause run and relying on fact 5, since the answer rather than the reach
is the harm. A textual scan, for the false positives above. A type-level check, for the reason in
the first paragraph. Refusing at the guard instead of before the run, which would let the program
start and would report the refusal as a runtime error rather than as a fixable argument.
