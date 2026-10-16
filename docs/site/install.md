# Installing

Latest release — **{{выпуск.версия}}**
([release on GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Path | What it installs | Needed on the machine |
| --- | --- | --- |
| [One line](#one-line) | a prebuilt build into `~/.local`, no `sudo` | `curl` or `wget`, `sha256sum` or `shasum` |
| [Homebrew](#homebrew) | `flang`, the library, the headers, `man flang` | `brew` |
| [asdf](#asdf) | `flang` alongside other versions | `asdf` |
| [deb and rpm](#deb-and-rpm) | a system package | `apt` or `dnf` |
| [From source](#from-source) | `flang` from a clone | `git`, `cc`, `make` |

Prebuilt builds ship with every release from 0.7.29 on: Linux x86_64 and
aarch64 (static, any distribution), macOS arm64 and x86_64. The package is
called **flang-package**; the command it installs is `flang`. Emitting to all
{{цели.поАнглийски}} targets, the checks, the proofs and the language server
(`flang lsp --stdio`) are in every prebuilt build.

**The name is taken by LLVM Flang.** LLVM's Fortran compiler also installs a
command named `flang` (the `flang` formula in Homebrew, the `flang` package in
the AUR and Fedora). If both are installed, whichever comes first on `PATH`
wins. Check with `flang --version`: ours prints `flang <version>` on the first
line. Fix it by the order of directories on `PATH` or by calling the command by
its full path inside the install directory.

## One line

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

The script picks the build for the system and the CPU, downloads it with the
release's `SHA256SUMS`, refuses to go on when the checksum differs, and copies
`bin/`, `share/` (and `lib/`, `include/` on macOS) into `~/.local`.
`FLANG_VERSION=0.7.29` pins a version and `PREFIX=/opt/flang` picks the place;
both are environment variables of `sh`. On Windows the script refuses and points
to WSL.

## Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

`brew install digitable-lol/tap/flang` keeps working: it is another name of the
same formula. Installs `flang`, `libcompiler_flang.a`, the headers and the
`man flang` page, served from the
[`homebrew-tap`](https://github.com/digitable-lol/homebrew-tap) repository.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

The plugin downloads the prebuilt build and checks its checksum. Releases before
0.7.29, or an install with `ASDF_FLANG_FROM_SOURCE=1`, build from the C sources
instead, which needs `cc` and `make`. After installing, the plugin probes the
result: `flang --version` must name the requested version. The third line is
`asdf set`, not `asdf global`: `global` and `local` were removed in asdf 0.16.0.
The same plugin works with mise:
`mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

## deb and rpm

Download the package for your CPU from the
[latest release](https://github.com/digitable-lol/flang/releases/latest) and
install it:

```bash
sudo apt install ./flang-package_<version>_amd64.deb     # or _arm64.deb
sudo dnf install ./flang-package-<version>-1.x86_64.rpm   # or .aarch64.rpm
```

The rpm conflicts with Fedora's `flang` package (LLVM Flang): both own
`/usr/bin/flang`.

The plugin lives in its own repository,
[`asdf-flang`](https://github.com/digitable-lol/asdf-flang); this tree keeps it
as the submodule `packaging/asdf-plugin` and does not release while it differs
from `packaging/asdf/`.

## From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
```

Lays down `bin/flang`, `lib/libcompiler_flang.a` and the headers in `include/`,
and says where:

```
поставлено: /usr/local/bin/flang — проверьте: flang --version
```

The version is whatever the clone holds, not the latest release. There is no
`man` page on this path: `flang.1` ships only in the release archive. There is no
`share/flang/` with the runtime sources of the emit targets either, so
`flang emit` from such an install asks for their directory:
`--runtime <clone>/flang/src/emit/c`, or the variable `FLANG_RUNTIME_DIR` — one
directory per target.

If the machine has no `make`, one `cc` call is enough:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## Not through npm

There is no fourth path: there is no npm package and no `package.json` in the
repository. `npm install @digitable-lol/flang` finds nothing under that name,
and `npm install git+https://github.com/digitable-lol/flang.git` installs no
command.

**On Windows** Homebrew does not install, and the source path wants `cc` and
`make`: that means MSYS2, WSL or another C99 toolchain; there is no native path.
Nothing here is tested on Windows.

The language server is unaffected: it is `flang lsp --stdio`, a subcommand of
the binary itself, on every path above.

## Checking the install

Three commands. Answers like these mean flang is in place.

```bash
flang --version
```

```
flang {{выпуск.версия}}
```

Put this in `hello.flang`:

```flang
module «Hello»
total function «Two»
  returns number
  2
```

```bash
flang check hello.flang
```

```
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. A file that does not pass answers `не проверено — замечаний N` and
exit code 1.

```bash
flang repl
```

```
flang {{выпуск.версия}} — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.
Объявление заканчивается пустой строкой, выражение вычисляется сразу.
» 2 plus 2
4
```

Ctrl-D leaves. If the shell answers `вычислять нечем: не найден
libcompiler_flang.a` instead of `4`, the binary is installed and the library is
not: put `libcompiler_flang.a` next to the binary, or point `FLANG_LIB_DIR` at
the directory holding it.

## Removing

| Path | Command |
| --- | --- |
| One line | the script prints the removal command as its last line: `rm -rf` over the files it installed |
| Homebrew | `brew uninstall flang-package` |
| asdf | `asdf uninstall flang <version>`, then `asdf plugin remove flang` |
| deb, rpm | `sudo apt remove flang-package`, `sudo dnf remove flang-package` |
| From source | `make -C bootstrap uninstall` — add the same `PREFIX=…` you installed with |

`make -C bootstrap uninstall` removes `bin/flang`, the library and the man page,
but LEAVES the headers in `include/` (`compiler_flang.h`, `flang_runtime.h`,
`tls_client.h`) — delete them by hand if the prefix has to be empty.

## Built with flang

Four applications outside this repository, not examples but working code:

- **[flang-tui](https://github.com/digitable-lol/flang-tui)** — terminal screen layout in
  flang: strips, clipping by printable cells, stacking, tabs, scrolling. Printed to Go and C.
- **[digitdisk](https://github.com/digitable-lol/digitdisk)** — a disk and system overview for
  Linux: the rules are decided by a kernel written in flang, the system calls by a Go host.
- **[flang-ribbon](https://github.com/digitable-lol/flang-ribbon)** — window-ribbon arithmetic
  in flang: offsets, column width, window height, insertion, panes. Carried over from digitwm
  and checked to match it exactly on 526,871 inputs. Printed to C and to Go.
- **[flang-env](https://github.com/digitable-lol/flang-env)** — parsing environment values in
  flang: color depth, language, `NO_COLOR`. The rules are pure; reading the environment is left
  to the host.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
