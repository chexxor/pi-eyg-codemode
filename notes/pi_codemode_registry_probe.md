---
name: registry availability is a re-probed advisory, not a block
description: Why the eyg-codemode registry probes each effect at every listing, why the probe arguments are root-relative rather than fixed, and why availability is advisory rather than a second check that blocks a run.
date: 2026-11-23
---
*(Carried from the language repository, 2026-11-16: the registry probes and their output were measured there, against the language repository's policy library. This tree re-states the shapes it depends on in `policies/` and `lib/`; the probe itself is UNVERIFIED here.)*

# The decision: answer "can this session perform that effect" by asking, and answer it per query

A registry function-set declares the effects it needs in its `let metadata = {...,
effects: [...]}` record. Two things follow from that declaration alone being insufficient,
and both are trade-offs the code does not show.

**The declaration cannot be trusted, so it is cross-checked and not used as a decision.**
`checkDeclaredEffects` in `pi-eyg-codemode/lib/render-helpers.mjs` compares the declared names
against the `perform` names in the module's text in both directions, and each direction is a
registry error rather than a pass: an effect the body performs and the record omits is an effect
a caller needs and the listing would not have warned about, and an effect declared and never
performed is an annotation that went stale. The scan is textual, so a `perform Foo` inside a
comment counts - an over-estimate, which is the safe direction: it can name an effect a
program does not ask for, it can never hide one it does ask for.

**Availability is answered by a probe, and a probe is a question about the policy in force.**
The probe program is one effect as the last expression, so a refusal prints its reason and the
runner's answer distinguishes three cases (`classifyProbeOutput`): `denied by policy` means the
policy refused it, `unhandled effect` means this runner does not implement it, anything else -
a host error such as `No such file or directory`, or the printed value of a harmless effect -
means the policy let it through. That is exactly the meaning of "available" here: whether the
session may perform the effect, not whether performing it at an impossible path would succeed.

# Why the probe arguments are root-relative, and what was rejected

Probing at a fixed path was tried and rejected. `@measured 2026-11-16` under the package's own
policy, one program doing both probes:

```
OUTSIDE PROBE: read_file denied by policy: /dev/null/.eyg-codemode-probe
ROOT PROBE: No such file or directory
```

The first is what an argument at `/dev/null` does: the agent policy refuses every path outside
the roots, so every path probe would have read `refused by the policy in force` - including
`ReadDirectory`, in a session that can read its own workspace. A listing that says "refused"
where the session can perform the effect is a lie, and an agent that trusted it would have
stopped calling a function that works. The second line is the shape the tool uses now: the
first advertised root (`EYG_ALLOWED_ROOTS`, else the session directory) with `.eyg-codemode-probe`
appended, which is inside the roots and does not exist, so the host errors and the policy has
answered "let through".

The argument per effect is chosen so the effect cannot change anything before it fails
(`probeArguments`): a read, a search or a delete names that non-existent path; a write names the
root itself, which is a directory, so opening it to write fails; `MakeDirectory` names the root,
which already exists, so it succeeds and creates nothing; `Fetch` names a host under the reserved
TLD `.invalid`, which can never resolve. `Env`, `Exit` and `StandardIn` are never attempted -
they would read the caller's environment, stop the probe process, or swallow the runner's stdin -
and report `unknown` with that reason instead of a guess.

# Why per query, and why advisory

The probe runs at every `list_functions`/`describe_function` call, not once per session: `EYG_POLICY`
and the `policy` argument can differ between calls, and a cached answer is what makes a lost
permission invisible to the next session turn. The cost is one process per distinct effect named in
the registry, and `@measured 2026-11-16` a listing of two modules that name one effect costs
0.23 s wall - the listing prints its own wall time in its header for the same reason.

Availability is **advisory** and the tool does not block a run whose effect was probed refused.
A second check in the listing would be a second answer to the same question, in a place the program
cannot see, and it would disagree with the runner's answer - the policy can have changed between
the probe and the call, and the refusal then surfaces as the ordinary `Error("<field> denied by
policy: ...")` value the program already handles. The listing says so in its own footer, and the
skill repeats it, so the agent does not read `available` as permission to read a path or a refusal
as a reason to skip a call. This mirrors `notes/pi_codemode_host_gate.md`: the thing that can be
trusted is the answer given by the process that runs the program, and everything else is a hint.

# Why `action: effects` spawns probes instead of importing a policy module

The capability action asks the same question the registry probes ask, once per effect the CLI can
name, and it gets its answer the same way: one whole guarded run per effect - the probe program goes
through the same entry the real program does (`POLICY_FIELDS` x `probeProgram` x `classifyProbeOutput`), not a program that imports a
policy and calls its field. That alternative was tried on 2026-11-16 and rejected on evidence.

`eyg eval -c` importing `eyg_packages/overlay/policy.eyg` and calling one field, run unchecked, showed
the decisions are observable values:

```
p.deny_all.env({})                                        -> Mock(None({}))
p.read_write([root]).read_file({path: root/README.md})   -> Pass({path: ...})
p.read_write([root]).read_file({path: "/tmp/README.md"}) -> Mock(Error("read_file denied by policy: /tmp/README.md"))
```

So `Pass`/`Mock` can be read. What it cannot give is the decision of *this session*, because the
policy that the tool actually runs - `pi-eyg-codemode/policies/agent-roots.eyg` - reads `EYG_ALLOWED_ROOTS`
with an `Env` effect, and a program that imports it gets `unhandled effect Env("EYG_ALLOWED_ROOTS")`
instead: a policy that performs its own effects cannot be imported by a program running under a
policy, and importing
a *copy* of the policy in the tool would be a second answer to one question, which is what
`notes/pi_codemode_host_gate.md` rules out for the same reason. Hence the spawn: the runner that
will run the real program is the runner that answers the probe.

Cost, `@measured` on this host: 23 rows, 16 of them probes, 1.15 s wall on 2026-11-16 and 1.62 s
wall on 2026-11-17 (the runner's start-up dominates), against `pi -p` at 8-14 s as an event and the
guide table at 0 lookups.

# Re-check it

| claim | command | cost |
| --- | --- | --- |
| the registry lists, shadows and cross-checks | `pi -p --no-session --no-builtin-tools --tools eyg 'Call the eyg tool with action "list_functions" and code ""'` | 8-14 s wall, one headless session (`pi -p` is an event, not a loop) |
| the shapes the listing prints, offline | `cd pi-eyg-codemode && node --test test/render-helpers.test.mjs` | 41-43 ms in process, 0.09 s wall `@measured 2026-11-16` |
| a probe at `/dev/null` is refused, a probe at the root is not | one program running under a policy performing `ReadFile("/dev/null/.eyg-codemode-probe")` and `ReadDirectory("<root>/.eyg-codemode-probe")` | 0.07 s per effect, quoted verbatim above |
| `action: effects` answers through the policy | `pi --print --mode json --approve 'Call the eyg tool exactly once, with action set to effects'` | 123.18 s wall for the session, 1.62 s of it probes (`@measured 2026-11-17`); the result's `details.action` is `effects` and its header prints `16 probes in 1.62 s wall` |
| a policy that performs effects cannot be imported by a program | `EYG_ALLOWED_ROOTS=<root> packages/gleam_cli/dist/eyg run --policy pi-eyg-codemode/policies/agent-roots.eyg -c 'let a = import "<abs>/pi-eyg-codemode/policies/agent-roots.eyg" a'` | `error: unhandled effect Env("EYG_ALLOWED_ROOTS")`, 0.11 s wall `@measured 2026-11-17` |
