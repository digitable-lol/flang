# Security policy

## Reporting

Report a suspected vulnerability privately through the repository's **Security**
tab → *Report a vulnerability*. If that form is not available to you, write to
`zimtir@mail.ru` — the address on the project's paper draft. Do not open a public
issue for something that is exploitable until it has been fixed.

Everything that is *not* sensitive — a wrong answer, a crash on valid input, a
diagnostic that misleads — belongs in a normal
[issue](https://github.com/digitable-lol/flang/issues) and gets more attention
there.

## What to expect, stated plainly

This project has **one maintainer**. There is no response-time commitment, no
on-call rotation and no backport branch: a fix lands on `main` and goes out with
the next release. Saying otherwise here would be a promise nobody is standing
behind — the project writes its own bus factor down as 1 elsewhere, and this page
does not contradict it.

You will get an acknowledgement that the report was read, and a decision — fix,
won't fix, or "this is known and written down where". If a report goes without an
answer for two weeks, open a public issue saying only that a private report is
waiting; that is not a disclosure and it is the fastest way to be noticed.

## Supported versions

The latest release only. Older versions receive nothing — not even for security.
The tree is the reference; a fix that is not on `main` does not exist.

## What is in scope

- The compiler, the interpreter and the eight code generators in this repository.
- The release archive `flang-<version>-c.tar.gz` and the Homebrew formula, including what
  they put on `$PATH`. There is no npm package: publishing was removed on 3 September 2026.
- The bootstrap point in `bootstrap/` — the compiler printed to C99.

A defect where **the language accepts a program it is supposed to refuse**, or
where **emitted code behaves differently from the interpreter**, is a real defect
whether or not it is exploitable. Report it either way; the difference only
decides whether the report is private.

## What is out of scope

Programs *written in* flang are not this project's responsibility, and neither is
anything a user builds on top of the JSON that `flang ast` prints.

---

# Политика безопасности

## Куда сообщать

О предполагаемой уязвимости сообщайте закрыто — вкладка **Security** в
репозитории, *Report a vulnerability*. Если форма недоступна, пишите на
`zimtir@mail.ru` — адрес указан в черновике статьи проекта. Не заводите
публичную задачу о том, что можно использовать, пока это не починено.

Всё несекретное — неверный ответ, падение на правильном входе, диагностика,
которая вводит в заблуждение, — идите в обычные
[задачи](https://github.com/digitable-lol/flang/issues): там это заметят быстрее.

## Чего ждать, без прикрас

У проекта **один сопровождающий**. Обязательства по срокам ответа нет, дежурства
нет, ветки для исправлений в старых выпусках нет: починка ложится в `main` и
уезжает со следующим выпуском. Обещать иное на этой странице было бы обещанием,
за которым никто не стоит, — проект сам пишет, что bus factor у него равен 1, и
эта страница ему не противоречит.

Вы получите подтверждение, что сообщение прочитано, и решение: чиню, не чиню или
«известно, записано вот здесь». Если ответа нет две недели — заведите публичную
задачу с одной строкой о том, что закрытое сообщение ждёт. Это не раскрытие и это
самый быстрый способ быть замеченным.

## Какие выпуски поддерживаются

Только последний. Старые не получают ничего, включая безопасность. Эталон —
дерево: починки, которой нет в `main`, не существует.

## Что входит в область

- Компилятор, интерпретатор и восемь генераторов кода этого репозитория.
- Опубликованный пакет npm, включая то, что он кладёт в `$PATH`.
- Точка раскрутки в `bootstrap/` — компилятор, напечатанный в C99.

Дефект, при котором **язык принимает программу, которую обязан отвергнуть**, или
**напечатанный код ведёт себя иначе, чем интерпретатор**, — настоящий дефект
независимо от того, можно ли им воспользоваться. Сообщайте в любом случае;
разница решает только, закрытым будет сообщение или открытым.

## Что не входит

Программы, **написанные на** flang, — не ответственность этого проекта, как и то,
что кто-либо строит поверх JSON, который печатает `flang ast`.
