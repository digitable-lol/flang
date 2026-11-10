# Настройка редактора

Языковой сервер входит в компилятор — ставить отдельно нечего:

```bash
flang lsp --stdio
```

| Редактор | Подсветка | Сервер |
| --- | --- | --- |
| [VS Code](#vs-code) | есть | расширение из дерева языка |
| [Vim 8/9](#vim-89) | есть | через `vim-lsp` |
| [Neovim](#neovim) | есть | встроенный клиент |
| [Emacs](#emacs) | нет | через eglot |
| любой другой | нет | [`flang check` на клавише](#без-сервера-проверка-на-клавише) |

Файл программы кончается на `.flang`, `.fp`, `.фп` или `.фланг`; все четыре
расширения равноправны, и плагины подхватывают все четыре.

## Что умеет сервер

| Умеет | Метод протокола |
| --- | --- |
| Диагностика — те же проверки, что у `flang check`: разбор, связывание, типы, завершаемость | `textDocument/publishDiagnostics` |
| Дополнение: ключевые слова, имена функций и типов модуля и ввезённых модулей, поля записи после точки, варианты после `случай` | `textDocument/completion` |
| Подпись при наведении: что принимает, что возвращает, доказано ли завершение | `textDocument/hover` |
| Переход к объявлению, в том числе в другой модуль | `textDocument/definition` |

Дополнение вызывается двумя знаками: `«` и `.`. Текст документа передаётся
целиком, а не приращениями. Позиции считаются в UTF-16.

Имена для дополнения берутся из последнего удачного разбора файла: пока строка
не дописана, сервер дополняет по прежней программе, а если файл не разобрался
ни разу — одними ключевыми словами. Поля после точки предлагаются по типу
параметра функции, в теле которой стоит курсор; если тип не выведен —
поля всех записей программы, каждое подписано своей записью. Диагностика
всегда от текущего текста.

Чего сервер не делает: переименование, правки, форматирование, поиск ссылок,
список символов в файле. На такой запрос он отвечает отказом:

```
{"code":-32601,"message":"метод не поддержан: textDocument/rename"}
```

Запрос до `initialize` получает отказ `-32002` «сервер ещё не инициализирован».

Ошибка во ввезённом модуле не подчёркивается ни в его буфере, ни в открытом:
она уходит в журнал редактора (`window/logMessage`).

## Проверьте, что сервер отвечает

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

Печатает рамку и ответ, код возврата 0:

```
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"positionEncoding":"utf-16","textDocumentSync":{"openClose":true,"change":1,"save":{"includeText":false}},"completionProvider":{"triggerCharacters":["«","."]},"hoverProvider":true,"definitionProvider":true},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

## VS Code

Расширение лежит в дереве языка — `docs/editors/vscode/`. В Marketplace его
нет: оно собирается и ставится локально.

```bash
cd docs/editors/vscode
npm install
npm run package
code --install-extension flang-0.1.0.vsix
```

Оно даёт подсветку и запускает языковой сервер. Настроек три:

| Ключ | По умолчанию | Что делает |
| --- | --- | --- |
| `flang.server.command` | `flang-lsp` | чем запускать сервер |
| `flang.server.args` | `["--stdio"]` | доводы запуска |
| `flang.server.enabled` | `true` | выключите, если нужна только подсветка |

Команды `flang-lsp` установка не ставит. Поставьте в `flang.server.command`
команду `flang` (или полный путь до неё), а в `flang.server.args` —
`["lsp", "--stdio"]`.

Как поставить из дерева без сборки — в `docs/editors/vscode/README.md`.

## Vim 8/9

Плагин лежит в подкаталоге `docs/editors/vim` дерева языка. Штатный механизм
пакетов подкаталог не берёт, поэтому на него кладётся ссылка:

```bash
git clone https://github.com/digitable-lol/flang.git ~/.local/share/flang-src
mkdir -p ~/.vim/pack/flang/start
ln -s ~/.local/share/flang-src/docs/editors/vim ~/.vim/pack/flang/start/flang
```

В `~/.vimrc` нужны две строки — без них файл откроется без подсветки:

```vim
filetype plugin indent on
syntax on
```

У vim-plug подкаталог задаётся ключом:
`Plug 'digitable-lol/flang', { 'rtp': 'docs/editors/vim' }`.

Проверить: откройте файл программы и спросите редактор.

```vim
:set filetype?
```

Ответ `filetype=flang` значит, что плагин подхвачен. Текст раскрашен по пяти
видам: ключевое слово, имя в ёлочках, строка, число, комментарий. Отступ
развёрнут в пробелы по два: в языке он значим. `«` и `»` — парные скобки.

Сервер: своего клиента протокола у Vim 8/9 нет, ставится
[vim-lsp](https://github.com/prabirshrestha/vim-lsp). Регистрировать в нём
сервер руками не нужно — плагин языка делает это сам:

```vim
Plug 'prabirshrestha/async.vim'
Plug 'prabirshrestha/vim-lsp'
Plug 'digitable-lol/flang', { 'rtp': 'docs/editors/vim' }
```

Без vim-lsp подсветка работает, сервера нет. Не нашёлся сам сервер — Vim
скажет об этом один раз за сеанс и перечислит, где искал.

## Neovim

Тот же плагин, каталог пакетов свой:

```bash
git clone https://github.com/digitable-lol/flang.git ~/.local/share/flang-src
mkdir -p ~/.config/nvim/pack/flang/start
ln -s ~/.local/share/flang-src/docs/editors/vim ~/.config/nvim/pack/flang/start/flang
```

В lazy.nvim подкаталог задаётся так:

```lua
{
  "digitable-lol/flang",
  config = function(плагин)
    vim.opt.runtimepath:prepend(плагин.dir .. "/docs/editors/vim")
    vim.cmd("runtime! ftdetect/*.vim")
    require("flang").setup()
  end,
}
```

У vim-plug и packer — `Plug 'digitable-lol/flang', { 'rtp': 'docs/editors/vim' }`
и `use { 'digitable-lol/flang', rtp = 'docs/editors/vim' }`.

Плагин сам назначает тип файла и сам поднимает сервер через встроенный
`vim.lsp`. Отдельно сервер не настраивайте: второй клиент на тот же буфер
удвоит диагностику.

Сервер — `flang lsp` из того `flang`, что лежит в `PATH`, версии 0.7.25 и
новее. Двоичный постарше плагин не берёт и один раз об этом говорит.
`let g:flang_binary_lsp = 1` — брать двоичный любой версии,
`let g:flang_binary_lsp = 0` — не брать никогда.

Выключить сервер — в `init.lua` до загрузки плагина, одним из двух способов:

```lua
vim.g.flang_no_setup = 1                 -- не поднимать сервер вовсе
require("flang").setup({ lsp = false })  -- то же, но тип файла назначить
```

Подсветка и настройки буфера при этом остаются.

### Без плагина

Один сервер, без подсветки и настроек буфера, подключается штатным клиентом
Neovim 0.11 и новее:

```lua
vim.filetype.add({ extension = { flang = "flang", fp = "flang", ["фп"] = "flang", ["фланг"] = "flang" } })

vim.lsp.config.flang = {
  cmd = { "flang", "lsp", "--stdio" },
  filetypes = { "flang" },
  root_markers = { ".git" },
}
vim.lsp.enable("flang")
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

Переход к объявлению — `M-.`, подпись — `M-x eldoc`, дополнение —
`M-x completion-at-point`.

## Без сервера: проверка на клавише

Те же замечания даёт команда:

```bash
flang check путь/к/файлу.flang
```

В Vim и Neovim: `:setlocal makeprg=flang\ check\ %`, дальше `:make`. В VS Code —
задача в `.vscode/tasks.json` с `"command": "flang check ${file}"`. Сообщения
идут с кодом и местом — тем же текстом, что показал бы редактор.

Дальше: [Устранение неполадок](troubleshooting.html).
