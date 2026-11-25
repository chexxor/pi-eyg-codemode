# What a call does: the life of one eyg tool call

*This page explains one mechanism end to end: what happens between the moment a model sends an
`eyg` tool call and the moment the result row is printed. The reference for the same ground is
`guides/tool-reference.md`, the tutorial is `guides/first-session.md`, and the language's own
prose is at <https://eyg.run/guides>. Each step names the file that holds it, and every step you
can see from a shell names the command that shows it.*

Why the sequence deserves its own page: "a program reaches the host only through effects, and a
policy decides every effect" is not a property of the EYG language, and it is not a rule the
model agrees to follow. It is built, out of two files written for one call plus the one record the
entry writes last, and deleted when the call ends. Once you know the order those files are written in, you can predict what a call will
do before you send it, and you can see what a program would have to do to get outside the checks.
The answer is: nothing, as long as the entry is the one the tool wrote - and the eighth section
prints what a call looks like when there is no entry.

The steps, in the order the tool does them:

1. [The argument is answered or refused first](#the-argument-is-answered-or-refused-first)
2. [The policy, the guard, the roots and the binary are resolved](#the-policy-the-guard-the-roots-and-the-binary-are-resolved)
3. [A prelude is prepended to the program](#a-prelude-is-prepended-to-the-program)
4. [The program is parsed before it is run](#the-program-is-parsed-before-it-is-run)
5. [The files go into a directory of their own](#the-files-go-into-a-directory-of-their-own)
6. [The guard decides every effect of the run](#the-guard-decides-every-effect-of-the-run)
7. [The tool prints what came back](#the-tool-prints-what-came-back)
8. [Run one call from a shell](#run-one-call-from-a-shell)

## The argument is answered or refused first

Before the tool touches a file or a process it checks the arguments: `action` must be one of the
actions it lists, `extern` must name a real scope and belong on an action that runs a program, a
child session must still have calls left in the budget its spawner set, and a `policy` argument
must name a policy this package ships. Each of those answers `eyg refused: ...` with `ran: false`
in the tool's `details` record.

That shape is the point of doing it first. A refusal that starts no process costs a fifth of a
second, does not spend one of a child session's calls, and does not consume a grant the operator
made - the tool counts a call against a grant only when the call reached a policy. Cheap refusals
are the ones a session retries after changing one word.

`action: "reference"` answers one step later: it reads `guides/eyg-surface.tsv` and prints the
builtins and the effect surface, so it answers on a machine with no binary installed at all.

## The policy, the guard, the roots and the binary are resolved

Four lookups, and two of them can end the call where they stand.

**The policy module.** The order of the slots is stated once, in the table "Which policy a call
gets" in `guides/how-to-write-a-policy.md`. What matters for the shape of a call is what the
resolution refuses: a `policy` argument naming a module this package does not ship, or one that
would widen the session rather than narrow it; a resolved path that is not absolute or does not
exist; and the case where nothing names a module at all, where the tool refuses to run anything
rather than run unchecked. An unchecked run would perform every effect the host can reach, so a
missing policy is an error rather than a default.

**The guard.** `host/guard.eyg`, resolved from the package directory the extension was loaded
from. A package whose guard is missing is refused: the guard is not a wrapper a call may do
without, and a call that cannot find one does not run the program anyway.

**The roots, and the binary.** The roots are resolved to a list of absolute paths and the binary
to one path - `EYG_CODEMODE_RUNNER` if it is set, otherwise `eyg` on `PATH`. Nothing is asked of
that binary before the run and nothing during it except the mode word and a file this package
wrote, which is why a missing or unsuitable binary is not caught here: it answers with one refusal
line at the run, naming the command that was tried.

The resolved values reach the policy as a **literal in a file**, not through the environment: the
entry writes `ctx = {roots, cwd, fields, protected}` (`contextLiteral` and `hostProtectedPaths` in
`lib/render-helpers.mjs`). A policy module cannot ask the host where it is or what it is guarding,
because it is imported before any handler exists and an effect raised at a module's top level is
never performed. That is also why `protected` has to be written down: the guard cannot discover
the package layout, so the tool tells it.

One freedom in that resolution: the policy module does not have to sit inside the roots. The entry
`import`s it and an import is not an effect, so the binary opens that file itself; a module in
`/operator/policies/mine.eyg` loads for a session rooted in `/work`. What the roots decide is
whether the *program* can `ReadFile` that same path, which is a different question the policy
answers like any other.

## A prelude is prepended to the program

The program the tool parses and runs is not quite the program the model wrote. In front of it goes
one line per name in the call's `libraries` parameter and one per binding this session kept with
`extern`:

```
let search_lib = import "/<package>/libraries/search.eyg"
```

Registry names resolve across three scopes - the project's `.pi/eyg-functions`, the home
directory's, and this package's `libraries/` - and a name that resolves in none of them is
refused rather than ignored, because otherwise the program would fail on an unbound name for a
reason the reader cannot see. Kept bindings are aliased in by name, and this call evaluates them,
which is what makes a kept binding answer with what its source computes now rather than with what
it computed when it was written (`guides/how-to-keep-bindings.md`, `guides/how-to-share-functions.md`).

The prelude is part of the text that gets parsed and the text that gets wrapped, so a library a
call loads is decided by the same checks as the call's own code.

## The program is parsed before it is run

The tool asks the same binary for the program's syntax tree - `[parse, -c, <the program>]`, one
action with no shell in between, five seconds of its own - and reads the answer before it runs
anything. Three answers stop the call:

- the parse exits non-zero, so the program does not parse and its effects cannot be listed;
- the parse prints something that is not JSON, so the same;
- the tree contains a `handle` clause for an effect, in which case the call is refused with the
  labels named.

The third is the rule "one host per call". A `handle` clause in the model's program cannot widen
what the policy allows - the guard sits outside it, and an effect the clause re-performs is
decided again - but it can answer the program instead of asking the host, and answering-instead-of-asking
is the boundary this package exists to hold. The question goes to the compiler's parser rather
than to a text scan, so the word `handle` inside a string, or a function named `handle`, is not a
refusal. A binary that cannot answer the parse stops the call: a program whose effects were never
listed is not run.

The refusal reads:

```
eyg refused: the program handles 1 effect(s) for itself (ReadFile), and a call has one host for
its effects: the guard. Remove the `handle` clause and perform the effect directly - the policy
decides it, a refusal comes back as a value you can match, and what is refused is listed by
action "effects". A wider host is the operator's to give (/eyg-grant), never a clause in the
program.
```

To run the two steps yourself - parse, then walk the tree for handler nodes:

```sh
node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg   # prints ReadFile
node bin/agent/handler-scan.mjs test/fixtures/refusal-probe.eyg   # prints nothing
```

## The files go into a directory of their own

The run gets a scratch directory named for the process, the moment and the call number, under
`$TMPDIR/pi-eyg-codemode/`. It holds the two files the tool writes and one more, `refusals.txt`,
that the entry writes after the guarded body; it is removed when the run ends, so
a call leaves nothing a later call could read.

`program.eyg` is the model's source inside one function, with nothing else added:

```
let run = (_) -> {
let n = !string_length("abc")
perform StandardOut(!int_to_string(n))
}
{run}
```

Wrapping rather than splicing is what keeps the model's text out of the file that decides the
call: it arrives as a module the entry imports, and an effect at a module's top level is never
performed, so import time is fail-closed and a module cannot pre-configure its own way out. The
trailing `{run}` is not decoration - a file that ends in a `let` aborts the run that imports it.

`entry.eyg` is the only file that imports anything, and it is generated:

```
let guard = import "/<package>/host/guard.eyg"
let policy = import "/<package>/policies/agent-roots.eyg"
let ctx = {roots: ["/<package>"], cwd: "/<package>", fields: [], protected: ["/<package>/host", "/<package>/policies"]}
let refusal_record = guard.build(policy.rules(ctx), ctx, (_) -> {
  let program = import "/<scratch>/program.eyg"
  program.run({})
})
let record_text = !list_fold(refusal_record, "", (line, acc) -> {
  !string_append(acc, !string_append(line, "\\n"))
})
perform WriteFile({path: "/<scratch>/refusals.txt", contents: !string_to_binary(record_text)})
```

The last three lines are the record. `guard.build` hands back every refusal its handlers answered,
as `label|reason` lines; the entry writes them to a file outside every root, after the guarded
body, where no handler and no policy decides that write. The tool reads it before removing the
directory and names the refusals the program never printed.

Print that text yourself with the same functions the tool calls:

```sh
node -e 'import("./lib/render-helpers.mjs").then(m=>process.stdout.write(m.entryProgram({guard:"/pkg/host/guard.eyg",policy:"/pkg/policies/agent-roots.eyg",ctx:m.contextLiteral({roots:["/pkg"],cwd:"/pkg",fields:[],protected:m.hostProtectedPaths({packageDir:"/pkg",policyPath:"/pkg/policies/agent-roots.eyg"})}),program:"/tmp/scratch/program.eyg",record:"/tmp/scratch/refusals.txt"})))'
```

Then one process: `<binary> <mode> <entry.eyg>`, started through argv with no shell in between, in
the session's working directory, with the call's timeout. Quoting cannot be a route around the
checks because there is no quoting: the entry path is one argument.

## The guard decides every effect of the run

Inside that process, `guard.build` installs one `handle` clause per effect row of
`guides/eyg-surface.tsv` around the body, and the body imports the program. From here the rule is
mechanical:

- An effect the program performs reaches the guard's clause for that label. The clause calls the
  policy's field with the value the program asked for and gets back `Pass(value)` - perform it for
  real, with the value handed back - or `Mock(reason)` - perform nothing and answer the program
  with `reason`. The guard, not the rule, chooses the *shape* of that answer, because the shape is
  the effect's own reply type; the table is at the top of `host/guard.eyg`.
- An effect the guard does not name has no host, so the run stops with `unhandled effect`. That is
  why naming every row is what makes the default a refusal, and why a new effect in the language
  is a red test here (`test/host-coverage.test.mjs`) rather than an open door.
- Paths are made absolute and collapsed before a rule sees them, because the binary hands over the
  path exactly as the program wrote it.
- The four change effects are refused first for any path under `ctx.protected` - the package's own
  `host/` and `policies/` - whatever the policy says. That refusal says `denied by the host`, which
  is how a program learns that asking for a grant will not help. Reading those same paths is not
  refused: the shield is about changing the rules a call runs under, not about seeing them.
- A `Search` is one decision for the root and then one per directory the walk lists, each under
  the `read_directory` field.
- `DecodeJSON`, `EYGParse`, `Hash` and `Sign` are recomputation over values the program already
  holds, so no field decides them and the guard re-performs them unchanged.

The stack a refusal prints shows the arrangement plainly - the guard is in the call stack of every
effect the program performs:

```
error: unhandled effect Foo({})
hint: handle this effect or run the program in a runtime that supports it

→ in program.eyg:6
 6 | perform Foo({})
     ^^^^^^^^^^^^^^^
  in entry.eyg:6 ({})
  in /<package>/host/guard.eyg:660 (fn(_) { ... })
```

Reproduce that one with `node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg`,
and check the handler list against the surface rows with `node --test test/host-coverage.test.mjs`.

## The tool prints what came back

The tool's answer is the runner's own output plus whatever the tool can add to make the outcome
actionable. The first line is the status - `eyg run: ran in 0.81 s wall`, `exit 1 in 0.12 s wall`,
`timed out after 2 s in 2.01 s wall` - then the program's stdout and stderr, then any of these:

`StandardOut` writes exactly the string it is given and appends nothing, so a program that prints
several values puts `\n` in its own strings if it wants them on separate lines. The
`(N output lines)` a result row names counts the newlines the run produced, not the number of
`StandardOut` calls: a program that prints `"a"` then `"b"` comes back as one line reading `ab`.

- **the ask**, for every refusal the run printed: what was refused - `write_file at /tmp/x`,
  `fetch asked for 127.0.0.1`, or `fetch` alone when the rule quoted nothing - the policy that
  refused it, and the exact `/eyg-grant` an operator would run: the first directory no root covers,
  "the refusal is a rule of `<policy>`, not a root" for a path already under one, or "no roots
  addition covers it" for a value that is not a path. Then the rule the ask follows - a refusal is a
  fact about one value, the operator is asked only when one blocks the task, and the ask names the
  addition, the reason for it and the intended use. A `denied by the host` refusal gets no such
  row, because no grant opens those paths.
- **the refusals the program did not print**, read from that record: a program that swallows an
  effect - `let _ = perform ReadFile({path: "/etc/passwd", offset: 0, limit: 10})` and prints something
  else - still gets the row naming what was refused, with the same grant ask the printed refusals
  get. The record names refusals the guard answered, so a run that aborts leaves no record at all.
- **the builtin list**, when the program named a builtin the runtime does not have - the runner's
  hint for that names no path, and a session whose only channel is effects cannot go and look.
- **the install line**, when the binary was missing or read the mode word as a file name, since
  that is an install problem and not a program error.
- **the eval hint**, when an `eval` call hit `unhandled effect`: `eval` performs nothing, so a
  program that performs an effect belongs on `run`.
- **the kept-binding rows**, when `extern` asked for names to survive into a later call.

The `details` record underneath carries the same facts as data: the argv that was run, the entry
path, the exit code, the roots, the policy and where it came from, the refusals, the prelude. That
is what an expanded row prints, and what a check can assert without a live session.

## Run one call from a shell

`bin/agent/refusal-probe.mjs` writes the same three files and starts the same command, from a
shell, in a fifth of a second:

```sh
node bin/agent/refusal-probe.mjs
```

```
argv: eyg run /tmp/eyg-refusal-probe-Z8wRkw/entry.eyg
policy: /<package>/policies/agent-roots.eyg  roots: /<package>  cwd: /tmp/eyg-refusal-probe-Z8wRkw  fields: (none)
write_file denied by policy: /tmp/eyg-refusal-probe-Z8wRkw/eyg-probe-refused.txt
exit=0
```

The flags are the interesting part, because each one is a different question about the same run:

| flag | what it asks |
| --- | --- |
| `--with-policy deny-all` | does the refusal come from the policy or from the guard? `deny-all` answers `write_file denied by policy` with no path, because it refuses without naming one |
| `--inside-roots` | does the roots rule or some other rule decide this path? The program's working directory moves inside the roots, so a relative path lands where a policy would let it through |
| `--program <file>` | what does one specific program get answered? The fixtures under `test/fixtures/` are the probes the claims in `docs/world/` re-run |
| `--fields read_file,standard_out` | what does a spawner's allowlist answer? That needs `--with-policy spawner-effects` |

The one thing to know before you try this by hand: **the guard comes from the entry, not from the
binary.** A program run on its own performs its effects on the binary's own host, with nothing
deciding them:

```sh
mkdir -p .ai-work
eyg run -c 'let w = perform WriteFile({path: ".ai-work/unguarded.txt", contents: !string_to_binary("no policy was asked")})
perform StandardOut("written")'
cat .ai-work/unguarded.txt      # the file exists; nothing refused it
```

That is why the entry is generated for every call and never typed by hand, and why the tool refuses
a call whose guard file is missing.

## What a call never does

- No shell, no package manager, no subprocess: the language has no effect that runs a command, and
  the tool's only process is the one it starts itself, through argv.
- No write outside the scratch directory by the tool itself. Every file a program touches is an
  effect the policy decided; the scratch directory is written by the tool before any policy exists
  and removed in the same call.
- No reading of the program's text by the guard. The guard never parses what it is running - the
  parse pass happens in the tool, before the run, and the guard only imports the module.
- No policy change from inside. A call may narrow its own policy or name nothing; widening comes
  from a grant, a project setting or an environment variable, none of which a program writes.
- No second session unless the model calls `eyg_subagent`, and no child of a child.

## Not this

- Not the reference: `guides/tool-reference.md` carries the knobs, the environment variables, the
  row shapes and the two one-host rules.
- Not the boundary probes: `docs/world/entities/host.guard-boundary.md` holds the facts the guard
  rests on, each with the command that re-runs it.
- Not the language: syntax, builtins and every effect are at <https://eyg.run/guides>, and
  `guides/eyg-surface.tsv` is this package's generated copy of the names.
- Not the tutorial: `guides/first-session.md` gets you to one performed effect in five steps.
