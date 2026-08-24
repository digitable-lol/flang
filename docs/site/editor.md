# Setting up your editor

The language server ships inside the compiler — there is nothing else to install:

```bash
flang lsp --stdio
```

A program has three extensions, and all three are equal: `.flang` is the main one,
the one used in every command and in CI; `.fp` is the short one; `.фп` stands for
«функциональная программа» — a functional program — so that a Russian file name
need not be transliterated
(the decision is recorded in `docs/adr/0008-three-file-extensions.md`).
All three are picked up by the Vim 8/9 `ftdetect` file and by `vim.filetype.add`
for Neovim.

Highlighting exists for Vim 8/9 and Neovim; other editors have none.

## What works today

| What | State |
| --- | --- |
| Highlighting in Vim 8/9 and Neovim | works, one line to install |
| Highlighting in VS Code, Emacs | none |
| The server on closed input (one-command check) | answers |
| The server inside a live editor | stays silent |

One limitation decides everything here: **while standard input is open the
server sends no bytes at all**, and an editor never closes input. Replies come
only after input is closed. The configuration below is correct and will be
needed once the server answers on the fly; until then an editor gives you
highlighting, and diagnostics come from `flang check` — the key binding is at
the end of this page.

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

There is no extension in the Marketplace. A client for a ready server is two
files in `~/.vscode/extensions/flang-lsp/`.

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

let client

exports.activate = () => {
  client = new LanguageClient(
    "flang",
    "flang",
    { command: "flang", args: ["lsp", "--stdio"], transport: TransportKind.stdio },
    { documentSelector: [{ scheme: "file", language: "flang" }] },
  )
  client.start()
}

exports.deactivate = () => client?.stop()
```

Run `npm i` in that folder and restart VS Code. If `flang` is not on `PATH`,
put its full path into `command`.

## Neovim

Highlighting comes from the plugin inside the language tree — it lives in the
`editors/vim` subdirectory:

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

vim-plug and packer take the subdirectory as a key: `Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }`
and `use { 'digitable-lol/flang', rtp = 'editors/vim' }`.

The server (Neovim 0.11 and newer):

```lua
vim.filetype.add({ extension = { flang = "flang", fl = "flang" } })

vim.lsp.config.flang = {
  cmd = { "flang", "lsp", "--stdio" },
  filetypes = { "flang" },
  root_markers = { "package.json", ".git" },
}
vim.lsp.enable("flang")
```

On Neovim 0.10 and older — the same server through `vim.lsp.start`:

```lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "flang",
  callback = function(event)
    vim.lsp.start({
      name = "flang",
      cmd = { "flang", "lsp", "--stdio" },
      root_dir = vim.fs.dirname(vim.fs.find({ "package.json", ".git" }, { upward = true })[1])
        or vim.fn.fnamemodify(vim.api.nvim_buf_get_name(event.buf), ":h"),
    })
  end,
})
```

Completion is `<C-x><C-o>`, hover is `K`, go to definition is `gd`.

Vim 8/9 has no protocol client of its own; install
[vim-lsp](https://github.com/prabirshrestha/vim-lsp), and the language plugin
registers the server in it for you:

```vim
Plug 'prabirshrestha/async.vim'
Plug 'prabirshrestha/vim-lsp'
Plug 'digitable-lol/flang', { 'rtp': 'editors/vim' }
```

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

In Vim and Neovim: `:setlocal makeprg=flang\ check\ %` and then `:make`. In VS
Code — a task in `.vscode/tasks.json` with `"command": "flang check ${file}"`.
Messages carry the trouble code and the place — the same text the editor would
have shown.

Next: [Troubleshooting](troubleshooting.html) — what to do when the check does
not answer or goes green in the wrong place.
