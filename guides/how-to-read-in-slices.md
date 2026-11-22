# Read a file in slices

A file is bigger than one result, and you want to know which bytes you read rather than
which bytes the runner held. Four steps: size, slice, window, print.

The steps are:

1. [Ask how big it is](#ask-how-big-it-is)
2. [Read one slice](#read-one-slice)
3. [Move the window by what you got](#move-the-window-by-what-you-got)
4. [Print each slice as you go](#print-each-slice-as-you-go)

## Ask how big it is

`ReadDirectory` answers one entry per name in a directory, and a file's entry carries its
size, so you learn the length without reading the file. `perform ReadDirectory("/abs/the
directory")` takes a bare path and answers `Ok(List({name, type}))` where `type` is
`Directory({})` or `File({size: Int})`. `let` takes the record apart, since `match` only
deconstructs tagged values (`guides/syntax.md`):

```eyg
let report = (entries) -> {
  !list_fold(entries, {}, (entry, _) -> {
    let {name: n, type: kind} = entry
    match kind {
      Directory(_) -> { perform StandardOut(n) }
      File(e) -> {
        let {size: s} = e
        perform StandardOut(!string_append(n, !string_append(" ", !int_to_string(s))))
      }
    }
  })
}
```

## Read one slice

```eyg
let read_slice = ({path, offset, limit}) -> {
  match perform ReadFile({path: path, offset: offset, limit: limit}) {
    Ok(bytes) -> {
      match !string_from_binary(bytes) {
        Ok(text) -> { Ok({next: !int_add(offset, !binary_size(bytes)), text: text}) }
        Error(_) -> { Error("the cut split a utf-8 sequence") }
      }
    }
    Error(why) -> { Error(why) }
  }
}
```

`offset` and `limit` are bytes. The payload is `Binary`, and decoding it fails on its own
terms: a cut inside a multi-byte character answers `Error({})` from `!string_from_binary`,
which is why the shape keeps both fallibilities instead of returning empty text for a slice
that simply landed badly.

## Move the window by what you got

The next slice starts at `next`, which is `offset` plus `!binary_size(bytes)` - the bytes
that arrived, not the `limit` you asked for. A read that runs past the end of the file
returns fewer bytes, so a window advanced by `limit` skips them, and a program that stops
at the size from step 1 stops at what the file is rather than at what it hoped.

## Print each slice as you go

Call `StandardOut` per slice rather than returning one value. The collapsed call row names
the effects the program uses, then its first four source lines and `... N more lines`; the
result row starts with the first line the program printed and names the total as
`(N output lines)`. A program that slices and prints gives you a row you can read; one that
returns the whole file gives you a row of counts. Name the slice function and call it by
name, so the four lines shown are your names rather than a nested `match`.

## How these were checked

`eyg check -c '<snippet>'` answered exit 0 for both programs on 2026-11-19, on the CLI on
this host. That check reads a program that is never run, so the shapes of the answers -
`ReadDirectory` entries, `ReadFile` bytes - are the ones `guides/cli_effects_reference.md`
documents rather than ones observed here.

## Not this

- Finding the file before reading it: `Search` lists names under one root in one host action,
  and its `limit` is a budget spent while walking, not a slice taken afterwards; `search_lib`
  walks with `ReadDirectory` instead, one directory checked at a time. Both report names and
  never contents, and a listed name is not permission to read that path
  (`guides/cli_effects_reference.md`).
- A read you expected and did not get is the preset's decision, not the file's: see
  `guides/how-to-write-a-policy.md`, where a path ending `.env.eyg` is refused by both
  shipped presets.
- A whole file at once is one `ReadFile` with a `limit` above the size. Slicing is about the
  row you read back, not about a file too big to exist.
