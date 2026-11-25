---
name: a retired CLI mechanism stays retired, and one sweep keeps the notes from reviving it
description: why `bin/agent/policy-flag-sweep.mjs` matches the retired flag only in its runnable spelling, treats a mention under a dated heading as history, and ignores this package's own scripts' `--policy` argument; what that leaves uncaught, and the trigger that would justify widening the rule.
date: 2026-11-25
---

**The choice.** When the per-effect checks moved out of the runner's command line into `host/guard.eyg`
(`docs/world/decisions/ADR-006-guard-in-package.md`), the flag that handed a policy module to the
CLI went with them. Code cannot revive it - the tool's argv is `[mode, entry.eyg]` - but prose can
keep telling a reader to run it, and prose is where the stale instructions live. `bin/agent/policy-flag-sweep.mjs`
is the one check over that prose, wired as an audit row on 2026-11-25.

**What it calls a violation.** The retired flag in the one spelling that a reader could run today:
one of the CLI's mode words immediately followed by it. That is the shape that silently breaks - a
copy-pasteable instruction that names a flag no installed build reads any more. A mention that does
not sit under such a mode word is not a command line and is not reported.

**Why a dated heading is the label for history.** A note that captured a run is a record of the day
it ran; it stays true after the mechanism it captured is gone, and rewriting a captured transcript
would delete the evidence. So a mention under a heading that carries a date counts as history and
passes. The heading, not the line, carries the label: a paragraph cannot claim a date it does not
have, and a note that wants to report history has to name when it happened - which is the rule
`notes/prose-carries-no-dates.md` already pushes the other way.

**What it does not catch, and why that is the point.** Three things, each a deliberate cut:

- This package's own probe scripts still take a policy module as an argument
  (`bin/agent/secret-rule-probe.mjs --policy <module>`), and that flag belongs to a script this
  package wrote, not to the CLI. It is not the retired spelling, and special-casing it would have
  hidden the rule rather than narrowed it.
- A retired mechanism named in words - "the old run command loaded a policy module" - is not a
  command line, so it is not reported. That wording stays true as a description of the past; the
  thing that would be a lie is an instruction to run it.
- The sweep scans tracked text files only (`git ls-files`, the extensions a reader sees), so an
  untracked scratch note can still carry a stale command line. Scratch files are under
  `.ai-work/` or the system temp directory, and are not what an operator reads.

**Cost.** 0.05 s over the tracked tree, measured 2026-11-25 three times: `policy flag: retired true, 0 live
command-line mentions, 7 dated history mentions`, exit 0. It bites: a planted one-line file under
`.ai-work/security-docs/probes/` printed the row, answered `retired false, 1 live command-line
mention` and exited 1. The four live mentions it found on the day it was written were fixed in
place - one reworded away from the flag spelling, one dated as history, one captured transcript
given a dated heading.

**Trigger to widen the rule.** A second retired mechanism - the runner probe, the per-effect
inline policy, or a renamed tool parameter - that leaves the same shape of stale instruction
behind. Then keep one list of retired spellings in the sweep and let the audit row name it; do
not add a second sweep.
