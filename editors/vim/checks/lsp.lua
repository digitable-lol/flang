-- Настоящий сеанс языкового сервера в настоящем Neovim, без окна и человека.
--
-- Проверяется не «сервер запустился», а то, ради чего он нужен:
--   1. в буфер приехала диагностика — с местом и кодом;
--   2. переход к объявлению привёл туда, где объявление и стоит;
--   3. наведение показало сигнатуру.
--
-- Всё это спрашивается у Neovim теми же вызовами, какими это делает человек
-- клавишами `gd` и `K`, а не подачей сообщений протокола сбоку: половина того,
-- что ломается между сервером и редактором, ломается именно в редакторе.

local M = {}

local otchet = {}

local function skazat(stroka)
  table.insert(otchet, stroka)
end

local function vylozhit()
  vim.fn.writefile(otchet, vim.g.flang_kuda or "/dev/fd/2")
end

-- Ждать условия, а не спать: `vim.wait` крутит цикл событий, поэтому ответы
-- сервера успевают дойти.
local function dozhdatsya(uslovie, srok)
  return vim.wait(srok or 20000, uslovie, 50)
end

local function klienty(bufnr)
  if vim.lsp.get_clients then
    return vim.lsp.get_clients({ bufnr = bufnr })
  end
  return vim.lsp.get_active_clients({ bufnr = bufnr })
end

-- Шаг 1: сервер нашёлся и прицепился к буферу.
function M.privyazka(bufnr)
  local chem = require("flang").chem_zapuskaem()
  skazat("команда сервера: " .. (chem and table.concat(chem, " ") or "НЕ НАЙДЕНА"))
  local est = dozhdatsya(function()
    return #klienty(bufnr) > 0
  end)
  skazat("клиент прицепился: " .. (est and "да" or "НЕТ"))
  if est then
    local k = klienty(bufnr)[1]
    skazat("имя клиента: " .. k.name)
  end
  return est
end

-- Шаг 2: диагностика доехала до буфера — с местом и кодом.
function M.diagnostika(bufnr, skolko_zhdyom)
  local est = dozhdatsya(function()
    return #vim.diagnostic.get(bufnr) >= (skolko_zhdyom or 1)
  end)
  local vse = vim.diagnostic.get(bufnr)
  skazat("диагностик пришло: " .. #vse)
  for _, d in ipairs(vse) do
    skazat(string.format(
      "  строка %d, столбец %d, код %s: %s",
      d.lnum + 1,
      d.col + 1,
      tostring(d.code or "нет"),
      (d.message or ""):gsub("\n", " ")
    ))
  end
  return est and #vse > 0
end

-- Шаг 3: переход к объявлению. Курсор ставится на имя ВНУТРИ ёлочек — так же,
-- как его ставит человек.
function M.perehod(bufnr, imya, zhdyom_stroku)
  local nayden = nil
  for n, stroka in ipairs(vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)) do
    local nachalo = stroka:find(imya, 1, true)
    if nachalo and not stroka:match("^%s*тотальная функция") and not stroka:match("^%s*функция") then
      nayden = { n, nachalo }
    end
  end
  if not nayden then
    skazat("переход: строки с вызовом " .. imya .. " не нашлось")
    return false
  end
  -- Столбец в байтах: nvim_win_set_cursor считает в байтах, а имя русское.
  vim.api.nvim_win_set_cursor(0, { nayden[1], nayden[2] + #"«" })
  skazat(string.format("переход: курсор на строке %d, вызов %s", nayden[1], imya))

  local parametry = vim.lsp.util.make_position_params(0, "utf-16")
  local otvet = vim.lsp.buf_request_sync(bufnr, "textDocument/definition", parametry, 10000)
  if not otvet then
    skazat("переход: сервер не ответил")
    return false
  end
  for _, r in pairs(otvet) do
    local mesto = r.result
    if mesto and mesto[1] then
      mesto = mesto[1]
    end
    if mesto then
      local stroka = (mesto.range or mesto.targetSelectionRange).start.line + 1
      skazat(string.format("переход привёл на строку %d, ждали %d — %s", stroka, zhdyom_stroku,
        stroka == zhdyom_stroku and "СОШЛОСЬ" or "РАЗОШЛОСЬ"))
      return stroka == zhdyom_stroku
    end
  end
  skazat("переход: ответ пуст")
  return false
end

-- Шаг 4: наведение показывает сигнатуру.
function M.navedenie(bufnr)
  local parametry = vim.lsp.util.make_position_params(0, "utf-16")
  local otvet = vim.lsp.buf_request_sync(bufnr, "textDocument/hover", parametry, 10000)
  for _, r in pairs(otvet or {}) do
    local soderzhimoe = r.result and r.result.contents
    if soderzhimoe then
      local tekst = type(soderzhimoe) == "table" and (soderzhimoe.value or soderzhimoe[1]) or soderzhimoe
      tekst = tostring(tekst):gsub("\n", " ⏎ ")
      skazat("наведение: " .. tekst)
      return true
    end
  end
  skazat("наведение: пусто")
  return false
end

function M.progon()
  local bufnr = vim.api.nvim_get_current_buf()
  skazat("файл: " .. vim.api.nvim_buf_get_name(bufnr))
  skazat("тип файла: " .. vim.bo[bufnr].filetype)

  local vsyo = true
  vsyo = M.privyazka(bufnr) and vsyo
  if vim.g.flang_zhdyom_bedu == 1 then
    vsyo = M.diagnostika(bufnr, 1) and vsyo
  else
    M.diagnostika(bufnr, 0)
  end
  if vim.g.flang_imya then
    vsyo = M.perehod(bufnr, vim.g.flang_imya, vim.g.flang_stroka) and vsyo
    vsyo = M.navedenie(bufnr) and vsyo
  end

  skazat(vsyo and "ИТОГ: сошлось" or "ИТОГ: РАЗОШЛОСЬ")
  vylozhit()
  vim.cmd("qa!")
end

return M
