---
name: pi-codemode-kept-bindings
description: Why a kept binding stores source text rather than a value, why one scope is a session record and two are files, and what reading in the host while writing through the policy costs
date: 2026-11-22
---

Four decisions the `extern` feature forces, argued here rather than in the code.

**The store holds source text, not a value.** A binding kept for a later call is written as
`let <name> = <the source the call wrote>`, and the next call gets that text in its prelude, so
the value is computed on the call that uses the name. What it buys: nothing to serialise, no
representation for a function or a record that the language does not have, no stale answer from a
source that reads a file or the clock, and a file a person can read, `git diff` and revert. What
it costs: every call that uses the name re-evaluates the source, so a binding whose source reads a
large file reads it again, and a binding is not a cache. The alternative - evaluating once and
writing the result - needs a data format for EYG values, which is a language feature, not a
renderer.

**Three scopes, and only two of them are directories.** `workspace` and `user` are directories of
modules beside the registry scopes of the same names; `session` is a custom entry on the session
branch (`pi.appendEntry("eyg-variable", ...)`), replayed by `variableEvents`/`replayVariables`
exactly as a grant is. What the branch buys is the property a name kept "for this session" should
have: a fork or a `/tree` jump carries the definitions the branch has and a truncated branch drops
the ones it cut, with no store to invalidate. What it costs: a session binding has no file to
delete, so the only way to change one is to keep the name again, and the feature grows one more
piece of state that lives outside the visible tree.

**Reading a scope happens in the host; writing one is an effect.** The tool lists the two
directories the way it lists a registry scope - with host file calls, no effect - and keeps a
binding by spawning a second program under the same policy and roots, whose every step is
`perform MakeDirectory` or `perform WriteFile`. What it buys: the tool never has a private channel
to disk, and the write of a binding is refused, logged and grantable like any other write. What it
costs: a second spawn per keeping call (one more run of the runner), and an awkward fact about
`run` - a run prints no value of its own, so a write program that only returns `[Ok, Error]` says
nothing. The generated program therefore prints each answer itself. Even then the printed rows are
not sufficient evidence: a policy that refuses `standard_out` along with `write_file` hides the
refusal, so `variableWriteOutcomes` counts a binding as kept only when the row said ok *and* the
file is in the directory when the run ends.

**A written module reaches its siblings by relative path, and a `<name>_lib` alias is refused.** A
file kept in `workspace` scope is tracked by the project, so it must not carry this machine's
absolute paths - an import of a sibling names `./sibling.eyg`, which resolves from the importing
file. The same reason refuses a binding whose source uses a library alias: `search_lib` is bound by
the call that passed `libraries`, not by the module written for a later call, and the fix this
package could offer was either an absolute path into the installed package (a machine path in a
tracked file) or an import inside the source. The second one is what the refusal says.
