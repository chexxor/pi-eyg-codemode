---
name: pi-codemode-refusal-record
description: Why a swallowed refusal reaches the tool through a file the entry writes last, and not through stdout, a print inside a policy rule, the exit code or an abort; why `agent-roots.eyg`'s Env rule had to gain a reason; the two bounds on the record
date: 2026-11-25
---

A refusal is a value the program may ignore: `let _ = perform ReadFile(...)` prints
nothing and the call still exits 0, so a session that never reads the value it got back
learns nothing and gets a result that looks like success. The guard now keeps the refusals
it made as its own value - `build` in `host/guard.eyg` returns a `List(String)` of
record lines - and the entry writes them to a file of the call as its last line
(`RECORD_FILE` in `lib/render-helpers.mjs`). Four other channels were tried and rejected
before that shape was written.

**The list threads out of each handler because EYG has no mutable cell.** There is nothing
a handler could add to: each `handle` clause calls `resume` and then puts its own line in
front of the list `resume` hands back, so `Mock(reason) -> { let rest = resume(Error(reason)); [<label>|<reason>, ..rest] }`
is the only way the refusals get out, and that is why `build`'s innermost layer ends in
`[]` rather than in the body's value. The order of the lines is the order the refusals
happened, which is what the grant ask reads.

**stdout is not the channel.** A trailer printed on stdout is forgeable: `StandardOut` is
a checked effect, so a program that printed the words `read_file denied by policy: /tmp/x`
itself would be believed, and the tool already greps stdout for refusal hints
(`refusalHints` in `lib/render-helpers.mjs`) to shape the grant ask. The record is a second
source of the same facts, and the tool only prints rows for refusals it cannot find in the
program's own output - so a program that reports its own refusals gets them once, and one
that swallows them gets them at all.

**A print inside a policy rule is the channel that cannot work.** The record has to exist
under every policy including the narrowest, and a rule that answered `Mock` while also
printing would be swallowed by exactly the policy that refuses the print - `deny-all.eyg`
refuses `StandardOut` and `StandardError` by name, so the record would be missing precisely
when the refusal matters most. Keeping the write outside the guarded body is also what keeps
it out of the operator's reach: no rule decides it, so no rule can be written that turns it
off or forges it.

**The exit code loses what the answer needs.** A count of refusals would be enough to say
"something was refused", but the grant ask the tool prints needs the effect field and the
value that was refused (the path, the name), and a program that exits 0 after swallowing
every refusal already owns the exit code. A guard abort for the same reason is out: it
would change what a refused effect means for the running program, and a refusal is a value
the program is allowed to ignore.

**Two bounds, both deliberate.** An aborted run leaves no record: a refusal of `now`,
`random`, `flip` or `exit`, or the program's own `Abort`, stops the program before the entry
reaches its last line, so only the CLI's own `Aborted with reason:` survives and the record
comes back empty (`bin/agent/refusal-probe.mjs` prints `(none recorded)` for that case). And `eval` mode gets no record file at all, because eval has no host
for any effect and a trailer write there would answer `unhandled effect` and buy nothing
(`runGuarded` in `extensions/eyg-codemode.ts`). The record file sits in the call's scratch
directory, outside every root, so the program can neither read it nor overwrite it, and the
scratch directory is removed when the run ends - the tool reads the record before that
removal.

**The Env rule had to gain a reason, and the decision did not change.** A record line is
`<label>|<reason>`, so every `Mock` the guard reads has to carry a `String` reason; the
Env rule used to answer `Mock(None({}))`, a shape with no text in it. `policies/agent-roots.eyg`
now answers `env: refuse("env")` and the guard still hands the program `None({})`, so the
decision content is byte-for-byte the same refusal and what changed is where the words live.
`policies/spawner-effects.eyg` carries the same fix. This is not a widening: the effect is
refused in both policies before and after, and no path or root moved.
