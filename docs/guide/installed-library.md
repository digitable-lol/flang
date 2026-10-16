[Back to README](../../README.md) · [Documentation index](../README.md)

# Where flang finds its library and runtimes

`flang` reads two kinds of files that are not part of the binary: the standard library
(`использует «Lists»` without a path) and the runtime sources that `flang emit` copies into
its output. Both are looked up next to the binary itself, so one rule covers every way of
installing it.

## The binary's own directory

The binary takes its own path from `argv[0]` (or from `PATH` when it was started by name)
and resolves symbolic links. `brew`, `asdf` and `install.sh` put a link or a shim into
`bin/`; the directory that counts is the one holding the real file. Below, `<root>` is the
parent of that directory.

## A module named without a path

`использует «Lists»` is resolved by the name on the module's first line. Places, in order:

1. the directory of the file that writes `использует`;
2. every directory above it, while the directory holds at least one `.flang` and stays
   inside the file's tree (`FLANG_MODULE_ROOT` sets another limit);
3. each directory in `FLANG_MODULE_DIR` (colon separated);
4. `<root>/flang/stdlib`, `<root>/flang/core`;
5. `<root>/share/flang/stdlib`, `<root>/share/flang/core`.

Two files with the same module name are both taken and the link step reports
`FLANG_IMPORT_AMBIGUOUS` with both paths. No match anywhere gives
`FLANG_IMPORT_NOT_FOUND … ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора`.

## Runtime sources of an emit target

`flang emit --target <t>` takes the runtime of target `<t>` from the first of:

1. `--runtime <dir>`;
2. `$FLANG_RUNTIME_DIR`;
3. `<root>/flang/src/emit/<t>`;
4. `<root>/share/flang/<t>`.

`cpp` and `ts` look one level higher (`<root>/share/flang`), because they read files of
other targets as well. A copy that carries the `Сгенерировано flang` header is refused:
only the hand-written sources are runtimes.

## What each way of installing puts there

| Install | Binary | Library | Runtimes |
|---|---|---|---|
| clone, `make -C bootstrap` | `bootstrap/flang` | `flang/stdlib` (place 4) | `flang/src/emit/<t>` (place 3) |
| prebuilt tarball, `install.sh`, deb, rpm, AUR | `bin/flang` | `share/flang/stdlib` | `share/flang/<t>` |
| Homebrew (`flang-package`, `flang`) | `Cellar/…/bin/flang` | `Cellar/…/share/flang/stdlib` | `Cellar/…/share/flang/<t>` |
| asdf (prebuilt or C archive) | `installs/flang/<v>/bin/flang` | `…/share/flang/stdlib` | `…/share/flang/<t>` |
| `make install PREFIX=<p>` | `<p>/bin/flang` | not installed | not installed |

The C release archive carries the image of `share/flang` in its `runtime/` directory: one
subdirectory per target plus `stdlib/`. Every package copies that directory as a whole, so
the library travels the same road as the runtimes. Releases before 0.7.29 ship no
`stdlib/`; an install of such a release finds the library only through `FLANG_MODULE_DIR`.

`make install` from the tree installs `bin`, `lib`, `include` and the manual page. For a
library and runtimes there, point the binary at the tree:
`FLANG_MODULE_DIR=<clone>/flang/stdlib` and `--runtime <clone>/flang/src/emit/<t>`.

## How it is checked

- `bootstrap/flang run-script install-parity:check` runs the same calls on every install
  listed in `packaging/install-parity.txt`. Three calls work on a file outside the tree
  that imports `«Lists»` (`check`, `run`, `emit --target c`); the first install must pass
  them, so an install without `share/flang/stdlib` is refused by name
  (`ОТКАЗ | <install> | …`) even when every install is broken the same way.
- `scripts/release/release-in-c.fscript` installs the C archive into a prefix and prints
  such a file into C and JavaScript from there.
- The Homebrew formulas check and print the same file in `brew test`.
