// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Операции языка flang для бэкенда Java: арифметика, доступ к полям, разбор,
 * встроенные формы, батут и глубокий стек.
 *
 * Это «rt.» напечатанного кода: всё, что не сводится к одному оператору Java
 * без потери совпадения с интерпретатором, живёт здесь. Правило простое — если
 * операция способна дать диагностику flang, она обязана быть здесь, потому что
 * текст диагностики сверяется с интерпретатором дословно, а собрать его на
 * месте вызова значило бы размножить один текст по всей программе.
 *
 * ── Что Java даёт даром, а Python и Go — нет ────────────────────────────────
 * Деление на ноль в Java возвращает ±Infinity, ноль на ноль — NaN, а `%` для
 * double — это ровно оператор ECMAScript (C fmod, знак от делимого). То есть
 * арифметика здесь совпадает с ядром сама по себе. В Python деление пришлось
 * оборачивать в try, а остаток — писать заново; здесь обёртки нужны только
 * ради проверки типов операндов и текста диагностики.
 *
 * ── Что Java даром не даёт ──────────────────────────────────────────────────
 * Строка. String — это UTF-16, а «длина» в flang считается в кодовых точках
 * (SPEC, раздел 5). Для кириллицы разницы нет, для эмодзи — вдвое, и молчаливое
 * расхождение на эмодзи хуже громкого: оно всплывает у пользователя, а не в
 * тесте. Поэтому «длина», «символ» и «подстрока» ходят по кодовым точкам явно.
 *
 * Стек. Предел глубины flang — 10⁴ вызовов, и стек потока JVM по умолчанию под
 * это не рассчитан. StackOverflowError не диагностика, а Error, поэтому
 * вычисление считается в потоке с явно заданным стеком (withDeepStack).
 */
public final class Flang {

  private Flang() {}

  /* ───────────────────────────── диагностика ───────────────────────────── */

  /** Собирает диагностику. Возвращает исключение — бросает вызывающий. */
  public static FlangError fail(String code, String message) {
    return new FlangError(code, message);
  }

  /* ───────────────────────────── глубокий стек ───────────────────────────── */

  /**
   * Стек потока, в котором считается вычисление.
   *
   * Предел глубины flang по умолчанию 10⁴, кадр напечатанной функции несёт
   * контекст, параметры и временные, и мегабайта стека по умолчанию на это не
   * хватает. Требовать -Xss от пользователя нельзя: напечатанная программа
   * обязана работать так, как её запустили, а не так, как её следовало бы
   * запустить.
   */
  public static final long DEEP_STACK_BYTES = 512L * 1024L * 1024L;

  /**
   * Исполняет работу в потоке с большим стеком и возвращает её результат.
   *
   * Исключение переносится вызывающему как есть: FlangError обязана доехать до
   * прогонщика неотличимой от той, что возникла бы в главном потоке.
   */
  public static <T> T withDeepStack(java.util.function.Supplier<T> work) {
    final Object[] box = new Object[1];
    final RuntimeException[] failure = new RuntimeException[1];
    final Error[] broken = new Error[1];
    Runnable body =
        () -> {
          try {
            box[0] = work.get();
          } catch (RuntimeException error) {
            failure[0] = error;
          } catch (Error error) {
            broken[0] = error;
          }
        };
    Thread worker = new Thread(null, body, "flang", DEEP_STACK_BYTES);
    worker.start();
    try {
      worker.join();
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("вычисление прервано", interrupted);
    }
    if (failure[0] != null) {
      throw failure[0];
    }
    if (broken[0] != null) {
      throw broken[0];
    }
    @SuppressWarnings("unchecked")
    T result = (T) box[0];
    return result;
  }

  /* ───────────────────────────── батут ───────────────────────────── */

  /**
   * Отскок: следующий шаг компоненты и его аргументы.
   *
   * Взаимная хвостовая рекурсия («Чётное»/«Нечётное») у интерпретатора идёт в
   * постоянной глубине — он переиспользует кадр возврата. Обычный вызов Java
   * рос бы по стеку и упёрся бы в предел там, где интерпретатор считает штатно.
   */
  public static final class Bounce {
    /** Шаг, к которому нужно отскочить, либо null, если получено значение. */
    public Step next;
    /** Аргументы отскока. */
    public Value[] args;
  }

  /** Шаг батута: считает своё тело либо заполняет отскок и возвращает null. */
  @FunctionalInterface
  public interface Step {
    Value run(Ctx ctx, Value[] args, Bounce bounce);
  }

  /** Крутит отскоки в цикле, пока шаг не вернёт значение. */
  public static Value trampoline(Ctx ctx, Step step, Value[] args, String function) {
    Bounce bounce = new Bounce();
    Step current = step;
    Value[] current_args = args;
    for (; ; ) {
      bounce.next = null;
      bounce.args = null;
      Value value = current.run(ctx, current_args, bounce);
      if (bounce.next == null) {
        return value;
      }
      ctx.step(function);
      current = bounce.next;
      current_args = bounce.args;
    }
  }

  /* ───────────────────────────── операции языка ───────────────────────────── */

  /** Доступ к полю записи. */
  public static Value fieldGet(Ctx ctx, Value target, String name) {
    if (target.tag == Value.TAG_VARIANT) {
      // Поле СУММЫ ИЗ ОДНОГО ВАРИАНТА. Что вариант ровно один, проверила проверка типов, поэтому сюда приезжает значение, у которого поле есть. Отказ ниже остаётся прежним: он про сумму из двух и более.
      Value inVariant = Value.lookup(target.fields, name);
      if (inVariant != null) {
        return inVariant;
      }
      throw fail(
          FlangError.CODE_TYPE,
          "поле «" + name + "» нельзя взять у варианта «" + target.str + "» — нужен разбор");
    }
    if (target.tag != Value.TAG_RECORD) {
      throw fail(
          FlangError.CODE_TYPE,
          "поле «" + name + "» можно взять только у записи, получено " + Value.typeName(target));
    }
    Value found = Value.lookup(target.fields, name);
    if (found == null) {
      throw fail(FlangError.CODE_UNKNOWN_NAME, "запись не содержит поле «" + name + "»");
    }
    return found;
  }

  /**
   * Поле варианта при сопоставлении с образцом.
   *
   * Отсутствующее поле — ошибка прямо здесь, а не «случай не подошёл»: так же
   * ведёт себя matchPattern интерпретатора.
   */
  public static Value variantField(Ctx ctx, Value target, String name) {
    Value found = Value.lookup(target.fields, name);
    if (found == null) {
      throw fail(
          FlangError.CODE_UNKNOWN_NAME,
          "вариант «" + target.str + "» не содержит поле «" + name + "»");
    }
    return found;
  }

  /** Условие «если»: обязано быть признаком. */
  public static boolean cond(Ctx ctx, Value value) {
    if (value.tag != Value.TAG_FLAG) {
      throw fail(
          FlangError.CODE_TYPE,
          "условие «если» должно быть признаком, получено " + Value.typeName(value));
    }
    return value.bit;
  }

  /** Условие «отфильтровать»: обязано быть признаком. */
  public static boolean keep(Ctx ctx, Value value) {
    if (value.tag != Value.TAG_FLAG) {
      throw fail(
          FlangError.CODE_TYPE,
          "условие «отфильтровать» должно быть признаком, получено " + Value.typeName(value));
    }
    return value.bit;
  }

  /** Значение постусловия: обязано быть признаком. */
  public static boolean post(Ctx ctx, Value value, String property, String function) {
    if (value.tag != Value.TAG_FLAG) {
      throw fail(
          FlangError.CODE_TYPE,
          "постусловие «" + property + "» функции «" + function + "» должно давать признак,"
              + " получено " + Value.typeName(value));
    }
    return value.bit;
  }

  /**
   * Значение предусловия: обязано быть признаком.
   *
   * <p>Отдельно от {@link #post}, а не тот же помощник со вторым текстом: слова
   * отказа дословно те же, что у интерпретатора (checkPreconditions в
   * flang/src/interpret.mjs), и одно сообщение на две разные вещи разошлось бы
   * молча. Зовёт это ТОЛЬКО дверь программы — вызов по имени (call): внутри
   * программы предусловие снял вызывающий на проверке.
   */
  public static boolean pre(Ctx ctx, Value value, String property, String function) {
    if (value.tag != Value.TAG_FLAG) {
      throw fail(
          FlangError.CODE_TYPE,
          "предусловие «" + property + "» функции «" + function + "» должно давать признак,"
              + " получено " + Value.typeName(value));
    }
    return value.bit;
  }

  /** Разбор не покрыл значение. */
  public static FlangError matchFail(Ctx ctx, Value value) {
    return fail(FlangError.CODE_MATCH, "разбор не покрывает значение " + Value.describe(value));
  }

  /**
   * То же самое, но в позиции значения.
   *
   * Тип возврата здесь — Value, хотя метод не возвращает ничего никогда. Это не
   * небрежность, а требование Java: разбор без единого случая стоит в позиции
   * выражения, и напечатать на его месте `throw` нельзя — следующий оператор
   * стал бы недостижимым, а недостижимый оператор в Java ошибка компиляции, а
   * не предупреждение. С методом же оператор завершается нормально с точки
   * зрения javac, а во время выполнения даёт ровно ту же диагностику.
   */
  public static Value noMatch(Ctx ctx, Value value) {
    throw matchFail(ctx, value);
  }

  /**
   * «свёртка», «отобразить» и «отфильтровать» работают только со списком.
   *
   * Отдаётся массив ровно нужной длины (Value.elements), а не общий массив
   * списка: за концом списка в общем массиве могут лежать чужие ячейки, а обход
   * печатается как `for (Value item : …)` и прошёл бы по ним тоже.
   */
  public static Value[] requireList(Ctx ctx, Value value, String label) {
    if (value.tag != Value.TAG_LIST) {
      throw fail(
          FlangError.CODE_TYPE,
          "«" + label + "» работает только со списком, получено " + Value.typeName(value));
    }
    return Value.elements(value);
  }

  /* ───────────────────────────── арифметика ───────────────────────────── */

  private static void arithmetic(String op, Value left, Value right) {
    if (left.tag != Value.TAG_NUMBER || right.tag != Value.TAG_NUMBER) {
      throw fail(
          FlangError.CODE_TYPE,
          "операция «" + op + "» допустима только для чисел, получено "
              + Value.typeName(left) + " и " + Value.typeName(right));
    }
  }

  private static void ordered(Value left, Value right) {
    /* Сообщение дословно как в ядре FTS (src/utility.ts, compare). */
    if (left.tag != Value.TAG_NUMBER || right.tag != Value.TAG_NUMBER) {
      throw fail(FlangError.CODE_TYPE, "сравнения порядка допустимы только для чисел");
    }
  }

  /** «плюс». */
  public static Value add(Ctx ctx, Value left, Value right) {
    arithmetic("add", left, right);
    return Value.number(left.num + right.num);
  }

  /** «минус». */
  public static Value sub(Ctx ctx, Value left, Value right) {
    arithmetic("sub", left, right);
    return Value.number(left.num - right.num);
  }

  /** «умножить на». */
  public static Value mul(Ctx ctx, Value left, Value right) {
    arithmetic("mul", left, right);
    return Value.number(left.num * right.num);
  }

  /**
   * «делить на».
   *
   * Деление double на ноль в Java даёт ±Infinity, а ноль на ноль — NaN, ровно
   * как требует SPEC (раздел 5): деление на ноль — это значение, а не ошибка.
   * Никакой обёртки, в отличие от Python.
   */
  public static Value div(Ctx ctx, Value left, Value right) {
    arithmetic("div", left, right);
    return Value.number(left.num / right.num);
  }

  /**
   * «остаток от» как двуместная операция.
   *
   * Оператор `%` для double в Java — это C fmod, то есть ровно оператор
   * ECMAScript: знак берётся от делимого (−7 % 3 это −1), нулевой делитель даёт
   * NaN, бесконечное делимое даёт NaN. Переписывать нечего.
   */
  public static Value mod(Ctx ctx, Value left, Value right) {
    arithmetic("mod", left, right);
    return Value.number(left.num % right.num);
  }

  /**
   * «процентов от». Порядок операций ядра: (процент / 100) * значение.
   *
   * Переписать в значение * процент / 100 нельзя — меняется последний бит
   * мантиссы.
   */
  public static Value percent(Ctx ctx, Value left, Value right) {
    arithmetic("percent", left, right);
    return Value.number((left.num / 100) * right.num);
  }

  /** «больше». */
  public static Value gt(Ctx ctx, Value left, Value right) {
    ordered(left, right);
    return Value.flag(left.num > right.num);
  }

  /** «меньше». */
  public static Value lt(Ctx ctx, Value left, Value right) {
    ordered(left, right);
    return Value.flag(left.num < right.num);
  }

  /** «не меньше». */
  public static Value gte(Ctx ctx, Value left, Value right) {
    ordered(left, right);
    return Value.flag(left.num >= right.num);
  }

  /** «не больше». */
  public static Value lte(Ctx ctx, Value left, Value right) {
    ordered(left, right);
    return Value.flag(left.num <= right.num);
  }

  /**
   * Сойдутся ли на стыке двух строк высокая и низкая половины суррогатной пары.
   *
   * <p>В UTF-16 такие половины слились бы в ОДИН знак: два знака на входе, один
   * на выходе, — и всякое утверждение о длине склейки стало бы ложным.
   */
  private static boolean pairSplits(String left, String right) {
    if (left.isEmpty() || right.isEmpty()) {
      return false;
    }
    char last = left.charAt(left.length() - 1);
    char first = right.charAt(0);
    return Character.isHighSurrogate(last) && Character.isLowSurrogate(first);
  }

  /**
   * Отказ на стыке, где склейка слила бы два знака в один.
   *
   * <p>Отказ, а не тихая порча: показать разницу это представление не может. У
   * целей, где строка — UTF-8 или последовательность кодовых точек, такого
   * стыка не бывает вовсе, и проверки там нет.
   */
  private static void glueCheck(String left, String right) {
    if (pairSplits(left, right)) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«соединить»: на стыке сошлись половины суррогатной пары — два знака слились бы в один");
    }
  }

  /**
   * Разорван ли край подстроки: начинается низкой половиной суррогатной пары
   * или кончается высокой.
   *
   * <p>Вхождение способно разрезать знак пополам ТОЛЬКО у такой подстроки —
   * значит у всякой другой обычный поиск по единицам UTF-16 уже считает знаки,
   * и обходить строку незачем.
   */
  private static boolean isTorn(String part) {
    if (part.isEmpty()) {
      return false;
    }
    return Character.isLowSurrogate(part.charAt(0))
        || Character.isHighSurrogate(part.charAt(part.length() - 1));
  }

  /** Стоит ли позиция на границе знака, а не в середине суррогатной пары. */
  private static boolean isBoundary(String text, int at) {
    if (at <= 0 || at >= text.length()) {
      return true;
    }
    return !Character.isLowSurrogate(text.charAt(at))
        || !Character.isHighSurrogate(text.charAt(at - 1));
  }

  /** Первое вхождение, не разрезающее знак ни началом, ни концом. */
  private static int findAligned(String text, String part, int from) {
    for (int at = text.indexOf(part, from); at >= 0; at = text.indexOf(part, at + 1)) {
      if (isBoundary(text, at) && isBoundary(text, at + part.length())) {
        return at;
      }
    }
    return -1;
  }

  /** «соединить» как двуместная операция над строками. */
  public static Value concat(Ctx ctx, Value left, Value right) {
    if (left.tag != Value.TAG_STRING || right.tag != Value.TAG_STRING) {
      throw fail(
          FlangError.CODE_TYPE,
          "«соединить» допустимо только для строк, получено "
              + Value.typeName(left) + " и " + Value.typeName(right));
    }
    glueCheck(left.str, right.str);
    return Value.text(left.str + right.str);
  }

  /** Равенство значений как выражение языка. */
  public static Value eq(Value left, Value right) {
    return Value.flag(Value.equal(left, right));
  }

  /** Неравенство значений как выражение языка. */
  public static Value neq(Value left, Value right) {
    return Value.flag(!Value.equal(left, right));
  }

  /* ───────────────────────── проверки аргументов ───────────────────────── */

  private static String expectString(String name, Value value, String role) {
    if (value.tag != Value.TAG_STRING) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«" + name + "»: " + role + " должна быть строкой, получено " + Value.typeName(value));
    }
    return value.str;
  }

  private static double expectNumber(String name, Value value, String role) {
    if (value.tag != Value.TAG_NUMBER) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«" + name + "»: " + role + " должно быть числом, получено " + Value.typeName(value));
    }
    return value.num;
  }

  private static double expectInteger(String name, Value value, String role) {
    double result = expectNumber(name, value, role);
    /* Number.isInteger: ни NaN, ни бесконечность целыми не считаются. */
    if (Double.isNaN(result) || Double.isInfinite(result) || result != Math.rint(result)) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«" + name + "»: " + role + " должно быть целым числом, получено "
              + Value.numberText(result));
    }
    return result;
  }

  /**
   * Проверка «это список» для встроенных форм.
   *
   * Возвращается само значение, а не его массив: у списка есть длина, отдельная
   * от длины общего массива (см. Value.count), и встроенные формы обязаны
   * считать по ней. Копии здесь нет — «элемент N в …» стоит того же, что
   * «голова», как и обещано в SPEC.
   */
  private static Value expectList(String name, Value value, String role) {
    if (value.tag != Value.TAG_LIST) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«" + name + "»: " + role + " должен быть списком, получено " + Value.typeName(value));
    }
    return value;
  }

  /* ───────────────────────── строки в кодовых точках ───────────────────── */

  /**
   * Длина строки в кодовых точках.
   *
   * Это и есть та поправка, ради которой в SPEC (раздел 5) записано «длина в
   * кодовых точках, а не в единицах UTF-16». Для кириллицы результат тот же,
   * что у length(), для эмодзи — вдвое меньше, и именно эмодзи ловит ошибку.
   */
  public static int codePointLength(String value) {
    return value.codePointCount(0, value.length());
  }

  /** Смещение в единицах UTF-16 по номеру кодовой точки. */
  private static int offsetOf(String value, int codePoints) {
    return value.offsetByCodePoints(0, codePoints);
  }

  /* ───────────────────────── встроенные формы ───────────────────────── */

  /** «длина»: строка в кодовых точках, список в элементах. */
  public static Value bLength(Ctx ctx, Value value) {
    if (value.tag == Value.TAG_STRING) {
      return Value.number(codePointLength(value.str));
    }
    if (value.tag == Value.TAG_LIST) {
      return Value.number(Value.size(value));
    }
    throw fail(
        FlangError.CODE_BUILTIN_ARGS,
        "«длина»: ожидается строка или список, получено " + Value.typeName(value));
  }

  /** «символ … в …». Индексация с 1 и включительно (SPEC, раздел 5). */
  public static Value bChar(Ctx ctx, Value index, Value source) {
    double position = expectInteger("символ", index, "индекс");
    String value = expectString("символ", source, "строка");
    int length = codePointLength(value);
    double at = position - ctx.indexBase;
    if (at < 0 || at >= length) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«символ»: индекс " + Value.numberText(position) + " вне строки длиной " + length);
    }
    int begin = offsetOf(value, (int) at);
    return Value.text(new String(Character.toChars(value.codePointAt(begin))));
  }

  /** «подстрока … с … по …»: оба конца включительно при базе 1. */
  public static Value bSubstring(Ctx ctx, Value source, Value fromValue, Value toValue) {
    String value = expectString("подстрока", source, "строка");
    double start = expectInteger("подстрока", fromValue, "начало");
    double end = expectInteger("подстрока", toValue, "конец");
    int length = codePointLength(value);
    double begin = start - ctx.indexBase;
    if (begin < 0 || begin > length) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«подстрока»: начало " + Value.numberText(start) + " вне строки длиной " + length);
    }
    if (end < begin || end > length) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«подстрока»: конец " + Value.numberText(end) + " вне диапазона ["
              + Value.numberText(start) + ", " + length + "]");
    }
    int from = offsetOf(value, (int) begin);
    int to = offsetOf(value, (int) end);
    return Value.text(value.substring(from, to));
  }

  /**
   * «соединить». Две формы: строка со строкой и список с разделителем.
   *
   * Различаются по типу первого аргумента, как в builtins.mjs.
   */
  public static Value bJoin(Ctx ctx, Value left, Value right) {
    if (left.tag == Value.TAG_LIST) {
      String separator = expectString("соединить", right, "разделитель");
      StringBuilder out = new StringBuilder();
      String tail = "";
      for (int index = 0; index < Value.size(left); index++) {
        Value item = Value.at(left, index);
        if (item.tag != Value.TAG_STRING) {
          throw fail(
              FlangError.CODE_BUILTIN_ARGS,
              "«соединить»: элемент " + (index + 1) + " списка должен быть строкой, получено "
                  + Value.typeName(item));
        }
        if (index > 0) {
          glueCheck(tail, separator);
          if (!separator.isEmpty()) {
            tail = separator;
          }
          out.append(separator);
        }
        glueCheck(tail, item.str);
        if (!item.str.isEmpty()) {
          tail = item.str;
        }
        out.append(item.str);
      }
      return Value.text(out.toString());
    }
    String first = expectString("соединить", left, "первая строка");
    String second = expectString("соединить", right, "вторая строка");
    glueCheck(first, second);
    return Value.text(first + second);
  }

  /**
   * «символы»: разложение строки в список односимвольных строк.
   *
   * <p>Идём по кодовым точкам, а не по char: в UTF-16 символ вне BMP занимает
   * две единицы, и toCharArray разорвал бы суррогатную пару на два значения,
   * ни одно из которых не является строкой. Кодовые точки — то же деление, что
   * у «длина» и «подстрока».
   */
  public static Value bCharacters(Ctx ctx, Value source) {
    String value = expectString("символы", source, "строка");
    java.util.ArrayList<Value> points = new java.util.ArrayList<>();
    int index = 0;
    while (index < value.length()) {
      int point = value.codePointAt(index);
      int width = Character.charCount(point);
      points.add(Value.text(value.substring(index, index + width)));
      index += width;
    }
    return Value.list(points.toArray(new Value[0]));
  }

  /**
   * «код символа»: кодовая точка первого символа строки.
   *
   * codePointAt(0) собирает суррогатную пару обратно в одну точку; charAt(0)
   * отдал бы половину пары, и Java разошлась бы со свидетелем на эмодзи.
   */
  public static Value bCharCode(Ctx ctx, Value source) {
    String value = expectString("код символа", source, "строка");
    if (value.isEmpty()) {
      throw fail(FlangError.CODE_BUILTIN_ARGS, "«код символа»: строка пуста");
    }
    return Value.number(value.codePointAt(0));
  }

  /**
   * «символ по коду»: строка ровно из одного символа.
   *
   * Character.toChars разворачивает точку за основной плоскостью в суррогатную
   * пару — то есть в строке Java она занимает две единицы UTF-16, а «длина»
   * flang считает её одним символом, как и положено. Суррогат отвергается
   * ЯВНО, хотя Java его хранить умеет: строка в четырёх целях печати из восьми
   * — UTF-8, и там половины пары нет, а язык обещает восьми целям одинаковые
   * значения.
   */
  public static Value bCharFromCode(Ctx ctx, Value code) {
    double point = expectInteger("символ по коду", code, "код");
    if (point < 0 || point > 1114111) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«символ по коду»: код " + Value.numberText(point) + " вне диапазона Unicode [0, 1114111]");
    }
    if (point >= 55296 && point <= 57343) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«символ по коду»: код " + Value.numberText(point) + " — половина суррогатной пары, а не символ");
    }
    return Value.text(new String(Character.toChars((int) point)));
  }

  /**
   * «хеш256»: SHA-256 байтов строки шестнадцатеричной записью строчными буквами.
   *
   * Берётся `java.security.MessageDigest` — он лежит в `java.base`, то есть
   * своей зависимости не приносит; восьмая рукописная копия FIPS 180-4 была бы
   * восьмым местом, где можно ошибиться поодиночке. Строка Java — UTF-16,
   * поэтому байты берутся явной кодировкой UTF-8: ровно те же, что хеширует C,
   * и оттого отпечаток совпадает с `sha256sum` и с прочими восемью целями знак
   * в знак.
   *
   * «SHA-256» обязателен для всякой реализации Java (спецификация платформы),
   * поэтому NoSuchAlgorithmException здесь недостижим; он переложен в отказ
   * рантайма, а не проглочен, потому что молчащая ветвь хуже названной.
   */
  public static Value bHash256(Ctx ctx, Value text) {
    String body = expectString("хеш256", text, "строка");
    try {
      byte[] svod =
          java.security.MessageDigest.getInstance("SHA-256")
              .digest(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      StringBuilder out = new StringBuilder(64);
      for (byte one : svod) {
        out.append(Character.forDigit((one >> 4) & 0xf, 16));
        out.append(Character.forDigit(one & 0xf, 16));
      }
      return Value.text(out.toString());
    } catch (java.security.NoSuchAlgorithmException nomehow) {
      throw fail(FlangError.CODE_BUILTIN_ARGS, "«хеш256»: SHA-256 недоступен этой машине Java");
    }
  }

  /**
   * «разделить … по …».
   *
   * Поиск идёт по единицам UTF-16, пока у разделителя целые края: у такого
   * совпадение в UTF-16 и совпадение по кодовым точкам — одно и то же. Если
   * край разорван половиной суррогатной пары, вхождение может разрезать знак,
   * и тогда берётся поиск, который такие места пропускает.
   */
  public static Value bSplit(Ctx ctx, Value source, Value separator) {
    String value = expectString("разделить", source, "строка");
    String mark = expectString("разделить", separator, "разделитель");
    if (mark.isEmpty()) {
      throw fail(FlangError.CODE_BUILTIN_ARGS, "«разделить»: разделитель не может быть пустым");
    }
    java.util.ArrayList<Value> parts = new java.util.ArrayList<>();
    boolean torn = isTorn(mark);
    int from = 0;
    for (; ; ) {
      int found = torn ? findAligned(value, mark, from) : value.indexOf(mark, from);
      if (found < 0) {
        parts.add(Value.text(value.substring(from)));
        break;
      }
      parts.add(Value.text(value.substring(from, found)));
      from = found + mark.length();
    }
    return Value.list(parts.toArray(new Value[0]));
  }

  /** «содержит»: подстрока в строке либо значение в списке. */
  public static Value bContains(Ctx ctx, Value left, Value right) {
    if (left.tag == Value.TAG_LIST) {
      for (int index = 0; index < Value.size(left); index++) {
        if (Value.equal(Value.at(left, index), right)) {
          return Value.TRUE;
        }
      }
      return Value.FALSE;
    }
    String value = expectString("содержит", left, "строка или список");
    String part = expectString("содержит", right, "искомая подстрока");
    if (!isTorn(part)) {
      return Value.flag(value.contains(part));
    }
    return Value.flag(findAligned(value, part, 0) >= 0);
  }

  /** «начинается с». */
  public static Value bStartsWith(Ctx ctx, Value source, Value prefix) {
    String value = expectString("начинается с", source, "строка");
    String start = expectString("начинается с", prefix, "префикс");
    if (!value.startsWith(start)) {
      return Value.FALSE;
    }
    return Value.flag(!isTorn(start) || isBoundary(value, start.length()));
  }

  /**
   * Пробел по правилам ECMAScript String.prototype.trim.
   *
   * Ни String.trim(), ни String.strip() Java не годятся: первый режет всё, что
   * не больше U+0020, и не трогает U+00A0; второй ходит по
   * Character.isWhitespace, где есть U+001C…U+001F, которых в наборе ECMAScript
   * нет, и нет U+00A0 и U+FEFF, которые там есть. Разошлись бы ровно на тех
   * входах, ради которых «к числу» и проверяется.
   */
  private static boolean isJsSpace(char symbol) {
    switch (symbol) {
      case '\t':
      case '\n':
      case 0x000B:
      case '\f':
      case '\r':
      case ' ':
      case 0x00A0:
      case 0x1680:
      case 0x2028:
      case 0x2029:
      case 0x202F:
      case 0x205F:
      case 0x3000:
      case 0xFEFF:
        return true;
      default:
        return symbol >= 0x2000 && symbol <= 0x200A;
    }
  }

  private static String trimJs(String value) {
    int from = 0;
    int to = value.length();
    while (from < to && isJsSpace(value.charAt(from))) {
      from += 1;
    }
    while (to > from && isJsSpace(value.charAt(to - 1))) {
      to -= 1;
    }
    return value.substring(from, to);
  }

  /**
   * Строгий разбор «к числу»: без Infinity, NaN, шестнадцатеричных и пустой
   * строки, иначе форма молча превращает мусор в значение.
   *
   * Цифры перечислены явно диапазоном ASCII: Character.isDigit в Java — это
   * любая десятичная цифра Unicode (в том числе арабо-индийская), а регулярное
   * выражение builtins.mjs стоит под флагом «u», где \d — только ASCII.
   */
  private static boolean looksLikeNumber(String value) {
    int index = 0;
    int size = value.length();
    if (index < size && (value.charAt(index) == '+' || value.charAt(index) == '-')) {
      index += 1;
    }
    int before = 0;
    while (index < size && value.charAt(index) >= '0' && value.charAt(index) <= '9') {
      index += 1;
      before += 1;
    }
    int after = 0;
    if (index < size && value.charAt(index) == '.') {
      index += 1;
      while (index < size && value.charAt(index) >= '0' && value.charAt(index) <= '9') {
        index += 1;
        after += 1;
      }
      /* «1.» и «.» недопустимы: после точки обязана быть хотя бы одна цифра, а
         «.5» допустимо именно потому, что цифры есть после точки. */
      if (after == 0) {
        return false;
      }
    }
    if (before == 0 && after == 0) {
      return false;
    }
    if (index < size && (value.charAt(index) == 'e' || value.charAt(index) == 'E')) {
      index += 1;
      if (index < size && (value.charAt(index) == '+' || value.charAt(index) == '-')) {
        index += 1;
      }
      int digits = 0;
      while (index < size && value.charAt(index) >= '0' && value.charAt(index) <= '9') {
        index += 1;
        digits += 1;
      }
      if (digits == 0) {
        return false;
      }
    }
    return index == size;
  }

  /** «к числу». */
  public static Value bToNumber(Ctx ctx, Value source) {
    String value = expectString("к числу", source, "строка");
    String trimmed = trimJs(value);
    if (!looksLikeNumber(trimmed)) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«к числу»: строка " + Value.quoteJson(value) + " не является числом");
    }
    /* Переполнение (1e999) даёт ±Infinity и ловится следующей проверкой: текст
       разобран, но конечным числом не является. */
    double result = Double.parseDouble(trimmed);
    if (Double.isNaN(result) || Double.isInfinite(result)) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«к числу»: строка " + Value.quoteJson(value) + " не является конечным числом");
    }
    return Value.number(result);
  }

  /**
   * «к числу или беда»: отказ, ставший значением.
   *
   * Обоснование формы — в builtins.mjs, раздел «отказ, ставший значением».
   * Разбор не повторяется, а переиспользуется: тексты обязаны совпасть с
   * интерпретатором, и единственный способ гарантировать это — один разбор на
   * обе формы. Отказать эта форма не может вовсе.
   */
  public static Value bToNumberOrFailure(Ctx ctx, Value source) {
    try {
      return Value.variant("Разобрано", new Field[] {new Field("значение", bToNumber(ctx, source))});
    } catch (FlangError failure) {
      return Value.variant(
          "Не разобрано",
          new Field[] {
            new Field("код", Value.text(failure.code())),
            new Field("сообщение", Value.text(failure.text()))
          });
    }
  }

  /**
   * «к строке».
   *
   * Признак печатается по-русски («да»/«нет»), «ничто» — словом «ничто»:
   * поверхность языка русская, и кодогенераторы обязаны это повторять, а не
   * печатать true/false (SPEC, раздел 5).
   */
  public static Value bToString(Ctx ctx, Value value) {
    switch (value.tag) {
      case Value.TAG_STRING:
        return value;
      case Value.TAG_NUMBER:
        return Value.text(Value.numberText(value.num));
      case Value.TAG_FLAG:
        return Value.text(value.bit ? "да" : "нет");
      case Value.TAG_NOTHING:
        return Value.text("ничто");
      default:
        throw fail(
            FlangError.CODE_BUILTIN_ARGS,
            "«к строке»: ожидается скаляр, получено " + Value.typeName(value));
    }
  }

  /** «пусто». */
  public static Value bEmpty(Ctx ctx, Value value) {
    if (value.tag == Value.TAG_LIST) {
      return Value.flag(Value.size(value) == 0);
    }
    if (value.tag == Value.TAG_STRING) {
      return Value.flag(value.str.isEmpty());
    }
    throw fail(
        FlangError.CODE_BUILTIN_ARGS,
        "«пусто»: ожидается строка или список, получено " + Value.typeName(value));
  }

  /** «голова». */
  public static Value bHead(Ctx ctx, Value value) {
    Value list = expectList("голова", value, "аргумент");
    if (Value.size(list) == 0) {
      throw fail(FlangError.CODE_BUILTIN_ARGS, "«голова»: список пуст");
    }
    return Value.at(list, 0);
  }

  /**
   * «хвост».
   *
   * Копирует, как и в JS: список flang — массив, а массив нельзя разделить с
   * суффиксом без копирования. Значит рекурсия «голова и хвост» по длинному
   * списку квадратична, ровно как у интерпретатора; для больших данных язык
   * даёт линейные «свёртка», «отобразить» и «отфильтровать».
   */
  public static Value bTail(Ctx ctx, Value value) {
    Value list = expectList("хвост", value, "аргумент");
    if (Value.size(list) == 0) {
      throw fail(FlangError.CODE_BUILTIN_ARGS, "«хвост»: список пуст");
    }
    return Value.list(java.util.Arrays.copyOfRange(list.items, 1, Value.size(list)));
  }

  /*
   * ── Доказанный путь четырёх форм: то же действие без сторожа частичности ──
   *
   * Частичная форма отказывает не всегда, а на пустом. Там, где непустота
   * ДОКАЗАНА проверкой типов (flang/src/types.mjs, «длинаНиз»), узел приезжает
   * с отметкой «доказана», и печать зовёт эти методы. Сверка типа остаётся:
   * expectList ловит не пустоту, а другой вид значения.
   */

  /** «разделить … по …» с доказанно непустым разделителем. */
  public static Value bSplitProven(Ctx ctx, Value source, Value separator) {
    String value = expectString("разделить", source, "строка");
    String mark = expectString("разделить", separator, "разделитель");
    java.util.ArrayList<Value> parts = new java.util.ArrayList<>();
    boolean torn = isTorn(mark);
    int from = 0;
    for (; ; ) {
      int found = torn ? findAligned(value, mark, from) : value.indexOf(mark, from);
      if (found < 0) {
        parts.add(Value.text(value.substring(from)));
        break;
      }
      parts.add(Value.text(value.substring(from, found)));
      from = found + mark.length();
    }
    return Value.list(parts.toArray(new Value[0]));
  }

  /** «код символа» доказанно непустой строки. */
  public static Value bCharCodeProven(Ctx ctx, Value source) {
    return Value.number(expectString("код символа", source, "строка").codePointAt(0));
  }

  /** «голова» доказанно непустого списка. */
  public static Value bHeadProven(Ctx ctx, Value value) {
    Value list = expectList("голова", value, "аргумент");
    /* Ветвь пустого списка недостижима — непустота доказана при печати; читается
       нулевой элемент ровно тем же способом, что в bHead, чтобы у двух дорог не
       разошлось представление списка. */
    return Value.size(list) == 0 ? Value.nothing() : Value.at(list, 0);
  }

  /** «хвост» доказанно непустого списка. */
  public static Value bTailProven(Ctx ctx, Value value) {
    Value list = expectList("хвост", value, "аргумент");
    int n = Value.size(list);
    return Value.list(java.util.Arrays.copyOfRange(list.items, n == 0 ? 0 : 1, n));
  }

  /**
   * «элемент N в СПИСОК».
   *
   * Список flang здесь — массив Java, поэтому N-й элемент стоит того же, что
   * первый: обхода нет. Границы и текст отказа повторяют вычислитель дословно —
   * их сверяет дифференциальная проверка, и «похоже» тут не годится.
   */
  public static Value bElement(Ctx ctx, Value index, Value value) {
    double position = expectInteger("элемент", index, "индекс");
    Value list = expectList("элемент", value, "список");
    int length = Value.size(list);
    double at = position - ctx.indexBase;
    if (at < 0 || at >= length) {
      throw fail(
          FlangError.CODE_BUILTIN_ARGS,
          "«элемент»: индекс " + Value.numberText(position) + " вне списка длиной " + length);
    }
    return Value.at(list, (int) at);
  }

  /**
   * «добавить … к …»: дописывает в конец, исходный список не меняется.
   *
   * За постоянное время, когда ячейка за концом ещё ничья, и копией во всех
   * остальных случаях. Разбор приёма и доказательство неизменяемости лежат при
   * классе Value.Grow; тот же приём и по той же причине стоит в рантаймах C
   * (fl_b_dobavit), Rust (Items::grown) и Go (BAppend).
   *
   * Прежняя безусловная копия была ВЕРНА, но стоила O(длины) за вызов, а значит
   * накопление списка n вызовами — O(n²). Шаг напечатанного кода — вход в
   * функцию, и если один шаг стоит O(длины), предел шагов не ограничивает
   * работу ничем: точка «Строить скобки» от 42 и 0 и 0 и "" и [] при
   * объявленных 5 000 000 шагов упиралась в предел 63,7 с вместо секунды.
   *
   * Просто дописать в общий массив нельзя: два «добавить» от одного значения
   * заняли бы одну ячейку и испортили бы друг друга. Разрешение спрашивается у
   * Grow, а не у длины массива.
   */
  public static Value bAppend(Ctx ctx, Value item, Value value) {
    Value list = expectList("добавить", value, "второй аргумент");
    int end = Value.size(list);
    Value.Grow grow = list.grow;
    if (grow != null && end == grow.filled && end < list.items.length) {
      list.items[end] = item;
      grow.filled = end + 1;
      return Value.grown(list.items, end + 1, grow);
    }
    /* Копия — с запасом, чтобы следующие «добавить» шли уже на месте. Запас
       равен длине, то есть массив удваивается: за n «добавить» перевыделений
       log₂n, а не n. У самого края int запаса брать не из чего — там продление
       идёт впритык, и следующее «добавить» снова копирует. */
    int capacity = end < (Integer.MAX_VALUE - 8) / 2 ? 2 * (end + 1) : end + 1;
    Value[] cells = new Value[capacity];
    System.arraycopy(list.items, 0, cells, 0, end);
    cells[end] = item;
    return Value.grown(cells, end + 1, new Value.Grow(end + 1));
  }

  /**
   * «приписать … к …»: тот же список с элементом впереди.
   *
   * Копирует по той же причине, что `bAppend`, и постоянного времени здесь быть
   * не может: список — массив `Value[]`, ячейки ПЕРЕД началом у него нет, а
   * запасом ёмкости в общем массиве пришлось бы кому-то владеть — значение flang
   * по договору неизменяемо и разделяемо.
   *
   * Копия при этом ОДНА на вызов, а не одна на элемент, как у свёртки, которой
   * приписывание в начало писали до появления формы. Цена по всем восьми целям —
   * в SPEC, раздел «Стоимость встроенных форм».
   */
  public static Value bPrepend(Ctx ctx, Value item, Value value) {
    Value list = expectList("приписать", value, "второй аргумент");
    int size = Value.size(list);
    Value[] next = new Value[size + 1];
    next[0] = item;
    System.arraycopy(list.items, 0, next, 1, size);
    return Value.grown(next, size + 1, new Value.Grow(size + 1));
  }

  /** «остаток от». */
  public static Value bRemainder(Ctx ctx, Value left, Value right) {
    double a = expectNumber("остаток от", left, "делимое");
    double b = expectNumber("остаток от", right, "делитель");
    return Value.number(a % b);
  }

  /** «процентов от»: (процент / 100) * значение, порядок ядра. */
  public static Value bPercentOf(Ctx ctx, Value left, Value right) {
    double a = expectNumber("процентов от", left, "процент");
    double b = expectNumber("процентов от", right, "значение");
    return Value.number((a / 100) * b);
  }

  /* ───────────────────────────── граница входа ─────────────────────────────
   *
   * Объявленные типы параметров — ДАННЫМИ. Прогонщик сверяет по ним значения,
   * пришедшие снаружи, ДО вызова функции.
   *
   * Зачем это здесь, а не в самих функциях. Доказательство завершения
   * `тотальной` стоит НА ТИПЕ: у `неотрицательное` есть дно 0 и потолок 2^53−1, ниже
   * которого `н минус 1` точно меньше `н`, и сторож убывания в такую функцию не
   * печатается вовсе. Значение вне типа выносит вместе с типом и
   * доказательство: `1e300 минус 1` равно `1e300`, цепочка вечна, а ловить её
   * нечем. Дверь одна и стоит она ДО вычисления.
   *
   * Таблицу печатает бэкенд вместе с программой (`entry`), а строит её
   * `flang/src/types.mjs` (`таблицаВхода`) — тем же пониманием слов «значение
   * подходит типу», каким сверяется `flang run --args`.
   */

  /** Не сверяется: значение-функция, параметр полиморфизма, применение типа. */
  public static final int TYPE_UNKNOWN = 0;
  /** Число, включая уточнения `неотрицательное` и `целое`. */
  public static final int TYPE_NUMBER = 1;
  /** Строка. */
  public static final int TYPE_TEXT = 2;
  /** Признак. */
  public static final int TYPE_FLAG = 3;
  /** «ничто». */
  public static final int TYPE_NULL = 4;
  /** Список. */
  public static final int TYPE_LIST = 5;
  /** Запись. */
  public static final int TYPE_RECORD = 6;
  /** Сумма типов. */
  public static final int TYPE_SUM = 7;

  /** Поле записи или варианта: имя и место его типа в таблице типов. */
  public record TypeField(String name, int type) {}

  /** Вариант суммы: имя дискриминанта и отрезок его полей в общем массиве. */
  public record TypeVariant(String name, int fieldFrom, int fieldCount) {}

  /**
   * Объявленный тип. Поля и варианты лежат сплошными отрезками общих массивов,
   * а тип называет своё начало и длину.
   */
  public record TypeSpec(
      int kind,
      String name,
      String owner,
      boolean optional,
      boolean integral,
      boolean bounded,
      double low,
      double high,
      int of,
      int fieldFrom,
      int fieldCount,
      int variantFrom,
      int variantCount) {}

  /** Параметр функции: чей он, как называется и какого он типа. */
  public record EntryParam(String function, String name, int type) {}

  /** Граница входа программы целиком. */
  public record EntryTable(
      TypeSpec[] types, TypeField[] fields, TypeVariant[] variants, EntryParam[] params) {}

  private static void checkNumberType(TypeSpec spec, Value value, String label) {
    if (value.tag != Value.TAG_NUMBER || !Double.isFinite(value.num)) {
      throw fail(FlangError.CODE_TYPE, label + " не соответствует типу " + spec.name());
    }
    /* Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
       порядок, и второй отказ на одном значении был бы вторым текстом про одну
       беду. */
    if (spec.integral() && Math.floor(value.num) != value.num) {
      throw fail(
          FlangError.CODE_TYPE,
          label + ": " + Value.numberText(value.num) + " не целое, а тип " + spec.name() + " — целый");
    }
    if (spec.bounded() && (value.num < spec.low() || value.num > spec.high())) {
      throw fail(
          FlangError.CODE_TYPE, label + ": " + Value.numberText(value.num) + " вне " + spec.name());
    }
  }

  private static void checkFields(
      EntryTable table,
      int from,
      int count,
      Field[] given,
      String label,
      String owner,
      boolean ofVariant) {
    for (int index = 0; index < count; index++) {
      TypeField declared = table.fields()[from + index];
      Field found = null;
      for (Field field : given) {
        if (field.name().equals(declared.name())) {
          found = field;
          break;
        }
      }
      if (found == null) {
        /* Необязательное поле можно не задавать: отсутствие — это «ничто». */
        if (table.types()[declared.type()].optional()) {
          continue;
        }
        if (ofVariant) {
          throw fail(
              FlangError.CODE_TYPE,
              label + ": вариант «" + owner + "» требует поле «" + declared.name() + "»");
        }
        throw fail(
            FlangError.CODE_TYPE,
            label + ": не задано поле «" + declared.name() + "» записи «" + owner + "»");
      }
      checkTyped(table, declared.type(), found.value(), label + "." + declared.name());
    }
  }

  private static void checkTyped(EntryTable table, int index, Value value, String label) {
    if (index < 0 || index >= table.types().length) {
      return;
    }
    TypeSpec spec = table.types()[index];
    /* Необязательный аргумент можно не задавать: отсутствие — это «ничто», а не
       пропуск. Так же считает и ядро FTS. */
    if (spec.optional() && value.tag == Value.TAG_NOTHING) {
      return;
    }
    String mismatch = label + " не соответствует типу " + spec.name();
    switch (spec.kind()) {
      case TYPE_NUMBER -> checkNumberType(spec, value, label);
      case TYPE_TEXT -> {
        if (value.tag != Value.TAG_STRING) {
          throw fail(FlangError.CODE_TYPE, mismatch);
        }
      }
      case TYPE_FLAG -> {
        if (value.tag != Value.TAG_FLAG) {
          throw fail(FlangError.CODE_TYPE, mismatch);
        }
      }
      case TYPE_NULL -> {
        if (value.tag != Value.TAG_NOTHING) {
          throw fail(FlangError.CODE_TYPE, mismatch);
        }
      }
      case TYPE_LIST -> {
        if (value.tag != Value.TAG_LIST) {
          throw fail(FlangError.CODE_TYPE, mismatch);
        }
        for (int at = 0; at < value.items.length; at++) {
          checkTyped(table, spec.of(), value.items[at], label + "[" + at + "]");
        }
      }
      case TYPE_RECORD -> {
        if (value.tag != Value.TAG_RECORD) {
          throw fail(FlangError.CODE_TYPE, mismatch);
        }
        checkFields(table, spec.fieldFrom(), spec.fieldCount(), value.fields, label, spec.owner(), false);
        /* Лишнее поле — тоже несоответствие типу: запись flang тотальна, и поля
           сверх объявленных в ней взяться неоткуда. */
        for (Field field : value.fields) {
          boolean declared = false;
          for (int at = 0; at < spec.fieldCount(); at++) {
            if (table.fields()[spec.fieldFrom() + at].name().equals(field.name())) {
              declared = true;
              break;
            }
          }
          if (!declared) {
            throw fail(
                FlangError.CODE_TYPE,
                label + ": запись «" + spec.owner() + "» не имеет поля «" + field.name() + "»");
          }
        }
      }
      case TYPE_SUM -> {
        if (value.tag != Value.TAG_VARIANT && value.tag != Value.TAG_RECORD) {
          throw fail(FlangError.CODE_TYPE, mismatch);
        }
        TypeVariant found = null;
        if (value.tag == Value.TAG_VARIANT) {
          for (int at = 0; at < spec.variantCount(); at++) {
            if (table.variants()[spec.variantFrom() + at].name().equals(value.str)) {
              found = table.variants()[spec.variantFrom() + at];
              break;
            }
          }
        }
        if (found == null) {
          throw fail(
              FlangError.CODE_TYPE, label + ": ожидался вариант типа «" + spec.owner() + "»");
        }
        checkFields(
            table, found.fieldFrom(), found.fieldCount(), value.fields, label, found.name(), true);
      }
      default -> {
        /* TYPE_UNKNOWN: сверять нечем, и молчание здесь то же самое, каким
           отвечает проверка значений свидетеля на джокер. */
      }
    }
  }

  /**
   * Сверка набора значений с объявленными типами параметров функции.
   *
   * <p>Молчит там, где сверять нечем: имени в таблице нет, число значений с
   * числом параметров не сошлось (об этом скажет диспетчер своим текстом), тип
   * приехал видом TYPE_UNKNOWN. Тексты отказов дословно те же, что у
   * {@code checkValue} свидетеля.
   */
  public static void checkEntry(EntryTable table, String name, Value[] args) {
    int declared = 0;
    for (EntryParam param : table.params()) {
      if (param.function().equals(name)) {
        declared++;
      }
    }
    if (declared == 0 || declared != args.length) {
      return;
    }
    int at = 0;
    for (EntryParam param : table.params()) {
      if (!param.function().equals(name)) {
        continue;
      }
      checkTyped(
          table, param.type(), args[at], "вызов функции «" + name + "»: аргумент «" + param.name() + "»");
      at++;
    }
  }
}
