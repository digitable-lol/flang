-- Neovim: включить всё само. Отключается до загрузки — `vim.g.flang_ne_nastraivat = 1`.
if vim.g.flang_ne_nastraivat == 1 or vim.g.loaded_flang == 1 then
  return
end
vim.g.loaded_flang = 1
require("flang").setup()
