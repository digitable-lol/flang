// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// Проба цели «java»: точное целое складывается разрядами основания 2²², и
// сумма за 2⁵³ печатается десятичной записью. Длинные целые у Java есть в
// стандартной библиотеке (ADR-0036 §6, вторая цена), поэтому десятичная запись
// берёт java.math.BigInteger. В РАНТАЙМЕ BigInteger не нужен и не заведён:
// значение держится разрядами, и произвольная точность приходит от длины списка.

import java.math.BigInteger;

public final class Driver {
  private static final BigInteger BASE = BigInteger.valueOf(4194304L);

  private Driver() {}

  static Value digits(double... values) {
    Value[] items = new Value[values.length];
    for (int index = 0; index < values.length; index++) {
      items[index] = Value.number(values[index]);
    }
    return Value.list(items);
  }

  static long[] places(Value value) {
    Value[] items = Value.elements(value);
    long[] out = new long[items.length];
    for (int index = 0; index < items.length; index++) {
      out[index] = (long) items[index].num;
    }
    return out;
  }

  static String decimal(Value value) {
    long[] digits = places(value);
    BigInteger total = BigInteger.ZERO;
    for (int index = digits.length - 1; index >= 0; index--) {
      total = total.multiply(BASE).add(BigInteger.valueOf(digits[index]));
    }
    return total.toString();
  }

  static void total(String label, Value left, Value right) {
    Value out = Flang.add(null, left, right);
    StringBuilder words = new StringBuilder();
    long[] digits = places(out);
    for (int index = 0; index < digits.length; index++) {
      if (index > 0) {
        words.append(",");
      }
      words.append(digits[index]);
    }
    System.out.println(label + "\t" + words + "\t" + decimal(out));
  }

  public static void main(String[] args) {
    total("beyond", digits(1, 0, 512), digits(1));
    total("carry", digits(4194303), digits(1));
    total("wide", digits(4194303, 4194303, 4194303), digits(1, 0, 0));
    total("denormal", digits(4194305), digits(0));
    total("forged", digits(1, 0, 511), digits(1));
    System.out.println("numbers\t" + (long) Flang.add(null, Value.number(2), Value.number(3)).num);
    try {
      Flang.add(null, digits(1, 0, 512), Value.number(1));
    } catch (RuntimeException refusal) {
      System.out.println("refusal\t" + refusal.getMessage());
    }
  }
}
