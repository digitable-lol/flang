// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

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
            // Поле СУММЫ ИЗ ОДНОГО ВАРИАНТА. Что вариант ровно один, проверила проверка типов, поэтому сюда приезжает значение, у которого поле есть. Отказ ниже остаётся прежним: он про сумму из двух и более.
            Value? inVariant = Value.Lookup(target.Fields, name);
            if (inVariant is not null)
            {
                return inVariant;
            }
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

    /// <summary>Значение предусловия: обязано быть признаком.</summary>
    /// <remarks>
    /// Отдельно от <see cref="Post"/>, а не тот же помощник со вторым текстом:
    /// слова отказа дословно те же, что у интерпретатора (checkPreconditions в
    /// flang/src/interpret.mjs), и одно сообщение на две разные вещи разошлось
    /// бы молча. Зовёт это ТОЛЬКО дверь программы — вызов по имени (Call):
    /// внутри программы предусловие снял вызывающий на проверке.
    /// </remarks>
    public static bool Pre(Ctx ctx, Value value, string property, string function)
    {
        if (value.Tag != Value.TagFlag)
        {
            throw Fail(
                FlangError.CodeType,
                "предусловие «" + property + "» функции «" + function
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

    /// <summary>
    /// Сойдутся ли на стыке двух строк высокая и низкая половины суррогатной
    /// пары. В UTF-16 они слились бы в ОДИН знак: два знака на входе, один на
    /// выходе, — и всякое утверждение о длине склейки стало бы ложным.
    /// </summary>
    private static bool PairSplits(string left, string right)
    {
        if (left.Length == 0 || right.Length == 0)
        {
            return false;
        }
        return char.IsHighSurrogate(left[left.Length - 1]) && char.IsLowSurrogate(right[0]);
    }

    /// <summary>
    /// Отказ на стыке, где склейка слила бы два знака в один. Отказ, а не тихая
    /// порча: показать разницу это представление не может. У целей, где строка —
    /// UTF-8 или последовательность кодовых точек, такого стыка не бывает вовсе.
    /// </summary>
    private static void GlueCheck(string left, string right)
    {
        if (PairSplits(left, right))
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«соединить»: на стыке сошлись половины суррогатной пары — два знака слились бы в один");
        }
    }

    /// <summary>
    /// Разорван ли край подстроки: начинается низкой половиной суррогатной пары
    /// или кончается высокой. Вхождение способно разрезать знак пополам ТОЛЬКО у
    /// такой подстроки — значит у всякой другой обычный поиск по единицам UTF-16
    /// уже считает знаки, и обходить строку незачем.
    /// </summary>
    private static bool IsTorn(string part)
    {
        if (part.Length == 0)
        {
            return false;
        }
        return char.IsLowSurrogate(part[0]) || char.IsHighSurrogate(part[part.Length - 1]);
    }

    /// <summary>Стоит ли позиция на границе знака, а не в середине пары.</summary>
    private static bool IsBoundary(string text, int at)
    {
        if (at <= 0 || at >= text.Length)
        {
            return true;
        }
        return !char.IsLowSurrogate(text[at]) || !char.IsHighSurrogate(text[at - 1]);
    }

    /// <summary>Первое вхождение, не разрезающее знак ни началом, ни концом.</summary>
    private static int FindAligned(string text, string part, int from)
    {
        for (int at = text.IndexOf(part, from, StringComparison.Ordinal);
             at >= 0;
             at = text.IndexOf(part, at + 1, StringComparison.Ordinal))
        {
            if (IsBoundary(text, at) && IsBoundary(text, at + part.Length))
            {
                return at;
            }
        }
        return -1;
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
        GlueCheck(left.Str, right.Str);
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
    ///
    /// Пару делает ПАРОЙ соседство, а не одна половина. Считать «всё, что не
    /// низкая половина» — значит терять ОДИНОКУЮ низкую половину: она кодовая
    /// точка не хуже прочих, а счёт отдавал её за ноль. Ровно на этом «длина» и
    /// «разложить … на символы» расходились внутри одной цели: «длина "\uDE00"»
    /// давала 0, а список символов — один элемент. Мера у всех форм над строкой
    /// одна, и держит её здесь PointWidth: две единицы — только когда высокая
    /// половина стоит перед низкой.
    /// </summary>
    public static int CodePointLength(string value)
    {
        int count = 0;
        for (int index = 0; index < value.Length; index += PointWidth(value, index))
        {
            count += 1;
        }
        return count;
    }

    /// <summary>
    /// Ширина кодовой точки в единицах UTF-16, начиная с позиции index. Две —
    /// только у настоящей суррогатной пары: высокая половина, за которой стоит
    /// низкая. Одинокая половина — точка шириной в одну единицу.
    /// </summary>
    public static int PointWidth(string value, int index) =>
        char.IsHighSurrogate(value[index]) && index + 1 < value.Length
            && char.IsLowSurrogate(value[index + 1])
            ? 2
            : 1;

    /// <summary>Смещение в единицах UTF-16 по номеру кодовой точки.</summary>
    private static int OffsetOf(string value, int codePoints)
    {
        int offset = 0;
        for (int seen = 0; seen < codePoints; seen += 1)
        {
            offset += PointWidth(value, offset);
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
        return Value.Text(value.Substring(begin, PointWidth(value, begin)));
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
            string tail = string.Empty;
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
                    GlueCheck(tail, separator);
                    if (separator.Length != 0)
                    {
                        tail = separator;
                    }
                    output.Append(separator);
                }
                GlueCheck(tail, item.Str);
                if (item.Str.Length != 0)
                {
                    tail = item.Str;
                }
                output.Append(item.Str);
            }
            return Value.Text(output.ToString());
        }
        string first = ExpectString("соединить", left, "первая строка");
        string second = ExpectString("соединить", right, "вторая строка");
        GlueCheck(first, second);
        return Value.Text(first + second);
    }

    /// <summary>
    /// «разделить … по …».
    ///
    /// Поиск идёт по единицам UTF-16 и строго ordinal, пока у разделителя целые
    /// края: у такого совпадение в UTF-16 и совпадение по кодовым точкам — одно
    /// и то же. Разорванный половиной суррогатной пары край требует поиска,
    /// пропускающего вхождения, которые разрезали бы знак. Ordinal обязателен:
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
            int width = PointWidth(value, index);
            points.Add(Value.Text(value.Substring(index, width)));
            index += width;
        }
        return Value.List(points.ToArray());
    }

    /// <summary>«код символа»: кодовая точка первого символа строки.</summary>
    /// <remarks>
    /// char.ConvertToUtf32 собирает суррогатную пару в одну точку; value[0]
    /// отдал бы половину пары, и цель разошлась бы со свидетелем на эмодзи.
    ///
    /// Зовётся он только на НАСТОЯЩЕЙ паре. На одинокой половине он бросает
    /// ArgumentException, и та уезжала наружу сырым английским текстом .NET под
    /// кодом «CLI», тогда как остальные цели отвечали числом половины. Первая
    /// единица одинокой половины и есть её кодовая точка — «длина» такой строки
    /// уже считает её за один знак, и «код символа» обязан считать так же.
    /// </remarks>
    public static Value BCharCode(Ctx ctx, Value source)
    {
        string value = ExpectString("код символа", source, "строка");
        if (value.Length == 0)
        {
            throw Fail(FlangError.CodeBuiltinArgs, "«код символа»: строка пуста");
        }
        return Value.Number(PointWidth(value, 0) == 2 ? char.ConvertToUtf32(value, 0) : value[0]);
    }

    /// <summary>«символ по коду»: строка ровно из одного символа.</summary>
    /// <remarks>
    /// char.ConvertFromUtf32 — обратная к ConvertToUtf32, которой считает
    /// BCharCode: точка за основной плоскостью разворачивается в суррогатную
    /// пару внутри строки, а «длина» flang считает её одним символом. Суррогат
    /// отвергается явно, хотя строка C# его хранить умеет: в четырёх целях
    /// печати из восьми строка — UTF-8, и половины пары там нет.
    /// </remarks>
    public static Value BCharFromCode(Ctx ctx, Value code)
    {
        double point = ExpectInteger("символ по коду", code, "код");
        if (point < 0 || point > 1114111)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«символ по коду»: код " + Value.NumberText(point) + " вне диапазона Unicode [0, 1114111]");
        }
        if (point >= 55296 && point <= 57343)
        {
            throw Fail(
                FlangError.CodeBuiltinArgs,
                "«символ по коду»: код " + Value.NumberText(point) + " — половина суррогатной пары, а не символ");
        }
        return Value.Text(char.ConvertFromUtf32((int)point));
    }

    /// <summary>«хеш256»: SHA-256 байтов строки шестнадцатеричной записью.</summary>
    /// <remarks>
    /// Берётся System.Security.Cryptography.SHA256 — он лежит в самом
    /// фреймворке, то есть своей зависимости не приносит; восьмая рукописная
    /// копия FIPS 180-4 была бы восьмым местом, где можно ошибиться
    /// поодиночке. Строка C# — UTF-16, поэтому байты берутся явной кодировкой
    /// UTF-8: ровно те же, что хеширует C, и оттого отпечаток совпадает с
    /// sha256sum и с прочими восемью целями знак в знак.
    /// </remarks>
    public static Value BHash256(Ctx ctx, Value text)
    {
        string body = ExpectString("хеш256", text, "строка");
        byte[] svod = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(body));
        StringBuilder outText = new StringBuilder(64);
        foreach (byte one in svod)
        {
            outText.Append(one.ToString("x2", CultureInfo.InvariantCulture));
        }
        return Value.Text(outText.ToString());
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
        bool torn = IsTorn(mark);
        int from = 0;
        for (; ; )
        {
            int found = torn
                ? FindAligned(value, mark, from)
                : value.IndexOf(mark, from, StringComparison.Ordinal);
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
        if (!IsTorn(part))
        {
            return Value.Flag(value.Contains(part, StringComparison.Ordinal));
        }
        return Value.Flag(FindAligned(value, part, 0) >= 0);
    }

    /// <summary>«начинается с».</summary>
    public static Value BStartsWith(Ctx ctx, Value source, Value prefix)
    {
        string value = ExpectString("начинается с", source, "строка");
        string start = ExpectString("начинается с", prefix, "префикс");
        if (!value.StartsWith(start, StringComparison.Ordinal))
        {
            return Value.False;
        }
        return Value.Flag(!IsTorn(start) || IsBoundary(value, start.Length));
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

    /* ── Доказанный путь четырёх форм: то же без сторожа частичности ────────
     *
     * Частичная форма отказывает не всегда, а на пустом. Там, где непустота
     * ДОКАЗАНА проверкой типов (flang/src/types.mjs, «длинаНиз»), узел
     * приезжает с отметкой «доказана», и печать зовёт эти методы. Сверка типа
     * остаётся: ExpectList ловит не пустоту, а другой вид значения. */

    /// <summary>«разделить … по …» с доказанно непустым разделителем.</summary>
    public static Value BSplitProven(Ctx ctx, Value source, Value separator)
    {
        string value = ExpectString("разделить", source, "строка");
        string mark = ExpectString("разделить", separator, "разделитель");
        var parts = new List<Value>();
        bool torn = IsTorn(mark);
        int from = 0;
        for (; ; )
        {
            int found = torn
                ? FindAligned(value, mark, from)
                : value.IndexOf(mark, from, StringComparison.Ordinal);
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

    /// <summary>«код символа» доказанно непустой строки.</summary>
    /// <remarks>Пара собирается ConvertToUtf32, одинокая половина отдаётся сама
    /// собой — ровно как в BCharCode: доказанная непустота снимает проверку на
    /// пустоту, а не меру, которой считается первая кодовая точка.</remarks>
    public static Value BCharCodeProven(Ctx ctx, Value source)
    {
        string value = ExpectString("код символа", source, "строка");
        return Value.Number(PointWidth(value, 0) == 2 ? char.ConvertToUtf32(value, 0) : value[0]);
    }

    /// <summary>«голова» доказанно непустого списка.</summary>
    public static Value BHeadProven(Ctx ctx, Value value)
    {
        Value list = ExpectList("голова", value, "аргумент");
        // Ветвь пустого списка недостижима — непустота доказана при печати; читается
        // нулевой элемент тем же способом, что в BHead, чтобы у двух дорог не
        // разошлось представление списка.
        return Value.Size(list) == 0 ? Value.Nothing() : Value.At(list, 0);
    }

    /// <summary>«хвост» доказанно непустого списка.</summary>
    public static Value BTailProven(Ctx ctx, Value value)
    {
        Value list = ExpectList("хвост", value, "аргумент");
        int n = Value.Size(list);
        var next = new Value[n == 0 ? 0 : n - 1];
        if (n > 0)
        {
            Array.Copy(list.Items, 1, next, 0, next.Length);
        }
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

    /// <summary>
    /// «приписать … к …»: тот же список с элементом впереди.
    ///
    /// Копирует по той же причине, что <c>BAppend</c>, и постоянного времени
    /// здесь быть не может: список — массив <c>Value[]</c>, ячейки ПЕРЕД началом
    /// у него нет, а запасом ёмкости в общем массиве пришлось бы кому-то владеть,
    /// тогда как значение flang по договору неизменяемо и разделяемо.
    ///
    /// Копия при этом ОДНА на вызов, а не одна на элемент, как у свёртки, которой
    /// приписывание в начало писали до появления формы. Цена по всем восьми
    /// целям — в SPEC, раздел «Стоимость встроенных форм».
    /// </summary>
    public static Value BPrepend(Ctx ctx, Value item, Value value)
    {
        Value list = ExpectList("приписать", value, "второй аргумент");
        int size = Value.Size(list);
        var next = new Value[size + 1];
        next[0] = item;
        Array.Copy(list.Items, 0, next, 1, size);
        return Value.Grown(next, size + 1, new Value.Grow(size + 1));
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

    // ───────────────────────────── граница входа ─────────────────────────────
    //
    // Объявленные типы параметров — ДАННЫМИ. Прогонщик сверяет по ним значения,
    // пришедшие снаружи, ДО вызова функции.
    //
    // Зачем это здесь, а не в самих функциях. Доказательство завершения
    // `тотальной` стоит НА ТИПЕ: у `неотрицательное` есть дно 0 и потолок 2^53−1, ниже
    // которого `н минус 1` точно меньше `н`, и сторож убывания в такую функцию
    // не печатается вовсе. Значение вне типа выносит вместе с типом и
    // доказательство: `1e300 минус 1` равно `1e300`, цепочка вечна, а ловить её
    // нечем. Дверь одна и стоит она ДО вычисления.
    //
    // Таблицу печатает бэкенд вместе с программой (`Entry`), а строит её
    // `flang/src/types.mjs` (`таблицаВхода`) — тем же пониманием слов «значение
    // подходит типу», каким сверяется `flang run --args`.

    /// <summary>Не сверяется: значение-функция, параметр полиморфизма, применение типа.</summary>
    public const int TypeUnknown = 0;
    /// <summary>Число, включая уточнения `неотрицательное` и `целое`.</summary>
    public const int TypeNumber = 1;
    /// <summary>Строка.</summary>
    public const int TypeText = 2;
    /// <summary>Признак.</summary>
    public const int TypeFlag = 3;
    /// <summary>«ничто».</summary>
    public const int TypeNull = 4;
    /// <summary>Список.</summary>
    public const int TypeList = 5;
    /// <summary>Запись.</summary>
    public const int TypeRecord = 6;
    /// <summary>Сумма типов.</summary>
    public const int TypeSum = 7;

    /// <summary>Поле записи или варианта: имя и место его типа в таблице типов.</summary>
    public readonly struct TypeField
    {
        /// <summary>Имя поля в исходной программе flang.</summary>
        public readonly string Name;

        /// <summary>Индекс типа поля в таблице типов.</summary>
        public readonly int Type;

        /// <summary>Собирает описание поля.</summary>
        public TypeField(string name, int type)
        {
            Name = name;
            Type = type;
        }
    }

    /// <summary>Вариант суммы: имя дискриминанта и отрезок его полей.</summary>
    public readonly struct TypeVariant
    {
        /// <summary>Имя варианта.</summary>
        public readonly string Name;

        /// <summary>Начало отрезка полей в общем массиве.</summary>
        public readonly int FieldFrom;

        /// <summary>Длина отрезка полей.</summary>
        public readonly int FieldCount;

        /// <summary>Собирает описание варианта.</summary>
        public TypeVariant(string name, int fieldFrom, int fieldCount)
        {
            Name = name;
            FieldFrom = fieldFrom;
            FieldCount = fieldCount;
        }
    }

    /// <summary>
    /// Объявленный тип. Поля и варианты лежат сплошными отрезками общих
    /// массивов, а тип называет своё начало и длину.
    /// </summary>
    public readonly struct TypeSpec
    {
        /// <summary>Вид типа.</summary>
        public readonly int Kind;

        /// <summary>Печатное имя типа: «неотрицательное», «список числа».</summary>
        public readonly string Name;

        /// <summary>Имя записи или суммы без кавычек — для текстов о полях.</summary>
        public readonly string Owner;

        /// <summary>«… или ничто»: отсутствие значения законно.</summary>
        public readonly bool Optional;

        /// <summary>Целое ли.</summary>
        public readonly bool Integral;

        /// <summary>Есть ли конечный отрезок (у `число` его нет).</summary>
        public readonly bool Bounded;

        /// <summary>Нижняя граница отрезка.</summary>
        public readonly double Low;

        /// <summary>Верхняя граница отрезка.</summary>
        public readonly double High;

        /// <summary>Тип элемента списка.</summary>
        public readonly int Of;

        /// <summary>Начало отрезка полей записи.</summary>
        public readonly int FieldFrom;

        /// <summary>Длина отрезка полей записи.</summary>
        public readonly int FieldCount;

        /// <summary>Начало отрезка вариантов.</summary>
        public readonly int VariantFrom;

        /// <summary>Длина отрезка вариантов.</summary>
        public readonly int VariantCount;

        /// <summary>Собирает описание типа.</summary>
        public TypeSpec(
            int kind,
            string name,
            string owner,
            bool optional,
            bool integral,
            bool bounded,
            double low,
            double high,
            int of,
            int fieldFrom,
            int fieldCount,
            int variantFrom,
            int variantCount)
        {
            Kind = kind;
            Name = name;
            Owner = owner;
            Optional = optional;
            Integral = integral;
            Bounded = bounded;
            Low = low;
            High = high;
            Of = of;
            FieldFrom = fieldFrom;
            FieldCount = fieldCount;
            VariantFrom = variantFrom;
            VariantCount = variantCount;
        }
    }

    /// <summary>Параметр функции: чей он, как называется и какого он типа.</summary>
    public readonly struct EntryParam
    {
        /// <summary>Имя функции flang.</summary>
        public readonly string Function;

        /// <summary>Имя параметра.</summary>
        public readonly string Name;

        /// <summary>Индекс типа в таблице типов.</summary>
        public readonly int Type;

        /// <summary>Собирает описание параметра.</summary>
        public EntryParam(string function, string name, int type)
        {
            Function = function;
            Name = name;
            Type = type;
        }
    }

    /// <summary>Граница входа программы целиком.</summary>
    public sealed class EntryTable
    {
        /// <summary>Объявленные типы.</summary>
        public readonly TypeSpec[] Types;

        /// <summary>Поля записей и вариантов, сплошным массивом.</summary>
        public readonly TypeField[] Fields;

        /// <summary>Варианты сумм, сплошным массивом.</summary>
        public readonly TypeVariant[] Variants;

        /// <summary>Параметры функций в объявленном порядке.</summary>
        public readonly EntryParam[] Params;

        /// <summary>Собирает границу входа.</summary>
        public EntryTable(TypeSpec[] types, TypeField[] fields, TypeVariant[] variants, EntryParam[] parameters)
        {
            Types = types;
            Fields = fields;
            Variants = variants;
            Params = parameters;
        }
    }

    private static void CheckNumberType(TypeSpec spec, Value value, string label)
    {
        if (value.Tag != Value.TagNumber || double.IsNaN(value.Num) || double.IsInfinity(value.Num))
        {
            throw Fail(FlangError.CodeType, label + " не соответствует типу " + spec.Name);
        }
        // Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
        // порядок, и второй отказ на одном значении был бы вторым текстом про
        // одну беду.
        if (spec.Integral && System.Math.Floor(value.Num) != value.Num)
        {
            throw Fail(
                FlangError.CodeType,
                label + ": " + Value.NumberText(value.Num) + " не целое, а тип " + spec.Name + " — целый");
        }
        if (spec.Bounded && (value.Num < spec.Low || value.Num > spec.High))
        {
            throw Fail(
                FlangError.CodeType, label + ": " + Value.NumberText(value.Num) + " вне " + spec.Name);
        }
    }

    private static void CheckFields(
        EntryTable table, int from, int count, Field[] given, string label, string owner, bool ofVariant)
    {
        for (int index = 0; index < count; index++)
        {
            TypeField declared = table.Fields[from + index];
            int found = -1;
            for (int at = 0; at < given.Length; at++)
            {
                if (given[at].Name == declared.Name)
                {
                    found = at;
                    break;
                }
            }
            if (found < 0)
            {
                // Необязательное поле можно не задавать: отсутствие — это «ничто».
                if (table.Types[declared.Type].Optional)
                {
                    continue;
                }
                if (ofVariant)
                {
                    throw Fail(
                        FlangError.CodeType,
                        label + ": вариант «" + owner + "» требует поле «" + declared.Name + "»");
                }
                throw Fail(
                    FlangError.CodeType,
                    label + ": не задано поле «" + declared.Name + "» записи «" + owner + "»");
            }
            CheckTyped(table, declared.Type, given[found].Value, label + "." + declared.Name);
        }
    }

    private static void CheckTyped(EntryTable table, int index, Value value, string label)
    {
        if (index < 0 || index >= table.Types.Length)
        {
            return;
        }
        TypeSpec spec = table.Types[index];
        // Необязательный аргумент можно не задавать: отсутствие — это «ничто», а
        // не пропуск. Так же считает и ядро FTS.
        if (spec.Optional && value.Tag == Value.TagNothing)
        {
            return;
        }
        string mismatch = label + " не соответствует типу " + spec.Name;
        switch (spec.Kind)
        {
            case TypeNumber:
                CheckNumberType(spec, value, label);
                return;
            case TypeText:
                if (value.Tag != Value.TagString)
                {
                    throw Fail(FlangError.CodeType, mismatch);
                }
                return;
            case TypeFlag:
                if (value.Tag != Value.TagFlag)
                {
                    throw Fail(FlangError.CodeType, mismatch);
                }
                return;
            case TypeNull:
                if (value.Tag != Value.TagNothing)
                {
                    throw Fail(FlangError.CodeType, mismatch);
                }
                return;
            case TypeList:
                if (value.Tag != Value.TagList)
                {
                    throw Fail(FlangError.CodeType, mismatch);
                }
                for (int at = 0; at < value.Items.Length; at++)
                {
                    CheckTyped(table, spec.Of, value.Items[at], label + "[" + at + "]");
                }
                return;
            case TypeRecord:
                if (value.Tag != Value.TagRecord)
                {
                    throw Fail(FlangError.CodeType, mismatch);
                }
                CheckFields(table, spec.FieldFrom, spec.FieldCount, value.Fields, label, spec.Owner, false);
                // Лишнее поле — тоже несоответствие типу: запись flang тотальна,
                // и поля сверх объявленных в ней взяться неоткуда.
                foreach (Field field in value.Fields)
                {
                    bool declared = false;
                    for (int at = 0; at < spec.FieldCount; at++)
                    {
                        if (table.Fields[spec.FieldFrom + at].Name == field.Name)
                        {
                            declared = true;
                            break;
                        }
                    }
                    if (!declared)
                    {
                        throw Fail(
                            FlangError.CodeType,
                            label + ": запись «" + spec.Owner + "» не имеет поля «" + field.Name + "»");
                    }
                }
                return;
            case TypeSum:
                if (value.Tag != Value.TagVariant && value.Tag != Value.TagRecord)
                {
                    throw Fail(FlangError.CodeType, mismatch);
                }
                int variant = -1;
                if (value.Tag == Value.TagVariant)
                {
                    for (int at = 0; at < spec.VariantCount; at++)
                    {
                        if (table.Variants[spec.VariantFrom + at].Name == value.Str)
                        {
                            variant = spec.VariantFrom + at;
                            break;
                        }
                    }
                }
                if (variant < 0)
                {
                    throw Fail(
                        FlangError.CodeType, label + ": ожидался вариант типа «" + spec.Owner + "»");
                }
                CheckFields(
                    table,
                    table.Variants[variant].FieldFrom,
                    table.Variants[variant].FieldCount,
                    value.Fields,
                    label,
                    table.Variants[variant].Name,
                    true);
                return;
            default:
                // TypeUnknown: сверять нечем, и молчание здесь то же самое, каким
                // отвечает проверка значений свидетеля на джокер.
                return;
        }
    }

    /// <summary>
    /// Сверка набора значений с объявленными типами параметров функции.
    /// Молчит там, где сверять нечем: имени в таблице нет, число значений с
    /// числом параметров не сошлось (об этом скажет диспетчер своим текстом),
    /// тип приехал видом TypeUnknown. Тексты отказов дословно те же, что у
    /// <c>checkValue</c> свидетеля.
    /// </summary>
    public static void CheckEntry(EntryTable table, string name, Value[] args)
    {
        int declared = 0;
        foreach (EntryParam param in table.Params)
        {
            if (param.Function == name)
            {
                declared++;
            }
        }
        if (declared == 0 || declared != args.Length)
        {
            return;
        }
        int at = 0;
        foreach (EntryParam param in table.Params)
        {
            if (param.Function != name)
            {
                continue;
            }
            CheckTyped(
                table, param.Type, args[at], "вызов функции «" + name + "»: аргумент «" + param.Name + "»");
            at++;
        }
    }
}
