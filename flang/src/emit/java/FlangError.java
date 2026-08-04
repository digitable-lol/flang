/**
 * Диагностика flang: код и текст, дословно совпадающие с интерпретатором.
 *
 * ── Почему непроверяемое исключение ─────────────────────────────────────────
 * Java — единственный из целевых языков flang, где у автора есть выбор между
 * проверяемым и непроверяемым исключением, и выбор этот не косметический.
 *
 * Проверяемое (extends Exception) заставило бы каждую напечатанную функцию
 * нести `throws FlangError` — а её несёт КАЖДАЯ функция без исключения: ошибку
 * умеет дать любая операция языка, вплоть до сложения двух значений, которые
 * оказались не числами. То есть проверяемость не сообщила бы вызывающему
 * ничего, чего он не знал бы и так, зато сделала бы невозможным вызов
 * напечатанного кода из любого места, где сигнатура задана снаружи (Stream.map,
 * Comparator, Runnable): лямбда с `throws` туда не подходит, и пользователь
 * вынужден был бы оборачивать каждый вызов в try/catch, который тут же
 * перебрасывает то же самое обёрнутым в непроверяемое.
 *
 * Непроверяемое ведёт себя ровно как ошибка в интерпретаторе: прерывает
 * вычисление немедленно и доходит до того, кто действительно готов её
 * обработать (прогонщик, тест, встраивающая система). Это же решение принято в
 * бэкенде Python (там выбора нет) и в бэкенде ftsc → Java для нарушенных
 * свойств — по той же причине.
 *
 * ── Почему код — строка, а не enum ──────────────────────────────────────────
 * Коды flang перечислимы (SPEC, раздел 7), но код нарушенного постусловия
 * приезжает данными из AST — у моделей FTS это «FTS_UTILITY_PROPERTY», и
 * перечисление перестало бы быть источником истины ровно там, где важнее всего
 * совпасть с ядром.
 */
public final class FlangError extends RuntimeException {

  /** Класс сериализуем по наследству; фиксируем версию, иначе -Xlint:serial. */
  private static final long serialVersionUID = 1L;

  /** Коды диагностик (SPEC, раздел 7) — константами, чтобы не разъехались опечатки. */
  public static final String CODE_TYPE = "FLANG_TYPE";
  public static final String CODE_UNKNOWN_NAME = "FLANG_UNKNOWN_NAME";
  public static final String CODE_MATCH = "FLANG_MATCH_NOT_EXHAUSTIVE";
  public static final String CODE_BUILTIN_ARGS = "FLANG_BUILTIN_ARGS";
  public static final String CODE_RECURSION_LIMIT = "FLANG_RECURSION_LIMIT";
  public static final String CODE_PROPERTY = "FLANG_PROPERTY";
  public static final String CODE_PARSE = "FLANG_PARSE";

  /** Код диагностики. */
  private final String code;

  public FlangError(String code, String message) {
    /* Ни причины, ни подавления, но со стеком: он ничего не стоит на отказе и
       бесценен, когда напечатанный код встроен в чужую программу. */
    super(message);
    this.code = code;
  }

  /** Код диагностики: «FLANG_TYPE», «FTS_UTILITY_PROPERTY» и прочие. */
  public String code() {
    return code;
  }

  /** Текст диагностики; никогда не null, в отличие от getMessage() вообще. */
  public String text() {
    String message = getMessage();
    return message == null ? "" : message;
  }
}
