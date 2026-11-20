---
name: pi-codemode-project-settings-key
description: Why the preset and the roots are configured through pi's effective settings rather than a file this package reads itself, and why the project key outranks EYG_POLICY
date: 2026-11-20
---
Three decisions the config surface forces, argued here rather than in the code.

**Read `pi.getSettings()`, do not parse `.pi/settings.json`.** Probed first, 2026-11-20: a probe
extension (`session_start`, one `getSettings()` call written to a scratch file) run in a scratch
project whose settings carried `"eyg": {"policy": "deny-all", "roots": [...]}` returned that key
unchanged, nested arrays included, alongside the merged global keys. So the extension calls
`pi.getSettings()` on each tool call and shapes the result in `eygSettings`. What it buys: the
global/project merge and override rules are pi's, one file the operator already knows, and no
second reader to drift. What it costs: the package depends on pi keeping unknown keys, which is
not a documented promise - if a future pi prunes them the key silently disappears, and the
failure is visible, because the tool then reports `package default` in the row it renders.
Trigger to revisit: a pi release that drops unknown keys, or a user who needs the setting per
directory rather than per project.

**The project key outranks `EYG_POLICY`.** The order is call argument, session grant, project
key, environment, package preset. The alternative - environment first - is the usual
least-specific-last rule and was rejected on purpose: the operator asked for a project to be
able to say what it allows, and a forgotten exported variable silently changing a project's
boundary is the failure mode to prevent. The cost is real and named: to narrow one session
below what the project names, use the `policy` argument of the call or a project file that says
so; there is no way to lower it from the environment. Trigger to revisit: a user who needs a
one-off narrowing without editing the project file, which is the same demand the grant loop
answers from the other side.

**Names resolve inside the package, paths must be absolute.** `agent-roots` and `deny-all`
resolve to `policies/<name>.eyg` through `packageDir()`; anything relative is refused by name
rather than resolved against the working directory, because a policy module chosen by a path
that moves with the session is how a preset stops being the one the operator read. The same rule
applies to `eyg.roots`: a relative entry stops the call instead of matching nothing.
