" Digitable Focus Carbon
" Digitable Workbench 0.1.0 -- generated from themes/focus-palettes.json.
" Do not edit by hand: regenerate with scripts/generate-themes.mjs.
"
" cterm values approximate the gui colours inside the xterm 256 colour
" cube (16-231) and grey ramp (232-255).

" Line continuations below need Vim defaults for cpoptions.
let s:cpo_save = &cpo
set cpo&vim

set background=dark
hi clear
if exists('syntax_on')
  syntax reset
endif
let g:colors_name = 'digitable-focus-carbon'

" Editor chrome
hi Normal guifg=#F5F7FA ctermfg=231 guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi NormalFloat guifg=#F5F7FA ctermfg=231 guibg=#0B111A ctermbg=233 gui=NONE cterm=NONE
hi ColorColumn guifg=NONE ctermfg=NONE guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi Conceal guifg=#718695 ctermfg=66 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Cursor guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=NONE cterm=NONE
hi lCursor guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=NONE cterm=NONE
hi CursorIM guifg=#05080D ctermfg=232 guibg=#00D8FF ctermbg=45 gui=NONE cterm=NONE
hi CursorColumn guifg=NONE ctermfg=NONE guibg=#07141E ctermbg=233 gui=NONE cterm=NONE
hi CursorLine guifg=NONE ctermfg=NONE guibg=#07141E ctermbg=233 gui=NONE cterm=NONE
hi CursorLineNr guifg=#00E5E5 ctermfg=44 guibg=#05080D ctermbg=232 gui=bold cterm=bold
hi Directory guifg=#3CA9FF ctermfg=75 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi EndOfBuffer guifg=#0B111A ctermfg=233 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi ErrorMsg guifg=#FF5B5B ctermfg=203 guibg=NONE ctermbg=NONE gui=bold cterm=bold
hi WarningMsg guifg=#FFC247 ctermfg=215 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi ModeMsg guifg=#F5F7FA ctermfg=231 guibg=NONE ctermbg=NONE gui=bold cterm=bold
hi MoreMsg guifg=#00E5E5 ctermfg=44 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Question guifg=#00E5E5 ctermfg=44 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi NonText guifg=#718695 ctermfg=66 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi SpecialKey guifg=#718695 ctermfg=66 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi LineNr guifg=#718695 ctermfg=66 guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi FoldColumn guifg=#718695 ctermfg=66 guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi Folded guifg=#9BAAB8 ctermfg=248 guibg=#071018 ctermbg=233 gui=italic cterm=italic
hi SignColumn guifg=#718695 ctermfg=66 guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi MatchParen guifg=#00E5E5 ctermfg=44 guibg=#15566A ctermbg=23 gui=bold cterm=bold
hi Pmenu guifg=#F5F7FA ctermfg=231 guibg=#0B111A ctermbg=233 gui=NONE cterm=NONE
hi PmenuSel guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=bold cterm=bold
hi PmenuSbar guifg=NONE ctermfg=NONE guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi PmenuThumb guifg=NONE ctermfg=NONE guibg=#15566A ctermbg=23 gui=NONE cterm=NONE
hi Search guifg=#05080D ctermfg=232 guibg=#FFC247 ctermbg=215 gui=NONE cterm=NONE
hi IncSearch guifg=#05080D ctermfg=232 guibg=#FF8A2A ctermbg=208 gui=NONE cterm=NONE
hi CurSearch guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=NONE cterm=NONE
hi QuickFixLine guifg=NONE ctermfg=NONE guibg=#15566A ctermbg=23 gui=bold cterm=bold
hi StatusLine guifg=#F5F7FA ctermfg=231 guibg=#0B111A ctermbg=233 gui=NONE cterm=NONE
hi StatusLineNC guifg=#9BAAB8 ctermfg=248 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi StatusLineTerm guifg=#F5F7FA ctermfg=231 guibg=#0B111A ctermbg=233 gui=NONE cterm=NONE
hi StatusLineTermNC guifg=#9BAAB8 ctermfg=248 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi TabLine guifg=#9BAAB8 ctermfg=248 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi TabLineFill guifg=NONE ctermfg=NONE guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi TabLineSel guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=bold cterm=bold
hi Title guifg=#00E5E5 ctermfg=44 guibg=NONE ctermbg=NONE gui=bold cterm=bold
hi Visual guifg=NONE ctermfg=NONE guibg=#15566A ctermbg=23 gui=NONE cterm=NONE
hi VisualNOS guifg=NONE ctermfg=NONE guibg=#15566A ctermbg=23 gui=NONE cterm=NONE
hi VertSplit guifg=#15566A ctermfg=23 guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi WildMenu guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=NONE cterm=NONE
hi Terminal guifg=#F5F7FA ctermfg=231 guibg=#05080D ctermbg=232 gui=NONE cterm=NONE
hi ToolbarLine guifg=NONE ctermfg=NONE guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi ToolbarButton guifg=#05080D ctermfg=232 guibg=#00E5E5 ctermbg=44 gui=bold cterm=bold
hi Menu guifg=#F5F7FA ctermfg=231 guibg=#0B111A ctermbg=233 gui=NONE cterm=NONE
hi Scrollbar guifg=#15566A ctermfg=23 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi Tooltip guifg=#F5F7FA ctermfg=231 guibg=#0B111A ctermbg=233 gui=NONE cterm=NONE

" Diff and spell
hi DiffAdd guifg=#7CFF6B ctermfg=119 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi DiffChange guifg=#FFC247 ctermfg=215 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi DiffDelete guifg=#FF5B5B ctermfg=203 guibg=#071018 ctermbg=233 gui=NONE cterm=NONE
hi DiffText guifg=#05080D ctermfg=232 guibg=#FFC247 ctermbg=215 gui=NONE cterm=NONE
hi SpellBad guifg=NONE ctermfg=NONE guibg=NONE ctermbg=NONE gui=undercurl cterm=undercurl guisp=#FF5B5B
hi SpellCap guifg=NONE ctermfg=NONE guibg=NONE ctermbg=NONE gui=undercurl cterm=undercurl guisp=#FFC247
hi SpellLocal guifg=NONE ctermfg=NONE guibg=NONE ctermbg=NONE gui=undercurl cterm=undercurl guisp=#3CA9FF
hi SpellRare guifg=NONE ctermfg=NONE guibg=NONE ctermbg=NONE gui=undercurl cterm=undercurl guisp=#B65CFF

" Syntax
hi Comment guifg=#718695 ctermfg=66 guibg=NONE ctermbg=NONE gui=italic cterm=italic
hi Constant guifg=#FFC247 ctermfg=215 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi String guifg=#7CFF6B ctermfg=119 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Character guifg=#7CFF6B ctermfg=119 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Number guifg=#FFC247 ctermfg=215 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Boolean guifg=#FFC247 ctermfg=215 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Float guifg=#FFC247 ctermfg=215 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Identifier guifg=#F5F7FA ctermfg=231 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Function guifg=#3CA9FF ctermfg=75 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Statement guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Conditional guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Repeat guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Label guifg=#FF8A2A ctermfg=208 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Operator guifg=#00D8FF ctermfg=45 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Keyword guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Exception guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi PreProc guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Include guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Define guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Macro guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi PreCondit guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Type guifg=#00E5E5 ctermfg=44 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi StorageClass guifg=#B65CFF ctermfg=135 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Structure guifg=#00E5E5 ctermfg=44 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Typedef guifg=#00E5E5 ctermfg=44 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Special guifg=#FF8A2A ctermfg=208 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi SpecialChar guifg=#FF8A2A ctermfg=208 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi SpecialComment guifg=#9BAAB8 ctermfg=248 guibg=NONE ctermbg=NONE gui=italic cterm=italic
hi Tag guifg=#FF8A2A ctermfg=208 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Delimiter guifg=#9BAAB8 ctermfg=248 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Debug guifg=#FF5B5B ctermfg=203 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Underlined guifg=#3CA9FF ctermfg=75 guibg=NONE ctermbg=NONE gui=underline cterm=underline
hi Ignore guifg=#718695 ctermfg=66 guibg=NONE ctermbg=NONE gui=NONE cterm=NONE
hi Todo guifg=#05080D ctermfg=232 guibg=#FFC247 ctermbg=215 gui=bold cterm=bold
hi Error guifg=#05080D ctermfg=232 guibg=#FF5B5B ctermbg=203 gui=NONE cterm=NONE

" Shared links
hi! link htmlTag Tag
hi! link htmlEndTag Tag
hi! link htmlArg Label
hi! link xmlTag Tag
hi! link xmlTagName Tag
hi! link xmlAttrib Label
hi! link jsonKeyword Identifier
hi! link yamlKey Identifier
hi! link markdownHeadingDelimiter Title
hi! link markdownH1 Title
hi! link markdownCode String
hi! link markdownUrl Underlined
hi! link diffAdded DiffAdd
hi! link diffRemoved DiffDelete
hi! link diffChanged DiffChange

" :terminal palette (Vim 8)
let g:terminal_ansi_colors = [
      \ '#05080D', '#FF5B5B', '#7CFF6B', '#FFC247',
      \ '#3CA9FF', '#B65CFF', '#00E5E5', '#F5F7FA',
      \ '#718695', '#FF5B5B', '#7CFF6B', '#FFC247',
      \ '#3CA9FF', '#B65CFF', '#00D8FF', '#F5F7FA']

let &cpo = s:cpo_save
unlet s:cpo_save
