/**
 * Прогонщик программы flang: JSON на входе, JSON на выходе.
 *
 * Зачем он есть. Напечатанный класс на Java — это библиотека, и вызвать её
 * можно только из Java. Но проверить кодогенератор нужно ровно одним способом —
 * сверкой с интерпретатором на сетке из тысяч входов, а поднимать JVM ради
 * каждой точки сетки — это тысячи запусков процесса по сотне миллисекунд
 * каждый. Поэтому бэкенд печатает ещё и прогонщик: один запуск, дальше поток
 * запросов через трубу.
 *
 * Побочная польза больше основной: точно так же программу на flang вызывает
 * любой язык, у которого есть трубы, — Node, shell, Go. Ни JNI, ни сервера.
 *
 * ── Протокол (тот же, что у бэкендов C, Go, Rust и Python) ──────────────────
 * Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
 * Ответ  — одна строка:  {"ok":true,"value":…}
 *                        {"ok":false,"code":"FLANG_TYPE","message":"…"}
 *
 * Значения размечены тегами, потому что JSON беднее flang:
 *
 *     null            «ничто»
 *     true / false    признак
 *     {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
 *                     (по той же причине строкой едут «depth» и «steps»)
 *     {"s":"текст"}   строка
 *     {"l":[…]}       список
 *     {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
 *     {"v":"Имя","f":[["поле",…]]}       вариант
 *
 * ── Почему свой разбор JSON, а не библиотека ────────────────────────────────
 * В стандартной библиотеке Java разбора JSON нет вовсе (jakarta.json и Jackson
 * — внешние зависимости), а напечатанная программа обязана собираться одним
 * `javac *.java` без единого jar. Нужное подмножество мало: строки, числа
 * (которые всё равно едут строками), списки, объекты, три литерала — сотня
 * строк, зато ни от чего не зависит.
 *
 * ── Почему поток с большим стеком ───────────────────────────────────────────
 * Предел глубины вызовов flang по умолчанию 10⁴, и упереться в него обязан
 * счётчик языка, а не стек JVM: StackOverflowError — это Error, вылетающий в
 * произвольной точке, а не диагностика. Поэтому вычисление живёт в потоке с
 * явно заданным большим стеком (Flang.withDeepStack), а не в главном, чей
 * размер задан при запуске JVM.
 *
 * ── Какой класс исполнять ───────────────────────────────────────────────────
 * Имя класса программы приходит первым аргументом командной строки: файл
 * программы называется по имени модуля flang, а прогонщик печатается байт в
 * байт и знать этого имени заранее не может. Без аргумента берётся
 * «FlangProgram». Вызов идёт через отражение — это единственный способ
 * связаться с классом, которого во время компиляции прогонщика ещё нет.
 */
public final class FlangCli {

  private FlangCli() {}

  private static final String DEFAULT_PROGRAM_CLASS = "FlangProgram";

  /* ───────────────────────────── разбор JSON ───────────────────────────── */

  /**
   * Разбор минимального подмножества JSON.
   *
   * Узлы представлены типами Java: String, Boolean, null, java.util.List и
   * java.util.LinkedHashMap (порядок ключей сохраняется — он наблюдаем в
   * полях записи). Число разбирается в String: числа протокола и так едут
   * строками, а числа структуры («l», «r») в протоколе не встречаются.
   */
  private static final class Json {
    private final String source;
    private int at;

    Json(String source) {
      this.source = source;
    }

    static Object parse(String source) {
      Json reader = new Json(source);
      reader.spaces();
      Object value = reader.value();
      reader.spaces();
      if (reader.at != source.length()) {
        throw new IllegalArgumentException("лишние знаки после значения JSON");
      }
      return value;
    }

    private void spaces() {
      while (at < source.length()) {
        char symbol = source.charAt(at);
        if (symbol == ' ' || symbol == '\t' || symbol == '\n' || symbol == '\r') {
          at += 1;
        } else {
          return;
        }
      }
    }

    private Object value() {
      if (at >= source.length()) {
        throw new IllegalArgumentException("значение JSON оборвано");
      }
      char symbol = source.charAt(at);
      if (symbol == '{') {
        return object();
      }
      if (symbol == '[') {
        return array();
      }
      if (symbol == '"') {
        return string();
      }
      if (source.startsWith("true", at)) {
        at += 4;
        return Boolean.TRUE;
      }
      if (source.startsWith("false", at)) {
        at += 5;
        return Boolean.FALSE;
      }
      if (source.startsWith("null", at)) {
        at += 4;
        return null;
      }
      return number();
    }

    private java.util.Map<String, Object> object() {
      java.util.LinkedHashMap<String, Object> result = new java.util.LinkedHashMap<>();
      at += 1;
      spaces();
      if (at < source.length() && source.charAt(at) == '}') {
        at += 1;
        return result;
      }
      for (; ; ) {
        spaces();
        String key = string();
        spaces();
        expect(':');
        spaces();
        result.put(key, value());
        spaces();
        if (at < source.length() && source.charAt(at) == ',') {
          at += 1;
          continue;
        }
        expect('}');
        return result;
      }
    }

    private java.util.List<Object> array() {
      java.util.ArrayList<Object> result = new java.util.ArrayList<>();
      at += 1;
      spaces();
      if (at < source.length() && source.charAt(at) == ']') {
        at += 1;
        return result;
      }
      for (; ; ) {
        spaces();
        result.add(value());
        spaces();
        if (at < source.length() && source.charAt(at) == ',') {
          at += 1;
          continue;
        }
        expect(']');
        return result;
      }
    }

    private String string() {
      expect('"');
      StringBuilder out = new StringBuilder();
      while (at < source.length()) {
        char symbol = source.charAt(at);
        at += 1;
        if (symbol == '"') {
          return out.toString();
        }
        if (symbol != '\\') {
          out.append(symbol);
          continue;
        }
        char escaped = source.charAt(at);
        at += 1;
        switch (escaped) {
          case '"':
            out.append('"');
            break;
          case '\\':
            out.append('\\');
            break;
          case '/':
            out.append('/');
            break;
          case 'b':
            out.append('\b');
            break;
          case 'f':
            out.append('\f');
            break;
          case 'n':
            out.append('\n');
            break;
          case 'r':
            out.append('\r');
            break;
          case 't':
            out.append('\t');
            break;
          case 'u':
            out.append((char) Integer.parseInt(source.substring(at, at + 4), 16));
            at += 4;
            break;
          default:
            throw new IllegalArgumentException("неизвестная escape-последовательность JSON");
        }
      }
      throw new IllegalArgumentException("строка JSON не закрыта");
    }

    private String number() {
      int from = at;
      while (at < source.length()) {
        char symbol = source.charAt(at);
        boolean digit = symbol >= '0' && symbol <= '9';
        if (digit || symbol == '-' || symbol == '+' || symbol == '.' || symbol == 'e' || symbol == 'E') {
          at += 1;
        } else {
          break;
        }
      }
      if (from == at) {
        throw new IllegalArgumentException("не значение JSON");
      }
      return source.substring(from, at);
    }

    private void expect(char symbol) {
      if (at >= source.length() || source.charAt(at) != symbol) {
        throw new IllegalArgumentException("ожидался знак «" + symbol + "» в JSON");
      }
      at += 1;
    }
  }

  /* ───────────────────────────── чтение значений ───────────────────────── */

  /** Число приезжает строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля. */
  private static double parseNumber(String value) {
    if ("NaN".equals(value)) {
      return Double.NaN;
    }
    if ("Infinity".equals(value)) {
      return Double.POSITIVE_INFINITY;
    }
    if ("-Infinity".equals(value)) {
      return Double.NEGATIVE_INFINITY;
    }
    try {
      return Double.parseDouble(value);
    } catch (NumberFormatException error) {
      return Double.NaN;
    }
  }

  /** Значение из размеченного JSON. */
  private static Value decodeValue(Object node) {
    if (node == null) {
      return Value.nothing();
    }
    if (node instanceof Boolean) {
      return Value.flag((Boolean) node);
    }
    if (!(node instanceof java.util.Map)) {
      throw new IllegalArgumentException("нечего декодировать");
    }
    @SuppressWarnings("unchecked")
    java.util.Map<String, Object> object = (java.util.Map<String, Object>) node;
    if (object.containsKey("n")) {
      return Value.number(parseNumber((String) object.get("n")));
    }
    if (object.containsKey("s")) {
      return Value.text((String) object.get("s"));
    }
    if (object.containsKey("l")) {
      @SuppressWarnings("unchecked")
      java.util.List<Object> items = (java.util.List<Object>) object.get("l");
      Value[] result = new Value[items.size()];
      for (int index = 0; index < result.length; index++) {
        result[index] = decodeValue(items.get(index));
      }
      return Value.list(result);
    }
    if (object.containsKey("r")) {
      return Value.record(decodeFields(object.get("r")));
    }
    if (object.containsKey("v")) {
      Object fields = object.containsKey("f") ? object.get("f") : new java.util.ArrayList<Object>();
      return Value.variant((String) object.get("v"), decodeFields(fields));
    }
    throw new IllegalArgumentException("нечего декодировать");
  }

  /** Поля записи или варианта: список пар «имя, значение». */
  private static Field[] decodeFields(Object node) {
    @SuppressWarnings("unchecked")
    java.util.List<Object> pairs = (java.util.List<Object>) node;
    Field[] result = new Field[pairs.size()];
    for (int index = 0; index < result.length; index++) {
      @SuppressWarnings("unchecked")
      java.util.List<Object> pair = (java.util.List<Object>) pairs.get(index);
      if (pair.size() != 2) {
        throw new IllegalArgumentException("пара «имя, значение» обязана быть из двух элементов");
      }
      result[index] = new Field((String) pair.get(0), decodeValue(pair.get(1)));
    }
    return result;
  }

  /* ───────────────────────────── печать значений ───────────────────────── */

  /** Значение в размеченный JSON. */
  private static void encodeValue(StringBuilder out, Value value) {
    switch (value.tag) {
      case Value.TAG_NOTHING:
        out.append("null");
        return;
      case Value.TAG_FLAG:
        out.append(value.bit ? "true" : "false");
        return;
      case Value.TAG_NUMBER:
        out.append("{\"n\":");
        /* −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно, а
           Number::toString печатает «0» и для того, и для другого. */
        if (value.num == 0.0 && Double.doubleToRawLongBits(value.num) < 0) {
          out.append("\"-0\"");
        } else {
          out.append(Value.quoteJson(Value.numberText(value.num)));
        }
        out.append('}');
        return;
      case Value.TAG_STRING:
        out.append("{\"s\":").append(Value.quoteJson(value.str)).append('}');
        return;
      case Value.TAG_LIST:
        out.append("{\"l\":[");
        for (int index = 0; index < Value.size(value); index++) {
          if (index > 0) {
            out.append(',');
          }
          encodeValue(out, Value.at(value, index));
        }
        out.append("]}");
        return;
      case Value.TAG_RECORD:
        out.append("{\"r\":");
        encodeFields(out, value.fields);
        out.append('}');
        return;
      case Value.TAG_VARIANT:
        out.append("{\"v\":").append(Value.quoteJson(value.str)).append(",\"f\":");
        encodeFields(out, value.fields);
        out.append('}');
        return;
      default:
        out.append("null");
    }
  }

  private static void encodeFields(StringBuilder out, Field[] fields) {
    out.append('[');
    for (int index = 0; index < fields.length; index++) {
      if (index > 0) {
        out.append(',');
      }
      out.append('[').append(Value.quoteJson(fields[index].name())).append(',');
      encodeValue(out, fields[index].value());
      out.append(']');
    }
    out.append(']');
  }

  /* ───────────────────────────── запрос ───────────────────────────── */

  private static String failure(String code, String message) {
    return "{\"ok\":false,\"code\":" + Value.quoteJson(code) + ",\"message\":"
        + Value.quoteJson(message) + "}";
  }

  /**
   * Мост к напечатанной программе.
   *
   * Класса программы во время компиляции прогонщика ещё нет — он появляется
   * рядом при печати, — поэтому связь идёт отражением: «newContext» без
   * аргументов и «call(Ctx, String, Value[])».
   */
  private static final class Program {
    private final java.lang.reflect.Method contextMethod;
    private final java.lang.reflect.Method callMethod;

    Program(String name) throws ReflectiveOperationException {
      Class<?> type = Class.forName(name);
      contextMethod = type.getMethod("newContext");
      callMethod = type.getMethod("call", Ctx.class, String.class, Value[].class);
    }

    Ctx newContext() throws ReflectiveOperationException {
      return (Ctx) contextMethod.invoke(null);
    }

    Value call(Ctx ctx, String name, Value[] args) throws ReflectiveOperationException {
      return (Value) callMethod.invoke(null, ctx, name, args);
    }
  }

  /** Один запрос: разбор, вызов, ответ. Исключения наружу не выпускаются. */
  private static String runRequest(Program program, String line) {
    Object parsed;
    try {
      parsed = Json.parse(line);
    } catch (RuntimeException error) {
      return failure("CLI", "неразборчивый запрос");
    }
    if (!(parsed instanceof java.util.Map)) {
      return failure("CLI", "в запросе нет имени функции");
    }
    @SuppressWarnings("unchecked")
    java.util.Map<String, Object> query = (java.util.Map<String, Object>) parsed;
    Object name = query.get("fn");
    if (!(name instanceof String) || ((String) name).isEmpty()) {
      return failure("CLI", "в запросе нет имени функции");
    }

    Ctx ctx;
    try {
      ctx = program.newContext();
    } catch (ReflectiveOperationException error) {
      return failure("CLI", "программа не даёт контекста вычисления");
    }
    Object depth = query.get("depth");
    if (depth instanceof String && !((String) depth).isEmpty()) {
      ctx.maxDepth = (int) parseNumber((String) depth);
    }
    Object steps = query.get("steps");
    if (steps instanceof String && !((String) steps).isEmpty()) {
      ctx.maxSteps = (long) parseNumber((String) steps);
    }

    Value[] args;
    try {
      Object list = query.get("args");
      java.util.List<Object> raw =
          list == null ? new java.util.ArrayList<>() : castList(list);
      args = new Value[raw.size()];
      for (int index = 0; index < args.length; index++) {
        args[index] = decodeValue(raw.get(index));
      }
    } catch (RuntimeException error) {
      return failure("CLI", "неразборчивые аргументы");
    }

    Value result;
    try {
      result = program.call(ctx, (String) name, args);
    } catch (java.lang.reflect.InvocationTargetException wrapped) {
      Throwable cause = wrapped.getCause();
      if (cause instanceof FlangError) {
        FlangError error = (FlangError) cause;
        return failure(error.code(), error.text());
      }
      if (cause instanceof StackOverflowError) {
        /* Стек JVM кончился раньше предела языка: так бывает только при
           заведомо запредельном max_depth. Молчать нельзя — но и притворяться
           диагностикой языка тоже. */
        return failure(
            FlangError.CODE_RECURSION_LIMIT,
            "стек JVM исчерпан раньше предела глубины flang");
      }
      return failure("CLI", cause == null ? "вычисление сорвалось" : String.valueOf(cause));
    } catch (ReflectiveOperationException error) {
      return failure("CLI", "программа не даёт вызова по имени");
    }
    StringBuilder out = new StringBuilder("{\"ok\":true,\"value\":");
    encodeValue(out, result);
    return out.append('}').toString();
  }

  @SuppressWarnings("unchecked")
  private static java.util.List<Object> castList(Object value) {
    return (java.util.List<Object>) value;
  }

  /** Цикл «строка запроса → строка ответа». Ответ ровно один на запрос. */
  private static void serve(Program program, java.io.BufferedReader source, java.io.PrintWriter sink)
      throws java.io.IOException {
    String line;
    while ((line = source.readLine()) != null) {
      String request = line.trim();
      if (request.isEmpty()) {
        continue;
      }
      /* Явный «\n», а не println: разделитель строк в протоколе задан
         протоколом, а не платформой, на которой запустили JVM. */
      sink.print(runRequest(program, request));
      sink.print('\n');
      sink.flush();
    }
  }

  public static void main(String[] argv) throws Exception {
    String name = argv.length > 0 ? argv[0] : DEFAULT_PROGRAM_CLASS;
    Program program = new Program(name);
    java.io.BufferedReader source =
        new java.io.BufferedReader(
            new java.io.InputStreamReader(System.in, java.nio.charset.StandardCharsets.UTF_8));
    java.io.PrintWriter sink =
        new java.io.PrintWriter(
            new java.io.OutputStreamWriter(System.out, java.nio.charset.StandardCharsets.UTF_8));
    Flang.withDeepStack(
        () -> {
          try {
            serve(program, source, sink);
          } catch (java.io.IOException error) {
            throw new java.io.UncheckedIOException(error);
          }
          return null;
        });
    sink.flush();
  }
}
