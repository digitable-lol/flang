# Упражнения тура по языку · Tour exercises

Задания со страниц [тура по языку](../../../site/tour-functions.ru.md). У
каждого задания свой каталог с одним и тем же набором файлов:

| Файл | Что это |
| --- | --- |
| `task.ru.md`, `task.md` | условие по-русски и по-английски |
| `stub/<имя>.flang` | заготовка: `flang check` обязан ответить ошибкой, код возврата 1 |
| `solution/<имя>.flang` | решение: `flang check` обязан пройти, код возврата 0 |

Оба требования проверяет команда из корня репозитория:

```bash
sh scripts/site/tour-exercises.sh
```

Each exercise of the [language tour](../../../site/tour-functions.md) has its
own directory with the same set of files: the task in two languages, a starting
file that must fail `flang check`, and a solution that must pass it. The
command above checks both.
