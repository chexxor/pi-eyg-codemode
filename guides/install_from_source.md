---
name: install from source
description: How to compile and install the eyg CLI from source.
---
*(Copied from the language repository on 2026-11-18 as reference for this package. Paths
it names - `packages/...`, `eyg_packages/...`, `spec/...` - belong to that repository and
are not files in this tree, so its relative links do not resolve from here. This tree
type-checks modules with the CLI on `PATH`; it does not build the CLI and does not check what a
run may do - see `AGENTS.md`.)*

Manage EYG projects with a self-contained binary.
The source is in [`packages/gleam_cli`](../packages/gleam_cli/). 

To install without the Gleam and Bun toolchains, follow the
[install a prebuilt binary](./install_prebuilt.md) guide instead.

## Prerequisites

| Tool | Used for |
|---|---|
| [Gleam](https://gleam.run) ≥ 1.7 | Compiles the Gleam source to JavaScript |
| [Bun](https://bun.com) | Package the JS into a single executable |

Install Gleam with these [instructions](https://gleam.run/install/)

Install bun with:

```sh
curl -fsSL https://bun.sh/install | bash
```

## Build and install

```sh
git clone <the clone URL on https://eyg.run/guides/install-from-source>
cd <the checkout>/packages/gleam_cli
./bin/install
```

This copy names no repository: the website page above carries the clone URL, and it is the
source for these steps (`docs/world/decisions/ADR-003-doc-delegation.md`).

The script runs `./bin/compile` an uses sudo to move that executable to `/usr/local/bin/eyg`.

If `sudo` isn't available, for example inside a sandbox or a dev container,
compile first and copy by hand:

```sh
./bin/compile
cp dist/eyg "$HOME/.local/bin/eyg"   # or anywhere on your $PATH
```

## Verify

To verify inline source execution, run:

```sh
eyg eval -c '!int_add(1, 1)'
```

The value `2` should be printed.