# Commit messages

Сообщение коммита пишется по-английски и по правилу Conventional Commits.
Другое сообщение не принимается: его отвергает хук `commit-msg` при коммите и
работа `commit-messages` в CI на каждом запросе на слияние.

## Форма

```
type(scope): subject

body

footer
```

| часть | правило |
|---|---|
| `type` | одно из: `feat` `fix` `docs` `refactor` `test` `chore` `ci` `build` `perf` `revert` `style` |
| `scope` | необязательна; в скобках, не пуста: `fix(cli): …` |
| `!` | перед двоеточием — ломающая правка: `feat(api)!: …` |
| `subject` | начинается со строчной буквы или цифры, без точки в конце |
| заголовок | не длиннее 72 знаков |
| вторая строка | пустая, если есть тело |
| язык | только английский: в сообщении допустимы одни знаки ASCII |

Сообщение слияния, которое git пишет сам (`Merge …`), принимается как есть.

## Примеры

```
fix(cli): read the step limit before the command
feat(repl): return the optional token with every answer
docs(tasks): turn four open issues into tasks
refactor(probes)!: move the runners from shell to plans
```

Не принимается:

```
Update stuff                          нет типа
fix: Read the key.                    заглавная буква и точка в конце
fix: ключ читается до команды         не по-английски
```

## Как проверить самому

```
bootstrap/flang io .githooks/commit-msg.fscript --plan "Commit message" -- путь/к/сообщению
bootstrap/flang io .githooks/commit-msg.fscript --plan "Commit range" -- origin/dev..HEAD
```

Код 0 — сообщение принято; код 1 — отвергнуто, и причина названа одной строкой.

Хук включается настройкой `git config core.hooksPath .githooks`. Двоичный
обязан быть собран: `make -C bootstrap`.
