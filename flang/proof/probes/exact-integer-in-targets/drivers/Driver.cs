// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// Проба цели «csharp»: точное целое складывается разрядами основания 2²², и
// сумма за 2⁵³ печатается десятичной записью. Длинные целые у C# есть в
// стандартной библиотеке (ADR-0036 §6, вторая цена), поэтому десятичная запись
// берёт System.Numerics.BigInteger. В РАНТАЙМЕ BigInteger не нужен и не
// заведён: значение держится разрядами, точность приходит от длины списка.

using System.Numerics;

public static class Driver
{
    private static readonly BigInteger Base = new BigInteger(4194304);

    static Value Digits(params double[] values)
    {
        Value[] items = new Value[values.Length];
        for (int index = 0; index < values.Length; index++)
        {
            items[index] = Value.Number(values[index]);
        }
        return Value.List(items);
    }

    static long[] Places(Value value)
    {
        Value[] items = Value.Elements(value);
        long[] out_ = new long[items.Length];
        for (int index = 0; index < items.Length; index++)
        {
            out_[index] = (long)items[index].Num;
        }
        return out_;
    }

    static string Decimal(Value value)
    {
        long[] digits = Places(value);
        BigInteger total = BigInteger.Zero;
        for (int index = digits.Length - 1; index >= 0; index--)
        {
            total = total * Base + digits[index];
        }
        return total.ToString();
    }

    static void Total(string label, Value left, Value right)
    {
        Value sum = Flang.Add(null, left, right);
        var words = new System.Collections.Generic.List<string>();
        foreach (long digit in Places(sum))
        {
            words.Add(digit.ToString());
        }
        System.Console.WriteLine(label + "\t" + string.Join(",", words) + "\t" + Decimal(sum));
    }

    public static void Main()
    {
        System.Console.OutputEncoding = System.Text.Encoding.UTF8;
        Total("beyond", Digits(1, 0, 512), Digits(1));
        Total("carry", Digits(4194303), Digits(1));
        Total("wide", Digits(4194303, 4194303, 4194303), Digits(1, 0, 0));
        Total("denormal", Digits(4194305), Digits(0));
        Total("forged", Digits(1, 0, 511), Digits(1));
        System.Console.WriteLine("numbers\t" + (long)Flang.Add(null, Value.Number(2), Value.Number(3)).Num);
        try
        {
            Flang.Add(null, Digits(1, 0, 512), Value.Number(1));
        }
        catch (System.Exception refusal)
        {
            System.Console.WriteLine("refusal\t" + refusal.Message);
        }
    }
}
