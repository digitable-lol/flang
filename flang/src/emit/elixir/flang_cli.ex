defmodule Flang.Json do
  @moduledoc """
  Разбор и печать минимального подмножества JSON.

  Своё, а не библиотека: напечатанная программа обязана собираться одним
  `elixirc` без mix.exs и без единой зависимости. В Elixir 1.18 и новее в
  стандартной библиотеке появился модуль `JSON`, но опираться на него значило бы
  требовать свежую версию от того, кто просто хочет запустить напечатанный код.
  Нужное подмножество мало: строки, числа (которые в протоколе всё равно едут
  строками), списки, объекты, три литерала.

  Узлы представлены типами Elixir: `binary()`, `true`/`false`, `nil`,
  `[node]` и `{:object, [{binary(), node}]}`. Объект — список пар, а не
  `Map`: порядок ключей наблюдаем в полях записи, а `Map` его не хранит.
  """

  @doc "Значение JSON из строки. Возвращает `{:ok, узел}` либо `:error`."
  def parse(source) do
    case value(skip_spaces(source)) do
      {node, rest} ->
        if skip_spaces(rest) == "", do: {:ok, node}, else: :error

      :error ->
        :error
    end
  catch
    :bad_json -> :error
  end

  defp skip_spaces(<<symbol, rest::binary>>) when symbol in [?\s, ?\t, ?\n, ?\r], do: skip_spaces(rest)
  defp skip_spaces(source), do: source

  defp value(<<"{", rest::binary>>), do: object(skip_spaces(rest), [])
  defp value(<<"[", rest::binary>>), do: array(skip_spaces(rest), [])
  defp value(<<"\"", rest::binary>>), do: string(rest, [])
  defp value(<<"true", rest::binary>>), do: {true, rest}
  defp value(<<"false", rest::binary>>), do: {false, rest}
  defp value(<<"null", rest::binary>>), do: {nil, rest}
  defp value(source), do: number(source, [])

  defp object(<<"}", rest::binary>>, acc), do: {{:object, Enum.reverse(acc)}, rest}

  defp object(<<"\"", rest::binary>>, acc) do
    {key, rest} = string(rest, [])

    case skip_spaces(rest) do
      <<":", rest::binary>> ->
        {item, rest} = value(skip_spaces(rest))

        case skip_spaces(rest) do
          <<",", rest::binary>> -> object(skip_spaces(rest), [{key, item} | acc])
          <<"}", rest::binary>> -> {{:object, Enum.reverse([{key, item} | acc])}, rest}
          _ -> throw(:bad_json)
        end

      _ ->
        throw(:bad_json)
    end
  end

  defp object(_, _), do: throw(:bad_json)

  defp array(<<"]", rest::binary>>, acc), do: {Enum.reverse(acc), rest}

  defp array(source, acc) do
    {item, rest} = value(source)

    case skip_spaces(rest) do
      <<",", rest::binary>> -> array(skip_spaces(rest), [item | acc])
      <<"]", rest::binary>> -> {Enum.reverse([item | acc]), rest}
      _ -> throw(:bad_json)
    end
  end

  defp string(<<"\"", rest::binary>>, acc), do: {List.to_string(Enum.reverse(acc)), rest}
  defp string(<<"\\\"", rest::binary>>, acc), do: string(rest, [?" | acc])
  defp string(<<"\\\\", rest::binary>>, acc), do: string(rest, [?\\ | acc])
  defp string(<<"\\/", rest::binary>>, acc), do: string(rest, [?/ | acc])
  defp string(<<"\\b", rest::binary>>, acc), do: string(rest, [?\b | acc])
  defp string(<<"\\f", rest::binary>>, acc), do: string(rest, [?\f | acc])
  defp string(<<"\\n", rest::binary>>, acc), do: string(rest, [?\n | acc])
  defp string(<<"\\r", rest::binary>>, acc), do: string(rest, [?\r | acc])
  defp string(<<"\\t", rest::binary>>, acc), do: string(rest, [?\t | acc])

  defp string(<<"\\u", digits::binary-size(4), rest::binary>>, acc) do
    string(rest, [String.to_integer(digits, 16) | acc])
  end

  defp string(<<symbol::utf8, rest::binary>>, acc), do: string(rest, [symbol | acc])
  defp string(_, _), do: throw(:bad_json)

  defp number(<<symbol, rest::binary>>, acc)
       when (symbol >= ?0 and symbol <= ?9) or symbol in [?-, ?+, ?., ?e, ?E] do
    number(rest, [symbol | acc])
  end

  defp number(_source, []), do: throw(:bad_json)
  defp number(source, acc), do: {List.to_string(Enum.reverse(acc)), source}

  @doc "Поле объекта JSON по имени: `{:ok, узел}` либо `:error`."
  def field({:object, pairs}, name) do
    case List.keyfind(pairs, name, 0) do
      {^name, value} -> {:ok, value}
      nil -> :error
    end
  end

  def field(_, _), do: :error

  @doc "Строка в кавычках по правилам JSON.stringify."
  def quote_string(value), do: Flang.Rt.quote_json(value)
end

defmodule Flang.Cli do
  @moduledoc """
  Прогонщик программы flang: JSON на входе, JSON на выходе.

  Зачем он есть. Напечатанный модуль на Elixir — это библиотека, и вызвать её
  можно только из BEAM. Но проверить кодогенератор нужно ровно одним способом —
  сверкой с интерпретатором на сетке из тысяч входов, а поднимать виртуальную
  машину ради каждой точки сетки — это тысячи запусков процесса. Поэтому бэкенд
  печатает ещё и прогонщик: один запуск, дальше поток запросов через трубу.

  Побочная польза больше основной: точно так же программу на flang вызывает
  любой язык, у которого есть трубы, — Node, shell, Go. Ни портов, ни NIF.

  ## Протокол (тот же, что у бэкендов C, Go, Rust, Python, Java и C#)

      запрос:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
      ответ:   {"ok":true,"value":…}
               {"ok":false,"code":"FLANG_TYPE","message":"…"}

  У программы с процессами есть второй вид запроса — прогон:

      запрос:  {"run":"имя прогона"}
      ответ:   {"ok":true,"run":"…","исход":"покой","пробегов":4,
                "состояния":[["Счётчик",…]],"живые":[…],"журнал":[…],"отказы":[]}

  Ответ на прогон — ИТОГ, а не приговор: чередование выбирает планировщик BEAM,
  и законен любой исход из тех, что даёт модель. Решает, сошлось ли, тот, кто
  сравнивает этот итог с набором исходов эталона.

  Значения размечены тегами, потому что JSON беднее flang:

      null            «ничто»
      true / false    признак
      {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
                      (по той же причине строкой едут «depth» и «steps»)
      {"s":"текст"}   строка
      {"l":[…]}       список
      {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
      {"v":"Имя","f":[["поле",…]]}       вариант

  ## Кодировку протокола задаёт протокол, а не локаль хозяина

  Протокол — это JSON в UTF-8, и русские имена функций, полей и вариантов ездят
  по нему постоянно. А ввод-вывод BEAM — не байтовый: у устройства
  `:standard_io` есть КОДИРОВКА, и берётся она из локали того, кто запустил
  машину. Локаль кривая — устройство поднимается в `latin1`, и тогда `IO.write`
  печатает всякий знак свыше U+00FF не байтами UTF-8, а последовательностью
  `\\x{43D}`; на входе то же самое наоборот — байты UTF-8 читаются как знаки
  latin1 и превращаются в кракозябры. Это не выдумка: `LC_CTYPE=UTF-8` (форма,
  законная на macOS и не существующая в glibc) даёт ровно это, и `LC_ALL=C`
  тоже. Ответ прогонщика переставал быть JSON — `JSON.parse` падает на
  «Bad escaped character», — и вина при этом не программы и не входа, а
  переменной окружения у хозяина.

  Обходные пути (`LC_ALL=C.UTF-8`, `ELIXIR_ERL_OPTIONS=+fnu`) существуют, но
  обход — это просьба к пользователю. Обещание языка звучит иначе: напечатанная
  программа работает одинаково у всех. Поэтому прогонщик СНИМАЕТ перекодировку
  вовсе — `:io.setopts(устройство, encoding: :latin1)` — и дальше читает и
  пишет байты (`IO.binread/2`, `IO.binwrite/2`). «latin1» здесь читается не как
  «кодировка latin1», а как «не переводить»: устройство отдаёт и принимает ровно
  те байты, что пришли и уходят. А байты эти и есть UTF-8 — строка Elixir по
  определению двоичная и уже в UTF-8, так что переводить между ними нечего.

  Побочно чинится и надёжность: неверная последовательность UTF-8 во входе
  теперь не роняет чтение, а доезжает до разбора JSON и получает честный ответ
  «неразборчивый запрос».

  ## Почему здесь нет потока с большим стеком

  У бэкендов Python, Java и C# прогонщик считает вычисление в отдельном потоке с
  явно заданным стеком: предел глубины flang в 10⁴ вызовов не помещается в стек
  по умолчанию, а его переполнение — не диагностика, а падение процесса. На BEAM
  этой заботы нет вовсе: стек процесса живёт в куче и растёт по мере надобности.
  Зато появляется своя, обратная: незавершающаяся нехвостовая рекурсия не упрётся
  ни во что и съест память узла целиком — поэтому счётчик глубины здесь не
  подстраховка, а единственный ограничитель (см. `Flang.Rt`).

  ## Какой модуль исполнять

  Имя модуля программы приходит первым аргументом: файл программы называется по
  имени модуля flang, а прогонщик печатается байт в байт и знать этого имени
  заранее не может. Без аргумента берётся «FlangProgram».
  """

  @default_program "FlangProgram"

  # ───────────────────────────── чтение значений ─────────────────────────────

  @doc "Число приезжает строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля."
  def parse_number("NaN"), do: :nan
  def parse_number("Infinity"), do: :inf
  def parse_number("-Infinity"), do: :ninf

  def parse_number(value) do
    case Float.parse(value) do
      {result, ""} -> result
      {result, _} -> result
      :error -> :nan
    end
  end

  @doc "Значение из размеченного JSON."
  def decode_value(nil), do: Flang.Rt.nothing()
  def decode_value(true), do: Flang.Rt.flag(true)
  def decode_value(false), do: Flang.Rt.flag(false)

  def decode_value({:object, _} = node) do
    cond do
      match?({:ok, _}, Flang.Json.field(node, "n")) ->
        {:ok, value} = Flang.Json.field(node, "n")
        {:num, parse_number(value)}

      match?({:ok, _}, Flang.Json.field(node, "s")) ->
        {:ok, value} = Flang.Json.field(node, "s")
        Flang.Rt.text(value)

      match?({:ok, _}, Flang.Json.field(node, "l")) ->
        {:ok, items} = Flang.Json.field(node, "l")
        Flang.Rt.list(Enum.map(items, &decode_value/1))

      match?({:ok, _}, Flang.Json.field(node, "r")) ->
        {:ok, pairs} = Flang.Json.field(node, "r")
        Flang.Rt.record(decode_fields(pairs))

      match?({:ok, _}, Flang.Json.field(node, "v")) ->
        {:ok, name} = Flang.Json.field(node, "v")

        pairs =
          case Flang.Json.field(node, "f") do
            {:ok, found} -> found
            :error -> []
          end

        Flang.Rt.variant(name, decode_fields(pairs))

      true ->
        throw(:bad_value)
    end
  end

  def decode_value(_), do: throw(:bad_value)

  @doc "Поля записи или варианта: список пар «имя, значение»."
  def decode_fields(pairs) do
    Enum.map(pairs, fn
      [name, value] -> {name, decode_value(value)}
      _ -> throw(:bad_value)
    end)
  end

  # ───────────────────────────── печать значений ─────────────────────────────

  @doc "Значение в размеченный JSON."
  def encode_value(:nothing), do: "null"
  def encode_value({:flag, true}), do: "true"
  def encode_value({:flag, false}), do: "false"

  def encode_value({:num, value}) do
    # −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно, а
    # Number::toString печатает «0» и для того, и для другого.
    text =
      if is_float(value) and value == 0.0 and Flang.Rt.sign_bit(value) == 1 do
        "-0"
      else
        Flang.Rt.number_text(value)
      end

    "{\"n\":" <> Flang.Json.quote_string(text) <> "}"
  end

  def encode_value({:str, value}), do: "{\"s\":" <> Flang.Json.quote_string(value) <> "}"

  def encode_value({:list, _, _} = value) do
    "{\"l\":[" <> Enum.map_join(Flang.Rt.items(value), ",", &encode_value/1) <> "]}"
  end

  def encode_value({:rec, fields}), do: "{\"r\":" <> encode_fields(fields) <> "}"

  def encode_value({:var, name, fields}) do
    "{\"v\":" <> Flang.Json.quote_string(name) <> ",\"f\":" <> encode_fields(fields) <> "}"
  end

  defp encode_fields(fields) do
    "[" <>
      Enum.map_join(fields, ",", fn {name, value} ->
        "[" <> Flang.Json.quote_string(name) <> "," <> encode_value(value) <> "]"
      end) <> "]"
  end

  # ───────────────────────────── запрос ─────────────────────────────

  defp failure(code, message) do
    "{\"ok\":false,\"code\":" <>
      Flang.Json.quote_string(code) <> ",\"message\":" <> Flang.Json.quote_string(message) <> "}"
  end

  @doc "Один запрос: разбор, вызов, ответ. Исключения наружу не выпускаются."
  def run_request(module, line) do
    case Flang.Json.parse(line) do
      {:ok, query} -> run_query(module, query)
      :error -> failure("CLI", "неразборчивый запрос")
    end
  end

  defp run_query(module, query) do
    case Flang.Json.field(query, "run") do
      {:ok, name} when is_binary(name) and name != "" ->
        run_concurrent(module, name)

      _ ->
        case Flang.Json.field(query, "fn") do
          {:ok, name} when is_binary(name) and name != "" -> run_call(module, query, name)
          _ -> failure("CLI", "в запросе нет ни имени функции, ни имени прогона")
        end
    end
  end

  # Прогон конкурентной программы. `conc_run/1` печатается в модуль программы
  # только тогда, когда в ней есть хоть один процесс, — поэтому вызов идёт через
  # apply по переменной: прогонщик печатается байт в байт и обязан собираться и
  # рядом с программой без процессов, где модуля `Flang.Conc` нет вовсе.
  defp run_concurrent(module, name) do
    if function_exported?(module, :conc_run, 1) do
      case apply(module, :conc_run, [name]) do
        {:error, message} -> failure("CLI", message)
        result -> encode_run(result)
      end
    else
      failure("CLI", "в программе нет процессов: прогонять нечего")
    end
  end

  # Итог прогона. Ключи русские — те же, что у планировщика эталона (conc.mjs):
  # сверять два итога проще, когда они называют одно одинаково.
  defp encode_run(result) do
    "{\"ok\":true,\"run\":" <>
      Flang.Json.quote_string(result.run) <>
      ",\"исход\":" <>
      Flang.Json.quote_string(result.outcome) <>
      ",\"пробегов\":" <>
      Integer.to_string(result.turns) <>
      ",\"состояния\":[" <>
      Enum.map_join(result.states, ",", fn {name, value} ->
        "[" <> Flang.Json.quote_string(name) <> "," <> encode_value(value) <> "]"
      end) <>
      "],\"живые\":[" <>
      Enum.map_join(result.alive, ",", &Flang.Json.quote_string/1) <>
      "],\"журнал\":[" <>
      Enum.map_join(result.journal, ",", &Flang.Json.quote_string/1) <>
      "],\"отказы\":[" <>
      Enum.map_join(result.failures, ",", fn {name, code} ->
        "[" <> Flang.Json.quote_string(name) <> "," <> Flang.Json.quote_string(code) <> "]"
      end) <> "]}"
  end

  defp run_call(module, query, name) do
    # Контекст готовится заново на каждый запрос: счётчики обязаны обнулиться,
    # даже если предыдущее вычисление оборвалось на середине.
    apply(module, :new_context, [])

    case Flang.Json.field(query, "depth") do
      {:ok, value} when is_binary(value) and value != "" ->
        Flang.Rt.set_max_depth(trunc(parse_limit(value)))

      _ ->
        :ok
    end

    case Flang.Json.field(query, "steps") do
      {:ok, value} when is_binary(value) and value != "" ->
        Flang.Rt.set_max_steps(trunc(parse_limit(value)))

      _ ->
        :ok
    end

    case decode_args(query) do
      {:ok, args} -> invoke(module, name, args)
      :error -> failure("CLI", "неразборчивые аргументы")
    end
  end

  defp parse_limit(value) do
    case parse_number(value) do
      result when is_float(result) -> result
      _ -> 0.0
    end
  end

  defp decode_args(query) do
    case Flang.Json.field(query, "args") do
      {:ok, items} when is_list(items) -> {:ok, Enum.map(items, &decode_value/1)}
      :error -> {:ok, []}
      _ -> :error
    end
  catch
    :bad_value -> :error
  end

  defp invoke(module, name, args) do
    "{\"ok\":true,\"value\":" <> encode_value(apply(module, :call, [name, args])) <> "}"
  rescue
    error in Flang.Error -> failure(error.code, error.message)
  end

  @doc """
  Снимает с устройства перекодировку: дальше это поток БАЙТОВ.

  Единственное место, где напечатанная программа спорит с окружением, и спорит
  по делу — разбор в `@moduledoc`, «Кодировку протокола задаёт протокол».
  `:latin1` здесь читается не как «кодировка latin1», а как «не переводить»:
  устройство отдаёт и принимает ровно те байты, что пришли и уходят, а строка
  Elixir двоична и уже в UTF-8, так что переводить между ними нечего.
  """
  def pin_bytes(device) do
    :io.setopts(device, encoding: :latin1)
    :ok
  end

  @doc """
  Цикл «строка запроса — строка ответа». Ответ ровно один на запрос.

  Устройство здесь — процесс (`Process.group_leader/0`), а не `:stdio`:
  `:io.setopts/2` эрлангова и алиаса `:stdio` не знает, а `IO.binread/2` и
  `IO.binwrite/2` его всё равно разворачивают в тот же самый процесс. Одно имя
  на всех трёх вызовах значит, что настройка ложится ровно на то устройство,
  которым потом читают и пишут.
  """
  def serve(module, device) do
    pin_bytes(device)
    loop(module, device)
  end

  defp loop(module, device) do
    case IO.binread(device, :line) do
      :eof ->
        :ok

      {:error, reason} ->
        raise Flang.Rt.fail("CLI", "ввод прогонщика не читается: " <> inspect(reason))

      line ->
        unless blank?(line) do
          # Явный «\n» через IO.binwrite, а не IO.puts: и разделитель строк, и
          # кодировка в протоколе заданы протоколом, а не платформой.
          IO.binwrite(device, run_request(module, line) <> "\n")
        end

        loop(module, device)
    end
  end

  # Пустая ли строка. Обрезать её незачем: `Flang.Json.parse/1` сам пропускает
  # пробельные знаки и до, и после значения, поэтому конец строки доезжает до
  # разбора как есть. Проверка идёт по БАЙТАМ, а не через String.trim/1: на этом
  # уровне у прогонщика байты и только байты, а разделители протокола — ASCII.
  defp blank?(<<symbol, rest::binary>>) when symbol in [?\s, ?\t, ?\n, ?\r], do: blank?(rest)
  defp blank?(""), do: true
  defp blank?(_), do: false

  @doc "Точка входа: `elixir -pa _build -e 'Flang.Cli.main([\"Модуль\"])'`."
  def main(argv) do
    name = List.first(argv) || @default_program
    module = Module.concat([name])
    {:module, ^module} = Code.ensure_loaded(module)
    serve(module, Process.group_leader())
    :ok
  end
end
