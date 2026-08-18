/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Имена, ЗАНЯТЫЕ САМОЙ ЦЕЛЬЮ, и обход этих имён при печати.
 *
 * ── Чего не хватало ─────────────────────────────────────────────────────────
 *
 * Печать отдаёт имя модуля flang прямо в пространство имён цели: в Python это
 * файл `<имя>.py` рядом с прогонщиком, в Java и C# — класс, в Elixir — алиас, в
 * Rust — `mod` в корне крейта, в C — заголовок и единица трансляции, в Go — файл
 * пакета, в JavaScript — файл модуля. У каждой из восьми целей часть этого
 * пространства ЗАНЯТА заранее — своей стандартной библиотекой либо своими же
 * правилами именования файлов, — и печать про это не знала вовсе.
 *
 * Улика: `модуль «JSON»` печатается в `json.py`, ложится рядом с `flang_cli.py`,
 * а прогонщик делает `import json` и получает НАШ модуль вместо библиотеки:
 *
 *     AttributeError: module 'json' has no attribute 'loads'
 *
 * Питон даже подсказывает («consider renaming ... same name as the standard
 * library module»), но сказать это некому: программа уже напечатана, отказа не
 * было, а сломалось не при печати, а при запуске. Второе имя — `datetime` — то
 * же самое. Оба имени законны в flang, и запрещать их печать не вправе.
 *
 * ── Почему обход, а не отказ и не переименование модуля ─────────────────────
 *
 * ПЕРЕИМЕНОВАТЬ МОДУЛЬ (`«JSON»` → `«Разбор JSON»`) дёшево ровно один раз — в
 * своём дереве. Беда при этом не чинится, а перекладывается на каждого, кто
 * напишет `модуль «JSON»` завтра и в чужом коде: она снова придёт молча и снова
 * не при печати, а при запуске.
 *
 * ОТКАЗАТЬ при столкновении честно, но запрещает законное имя, и запрет этот —
 * подвижный: `JSON` стал модулем Elixir только в 1.18, `tomllib` появился в
 * Python 3.11, `zoneinfo` — в 3.9. Отказ означал бы, что обновление ЦЕЛИ ломает
 * печать программы, которая не менялась. Так поступать нельзя с именем, которое
 * автор выбрал законно.
 *
 * ОБОЙТИ — приставка (Go: суффикс) ровно тем именам, что столкнулись. Это чинит
 * корень: имя `«JSON»` остаётся законным, печатается всегда, а в цели получает
 * имя, которого у цели нет. Цена — только у затронутых программ: у всех прочих
 * приставка не появляется и вывод не меняется НИ НА БАЙТ.
 *
 * ── Восемь пространств — восемь разных наборов ──────────────────────────────
 *
 * Набор у каждой цели свой, и не только по составу, но и по ПРИРОДЕ:
 *
 *   python  — верхнеуровневые модули стандартной библиотеки: программа ложится
 *             в `sys.path[0]` рядом с прогонщиком и затеняет их все;
 *   c       — заголовки стандарта C плюс файлы самого бэкенда: два `time.h` в
 *             одном каталоге разбирает уже не читатель, а флаги компилятора;
 *   java    — типы `java.lang` (импортируются неявно) и типы, которые печатает
 *             сам бэкенд: класс безымянного пакета побеждает импорт по требованию;
 *   csharp  — типы `System` и `System.Collections.Generic` при `using`-ах, что
 *             печатает бэкенд;
 *   elixir  — алиасы стандартной библиотеки: `defmodule Enum` перехватывает
 *             `Enum.map` во всём напечатанном;
 *   rust    — крейты внешнего прелюда (`std`, `core`, `alloc`, `test`,
 *             `proc_macro`) и файлы крейта: `mod std;` в корне уводит `std::`
 *             на себя, а `src/main.rs` — это точка входа бинарника;
 *   go      — ЗДЕСЬ ИНАЧЕ. Пакет программы зафиксирован (`flang`), имя модуля
 *             доезжает только до имени файла, и стандартная библиотека Go
 *             затенена быть не может. Зато занято другое: последний сегмент
 *             имени файла Go — это НЕЯВНОЕ УСЛОВИЕ СБОРКИ. `модуль «Сетка
 *             Windows»` даёт `setka_windows.go`, и на Linux этого файла для
 *             сборки просто нет — «undefined: NewContext» на сборке, ни слова о
 *             причине. Тот же класс дефекта, то же молчание;
 *   js      — печатается ОДИН самодостаточный файл, а голый спецификатор Node в
 *             относительный файл не резолвится: стандартную библиотеку JS занять
 *             нельзя. Занят только прогонщик, который бэкенд кладёт рядом.
 *
 * ── Что этот файл НЕ решает ─────────────────────────────────────────────────
 *
 * Он не трогает имена ФУНКЦИЙ и типов внутри модуля — их держат списки
 * `*_RESERVED` в каждом бэкенде, и там правило другое: столкновение имени модели
 * с ключевым словом цели — это ОШИБКА МОДЕЛИ, её называют, а не обходят. Здесь
 * же имя выбрано автором для МОДУЛЯ, а занято оно не автором, а целью.
 *
 * Он не отменяет отказ по именам САМОГО БЭКЕНДА там, где такой отказ уже стоит
 * (`flang_runtime`, `flang_cli`): обход бежит ПЕРЕД ним, поэтому обойдённое имя
 * до отказа не доезжает, а имя, которое совпало с рантаймом дословно, отказ
 * по-прежнему называет.
 *
 * Близнецы печати на самом языке (`flang/self/emit-*.flang`) держат ТЕ ЖЕ
 * наборы и ТОТ ЖЕ обход своими функциями: правка сюда без правки туда молчит до
 * первой подходящей формы в корпусе.
 */

/* Верхнеуровневые модули стандартной библиотеки Python — объединение по версиям
   3.9…3.14: программу печатают один раз, а запускают на том Python, что есть. */
const PYTHON_STDLIB = [
  "abc", "aifc", "annotationlib", "antigravity", "argparse", "array", "ast", "asynchat",
  "asyncio", "asyncore", "atexit", "audioop", "base64", "bdb", "binascii", "binhex",
  "bisect", "builtins", "bz2", "cProfile", "calendar", "cgi", "cgitb", "chunk", "cmath",
  "cmd", "code", "codecs", "codeop", "collections", "colorsys", "compileall",
  "compression", "concurrent", "configparser", "contextlib", "contextvars", "copy",
  "copyreg", "crypt", "csv", "ctypes", "curses", "dataclasses", "datetime", "dbm",
  "decimal", "difflib", "dis", "distutils", "doctest", "email", "encodings", "ensurepip",
  "enum", "errno", "faulthandler", "fcntl", "filecmp", "fileinput", "fnmatch", "formatter",
  "fractions", "ftplib", "functools", "gc", "genericpath", "getopt", "getpass", "gettext",
  "glob", "graphlib", "grp", "gzip", "hashlib", "heapq", "hmac", "html", "http", "idlelib",
  "imaplib", "imghdr", "imp", "importlib", "inspect", "io", "ipaddress", "itertools",
  "json", "keyword", "lib2to3", "linecache", "locale", "logging", "lzma", "mailbox",
  "mailcap", "marshal", "math", "mimetypes", "mmap", "modulefinder", "msilib", "msvcrt",
  "multiprocessing", "netrc", "nis", "nntplib", "nt", "ntpath", "nturl2path", "numbers",
  "opcode", "operator", "optparse", "os", "ossaudiodev", "pathlib", "pdb", "pickle",
  "pickletools", "pipes", "pkgutil", "platform", "plistlib", "poplib", "posix",
  "posixpath", "pprint", "profile", "pstats", "pty", "pwd", "py_compile", "pyclbr",
  "pydoc", "pydoc_data", "pyexpat", "queue", "quopri", "random", "re", "readline",
  "reprlib", "resource", "rlcompleter", "runpy", "sched", "secrets", "select", "selectors",
  "shelve", "shlex", "shutil", "signal", "site", "smtpd", "smtplib", "sndhdr", "socket",
  "socketserver", "spwd", "sqlite3", "sre_compile", "sre_constants", "sre_parse", "ssl",
  "stat", "statistics", "string", "stringprep", "struct", "subprocess", "sunau",
  "symtable", "sys", "sysconfig", "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile",
  "termios", "textwrap", "this", "threading", "time", "timeit", "tkinter", "token",
  "tokenize", "tomllib", "trace", "traceback", "tracemalloc", "tty", "turtle",
  "turtledemo", "types", "typing", "unicodedata", "unittest", "urllib", "uu", "uuid",
  "venv", "warnings", "wave", "weakref", "webbrowser", "winreg", "winsound", "wsgiref",
  "xdrlib", "xml", "xmlrpc", "zipapp", "zipfile", "zipimport", "zlib", "zoneinfo",
]

/* Заголовки стандарта C (C89…C23) и те POSIX-заголовки, что зовёт рантайм цели:
   имя файла программы — это имя заголовка, и второй `string.h` в каталоге
   сборки разбирает уже не читатель. */
const C_HEADERS = [
  "assert", "complex", "ctype", "errno", "fenv", "float", "inttypes", "iso646", "limits",
  "locale", "math", "setjmp", "signal", "stdalign", "stdarg", "stdatomic", "stdbit",
  "stdbool", "stdckdint", "stddef", "stdint", "stdio", "stdlib", "stdnoreturn", "string",
  "tgmath", "threads", "time", "uchar", "wchar", "wctype",
  "dirent", "fcntl", "pthread", "sched", "semaphore", "strings", "sys", "termios",
  "unistd",
]

/* Классы и интерфейсы `java.lang` — они импортированы неявно, — плюс типы,
   которые печатает сам бэкенд, и типы `java.util`, что он зовёт по имени.
   Тип безымянного пакета побеждает импорт по требованию: класс `String` рядом
   с напечатанным сделал бы `String` в напечатанном другим типом молча. */
const JAVA_TYPES = [
  "AbstractMethodError", "Appendable", "ArithmeticException",
  "ArrayIndexOutOfBoundsException", "ArrayStoreException", "AssertionError",
  "AutoCloseable", "Boolean", "Byte", "Character", "CharSequence", "Class",
  "ClassCastException", "ClassLoader", "ClassNotFoundException", "Cloneable",
  "CloneNotSupportedException", "Comparable", "Compiler", "Deprecated", "Double", "Enum",
  "Error", "Exception", "Float", "FunctionalInterface", "IllegalAccessException",
  "IllegalArgumentException", "IllegalStateException", "IndexOutOfBoundsException",
  "InheritableThreadLocal", "Integer", "InterruptedException", "Iterable", "Long", "Math",
  "Module", "Number", "NumberFormatException", "Object", "Override", "Package", "Process",
  "ProcessBuilder", "Readable", "Record", "Runnable", "Runtime", "RuntimeException",
  "SafeVarargs", "SecurityManager", "Short", "StackTraceElement", "StrictMath", "String",
  "StringBuffer", "StringBuilder", "StringIndexOutOfBoundsException", "SuppressWarnings",
  "System", "Thread", "ThreadGroup", "ThreadLocal", "Throwable", "Void",
  "UnsupportedOperationException",
  "ArrayList", "Arrays", "Collection", "Collections", "Comparator", "HashMap", "HashSet",
  "Iterator", "LinkedHashMap", "List", "Map", "Objects", "Optional", "Set",
]

/* Типы `System` и `System.Collections.Generic` — бэкенд печатает `using` обоих,
   и класс в той же области имён победил бы их молча. */
const CSHARP_TYPES = [
  "Action", "Activator", "Array", "ArgumentException", "ArgumentNullException",
  "ArgumentOutOfRangeException", "AttributeUsageAttribute", "Attribute", "Boolean",
  "Buffer", "Byte", "Char", "Console", "Convert", "DateOnly", "DateTime", "DateTimeOffset",
  "Decimal", "Delegate", "Double", "Enum", "Environment", "Exception", "Func", "GC",
  "Guid", "IComparable", "IDisposable", "IEquatable", "IFormattable", "Index", "Int16",
  "Int32", "Int64", "IntPtr", "Lazy", "Math", "MathF", "MemoryExtensions", "Nullable",
  "Object", "ObsoleteAttribute", "OperatingSystem", "OutOfMemoryException",
  "OverflowException", "Predicate", "Random", "Range", "SByte", "Single", "Span",
  "StackOverflowException", "String", "StringComparer", "StringComparison", "SystemException",
  "TimeOnly", "TimeSpan", "TimeZoneInfo", "Tuple", "Type", "UInt16", "UInt32", "UInt64",
  "UIntPtr", "Uri", "ValueTuple", "ValueType", "Version", "Void", "WeakReference",
  "Comparer", "Dictionary", "EqualityComparer", "HashSet", "ICollection", "IComparer",
  "IDictionary", "IEnumerable", "IEnumerator", "IEqualityComparer", "IList", "IReadOnlyList",
  "KeyValuePair", "LinkedList", "List", "Queue", "SortedDictionary", "SortedSet", "Stack",
]

/* Алиасы стандартной библиотеки Elixir: `defmodule Enum` перехватывает `Enum.map`
   во всём, что напечатано рядом. `JSON` здесь с 1.18 — ровно то имя из улики. */
const ELIXIR_ALIASES = [
  "Access", "Agent", "Application", "ArgumentError", "ArithmeticError", "Atom", "Base",
  "Behaviour", "Bitwise", "Calendar", "Code", "Collectable", "Config", "Date", "DateTime",
  "DynamicSupervisor", "Enum", "Enumerable", "Exception", "File", "Float", "Function",
  "GenEvent", "GenServer", "HashDict", "HashSet", "IO", "Inspect", "Integer", "JSON",
  "Kernel", "Keyword", "List", "Macro", "Map", "MapSet", "Module", "NaiveDateTime", "Node",
  "OptionParser", "Path", "Port", "Process", "Protocol", "Range", "Record", "Regex",
  "Registry", "Runtime", "Stream", "String", "StringIO", "Supervisor", "System", "Task",
  "Time", "Tuple", "URI", "Version", "Duration",
]

/* Крейты внешнего прелюда Rust и файлы, которые печатает бэкенд крейта.
   `mod std;` в корне крейта уводит на себя `std::` во всех путях этого корня,
   а `src/main.rs` — это точка входа бинарника, её печатает бэкенд. */
const RUST_CRATE_NAMES = ["std", "core", "alloc", "proc_macro", "test", "main", "lib", "build"]

/* Последний сегмент имени файла Go — неявное условие сборки по GOOS/GOARCH, а
   `_test` делает файл тестовым. Занято здесь не имя целиком, а ХВОСТ. */
const GO_BUILD_TAGS = [
  "test",
  "aix", "android", "darwin", "dragonfly", "freebsd", "hurd", "illumos", "ios", "js",
  "linux", "nacl", "netbsd", "openbsd", "plan9", "solaris", "wasip1", "windows", "zos",
  "386", "amd64", "amd64p32", "arm", "arm64", "arm64be", "armbe", "loong64", "mips",
  "mips64", "mips64le", "mips64p32", "mips64p32le", "mipsle", "ppc", "ppc64", "ppc64le",
  "riscv", "riscv64", "s390", "s390x", "sparc", "sparc64", "wasm",
  "unix",
]

/**
 * Восемь наборов и приём обхода у каждого.
 *
 * `имена`     — занятое целиком, сравнение знак в знак;
 * `хвосты`    — занятый ПОСЛЕДНИЙ сегмент имени через `_` (только Go);
 * `приставка` — чем обходить, если занято;
 * `суффикс`   — чем обходить, если занят хвост (приставка хвоста не снимает).
 */
export const ЗАНЯТО_ЦЕЛЬЮ = {
  c: { имена: [...C_HEADERS, "flang_runtime", "flang_cli", "flang_conc", "flang_repl"], хвосты: [], приставка: "flang_", суффикс: "" },
  go: { имена: [], хвосты: GO_BUILD_TAGS, приставка: "", суффикс: "_flang" },
  rust: { имена: RUST_CRATE_NAMES, хвосты: [], приставка: "flang_", суффикс: "" },
  python: { имена: [...PYTHON_STDLIB, "flang_runtime", "flang_cli"], хвосты: [], приставка: "flang_", суффикс: "" },
  java: { имена: JAVA_TYPES, хвосты: [], приставка: "Flang", суффикс: "" },
  csharp: { имена: CSHARP_TYPES, хвосты: [], приставка: "Flang", суффикс: "" },
  elixir: { имена: ELIXIR_ALIASES, хвосты: [], приставка: "Flang", суффикс: "" },
  js: { имена: ["flang_cli", "flang_conc"], хвосты: [], приставка: "flang_", суффикс: "" },
}

/**
 * Занято ли имя целью: либо совпало целиком, либо занят его последний сегмент.
 *
 * @param {string} имя
 * @param {{ имена: string[], хвосты: string[] }} набор
 * @returns {boolean}
 */
export function занятоЦелью(имя, набор) {
  if (набор.имена.includes(имя)) return true
  if (набор.хвосты.length === 0) return false
  const части = имя.split("_")
  return части.length > 1 && набор.хвосты.includes(части[части.length - 1])
}

/**
 * Обход занятого имени: приставка (или суффикс) повторяется, пока имя занято.
 *
 * Повтор здесь не украшение: `модуль «Std»` в Rust даёт `std` → `flang_std`,
 * а `модуль «Flang Std»` даёт сразу `flang_std` — и если бы обход добавлял
 * приставку один раз, два РАЗНЫХ модуля дали бы одно имя. Набор конечен, а
 * каждый шаг удлиняет имя, поэтому цикл конечен.
 *
 * Свободное имя возвращается КАК ЕСТЬ: у программы, чьё имя цель не занимала,
 * не меняется ни байт.
 *
 * @param {string} имя
 * @param {keyof ЗАНЯТО_ЦЕЛЬЮ} цель
 * @returns {string}
 */
export function обойтиЗанятоеЦелью(имя, цель) {
  const набор = ЗАНЯТО_ЦЕЛЬЮ[цель]
  if (набор === undefined) throw new Error(`неизвестная цель печати: ${цель}`)
  let результат = имя
  /* Предел — длина набора плюс один: больше шагов, чем занятых имён, обходу не
     нужно никогда, а бесконечного цикла в печати быть не должно даже теоретически. */
  const предел = набор.имена.length + набор.хвосты.length + 1
  for (let шаг = 0; шаг < предел && занятоЦелью(результат, набор); шаг += 1) {
    результат = `${набор.приставка}${результат}${набор.суффикс}`
  }
  return результат
}
