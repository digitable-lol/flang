# Setting up your editor

How do you get flang highlighting, completion and errors in your editor? The
language server is part of the compiler and starts with `flang lsp --stdio`.
There is nothing to install separately.

| Editor | Highlighting | Server |
| --- | --- | --- |
| [VS Code](#vs-code) | yes | the extension from the flang repository |
| [Vim 8/9](#vim-89) | yes | through `vim-lsp` |
| [Neovim](#neovim) | yes | the built-in client |
| [Emacs](#emacs) | no | through eglot |
| any other | no | [`flang check` on a key](#without-the-server-a-check-on-a-key) |

A program file ends in `.flang`, `.fp`, `.фп` or `.фланг`; the four extensions
are equal, and the plugins recognise each of them.

## What the server does

| Does | Protocol method |
| --- | --- |
| Errors — the same checks as `flang check`: syntax, imports, types, termination | `textDocument/publishDiagnostics` |
| Completion: keywords, the functions and types of the module and of imported modules, record fields after a dot, variants after `случай` | `textDocument/completion` |
| A signature on hover: what it accepts, what it returns, whether termination is proved | `textDocument/hover` |
| Go to definition, into another module too | `textDocument/definition` |

Completion is triggered by two characters: `«` and `.`. The document text is
sent whole, without increments. Positions are counted in UTF-16.

Names for completion come from the last version of the file without syntax
errors. While a line is unfinished the server completes from that version. If
there has been no such version yet, it offers keywords only. Fields after a dot are offered by the
type of a parameter of the function the cursor is in; if the type is not
inferred — the fields of every record in the program, each labelled with its
record. Errors are always
shown for the current text.

What the server does not do: rename, edits, formatting, find references,
document symbols. It answers such a request with an error ("method not
supported"):

```json
{"code":-32601,"message":"метод не поддержан: textDocument/rename"}
```

A request before `initialize` gets the error `-32002`
«сервер ещё не инициализирован» ("the server is not initialised yet").

An error in an imported module is underlined neither in its buffer nor in the
open one: it goes to the editor's log (`window/logMessage`).

## Check that the server answers

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

The answer is a header and a JSON message:

```text
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"positionEncoding":"utf-16","textDocumentSync":{"openClose":true,"change":1,"save":{"includeText":false}},"completionProvider":{"triggerCharacters":["«","."]},"hoverProvider":true,"definitionProvider":true},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

Exit code 0.

## VS Code

The extension is in the flang repository, in `docs/editors/vscode/`. It is not in
the Marketplace: you build and install it locally.

```bash
cd docs/editors/vscode
npm install
npm run package
code --install-extension flang-0.1.0.vsix
```

It gives highlighting and starts the language server. There are three settings:

| Key | Default | What it does |
| --- | --- | --- |
| `flang.server.command` | `flang-lsp` | what starts the server |
| `flang.server.args` | `["--stdio"]` | the arguments |
| `flang.server.enabled` | `true` | turn off if you only want highlighting |

An install does not provide a `flang-lsp` command. Set `flang.server.command`
to `flang` (or its full path) and `flang.server.args` to `["lsp", "--stdio"]`.

How to install the extension without building is in
`docs/editors/vscode/README.md`.

## Vim 8/9

The plugin is in the `docs/editors/vim` subdirectory of the flang repository. The
native package mechanism does not take a subdirectory, so you link to it:

```bash
git clone https://github.com/digitable-lol/flang.git ~/.local/share/flang-src
mkdir -p ~/.vim/pack/flang/start
ln -s ~/.local/share/flang-src/docs/editors/vim ~/.vim/pack/flang/start/flang
```

`~/.vimrc` needs two lines — without them the file opens without highlighting:

```vim
filetype plugin indent on
syntax on
```

With vim-plug the subdirectory is a key:
`Plug 'digitable-lol/flang', { 'rtp': 'docs/editors/vim' }`.

To check, open a program file and ask the editor.

```vim
:set filetype?
```

The answer `filetype=flang` shows that the plugin is loaded. The text is coloured
in five kinds: keyword, guillemet name, string, number, comment. Indentation
expands to two spaces: it is significant in the language. `«` and `»` are a
bracket pair.

The server: Vim 8/9 has no protocol client of its own, so install
[vim-lsp](https://github.com/prabirshrestha/vim-lsp). You do not register the
server in it by hand — the language plugin does:

```vim
Plug 'prabirshrestha/async.vim'
Plug 'prabirshrestha/vim-lsp'
Plug 'digitable-lol/flang', { 'rtp': 'docs/editors/vim' }
```

Without vim-lsp highlighting works and there is no server. If the server itself
is not found, Vim says so once per session and lists where it looked.

## Neovim

The same plugin, with its own package directory:

```bash
git clone https://github.com/digitable-lol/flang.git ~/.local/share/flang-src
mkdir -p ~/.config/nvim/pack/flang/start
ln -s ~/.local/share/flang-src/docs/editors/vim ~/.config/nvim/pack/flang/start/flang
```

In lazy.nvim the subdirectory is set like this:

```lua
{
  "digitable-lol/flang",
  config = function(plugin)
    vim.opt.runtimepath:prepend(plugin.dir .. "/docs/editors/vim")
    vim.cmd("runtime! ftdetect/*.vim")
    require("flang").setup()
  end,
}
```

With vim-plug and packer — `Plug 'digitable-lol/flang', { 'rtp': 'docs/editors/vim' }`
and `use { 'digitable-lol/flang', rtp = 'docs/editors/vim' }`.

The plugin assigns the file type and starts the server through the built-in
`vim.lsp` by itself. Do not configure the server separately: a second client on
the same buffer doubles the diagnostics.

The server is `flang lsp` from the `flang` program found on `PATH`. With an old
`flang` that has no server yet, the plugin does not start the server and says
so once. `let g:flang_binary_lsp = 1` starts `flang` of any version,
`let g:flang_binary_lsp = 0` never starts it.

To turn the server off, in `init.lua` before the plugin loads, one of:

```lua
vim.g.flang_no_setup = 1                 -- do not start the server at all
require("flang").setup({ lsp = false })  -- the same, but assign the file type
```

Highlighting and buffer settings stay.

### Without the plugin

The server alone, without highlighting and buffer settings, connects through
the stock client of Neovim 0.11 and newer:

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

Through eglot (part of Emacs 29 and newer). `.flang` has no mode of its own —
derive one from `prog-mode`:

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

Go to definition — `M-.`, signature — `M-x eldoc`, completion —
`M-x completion-at-point`.

## Without the server: a check on a key

The same errors come from the command `flang check path/to/file.flang`.

In Vim and Neovim: `:setlocal makeprg=flang\ check\ %`, then `:make`. In VS
Code — a task in `.vscode/tasks.json` with `"command": "flang check ${file}"`.
Messages carry the code and the place — the same text the editor would show.

Next: [If it does not work](troubleshooting.html).
