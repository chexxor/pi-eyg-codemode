# Spawn a subagent inside your own reach

A chunk of work you can state completely - search fifty files, apply one mechanical change to
twelve of them - does not need this session's attention. `eyg_subagent` starts a second pi
session in the same directory, gives it the tools you name from a two-name allowlist (`eyg` alone
by default), and brings back what it did. The child cannot do anything the spawner could not do
itself, which is the whole design: a subagent narrows reach, it never widens it.

The steps are:

1. [What the child is given](#what-the-child-is-given)
2. [Narrow it to a slice](#narrow-it-to-a-slice)
3. [Name the effects, count the calls](#name-the-effects-count-the-calls)
4. [Read what comes back](#read-what-comes-back)
5. [What a child can never get](#what-a-child-can-never-get)
6. [How the child gets the package at all](#how-the-child-gets-the-package-at-all)

## What the child is given

The child is a `pi` process started through argv - `pi --print --mode json --tools eyg[,read]
[--model <id>] [--approve] <task>` - with no shell between, in the spawner's working directory.
`tools` accepts `eyg` and `read` only, and must include `eyg`; the child never has `bash`, `edit`,
`write` or `eyg_subagent`. A child cannot be handed a tool this session does not have: the list is
checked against `pi.getActiveTools()` and a name missing there is refused, so "narrow your reach"
cannot turn into "hand out tools you were not given".

`read` is off by default for a reason worth knowing before you turn it on: pi's own `read` tool is not
decided by any policy module, so a child that has it can read whatever your `read` can reach - outside
the roots and outside the effect allowlist below. Give it when the child must open this package's
guides, which an effect cannot reach (`guides/` is not under your roots).

`--approve` is passed only when the spawner's project is already trusted, because an untrusted project
loads no packages. The child sees this project's files and none of this conversation, so `task` carries
the absolute paths, the work and what to report.

Two environment variables are set for that one spawn and restored afterwards
(`childEnvOverrides` in `lib/render-helpers.mjs`):

| variable | what it does in the child |
| --- | --- |
| `EYG_POLICY` and `EYG_SUBAGENT_POLICY` | the module the child's calls are checked against |
| `EYG_ALLOWED_ROOTS` | the roots the preset reads, which must be inside the spawner's |
| `EYG_SUBAGENT_EFFECTS` | the fields the child's preset may perform, when you name `effects` |
| `EYG_SUBAGENT_MAX_CALLS` | how many `eyg` calls the child may make, when you name `max_calls` |
| `EYG_CODEMODE_DEPTH` | `1` in a child, and `0` (unset) in a session a human started |

The depth marker is what makes the first two a spawner's word rather than anything a project can
claim for itself: `resolvePolicy` reads `EYG_SUBAGENT_POLICY` only when the depth says this
package started the process, and `resolveRoots` reads the spawner's roots before the project's
`eyg.roots` on the same condition. `EYG_CODEMODE_PI` names the `pi` binary when `PATH` does not
carry it.

## Narrow it to a slice

The child's policy is the one this session's settings name, or one you name with `policy` - and
only a preset this package ships, because a module of your own writing is a module you could
make permissive. Its roots are the roots this session has unless you pass `roots`, and every one
you pass must already be under a root you have (`rootsInside`). Name one outside and the call is
refused before anything starts, naming the root that is outside.

```json
{ "task": "for each .md under <absolute root>, report the headings; write nothing",
  "roots": ["<absolute root that is under one of yours>"], "timeout": 90 }
```

A slice is narrower than your reach in a useful way: the child cannot write the file one
directory above the slice even though you can. That is the check to run when you want to see the
boundary work - give the child a slice and a task that names a path one level up.

## Name the effects, count the calls

`effects` names the effects the child may perform, as effect names (`["ReadFile", "StandardOut"]`).
It is not a request you make and hope the child obeys: it is enforced by `policies/spawner-effects.eyg`,
the narrowing preset the tool installs for that child in place of `agent-roots.eyg`, and the child runs
under it whether or not it behaves (`docs/world/entities/pi.spawner-preset.md`). Three facts about it,
each of which the tool will tell you rather than let you discover:

- **it removes reach, it never adds it.** `Fetch`, `StandardIn` and `CreateKey` stay refused allowlist
  or not, and `DecodeJSON`, `EYGParse`, `Hash`, `Sign` carry no field for any preset to refuse, so
  naming them changes nothing.
- **the two cuts are independent.** A named field is still decided by the roots, so a `ReadFile` child
  still cannot read above its slice; a path inside your slice still cannot be written by a field you
  did not name.
- **it combines with `agent-roots` only.** If this session's policy is a narrower module, swapping it
  for the narrowing preset would widen the child, and the call is refused with both paths in the reason.

`max_calls` caps how many `eyg` calls the child makes. The child is told, in a refusal it can read:
the budget is not its to widen, so report what it has. A call refused before it reached a policy does
not spend the budget, and the budget refusal itself spends nothing - the count is of calls the child
actually made.

The pair to remember when you write the task: an effect-only child that has to invent EYG spends its
budget on syntax errors. A proof that a boundary works hands the child **copy-pasteable** programs and
tells it not to write its own; a child left to guess reports its own mistakes instead of your boundary
(`docs/world/entities/pi.subagent-spawn.md`).

## Read what comes back

The result opens with what the child was given - `child under <policy> (<where it came from>), roots
<roots>, tools <tools>, call budget: N, spent` - then the child's final message, then one line per
`eyg` call it made (the module that checked it, where that module came from, its roots, its exit
status, and the budget on the rows where the budget stopped the call), and then every effect its policy
refused, deduplicated (`childCalls`, `childAnswer` in `lib/render-helpers.mjs`). The refusals are the
interesting part: they tell you where the boundary you set actually fell, without reading the child's
transcript. The child's own session file stays in pi's session directory for the working directory, so
an audit of one call is a `ReadFile` of that file.

One row is worth reading literally: in the child, a call's `policySource` is `spawner`, which is
the record that the module came from whoever started it rather than from the project.

## What a child can never get

- **a root you do not have.** A wider root is the operator's `/eyg-grant` to give, and a grant is
  given to the session the operator is in.
- **a grant.** A grant covers calls in the session where the human said yes; it is deliberately
  not read when a child is built, so a one-call grant cannot be spent over and over by a session
  with no call limit. When the refused work needs a grant, do it yourself under one.
- **a child of its own.** A session at depth 1 is refused before a second pi process starts: the
  tree is one level deep, and the child does not even see the tool.
- **a policy you wrote.** `policy` names a shipped preset only. Narrowest shipped preset first:
  `deny-all` proves a child can be stopped at every effect.
- **an effect your own policy refuses, or a tool you do not have.** The allowlist is validated against
  the reach this session actually has, probed with `action: "effects"` under this session's policy and
  roots; a name outside `CHILD_TOOL_ALLOWLIST` is refused by name.
- **a second life for your budget.** `max_calls` caps the child; the child cannot raise it, and no
  grant you hold reaches it.

## How the child gets the package at all

The child is an ordinary pi session in the same directory, so it loads whatever that directory's
project declares. `pi list` in the project prints the resolved declarations; a project that
declares this package (`"packages": [".."]`) gives the child the `eyg` tool with no extra flag.
A project that declares nothing gives the child no `eyg` tool, and the spawn answers with the
child's own stderr instead of pretending.

@measured 2026-11-20 in a scratch project (gitignored under `.ai-work/`) whose `.pi/settings.json`
declared this package and named `agent-roots`: one spawn ran 11 child calls, all
`policySource: spawner`, wrote `<project>/child-inside.txt` (6 bytes) and came back with
`write_file denied by policy: /tmp/child-outside.txt`, and no such file existed; a spawn with
`roots: ["<project>/sub"]` wrote `sub/inside-slice.txt` and was refused at
`<project>/outside-slice.txt`; a spawn with `policy: "deny-all"` wrote nothing; a spawn with
`roots: ["/tmp"]` was refused with `/tmp` named back; a session started with
`EYG_CODEMODE_DEPTH=1` was refused the spawn itself. With the child's surface named:
`tools: ["eyg","read"]` reached argv as `--tools eyg,read` and the child read a file outside its
slice with `read`; `effects: ["ReadFile","StandardOut"]` put the child under
`policies/spawner-effects.eyg` and its `WriteFile` inside its own slice answered
`write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out`; `max_calls: 2` stopped the
third call with `this session has made 2 eyg calls and its spawner set a budget of 2`. Numbers per run,
with the parent's own call rows, in `docs/world/entities/pi.subagent-spawn.md`.
`node --test 'test/*.mjs'` (pass 1, fail 0).
