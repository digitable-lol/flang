# Настройка редактора

Языковой сервер входит в компилятор — ставить отдельно нечего:

```bash
flang lsp --stdio
```

Расширений у программы три, и все три равноправны: `.flang` — основное и то,
что стоит во всех командах и в CI; `.fp` — короткое; `.фп` — «функциональная
программа», чтобы имя файла по-русски не приходилось писать транслитом
(решение записано в `docs/adr/0008-three-file-extensions.md`).
Подхватывают все три и `ftdetect` для Vim 8/9, и `vim.filetype.add` для Neovim.

Подсветка есть для Vim 8/9 и Neovim; для остальных редакторов её нет.

## Что работает сегодня

| Что | Состояние |
| --- | --- |
| Подсветка в Vim 8/9 и Neovim | работает, ставится одной строкой |
| Подсветка в VS Code, Emacs | нет |
| Сервер на закрытом вводе (проверка одной командой) | отвечает |
| Сервер в живом редакторе | молчит |

Ограничение одно, и оно решающее: **пока стандартный ввод открыт, сервер не
присылает ни байта**, а редактор ввод не закрывает никогда. Ответы приходят
только после закрытия ввода. Настройка ниже верна и понадобится, когда сервер
научится отвечать на лету; до тех пор в редакторе работает подсветка, а
диагностику даёт `flang check` — как это повесить на клавишу, сказано в конце
страницы.

## Что умеет сервер

| Умеет | Метод протокола |
| --- | --- |
| Диагностика той же дорогой, что `flang check`: разбор, связывание, типы, завершаемость | `textDocument/publishDiagnostics` |
| Дополнение: ключевые слова, имена функций и типов, имена из ввезённых модулей, поля записи после точки | `textDocument/completion` |
| Подпись при наведении: что принимает, что возвращает, доказано ли завершение | `textDocument/hover` |
| Переход к объявлению, в том числе в другой модуль | `textDocument/definition` |

Дополнение вызывается двумя знаками: `«` и `.`. Текст документа передаётся
целиком, а не приращениями. Позиции считаются в UTF-16.

Чего сервер не делает: переименование, правки, форматирование, поиск ссылок,
список символов в файле. На такой запрос он отвечает отказом:

```
{"code":-32601,"message":"метод не поддержан: textDocument/rename"}
```

Запрос до `initialize` получает отказ `-32002` «сервер ещё не инициализирован».

Второе ограничение видно только из редактора: JSON с экранированным не-ASCII
(`\uXXXX`) сервер не разбирает. Такое сообщение он отбрасывает и печатает в
поток ошибок `flang lsp: неразобранный JSON, сообщение пропущено`. Тело в UTF-8
без экранирования он читает и отвечает на него.

Диагностика ввезённого модуля показывается **в его собственном буфере**, а не в
открытом. Диагностика, у которой нет ни строки, ни файла, уходит в журнал
редактора (`window/logMessage`), а не подчёркивает наугад первую строку.

## Проверьте, что сервер отвечает

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

Печатает рамку и ответ, код возврата 0:

```
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"positionEncoding":"utf-16","textDocumentSync":{"openClose":true,"change":1,"save":{"includeText":false}},"completionProvider":{"triggerCharacters":["«","."]},"hoverProvider":true,"definitionProvider":true},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

Ответ приходит после того, как `printf` закрыл ввод. Оставьте ввод открытым —
и ответа не будет вовсе; это то самое ограничение, о котором сказано выше.

## VS Code

Расширения в Marketplace нет. Клиент к готовому серверу — два файла в папке
`~/.vscode/extensions/flang-lsp/`.

`package.json`:

```json
{
  "name": "flang-lsp",
  "version": "0.1.0",
  "engines": { "vscode": "^1.75.0" },
  "activationEvents": ["onLanguage:flang"],
  "main": "./extension.js",
  "contributes": {
    "languages": [
      { "id": "flang", "extensions": [".flang", ".fp", ".фп"] }
    ]
  },
  "dependencies": { "vscode-languageclient": "^9.0.0" }
}
```

`extension.js`:

```js
const { LanguageClient, TransportKind } = require("vscode-languageclient/node")

let клиент

exports.activate = () => {
  клиент = new LanguageClient(
    "flang",
    "flang",
    { command: "flang", args: ["lsp", "--stdio"], transport: TransportKind.stdio },
    { documentSelector: [{ scheme: "file", language: "flang" }] },
  )
  клиент.start()
}

exports.deactivate = () => клиент?.stop()
```

Выполните `npm i` в этой папке и перезапустите VS Code. Если `flang` не в
`PATH`, поставьте в `command` полный путь до него.

## Neovim

Подсветка ставится плагином из дерева языка — плагин живёт в подкаталоге
`editors/vim`:

```lua
{
  "digitable-lol/flang",
  config = function(плагин)
    vim.opt.runtimepath:prepend(плагин.dir .. "/editors/vim")
    vim.cmd("runtime! ftdetect/*.vim")
    require("flang").setup()
  end,
}
```

У vim-plug и packer подкаталог задаётся ключом: `Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }`
и `use { 'digitable-lol/flang', rtp = 'editors/vim' }`.

Сервер (Neovim 0.11 и новее):

```lua
vim.filetype.add({ extension = { flang = "flang", fl = "flang" } })

vim.lsp.config.flang = {
  cmd = { "flang", "lsp", "--stdio" },
  filetypes = { "flang" },
  root_markers = { "package.json", ".git" },
}
vim.lsp.enable("flang")
```

На Neovim 0.10 и старше — тот же сервер через `vim.lsp.start`:

```lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "flang",
  callback = function(событие)
    vim.lsp.start({
      name = "flang",
      cmd = { "flang", "lsp", "--stdio" },
      root_dir = vim.fs.dirname(vim.fs.find({ "package.json", ".git" }, { upward = true })[1])
        or vim.fn.fnamemodify(vim.api.nvim_buf_get_name(событие.buf), ":h"),
    })
  end,
})
```

Дополнение — `<C-x><C-o>`, наведение — `K`, переход к объявлению — `gd`.

Для Vim 8/9 своего клиента протокола нет, ставится сторонний
[vim-lsp](https://github.com/prabirshrestha/vim-lsp); плагин языка сам
регистрирует в нём сервер:

```vim
Plug 'prabirshrestha/async.vim'
Plug 'prabirshrestha/vim-lsp'
Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }
```

## Emacs

Через eglot (входит в Emacs 29 и новее). Своего режима у `.flang` нет —
заведите производный от `prog-mode`:

```elisp
(define-derived-mode flang-mode prog-mode "flang"
  (setq-local comment-start "// ")
  (setq-local comment-end ""))

(add-to-list 'auto-mode-alist '("\\.flang\\'" . flang-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               '(flang-mode . ("flang" "lsp" "--stdio"))))

(add-hook 'flang-mode-hook #'eglot-ensure)
```

Переход к объявлению — `M-.`, подпись — `M-x eldoc`, дополнение — `M-x completion-at-point`.

## Пока сервер молчит: проверка на клавише

Диагностику даёт та же дорога, что и у сервера, только командой:

```bash
flang check путь/к/файлу.flang
```

В Vim и Neovim: `:setlocal makeprg=flang\ check\ %` и дальше `:make`. В VS Code —
задача в `.vscode/tasks.json` с `"command": "flang check ${file}"`. Сообщения
идут с кодом беды и местом — тем же текстом, что показал бы редактор.

Дальше: [Устранение неполадок](troubleshooting.html) — что делать, когда
проверка не отвечает или зеленеет не к месту.
