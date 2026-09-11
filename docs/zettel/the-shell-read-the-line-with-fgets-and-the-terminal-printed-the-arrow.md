# Оболочка читала строку каноническим fgets, и стрелку печатал терминал, а не она; клавиш flang-tui не разбирает, а файл оболочки уезжает в семя дословно — правка доезжает быстрым пересевом, не перепечаткой

Вопрос владельца 7 сентября 2026: почему в `flang repl` стрелка печатает
`^[[A`, Backspace виден знаком, а ⌥← даёт `^[b`, и нельзя ли взять
[flang-tui](https://github.com/digitable-lol/flang-tui). Замер — задача
[3636](../../tasks/completed/3636-the-repl-edits-the-line-and-wears-digitable-colours.md).

**Где живёт оболочка.** `flang/src/emit/c/flang_repl.c` — рукописный C, а не
печать из `flang/self/**`. Бэкенд C увозит его в семя дословно и приписывает
сверху шапку: `diff flang/src/emit/c/flang_repl.c bootstrap/flang_repl.c` —
ровно девять строк, все в шапке (заслон
`scripts/seed/semya-rantayma-eto-istochnik.sh`, задача 4088). Отсюда следствие,
которое стоит помнить: правка оболочки доезжает до двоичного **быстрым
пересевом** `sh scripts/seed/semya-osvezhit.sh` (задача 3388), а не
перепечаткой в четыре с половиной часа. Пересев 8 сентября занял 71 с, потому
что объекты семени были свежи и пересобрался один `flang_repl.o`.
`flang/self/repl/repl.flang` — другая оболочка, побайтовый двойник Node-версии;
в отпечаток семени она не входит и двоичным не зовётся.

**Почему стрелка печаталась знаками.** `repl_read_line` читал `fgets` в
каноническом режиме: что показать на клавишу, решал драйвер терминала, а он на
`ESC [ A` показывает `^[[A`. Истории ввода не было вовсе. Цвета в дереве не было
ни одного: grep `\033[` по `flang/` и `scripts/` давал ноль.

**Почему не flang-tui.** По его README «raw terminal mode, key input, the
output buffer and SIGWINCH stay with the host»: это чистые функции раскладки
экрана, клавиши приходят в него уже разобранными вариантами (`тип «Нажатие»`),
termios, escape-последовательностей, редактора строки и истории ввода там нет.
Его модуль `Colour` — две формулы (`38;2;r;g;b` и куб xterm-256
`(канал·5+127)/255`), которые в C занимают десять строк; печатать его в C и
увязывать в семя ради них — цена без выгоды. Из него взяты формула куба и
раскладка ролей; правила глубины цвета зеркалят
[flang-env](https://github.com/digitable-lol/flang-env): `NO_COLOR` по
наличию, пустой и `dumb` `TERM` — без цвета, `COLORTERM` truecolor/24bit и `TERM`
с `direct` — истинный цвет, с `256` — палитра, иначе шестнадцать.

**Что стало.** Редактор строки на termios внутри того же файла, только когда
на обоих концах терминал; труба идёт прежним `fgets`. Палитра digitable снята
с трёх согласных источников: `courses.digitable.life/css/digitable.tokens.css`,
dotfiles владельца (`.alacritty.toml`, `.vim/colors/digitable.vim` — там же
индексы xterm-256) и переменные `EZA_COLORS`/`FZF_DEFAULT_OPTS` рабочей машины.
Проба `scripts/repl-proba.sh` держит оба конца: под трубой с
`COLORTERM=truecolor` вывод побайтно прежний и без единого ESC; под pty
(python3 `pty`, без expect) Home/End/Backspace/↑/⌥b/Ctrl-←/Ctrl-U делают то,
что обещаны, а `NO_COLOR=` снимает цвет.

**Чего нет и почему.** Ключа `--без-цвета` у `flang repl` нет: перечень ключей
эталона стоит в `flang/self/cli.flang` (`flang repl [файл] [--max-steps N]
[--max-depth N]`), а это замыкание семени — новый ключ потянул бы перепечатку.
`NO_COLOR` покрывает ту же нужду. ⌘-стрелки до tty не доходят вовсе — их
перехватывает приложение терминала; сказано в `.помощь`.

Соседи: [[bootstrap-seed-lags-the-sources-by-one-language-form]],
[[a-connection-pipe-carries-text-not-octets]].
