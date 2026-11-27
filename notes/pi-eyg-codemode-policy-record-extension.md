---
name: pi-eyg-codemode-policy-record-extension
description: Why an operator who wants one handler changed must copy a whole policy file, what EYG's record update does and does not reach, and the ask this package cannot implement for itself
date: 2026-11-21
---

**The ask an operator makes is one line long.** "Let me search only hosts I name" is one
handler. Today it is a file: to change one handler of a policy you did not write, you copy
that policy and edit the copy. `policies/spawner-effects.eyg` is that copy inside this
package - `agent-roots.eyg` with an allowlist bolted on - and the copy is the cost this note
records, not a decision to relitigate (`notes/spawner-effect-allowlist.md` carries why the
allowlist is a copied file rather than a generated one, and names the drift as a known cost).

**The duplication is countable, and the count is a command rather than a number here.** Run
`grep -v '^//' policies/agent-roots.eyg | sed '/^ *$/d' | grep -Fxc -f policies/spawner-effects.eyg`
and read the line count it prints: that many non-comment lines of `policies/agent-roots.eyg`
appear verbatim in `policies/spawner-effects.eyg`. The sixteen handler names the two files share
come from `grep -o 'let [a-z_]* = ' policies/agent-roots.eyg | sort -u | grep -cxF -f <(grep -o 'let
[a-z_]* = ' policies/spawner-effects.eyg)`. A number written down instead ages the moment a policy
line moves - the sentence that carried one measured 75 on 2026-11-21 and the same command answered
93 on 2026-11-26, which is why `bin/agent/doc-checks.mjs` now refuses the class (`line-count`,
`docs/world/entities/doc-checks.line-count.md`). Every rule that changes must be changed twice,
and nothing in this tree runs either file against a host to catch the drift.

**What the language already has is record update, and it is not this.** `{age: 31, ..person}`
overwrites fields *already in the record*, and a new field "fails with a missing field"
(<https://eyg.run/guides/eyg-syntax-guide>, "Record Update (Overwrite)"). That reaches a record
the *program* holds as a value. A policy is not such a value: the runner loads the module as the
checks around the program, and a policy module in this package imports nothing outside itself
(`invariant.policy-self-contained`, `notes/pi-codemode-policy-inlining.md`). Importing a policy
module from a program is measured to fail for its own reason - a module that performs effects at
its top level asks them of the running program: `error: unhandled effect
Env("EYG_ALLOWED_ROOTS")`, 0.11 s wall (`@measured 2026-11-17`, the row in
`notes/pi-eyg-codemode-workspace-port.md`).

**The feature asked for is record extension** - extend or override the record the host loaded -
written in the operator's
form as `{ WebSearch: my_search } \ existing_policy`: add a handler for a field the loaded
policy does not carry, or replace one it does, without owning its file. (`WebSearch` is the
operator's example, not an effect on this surface; the shape is the same for any field.) A
`\`-style difference is only one spelling; what is wanted is that the record a `--policy`
module returns can be the base of a narrower or wider record written somewhere else.

**Rejected, with the reason.** *Import the base policy from inside this package* -
`policies/` is one package, so the self-containment invariant would allow it, and it was still
refused: the base module performs `Env` at its top level, so the imported record's roots come
from the importing process's environment rather than from a file a reader can quote, and the
resulting decision is no longer readable in full where it is used, which is the whole reason
the policies were inlined (`notes/pi-codemode-policy-inlining.md`). *A `narrow(base,
overrides)` helper shipped in this package* - it needs `base` as a value, which is the same
import, so it collapses into the option above. Neither is a gap in this package's code.

**This package cannot close it.** The operator lives in the language: a compiler and a runner
this tree does not build. The ask is filed upstream and held here as
`docs/world/entities/gap.policy-record-extension.md`, whose command goes red when the shape
exists. Trigger to close it: a language release in which a `--policy` module can extend or
override the record another module returned - then `policies/spawner-effects.eyg` shrinks to
the handlers it changes, `notes/spawner-effect-allowlist.md` loses its drift paragraph, and the
gap record moves with the new evidence.
