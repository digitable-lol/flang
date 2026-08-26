# Setting up your editor

The language server ships inside the compiler — there is nothing else to install:

```bash
flang lsp --stdio
```

A program has four extensions, and all four are equal: `.flang` is the main one,
the one used in every command and in CI; `.fp` is the short one; `.фп` stands for
«функциональная программа» — a functional program — so that a Russian file name
need not be transliterated; `.фланг` spells the name of the language out in
Cyrillic (the decisions are recorded in
`docs/adr/0016-three-file-extensions.md` and
`docs/adr/0018-file-extensions-are-one-list.md`).
All four are picked up by Vim, by Neovim and by VS Code.

Highlighting exists for Vim 8/9, Neovim and VS Code; other editors have none.

## What works today

| What | State |
| --- | --- |
| Highlighting in Vim 8/9 and Neovim | works, one symlink to install |
| Highlighting in VS Code | works, the extension builds from the language tree |
| Highlighting in Emacs | none |
| The server on closed input (one-command check) | answers |
| The server inside a live editor | stays silent |

One limitation decides everything here: **while standard input is open the
server sends no bytes at all**, and an editor never closes input. Replies come
only after input is closed. The configuration below is correct and will be
needed once the server answers on the fly; until then an editor gives you
highlighting, and diagnostics come from `flang check` — the key binding is at
the end of this page.

## What lies in the language tree

```
editors/
  vim/         highlighting and the language server for Vim 8/9 and Neovim
  vscode/      the VS Code extension: highlighting and the language server
  flang-lsp/   how to point an editor at the .flang language server by hand
  linguist/    the submission to github-linguist for the .flang language
```

**Highlighting is hand-written in no editor at all, and that is a measurement
rather than an intention.** `editors/vim/syntax/flang.vim` is 46 lines,
`editors/vscode/syntaxes/flang.tmLanguage.json` is 60 lines, and both are printed
from the language's keyword table by programs written in flang itself
(`scripts/vim-highlighting.flang`, `scripts/vscode-highlighting.flang`). A list of
words typed out separately is a second description of the language, and it
diverges from the first on the very first day. Both are checked by a real editor
started without a window and without a person: `flang io
scripts/vim-highlight-check.flang`, `flang io scripts/lsp-check.flang`.

Vim and Neovim share one directory but are configured differently: Neovim's
protocol client is built in, Vim 8/9 takes the third-party `vim-lsp`. Both look
for the server the same way — through one VimScript function that Lua calls via
`vim.fn`.

The VS Code extension holds **19 lines of JavaScript code**
(`editors/vscode/extension.js` is 46 lines including the explanation), and not one
of them knows anything about the language: the entry point of a VS Code extension
is a module the editor loads into its own Node process, and it has no other way to
connect. Everything else is done by the language server written in flang itself.

**What is not here.** Other editors, and tree-sitter and Chroma too (they colour
code on web pages and on GitHub), still have no highlighting, and that is an
unpaid debt. The work looks large — several grammars for one language — but the
estimate is deceptive: by printing it costs one program per rule set, and that has
already been measured twice in the numbers above.

## What the server can do

| Can | Protocol method |
| --- | --- |
| Diagnostics by the same road as `flang check`: parsing, linking, types, totality | `textDocument/publishDiagnostics` |
| Completion: keywords, function and type names, names from imported modules, record fields after a dot | `textDocument/completion` |
| Signature on hover: what it takes, what it returns, whether termination is proved | `textDocument/hover` |
| Go to definition, including into another module | `textDocument/definition` |

Completion is triggered by two characters: `«` and `.`. The document text is
sent whole, not as increments. Positions are counted in UTF-16.

What the server does not do: rename, edits, formatting, find references, the
symbol list of a file. Such a request gets a refusal:

```
{"code":-32601,"message":"метод не поддержан: textDocument/rename"}
```

A request before `initialize` gets refusal `-32002`, "server is not initialized
yet".

A second limitation shows up only from an editor: the server does not parse JSON
with escaped non-ASCII (`\uXXXX`). It drops such a message and prints
`flang lsp: неразобранный JSON, сообщение пропущено` to the error stream. A body
in plain UTF-8, unescaped, it reads and answers.

Diagnostics of an imported module show up **in that module's own buffer**, not
in the open one. A diagnostic with neither a line nor a file goes to the
editor's log (`window/logMessage`) instead of underlining the first line at
random.

## Check that the server answers

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

It prints the frame and the reply, exit code 0:

```
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"positionEncoding":"utf-16","textDocumentSync":{"openClose":true,"change":1,"save":{"includeText":false}},"completionProvider":{"triggerCharacters":["«","."]},"hoverProvider":true,"definitionProvider":true},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

The reply arrives after `printf` closed the input. Keep the input open and no
reply comes at all — that is the limitation named above.

## VS Code

The extension lives in the language tree — `editors/vscode/`. It is not in the
Marketplace: you build and install it locally.

```bash
cd editors/vscode
npm install
npx vsce package
code --install-extension flang-0.1.0.vsix
```

It highlights all four file extensions and starts the language server. There
are three settings:

| Key | Default | What it does |
| --- | --- | --- |
| `flang.server.command` | `flang-lsp` | what to run the server with |
| `flang.server.args` | `["--stdio"]` | arguments to run it with |
| `flang.server.enabled` | `true` | turn off if you only want highlighting |

If the language is not on `PATH`, put the full path to `flang-lsp` into
`flang.server.command`.

More in `editors/vscode/README.md`: how to install straight from the tree with
no build, how to reprint the highlighting, and what it takes to publish the
extension to the Marketplace.

The extension is not required. VS Code can start a third-party language server
without it — a few lines of settings, collected in
`editors/flang-lsp/README.md`.

## Vim 8/9

Highlighting and buffer settings install through the built-in package
mechanism. The plugin lives in the `editors/vim` subdirectory of the language
tree, and that mechanism does not take subdirectories — so you point a symlink
at it:

```bash
git clone https://github.com/digitable-lol/flang.git ~/.local/share/flang
mkdir -p ~/.vim/pack/flang/start
ln -s ~/.local/share/flang/editors/vim ~/.vim/pack/flang/start/flang
```

Two lines are needed in `~/.vimrc`. Without them Vim reads neither the
highlighting nor the file type settings, and the file opens grey:

```vim
filetype plugin indent on
syntax on
```

vim-plug takes the subdirectory as a key:
`Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }`.

To check that it took: open any `.flang`, `.fp`, `.фп` or `.фланг` file and ask the
editor.

```vim
:set filetype?
```

The answer `filetype=flang` means the extension was picked up. The text is then
coloured by five kinds — keyword, name in guillemets, string, number, comment —
and coloured the same way on all four writing surfaces. Indentation expands to
two spaces: indentation is significant in this language, so mixing tabs with
spaces would change what a program means, not just how it looks. The editor
walks `«` and `»` as a pair and inserts the closing one.

The server: Vim 8/9 has no protocol client of its own, so install the
third-party [vim-lsp](https://github.com/prabirshrestha/vim-lsp). You do not
need to register the server in it by hand — the language plugin does that:

```vim
Plug 'prabirshrestha/async.vim'
Plug 'prabirshrestha/vim-lsp'
Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }
```

One client was chosen, for one reason: it is written in pure VimScript, works
with Vim 8.0.1453, and has no external dependencies at all. `coc.nvim` requires
Node — and the whole point is that the editor should not need Node;
`yegappan/lsp` requires Vim 9.0 and so cuts off all of Vim 8.

No vim-lsp is no disaster: highlighting works without a server, and the plugin
stays quiet rather than pretending hints are coming. If the server itself is
not found, Vim says so once per session and lists where it looked.

## Neovim

The same plugin and the same subdirectory, only the package directory differs:

```bash
git clone https://github.com/digitable-lol/flang.git ~/.local/share/flang
mkdir -p ~/.config/nvim/pack/flang/start
ln -s ~/.local/share/flang/editors/vim ~/.config/nvim/pack/flang/start/flang
```

A plugin manager takes the subdirectory as a key:

```lua
{
  "digitable-lol/flang",
  config = function(plugin)
    vim.opt.runtimepath:prepend(plugin.dir .. "/editors/vim")
    vim.cmd("runtime! ftdetect/*.vim")
    require("flang").setup()
  end,
}
```

vim-plug and packer: `Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }` and
`use { 'digitable-lol/flang', rtp = 'editors/vim' }`.

The server needs no separate setup, and should not get one: the plugin assigns
the file type to all four extensions itself and starts the server through the
built-in `vim.lsp`. A second client on the same buffer would give two identical
diagnostics on every line.

To turn the server off — either of two ways, in `init.lua` before the plugin
loads:

```lua
vim.g.flang_ne_nastraivat = 1            -- do not start the server at all
require("flang").setup({ lsp = false })  -- the same, but assign the file type
```

Both touch the server only: highlighting and buffer settings stay, because they
come from the file type rather than from the plugin.

Completion is `<C-x><C-o>`, hover is `K`, go to definition is `gd`.

## Emacs

Through eglot (shipped with Emacs 29 and newer). `.flang` has no mode of its
own — derive one from `prog-mode`:

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

Go to definition is `M-.`, the signature is `M-x eldoc`, completion is
`M-x completion-at-point`.

## While the server stays silent: checking on a key

Diagnostics come by the same road as the server's, only as a command:

```bash
flang check path/to/file.flang
```

In Vim and Neovim: `:setlocal makeprg=flang\ check\ %` and then `:make` — the
remarks land in the quickfix list, and `:cnext` and `:cprevious` walk it. In VS
Code — a task in `.vscode/tasks.json` with `"command": "flang check ${file}"`.
Messages carry the trouble code and the place — the same text the editor would
have shown.

Next: [Troubleshooting](troubleshooting.html) — what to do when the check does
not answer or goes green in the wrong place.
