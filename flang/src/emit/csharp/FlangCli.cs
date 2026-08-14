// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Прогонщик программы flang: JSON на входе, JSON на выходе.
//
// Зачем он есть. Напечатанный класс на C# — это библиотека, и вызвать её можно
// только из .NET. Но проверить кодогенератор нужно ровно одним способом —
// сверкой с интерпретатором на сетке из тысяч входов, а поднимать среду ради
// каждой точки сетки — это тысячи запусков процесса. Поэтому бэкенд печатает
// ещё и прогонщик: один запуск, дальше поток запросов через трубу.
//
// Побочная польза больше основной: точно так же программу на flang вызывает
// любой язык, у которого есть трубы, — Node, shell, Go. Ни P/Invoke, ни
// сервера.
//
// ── Протокол (тот же, что у бэкендов C, Go, Rust, Python и Java) ───────────
// Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
// Ответ  — одна строка:  {"ok":true,"value":…}
//                        {"ok":false,"code":"FLANG_TYPE","message":"…"}
//
// Значения размечены тегами, потому что JSON беднее flang:
//
//     null            «ничто»
//     true / false    признак
//     {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
//                     (по той же причине строкой едут «depth» и «steps»)
//     {"s":"текст"}   строка
//     {"l":[…]}       список
//     {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
//     {"v":"Имя","f":[["поле",…]]}       вариант
//
// ── Почему свой разбор JSON, а не System.Text.Json ─────────────────────────
// System.Text.Json есть в базовой библиотеке .NET и был бы уместен, но он
// появился только в .NET Core 3.0, а напечатанный код обязан собираться и там,
// где среда старше. Нужное подмножество мало: строки, числа (которые всё равно
// едут строками), списки, объекты, три литерала — сотня строк, зато ни от чего
// не зависит и ведёт себя одинаково во всех бэкендах flang.
//
// ── Почему поток с большим стеком ──────────────────────────────────────────
// Предел глубины вызовов flang по умолчанию 10⁴, и упереться в него обязан
// счётчик языка, а не стек среды: StackOverflowException в .NET не ловится
// вовсе и убивает процесс вместе со всеми накопленными ответами. Поэтому
// вычисление живёт в потоке с явно заданным большим стеком (Flang.WithDeepStack).
//
// ── Какой класс исполнять ──────────────────────────────────────────────────
// Имя класса программы приходит первым аргументом командной строки: файл
// программы называется по имени модуля flang, а прогонщик печатается байт в
// байт и знать этого имени заранее не может. Без аргумента берётся
// «FlangProgram». Связь идёт отражением — класса программы во время написания
// прогонщика ещё нет.
#nullable enable

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;

/// <summary>Прогонщик: строка запроса — строка ответа.</summary>
public static class FlangCli
{
    private const string DefaultProgramClass = "FlangProgram";

    /* ───────────────────────────── разбор JSON ───────────────────────────── */

    /// <summary>
    /// Разбор минимального подмножества JSON. Узлы представлены типами .NET:
    /// string, bool, null, List&lt;object?&gt; и Dictionary с сохранением
    /// порядка ключей (он наблюдаем в полях записи). Число разбирается в string:
    /// числа протокола и так едут строками.
    /// </summary>
    private sealed class Json
    {
        private readonly string source;
        private int at;

        private Json(string source)
        {
            this.source = source;
        }

        public static object? Parse(string source)
        {
            var reader = new Json(source);
            reader.Spaces();
            object? value = reader.Value();
            reader.Spaces();
            if (reader.at != source.Length)
            {
                throw new FormatException("лишние знаки после значения JSON");
            }
            return value;
        }

        private void Spaces()
        {
            while (at < source.Length)
            {
                char symbol = source[at];
                if (symbol == ' ' || symbol == '\t' || symbol == '\n' || symbol == '\r')
                {
                    at += 1;
                }
                else
                {
                    return;
                }
            }
        }

        private object? Value()
        {
            if (at >= source.Length)
            {
                throw new FormatException("значение JSON оборвано");
            }
            char symbol = source[at];
            if (symbol == '{')
            {
                return Object();
            }
            if (symbol == '[')
            {
                return Array();
            }
            if (symbol == '"')
            {
                return String();
            }
            if (string.CompareOrdinal(source, at, "true", 0, 4) == 0)
            {
                at += 4;
                return true;
            }
            if (string.CompareOrdinal(source, at, "false", 0, 5) == 0)
            {
                at += 5;
                return false;
            }
            if (string.CompareOrdinal(source, at, "null", 0, 4) == 0)
            {
                at += 4;
                return null;
            }
            return Number();
        }

        private Dictionary<string, object?> Object()
        {
            var result = new Dictionary<string, object?>(StringComparer.Ordinal);
            at += 1;
            Spaces();
            if (at < source.Length && source[at] == '}')
            {
                at += 1;
                return result;
            }
            for (; ; )
            {
                Spaces();
                string key = String();
                Spaces();
                Expect(':');
                Spaces();
                result[key] = Value();
                Spaces();
                if (at < source.Length && source[at] == ',')
                {
                    at += 1;
                    continue;
                }
                Expect('}');
                return result;
            }
        }

        private List<object?> Array()
        {
            var result = new List<object?>();
            at += 1;
            Spaces();
            if (at < source.Length && source[at] == ']')
            {
                at += 1;
                return result;
            }
            for (; ; )
            {
                Spaces();
                result.Add(Value());
                Spaces();
                if (at < source.Length && source[at] == ',')
                {
                    at += 1;
                    continue;
                }
                Expect(']');
                return result;
            }
        }

        private string String()
        {
            Expect('"');
            var output = new StringBuilder();
            while (at < source.Length)
            {
                char symbol = source[at];
                at += 1;
                if (symbol == '"')
                {
                    return output.ToString();
                }
                if (symbol != '\\')
                {
                    output.Append(symbol);
                    continue;
                }
                char escaped = source[at];
                at += 1;
                switch (escaped)
                {
                    case '"':
                        output.Append('"');
                        break;
                    case '\\':
                        output.Append('\\');
                        break;
                    case '/':
                        output.Append('/');
                        break;
                    case 'b':
                        output.Append('\b');
                        break;
                    case 'f':
                        output.Append('\f');
                        break;
                    case 'n':
                        output.Append('\n');
                        break;
                    case 'r':
                        output.Append('\r');
                        break;
                    case 't':
                        output.Append('\t');
                        break;
                    case 'u':
                        output.Append((char)int.Parse(
                            source.Substring(at, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        at += 4;
                        break;
                    default:
                        throw new FormatException("неизвестная escape-последовательность JSON");
                }
            }
            throw new FormatException("строка JSON не закрыта");
        }

        private string Number()
        {
            int from = at;
            while (at < source.Length)
            {
                char symbol = source[at];
                bool digit = symbol >= '0' && symbol <= '9';
                if (digit || symbol == '-' || symbol == '+' || symbol == '.'
                    || symbol == 'e' || symbol == 'E')
                {
                    at += 1;
                }
                else
                {
                    break;
                }
            }
            if (from == at)
            {
                throw new FormatException("не значение JSON");
            }
            return source.Substring(from, at - from);
        }

        private void Expect(char symbol)
        {
            if (at >= source.Length || source[at] != symbol)
            {
                throw new FormatException("ожидался знак «" + symbol + "» в JSON");
            }
            at += 1;
        }
    }

    /* ───────────────────────────── чтение значений ───────────────────────── */

    /// <summary>Число приезжает строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля.</summary>
    private static double ParseNumber(string value)
    {
        if (value == "NaN")
        {
            return double.NaN;
        }
        if (value == "Infinity")
        {
            return double.PositiveInfinity;
        }
        if (value == "-Infinity")
        {
            return double.NegativeInfinity;
        }
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out double result)
            ? result
            : double.NaN;
    }

    /// <summary>Значение из размеченного JSON.</summary>
    private static Value DecodeValue(object? node)
    {
        if (node is null)
        {
            return Value.Nothing();
        }
        if (node is bool flag)
        {
            return Value.Flag(flag);
        }
        if (node is not Dictionary<string, object?> objectNode)
        {
            throw new FormatException("нечего декодировать");
        }
        if (objectNode.TryGetValue("n", out object? number))
        {
            return Value.Number(ParseNumber((string)number!));
        }
        if (objectNode.TryGetValue("s", out object? text))
        {
            return Value.Text((string)text!);
        }
        if (objectNode.TryGetValue("l", out object? list))
        {
            var items = (List<object?>)list!;
            var result = new Value[items.Count];
            for (int index = 0; index < result.Length; index++)
            {
                result[index] = DecodeValue(items[index]);
            }
            return Value.List(result);
        }
        if (objectNode.TryGetValue("r", out object? record))
        {
            return Value.Record(DecodeFields(record));
        }
        if (objectNode.TryGetValue("v", out object? name))
        {
            object? fields = objectNode.TryGetValue("f", out object? found) ? found : new List<object?>();
            return Value.Variant((string)name!, DecodeFields(fields));
        }
        throw new FormatException("нечего декодировать");
    }

    /// <summary>Поля записи или варианта: список пар «имя, значение».</summary>
    private static Field[] DecodeFields(object? node)
    {
        var pairs = (List<object?>)node!;
        var result = new Field[pairs.Count];
        for (int index = 0; index < result.Length; index++)
        {
            var pair = (List<object?>)pairs[index]!;
            if (pair.Count != 2)
            {
                throw new FormatException("пара «имя, значение» обязана быть из двух элементов");
            }
            result[index] = new Field((string)pair[0]!, DecodeValue(pair[1]));
        }
        return result;
    }

    /* ───────────────────────────── печать значений ───────────────────────── */

    /// <summary>Значение в размеченный JSON.</summary>
    private static void EncodeValue(StringBuilder output, Value value)
    {
        switch (value.Tag)
        {
            case Value.TagNothing:
                output.Append("null");
                return;
            case Value.TagFlag:
                output.Append(value.Bit ? "true" : "false");
                return;
            case Value.TagNumber:
                output.Append("{\"n\":");
                /* −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно,
                   а Number::toString печатает «0» и для того, и для другого. */
                if (value.Num == 0.0 && double.IsNegative(value.Num))
                {
                    output.Append("\"-0\"");
                }
                else
                {
                    output.Append(Value.QuoteJson(Value.NumberText(value.Num)));
                }
                output.Append('}');
                return;
            case Value.TagString:
                output.Append("{\"s\":").Append(Value.QuoteJson(value.Str)).Append('}');
                return;
            case Value.TagList:
                output.Append("{\"l\":[");
                for (int index = 0; index < value.Items.Length; index++)
                {
                    if (index > 0)
                    {
                        output.Append(',');
                    }
                    EncodeValue(output, value.Items[index]);
                }
                output.Append("]}");
                return;
            case Value.TagRecord:
                output.Append("{\"r\":");
                EncodeFields(output, value.Fields);
                output.Append('}');
                return;
            case Value.TagVariant:
                output.Append("{\"v\":").Append(Value.QuoteJson(value.Str)).Append(",\"f\":");
                EncodeFields(output, value.Fields);
                output.Append('}');
                return;
            default:
                output.Append("null");
                return;
        }
    }

    private static void EncodeFields(StringBuilder output, Field[] fields)
    {
        output.Append('[');
        for (int index = 0; index < fields.Length; index++)
        {
            if (index > 0)
            {
                output.Append(',');
            }
            output.Append('[').Append(Value.QuoteJson(fields[index].Name)).Append(',');
            EncodeValue(output, fields[index].Value);
            output.Append(']');
        }
        output.Append(']');
    }

    /* ───────────────────────────── запрос ───────────────────────────── */

    private static string Failure(string code, string message) =>
        "{\"ok\":false,\"code\":" + Value.QuoteJson(code) + ",\"message\":"
            + Value.QuoteJson(message) + "}";

    /// <summary>
    /// Мост к напечатанной программе. Класса программы во время написания
    /// прогонщика ещё нет — он появляется рядом при печати, — поэтому связь идёт
    /// отражением: «NewContext» без аргументов и «Call(Ctx, string, Value[])».
    /// </summary>
    private sealed class Program
    {
        private readonly MethodInfo contextMethod;
        private readonly MethodInfo callMethod;

        public Program(string name)
        {
            Type type = Type.GetType(name, throwOnError: true)!;
            contextMethod = type.GetMethod("NewContext", Type.EmptyTypes)!;
            callMethod = type.GetMethod("Call", new[] { typeof(Ctx), typeof(string), typeof(Value[]) })!;
        }

        public Ctx NewContext() => (Ctx)contextMethod.Invoke(null, null)!;

        public Value Call(Ctx ctx, string name, Value[] args) =>
            (Value)callMethod.Invoke(null, new object[] { ctx, name, args })!;
    }

    /// <summary>Один запрос: разбор, вызов, ответ. Исключения наружу не выпускаются.</summary>
    private static string RunRequest(Program program, string line)
    {
        object? parsed;
        try
        {
            parsed = Json.Parse(line);
        }
        catch (Exception)
        {
            return Failure("CLI", "неразборчивый запрос");
        }
        if (parsed is not Dictionary<string, object?> query)
        {
            return Failure("CLI", "в запросе нет имени функции");
        }
        if (!query.TryGetValue("fn", out object? name) || name is not string function || function.Length == 0)
        {
            return Failure("CLI", "в запросе нет имени функции");
        }

        Ctx ctx = program.NewContext();
        if (query.TryGetValue("depth", out object? depth) && depth is string depthText && depthText.Length > 0)
        {
            ctx.MaxDepth = (int)ParseNumber(depthText);
        }
        if (query.TryGetValue("steps", out object? steps) && steps is string stepsText && stepsText.Length > 0)
        {
            ctx.MaxSteps = (long)ParseNumber(stepsText);
        }

        Value[] args;
        try
        {
            var raw = query.TryGetValue("args", out object? given) && given is not null
                ? (List<object?>)given
                : new List<object?>();
            args = new Value[raw.Count];
            for (int index = 0; index < args.Length; index++)
            {
                args[index] = DecodeValue(raw[index]);
            }
        }
        catch (Exception)
        {
            return Failure("CLI", "неразборчивые аргументы");
        }

        Value result;
        try
        {
            result = program.Call(ctx, function, args);
        }
        catch (TargetInvocationException wrapped) when (wrapped.InnerException is FlangError error)
        {
            return Failure(error.Code, error.Text);
        }
        catch (TargetInvocationException wrapped)
        {
            return Failure("CLI", wrapped.InnerException?.Message ?? "вычисление сорвалось");
        }
        var output = new StringBuilder("{\"ok\":true,\"value\":");
        EncodeValue(output, result);
        return output.Append('}').ToString();
    }

    /// <summary>Цикл «строка запроса — строка ответа». Ответ ровно один на запрос.</summary>
    private static void Serve(Program program, TextReader source, TextWriter sink)
    {
        string? line;
        while ((line = source.ReadLine()) is not null)
        {
            string request = line.Trim();
            if (request.Length == 0)
            {
                continue;
            }
            /* Явный «\n», а не WriteLine: разделитель строк в протоколе задан
               протоколом, а не платформой. */
            sink.Write(RunRequest(program, request));
            sink.Write('\n');
            sink.Flush();
        }
    }

    public static int Main(string[] argv)
    {
        string name = argv.Length > 0 ? argv[0] : DefaultProgramClass;
        var program = new Program(name);
        /* UTF-8 без метки порядка байтов: имена и тексты диагностик
           кириллические, а метка испортила бы первую строку протокола. */
        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        Console.OutputEncoding = encoding;
        Console.InputEncoding = encoding;
        var sink = new StreamWriter(Console.OpenStandardOutput(), encoding);
        var source = new StreamReader(Console.OpenStandardInput(), encoding);
        Flang.WithDeepStack<object?>(
            () =>
            {
                Serve(program, source, sink);
                return null;
            });
        sink.Flush();
        return 0;
    }
}
