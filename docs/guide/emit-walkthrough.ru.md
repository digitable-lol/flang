[К README](../README.ru.md) · [Указатель документации](../README.md) · [English](emit-walkthrough.md)

# Печать программы: один файл, напечатанный в C и JavaScript

Это [`docs/examples/leetcode/035-search-insert-position.flang`](examples/leetcode/035-search-insert-position.flang)
как он лежит в дереве — место, куда значение встаёт в отсортированном списке:

```flang
модуль «Search insert position»

тотальная функция «Шаг места вставки»
  принимает акк: число, эл: число, цель: число
  возвращает число
  обеспечивает «элемент меньше цели двигает место на единицу» если эл меньше цель то (результат равен (акк плюс 1)) иначе да
  обеспечивает «иначе место стоит на прежнем» если не (эл меньше цель) то (результат равен акк) иначе да
  пример «Элемент меньше цели — шаг вперёд»
    дано акк равно 2
    дано эл равно 3
    дано цель равно 5
    ожидается 3
  пример «Элемент не меньше цели — место не двигается»
    дано акк равно 2
    дано эл равно 7
    дано цель равно 5
    ожидается 2
  если эл меньше цель то акк плюс 1 иначе акк

тотальная функция «Место вставки»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 5
    ожидается 2
  пример «Пример 2 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 2
    ожидается 1
  пример «Пример 3 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 7
    ожидается 4
  свёртка элементы начиная с 0 как акк и эл → «Шаг места вставки» от акк и эл и цель
```

```bash
flang emit docs/examples/leetcode/035-search-insert-position.flang --target c  --out out-c
flang emit docs/examples/leetcode/035-search-insert-position.flang --target js --out out-js
```

Восемь целей печатают модуль, рантайм, прогонщик с JSON на входе и выходе, файл сборки и — где
у цели он есть — манифест пакета (`go.mod`, `Cargo.toml`, `flang.csproj`, `package.json`); цель
JavaScript печатает три файла: один самодостаточный модуль, рядом тот же прогонщик
(`flang_cli.js`, снимается ключом `--no-cli`) и тот самый манифест. При этом
сам модуль остаётся одним самодостаточным файлом, который идёт и в Node, и в браузере. Без `Makefile` остаются как раз эти двое: `js` и `ts` — последняя печатает модуль одним
файлом `.ts` рядом с рантаймом и прогонщиком цели `js` и кладёт `tsconfig.json`, а сборка у неё
`tsc -p .`. Здесь показаны две цели из десяти, у каждой только вторая функция, вставлено из
прогона выше без правок:

<details>
<summary><b>C</b> — <code>out-c/search_insert_position.c</code></summary>

```c
fl_status search_insert_position_mesto_vstavki(fl_ctx *ctx, fl_value elementy, fl_value cel, fl_value *result, fl_error *error) {
  fl_value fl_t2 = fl_nothing();
  FL_TRY(fl_require_list(ctx, elementy, "свёртка", &fl_t2, error));
  fl_value akk = fl_number(0.0); /* «акк» */
  const fl_mark fl_t4 = fl_region_open(ctx);
  for (size_t fl_t3 = 0; fl_t3 < fl_t2.as.list.count; fl_t3 += 1) {
    const fl_value el = fl_t2.as.list.items[fl_t3]; /* «эл» */
    fl_value fl_t5 = fl_nothing();
    FL_TRY(search_insert_position_shag_mesta_vstavki(ctx, akk, el, cel, &fl_t5, error));
    akk = fl_t5;
    FL_TRY(fl_region_recycle(ctx, fl_t4, &akk, error));
  }
  FL_TRY(fl_region_close(ctx, fl_t4, FL_OK, &akk, error));
  *result = akk;
  return FL_OK;
}
```

</details>

<details>
<summary><b>JavaScript</b> — <code>out-js/search_insert_position.js</code></summary>

```js
/**
 * Функция flang «Место вставки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<number>} elementy — «элементы»
 * @param {number} cel — «цель»
 * @returns {number}
 */
export function mestoVstavki(elementy, cel) {
  const $t1 = $requireList(elementy, "свёртка")
  let akk = 0
  for (const el of $t1) {
    akk = shagMestaVstavki(akk, el, cel)
  }
  return akk
}
```

</details>

Напечатанный код несёт имена предметной области в комментариях, дословно сообщает коды
диагностик компилятора, а его шапка говорит, что он такое: *«Правьте исходник на flang и
печатайте заново: любая правка здесь потеряется.»* Шапка JavaScript всё ещё называет файл,
которого в дереве больше нет; эту строку пишет печать, и вставка оставлена как напечатана.
Исходники рантайма каждой цели копируются в вывод дословно — из `share/flang/<цель>/` рядом с
двоичным или из `--runtime <каталог>`. Как проверяются цели и насколько неровно —
[Известные ограничения](guide/limits.ru.md).
