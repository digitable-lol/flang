/* Правило отбора прошлого замера, прогнанное на НЫНЕШНЕЙ библиотеке: все функции
   flang/stdlib в порядке «файл по алфавиту, внутри файла по объявлению», годные —
   те, у кого нет ни постусловия, ни предусловия, шаг = ⌊годных / 20⌋.
   Печатает оба числа отчёта: сколько функций всего и какой набор даёт правило. */
import { readFileSync, readdirSync } from "node:fs"
const КОРЕНЬ = "/home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc"
const { parse } = await import(КОРЕНЬ + "/flang/src/parser.mjs")
const dir = КОРЕНЬ + "/flang/stdlib"
const files = readdirSync(dir).filter((f) => f.endsWith(".flang")).sort()
const все = []
for (const f of files) {
  const ast = parse(readFileSync(dir + "/" + f, "utf8"), f)
  for (const узел of ast.functions)
    все.push({
      файл: f,
      имя: узел.name,
      строка: узел.span?.line ?? "?",
      постусловий: (узел.postconditions ?? []).length,
      предусловий: (узел.preconditions ?? []).length,
    })
}
console.log("ФАЙЛОВ:", files.length)
console.log("ВСЕГО ФУНКЦИЙ:", все.length)
const сПост = все.filter((ф) => ф.постусловий > 0)
console.log("С ПОСТУСЛОВИЕМ:", сПост.length, "—", сПост.map((ф) => "«" + ф.имя + "»").join(", "))
const годные = все.filter((ф) => ф.постусловий === 0 && ф.предусловий === 0)
console.log("ГОДНЫХ:", годные.length)
const шаг = Math.floor(годные.length / 20)
console.log("ШАГ:", шаг)
for (let i = 0, н = 1; i < годные.length && н <= 20; i += шаг, н++) {
  const ф = годные[i]
  console.log(String(н).padStart(2), (ф.файл + ":" + ф.строка).padEnd(28), "«" + ф.имя + "»")
}

/* И проверка, что СТАРАЯ двадцатка воспроизводима: её номера в общем порядке. */
const старые = [
  "Ключ связи", "Ключ звена", "Вписать", "Размер словаря", "Противоположное",
  "Приписать в начало", "Вставить по", "Максимум", "Взять первые", "Двоичный поиск",
  "Уникальные", "Следует", "Чётное", "Дерево из чисел", "Первый элемент или запасное",
  "Успешно", "Есть в множестве", "Приписать строку в начало", "Строчная буква",
  "Обрезать пробелы",
]
const файлы = [
  "dictionary.flang", "hashmap.flang", "hashmap.flang", "hashmap.flang", "higher-order.flang",
  "higher-order.flang", "higher-order.flang", "higher-order.flang", "lists.flang", "lists.flang",
  "lists.flang", "logic.flang", "numbers.flang", "numtree.flang", "optional.flang",
  "result.flang", "sets.flang", "strings.flang", "strings.flang", "strings.flang",
]
console.log("номера СТАРОЙ двадцатки в нынешнем порядке (ждём 0, 9, 18, …, 171):")
console.log(старые.map((имя, и) => все.findIndex((ф) => ф.имя === имя && ф.файл === файлы[и])).join(", "))
