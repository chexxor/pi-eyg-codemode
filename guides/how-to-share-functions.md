# Ask the registry before you write a helper

A helper written twice in a session is a helper the session should have found first. The
tool keeps a read-only registry of function-sets, and one call asks it.

The steps are:

1. [List what exists](#list-what-exists)
2. [Read one function-set](#read-one-function-set)
3. [Bind it in your program](#bind-it-in-your-program)
4. [Write your own when none fits](#write-your-own-when-none-fits)
5. [Read what the registry reports](#read-what-the-registry-reports)

## List what exists

Call the tool with `action: "list_functions"` and `code: ""`. The answer names how many
function-sets it found and how long the query took, names the three scopes in the order it
read them, then gives one block per set:

```
search  [package] <the installed package>/libraries/search.eyg
  signature: search_lib.search({root, pattern, limit}) -> List(String)
  description: Absolute paths of the files under `root` whose path relative to it matches `pattern` ...
  effects: ReadDirectory (available)
```

This package ships one set, `search`, so a listing that names none means the tool read no
scope that exists - the package scope is missing when the installed package has no
`libraries/` directory.

## Read one function-set

`action: "describe_function"` with `function: "<name>"` prints the scope, the module path,
the signature, the description and `body performs:` - the effects the module's own text
performs. A name the registry does not have answers

```
eyg describe_function: <name> is not in the registry in <scopes>
```

and names the directories it looked in, which is the same list the listing header gives.

## Bind it in your program

`libraries: ["<name>"]` binds `<name>_lib` before your program runs, and the metadata
`name` is how you reach into it: the module's last expression is the record it exports, so
`search_lib.search({root, pattern, limit})` reads the `search` field of the set named
`search`. The same name resolves through the three scopes in order, and first match wins,
so a session can override a shipped set without editing the package. A name that resolves
nowhere is refused rather than left unbound:

```
no module named <name> is shipped in this package or in the registry scopes <scopes>. List the registry with action list_functions, or write the program without it.
```

The scopes, in order:

| scope | directory | for |
| --- | --- | --- |
| workspace | `<the session directory>/.pi/eyg-functions/` | a set this session needs |
| home | `$HOME/.pi/eyg-functions/` | the same sets, in every workspace on this machine |
| package | `<the installed package>/libraries/` | what this package ships, such as `search` |

## Write your own when none fits

One `.eyg` module per function-set, sitting directly in a scope directory. The tool reads
the scopes and never writes, moves or creates in them, so you write the file with the
ordinary file effects, inside the roots. The walk lists `.eyg` files in one directory and
does not descend, so a subdirectory is invisible rather than half-read.

The module ends with what it exports and carries the record the registry reads:

```eyg
let metadata = {
  name: "case_file",
  description: "One sentence on what the set answers, in the words a reader will call it by.",
  signature: "case_file_lib.find({root, pattern, limit}) -> List(String)",
  effects: ["ReadDirectory"]
}

{find}
```

The scan of a module is deliberately narrow, so write the record exactly as above: `let
metadata` bound to a record whose closing brace starts its own line, the four keys as
double-quoted strings, and `effects` a list of double-quoted effect names. A module in
another shape is reported rather than guessed at, as
`no \`let metadata = { ... }\` record: name, description, signature and effects are not
declared`.

`effects` names what the whole module performs, helpers included, and it is cross-checked
in both directions against the `perform` names in the text. Both mistakes are reported:
`performs ReadFile but does not declare it` and `declares ReadDirectory but the body does
not perform it`. An undeclared effect matters because the listing warns a caller about the
declared ones only, so the annotation cannot go stale quietly.

## Read what the registry reports

Availability beside an effect is advisory, not a second check: it is re-probed at every
query, the policy in force can change between calls, and running a set whose effect is
refused gets the ordinary `Error("<field> denied by policy: ...")` value inside the program.
A set whose name is already in a nearer scope is reported as
`registry error: <path>: <name> is shadowed by <path>`; the nearer one answers, and the
shadowed one is still named so an override is visible.

## Not this

- The registry is not the hub. Publishing a module, and the `@<pkg>` and `#<cid>` forms the
  CLI takes, belong to the language, and publishing remains the operator's act.
- `search` already walks for names. Write your own set when the answer differs, not when the
  walk does.
- A set is not a policy. What its effects may do is the preset's decision, in
  `guides/how-to-write-a-policy.md`.
