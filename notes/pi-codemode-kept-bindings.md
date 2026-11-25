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

**An effectful kept source is refused at the keep, and an effectful module on disk is excluded at the read - added 2026-11-25.** A binding whose source performs an effect can be neither kept nor read back: the store holds source text, and a call that names the binding evaluates that text in that call's prelude, before the call's own program, so an effect in kept source happens on every later call that can see the name - including one that only wanted a value. What it buys: no call in the workspace can acquire an effect it did not ask for, and an operator's probe leaves a report rather than a file that writes on every later session. What it costs: a program that must perform effects has nowhere to keep it, which is the function registry's job.

The two halves of the rule are deliberately different. At the **keep** the call refuses: a session just asked for that binding, so a silent drop reads as a keep that worked, and the refusal names the module a reader has to go delete and `eyg-functions/<name>.eyg` as the way out. At the **read** the same sentence is only a report and the binding is dropped from the prelude, because the file may already sit there - written by a session that predates the rule, or edited by an operator - and refusing there would fail every later call in the workspace with no act that call could take in the same breath. Read-time exclusion is therefore not a polish on the keep-time refusal: `keptBindings` re-reads the scope on every call, so a keep-time-only rule leaves the case an older session wrote live forever through the file it left behind.

The scan is `effectsUsed`, the one this package already runs for `action: "effects"` and for the availability probe - a second scan would have disagreed with the first about what a program does. It is textual over `perform` and the effect names, so a comment naming an effect refuses a binding that only looks effectful. That over-estimate is the direction that is safe: excluding on a look costs one re-keep, letting an effectful source through costs an effect that runs in every later call (`.ai-work/keep-proof/PROOF-keep-2026-11-25.md` quotes both halves, seen live).

**A written module reaches its siblings by relative path, and a `<name>_lib` alias is refused.** A
file kept in `workspace` scope is tracked by the project, so it must not carry this machine's
absolute paths - an import of a sibling names `./sibling.eyg`, which resolves from the importing
file. The same reason refuses a binding whose source uses a library alias: `search_lib` is bound by
the call that passed `libraries`, not by the module written for a later call, and the fix this
package could offer was either an absolute path into the installed package (a machine path in a
tracked file) or an import inside the source. The second one is what the refusal says.
