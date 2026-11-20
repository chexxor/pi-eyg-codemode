---
name: install a prebuilt binary
description: How to install the eyg CLI from a prebuilt binary.
---
*(Copied from the language repository on 2026-11-18 as reference for this package. Paths
it names - `packages/...`, `eyg_packages/...`, `spec/...` - belong to that repository and
are not files in this tree, so its relative links do not resolve from here. This tree
type-checks modules with the CLI on `PATH`; it does not build the CLI and does not check what a
run may do - see `AGENTS.md`.)*

To build from source instead,
see the [install from source](./install_from_source.md) guide.

## Install with one command (recommended)

On Linux and macOS, run the installer directly. It detects your platform,
downloads the matching release binary, verifies its checksum and installs
it:

```sh
curl -fsSL https://eyg.run/install | bash
```

The installer writes `eyg` to `$HOME/.local/bin`.

The installer downloads from the latest GitHub release by default.
To install a specific release, pass its tag as the first script argument:

```sh
curl -fsSL https://eyg.run/install \
  | bash -s -- gleam_cli-v0.0.0
```

## Install a release asset by hand

Download the asset for your platform from the latest release the language repository
publishes; <https://eyg.run/guides/install-a-prebuilt-binary> links that page:

| Platform | Asset |
|---|---|
| Linux (x86-64) | `eyg-linux-x64` |
| Linux (arm64) | `eyg-linux-arm64` |
| macOS (Intel) | `eyg-macos-x64` |
| macOS (Apple silicon) | `eyg-macos-arm64` |
| Windows (x86-64) | `eyg-windows-x64.exe` |

```sh
mkdir -p "$HOME/.local/bin"
chmod +x eyg-linux-x64
mv eyg-linux-x64 "$HOME/.local/bin/eyg"
```

Download `SHA256SUMS` from the same release to verify the asset before
installing it.

## Verify

```sh
eyg eval -c '!int_add(1, 1)'
```

The value `2` should be printed.
