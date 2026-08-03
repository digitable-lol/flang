# ftsls — сервер языка FTS

Один сервер даёт поддержку `.fts` сразу во всех редакторах, которые говорят
на Language Server Protocol: VS Code, Neovim, JetBrains, Zed, Emacs, Helix.

Главное, ради чего он существует, — **исполняемая обратная связь**. FTS-модель
не только описывает правила, но и содержит примеры, которые действительно
выполняются. Поэтому редактор может показывать не «что автор написал», а «что
получилось на самом деле»: рядом со строкой `ожидается результат равен 3000`
появляется фактическое значение, а расхождение становится ошибкой на этой
самой строке, а не молчанием до запуска CI.

```
    пример «Большая покупка постоянного клиента»
      дано сумма равна 20000
      ожидается результат равен 3000    → 2000        ← inlay-подсказка
      ~~~~                                            ← ошибка: ожидается 3000, фактически 2000
```

Зависимостей ноль. JSON-RPC 2.0 поверх stdio реализован здесь же
(`src/rpc.mjs`, ~150 строк): `vscode-languageserver` потянул бы зависимость в
репозиторий, который её принципиально не имеет.

## Что делает сервер и чего он не делает

Языка сервер не знает. Разбор, проверку и исполнение делает ядро — `compile`,
`validate` и `testUtilities` из `dist/src/index.js`. Сервер добавляет ровно три
вещи: **координаты** (ядро отдаёт ошибки без колонок), **кэш** по версии
документа и **дебаунс** в 150 мс. Поэтому подсказка в редакторе не может
разойтись с `fts test`: это один и тот же вызов.

## Запуск

```bash
npm ci && npm run build          # серверу нужен собранный dist/src
node tools/ftsls/bin/ftsls.mjs --stdio
```

Сервер разговаривает по stdin/stdout, всё человеческое пишет в stderr.
Node ≥ 20, ES-модули, никакой сети и записи на диск.

Тесты (запускают настоящий подпроцесс и разговаривают с ним по протоколу):

```bash
node --test tools/ftsls/test/*.test.mjs
```

## Возможности

| Метод | Что даёт |
|---|---|
| `textDocument/publishDiagnostics` | ошибки разбора, ошибки `validate` и **несходящиеся примеры** |
| `textDocument/inlayHint` | фактический результат рядом с `ожидается`, сводка `✓ 3/3` у утилиты |
| `textDocument/hover` | тип поля, сигнатура и статистика утилиты, домен и кодомен морфизма |
| `textDocument/completion` | ключевые слова по контексту, имена объектов, полей, утилит, морфизмов, состояний |
| `textDocument/definition` | от использования поля, объекта, утилиты, морфизма или состояния к объявлению |
| `textDocument/documentSymbol` | дерево: категория → объекты → поля, утилиты → правила, свойства, примеры |
| `textDocument/formatting` | нормализация отступов (два пробела на уровень) |

Жизненный цикл: `initialize`, `initialized`, `shutdown`, `exit`,
`textDocument/didOpen|didChange|didClose|didSave`.

Синхронизация **инкрементальная** (`TextDocumentSyncKind.Incremental`, объявлена
в capabilities): позиции LSP считаются в кодовых единицах UTF-16, ровно так же,
как их считает JavaScript при индексации строки, поэтому русские имена в
«ёлочках» позиционируются точно.

Поддержаны обе поверхности языка. В русской модели подсказки русские, в
английской — английские; поверхность определяется по первой строке файла
(`категория` или `category`). Скобочная поверхность (`category X { ... }`)
диагностируется по настоящему `span` ядра, но структурных возможностей для неё
нет: авторский формат — отступный.

Заголовок модуля `ftsc` (`модуль`, `использует`, `экспортирует`) снимается так
же, как это делает сам `ftsc`, — строки заменяются пустыми, чтобы не съехали
координаты. Файлы-функторы `ftsc` сервер оставляет в покое: их разбирает `ftsc`,
а не ядро, и придумывать по ним ошибки нельзя.

### Откуда берутся координаты

Ядро сообщает об ошибках тремя разными способами, и это главная работа сервера:

| Источник | Что есть | Что делает сервер |
|---|---|---|
| `src/parser.ts` (скобочная поверхность) | `span` с `line` и `column` | переводит 1-based в 0-based |
| `src/natural-parser.ts` | `path: "строка 13"` — строка без колонки | подчёркивает содержимое строки без отступа и комментария |
| `src/validate.ts` | `path: "$.utilities[0].rules[0].when[0].field"` — без строки вообще | ищет узел по разметке (`src/outline.mjs`); неизвестный хвост пути сползает к ближайшему известному предку |
| `testUtilities` | `{ expected, actual }` без координат | ставит ошибку на строку `ожидается` этого примера |

Разметка (`src/outline.mjs`) нумерует объекты, утилиты, правила и примеры в том
же порядке, что и ядро, — это проверяется тестом «индексы разметки совпадают с
канонической моделью ядра». Если инвариант сломается, диагностика подчеркнёт не
ту строку, и тест это поймает.

## Подключение к редакторам

Ниже — минимальные конфигурации. Полноценных расширений здесь нет намеренно:
сервер один, обвязка у каждого редактора своя и живёт вне этого репозитория.

Везде предполагается, что `FTSLS` — это команда
`node /путь/к/fts/tools/ftsls/bin/ftsls.mjs --stdio`.

### Neovim (0.10+)

```lua
vim.filetype.add({ extension = { fts = "fts" } })

vim.api.nvim_create_autocmd("FileType", {
  pattern = "fts",
  callback = function(args)
    vim.lsp.start({
      name = "ftsls",
      cmd = { "node", vim.fn.expand("~/fts/tools/ftsls/bin/ftsls.mjs"), "--stdio" },
      root_dir = vim.fs.dirname(vim.fs.find({ ".git", "package.json" }, { upward = true })[1]),
    }, { bufnr = args.buf })
  end,
})

-- inlay-подсказки включаются отдельно
vim.lsp.inlay_hint.enable(true)
```

### VS Code

Расширению нужны два файла. `package.json`:

```json
{
  "name": "fts",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages"],
  "activationEvents": ["onLanguage:fts"],
  "main": "./extension.js",
  "contributes": {
    "languages": [{ "id": "fts", "extensions": [".fts"], "aliases": ["FTS"] }],
    "configuration": {
      "properties": {
        "fts.server.path": { "type": "string", "default": "tools/ftsls/bin/ftsls.mjs" }
      }
    }
  },
  "dependencies": { "vscode-languageclient": "^9.0.1" }
}
```

`extension.js`:

```js
const { workspace } = require("vscode")
const { LanguageClient, TransportKind } = require("vscode-languageclient/node")

let client
exports.activate = (context) => {
  const module = workspace.getConfiguration("fts").get("server.path")
  client = new LanguageClient(
    "ftsls",
    "FTS Language Server",
    { run: { module, transport: TransportKind.stdio }, debug: { module, transport: TransportKind.stdio } },
    { documentSelector: [{ scheme: "file", language: "fts" }] },
  )
  context.subscriptions.push(client.start())
}
exports.deactivate = () => client?.stop()
```

Inlay-подсказки: `"editor.inlayHints.enabled": "on"`.

### Zed

Zed регистрирует сервер через расширение. Минимальный каркас:

```toml
# extension.toml
id = "fts"
name = "FTS"
version = "0.1.0"
schema_version = 1

[language_servers.ftsls]
name = "FTS Language Server"
languages = ["FTS"]
```

```toml
# languages/fts/config.toml
name = "FTS"
grammar = null
path_suffixes = ["fts"]
line_comments = ["// "]
tab_size = 2
hard_tabs = false
```

```rust
// src/fts.rs — единственное, что делает расширение: называет команду
impl zed::Extension for FtsExtension {
    fn language_server_command(&mut self, _: &zed::LanguageServerId, worktree: &zed::Worktree)
        -> zed::Result<zed::Command> {
        Ok(zed::Command {
            command: "node".into(),
            args: vec![format!("{}/tools/ftsls/bin/ftsls.mjs", worktree.root_path()), "--stdio".into()],
            env: Default::default(),
        })
    }
}
```

### Helix

```toml
# ~/.config/helix/languages.toml
[language-server.ftsls]
command = "node"
args = ["/путь/к/fts/tools/ftsls/bin/ftsls.mjs", "--stdio"]

[[language]]
name = "fts"
scope = "source.fts"
file-types = ["fts"]
comment-token = "//"
indent = { tab-width = 2, unit = "  " }
language-servers = ["ftsls"]
roots = ["package.json", ".git"]
```

### Emacs (eglot)

```elisp
(define-derived-mode fts-mode prog-mode "FTS"
  (setq-local comment-start "// ")
  (setq-local indent-tabs-mode nil)
  (setq-local tab-width 2))

(add-to-list 'auto-mode-alist '("\\.fts\\'" . fts-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               '(fts-mode . ("node" "~/fts/tools/ftsls/bin/ftsls.mjs" "--stdio"))))

(add-hook 'fts-mode-hook #'eglot-ensure)
(setq eglot-report-progress nil)
;; inlay-подсказки в eglot включены по умолчанию: M-x eglot-inlay-hints-mode
```

### JetBrains (IDEA, WebStorm, PyCharm, GoLand)

Платные IDE 2023.2+ поддерживают LSP через `LspServerSupportProvider`; в
бесплатных подойдёт плагин **LSP4IJ**, где сервер описывается без единой строки
кода: *Settings → Languages & Frameworks → Language Servers → +*

```
Name:     FTS
Command:  node /путь/к/fts/tools/ftsls/bin/ftsls.mjs --stdio
Mappings: File name patterns → *.fts  →  language id: fts
```

Для собственного плагина точка входа выглядит так:

```kotlin
class FtsLspServerSupportProvider : LspServerSupportProvider {
  override fun fileOpened(project: Project, file: VirtualFile, serverStarter: LspServerStarter) {
    if (file.extension == "fts") serverStarter.ensureServerStarted(FtsLspServerDescriptor(project))
  }
}

private class FtsLspServerDescriptor(project: Project) : ProjectWideLspServerDescriptor(project, "FTS") {
  override fun isSupportedFile(file: VirtualFile) = file.extension == "fts"
  override fun createCommandLine() =
    GeneralCommandLine("node", "${project.basePath}/tools/ftsls/bin/ftsls.mjs", "--stdio")
}
```

## Чего сервер не делает

- **Не доказывает теоремы.** `prove` и сертификаты требуют контекста с данными
  (`*.context.json`), которого у редактора нет: теорема проверяется на
  композицию типов при компиляции, а доказательство остаётся за `fts prove`.
- **Нет rename, references и workspace-символов.** Имя в FTS — это строка в
  кавычках, употребляемая в теоремах, правилах и картах `ftsc`; безопасное
  переименование должно уметь менять и файлы проекта `ftsc`, а это работа
  `ftsc`, а не одного документа.
- **Нет семантической подсветки** (`semanticTokens`). Отступная поверхность
  прекрасно раскрашивается регулярными выражениями на стороне редактора, и это
  дешевле, чем гонять токены через протокол на каждый скролл.
- **Нет code actions.** Автоисправления («добавить пропущенное поле в пример»)
  осмысленны, но должны порождаться ядром вместе с диагностикой, иначе редактор
  и CLI начнут расходиться в советах.
- **Нет проекта из нескольких файлов.** Ядро компилирует один документ;
  межфайловые ссылки — это уровень `ftsc`, и переход между модулями появится
  тогда, когда `ftsls` научится звать `resolveProject`.
- **Форматирование не переписывает имена и не двигает строки** — только ширину
  отступов и хвостовые пробелы. В языке, где отступ и есть синтаксис, «умное»
  форматирование меняло бы смысл.
