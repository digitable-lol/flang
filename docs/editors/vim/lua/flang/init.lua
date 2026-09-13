-- Языковой сервер flang в Neovim — через встроенный vim.lsp, без сторонних
-- пакетов.
--
-- nvim-lspconfig здесь не нужен: он полезен тем, что помнит настройки полусотни
-- серверов, а нам нужен один, и его настройки живут в этом же дереве. Лишний
-- пакет означал бы, что подсветка языка ставится вместе с чужим списком чужих
-- серверов.
--
-- Поиск бинарника НЕ ПОВТОРЁН здесь: он живёт в autoload/flang.vim и зовётся
-- через vim.fn. Второй список путей на Lua разошёлся бы с первым на VimScript
-- в первый же день.

local M = {}

local nachato = false

-- Запустить сервер для этого буфера. Возвращает идентификатор клиента или nil.
function M.zapustit(bufnr)
  local cmd = vim.fn["flang#Server"]()
  if type(cmd) ~= "table" or vim.tbl_isempty(cmd) then
    vim.notify(vim.fn["flang#Pochemu"](), vim.log.levels.WARN)
    return nil
  end
  return vim.lsp.start({
    name = "flang",
    cmd = cmd,
    root_dir = vim.fn["flang#Koren"](),
  }, { bufnr = bufnr })
end

-- Что за команда нашлась — для проверки и для `:checkhealth`-подобных вопросов.
function M.chem_zapuskaem()
  local cmd = vim.fn["flang#Server"]()
  if type(cmd) ~= "table" or vim.tbl_isempty(cmd) then
    return nil
  end
  return cmd
end

function M.setup(opts)
  if nachato then
    return
  end
  nachato = true
  opts = opts or {}

  -- Расширение → тип файла. То же самое делает ftdetect/flang.vim; здесь оно
  -- повторено для Neovim, потому что vim.filetype.add срабатывает раньше и
  -- дешевле, чем автокоманда.
  --
  -- Расширений четыре и они равноправны (ADR-0016). `["фп"]`, а не `фп = …`:
  -- имена в Lua берут только ASCII, и запись через точку тут не собирается.
  vim.filetype.add({ extension = { flang = "flang", fp = "flang", ["фп"] = "flang", ["фланг"] = "flang" } })

  if opts.lsp == false then
    return
  end

  vim.api.nvim_create_autocmd("FileType", {
    group = vim.api.nvim_create_augroup("flang_lsp", { clear = true }),
    pattern = "flang",
    callback = function(sobytie)
      M.zapustit(sobytie.buf)
    end,
  })
end

return M
