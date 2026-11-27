---
id: gap.symlinks-escape-the-roots
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "t=$(mktemp -d) && trap 'rm -rf $t' EXIT && r=$t/r && r2=$t/r2 && o=$t/o && p=$t/p && mkdir -p $r $r2 $o $p/decides && printf outside > $o/target && ln -s $o/target $r/link && ln -s $o/written $r/wlink && ln -s $p/decides/x.eyg $r2/wlink && node bin/agent/refusal-probe.mjs --roots $r --program test/fixtures/symlink-read-probe.eyg 2>&1 | grep -q 'READ THROUGH SYMLINK' && node bin/agent/refusal-probe.mjs --roots $r --program test/fixtures/symlink-write-probe.eyg 2>&1 | grep -q 'WROTE THROUGH SYMLINK' && test -s $o/written && node bin/agent/refusal-probe.mjs --roots $r2 --protected $p/decides --program test/fixtures/symlink-write-probe.eyg 2>&1 | grep -q 'WROTE THROUGH SYMLINK' && test -s $p/decides/x.eyg"
confidence: high
sources: [host/guard.eyg, policies/agent-roots.eyg, bin/agent/refusal-probe.mjs, lib/render-helpers.mjs, test/fixtures/symlink-read-probe.eyg, test/fixtures/symlink-write-probe.eyg, test/fixtures/symlink-directory-probe.eyg, test/fixtures/search-walk.eyg, test/fixtures/self-write-probe.eyg, guides/eyg-surface.tsv, docs/world/entities/host.guard-boundary.md, docs/world/decisions/ADR-006-guard-in-package.md]
supersedes: null
superseded_by: null
---
# Gap: a symlink standing inside a root reaches wherever it points

`absolute` (`host/guard.eyg:184`) normalizes a path **lexically**: split it into segments, collapse
`.` and `..`, prepend the working directory. Nothing in the guard or in the shipped policy asks what
that path *is*, and both comparisons - `is_under` (`host/guard.eyg:196`, `policies/agent-roots.eyg:95`,
reached from `under` at `policies/agent-roots.eyg:129`) and `shield` (`host/guard.eyg:219`) - are made
against that text. The guard then re-performs with it and the host follows symlinks. A link standing
inside a root is therefore decided as a path inside the root, and its effect lands wherever the link
points: outside every root, or inside a path the host shields.

Measured 2026-11-23 at `02e9373`, 0.2 s each, with `bin/agent/refusal-probe.mjs --roots <dir>` (which
names the roots) and `--protected <path>` (which replaces the shielded paths), so the link and its
target both live in a temporary directory and nothing is written in this tree:

| asked | answer |
| --- | --- |
| `--roots $r --program test/fixtures/symlink-read-probe.eyg`, `$r/link -> $o/target` | `READ THROUGH SYMLINK`, `exit=0` |
| `--roots $r --program test/fixtures/symlink-write-probe.eyg`, `$r/wlink -> $o/written` | `WROTE THROUGH SYMLINK`, and `$o/written` exists afterwards, 16 bytes |
| `--roots $r2 --protected $p/decides --program test/fixtures/symlink-write-probe.eyg`, `$r2/wlink -> $p/decides/x.eyg` | `WROTE THROUGH SYMLINK`, `$p/decides/x.eyg` exists, and no `denied by the host` in the output |
| `--roots $r --program test/fixtures/symlink-directory-probe.eyg`, `$r/dirlink -> $o/sub` | `listed through symlink: 2` |
| `--roots $r --program test/fixtures/search-walk.eyg`, same `dirlink`, one `.eyg` file outside | `search listed: 1`; the same run with the link removed answers `search listed: 0` |
| control: the same write with no link, path outside the roots | `write_file denied by policy: ...` |
| control: the same write with the **link** under `--protected` | `write_file denied by the host: ... decides what this call may do` |

The controls say where the comparison stops: the roots rule refuses a plain path outside the roots,
and the shield fires when the asked path itself sits under a shielded path. Neither consults what is
on the other side of a link.

**What it costs the boundary.** The consequence "paths arrive as written" in
`docs/world/entities/host.guard-boundary.md` is true and is the whole story: the normalization is
lexical, so it removes the `..` route and nothing else. Boundary fact 6 of that page - a call cannot
change the files that decide it - holds against path text and fails against a link. Measured
2026-11-23 with the roots left at this package (`--inside-roots`) and a link `wlink` at the package
root aimed at `policies/sec-probe-evil.eyg`: the answer was `WROTE THROUGH SYMLINK`, `exit=0`, and the
file appeared under `policies/`; the link and the file were removed in the same command and
`git status --porcelain` came back empty. A session that can write inside its roots can plant a link,
and every later call that touches it is decided by the link's path while its effect lands elsewhere -
including on the policy modules and the guard, which is the route
`docs/world/decisions/ADR-006-guard-in-package.md` closed for plain paths.

**Why the guard cannot close it from inside.** The effect surface (`guides/eyg-surface.tsv`, 23 effect
rows) has no `stat`, `lstat` or `realpath`: a program may read, write, list and delete a path, and
cannot ask what it is. Three ways out, none of them a patch to one handler:

- ask the language for a link-resolving effect or builtin, then decide the resolved path as well as
  the asked one;
- refuse any path with a component that is a link, which needs the same ask to know;
- have the tool resolve the roots and the shielded paths before it writes `ctx`, and refuse a model
  path whose own resolution leaves the roots. The tool is JavaScript, so it can resolve; it decides
  nothing today, and `docs/world/decisions/ADR-006-guard-in-package.md` records why the guard is the
  decider.

**Trigger to close:** a `stat`-like effect or a `realpath` builtin in the surface file, or a tool that
resolves the roots and the shielded paths into `ctx` and says so in `guides/what-a-call-does.md`. Then
these fixtures answer `denied`, this record's `verify` goes red, and the record moves with the new
evidence rather than being deleted.

## Not this

- the shield over `host/` and `policies/` against plain paths, and why the refusal says `denied by the
  host`: boundary fact 6 of `docs/world/entities/host.guard-boundary.md`;
- which policy a call gets, and which rule refuses a path outside the roots:
  `docs/world/entities/pi.policy-config.md`, `docs/world/entities/codemode.effect-surface.md`;
- a program that hosts its own effects instead of asking the host:
  `docs/world/entities/gap.one-host-check-not-transitive.md`;
- the roots as configured, and what an empty list means: `docs/world/entities/pi.policy-config.md`.
