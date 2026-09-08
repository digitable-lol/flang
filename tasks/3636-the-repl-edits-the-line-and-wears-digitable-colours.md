---
номер: 3636
заголовок: Оболочка редактирует строку, помнит историю и носит цвета digitable
статус: сделана (редактор строки, история, тема digitable; семя пересеяно быстрым путём; проба scripts/repl-proba.sh зелена на трубе и pty)
исполнитель: Marat
ветка: r/repl-tui
команда: вторая
карта: Что уже есть
рядом: 3388, 4088, 5501
---

# 3636. Оболочка редактирует строку, помнит историю и носит цвета digitable

Мысль владельца, 7 сентября 2026: «в наш REPL надо встроить тему digitable
colors, плюс дать возможность перемещаться с option, alt, ctrl и cmd, и
backspace и стрелки не помечать символами, когда нажимаются; можно
переиспользовать flang-tui».

## Что есть сегодня

`flang repl` читает строку каноническим `fgets` (`flang/src/emit/c/flang_repl.c`,
`repl_read_line`). Терминал сам, а не оболочка, решает, что показать на
клавишу, и на стрелку он показывает `^[[A`, на ⌥← — `^[b`, на ⌃← — `^[[1;5D`.
Истории ввода нет. Цветов нет: во всём дереве ни одной ESC-последовательности
(`grep '\033\['` по `flang/` и `scripts/` — 0).

Файл этот — рукописный C и в семя уезжает дословно под девятью строками шапки
(заслон `scripts/semya-rantayma-eto-istochnik.sh`, задача 4088). Значит
перепечатка не нужна: правится источник, а в `bootstrap/` его кладёт быстрый
пересев `sh scripts/semya-osvezhit.sh` (задача 3388) — сегодня годен
(`--check` → 0).

Замер целиком — `ПЕРЕДАЧА/karta-repl.md`.

## Почему не flang-tui

`digitable-lol/flang-tui` — чистые тотальные функции раскладки экрана; по его
же README «raw terminal mode, key input, the output buffer and SIGWINCH stay
with the host». Разбора клавиш, termios, редактора строки и истории ввода в
нём нет, а его модуль `Colour` — две формулы, которые в C занимают десять
строк. Печатать его в C и увязывать в семя ради этого — цена без выгоды.
Из него взяты формула куба xterm-256 и раскладка ролей; правила глубины
цвета (`NO_COLOR`, `TERM`, `COLORTERM`) отзеркалены с `digitable-lol/flang-env`.

## Что сделать

1. Редактор строки внутри `flang_repl.c`, только когда `isatty(0)`:
   raw mode (`ICANON`/`ECHO` сняты, `ISIG` оставлен — Ctrl-C идёт прежней
   дорогой), курсор по кодовым точкам UTF-8, перерисовка одной строки с
   горизонтальной прокруткой, история в памяти сессии.
2. Клавиши: ←/→, Home/End, Ctrl-A/E; слово назад/вперёд — `ESC b`/`ESC f`
   (Option в Terminal.app и iTerm2 с «Esc+»), `CSI 1;3D/C` (Alt),
   `CSI 1;5D/C` (Ctrl), `CSI 1;9D/C` и `ESC ESC [D/C` (iTerm2 Option как Meta),
   `CSI 5D/C` (rxvt); Backspace 0x7f и 0x08; Delete `CSI 3~`; Alt-Backspace и
   Ctrl-W — слово назад; Ctrl-U/K — до края; Ctrl-L — очистить экран;
   ↑/↓ — история; Tab — два пробела; Ctrl-D на пустой строке — конец.
   ⌘-стрелки до tty не доходят вовсе — их перехватывает приложение терминала;
   об этом сказано в `.помощь`, а не умолчано.
3. Тема digitable (палитра `courses.digitable.life/css/digitable.tokens.css`
   = dotfiles `.alacritty.toml`/`.vim/colors/digitable.vim`): приглашение cyan,
   набираемая строка с живой подсветкой (ключевые слова blue, «имена» cyan,
   числа orange, строки green, комментарии subtle, команды с точки purple),
   ответ white bold, «объявлено»/«проверено» green, код ошибки red bold.
   Три глубины: истинный цвет, xterm-256 (индексы из `digitable.vim`), 16.
4. Уважать `NO_COLOR` (по наличию, даже пустой), `TERM` пустой/`dumb`, ключ
   `flang repl --без-цвета` / `--no-color`; красить поток только если он tty.
5. Проба `scripts/repl-proba.sh`: под трубой вывод побайтно прежний и без
   единого ESC даже при `COLORTERM=truecolor`; под pty (`script -qfc`) —
   клавиши двигают курсор и правят строку, ответ верен, буквального `^[[` в
   выводе нет, при `NO_COLOR=` нет ESC-цвета.
6. Быстрый пересев семени, README (ru/en), справка `.помощь`.

## Критерии приёмки

- `printf '2 плюс 2\n' | bootstrap/flang repl` печатает `4` и ничего больше;
  `od -c` не находит `\033` ни при каком окружении.
- Под pty ввод `плюс 3`, Home, `2 `, End, Enter даёт `5`; ввод `2 плюс 4`,
  Backspace, `3`, Enter даёт `5`; ↑ возвращает прошлую строку; в выводе нет
  буквального `^[[`; проба говорит это кодом 0.
- `NO_COLOR= bootstrap/flang repl` под pty — ни одной последовательности
  `ESC[3`/`ESC[9`/`ESC[1m`.
- `sh scripts/semya-rantayma-eto-istochnik.sh --после-печати` → 0 после пересева;
  `sh .githooks/pre-push` → 0.

## Чем закрыта

Коммит `394b2607` на ветке `r/repl-tui`: `flang/src/emit/c/flang_repl.c` (+795 строк:
цвет, подсветка, редактор, история), `bootstrap/flang_repl.c` и
`scripts/otpechatok-semeni` быстрым пересевом, `scripts/repl-proba.sh`, README
(ru/en), `packaging/flang.1`, заметка `docs/zettel/the-shell-read-the-line-with-fgets-and-the-terminal-printed-the-arrow.md`,
приметы описи. Проверено: `sh scripts/repl-proba.sh` → 0 на `bootstrap/flang`;
`sh .githooks/pre-push` → 0; `semya-rantayma-eto-istochnik.sh --после-печати` → 0.

Не сделано: ключ `--без-цвета` (эталон ключей — `flang/self/cli.flang`, замыкание
семени); история не пишется на диск; строка шире окна прокручивается, а не
переносится; ⌘-стрелки принципиально не доходят до tty.
