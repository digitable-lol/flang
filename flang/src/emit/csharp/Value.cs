// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Значение flang для бэкенда C#.
//
// ── class, а не struct ──────────────────────────────────────────────────────
// Соблазн сделать значение структурой велик: значения flang неизменяемы, живут
// недолго и передаются повсюду, а struct не грузит сборщик мусора. Но здесь он
// неисполним, и по трём причинам сразу.
//
//   1. У struct всегда есть состояние по умолчанию — все поля в нулях, — и
//      никакого способа его запретить в C# нет. default(Value) получил бы тег
//      TAG_NOTHING с null-строкой и null-массивами: значение, которое выглядит
//      как «ничто», но роняет всё, что его прочитает. Класс такого состояния не
//      имеет вовсе: есть ссылка на построенное значение либо null, и null здесь
//      запрещён включённым nullable-контекстом.
//   2. Структура с шестью полями (тег, double, bool, строка, два массива) — это
//      около сорока байт, копируемых при каждой передаче параметра и каждом
//      присваивании. Напечатанный код передаёт значения десятками тысяч раз за
//      вызов; ссылка в восемь байт дешевле копии в сорок, а короткоживущие
//      объекты нулевого поколения GC собирает почти даром.
//   3. Значения рекурсивны по построению: список содержит значения, запись
//      содержит поля. Структура, содержащая массив структур, всё равно уходит в
//      кучу за самим массивом, поэтому «без кучи» не получилось бы и так.
//
// ── Нет union-типов ────────────────────────────────────────────────────────
// Выразить «Скаляр | Список | Запись | Вариант» (SPEC, раздел 2) в C# нечем.
// Иерархия классов с абстрактным Value и семью наследниками дала бы семь типов,
// между которыми напечатанный код всё равно ходил бы через `is` — то есть через
// тот же тег, записанный дороже. Напечатанный код flang динамически
// типизирован: у переменной, которую разбор связал с полем варианта, статического
// типа нет ни в одной точке. Поэтому представление одно: тег плюс нагрузка, как
// в рантаймах Java, Python, Go и Rust.
//
// Суммы типов flang — значения с тегом Variant и дискриминантом-строкой, а не
// отдельные типы C#: дискриминант в flang именной, и литерал {variant, fields},
// приехавший из JSON, статического типа не имеет вовсе.
//
// ── double, а не decimal ───────────────────────────────────────────────────
// decimal в C# соблазнителен для предметной области, где считают деньги, но для
// flang он неверен трижды: это база 10 с 28 значащими цифрами, а не IEEE-754;
// в нём нет ни NaN, ни бесконечностей, а SPEC (раздел 5) требует, чтобы деление
// на ноль давало значение, а не исключение; и округление у него своё, отчего
// «0.1 плюс 0.2» дало бы ровно 0.3 — а в ядре FTS это ложь. Число flang —
// IEEE-754 double (SPEC, раздел 2), и double в C# ровно он же.
//
// ── Строки в UTF-16 ────────────────────────────────────────────────────────
// string в C# — последовательность единиц UTF-16, а длина в flang считается в
// кодовых точках (SPEC, раздел 5). Для кириллицы разницы нет, для эмодзи —
// вдвое; поправка живёт в Flang.cs.
#nullable enable

using System;
using System.Globalization;
using System.Numerics;
using System.Text;

/// <summary>Значение flang: тег плюс полезная нагрузка.</summary>
public sealed class Value
{
    /// <summary>Виды значений (SPEC, раздел 2). Скаляры идут первыми.</summary>
    public const int TagNothing = 0;
    public const int TagNumber = 1;
    public const int TagFlag = 2;
    public const int TagString = 3;
    public const int TagList = 4;
    public const int TagRecord = 5;
    public const int TagVariant = 6;

    /// <summary>Вид значения.</summary>
    public readonly int Tag;

    /// <summary>Число; осмысленно только при TagNumber.</summary>
    public readonly double Num;

    /// <summary>Признак; осмысленен только при TagFlag.</summary>
    public readonly bool Bit;

    /// <summary>Строка либо имя варианта; у остальных видов пустая строка.</summary>
    public readonly string Str;

    /// <summary>Элементы списка; у остальных видов пустой массив.</summary>
    public readonly Value[] Items;

    /// <summary>Поля записи или варианта в порядке объявления.</summary>
    public readonly Field[] Fields;

    private static readonly Value[] NoItems = Array.Empty<Value>();
    private static readonly Field[] NoFields = Array.Empty<Field>();

    private Value(int tag, double num, bool bit, string str, Value[] items, Field[] fields)
    {
        Tag = tag;
        Num = num;
        Bit = bit;
        Str = str;
        Items = items;
        Fields = fields;
    }

    /// <summary>«ничто» — единственное на всю программу.</summary>
    public static readonly Value NothingValue =
        new Value(TagNothing, 0.0, false, "", NoItems, NoFields);

    /// <summary>Признак «да».</summary>
    public static readonly Value True = new Value(TagFlag, 0.0, true, "", NoItems, NoFields);

    /// <summary>Признак «нет».</summary>
    public static readonly Value False = new Value(TagFlag, 0.0, false, "", NoItems, NoFields);

    /// <summary>«ничто».</summary>
    public static Value Nothing() => NothingValue;

    /// <summary>Число. Всегда double: целых чисел в flang нет (SPEC, раздел 2).</summary>
    public static Value Number(double value) =>
        new Value(TagNumber, value, false, "", NoItems, NoFields);

    /// <summary>Признак.</summary>
    public static Value Flag(bool value) => value ? True : False;

    /// <summary>Строка.</summary>
    public static Value Text(string value) =>
        new Value(TagString, 0.0, false, value, NoItems, NoFields);

    /// <summary>Список. Массив переходит во владение и после этого не меняется.</summary>
    public static Value List(Value[] items) =>
        new Value(TagList, 0.0, false, "", items, NoFields);

    /// <summary>Пустой список без выделения памяти.</summary>
    public static Value EmptyList() => new Value(TagList, 0.0, false, "", NoItems, NoFields);

    /// <summary>Запись: поля в порядке объявления.</summary>
    public static Value Record(Field[] fields) =>
        new Value(TagRecord, 0.0, false, "", NoItems, fields);

    /// <summary>Запись без полей.</summary>
    public static Value EmptyRecord() => new Value(TagRecord, 0.0, false, "", NoItems, NoFields);

    /// <summary>Вариант суммы типов: дискриминант плюс поля.</summary>
    public static Value Variant(string name, Field[] fields) =>
        new Value(TagVariant, 0.0, false, name, NoItems, fields);

    /// <summary>Скаляр ли значение (строка, число, признак, ничто).</summary>
    public static bool IsScalar(Value value) => value.Tag <= TagString;

    /// <summary>Список ли значение.</summary>
    public static bool IsList(Value value) => value.Tag == TagList;

    /// <summary>Запись ли значение.</summary>
    public static bool IsRecord(Value value) => value.Tag == TagRecord;

    /// <summary>Вариант ли значение.</summary>
    public static bool IsVariant(Value value) => value.Tag == TagVariant;

    /// <summary>Вариант ли значение с именно этим дискриминантом.</summary>
    public static bool VariantIs(Value value, string name) =>
        value.Tag == TagVariant && value.Str == name;

    /*
     * Цепочка — список ЛИБО строка: образцы «пусто» и «голова и хвост»
     * разбирают обе. У строки ровно два случая, пустая и «первый символ и
     * остаток», третьего нет.
     *
     * Голова строки — одна КОДОВАЯ ТОЧКА, а не одна единица UTF-16: эмодзи
     * занимает две, и посимвольный обход разорвал бы суррогатную пару,
     * разойдясь с «длина» и «символы» (см. CodePointLength в Flang.cs).
     */

    /// <summary>Пустая ли цепочка: пустой список или пустая строка.</summary>
    public static bool ChainEmpty(Value value) =>
        value.Tag == TagString ? value.Str.Length == 0 : value.Tag == TagList && value.Items.Length == 0;

    /// <summary>Непустая ли цепочка.</summary>
    public static bool ChainCons(Value value) =>
        value.Tag == TagString ? value.Str.Length > 0 : value.Tag == TagList && value.Items.Length > 0;

    /// <summary>Ширина первой кодовой точки строки в единицах UTF-16.</summary>
    private static int FirstPointWidth(string value) =>
        char.IsHighSurrogate(value[0]) && value.Length > 1 ? 2 : 1;

    /// <summary>Голова цепочки: первый элемент списка или первый символ строки.</summary>
    public static Value ChainHead(Value value) =>
        value.Tag == TagString ? Text(value.Str.Substring(0, FirstPointWidth(value.Str))) : value.Items[0];

    /// <summary>Хвост цепочки: остаток списка или остаток строки.</summary>
    public static Value ChainTail(Value value) =>
        value.Tag == TagString ? Text(value.Str.Substring(FirstPointWidth(value.Str))) : List(value.Items[1..]);

    /// <summary>Имя типа значения для диагностик (typeName интерпретатора).</summary>
    public static string TypeName(Value value)
    {
        switch (value.Tag)
        {
            case TagNothing:
                return "ничто";
            case TagString:
                return "строка";
            case TagNumber:
                return "число";
            case TagFlag:
                return "признак";
            case TagList:
                return "список";
            case TagVariant:
                return "вариант «" + value.Str + "»";
            case TagRecord:
                return "запись";
            default:
                return "неизвестное значение";
        }
    }

    /// <summary>
    /// Короткое описание значения для диагностик (describeValue интерпретатора).
    /// Порядок проверок повторяет оригинал: строка, вариант, список, запись,
    /// «ничто», признак, число. Порядок полей — порядок объявления: он попадает
    /// в текст диагностики, а тексты сверяются с интерпретатором дословно.
    /// </summary>
    public static string Describe(Value value)
    {
        switch (value.Tag)
        {
            case TagString:
                return QuoteJson(value.Str);
            case TagVariant:
                return value.Fields.Length == 0
                    ? value.Str
                    : value.Str + "(" + FieldNames(value.Fields) + ")";
            case TagList:
                return "список из " + value.Items.Length.ToString(CultureInfo.InvariantCulture);
            case TagRecord:
                return "запись {" + FieldNames(value.Fields) + "}";
            case TagNothing:
                return "ничто";
            case TagFlag:
                return value.Bit ? "да" : "нет";
            default:
                return NumberText(value.Num);
        }
    }

    private static string FieldNames(Field[] fields)
    {
        var names = new string[fields.Length];
        for (int index = 0; index < fields.Length; index++)
        {
            names[index] = fields[index].Name;
        }
        return string.Join(", ", names);
    }

    /* ───────────────────────────── равенство ───────────────────────────── */

    /// <summary>
    /// Object.is для чисел: NaN равен NaN, 0 не равен −0 (SPEC, раздел 5).
    /// Родное `==` в C# расходится с языком в обе стороны сразу, а
    /// double.Equals объявляет 0 и −0 равными — нужен разбор по битам.
    /// </summary>
    public static bool SameNumber(double left, double right)
    {
        if (double.IsNaN(left))
        {
            return double.IsNaN(right);
        }
        if (left == 0.0 && right == 0.0)
        {
            return double.IsNegative(left) == double.IsNegative(right);
        }
        return left == right;
    }

    /// <summary>
    /// Равенство значений: скаляры как Object.is, составные структурно.
    /// Рекурсия здесь по данным, а не по программе: её глубина ограничена
    /// вложенностью значения, а не длиной вычисления.
    /// </summary>
    public static bool Equal(Value left, Value right)
    {
        if (IsScalar(left) || IsScalar(right))
        {
            if (!IsScalar(left) || !IsScalar(right) || left.Tag != right.Tag)
            {
                return false;
            }
            if (left.Tag == TagNumber)
            {
                return SameNumber(left.Num, right.Num);
            }
            if (left.Tag == TagFlag)
            {
                return left.Bit == right.Bit;
            }
            if (left.Tag == TagString)
            {
                /* Ordinal, а не культурное сравнение: строка flang — это данные,
                   и «ё» не имеет права оказаться равным «е» из-за настроек
                   машины. */
                return string.Equals(left.Str, right.Str, StringComparison.Ordinal);
            }
            return true; // оба «ничто»
        }
        if (left.Tag == TagList && right.Tag == TagList)
        {
            if (left.Items.Length != right.Items.Length)
            {
                return false;
            }
            for (int index = 0; index < left.Items.Length; index++)
            {
                if (!Equal(left.Items[index], right.Items[index]))
                {
                    return false;
                }
            }
            return true;
        }
        if (left.Tag == TagVariant && right.Tag == TagVariant)
        {
            return string.Equals(left.Str, right.Str, StringComparison.Ordinal)
                && FieldsEqual(left.Fields, right.Fields);
        }
        if (left.Tag == TagRecord && right.Tag == TagRecord)
        {
            return FieldsEqual(left.Fields, right.Fields);
        }
        return false;
    }

    /// <summary>Равенство записей: по именам полей, а не по их порядку.</summary>
    public static bool FieldsEqual(Field[] left, Field[] right)
    {
        if (left.Length != right.Length)
        {
            return false;
        }
        foreach (Field field in left)
        {
            Value? other = Lookup(right, field.Name);
            if (other is null || !Equal(field.Value, other))
            {
                return false;
            }
        }
        return true;
    }

    /// <summary>Поле по имени либо null. Линейный поиск: полей у записи единицы.</summary>
    public static Value? Lookup(Field[] fields, string name)
    {
        foreach (Field field in fields)
        {
            if (string.Equals(field.Name, name, StringComparison.Ordinal))
            {
                return field.Value;
            }
        }
        return null;
    }

    /* ───────────────────────────── число в текст ───────────────────────── */

    /// <summary>
    /// Печатает число ровно по правилам ECMAScript Number::toString.
    ///
    /// Это не украшение: «к строке» от числа и тексты диагностик содержат числа,
    /// и расхождение хотя бы в одном знаке — расхождение наблюдаемого поведения
    /// с интерпретатором. Ни ToString(), ни «R», ни «G17» не годятся: пороги
    /// перехода к экспоненте у .NET свои («1E+21» вместо «1e+21»,
    /// «1E-07» вместо «1e-7»), а у ECMAScript свои (n больше 21 и n не больше
    /// −6), плюс разделитель дробной части зависит от культуры.
    ///
    /// Кратчайшая запись ищется явно перебором точности от 1 до 17 знаков, а не
    /// берётся у ToString("R"): «R» кратчайшую запись даёт только с .NET Core
    /// 3.0, а до него был известен тем, что не всегда читался обратно тем же
    /// double. BigInteger разбирает точное двоичное значение на десятичные
    /// цифры без второго округления.
    /// </summary>
    public static string NumberText(double value)
    {
        if (double.IsNaN(value))
        {
            return "NaN";
        }
        if (value == 0.0)
        {
            /* Number::toString(−0) это «0»: знак нуля не печатается, хотя
               Object.is его различает. */
            return "0";
        }
        string sign = "";
        double magnitude = value;
        if (magnitude < 0)
        {
            sign = "-";
            magnitude = -magnitude;
        }
        if (double.IsInfinity(magnitude))
        {
            return sign + "Infinity";
        }

        /* Кратчайшая запись: наименьшее число значащих цифр, читающееся обратно
           тем же double. «E16» даёт 17 значащих цифр — этого хватает всегда. */
        string body = "";
        int n = 0;
        for (int precision = 1; precision <= 17; precision++)
        {
            string candidate = magnitude.ToString(
                "E" + (precision - 1).ToString(CultureInfo.InvariantCulture),
                CultureInfo.InvariantCulture);
            if (double.Parse(candidate, NumberStyles.Float, CultureInfo.InvariantCulture) != magnitude)
            {
                continue;
            }
            SplitExponential(candidate, out body, out n);
            break;
        }

        int k = body.Length;
        if (k <= n && n <= 21)
        {
            return sign + body + new string('0', n - k);
        }
        if (n > 0 && n <= 21)
        {
            return sign + body.Substring(0, n) + "." + body.Substring(n);
        }
        if (n > -6 && n <= 0)
        {
            return sign + "0." + new string('0', -n) + body;
        }

        int power = n - 1;
        string mark = "+";
        if (power < 0)
        {
            mark = "-";
            power = -power;
        }
        string tail = "e" + mark + power.ToString(CultureInfo.InvariantCulture);
        return k == 1
            ? sign + body + tail
            : sign + body.Substring(0, 1) + "." + body.Substring(1) + tail;
    }

    /// <summary>
    /// Разбирает запись вида «1.2345E+007» на значащие цифры без хвостовых нулей
    /// и на позицию десятичной точки n: значение равно 0.цифры × 10^n.
    /// </summary>
    private static void SplitExponential(string text, out string digits, out int point)
    {
        int marker = text.IndexOf('E');
        string mantissa = text.Substring(0, marker);
        int exponent = int.Parse(
            text.Substring(marker + 1), NumberStyles.Integer, CultureInfo.InvariantCulture);
        var body = new StringBuilder();
        foreach (char symbol in mantissa)
        {
            if (symbol >= '0' && symbol <= '9')
            {
                body.Append(symbol);
            }
        }
        while (body.Length > 1 && body[body.Length - 1] == '0')
        {
            body.Length -= 1;
        }
        digits = body.ToString();
        point = exponent + 1;
    }

    /// <summary>
    /// Строка в кавычках по правилам JSON.stringify.
    /// Ею пользуется describeValue интерпретатора, и тексты диагностик обязаны
    /// совпасть: кириллица не экранируется, управляющие символы — четырьмя
    /// шестнадцатеричными цифрами в нижнем регистре.
    /// </summary>
    public static string QuoteJson(string value)
    {
        var output = new StringBuilder("\"");
        foreach (char symbol in value)
        {
            switch (symbol)
            {
                case '"':
                    output.Append("\\\"");
                    break;
                case '\\':
                    output.Append("\\\\");
                    break;
                case '\n':
                    output.Append("\\n");
                    break;
                case '\r':
                    output.Append("\\r");
                    break;
                case '\t':
                    output.Append("\\t");
                    break;
                case '\b':
                    output.Append("\\b");
                    break;
                case '\f':
                    output.Append("\\f");
                    break;
                default:
                    if (symbol < ' ')
                    {
                        output.Append("\\u");
                        output.Append(((int)symbol).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        output.Append(symbol);
                    }
                    break;
            }
        }
        return output.Append('"').ToString();
    }

    /// <inheritdoc/>
    public override string ToString() => "<flang " + TypeName(this) + ": " + Describe(this) + ">";
}
