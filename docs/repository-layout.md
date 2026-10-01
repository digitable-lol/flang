[Back to README](../README.md) · [Documentation index](README.md) · [Русский](repository-layout.ru.md)

# How the repository is laid out

There are 6 directories at the root. Everything that is the language lives under `flang/`;
outside it is what the language is not: the bootstrap point, packaging, examples, measurements,
documentation and the task list. Prose lives in `docs/` and only there: the contracts of the
language are `docs/flang/`, the editor support is `docs/editors/`, the work of the tree is
`docs/tasks/`. `sh scripts/guards/published-vs-tree.sh --карта` checks this map
against the tree on every push.

<!-- КАРТА-НАЧАЛО: между этими метками каждая строка начинается с имени каталога корня;
     sh scripts/guards/published-vs-tree.sh --карта сличает состав с деревом. -->

```
bootstrap/      the compiler printed to C99 and its Makefile: «make -C bootstrap» builds the binary
flang/          the language: self/ (the compiler), core/, stdlib/, proof/, concurrency/, ct/, src/emit/ (target runtimes), scripts/, test/, bin/ (flangtutor) — code only; its contracts are in docs/flang/
docs/examples/  238 flang programs in 26 sets: leetcode, rosetta, crypto, db, io, wal, web, library-api and others
docs/editors/   the language server, syntax for Vim and VS Code, a github-linguist submission
packaging/      the Homebrew formula, the asdf plugin, the flang.1 man page, install checks
scripts/        guards of the tree, the reprint of the bootstrap point, the release archive, the changelog
fspec/          business rules written as proved specifications, and the check that a new rule does not undo an old one
docs/           documentation: the site sources, the guide, decisions (adr/), measurement reports, the knowledge base, and flang/ — the contracts of the language, moved out of the code
docs/flang/     the contracts of the language — one SPEC.md per layer, moved out of the code; next to the code only a pointer is left
docs/tasks/     the open and closed work of the tree, one file per task
.github/        CI and release workflows
.ai/            what an assistant working in this tree reads: AGENTS.md and .claude/skills; the root keeps `AGENTS.md` and `.claude` as symbolic links into it, and both are still found by their old names
```

<!-- КАРТА-КОНЕЦ -->

Inside `flang/`: [`flang/self/`](../flang/self) is the compiler, 64 files of flang —
<!-- СНЯТО 2026-09-17 файлов flang/self/*.flang = 64 -->
lexer, parser, types, totality, proof kernel and one printer per target.
[`flang/stdlib/`](../flang/stdlib) is the standard library — **52 modules, 1764 functions and 3745
examples** that run on every check:
<!-- СНЯТО 2026-09-17 файлов flang/stdlib/*.flang = 52 -->
<!-- СНЯТО 2026-09-13 примеров-в flang/stdlib/*.flang = 3745 -->
lists, strings, numbers, sets, maps, JSON, UTF-8, dates, two database drivers (`postgres`,
`sqlite`), networking (`http`, `tls`, `redis`), a cryptography set written in flang (`aes`,
`x25519`, `sha256`, `hmac`, `x509`, `rsa`, `ecdsa`) and a regular-expression engine.
[`flang/src/emit/`](../flang/src/emit) holds the runtime of each target; [`flang/test/`](../flang/test)
holds the checks written in flang that the binary walks.

Two of the example sets are full-size projects —
[`docs/examples/web/shortener`](examples/web/shortener/README.md), a link shortener with
nothing but flang between the request bytes and the response bytes, and
[`docs/examples/library-api`](examples/library-api/README.md), the domain half of a library
service; the 223 more programs in the other sets are single files, the LeetCode set among them:
82 solutions carrying 806 examples.
<!-- СНЯТО 2026-09-08 файлов docs/examples/leetcode/*.flang = 82 -->
<!-- СНЯТО 2026-09-08 примеров-в docs/examples/leetcode/*.flang = 806 -->

**The bootstrap point.** `bootstrap/` holds the compiler already printed to C99, which is why
`make` alone gives a working `flang`. That binary prints the compiler's sources again, and the
result is compared with what is committed: `sh scripts/bootstrap-reprint.sh --check`. The inputs of the
last print are recorded in `scripts/seed-fingerprint`, one hashed line each — 48 lines in the
input half; with the second half, the seed body, the file is 65 lines.
<!-- СНЯТО 2026-09-13 строк scripts/seed-fingerprint = 65 -->
The seed lags the sources: `bootstrap/flang io scripts/seed/what-lags-the-seed.fscript --plan Report --timeout 300000` lists which files and functions
are newer than the seed, and a reprint (`sh scripts/bootstrap-reprint.sh`, hours on one core) is how edits
to `flang/self/` reach the binary. **An edit to the sources is not in the binary until that
reprint**.
[`docs/bootstrap-point.md`](bootstrap-point.md) · [the bootstrap circle](guide/bootstrap-circle.md).

The loose files in the root: `README.md` (the front page of the repository; its Russian edition is
[`docs/README.ru.md`](README.ru.md)), `LICENSE` · `LICENSE-RU.md`,
`CONTRIBUTING.md`, `AGENTS.md` (a symbolic link to `.ai/AGENTS.md`),
[`docs/DESCRIPTION.md`](DESCRIPTION.md) (a long-form description, in Russian) and
[`docs/ROADMAP.md`](ROADMAP.md) (measured, not intended) — both reachable through symbolic
links in the root, which keep the addresses other repositories already point at; `CHANGELOG.md` ·
`changelog.json` (printed from tags and commit subjects, never edited by hand); `.flangrc` (the
settings file, and the one place the version, the licence and the two addresses are read from —
[the settings page](guide/settings.ru.md)), which also holds the short commands of the tree, one
`script.<name>` line each, run as `bootstrap/flang run-script <name>`.
