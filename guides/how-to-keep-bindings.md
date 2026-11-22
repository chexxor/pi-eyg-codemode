# Keep a binding between calls

A name defined in one call is gone from the next: every call gets a program of its own, and the
usual result is a session with four copies of one function. `extern` keeps the call's top-level
`let` bindings by name. What is kept is the binding's **source text**, so a later call evaluates
that source and answers with what it computes now - a binding whose source reads a file, the
clock or the environment is never a value frozen at the call that wrote it.

The steps are:

1. [Define it and keep it in one call](#define-it-and-keep-it-in-one-call)
2. [Choose a scope](#choose-a-scope)
3. [Name it the way EYG binds](#name-it-the-way-eyg-binds)
4. [Read what the keep answered](#read-what-the-keep-answered)
5. [Change a binding, or drop one](#change-a-binding-or-drop-one)
6. [When a kept binding breaks the next call](#when-a-kept-binding-breaks-the-next-call)
7. [How these shapes were checked](#how-these-shapes-were-checked)

## Define it and keep it in one call

`extern` names a scope, and it belongs on `action: "run"` or `action: "eval"`: the argument keeps
what a program defines, and a probe such as `action: "effects"` defines nothing.

```eyg
// one call: action run, extern "workspace"
let parse_front_matter = (text) -> {
  // ...
}
parse_front_matter("name: x\n")
```

The bindings kept are the program's top-level `let`s, ordered so that each one comes after the
bindings of the same keep its source names; a group of helpers stays a group. A `let` inside a
function body belongs to that body rather than to the program, and a destructuring
`let {a, b} = ...` is reported as not kept, because its value is a pattern rather than one
expression that could be written back out.

One binding is one module, at `.pi/eyg-variables/<name>.eyg`, and the module is the source and
nothing else:

```eyg
// /abs/project/.pi/eyg-variables/parse_front_matter.eyg
// A binding kept by the eyg tool's extern argument; a policy decided this write.
// Only the source text below is kept: a call that uses this name imports this file,
// so the value is computed again on that call rather than stored.
let parse_front_matter = (text) -> {
  // ...
}
{parse_front_matter}
```

The next call's program begins with one line per binding it can see, which is the whole of the
aliasing and why no `libraries` argument is needed:

```eyg
let {parse_front_matter} = import "/abs/project/.pi/eyg-variables/parse_front_matter.eyg"
```

Nothing is kept when the program did not finish:

```
nothing kept: the program exited 1, so its bindings were not written
```

so a crashing call cannot leave half a name for the next call to trip over.

## Choose a scope

| scope | where it lives | for |
| --- | --- | --- |
| `session` | this session's own records, no file | a name one session will reuse |
| `workspace` | `<the session directory>/.pi/eyg-variables/` | a name this project tracks, in git like any other file |
| `user` | `$HOME/.pi/eyg-variables/` | the same name in every workspace on this machine |

A nearer scope wins a name and the further one is reported as shadowed, which is the order the
registry scopes follow in `guides/how-to-share-functions.md`.

Reading a scope directory is host-side work the tool does, as it does for a registry scope.
Writing one is not: the tool runs a second program in which every step is an ordinary effect -

```eyg
let made = perform MakeDirectory("/abs/project/.pi/eyg-variables")
let write_1 = perform WriteFile({path: "/abs/project/.pi/eyg-variables/parse_front_matter.eyg", contents: !string_to_binary("...")})
```

- and prints each answer, so the policy in force decides that write exactly as it decides any
other. Outside the roots it comes back as the refused effect it is, and the call adds the rows
naming the grant that would have allowed it:

```
write /abs/project/.pi/eyg-variables/parse_front_matter.eyg: write_file denied by policy: /abs/project/.pi/eyg-variables/parse_front_matter.eyg
```

`user` scope sits outside the roots the shipped policies give a session, so keeping a binding
there is refused until the operator widens the roots over `$HOME` - and a `workspace` binding
travels with the project, which is usually what "in every workspace" was after.

A `session` binding is a record on the session branch: a fork or a `/tree` jump replays the
definitions the branch carries, and a jump to a branch before a definition drops it.

## Name it the way EYG binds

A binding name is lower snake_case, because that is the case EYG binds: `my_web_search`, not
`myWebSearch`. A call asked to keep the camelCase name answers with the name it can use:

```
not kept: myWebSearch - myWebSearch is not a name EYG can bind: a binding name is lower snake_case - a letter first, then letters, digits and underscores, so name it my_web_search
```

Four more refusals come back with the reason written out instead of a module that would not work.
A word the parser reserves for its own forms (`let`, `handle`, `perform`, `match`, `import`)
cannot be a name. A name ending `_lib` cannot either: that is the suffix a call's `libraries`
argument binds its modules as. A binding whose source *uses* a `<name>_lib` alias is not kept,
because the alias comes from the call's argument and is not in scope inside the module - import
the module inside the source instead. A binding that names itself is refused, since a module
cannot import itself and recursion in EYG goes through `!fix`; two bindings that name each other
are refused with the cycle printed, because no order writes them.

## Read what the keep answered

The result row names every binding the call was asked to keep:

```
kept parse_front_matter in /abs/project/.pi/eyg-variables/parse_front_matter.eyg
did not keep note: write_file denied by the policy in force
```

a `session` binding names the store rather than a path
(`kept note in session scope (this session's records)`), and expanded the call adds the program it
wrote with and that program's own answer. `details` carries `extern`, `externProgram`, `variables`
(one `{name, scope, path, written, problem}` per binding) and `kept` - every binding that call
could see, by name and scope. Whether a file-scope binding was kept is answered from two halves:
the row the write program printed, and the scope directory read afterwards. A policy that refuses
the printing along with the write therefore cannot turn a refused write into a `kept`.

## Change a binding, or drop one

Keeping a name again in the same scope replaces it: a file scope's module is written again, and
for `session` scope the newest definition on the branch wins. A file-scope binding is an ordinary
file, so dropping one is `DeleteFile` on its module - inside the roots, decided by the policy like
any other delete. A `session` binding has no file to delete, so the fix is to keep the name again
with the source you want, or to move to a branch that predates it.

## When a kept binding breaks the next call

A module edited by hand, or half-written, aborts every later call that imports it, and the
runner's abort names the file without saying what to do about it. The tool answers the fix:

```
the kept binding in /abs/project/.pi/eyg-variables/note.eyg is not readable EYG: unexpected end of input hint: program must end with valid expression
fix it before the next call: define note again with an extern call, or delete the file with DeleteFile
```

Editing one by hand means keeping the shape above: a module has to end with an expression, and
the trailing `{note}` is the record the import line takes the name out of.

## How these shapes were checked

`bin/agent/check-variable-shapes.mjs` runs the shapes this page shows: it scans a sample program,
writes the modules the scan produces, imports them back and compares the answer to what the source
computes, and then shows a write that does not land reported as not kept. That script starts the
CLI with no policy, so it proves the generated text is valid EYG and that a kept module round
trips; the policy deciding a write is a separate fact, and
`docs/world/entities/pi.variable-scopes.md` records which half was seen how.

## Not this

- Not the function registry. `guides/how-to-share-functions.md` covers read-only directories of
  modules carrying a `metadata` record, bound as `<name>_lib`; a kept binding is a name in your
  own program, written by the tool, and the two never share a directory.
- Not a value. Only source text is kept, so something computed once and reused as data is a file
  a program writes with `WriteFile`, not a binding kept with `extern`.
- Not a grant. What a kept binding's first use may *do* is the policy's decision on that call, and
  `guides/how-to-write-a-policy.md` is where roots and refusals are settled.
