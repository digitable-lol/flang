defmodule Flang.Error do
  @moduledoc """
  Диагностика flang: код и текст, дословно совпадающие с интерпретатором.

  Исключение, а не `{:error, _}`, и это единственное место, где бэкенд Elixir
  идёт против местного обычая. Обычай хорош, когда отказ — ожидаемая ветвь
  вычисления; здесь же ошибку умеет дать любая операция языка, вплоть до
  сложения двух значений, которые оказались не числами. Кортеж-результат
  означал бы, что каждое выражение flang превращается в `with`, а порядок
  вычисления приходится расписывать руками — то есть ровно ту форму, которой
  занята половина тела каждой функции в бэкенде Go, где выбора нет. Исключение
  прерывает вычисление немедленно и доходит до того, кто готов его обработать
  (прогонщик, тест, встраивающая система).

  Код — строка, а не атом: коды flang перечислимы (SPEC, раздел 7), но код
  нарушенного постусловия приезжает данными из AST — у моделей FTS это
  «FTS_UTILITY_PROPERTY», — и атом, созданный из внешних данных, засорял бы
  таблицу атомов BEAM, которая не собирается сборщиком мусора.
  """
  defexception [:code, :message]

  @impl true
  def message(%__MODULE__{message: text}), do: text
end

defmodule Flang.Rt do
  @moduledoc """
  Рантайм flang для бэкенда Elixir.

  ## Почему рантайм не тонкий

  Elixir ложится на flang лучше всех целевых языков сразу в трёх местах:
  неизменяемость значений здесь по умолчанию, сопоставление с образцом —
  встроенная конструкция, а хвостовые вызовы гарантированы машиной, поэтому ни
  цикла, ни батута, которые печатают бэкенды C, Go, Rust, Python, Java и C#,
  здесь не нужно вовсе.

  И ровно поэтому расхождения тем опаснее: их не видно ни компилятору, ни
  читателю. Их четыре, и все четыре закрыты здесь.

  ### 1. IEEE-754 против арифметики BEAM

  Это главное расхождение бэкенда, и оно не имеет отношения к «целым
  произвольной точности», которых боишься заранее. Настоящая беда в другом:
  **на BEAM невозможно получить значение с плавающей точкой, равное NaN или
  бесконечности.** Машина не возвращает их, а возбуждает `ArithmeticError`:

      1.0 / 0.0        ** (ArithmeticError)
      1.0e308 * 10.0   ** (ArithmeticError)
      :math.fmod(7.0, 0.0)  ** (ArithmeticError)

  А SPEC (раздел 5) требует, чтобы деление на ноль давало `Infinity` или `NaN`
  как ЗНАЧЕНИЕ, а не как ошибку, и чтобы `NaN` был равен `NaN`. Поэтому число
  flang здесь — это `float()` для конечных значений и один из атомов `:nan`,
  `:inf`, `:ninf` для тех трёх, которых у BEAM нет. Вся арифметика идёт через
  функции этого модуля, каждая из которых разбирает особые случаи по правилам
  IEEE-754, а переполнение конечных операндов ловит `rescue ArithmeticError` и
  превращает в бесконечность нужного знака.

  Цена решения — девять клауз на каждую арифметическую операцию вместо одного
  оператора. Альтернатив нет: любая попытка обойтись родным `+` дала бы
  программу, которая на `1 делить на 0` падает там, где интерпретатор считает.

  ### 2. Целые произвольной точности

  Целых чисел в flang нет вовсе (SPEC, раздел 2), а в Elixir они есть, они
  неограниченной точности и они заразны: `length(list)` даёт `integer`,
  `2 ** 70` — точное целое, которого в IEEE-754 нет. Поэтому число flang —
  всегда `float()`, и всякий результат `length/1`, `trunc/1` и прочих
  целочисленных форм умножается на `1.0` прежде, чем стать значением.

  ### 3. Строки в кодовых точках, а не в графемах

  `String.length/1` считает ГРАФЕМЫ: «е» с комбинирующим ударением там одна
  единица, а кодовых точек две. SPEC (раздел 5) требует кодовые точки — ровно
  то, что даёт `String.to_charlist/1`. Для эмодзи и кириллицы результат тот же,
  а для составных знаков — нет, и молчаливое расхождение хуже громкого.

  ### 4. Пределы и рекурсия

  BEAM ограничивает рекурсию иначе, чем все остальные цели: стека
  фиксированного размера у процесса нет, он растёт в куче, и незавершающаяся
  нехвостовая рекурсия не падает, а съедает память машины целиком. Значит
  счётчик глубины здесь не подстраховка, а единственное, что стоит между
  программой и падением всего узла. Хвостовые же вызовы BEAM переиспользует
  сам, поэтому напечатанный код не разворачивает их ни в цикл (которого в
  Elixir нет), ни в батут: `Отсчёт` вызывает себя напрямую и идёт в постоянной
  глубине, как у интерпретатора.

  Счётчики живут в словаре процесса. Это единственное изменяемое состояние во
  всём бэкенде, и оно осознанное: контекст вычисления по своей природе
  изменяем, а протащить его через каждое выражение значило бы удвоить размер
  напечатанного кода и потерять ту самую читаемость, ради которой всё
  затевалось. Словарь процесса локален процессу, поэтому два одновременных
  вычисления не мешают друг другу — в отличие от `:persistent_term` или ETS.

  ## Представление значения

  Значения flang (SPEC, раздел 2) — скаляр, список, запись, вариант. Соблазн
  отобразить их на родные типы Elixir велик, но неисполним: отдельного
  «варианта» там нет, `true` неотличим от атома, а структурное равенство
  пришлось бы всё равно писать своё (родное `===` считает `NaN` невозможным, а
  порядок полей записи — значимым). Поэтому представление одно — размеченный
  кортеж:

      :nothing                        «ничто»
      {:num, float() | :nan | :inf | :ninf}
      {:flag, boolean()}
      {:str, binary()}
      {:list, [value]}
      {:rec, [{binary(), value}]}     порядок полей сохраняется
      {:var, binary(), [{binary(), value}]}

  Поля — список пар, а не `Map`: порядок полей наблюдаем (он попадает в текст
  диагностики «запись {цена, количество}» и в размеченный JSON прогонщика), а
  `Map` в Elixir порядка вставки не хранит.

  Суммы типов flang — значения `{:var, имя, поля}` с дискриминантом-строкой, а
  не структуры Elixir: дискриминант в flang именной, и литерал
  `{variant, fields}`, приехавший из JSON, статического типа не имеет вовсе.
  Типизированный слой поверх этого печатает бэкенд — по функции-конструктору на
  каждый вариант и на каждую запись.
  """

  # Коды диагностик (SPEC, раздел 7) — модульными атрибутами, чтобы не
  # разъехались опечатки.
  @code_type "FLANG_TYPE"
  @code_unknown_name "FLANG_UNKNOWN_NAME"
  @code_match "FLANG_MATCH_NOT_EXHAUSTIVE"
  @code_builtin_args "FLANG_BUILTIN_ARGS"
  @code_recursion_limit "FLANG_RECURSION_LIMIT"

  def code_type, do: @code_type
  def code_unknown_name, do: @code_unknown_name
  def code_match, do: @code_match
  def code_builtin_args, do: @code_builtin_args
  def code_recursion_limit, do: @code_recursion_limit

  @doc "Собирает диагностику. Возвращает исключение — возбуждает вызывающий."
  def fail(code, message), do: %Flang.Error{code: code, message: message}

  # ───────────────────────────── значения ─────────────────────────────

  @doc "«ничто»."
  def nothing, do: :nothing

  @doc """
  Число. Целое приводится к float: целых чисел в flang нет (SPEC, раздел 2), а
  в Elixir они заразны — `length/1` и `trunc/1` дают именно их.
  """
  def number(value) when is_integer(value), do: {:num, value * 1.0}
  def number(value), do: {:num, value}

  @doc "Признак."
  def flag(value), do: {:flag, value}

  @doc "Строка."
  def text(value), do: {:str, value}

  @doc "Список."
  def list(items), do: {:list, items}

  @doc "Запись: поля в порядке объявления."
  def record(fields), do: {:rec, fields}

  @doc "Вариант суммы типов: дискриминант плюс поля."
  def variant(name, fields), do: {:var, name, fields}

  @doc "Скаляр ли значение (SPEC, раздел 2: строка, число, признак, ничто)."
  def scalar?(:nothing), do: true
  def scalar?({:num, _}), do: true
  def scalar?({:flag, _}), do: true
  def scalar?({:str, _}), do: true
  def scalar?(_), do: false

  @doc "Список ли значение."
  def list?({:list, _}), do: true
  def list?(_), do: false

  @doc "Вариант ли значение с именно этим дискриминантом."
  def variant_is?({:var, name, _}, name), do: true
  def variant_is?(_, _), do: false

  @doc """
  Пустая ли цепочка — образец «случай пусто».

  Цепочка — список ЛИБО строка: образцы `пусто` и `голова и хвост` разбирают
  обе. У строки ровно два случая, пустая и «первый символ и остаток», третьего
  нет. Голова строки — одна КОДОВАЯ ТОЧКА, а не байт: строка Elixir хранится в
  UTF-8, и байтовая нарезка разваливала бы эмодзи пополам, расходясь с «длина»
  и «символы». `String.next_grapheme/1` здесь не годится по той же причине, по
  какой не годится StringInfo в C#: он режет графемные кластеры.
  """
  def chain_empty?({:str, text}), do: text == ""
  def chain_empty?({:list, items}), do: items == []
  def chain_empty?(_), do: false

  @doc "Непустая ли цепочка — образец «случай голова и хвост»."
  def chain_cons?({:str, text}), do: text != ""
  def chain_cons?({:list, items}), do: items != []
  def chain_cons?(_), do: false

  @doc "Голова цепочки: первый элемент списка или первый символ строки."
  def chain_head({:str, text}), do: {:str, String.first(text)}
  def chain_head({:list, [first | _]}), do: first

  @doc "Хвост цепочки: остаток списка или остаток строки."
  def chain_tail({:str, text}), do: {:str, String.slice(text, 1..-1//1)}
  def chain_tail({:list, [_ | rest]}), do: {:list, rest}

  @doc "Имя типа значения для диагностик (typeName интерпретатора)."
  def type_name(:nothing), do: "ничто"
  def type_name({:str, _}), do: "строка"
  def type_name({:num, _}), do: "число"
  def type_name({:flag, _}), do: "признак"
  def type_name({:list, _}), do: "список"
  def type_name({:var, name, _}), do: "вариант «" <> name <> "»"
  def type_name({:rec, _}), do: "запись"
  def type_name(_), do: "неизвестное значение"

  @doc """
  Короткое описание значения для диагностик (describeValue интерпретатора).

  Порядок полей — порядок объявления: он попадает в текст диагностики, а тексты
  сверяются с интерпретатором дословно.
  """
  def describe({:str, value}), do: quote_json(value)
  def describe({:var, name, []}), do: name
  def describe({:var, name, fields}), do: name <> "(" <> field_names(fields) <> ")"
  def describe({:list, items}), do: "список из " <> Integer.to_string(length(items))
  def describe({:rec, fields}), do: "запись {" <> field_names(fields) <> "}"
  def describe(:nothing), do: "ничто"
  def describe({:flag, true}), do: "да"
  def describe({:flag, false}), do: "нет"
  def describe({:num, value}), do: number_text(value)

  defp field_names(fields), do: Enum.map_join(fields, ", ", fn {name, _} -> name end)

  @doc "Поле по имени: `{:ok, значение}` либо `:error`."
  def lookup([], _name), do: :error
  def lookup([{name, value} | _], name), do: {:ok, value}
  def lookup([_ | rest], name), do: lookup(rest, name)

  # ───────────────────────────── равенство ─────────────────────────────

  @doc """
  Object.is для чисел: NaN равен NaN, 0 не равен −0 (SPEC, раздел 5).

  Родное `===` в OTP 27 и новее знак нуля уже различает, но `:nan` — атом, и
  атом, равный сам себе, здесь как раз то, что нужно. Отдельно разбирается лишь
  случай двух нулей: `0.0 === -0.0` даёт `false` не на всех версиях OTP, а бит
  знака даёт ответ всегда и одинаково.
  """
  def same_number(:nan, :nan), do: true
  def same_number(:nan, _), do: false
  def same_number(_, :nan), do: false
  def same_number(a, b) when is_float(a) and is_float(b) do
    if a == 0.0 and b == 0.0, do: sign_bit(a) == sign_bit(b), else: a == b
  end

  def same_number(a, b), do: a === b

  @doc "Бит знака числа: 1 у отрицательных и у −0.0, иначе 0."
  def sign_bit(value) when is_float(value) do
    <<bit::1, _::63>> = <<value::float>>
    bit
  end

  @doc """
  Равенство значений: скаляры как Object.is, составные структурно.

  Рекурсия здесь по данным, а не по программе: её глубина ограничена
  вложенностью значения, а не длиной вычисления.
  """
  def equal({:num, a}, {:num, b}), do: same_number(a, b)
  def equal({:flag, a}, {:flag, b}), do: a === b
  def equal({:str, a}, {:str, b}), do: a === b
  def equal(:nothing, :nothing), do: true
  def equal({:list, a}, {:list, b}) do
    length(a) == length(b) and Enum.all?(Enum.zip(a, b), fn {x, y} -> equal(x, y) end)
  end

  def equal({:var, name, a}, {:var, name, b}), do: fields_equal(a, b)
  def equal({:rec, a}, {:rec, b}), do: fields_equal(a, b)
  def equal(_, _), do: false

  @doc "Равенство записей: по именам полей, а не по их порядку."
  def fields_equal(left, right) do
    length(left) == length(right) and
      Enum.all?(left, fn {name, value} ->
        case lookup(right, name) do
          {:ok, other} -> equal(value, other)
          :error -> false
        end
      end)
  end

  # ───────────────────────────── арифметика ─────────────────────────────
  #
  # Каждая операция разбирает особые случаи IEEE-754 явно, потому что BEAM их
  # не представляет вовсе (см. раздел 1 в @moduledoc). Клаузы идут в порядке
  # «сначала NaN, потом бесконечности, потом обычные числа»: перестановка
  # изменила бы результат, а не только скорость.

  @doc "Отрицание числа. Через умножение, чтобы −0.0 получался, а не терялся."
  def negate(:nan), do: :nan
  def negate(:inf), do: :ninf
  def negate(:ninf), do: :inf
  def negate(value), do: value * -1.0

  @doc "Знак числа: 1 либо −1; у нуля — по биту знака, как в IEEE-754."
  def signum(:inf), do: 1
  def signum(:ninf), do: -1
  def signum(value) when is_float(value), do: if(sign_bit(value) == 1, do: -1, else: 1)

  defp infinity(1), do: :inf
  defp infinity(-1), do: :ninf

  defp zero?(value) when is_float(value), do: value == 0.0
  defp zero?(_), do: false

  @doc "Сложение по правилам IEEE-754."
  def num_add(:nan, _), do: :nan
  def num_add(_, :nan), do: :nan
  def num_add(:inf, :ninf), do: :nan
  def num_add(:ninf, :inf), do: :nan
  def num_add(:inf, _), do: :inf
  def num_add(_, :inf), do: :inf
  def num_add(:ninf, _), do: :ninf
  def num_add(_, :ninf), do: :ninf

  def num_add(a, b) do
    a + b
  rescue
    ArithmeticError -> infinity(signum(a))
  end

  @doc "Вычитание: сложение с отрицанием, как в IEEE-754."
  def num_sub(a, b), do: num_add(a, negate(b))

  @doc "Умножение по правилам IEEE-754: бесконечность на ноль даёт NaN."
  def num_mul(:nan, _), do: :nan
  def num_mul(_, :nan), do: :nan

  def num_mul(a, b) when a == :inf or a == :ninf do
    if zero?(b), do: :nan, else: infinity(signum(a) * signum(b))
  end

  def num_mul(a, b) when b == :inf or b == :ninf do
    if zero?(a), do: :nan, else: infinity(signum(a) * signum(b))
  end

  def num_mul(a, b) do
    a * b
  rescue
    ArithmeticError -> infinity(signum(a) * signum(b))
  end

  @doc """
  Деление по правилам IEEE-754.

  Здесь и живёт то самое требование SPEC (раздел 5): деление на ноль — это
  значение, а не ошибка. BEAM на `1.0 / 0.0` возбуждает `ArithmeticError`,
  поэтому нулевой делитель разбирается до самого деления, а не после.
  """
  def num_div(:nan, _), do: :nan
  def num_div(_, :nan), do: :nan
  def num_div(a, b) when (a == :inf or a == :ninf) and (b == :inf or b == :ninf), do: :nan
  def num_div(a, b) when a == :inf or a == :ninf, do: infinity(signum(a) * signum(b))

  # Конечное на бесконечность — ноль, но ЗНАКОВЫЙ: 1 / -Infinity это −0, а не 0.
  # Разница не косметическая: Object.is различает нули (SPEC, раздел 5), и
  # «0 равно −0» обязано быть ложью в обоих движках. Дифференциальная сверка с
  # интерпретатором нашла здесь ровно эту ошибку.
  def num_div(a, b) when b == :inf or b == :ninf do
    if signum(a) * signum(b) < 0, do: -0.0, else: 0.0
  end

  def num_div(a, b) do
    if b == 0.0 do
      if a == 0.0, do: :nan, else: infinity(signum(a) * signum(b))
    else
      try do
        a / b
      rescue
        ArithmeticError -> infinity(signum(a) * signum(b))
      end
    end
  end

  @doc """
  Остаток по правилам оператора `%` из ECMAScript.

  Родной `rem/2` не годится: он только для целых. `:math.fmod/2` — это ровно
  оператор ECMAScript (знак от делимого), но на нулевом делителе он возбуждает
  ошибку там, где нужен NaN.
  """
  def num_rem(:nan, _), do: :nan
  def num_rem(_, :nan), do: :nan
  def num_rem(a, _) when a == :inf or a == :ninf, do: :nan
  def num_rem(a, b) when b == :inf or b == :ninf, do: a

  def num_rem(a, b) do
    if b == 0.0, do: :nan, else: :math.fmod(a, b)
  end

  @doc """
  Порядок: `:lt`, `:eq`, `:gt` либо `:un` (несравнимо — хотя бы один NaN).

  Термовое сравнение BEAM здесь не годится: оно ставит любое число раньше
  любого атома, то есть объявило бы `:inf` больше всего на свете, а `:nan` —
  сравнимым.
  """
  def num_order(:nan, _), do: :un
  def num_order(_, :nan), do: :un
  def num_order(a, a), do: :eq
  def num_order(:inf, _), do: :gt
  def num_order(_, :inf), do: :lt
  def num_order(:ninf, _), do: :lt
  def num_order(_, :ninf), do: :gt

  def num_order(a, b) do
    cond do
      a == b -> :eq
      a < b -> :lt
      true -> :gt
    end
  end

  # ───────────────────────────── число в текст ─────────────────────────────

  @doc """
  Печатает число ровно по правилам ECMAScript Number::toString.

  Это не украшение: «к строке» от числа и тексты диагностик содержат числа, и
  расхождение хотя бы в одном знаке — расхождение наблюдаемого поведения с
  интерпретатором. Ни `Float.to_string/1`, ни `inspect/1` не годятся: они дают
  «1.0» там, где нужно «1», и «1.0e21» там, где нужно «1e+21», а пороги
  перехода к экспоненте у них свои.

  Кратчайшая запись берётся у `:erlang.float_to_binary(value, [:short])` — она
  по построению наименьшая из читающихся обратно тем же float, то есть ровно то
  «s», о котором говорит спецификация ECMAScript.
  """
  def number_text(:nan), do: "NaN"
  def number_text(:inf), do: "Infinity"
  def number_text(:ninf), do: "-Infinity"

  def number_text(value) when is_float(value) do
    if value == 0.0 do
      # Number::toString(−0) это «0»: знак нуля не печатается, хотя Object.is
      # его различает.
      "0"
    else
      sign = if value < 0.0, do: "-", else: ""
      {digits, point} = shortest_digits(abs(value))
      sign <> layout(digits, point)
    end
  end

  # Кратчайшая запись float как {значащие цифры, позиция точки}: значение равно
  # 0.цифры × 10^точка.
  defp shortest_digits(value) do
    text = :erlang.float_to_binary(value, [:short])
    {mantissa, exponent} =
      case String.split(text, "e") do
        [body] -> {body, 0}
        [body, power] -> {body, String.to_integer(power)}
      end

    {whole, fraction} =
      case String.split(mantissa, ".") do
        [only] -> {only, ""}
        [before, after_point] -> {before, after_point}
      end

    all = whole <> fraction
    point = String.length(whole) + exponent
    strip_zeros(all, point)
  end

  defp strip_zeros(digits, point) do
    {trimmed, shift} = drop_leading(digits, 0)
    {String.trim_trailing(trimmed, "0"), point - shift}
  end

  defp drop_leading("0" <> rest, seen) when rest != "", do: drop_leading(rest, seen + 1)
  defp drop_leading(digits, seen), do: {digits, seen}

  # Раскладка по правилам ECMAScript Number::toString: пороги перехода к
  # экспоненте — n больше 21 и n не больше −6.
  defp layout(digits, point) do
    k = String.length(digits)

    cond do
      k <= point and point <= 21 ->
        digits <> String.duplicate("0", point - k)

      point > 0 and point <= 21 ->
        String.slice(digits, 0, point) <> "." <> String.slice(digits, point, k - point)

      point > -6 and point <= 0 ->
        "0." <> String.duplicate("0", -point) <> digits

      true ->
        power = point - 1
        mark = if power < 0, do: "-", else: "+"
        tail = "e" <> mark <> Integer.to_string(abs(power))
        if k == 1, do: digits <> tail, else: String.slice(digits, 0, 1) <> "." <> String.slice(digits, 1, k - 1) <> tail
    end
  end

  @doc """
  Строка в кавычках по правилам JSON.stringify.

  Ею пользуется describeValue интерпретатора, и тексты диагностик обязаны
  совпасть: кириллица не экранируется, управляющие символы — четырьмя
  шестнадцатеричными цифрами в нижнем регистре.
  """
  def quote_json(value) do
    escaped =
      value
      |> String.to_charlist()
      |> Enum.map_join("", &escape_char/1)

    "\"" <> escaped <> "\""
  end

  defp escape_char(?"), do: "\\\""
  defp escape_char(?\\), do: "\\\\"
  defp escape_char(?\n), do: "\\n"
  defp escape_char(?\r), do: "\\r"
  defp escape_char(?\t), do: "\\t"
  defp escape_char(?\b), do: "\\b"
  defp escape_char(?\f), do: "\\f"

  defp escape_char(code) when code < 0x20 do
    "\\u" <> String.pad_leading(Integer.to_string(code, 16), 4, "0") |> String.downcase()
  end

  defp escape_char(code), do: <<code::utf8>>

  # ───────────────────────────── контекст вычисления ─────────────────────────
  #
  # Счётчики живут в словаре процесса — единственном изменяемом состоянии,
  # локальном процессу (см. раздел 4 в @moduledoc). Ни Agent, ни ETS: и то, и
  # другое пережило бы вычисление и потребовало бы уборки, а счётчик обязан
  # обнуляться на каждом запросе.

  @default_max_depth 10_000
  @default_max_steps 1_000_000
  @default_index_base 1

  def default_max_depth, do: @default_max_depth
  def default_max_steps, do: @default_max_steps

  @doc "Готовит контекст вычисления: обнуляет счётчики и ставит пределы."
  def new_context(index_base \\ @default_index_base, max_depth \\ @default_max_depth, max_steps \\ @default_max_steps) do
    Process.put(:flang_index_base, index_base)
    Process.put(:flang_max_depth, max_depth)
    Process.put(:flang_max_steps, max_steps)
    Process.put(:flang_depth, 0)
    Process.put(:flang_steps, 0)
    :ok
  end

  @doc "Меняет предел глубины, не трогая остальное."
  def set_max_depth(value), do: Process.put(:flang_max_depth, value)

  @doc "Меняет предел шагов, не трогая остальное."
  def set_max_steps(value), do: Process.put(:flang_max_steps, value)

  @doc "База индексации строк: 1 (SPEC, раздел 5) либо 0, если так напечатали."
  def index_base, do: Process.get(:flang_index_base, @default_index_base)

  @doc """
  Вход в функцию, способную к рекурсии.

  На BEAM это важнее, чем где бы то ни было: стека фиксированного размера у
  процесса нет, он растёт в куче, и незавершающаяся нехвостовая рекурсия не
  падает по стеку, а съедает память узла целиком. Счётчик глубины — всё, что
  стоит между программой и этим исходом.
  """
  def enter(function) do
    step(function)
    depth = Process.get(:flang_depth, 0)
    limit = Process.get(:flang_max_depth, @default_max_depth)

    if limit > 0 and depth + 1 > limit do
      raise fail(
              @code_recursion_limit,
              "функция «" <>
                function <>
                "» превысила предел глубины вызовов (" <>
                Integer.to_string(limit) <> ") на глубине " <> Integer.to_string(depth + 1)
            )
    end

    Process.put(:flang_depth, depth + 1)
    :ok
  end

  @doc """
  Выход из функции.

  Вызывается и на ошибке (через `after`): счётчик глубины обязан вернуться
  назад, иначе первая же пойманная ошибка навсегда съела бы предел.
  """
  def leave do
    Process.put(:flang_depth, Process.get(:flang_depth, 0) - 1)
    :ok
  end

  @doc """
  Виток вычисления: вход в функцию и хвостовой вызов внутри компоненты.

  Считается отдельно от глубины: хвостовая рекурсия на BEAM глубину не растит
  вовсе, но завершаться от этого не начинает — а без счётчика шагов
  незавершающаяся хвостовая функция крутилась бы вечно.

  Шаг интерпретатора — итерация его машины, а не вызов функции, и их на одно
  применение функции приходится много. Значит счётчик здесь всегда МЕНЬШЕ, и
  при одинаковом пределе интерпретатор упирается в лимит первым. Расхождение
  одностороннее и безопасное.
  """
  def step(function) do
    steps = Process.get(:flang_steps, 0) + 1
    limit = Process.get(:flang_max_steps, @default_max_steps)
    Process.put(:flang_steps, steps)

    if limit > 0 and steps > limit do
      raise fail(
              @code_recursion_limit,
              "функция «" <>
                function <>
                "» исчерпала лимит шагов (" <>
                Integer.to_string(limit) <>
                ") на глубине вызовов " <> Integer.to_string(Process.get(:flang_depth, 0))
            )
    end

    :ok
  end

  # ───────────────────────────── операции языка ─────────────────────────────

  @doc "Доступ к полю записи."
  def field_get({:var, name, _}, field) do
    raise fail(@code_type, "поле «" <> field <> "» нельзя взять у варианта «" <> name <> "» — нужен разбор")
  end

  def field_get({:rec, fields}, field) do
    case lookup(fields, field) do
      {:ok, value} -> value
      :error -> raise fail(@code_unknown_name, "запись не содержит поле «" <> field <> "»")
    end
  end

  def field_get(value, field) do
    raise fail(@code_type, "поле «" <> field <> "» можно взять только у записи, получено " <> type_name(value))
  end

  @doc """
  Поле варианта при сопоставлении с образцом.

  Отсутствующее поле — ошибка прямо здесь, а не «случай не подошёл»: так же
  ведёт себя matchPattern интерпретатора.
  """
  def variant_field({:var, name, fields}, field) do
    case lookup(fields, field) do
      {:ok, value} -> value
      :error -> raise fail(@code_unknown_name, "вариант «" <> name <> "» не содержит поле «" <> field <> "»")
    end
  end

  @doc "Условие «если»: обязано быть признаком."
  def cond_flag({:flag, value}), do: value

  def cond_flag(value) do
    raise fail(@code_type, "условие «если» должно быть признаком, получено " <> type_name(value))
  end

  @doc "Условие «отфильтровать»: обязано быть признаком."
  def keep({:flag, value}), do: value

  def keep(value) do
    raise fail(@code_type, "условие «отфильтровать» должно быть признаком, получено " <> type_name(value))
  end

  @doc "Значение постусловия: обязано быть признаком."
  def post({:flag, value}, _property, _function), do: value

  def post(value, property, function) do
    raise fail(
            @code_type,
            "постусловие «" <>
              property <>
              "» функции «" <> function <> "» должно давать признак, получено " <> type_name(value)
          )
  end

  @doc "Разбор не покрыл значение."
  def match_fail(value), do: fail(@code_match, "разбор не покрывает значение " <> describe(value))

  @doc "«свёртка», «отобразить» и «отфильтровать» работают только со списком."
  def require_list({:list, items}, _label), do: items

  def require_list(value, label) do
    raise fail(@code_type, "«" <> label <> "» работает только со списком, получено " <> type_name(value))
  end

  # ───────────────────────── арифметика как операции языка ──────────────────

  defp arithmetic(op, {:num, a}, {:num, b}), do: {a, b, op}

  defp arithmetic(op, left, right) do
    raise fail(
            @code_type,
            "операция «" <>
              op <> "» допустима только для чисел, получено " <> type_name(left) <> " и " <> type_name(right)
          )
  end

  defp ordered({:num, a}, {:num, b}), do: {a, b}

  defp ordered(_, _) do
    # Сообщение дословно как в ядре FTS (src/utility.ts, compare).
    raise fail(@code_type, "сравнения порядка допустимы только для чисел")
  end

  @doc "«плюс»."
  def add(left, right) do
    {a, b, _} = arithmetic("add", left, right)
    {:num, num_add(a, b)}
  end

  @doc "«минус»."
  def sub(left, right) do
    {a, b, _} = arithmetic("sub", left, right)
    {:num, num_sub(a, b)}
  end

  @doc "«умножить на»."
  def mul(left, right) do
    {a, b, _} = arithmetic("mul", left, right)
    {:num, num_mul(a, b)}
  end

  @doc "«делить на»."
  def divide(left, right) do
    {a, b, _} = arithmetic("div", left, right)
    {:num, num_div(a, b)}
  end

  @doc "«остаток от» как двуместная операция."
  def mod(left, right) do
    {a, b, _} = arithmetic("mod", left, right)
    {:num, num_rem(a, b)}
  end

  @doc """
  «процентов от». Порядок операций ядра: (процент / 100) * значение.

  Переписать в значение * процент / 100 нельзя — меняется последний бит
  мантиссы.
  """
  def percent(left, right) do
    {a, b, _} = arithmetic("percent", left, right)
    {:num, num_mul(num_div(a, 100.0), b)}
  end

  @doc "«больше»."
  def gt(left, right) do
    {a, b} = ordered(left, right)
    {:flag, num_order(a, b) == :gt}
  end

  @doc "«меньше»."
  def lt(left, right) do
    {a, b} = ordered(left, right)
    {:flag, num_order(a, b) == :lt}
  end

  @doc "«не меньше»."
  def gte(left, right) do
    {a, b} = ordered(left, right)
    {:flag, num_order(a, b) in [:gt, :eq]}
  end

  @doc "«не больше»."
  def lte(left, right) do
    {a, b} = ordered(left, right)
    {:flag, num_order(a, b) in [:lt, :eq]}
  end

  @doc "«соединить» как двуместная операция над строками."
  def concat({:str, a}, {:str, b}), do: {:str, a <> b}

  def concat(left, right) do
    raise fail(
            @code_type,
            "«соединить» допустимо только для строк, получено " <> type_name(left) <> " и " <> type_name(right)
          )
  end

  @doc "Равенство значений как выражение языка."
  def eq(left, right), do: {:flag, equal(left, right)}

  @doc "Неравенство значений как выражение языка."
  def neq(left, right), do: {:flag, not equal(left, right)}

  # ───────────────────────── проверки аргументов ─────────────────────────

  defp expect_string(_name, {:str, value}, _role), do: value

  defp expect_string(name, value, role) do
    raise fail(
            @code_builtin_args,
            "«" <> name <> "»: " <> role <> " должна быть строкой, получено " <> type_name(value)
          )
  end

  defp expect_number(_name, {:num, value}, _role), do: value

  defp expect_number(name, value, role) do
    raise fail(
            @code_builtin_args,
            "«" <> name <> "»: " <> role <> " должно быть числом, получено " <> type_name(value)
          )
  end

  defp expect_integer(name, value, role) do
    result = expect_number(name, value, role)

    # Number.isInteger: ни NaN, ни бесконечность целыми не считаются.
    if is_float(result) and result == trunc(result) do
      result
    else
      raise fail(
              @code_builtin_args,
              "«" <> name <> "»: " <> role <> " должно быть целым числом, получено " <> number_text(result)
            )
    end
  end

  defp expect_list(_name, {:list, items}, _role), do: items

  defp expect_list(name, value, role) do
    raise fail(
            @code_builtin_args,
            "«" <> name <> "»: " <> role <> " должен быть списком, получено " <> type_name(value)
          )
  end

  # ───────────────────────── строки в кодовых точках ─────────────────────────
  #
  # String.length/1 считает ГРАФЕМЫ, а SPEC (раздел 5) требует кодовые точки:
  # «е» с комбинирующим ударением там одна единица, а кодовых точек две.
  # String.to_charlist/1 даёт ровно кодовые точки.

  defp code_points(value), do: String.to_charlist(value)

  # ───────────────────────── встроенные формы ─────────────────────────

  @doc "«длина»: строка в кодовых точках, список в элементах."
  def b_length({:str, value}), do: {:num, length(code_points(value)) * 1.0}
  def b_length({:list, items}), do: {:num, length(items) * 1.0}

  def b_length(value) do
    raise fail(@code_builtin_args, "«длина»: ожидается строка или список, получено " <> type_name(value))
  end

  @doc """
  «символы»: разложение строки в список односимвольных строк.

  `String.codepoints/1`, а не `String.graphemes/1`: графема склеивает базовый
  символ с комбинирующими знаками в один элемент, и «е» с ударением стало бы
  одним значением вместо двух. Эталон делит по кодовым точкам (`Array.from`),
  значит и здесь кодовые точки — иначе цель разошлась бы с интерпретатором на
  первом же тексте с диакритикой.
  """
  def b_characters(source) do
    value = expect_string("символы", source, "строка")
    {:list, Enum.map(String.codepoints(value), fn point -> {:str, point} end)}
  end

  @doc """
  «код символа»: кодовая точка первого символа строки.

  `String.to_charlist/1` даёт список кодовых точек, а не байт и не графем: то
  же деление, что у `b_characters/1`. `binary_part/3` отдал бы первый байт
  UTF-8, и цель разошлась бы с эталоном на всём, что вне ASCII.
  """
  def b_char_code(source) do
    value = expect_string("код символа", source, "строка")

    case String.to_charlist(value) do
      [point | _] -> {:num, point * 1.0}
      [] -> raise fail(@code_builtin_args, "«код символа»: строка пуста")
    end
  end

  @doc "«символ … в …». Индексация с 1 и включительно (SPEC, раздел 5)."
  def b_char(index, source) do
    position = expect_integer("символ", index, "индекс")
    value = expect_string("символ", source, "строка")
    points = code_points(value)
    size = length(points)
    at = position - index_base()

    if at < 0.0 or at >= size do
      raise fail(
              @code_builtin_args,
              "«символ»: индекс " <> number_text(position) <> " вне строки длиной " <> Integer.to_string(size)
            )
    end

    {:str, List.to_string([Enum.at(points, trunc(at))])}
  end

  @doc "«подстрока … с … по …»: оба конца включительно при базе 1."
  def b_substring(source, from_value, to_value) do
    value = expect_string("подстрока", source, "строка")
    start = expect_integer("подстрока", from_value, "начало")
    finish = expect_integer("подстрока", to_value, "конец")
    points = code_points(value)
    size = length(points)
    begin = start - index_base()

    if begin < 0.0 or begin > size do
      raise fail(
              @code_builtin_args,
              "«подстрока»: начало " <> number_text(start) <> " вне строки длиной " <> Integer.to_string(size)
            )
    end

    if finish < begin or finish > size do
      raise fail(
              @code_builtin_args,
              "«подстрока»: конец " <>
                number_text(finish) <>
                " вне диапазона [" <> number_text(start) <> ", " <> Integer.to_string(size) <> "]"
            )
    end

    from = trunc(begin)
    {:str, List.to_string(Enum.slice(points, from, trunc(finish) - from))}
  end

  @doc """
  «соединить». Две формы: строка со строкой и список с разделителем.

  Различаются по типу первого аргумента, как в builtins.mjs.
  """
  def b_join({:list, items}, right) do
    separator = expect_string("соединить", right, "разделитель")
    {:str, join_parts(items, separator, 1, "")}
  end

  def b_join(left, right) do
    first = expect_string("соединить", left, "первая строка")
    second = expect_string("соединить", right, "вторая строка")
    {:str, first <> second}
  end

  defp join_parts([], _separator, _index, acc), do: acc

  defp join_parts([{:str, value} | rest], separator, index, acc) do
    joined = if index == 1, do: value, else: acc <> separator <> value
    join_parts(rest, separator, index + 1, joined)
  end

  defp join_parts([other | _], _separator, index, _acc) do
    raise fail(
            @code_builtin_args,
            "«соединить»: элемент " <>
              Integer.to_string(index) <> " списка должен быть строкой, получено " <> type_name(other)
          )
  end

  @doc "«разделить … по …»."
  def b_split(source, separator) do
    value = expect_string("разделить", source, "строка")
    mark = expect_string("разделить", separator, "разделитель")

    if mark == "" do
      raise fail(@code_builtin_args, "«разделить»: разделитель не может быть пустым")
    end

    {:list, Enum.map(String.split(value, mark), fn part -> {:str, part} end)}
  end

  @doc "«содержит»: подстрока в строке либо значение в списке."
  def b_contains({:list, items}, right), do: {:flag, Enum.any?(items, fn item -> equal(item, right) end)}

  def b_contains(left, right) do
    value = expect_string("содержит", left, "строка или список")
    part = expect_string("содержит", right, "искомая подстрока")
    {:flag, String.contains?(value, part)}
  end

  @doc "«начинается с»."
  def b_starts_with(source, prefix) do
    value = expect_string("начинается с", source, "строка")
    start = expect_string("начинается с", prefix, "префикс")
    {:flag, String.starts_with?(value, start)}
  end

  # Пробел по правилам ECMAScript String.prototype.trim.
  #
  # String.trim/1 не годится: он режет по свойству Unicode «Whitespace», где
  # есть U+0085 (NEL), которого в наборе ECMAScript нет, и нет U+FEFF, который
  # там есть. Разошлись бы ровно на тех входах, ради которых «к числу» и
  # проверяется.
  @js_space [
              0x0009,
              0x000A,
              0x000B,
              0x000C,
              0x000D,
              0x0020,
              0x00A0,
              0x1680,
              0x2028,
              0x2029,
              0x202F,
              0x205F,
              0x3000,
              0xFEFF
            ] ++ Enum.to_list(0x2000..0x200A)

  defp trim_js(value) do
    value
    |> code_points()
    |> Enum.drop_while(fn code -> code in @js_space end)
    |> Enum.reverse()
    |> Enum.drop_while(fn code -> code in @js_space end)
    |> Enum.reverse()
    |> List.to_string()
  end

  # Строгий разбор «к числу»: без Infinity, NaN, шестнадцатеричных и пустой
  # строки, иначе форма молча превращает мусор в значение. Цифры перечислены
  # явно диапазоном ASCII: \d в регулярном выражении builtins.mjs стоит под
  # флагом «u», где это только ASCII.
  defp looks_like_number?(value) do
    codes = code_points(value)
    {codes, _} = take_sign(codes)
    {codes, before} = take_digits(codes, 0)
    {codes, ok_fraction, after_point} = take_fraction(codes)

    cond do
      not ok_fraction -> false
      before == 0 and after_point == 0 -> false
      true -> take_exponent(codes)
    end
  end

  defp take_sign([code | rest]) when code == ?+ or code == ?-, do: {rest, true}
  defp take_sign(codes), do: {codes, false}

  defp take_digits([code | rest], seen) when code >= ?0 and code <= ?9, do: take_digits(rest, seen + 1)
  defp take_digits(codes, seen), do: {codes, seen}

  defp take_fraction([?. | rest]) do
    {codes, seen} = take_digits(rest, 0)
    # «1.» и «.» недопустимы: после точки обязана быть хотя бы одна цифра, а
    # «.5» допустимо именно потому, что цифры есть после точки.
    {codes, seen > 0, seen}
  end

  defp take_fraction(codes), do: {codes, true, 0}

  defp take_exponent([code | rest]) when code == ?e or code == ?E do
    {rest, _} = take_sign(rest)
    {codes, seen} = take_digits(rest, 0)
    seen > 0 and codes == []
  end

  defp take_exponent(codes), do: codes == []

  @doc "«к числу»."
  def b_to_number(source) do
    value = expect_string("к числу", source, "строка")
    trimmed = trim_js(value)

    if not looks_like_number?(trimmed) do
      raise fail(@code_builtin_args, "«к числу»: строка " <> quote_json(value) <> " не является числом")
    end

    # Float.parse не принимает ни ведущий «+», ни запись вида «.5», а на «1e999»
    # отвечает :error вместо бесконечности. Первые два случая — вопрос записи и
    # правятся здесь; третий и есть «не конечное число».
    case Float.parse(normalize_number(trimmed)) do
      {result, ""} ->
        {:num, result}

      _ ->
        raise fail(@code_builtin_args, "«к числу»: строка " <> quote_json(value) <> " не является конечным числом")
    end
  end

  defp normalize_number("+" <> rest), do: normalize_number(rest)
  defp normalize_number("-" <> rest), do: "-" <> normalize_number(rest)
  defp normalize_number("." <> rest), do: "0." <> rest
  defp normalize_number(value), do: value

  @doc """
  «к числу или беда»: отказ, ставший значением.

  Обоснование формы — в builtins.mjs, раздел «отказ, ставший значением». Разбор
  не повторяется, а переиспользуется: тексты обязаны совпасть с интерпретатором,
  и единственный способ гарантировать это — один разбор на обе формы. Отказать
  эта форма не может вовсе.
  """
  def b_to_number_or_failure(source) do
    try do
      {:var, "Разобрано", [{"значение", b_to_number(source)}]}
    rescue
      failure in Flang.Error ->
        {:var, "Не разобрано",
         [{"код", {:str, failure.code}}, {"сообщение", {:str, failure.message}}]}
    end
  end

  @doc """
  «к строке».

  Признак печатается по-русски («да»/«нет»), «ничто» — словом «ничто»:
  поверхность языка русская, и кодогенераторы обязаны это повторять, а не
  печатать true/false (SPEC, раздел 5).
  """
  def b_to_string({:str, _} = value), do: value
  def b_to_string({:num, value}), do: {:str, number_text(value)}
  def b_to_string({:flag, true}), do: {:str, "да"}
  def b_to_string({:flag, false}), do: {:str, "нет"}
  def b_to_string(:nothing), do: {:str, "ничто"}

  def b_to_string(value) do
    raise fail(@code_builtin_args, "«к строке»: ожидается скаляр, получено " <> type_name(value))
  end

  @doc "«пусто»."
  def b_empty({:list, items}), do: {:flag, items == []}
  def b_empty({:str, value}), do: {:flag, value == ""}

  def b_empty(value) do
    raise fail(@code_builtin_args, "«пусто»: ожидается строка или список, получено " <> type_name(value))
  end

  @doc "«голова»."
  def b_head(value) do
    case expect_list("голова", value, "аргумент") do
      [] -> raise fail(@code_builtin_args, "«голова»: список пуст")
      [first | _] -> first
    end
  end

  @doc """
  «хвост».

  Единственная встроенная форма, которая на BEAM дешевле, чем во всех остальных
  целях: список Elixir — односвязный, и его хвост это тот же список без первой
  ячейки, без единого копирования. У интерпретатора (массив JS) и у бэкендов C,
  Go, Rust, Java и C# «хвост» копирует, и рекурсия «голова и хвост» по длинному
  списку выходит квадратичной. Наблюдаемое значение при этом то же самое —
  расходится только сложность, и расходится в лучшую сторону.
  """
  def b_tail(value) do
    case expect_list("хвост", value, "аргумент") do
      [] -> raise fail(@code_builtin_args, "«хвост»: список пуст")
      [_ | rest] -> {:list, rest}
    end
  end

  @doc """
  «элемент N в СПИСОК».

  ЕДИНСТВЕННАЯ ЦЕЛЬ ИЗ ВОСЬМИ, ГДЕ ЭТА ФОРМА НЕ ПОСТОЯННОГО ВРЕМЕНИ, И ЭТО
  СКАЗАНО ВСЛУХ. Список Elixir односвязный: `Enum.at/2` идёт к N-му элементу
  за N переходов. В семи остальных целях список — массив (C, Go, Rust, Python,
  Java, C#, JS), и там N-й стоит того же, что первый.

  Обменять это на массив нельзя, не проиграв больше, чем выиграв: `хвост` на
  BEAM сегодня бесплатен (тот же список без первой ячейки), а на кортеже или
  `:array` стал бы копией. То есть выбор здесь не между «быстро» и «медленно»,
  а между «взятие по номеру дёшево, отрезание хвоста дорого» и наоборот — и
  вторая половина уже написана и уже проверена. Значение при этом то же самое:
  расходится только стоимость, и она измерена — SPEC, раздел «Стоимость
  встроенных форм».
  """
  def b_element(index, value) do
    position = expect_integer("элемент", index, "индекс")
    items = expect_list("элемент", value, "список")
    size = length(items)
    at = position - index_base()

    if at < 0.0 or at >= size do
      raise fail(
              @code_builtin_args,
              "«элемент»: индекс " <> number_text(position) <> " вне списка длиной " <> Integer.to_string(size)
            )
    end

    Enum.at(items, trunc(at))
  end

  @doc """
  «добавить … к …»: дописывает в конец, исходный список не меняется.

  Список Elixir односвязный и растёт с ГОЛОВЫ, поэтому `++ [элемент]` копирует
  весь список: наращивание в цикле квадратично по времени — ровно как у
  интерпретатора, где «добавить» это тоже `[...список, элемент]`. Совпасть со
  сложностью интерпретатора здесь важнее, чем обогнать его.

  По ПАМЯТИ, в отличие от бэкенда C, стены нет: там арена не отдаёт
  промежуточные копии до конца запроса, и список из n элементов оставляет
  порядка n² байт. Здесь промежуточная копия становится мусором сразу и
  собирается сборщиком процесса, поэтому живой памяти всё время O(n).
  """
  def b_append(item, value) do
    items = expect_list("добавить", value, "второй аргумент")
    {:list, items ++ [item]}
  end

  @doc "«остаток от»."
  def b_remainder(left, right) do
    a = expect_number("остаток от", left, "делимое")
    b = expect_number("остаток от", right, "делитель")
    {:num, num_rem(a, b)}
  end

  @doc "«процентов от»: (процент / 100) * значение, порядок ядра."
  def b_percent_of(left, right) do
    a = expect_number("процентов от", left, "процент")
    b = expect_number("процентов от", right, "значение")
    {:num, num_mul(num_div(a, 100.0), b)}
  end
end
