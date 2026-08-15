// Операции языка flang для бэкенда C#: арифметика, доступ к полям, разбор,
// встроенные формы, батут и глубокий стек.
//
// Это «rt.» напечатанного кода: всё, что не сводится к одному оператору C# без
// потери совпадения с интерпретатором, живёт здесь. Правило простое — если
// операция способна дать диагностику flang, она обязана быть здесь, потому что
// текст диагностики сверяется с интерпретатором дословно, а собрать его на
// месте вызова значило бы размножить один текст по всей программе.
//
// ── Что C# даёт даром ──────────────────────────────────────────────────────
// Деление double на ноль возвращает ±Infinity, ноль на ноль — NaN, а `%` для
// double — это оператор ECMAScript дословно (знак от делимого, нулевой делитель
// даёт NaN). Арифметика совпадает с ядром сама по себе — в отличие от Python,
// где деление пришлось оборачивать в try, и от decimal, который не годится
// вовсе (см. Value.cs).
//
// ── Что C# даром не даёт ───────────────────────────────────────────────────
// Строка. string — это UTF-16, а «длина» в flang считается в кодовых точках
// (SPEC, раздел 5). Для кириллицы разницы нет, для эмодзи — вдвое, и молчаливое
// расхождение на эмодзи хуже громкого: оно всплывает у пользователя, а не в
// тесте. Поэтому «длина», «символ» и «подстрока» ходят по кодовым точкам явно.
//
// Стек. Предел глубины flang — 10⁴ вызовов, и стека потока .NET по умолчанию
// (мегабайт) под это не хватает. StackOverflowException в .NET не ловится и
// убивает процесс, поэтому вычисление считается в потоке с явно заданным
// стеком (WithDeepStack).
#nullable enable

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Threading;

/// <summary>Операции языка flang.</summary>
public static class Flang
{
    /* ───────────────────────────── диагностика ───────────────────────────── */

    /// <summary>Собирает диагностику. Возвращает исключение — бросает вызывающий.</summary>
    public static FlangError Fail(string code, string message) => new FlangError(code, message);

    /* ───────────────────────────── глубокий стек ─────────────────────────── */

    /// <summary>
    /// Стек потока, в котором считается вычисление.
    ///
    /// Предел глубины flang по умолчанию 10⁴, кадр напечатанной функции несёт
    /// контекст, параметры и временные, и мегабайта стека по умолчанию на это не
    /// хватает. Требовать настройки от пользователя нельзя: напечатанная
    /// программа обязана работать так, как её запустили.
    /// </summary>
    public const int DeepStackBytes = 512 * 1024 * 1024;

    /// <summary>
    /// Исполняет работу в потоке с большим стеком и возвращает её результат.
    /// Исключение переносится вызывающему как есть: FlangError обязана доехать
    /// до прогонщика неотличимой от той, что возникла бы в главном потоке.
    /// </summary>
    public static T WithDeepStack<T>(Func<T> work)
    {
        T result = default!;
        Exception? failure = null;
        var worker = new Thread(
            () =>
            {
                try
                {
                    result = work();
                }
                catch (Exception error)
                {
                    failure = error;
                }
            },
            DeepStackBytes);
        worker.Start();
        worker.Join();
        if (failure is not null)
        {
            throw failure;
        }
        return result;
    }

    /* ───────────────────────────── батут ───────────────────────────── */

    /// <summary>
    /// Отскок: следующий шаг компоненты и его аргументы.
    ///
    /// Взаимная хвостовая рекурсия («Чётное»/«Нечётное») у интерпретатора идёт в
    /// постоянной глубине — он переиспользует кадр возврата. Обычный вызов C#
    /// рос бы по стеку: хвостовых вызовов среда не обещает (инструкция IL tail.
    /// существует, но компилятор C# её не порождает), и программа упёрлась бы в
    /// предел там, где интерпретатор считает штатно.
    /// </summary>
    public sealed class Bounce
    {
        /// <summary>Шаг, к которому нужно отскочить, либо null, если получено значение.</summary>
        public Step? Next;

        /// <summary>Аргументы отскока.</summary>
        public Value[] Args = Array.Empty<Value>();
    }

    /// <summary>Шаг батута: считает своё тело либо заполняет отскок.</summary>
    public delegate Value? Step(Ctx ctx, Value[] args, Bounce bounce);

    /// <summary>Крутит отскоки в цикле, пока шаг не вернёт значение.</summary>
    public static Value Trampoline(Ctx ctx, Step step, Value[] args, string function)
    {
        var bounce = new Bounce();
        Step current = step;
        Value[] currentArgs = args;
        for (; ; )
        {
            bounce.Next = null;
            Value? value = current(ctx, currentArgs, bounce);
            if (bounce.Next is null)
            {
                /* Шаг, не заполнивший отскок, обязан был вернуть значение;
                   null здесь означал бы ошибку печати, а не ход вычисления. */
                return value ?? Value.Nothing();
            }
            ctx.Step(function);
            current = bounce.Next;
            currentArgs = bounce.Args;
        }
    }

    /* ───────────────────────────── операции языка ───────────────────────── */

    /// <summary>Доступ к полю записи.</summary>
    public static Value FieldGet(Ctx ctx, Value target, string name)
    {
        if (target.Tag == Value.TagVariant)
        {
            throw Fail(
                FlangError.CodeType,
                "поле «" + name + "» нельзя взять у варианта «" + target.Str + "» — нужен разбор");
        }
        if (target.Tag != Value.TagRecord)
        {
            throw Fail(
                FlangError.CodeType,
                "поле «" + name + "» можно взять только у записи, получено " + Value.TypeName(target));
        }
        Value? found = Value.Lookup(target.Fields, name);
        if (found is null)
        {
            throw Fail(FlangError.CodeUnknownName, "запись не содержит поле «" + name + "»");
        }
        return found;
    }

    /// <summary>
    /// Поле варианта при сопоставлении с образцом. Отсутствующее поле — ошибка
    /// прямо здесь, а не «случай не подошёл»: так же ведёт себя matchPattern
    /// интерпретатора.
    /// </summary>
    public static Value VariantField(Ctx ctx, Value target, string name)
    {
        Value? found = Value.Lookup(target.Fields, name);
        if (found is null)
        {
            throw Fail(
                FlangError.CodeUnknownName,
                "вариант «" + target.Str + "» не содержит поле «" + name + "»");
        }
        return found;
    }

    /// <summary>Условие «если»: обязано быть признаком.</summary>
    public static bool Cond(Ctx ctx, Value value)
    {
        if (value.Tag != Value.TagFlag)
        {
            throw Fail(
                FlangError.CodeType,
                "условие «если» должно быть признаком, получено " + Value.TypeName(value));
        }
        return value.Bit;
    }

    /// <summary>Условие «отфильтровать»: обязано быть признаком.</summary>
    public static bool Keep(Ctx ctx, Value value)
    {
        if (value.Tag != Value.TagFlag)
        {
            throw Fail(
                FlangError.CodeType,
                "условие «отфильтровать» должно быть признаком, получено " + Value.TypeName(value));
        }
        return value.Bit;
    }

    /// <summary>Значение постусловия: обязано быть признаком.</summary>
    public static bool Post(Ctx ctx, Value value, string property, string function)
    {
        if (value.Tag != Value.TagFlag)
        {
            throw Fail(
                FlangError.CodeType,
                "постусловие «" + property + "» функции «" + function
                    + "» должно давать признак, получено " + Value.TypeName(value));
        }
        return value.Bit;
    }

    /// <summary>Разбор не покрыл значение.</summary>
    public static FlangError MatchFail(Ctx ctx, Value value) =>
        Fail(FlangError.CodeMatch, "разбор не покрывает значение " + Value.Describe(value));

    /// <summary>
    /// То же самое, но в позиции значения.
    ///
    /// Тип возврата здесь — Value, хотя метод не возвращает ничего никогда. Это
    /// не небрежность, а требование C#: разбор без единого случая стоит в
    /// позиции выражения, и напечатать на его месте `throw` нельзя — следующий
    /// оператор стал бы недостижимым, а недостижимый код под /warnaserror это
    /// отказ сборки (CS0162). С методом же оператор завершается нормально с
    /// точки зрения компилятора, а во время выполнения даёт ту же диагностику.
    /// </summary>
    public static Value NoMatch(Ctx ctx, Value value) => throw MatchFail(ctx, value);

    /// <summary>
    /// «свёртка», «отобразить» и «отфильтровать» работают только со списком.
    ///
    /// Отдаётся массив ровно нужной длины (Value.Elements), а не общий массив
    /// списка: за концом списка в общем массиве могут лежать чужие ячейки, а
    /// обход печатается как `foreach (Value item in …)` и прошёл бы по ним
    /// тоже.
    /// </summary>
    public static Value[] RequireList(Ctx ctx, Value value, string label)
    {
        if (value.Tag != Value.TagList)
        {
            throw Fail(
                FlangError.CodeType,
                "«" + label + "» работает только со списком, получено " + Value.TypeName(value));
        }
        return Value.Elements(value);
    }

    /* ───────────────────────────── арифметика ───────────────────────────── */

    private static void Arithmetic(string op, Value left, Value right)
    {
        if (left.Tag != Value.TagNumber || right.Tag != Value.TagNumber)
        {
            throw Fail(
                FlangError.CodeType,
                "операция «" + op + "» допустима только для чисел, получено "
                    + Value.TypeName(left) + " и " + Value.TypeName(right));
        }
    }

    private static void Ordered(Value left, Value right)
    {
        /* Сообщение дословно как в ядре FTS (src/utility.ts, compare). */
        if (left.Tag != Value.TagNumber || right.Tag != Value.TagNumber)
        {
            throw Fail(FlangError.CodeType, "сравнения порядка допустимы только для чисел");
        }
    }

    /// <summary>«плюс».</summary>
    public static Value Add(Ctx ctx, Value left, Value right)
    {
        Arithmetic("add", left, right);
        return Value.Number(left.Num + right.Num);
    }

    /// <summary>«минус».</summary>
    public static Value Sub(Ctx ctx, Value left, Value right)
    {
        Arithmetic("sub", left, right);
        return Value.Number(left.Num - right.Num);
    }

    /// <summary>«умножить на».</summary>
    public static Value Mul(Ctx ctx, Value left, Value right)
    {
        Arithmetic("mul", left, right);
        return Value.Number(left.Num * right.Num);
    }

    /// <summary>
    /// «делить на». Деление double на ноль в C# даёт ±Infinity, а ноль на ноль —
    /// NaN, ровно как требует SPEC (раздел 5): деление на ноль — это значение, а
    /// не ошибка. Никакой обёртки, в отличие от Python.
    /// </summary>
    public static Value Div(Ctx ctx, Value left, Value right)
    {
        Arithmetic("div", left, right);
        return Value.Number(left.Num / right.Num);
    }

    /// <summary>
    /// «остаток от» как двуместная операция. Оператор `%` для double в C# — это
    /// C fmod, то есть ровно оператор ECMAScript: знак от делимого (−7 % 3 это
    /// −1), нулевой делитель даёт NaN, бесконечное делимое даёт NaN.
    /// </summary>
    public static Value Mod(Ctx ctx, Value left, Value right)
    {
        Arithmetic("mod", left, right);
        return Value.Number(left.Num % right.Num);
    }

    /// <summary>
    /// «процентов от». Порядок операций ядра: (процент / 100) * значение.
    /// Переписать в значение * процент / 100 нельзя — меняется последний бит
    /// мантиссы.
    /// </summary>
    public static Value Percent(Ctx ctx, Value left, Value right)
    {
        Arithmetic("percent", left, right);
        return Value.Number((left.Num / 100) * right.Num);
    }

    /// <summary>«больше».</summary>
    public static Value Gt(Ctx ctx, Value left, Value right)
    {
        Ordered(left, right);
        return Value.Flag(left.Num > right.Num);
    }

    /// <summary>«меньше».</summary>
    public static Value Lt(Ctx ctx, Value left, Value right)
    {
        Ordered(left, right);
        return Value.Flag(left.Num < right.Num);
    }

    /// <summary>«не меньше».</summary>
    public static Value Gte(Ctx ctx, Value left, Value right)
    {
        Ordered(left, right);
        return Value.Flag(left.Num >= right.Num);
    }

    /// <summary>«не больше».</summary>
    public static Value Lte(Ctx ctx, Value left, Value right)
    {
        Ordered(left, right);
        return Value.Flag(left.Num <= right.Num);
    }

    /// <summary>«соединить» как двуместная операция над строками.</summary>
    public static Value Concat(Ctx ctx, Value left, Value right)
    {
        if (left.Tag != Value.TagString || right.Tag != Value.TagString)
        {
            throw Fail(
                FlangError.CodeType,
                "«соединить» допустимо только для строк, получено "
                    + Value.TypeName(left) + " и " + Value.TypeName(right));
        }
        return Value.Text(left.Str + right.Str);
    }

    /// <summary>Равенство значений как выражение языка.</summary>
    public static Value Eq(Value left, Value right) => Value.Flag(Value.Equal(left, right));

    /// <summary>Неравенство значений как выражение языка.</summary>
    public static Value Neq(Value left, Value right) => Value.Flag(!Value.Equal(left, right));

    /* ───────────────────────── проверки аргументов ───────────────────────── */

    private static string ExpectString(string name, Value value, string role)
    {
        if (value.Tag != Value.TagString)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«" + name + "»: " + role + " должна быть строкой, получено " + Value.TypeName(value));
        }
        return value.Str;
    }

    private static double ExpectNumber(string name, Value value, string role)
    {
        if (value.Tag != Value.TagNumber)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«" + name + "»: " + role + " должно быть числом, получено " + Value.TypeName(value));
        }
        return value.Num;
    }

    private static double ExpectInteger(string name, Value value, string role)
    {
        double result = ExpectNumber(name, value, role);
        /* Number.isInteger: ни NaN, ни бесконечность целыми не считаются. */
        if (double.IsNaN(result) || double.IsInfinity(result) || result != Math.Truncate(result))
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«" + name + "»: " + role + " должно быть целым числом, получено "
                    + Value.NumberText(result));
        }
        return result;
    }

    /// <summary>
    /// Проверка «это список» для встроенных форм.
    ///
    /// Возвращается само значение, а не его массив: у списка есть длина,
    /// отдельная от длины общего массива (см. Value.Count), и встроенные формы
    /// обязаны считать по ней. Копии здесь нет — «элемент N в …» стоит того же,
    /// что «голова», как и обещано в SPEC.
    /// </summary>
    private static Value ExpectList(string name, Value value, string role)
    {
        if (value.Tag != Value.TagList)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«" + name + "»: " + role + " должен быть списком, получено " + Value.TypeName(value));
        }
        return value;
    }

    /* ───────────────────────── строки в кодовых точках ───────────────────── */

    /// <summary>
    /// Длина строки в кодовых точках.
    ///
    /// Это и есть та поправка, ради которой в SPEC (раздел 5) записано «длина в
    /// кодовых точках, а не в единицах UTF-16». Для кириллицы результат тот же,
    /// что у Length, для эмодзи — вдвое меньше, и именно эмодзи ловит ошибку.
    /// StringInfo здесь не годится: он считает графемные кластеры, а не кодовые
    /// точки, и «е» с комбинирующим ударением дал бы единицу вместо двух.
    /// </summary>
    public static int CodePointLength(string value)
    {
        int count = 0;
        for (int index = 0; index < value.Length; index += 1)
        {
            if (!char.IsLowSurrogate(value[index]))
            {
                count += 1;
            }
        }
        return count;
    }

    /// <summary>Смещение в единицах UTF-16 по номеру кодовой точки.</summary>
    private static int OffsetOf(string value, int codePoints)
    {
        int offset = 0;
        for (int seen = 0; seen < codePoints; seen += 1)
        {
            offset += char.IsHighSurrogate(value[offset]) && offset + 1 < value.Length ? 2 : 1;
        }
        return offset;
    }

    /* ───────────────────────── встроенные формы ───────────────────────── */

    /// <summary>«длина»: строка в кодовых точках, список в элементах.</summary>
    public static Value BLength(Ctx ctx, Value value)
    {
        if (value.Tag == Value.TagString)
        {
            return Value.Number(CodePointLength(value.Str));
        }
        if (value.Tag == Value.TagList)
        {
            return Value.Number(Value.Size(value));
        }
        throw Fail(
            FlangError.CodeBuiltinArgs,
            "«длина»: ожидается строка или список, получено " + Value.TypeName(value));
    }

    /// <summary>«символ … в …». Индексация с 1 и включительно (SPEC, раздел 5).</summary>
    public static Value BChar(Ctx ctx, Value index, Value source)
    {
        double position = ExpectInteger("символ", index, "индекс");
        string value = ExpectString("символ", source, "строка");
        int length = CodePointLength(value);
        double at = position - ctx.IndexBase;
        if (at < 0 || at >= length)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«символ»: индекс " + Value.NumberText(position) + " вне строки длиной "
                    + length.ToString(CultureInfo.InvariantCulture));
        }
        int begin = OffsetOf(value, (int)at);
        int width = char.IsHighSurrogate(value[begin]) && begin + 1 < value.Length ? 2 : 1;
        return Value.Text(value.Substring(begin, width));
    }

    /// <summary>«подстрока … с … по …»: оба конца включительно при базе 1.</summary>
    public static Value BSubstring(Ctx ctx, Value source, Value fromValue, Value toValue)
    {
        string value = ExpectString("подстрока", source, "строка");
        double start = ExpectInteger("подстрока", fromValue, "начало");
        double end = ExpectInteger("подстрока", toValue, "конец");
        int length = CodePointLength(value);
        double begin = start - ctx.IndexBase;
        if (begin < 0 || begin > length)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«подстрока»: начало " + Value.NumberText(start) + " вне строки длиной "
                    + length.ToString(CultureInfo.InvariantCulture));
        }
        if (end < begin || end > length)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«подстрока»: конец " + Value.NumberText(end) + " вне диапазона ["
                    + Value.NumberText(start) + ", "
                    + length.ToString(CultureInfo.InvariantCulture) + "]");
        }
        int from = OffsetOf(value, (int)begin);
        int to = OffsetOf(value, (int)end);
        return Value.Text(value.Substring(from, to - from));
    }

    /// <summary>
    /// «соединить». Две формы: строка со строкой и список с разделителем.
    /// Различаются по типу первого аргумента, как в builtins.mjs.
    /// </summary>
    public static Value BJoin(Ctx ctx, Value left, Value right)
    {
        if (left.Tag == Value.TagList)
        {
            string separator = ExpectString("соединить", right, "разделитель");
            var output = new StringBuilder();
            for (int index = 0; index < Value.Size(left); index++)
            {
                Value item = Value.At(left, index);
                if (item.Tag != Value.TagString)
                {
                    throw Fail(
                        FlangError.CodeBuiltinArgs,
                        "«соединить»: элемент "
                            + (index + 1).ToString(CultureInfo.InvariantCulture)
                            + " списка должен быть строкой, получено " + Value.TypeName(item));
                }
                if (index > 0)
                {
                    output.Append(separator);
                }
                output.Append(item.Str);
            }
            return Value.Text(output.ToString());
        }
        string first = ExpectString("соединить", left, "первая строка");
        string second = ExpectString("соединить", right, "вторая строка");
        return Value.Text(first + second);
    }

    /// <summary>
    /// «разделить … по …».
    ///
    /// Поиск разделителя идёт по единицам UTF-16 и строго ordinal — ровно как
    /// String.prototype.split в интерпретаторе. Ordinal здесь обязателен:
    /// культурное сравнение в .NET умеет считать пустой строкой то, что ею не
    /// является, и находить «совпадения» там, где их нет.
    /// </summary>
    /// <summary>
    /// «символы»: разложение строки в список односимвольных строк.
    ///
    /// Идём по кодовым точкам, а не по char: символ вне BMP занимает две
    /// единицы UTF-16, и посимвольный обход разорвал бы суррогатную пару.
    /// </summary>
    public static Value BCharacters(Ctx ctx, Value source)
    {
        string value = ExpectString("символы", source, "строка");
        var points = new List<Value>();
        int index = 0;
        while (index < value.Length)
        {
            int width = char.IsHighSurrogate(value[index]) && index + 1 < value.Length ? 2 : 1;
            points.Add(Value.Text(value.Substring(index, width)));
            index += width;
        }
        return Value.List(points.ToArray());
    }

    /// <summary>«код символа»: кодовая точка первого символа строки.</summary>
    /// <remarks>
    /// char.ConvertToUtf32 собирает суррогатную пару в одну точку; value[0]
    /// отдал бы половину пары, и цель разошлась бы с эталоном на эмодзи.
    /// </remarks>
    public static Value BCharCode(Ctx ctx, Value source)
    {
        string value = ExpectString("код символа", source, "строка");
        if (value.Length == 0)
        {
            throw Fail(FlangError.CodeBuiltinArgs, "«код символа»: строка пуста");
        }
        return Value.Number(char.ConvertToUtf32(value, 0));
    }

    public static Value BSplit(Ctx ctx, Value source, Value separator)
    {
        string value = ExpectString("разделить", source, "строка");
        string mark = ExpectString("разделить", separator, "разделитель");
        if (mark.Length == 0)
        {
            throw Fail(FlangError.CodeBuiltinArgs, "«разделить»: разделитель не может быть пустым");
        }
        var parts = new List<Value>();
        int from = 0;
        for (; ; )
        {
            int found = value.IndexOf(mark, from, StringComparison.Ordinal);
            if (found < 0)
            {
                parts.Add(Value.Text(value.Substring(from)));
                break;
            }
            parts.Add(Value.Text(value.Substring(from, found - from)));
            from = found + mark.Length;
        }
        return Value.List(parts.ToArray());
    }

    /// <summary>«содержит»: подстрока в строке либо значение в списке.</summary>
    public static Value BContains(Ctx ctx, Value left, Value right)
    {
        if (left.Tag == Value.TagList)
        {
            for (int index = 0; index < Value.Size(left); index++)
            {
                if (Value.Equal(Value.At(left, index), right))
                {
                    return Value.True;
                }
            }
            return Value.False;
        }
        string value = ExpectString("содержит", left, "строка или список");
        string part = ExpectString("содержит", right, "искомая подстрока");
        return Value.Flag(value.Contains(part, StringComparison.Ordinal));
    }

    /// <summary>«начинается с».</summary>
    public static Value BStartsWith(Ctx ctx, Value source, Value prefix)
    {
        string value = ExpectString("начинается с", source, "строка");
        string start = ExpectString("начинается с", prefix, "префикс");
        return Value.Flag(value.StartsWith(start, StringComparison.Ordinal));
    }

    /// <summary>
    /// Пробел по правилам ECMAScript String.prototype.trim.
    ///
    /// Ни string.Trim(), ни char.IsWhiteSpace в .NET не годятся: последний
    /// считает пробелом U+0085 (NEL) и U+001C…U+001F, которых в наборе
    /// ECMAScript нет, и не считает U+FEFF, который там есть. Разошлись бы ровно
    /// на тех входах, ради которых «к числу» и проверяется.
    /// </summary>
    private static bool IsJsSpace(char symbol)
    {
        /* Коды записаны числами, а не литералами: половина этих знаков невидима,
           и литерал в исходнике нельзя ни прочитать, ни отличить от соседнего. */
        switch (symbol)
        {
            case '\t':          // U+0009 табуляция
            case '\n':          // U+000A перевод строки
            case (char)0x000B:  // вертикальная табуляция
            case '\f':          // U+000C перевод страницы
            case '\r':          // U+000D возврат каретки
            case ' ':           // U+0020 пробел
            case (char)0x00A0:  // неразрывный пробел
            case (char)0x1680:
            case (char)0x2028:  // разделитель строк
            case (char)0x2029:  // разделитель абзацев
            case (char)0x202F:
            case (char)0x205F:
            case (char)0x3000:
            case (char)0xFEFF:  // метка порядка байтов: в наборе ECMAScript есть
                return true;
            default:
                return symbol >= (char)0x2000 && symbol <= (char)0x200A;
        }
    }

    private static string TrimJs(string value)
    {
        int from = 0;
        int to = value.Length;
        while (from < to && IsJsSpace(value[from]))
        {
            from += 1;
        }
        while (to > from && IsJsSpace(value[to - 1]))
        {
            to -= 1;
        }
        return value.Substring(from, to - from);
    }

    /// <summary>
    /// Строгий разбор «к числу»: без Infinity, NaN, шестнадцатеричных и пустой
    /// строки, иначе форма молча превращает мусор в значение.
    ///
    /// Цифры перечислены явно диапазоном ASCII: char.IsDigit в .NET — это любая
    /// десятичная цифра Unicode (в том числе арабо-индийская), а регулярное
    /// выражение builtins.mjs стоит под флагом «u», где \d — только ASCII.
    /// </summary>
    private static bool LooksLikeNumber(string value)
    {
        int index = 0;
        int size = value.Length;
        if (index < size && (value[index] == '+' || value[index] == '-'))
        {
            index += 1;
        }
        int before = 0;
        while (index < size && value[index] >= '0' && value[index] <= '9')
        {
            index += 1;
            before += 1;
        }
        int after = 0;
        if (index < size && value[index] == '.')
        {
            index += 1;
            while (index < size && value[index] >= '0' && value[index] <= '9')
            {
                index += 1;
                after += 1;
            }
            /* «1.» и «.» недопустимы: после точки обязана быть хотя бы одна
               цифра, а «.5» допустимо именно потому, что цифры есть после
               точки. */
            if (after == 0)
            {
                return false;
            }
        }
        if (before == 0 && after == 0)
        {
            return false;
        }
        if (index < size && (value[index] == 'e' || value[index] == 'E'))
        {
            index += 1;
            if (index < size && (value[index] == '+' || value[index] == '-'))
            {
                index += 1;
            }
            int digits = 0;
            while (index < size && value[index] >= '0' && value[index] <= '9')
            {
                index += 1;
                digits += 1;
            }
            if (digits == 0)
            {
                return false;
            }
        }
        return index == size;
    }

    /// <summary>«к числу».</summary>
    public static Value BToNumber(Ctx ctx, Value source)
    {
        string value = ExpectString("к числу", source, "строка");
        string trimmed = TrimJs(value);
        if (!LooksLikeNumber(trimmed))
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«к числу»: строка " + Value.QuoteJson(value) + " не является числом");
        }
        /* Переполнение (1e999) даёт ±Infinity и ловится следующей проверкой:
           текст разобран, но конечным числом не является. Инвариантная культура
           обязательна — иначе разделителем дробной части оказалась бы запятая. */
        if (!double.TryParse(trimmed, NumberStyles.Float, CultureInfo.InvariantCulture, out double result))
        {
            /* .NET до 3.0 бросал OverflowException вместо ±Infinity; TryParse
               возвращает false. Для нас это «не конечное число». */
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«к числу»: строка " + Value.QuoteJson(value) + " не является конечным числом");
        }
        if (double.IsNaN(result) || double.IsInfinity(result))
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«к числу»: строка " + Value.QuoteJson(value) + " не является конечным числом");
        }
        return Value.Number(result);
    }

    /// <summary>
    /// «к числу или беда»: отказ, ставший значением.
    ///
    /// Обоснование формы — в builtins.mjs, раздел «отказ, ставший значением».
    /// Разбор не повторяется, а переиспользуется: тексты обязаны совпасть с
    /// интерпретатором, и единственный способ гарантировать это — один разбор
    /// на обе формы. Отказать эта форма не может вовсе.
    /// </summary>
    public static Value BToNumberOrFailure(Ctx ctx, Value source)
    {
        try
        {
            return Value.Variant("Разобрано", new[] { new Field("значение", BToNumber(ctx, source)) });
        }
        catch (FlangError failure)
        {
            return Value.Variant(
                "Не разобрано",
                new[]
                {
                    new Field("код", Value.Text(failure.Code)),
                    new Field("сообщение", Value.Text(failure.Text)),
                });
        }
    }

    /// <summary>
    /// «к строке». Признак печатается по-русски («да»/«нет»), «ничто» — словом
    /// «ничто»: поверхность языка русская, и кодогенераторы обязаны это
    /// повторять, а не печатать true/false (SPEC, раздел 5).
    /// </summary>
    public static Value BToString(Ctx ctx, Value value)
    {
        switch (value.Tag)
        {
            case Value.TagString:
                return value;
            case Value.TagNumber:
                return Value.Text(Value.NumberText(value.Num));
            case Value.TagFlag:
                return Value.Text(value.Bit ? "да" : "нет");
            case Value.TagNothing:
                return Value.Text("ничто");
            default:
                throw Fail(
                    FlangError.CodeBuiltinArgs,
                    "«к строке»: ожидается скаляр, получено " + Value.TypeName(value));
        }
    }

    /// <summary>«пусто».</summary>
    public static Value BEmpty(Ctx ctx, Value value)
    {
        if (value.Tag == Value.TagList)
        {
            return Value.Flag(Value.Size(value) == 0);
        }
        if (value.Tag == Value.TagString)
        {
            return Value.Flag(value.Str.Length == 0);
        }
        throw Fail(
            FlangError.CodeBuiltinArgs,
            "«пусто»: ожидается строка или список, получено " + Value.TypeName(value));
    }

    /// <summary>«голова».</summary>
    public static Value BHead(Ctx ctx, Value value)
    {
        Value list = ExpectList("голова", value, "аргумент");
        if (Value.Size(list) == 0)
        {
            throw Fail(FlangError.CodeBuiltinArgs, "«голова»: список пуст");
        }
        return Value.At(list, 0);
    }

    /// <summary>
    /// «хвост». Копирует, как и в JS: список flang — массив, а массив нельзя
    /// разделить с суффиксом без копирования. Значит рекурсия «голова и хвост»
    /// по длинному списку квадратична, ровно как у интерпретатора.
    /// </summary>
    public static Value BTail(Ctx ctx, Value value)
    {
        Value list = ExpectList("хвост", value, "аргумент");
        if (Value.Size(list) == 0)
        {
            throw Fail(FlangError.CodeBuiltinArgs, "«хвост»: список пуст");
        }
        var next = new Value[Value.Size(list) - 1];
        Array.Copy(list.Items, 1, next, 0, next.Length);
        return Value.List(next);
    }

    /// <summary>
    /// «элемент N в СПИСОК». Список flang здесь — массив, поэтому N-й элемент
    /// стоит того же, что первый: обхода нет. Границы и текст отказа повторяют
    /// вычислитель дословно — их сверяет дифференциальная проверка.
    /// </summary>
    public static Value BElement(Ctx ctx, Value index, Value value)
    {
        double position = ExpectInteger("элемент", index, "индекс");
        Value list = ExpectList("элемент", value, "список");
        int length = Value.Size(list);
        double at = position - ctx.IndexBase;
        if (at < 0 || at >= length)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«элемент»: индекс " + Value.NumberText(position) + " вне списка длиной "
                    + length.ToString(CultureInfo.InvariantCulture));
        }
        return Value.At(list, (int)at);
    }

    /// <summary>
    /// «добавить … к …»: дописывает в конец, исходный список не меняется.
    ///
    /// За постоянное время, когда ячейка за концом ещё ничья, и копией во всех
    /// остальных случаях. Разбор приёма и доказательство неизменяемости лежат
    /// при классе Value.Grow; тот же приём и по той же причине стоит в
    /// рантаймах C (fl_b_dobavit), Rust (Items::grown), Go (BAppend) и Java.
    ///
    /// Прежняя безусловная копия была ВЕРНА, но стоила O(длины) за вызов, а
    /// значит накопление списка n вызовами — O(n²). Шаг напечатанного кода —
    /// вход в функцию, и если один шаг стоит O(длины), предел шагов не
    /// ограничивает работу ничем: точка «Строить скобки» от 42 и 0 и 0 и "" и []
    /// при объявленных 5 000 000 шагов упиралась в предел 273 с вместо секунды.
    ///
    /// Просто дописать в общий массив нельзя: два «добавить» от одного значения
    /// заняли бы одну ячейку и испортили бы друг друга. Разрешение спрашивается
    /// у Grow, а не у длины массива.
    /// </summary>
    public static Value BAppend(Ctx ctx, Value item, Value value)
    {
        Value list = ExpectList("добавить", value, "второй аргумент");
        int end = Value.Size(list);
        Value.Grow? spare = list.Spare;
        if (spare is not null && end == spare.Filled && end < list.Items.Length)
        {
            list.Items[end] = item;
            spare.Filled = end + 1;
            return Value.Grown(list.Items, end + 1, spare);
        }
        /* Копия — с запасом, чтобы следующие «добавить» шли уже на месте. Запас
           равен длине, то есть массив удваивается: за n «добавить»
           перевыделений log₂n, а не n. У самого края int запаса брать не из
           чего — там продление идёт впритык, и следующее «добавить» снова
           копирует. */
        int capacity = end < (int.MaxValue - 8) / 2 ? 2 * (end + 1) : end + 1;
        var cells = new Value[capacity];
        Array.Copy(list.Items, cells, end);
        cells[end] = item;
        return Value.Grown(cells, end + 1, new Value.Grow(end + 1));
    }

    /// <summary>«остаток от».</summary>
    public static Value BRemainder(Ctx ctx, Value left, Value right)
    {
        double a = ExpectNumber("остаток от", left, "делимое");
        double b = ExpectNumber("остаток от", right, "делитель");
        return Value.Number(a % b);
    }

    /// <summary>«процентов от»: (процент / 100) * значение, порядок ядра.</summary>
    public static Value BPercentOf(Ctx ctx, Value left, Value right)
    {
        double a = ExpectNumber("процентов от", left, "процент");
        double b = ExpectNumber("процентов от", right, "значение");
        return Value.Number((a / 100) * b);
    }
}
