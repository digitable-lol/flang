// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Значение flang для бэкенда Java.
 *
 * ── Почему один класс с тегом, а не иерархия ────────────────────────────────
 * У Java нет union-типов, и соблазн выразить «Скаляр | Список | Запись |
 * Вариант» (SPEC, раздел 2) запечатанным интерфейсом с record-ами на каждый вид
 * велик — JDK 25 это умеет. Но напечатанный код flang динамически типизирован:
 * одна и та же переменная по ходу разбора держит то число, то вариант, то
 * список, и статического типа у неё нет ни в одной точке. Запечатанная
 * иерархия дала бы семь типов, между которыми напечатанному коду всё равно
 * пришлось бы ходить через instanceof-проверки — то есть ровно через тот же
 * тег, только записанный дороже. Плюс структурное равенство и Object.is для
 * скаляров пришлось бы писать руками в любом случае: сгенерированные
 * record-ом equals сравнивают double через ==, где NaN не равен NaN, а 0 равен
 * −0 — обе половины расходятся с языком (SPEC, раздел 5).
 *
 * Поэтому представление одно: тег плюс полезная нагрузка. Ровно как в рантаймах
 * Python, Go и Rust — бэкенды обязаны читаться как одна система.
 *
 * ── Суммы типов flang ───────────────────────────────────────────────────────
 * Вариант суммы — это значение с тегом VARIANT и дискриминантом-строкой, а не
 * отдельный класс Java. Причина не в лени: дискриминант в flang именной, и
 * литерал {variant, fields}, приехавший из JSON, не имеет статического типа
 * вовсе (см. reifyValue в builtins.mjs). Класс на вариант не помог бы такому
 * литералу и потребовал бы дополнительного отображения «имя → класс», которое
 * всё равно свелось бы к сравнению строк.
 *
 * Типизированный слой поверх этого печатает бэкенд: на каждый вариант и на
 * каждую запись — свой статический метод-конструктор с именованными
 * параметрами, чей javadoc называет исходное имя модели.
 *
 * ── Числа ───────────────────────────────────────────────────────────────────
 * Все числа flang — IEEE-754 double (SPEC, раздел 2), и double в Java — ровно
 * он же. Деление на ноль в Java даёт ±Infinity, а не исключение, `%` — это
 * оператор ECMAScript дословно (C fmod). То есть арифметика здесь совпадает с
 * ядром сама по себе, без единой поправки, — в отличие от Python, где деление
 * на ноль пришлось ловить.
 *
 * Расходится Java с языком в двух местах, и оба закрыты здесь:
 *
 *   • ПЕЧАТЬ ЧИСЛА. Double.toString даёт «1.0» там, где Number::toString даёт
 *     «1», и «1.0E21» там, где нужно «1e+21». Правила ECMAScript воспроизведены
 *     в numberText.
 *   • РАВЕНСТВО. `==` для double считает NaN не равным NaN и 0 равным −0 —
 *     обе половины наоборот относительно Object.is (SPEC, раздел 5). Отсюда
 *     sameNumber.
 *
 * ── Строки ──────────────────────────────────────────────────────────────────
 * String в Java — последовательность единиц UTF-16, а длина в flang считается в
 * кодовых точках (SPEC, раздел 5: «иначе кириллица и эмодзи считаются
 * неверно»). Кириллица в UTF-16 занимает одну единицу и разницы не даёт, а
 * эмодзи — две, поэтому «длина», «символ» и «подстрока» ходят по кодовым
 * точкам явно (см. Flang), а не по charAt. Это та же поправка, что в бэкенде
 * JS, и ровно поэтому здесь она есть: у Go и Rust строка байтовая, и поправка
 * там другая, но нужна она везде.
 *
 * ── Неизменяемость ──────────────────────────────────────────────────────────
 * Значения неизменяемы по договору: ни рантайм, ни напечатанный код не правят
 * массив после создания. Поэтому «хвост» и «добавить» вправе делить память с
 * исходным значением там, где это ничего не меняет, а сами массивы наружу не
 * копируются.
 *
 * Ровно одно место пишет в уже созданный массив — «добавить» (Flang.bAppend), и
 * пишет оно ТОЛЬКО в ячейку за концом списка, которой не владеет никто. Разбор
 * приёма и доказательство неизменяемости лежат при классе Grow.
 */
public final class Value {

  /** Виды значений (SPEC, раздел 2). Порядок важен: скаляры идут первыми. */
  public static final int TAG_NOTHING = 0;
  public static final int TAG_NUMBER = 1;
  public static final int TAG_FLAG = 2;
  public static final int TAG_STRING = 3;
  public static final int TAG_LIST = 4;
  public static final int TAG_RECORD = 5;
  public static final int TAG_VARIANT = 6;

  /**
   * Отметка «сколько ячеек общего массива уже занято» — одна на все списки,
   * которые этот массив делят.
   *
   * Нужна ровно одному месту — «добавить» (Flang.bAppend): без неё накопление
   * списка n вызовами стоит O(n²), потому что каждый вызов копирует весь
   * список. Это не теория: точка сетки «Строить скобки» от 42 и 0 и 0 и "" и []
   * (022-generate-parentheses.flang) при объявленном пределе 5 000 000 шагов
   * упиралась в него 63,7 с вместо секунды — то есть предел шагов переставал
   * быть сроком. Тот же приём и по той же причине стоит в рантаймах C
   * (fl_b_dobavit), Rust (Items::grown) и Go (Grow).
   *
   * Инвариант, он же доказательство неизменяемости:
   *
   *     filled только растёт, и занять ячейку с номером filled вправе
   *     единственный список — тот, чей конец (count) совпал с filled.
   *
   * Значит ячейки 0…count−1 не пишет никто и никогда, а ячейка за концом
   * занимается не более одного раза за жизнь массива: второе «добавить» к тому
   * же значению видит filled больше своего конца и уходит на копию. Ветвление
   *
   *     пусть «а» равно (добавить 1 к «с»)   ← занимает ячейку n, filled = n+1
   *     пусть «б» равно (добавить 2 к «с»)   ← конец n ≠ filled → копия
   *
   * даёт два независимых списка, и ни один не портит «с».
   */
  public static final class Grow {
    /** Сколько ячеек общего массива уже занято. Только растёт. */
    public int filled;

    Grow(int filled) {
      this.filled = filled;
    }
  }

  /** Вид значения. */
  public final int tag;
  /** Число; осмысленно только при TAG_NUMBER. */
  public final double num;
  /** Признак; осмысленно только при TAG_FLAG. */
  public final boolean bit;
  /** Строка либо имя варианта; у остальных видов пустая строка. */
  public final String str;
  /**
   * ОБЩИЙ массив, в котором лежат элементы списка; у остальных видов null.
   *
   * Длина массива — это запас, а не длина списка: за концом списка в нём могут
   * лежать ячейки чужих списков либо пустое место. Длина списка — count, и
   * читать элементы напрямую вправе только тот, кто её учитывает; всем
   * остальным — size, at и elements.
   */
  public final Value[] items;
  /** Число элементов ЭТОГО списка: items[0…count). У остальных видов ноль. */
  public final int count;
  /**
   * Отметка занятого у общего массива; null, когда запаса нет.
   *
   * Есть только у списков, которые выдало «добавить»: список из литерала,
   * «хвоста» или «отобразить» владеет своим массивом целиком, продлевать его на
   * месте некуда, и отметка ему не нужна.
   */
  public final Grow grow;
  /** Поля записи или варианта в порядке объявления; у остальных null. */
  public final Field[] fields;

  private Value(int tag, double num, boolean bit, String str, Value[] items, Field[] fields) {
    this(tag, num, bit, str, items, items == null ? 0 : items.length, null, fields);
  }

  private Value(
      int tag, double num, boolean bit, String str,
      Value[] items, int count, Grow grow, Field[] fields) {
    this.tag = tag;
    this.num = num;
    this.bit = bit;
    this.str = str;
    this.items = items;
    this.count = count;
    this.grow = grow;
    this.fields = fields;
  }

  private static final Value[] NO_ITEMS = new Value[0];
  private static final Field[] NO_FIELDS = new Field[0];

  /** «ничто» — единственное на всю программу. */
  public static final Value NOTHING = new Value(TAG_NOTHING, 0.0, false, "", null, null);
  /** Признак «да». */
  public static final Value TRUE = new Value(TAG_FLAG, 0.0, true, "", null, null);
  /** Признак «нет». */
  public static final Value FALSE = new Value(TAG_FLAG, 0.0, false, "", null, null);

  /** «ничто». */
  public static Value nothing() {
    return NOTHING;
  }

  /** Число. Всегда double: целых чисел в flang нет (SPEC, раздел 2). */
  public static Value number(double value) {
    return new Value(TAG_NUMBER, value, false, "", null, null);
  }

  /** Признак. */
  public static Value flag(boolean value) {
    return value ? TRUE : FALSE;
  }

  /** Строка. */
  public static Value text(String value) {
    return new Value(TAG_STRING, 0.0, false, value, null, null);
  }

  /** Список. Массив переходит во владение и после этого не изменяется. */
  public static Value list(Value[] items) {
    return new Value(TAG_LIST, 0.0, false, "", items, null);
  }

  /**
   * Список из первых count ячеек общего массива, с отметкой занятого.
   *
   * Единственный, кто это зовёт, — «добавить» (Flang.bAppend); инвариант и его
   * разбор лежат при Grow.
   */
  static Value grown(Value[] cells, int count, Grow grow) {
    return new Value(TAG_LIST, 0.0, false, "", cells, count, grow, null);
  }

  /** Длина списка. */
  public static int size(Value list) {
    return list.count;
  }

  /** Элемент списка по индексу от нуля; границы проверяет вызывающий. */
  public static Value at(Value list, int index) {
    return list.items[index];
  }

  /**
   * Элементы списка отдельным массивом ровно нужной длины.
   *
   * Нужен обходу — «свёртка», «отобразить», «отфильтровать» печатаются как
   * `for (Value item : …)`, и пройти по общему массиву целиком значило бы
   * задеть чужие ячейки за концом списка. Копии нет там, где список владеет
   * массивом целиком, а это все списки, кроме выданных «добавить» с запасом;
   * сам обход и так линейный, поэтому копия класса сложности не меняет.
   */
  public static Value[] elements(Value list) {
    if (list.count == list.items.length) {
      return list.items;
    }
    return java.util.Arrays.copyOf(list.items, list.count);
  }

  /** Пустой список без выделения памяти. */
  public static Value emptyList() {
    return new Value(TAG_LIST, 0.0, false, "", NO_ITEMS, null);
  }

  /** Запись: поля в порядке объявления. */
  public static Value record(Field[] fields) {
    return new Value(TAG_RECORD, 0.0, false, "", null, fields);
  }

  /** Запись без полей. */
  public static Value emptyRecord() {
    return new Value(TAG_RECORD, 0.0, false, "", null, NO_FIELDS);
  }

  /** Вариант суммы типов: дискриминант плюс поля. */
  public static Value variant(String name, Field[] fields) {
    return new Value(TAG_VARIANT, 0.0, false, name, null, fields);
  }

  /** Скаляр ли значение (SPEC, раздел 2: строка, число, признак, ничто). */
  public static boolean isScalar(Value value) {
    return value.tag <= TAG_STRING;
  }

  /** Список ли значение. */
  public static boolean isList(Value value) {
    return value.tag == TAG_LIST;
  }

  /** Запись ли значение. */
  public static boolean isRecord(Value value) {
    return value.tag == TAG_RECORD;
  }

  /** Вариант ли значение. */
  public static boolean isVariant(Value value) {
    return value.tag == TAG_VARIANT;
  }

  /*
   * Цепочка — список ЛИБО строка: образцы «пусто» и «голова и хвост» разбирают
   * обе. У строки ровно два случая, пустая и «первый символ и остаток»,
   * третьего нет.
   *
   * Голова строки — одна КОДОВАЯ ТОЧКА, а не одна единица UTF-16: эмодзи
   * занимает две, и посимвольный обход разорвал бы суррогатную пару, разойдясь
   * с «длина» и «символы» (см. codePointLength в Flang.java).
   */

  /** Пустая ли цепочка: пустой список или пустая строка. */
  public static boolean chainEmpty(Value value) {
    if (value.tag == TAG_STRING) {
      return value.str.isEmpty();
    }
    return value.tag == TAG_LIST && value.count == 0;
  }

  /** Непустая ли цепочка. */
  public static boolean chainCons(Value value) {
    if (value.tag == TAG_STRING) {
      return !value.str.isEmpty();
    }
    return value.tag == TAG_LIST && value.count > 0;
  }

  /** Голова цепочки: первый элемент списка или первый символ строки. */
  public static Value chainHead(Value value) {
    if (value.tag == TAG_STRING) {
      return text(new String(Character.toChars(value.str.codePointAt(0))));
    }
    return value.items[0];
  }

  /** Хвост цепочки: остаток списка или остаток строки. */
  public static Value chainTail(Value value) {
    if (value.tag == TAG_STRING) {
      return text(value.str.substring(value.str.offsetByCodePoints(0, 1)));
    }
    return list(java.util.Arrays.copyOfRange(value.items, 1, value.count));
  }

  /** Вариант ли значение с именно этим дискриминантом. */
  public static boolean variantIs(Value value, String name) {
    return value.tag == TAG_VARIANT && value.str.equals(name);
  }

  /** Имя типа значения для диагностик (typeName интерпретатора). */
  public static String typeName(Value value) {
    switch (value.tag) {
      case TAG_NOTHING:
        return "ничто";
      case TAG_STRING:
        return "строка";
      case TAG_NUMBER:
        return "число";
      case TAG_FLAG:
        return "признак";
      case TAG_LIST:
        return "список";
      case TAG_VARIANT:
        return "вариант «" + value.str + "»";
      case TAG_RECORD:
        return "запись";
      default:
        return "неизвестное значение";
    }
  }

  /**
   * Короткое описание значения для диагностик (describeValue интерпретатора).
   *
   * Порядок проверок повторяет оригинал: строка, вариант, список, запись,
   * «ничто», признак, число. Порядок полей — порядок объявления: он попадает в
   * текст диагностики, а тексты сверяются с интерпретатором дословно.
   */
  public static String describe(Value value) {
    switch (value.tag) {
      case TAG_STRING:
        return quoteJson(value.str);
      case TAG_VARIANT:
        if (value.fields.length == 0) {
          return value.str;
        }
        return value.str + "(" + fieldNames(value.fields) + ")";
      case TAG_LIST:
        return "список из " + value.count;
      case TAG_RECORD:
        return "запись {" + fieldNames(value.fields) + "}";
      case TAG_NOTHING:
        return "ничто";
      case TAG_FLAG:
        return value.bit ? "да" : "нет";
      default:
        return numberText(value.num);
    }
  }

  private static String fieldNames(Field[] fields) {
    StringBuilder out = new StringBuilder();
    for (int index = 0; index < fields.length; index++) {
      if (index > 0) {
        out.append(", ");
      }
      out.append(fields[index].name());
    }
    return out.toString();
  }

  /* ───────────────────────────── равенство ───────────────────────────── */

  /**
   * Object.is для чисел: NaN равен NaN, 0 не равен −0 (SPEC, раздел 5).
   *
   * Родное `==` в Java расходится с языком в обе стороны сразу, поэтому
   * сравнение своё. Double.compare здесь тоже не годится: он объявляет −0
   * меньшим нуля, а не «не равным», и раскладывает NaN в порядок — нам нужно
   * ровно равенство, а не порядок.
   */
  public static boolean sameNumber(double left, double right) {
    if (Double.isNaN(left)) {
      return Double.isNaN(right);
    }
    if (left == 0.0 && right == 0.0) {
      /* Знак нуля различим только по битам: 0.0 == -0.0 истинно. */
      return (Double.doubleToRawLongBits(left) < 0) == (Double.doubleToRawLongBits(right) < 0);
    }
    return left == right;
  }

  /**
   * Равенство значений: скаляры как Object.is, составные структурно.
   *
   * Рекурсия здесь по данным, а не по программе: её глубина ограничена
   * вложенностью значения, а не длиной вычисления.
   */
  public static boolean equal(Value left, Value right) {
    if (isScalar(left) || isScalar(right)) {
      if (!isScalar(left) || !isScalar(right) || left.tag != right.tag) {
        return false;
      }
      if (left.tag == TAG_NUMBER) {
        return sameNumber(left.num, right.num);
      }
      if (left.tag == TAG_FLAG) {
        return left.bit == right.bit;
      }
      if (left.tag == TAG_STRING) {
        return left.str.equals(right.str);
      }
      return true; // оба «ничто»
    }
    if (left.tag == TAG_LIST && right.tag == TAG_LIST) {
      if (left.count != right.count) {
        return false;
      }
      for (int index = 0; index < left.count; index++) {
        if (!equal(left.items[index], right.items[index])) {
          return false;
        }
      }
      return true;
    }
    if (left.tag == TAG_VARIANT && right.tag == TAG_VARIANT) {
      return left.str.equals(right.str) && fieldsEqual(left.fields, right.fields);
    }
    if (left.tag == TAG_RECORD && right.tag == TAG_RECORD) {
      return fieldsEqual(left.fields, right.fields);
    }
    return false;
  }

  /** Равенство записей: по именам полей, а не по их порядку. */
  public static boolean fieldsEqual(Field[] left, Field[] right) {
    if (left.length != right.length) {
      return false;
    }
    for (Field field : left) {
      Value other = lookup(right, field.name());
      if (other == null || !equal(field.value(), other)) {
        return false;
      }
    }
    return true;
  }

  /** Поле по имени либо null. Линейный поиск: полей у записи единицы. */
  public static Value lookup(Field[] fields, String name) {
    for (Field field : fields) {
      if (field.name().equals(name)) {
        return field.value();
      }
    }
    return null;
  }

  /* ───────────────────────────── число в текст ───────────────────────────── */

  /**
   * Печатает число ровно по правилам ECMAScript Number::toString.
   *
   * Это не украшение: «к строке» от числа и тексты диагностик содержат числа, и
   * расхождение хотя бы в одном знаке — расхождение наблюдаемого поведения с
   * интерпретатором. Double.toString не годится: «1.0» вместо «1», «1.0E21»
   * вместо «1e+21», «1.0E-7» вместо «1e-7», и пороги перехода к экспоненте у
   * Java свои, а у ECMAScript свои (n больше 21 и n не больше −6).
   *
   * Кратчайшая запись ищется явно перебором точности от 1 до 17 знаков, а не
   * берётся у Double.toString: с JDK 19 тот действительно даёт кратчайшую
   * запись, но до JDK 19 давал не её, и ставить наблюдаемое поведение
   * напечатанной программы в зависимость от версии JDK нельзя. BigDecimal
   * округляет к ближайшему с доводкой до чётного — это ровно та выборка «s»,
   * которую требует спецификация ECMAScript, когда кратчайших записей две.
   */
  public static String numberText(double value) {
    if (Double.isNaN(value)) {
      return "NaN";
    }
    if (value == 0.0) {
      /* Number::toString(−0) это «0»: знак нуля не печатается, хотя Object.is
         его различает. */
      return "0";
    }
    String sign = "";
    double magnitude = value;
    if (magnitude < 0) {
      sign = "-";
      magnitude = -magnitude;
    }
    if (Double.isInfinite(magnitude)) {
      return sign + "Infinity";
    }

    java.math.BigDecimal exact = new java.math.BigDecimal(magnitude);
    java.math.BigDecimal shortest = exact;
    for (int precision = 1; precision <= 17; precision++) {
      java.math.BigDecimal candidate =
          exact.round(new java.math.MathContext(precision, java.math.RoundingMode.HALF_EVEN));
      if (candidate.doubleValue() == magnitude) {
        shortest = candidate;
        break;
      }
    }
    shortest = shortest.stripTrailingZeros();

    String body = shortest.unscaledValue().toString();
    int k = body.length();
    /* value = body × 10^(n − k), где n — позиция десятичной точки. */
    int n = k - shortest.scale();

    if (k <= n && n <= 21) {
      StringBuilder out = new StringBuilder(sign).append(body);
      for (int index = 0; index < n - k; index++) {
        out.append('0');
      }
      return out.toString();
    }
    if (n > 0 && n <= 21) {
      return sign + body.substring(0, n) + "." + body.substring(n);
    }
    if (n > -6 && n <= 0) {
      StringBuilder out = new StringBuilder(sign).append("0.");
      for (int index = 0; index < -n; index++) {
        out.append('0');
      }
      return out.append(body).toString();
    }

    int power = n - 1;
    String mark = "+";
    if (power < 0) {
      mark = "-";
      power = -power;
    }
    String tail = "e" + mark + power;
    if (k == 1) {
      return sign + body + tail;
    }
    return sign + body.charAt(0) + "." + body.substring(1) + tail;
  }

  /**
   * Строка в кавычках по правилам JSON.stringify.
   *
   * Ею пользуется describeValue интерпретатора, и тексты диагностик обязаны
   * совпасть: кириллица не экранируется, управляющие символы — четырьмя
   * шестнадцатеричными цифрами в нижнем регистре.
   */
  public static String quoteJson(String value) {
    StringBuilder out = new StringBuilder("\"");
    for (int index = 0; index < value.length(); index++) {
      char symbol = value.charAt(index);
      switch (symbol) {
        case '"':
          out.append("\\\"");
          break;
        case '\\':
          out.append("\\\\");
          break;
        case '\n':
          out.append("\\n");
          break;
        case '\r':
          out.append("\\r");
          break;
        case '\t':
          out.append("\\t");
          break;
        case '\b':
          out.append("\\b");
          break;
        case '\f':
          out.append("\\f");
          break;
        default:
          if (symbol < ' ') {
            /* Locale.ROOT обязателен: под локалью с собственными цифрами
               String.format напечатал бы не те знаки, а текст диагностики
               обязан совпадать с интерпретатором на любой машине. */
            out.append(String.format(java.util.Locale.ROOT, "\\u%04x", (int) symbol));
          } else {
            out.append(symbol);
          }
      }
    }
    return out.append('"').toString();
  }

  @Override
  public String toString() {
    return "<flang " + typeName(this) + ": " + describe(this) + ">";
  }
}
