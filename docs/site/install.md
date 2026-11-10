# Installing

Latest release — **{{выпуск.версия}}**
([release on GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Way | What it installs | Needed on the machine |
| --- | --- | --- |
| [One line](#one-line) | a prebuilt build into `~/.local`, no `sudo` | `curl` or `wget`, `sha256sum` or `shasum` |
| [Homebrew](#homebrew) | `flang`, the library, the headers, `man flang` | `brew` |
| [asdf](#asdf) | `flang` alongside other versions | `asdf` |
| [deb and rpm](#deb-and-rpm) | a system package | `apt` or `dnf` |
| [From source](#from-source) | `flang` from a clone | `git`, `cc`, `make` |

Prebuilt builds exist for Linux x86_64 and aarch64 (static, they run on any
distribution) and for macOS arm64 and x86_64. The package is called
**flang-package**; the command is `flang`. Every build has the checks, the
proofs, emitting to all {{цели.поАнглийски}} targets and the language server
(`flang lsp --stdio`).

There is no native Windows build: install inside WSL.

**The name `flang` is also used by LLVM Flang.** LLVM's Fortran compiler
installs a command with the same name. If both are installed, whichever comes
first on `PATH` runs. Ours answers `flang --version` with `flang <version>` on
the first line. Fix it by the order of directories on `PATH` or by calling the
command by its full path.

## One line

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

The script picks the build for the system and the CPU, downloads it, checks it
against the release's `SHA256SUMS` and installs into `~/.local`; when the
checksum differs it installs nothing. Its last line is the uninstall command.

| Environment variable | What it sets | Example |
| --- | --- | --- |
| `FLANG_VERSION` | a version instead of the latest | `FLANG_VERSION=0.7.34` |
| `PREFIX` | a directory instead of `~/.local` | `PREFIX=/opt/flang` |

## Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

Installs `flang`, `libcompiler_flang.a`, the headers and the `man flang` page.
`brew install digitable-lol/tap/flang` is another name of the same formula.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

The plugin downloads the prebuilt build and checks its checksum. With
`ASDF_FLANG_FROM_SOURCE=1` it builds from source, which needs `cc` and `make`.
The same plugin works in mise:
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

## From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, no sudo
```

The last line of the output says where it went:

```
поставлено: /usr/local/bin/flang — проверьте: flang --version
```

`PREFIX` receives `bin/flang`, `lib/libcompiler_flang.a`, the headers in
`include/`, the runtimes of the emit targets in `share/flang/<target>/` and the
standard library in `share/flang/stdlib/`. The version is the one in the clone.
This way installs no `man` page. Where the binary looks for the library and how
to point it at a clone is in the [guide](../guide/installed-library.md).

Without `make`, one call to `cc` is enough:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## Checking the install

```bash
flang --version
```

```
flang {{выпуск.версия}}
оболочка …: правит строку (стрелки, слова, история, Tab), цвет digitable
```

Put this into `privet.flang`:

```flang
модуль «Привет»
тотальная функция «Два»
  возвращает число
  2
```

```bash
flang check privet.flang
```

```
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
privet.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. A file that did not pass answers `не проверено — замечаний N` and
exit code 1.

```bash
flang run privet.flang --function Два
```

```
доказано: утверждений 0
2
```

## Uninstalling

| Way | Command |
| --- | --- |
| One line | `rm -rf …` — the script printed the ready command as its last line when it installed |
| Homebrew | `brew uninstall flang-package` |
| asdf | `asdf uninstall flang <version>`, then `asdf plugin remove flang` |
| deb, rpm | `sudo apt remove flang-package`, `sudo dnf remove flang-package` |
| From source | `make -C bootstrap uninstall` — with the same `PREFIX=…` you installed with |

`make -C bootstrap uninstall` leaves the headers in `include/`
(`compiler_flang.h`, `flang_runtime.h`, `tls_client.h`) — remove them by hand.

## What next

- [First program](getting-started.html) — write, check, run
- [Tutorial](tutorial.html) — from the first function to a statement proved by the prover
- [Troubleshooting](troubleshooting.html) — when something did not install
