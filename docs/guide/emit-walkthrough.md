[Back to README](../../README.md) · [Documentation index](../README.md) · [Русский](emit-walkthrough.ru.md)

# Emitting a program: one file printed into C and JavaScript

This is [`docs/examples/leetcode/035-search-insert-position.flang`](docs/examples/leetcode/035-search-insert-position.flang)
as it stands in the tree — the position where a value belongs in a sorted list:

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

Eight backends emit the module, a runtime, a JSON-in/JSON-out driver, a build file and — where
the target has one — a package manifest (`go.mod`, `Cargo.toml`, `flang.csproj`, `package.json`);
the JavaScript backend emits three files: a single self-contained module, the same driver next to
it (`flang_cli.js`, dropped by `--no-cli`) and that manifest. Even so,
the module itself stays one self-contained file that runs in Node and in the browser. The two without a `Makefile` are those last two: `js`, and `ts`, which prints the
module as one `.ts` file beside the JavaScript runtime, the same driver and a `tsconfig.json` —
`tsc -p .` is its build step. Two of the ten are shown here, only the second function of each,
pasted from the run above and not edited:

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

The printed code carries the domain names in comments, reports the compiler's diagnostic codes
verbatim, and its header says what it is: *«Правьте исходник на flang и печатайте заново: любая
правка здесь потеряется.»* The JavaScript header still names a file the tree no longer has; the
printer writes that string, and the paste is left as printed. Every target's runtime sources are
copied into the output verbatim from `share/flang/<target>/` next to the binary, or from
`--runtime <dir>`. How the targets are checked, and how unevenly —
[Known limits](docs/guide/limits.md).
