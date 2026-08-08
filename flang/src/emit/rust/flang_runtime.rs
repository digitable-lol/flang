// Рантайм flang для бэкенда Rust.
//
// Этот файл печатается бэкендом как есть, байт в байт: он лежит рядом
// настоящим .rs, а не строкой внутри emit/rust.mjs, поэтому его проверяет
// компилятор прямо в репозитории, а правка рантайма не превращается в правку
// экранирования внутри шаблона. Единственное, что бэкенд делает с ним, —
// приписывает шапку «сгенерировано, не редактировать» перед первой строкой.
//
// ── Представление значения: один динамический `enum` ────────────────────────
// В Rust есть настоящие суммы типов, и соблазн напечатать каждую сумму flang
// отдельным `enum` велик. Он обманчив ровно по тем же причинам, по которым в
// бэкенде Go был отвергнут интерфейс с методом-маркером:
//
//   • SPEC требует структурного равенства ЛЮБЫХ двух значений — а «любых»
//     означает разнотипных, то есть один тип, объемлющий все;
//   • сообщение «разбор не покрывает значение Лист(значение)» печатает имя
//     варианта и имена его полей в рантайме;
//   • доступ к полю идёт ПО ИМЕНИ, которое приезжает из AST строкой;
//   • значение приходит снаружи (прогонщик, тест, чужой язык через трубу) и
//     обязано собираться из данных, а не из статически известного типа.
//
// В Rust всё это потребовало бы либо `dyn Any` с нисходящим приведением, либо
// внешнего крейта сериализации — то есть второго, теневого представления рядом
// с первым. Два представления одного значения дают два набора расхождений с
// интерпретатором, а расхождений быть не должно ни одного. Поэтому
// представление одно — `Value`, — а типизированный слой поверх него бэкенд
// печатает функциями-конструкторами: на каждый вариант суммы и на каждую
// запись своя функция с именованными параметрами.
//
// Настоящий `enum` Rust здесь всё же выигран, и это не мелочь: в Go тег и поля
// лежали в одной структуре, и «число со списком внутри» было представимо;
// здесь недопустимое состояние не выражается вовсе.
//
// ── Владение: `Rc`, а не `Box` ─────────────────────────────────────────────
// Значения flang неизменяемы, а «хвост» обязан отдавать суффикс списка без
// копирования (иначе рекурсия «голова и хвост» становится квадратичной).
// `Box` — единственное владение, и хвост пришлось бы копировать; `Rc` — общее,
// и хвост это тот же массив со сдвинутым началом. Клонирование значения стоит
// один инкремент счётчика, поэтому напечатанный код клонирует свободно и нигде
// не борется с проверкой заимствований.
//
// Многопоточности здесь нет и не предполагается: вычисление flang
// детерминировано и однопоточно, а `Arc` стоил бы атомарных операций на каждое
// клонирование ради возможности, которой никто не воспользуется.
//
// ── Ошибки: `Result`, и ни одной паники ────────────────────────────────────
// `panic!` в Rust означает «инвариант программы сломан»; ошибка flang означает
// «программа отработала и говорит нет». Это разные жанры, и путать их нельзя:
// паника не даёт вызывающему ни кода, ни текста, а коды и тексты обязаны
// дословно совпадать с интерпретатором. Поэтому здесь нет ни одного
// `unwrap()`, ни одной индексации срезом по вычисленному индексу и ни одного
// арифметического переполнения: всякий доступ идёт через `get`, всякий отказ —
// значением `Err(Error)`.
//
// Код ошибки — строка, а не вариант перечисления: коды flang перечислимы, но
// код нарушенного постусловия приезжает данными из AST («FTS_UTILITY_PROPERTY»
// у моделей FTS), и перечисление перестало бы быть источником истины ровно
// там, где важнее всего совпасть с ядром.
//
// ── Числа ──────────────────────────────────────────────────────────────────
// Все числа flang — IEEE-754 double, значит везде `f64`, в том числе там, где
// число выглядит целым. Печать числа обязана давать тот же текст, что
// Number::toString («1», а не «1.0», «1e+21», а не «1000000000000000000000»),
// поэтому здесь лежит `number_text` — правила ECMAScript дословно. `{}` для
// `f64` в Rust не годится: он не переходит к экспоненте никогда, `{:e}` —
// всегда, а ECMAScript — по своим порогам (n > 21 и n ≤ −6).
//
// ── Строки ─────────────────────────────────────────────────────────────────
// Rust индексирует `str` байтами, flang считает кодовыми точками. Отсюда
// `chars()` в «длина», «символ» и «подстрока» — иначе «мир 🌍» оказался бы
// длиной 8, а не 5, а срез по байтовому индексу ещё и паниковал бы на границе
// символа.

use std::cell::Cell;
use std::fmt;
use std::rc::Rc;

// ───────────────────────────── коды диагностик ─────────────────────────────

/// Код диагностики: несовпадение типов.
pub const CODE_TYPE: &str = "FLANG_TYPE";
/// Код диагностики: имя не связано.
pub const CODE_UNKNOWN_NAME: &str = "FLANG_UNKNOWN_NAME";
/// Код диагностики: разбор не покрывает значение.
pub const CODE_MATCH: &str = "FLANG_MATCH_NOT_EXHAUSTIVE";
/// Код диагностики: неверные аргументы встроенной формы.
pub const CODE_BUILTIN_ARGS: &str = "FLANG_BUILTIN_ARGS";
/// Код диагностики: исчерпан предел глубины или лимит шагов.
pub const CODE_RECURSION_LIMIT: &str = "FLANG_RECURSION_LIMIT";
/// Код диагностики: нарушено постусловие без собственного кода.
pub const CODE_PROPERTY: &str = "FLANG_PROPERTY";
/// Код диагностики: программа не разобрана.
pub const CODE_PARSE: &str = "FLANG_PARSE";

/// Диагностика flang: код и текст, дословно совпадающие с интерпретатором.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Error {
    /// Код диагностики: `FLANG_TYPE`, `FTS_UTILITY_PROPERTY` и прочие.
    pub code: String,
    /// Текст диагностики — тот же, что печатает интерпретатор.
    pub message: String,
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for Error {}

/// Собирает диагностику. Возвращает значение, а не паникует: вызывающий обязан
/// уметь отличить нарушение свойства модели от поломки движка.
pub fn fail(code: &str, message: String) -> Error {
    Error { code: code.to_string(), message }
}

// ───────────────────────────── значения ─────────────────────────────

/// Имя поля, варианта или содержимое строки: разделяемое, клонируется даром.
pub type Name = Rc<str>;

/// Поле записи или варианта. Порядок полей сохраняется: он наблюдаем при печати
/// значения наружу, хотя на равенство и не влияет.
#[derive(Debug, Clone)]
pub struct Field {
    /// Имя поля в исходной программе flang.
    pub name: Name,
    /// Значение поля.
    pub value: Value,
}

/// Элементы списка: общий массив плюс начало.
///
/// Начало — это и есть «хвост»: суффикс списка не копируется, а разделяется.
/// Значения flang неизменяемы, поэтому разделять безопасно, а рекурсия «голова
/// и хвост» из квадратичной становится линейной.
#[derive(Debug, Clone)]
pub struct Items {
    data: Rc<Vec<Value>>,
    start: usize,
}

impl Items {
    /// Список из готового массива.
    pub fn new(data: Vec<Value>) -> Items {
        Items { data: Rc::new(data), start: 0 }
    }

    /// Число элементов.
    pub fn len(&self) -> usize {
        self.data.len().saturating_sub(self.start)
    }

    /// Пуст ли список.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Элемент по индексу от нуля; `None` вместо паники за границей.
    pub fn get(&self, index: usize) -> Option<&Value> {
        self.data.get(self.start.checked_add(index)?)
    }

    /// Все элементы подряд.
    pub fn as_slice(&self) -> &[Value] {
        self.data.get(self.start..).unwrap_or(&[])
    }

    /// Обход элементов.
    pub fn iter(&self) -> std::slice::Iter<'_, Value> {
        self.as_slice().iter()
    }

    /// Суффикс без первого элемента — сдвиг начала, а не копия.
    pub fn tail(&self) -> Items {
        Items { data: Rc::clone(&self.data), start: self.start.saturating_add(1).min(self.data.len()) }
    }
}

/// Вариант суммы типов: имя-дискриминант и поля.
#[derive(Debug, Clone)]
pub struct VariantData {
    /// Имя варианта в исходной программе flang.
    pub name: Name,
    /// Поля варианта в порядке объявления.
    pub fields: Vec<Field>,
}

/// Значение flang (SPEC, раздел 2). Ровно одно представление на все виды:
/// см. шапку файла.
#[derive(Debug, Clone)]
pub enum Value {
    /// «ничто»
    Nothing,
    /// число — IEEE-754 double
    Number(f64),
    /// признак
    Flag(bool),
    /// строка — UTF-8, меряется кодовыми точками
    Text(Name),
    /// список
    List(Items),
    /// запись — объект FTS
    Record(Rc<Vec<Field>>),
    /// вариант — конструктор суммы типов
    Variant(Rc<VariantData>),
}

/// «ничто».
pub fn nothing() -> Value {
    Value::Nothing
}

/// Число.
pub fn number(value: f64) -> Value {
    Value::Number(value)
}

/// Признак.
pub fn flag(value: bool) -> Value {
    Value::Flag(value)
}

/// Строка.
pub fn text(value: &str) -> Value {
    Value::Text(Rc::from(value))
}

/// Список из готового массива.
pub fn list(items: Vec<Value>) -> Value {
    Value::List(Items::new(items))
}

/// Запись из готового набора полей.
pub fn record(fields: Vec<Field>) -> Value {
    Value::Record(Rc::new(fields))
}

/// Вариант суммы типов.
pub fn variant(name: &str, fields: Vec<Field>) -> Value {
    Value::Variant(Rc::new(VariantData { name: Rc::from(name), fields }))
}

/// Поле записи или варианта.
pub fn field(name: &str, value: Value) -> Field {
    Field { name: Rc::from(name), value }
}

/// Скаляр ли значение (SPEC, раздел 2: строка, число, признак, ничто).
pub fn is_scalar(value: &Value) -> bool {
    matches!(value, Value::Nothing | Value::Number(_) | Value::Flag(_) | Value::Text(_))
}

/// Список ли значение.
pub fn is_list(value: &Value) -> bool {
    matches!(value, Value::List(_))
}

/// Пустая ли цепочка — образец «случай пусто».
///
/// Цепочка — список ЛИБО строка: образцы `пусто` и `голова и хвост` разбирают
/// обе. У строки ровно два случая, пустая и «первый символ и остаток»,
/// третьего нет. По кодовым точкам: `chars()` в Rust идёт по ним, поэтому срез
/// здесь совпадает с «символ» и «символы» без дополнительных усилий.
pub fn chain_empty(value: &Value) -> bool {
    match value {
        Value::Text(text) => text.is_empty(),
        Value::List(items) => items.is_empty(),
        _ => false,
    }
}

/// Непустая ли цепочка — образец «случай голова и хвост».
pub fn chain_cons(value: &Value) -> bool {
    match value {
        Value::Text(text) => !text.is_empty(),
        Value::List(items) => !items.is_empty(),
        _ => false,
    }
}

/// Вариант ли значение с именно этим именем (проверка дискриминанта).
pub fn variant_is(value: &Value, name: &str) -> bool {
    match value {
        Value::Variant(data) => &*data.name == name,
        _ => false,
    }
}

/// Голова непустого списка. Образец уже проверил непустоту, поэтому «нет
/// головы» здесь недостижимо; на всякий случай это «ничто», а не паника.
pub fn chain_head(value: &Value) -> Value {
    match value {
        Value::Text(source) => match source.chars().next() {
            Some(point) => text(&point.to_string()),
            None => Value::Nothing,
        },
        Value::List(items) => items.get(0).cloned().unwrap_or(Value::Nothing),
        _ => Value::Nothing,
    }
}

/// Хвост непустой цепочки: у списка — суффикс без копирования (см.
/// `Items::tail`), у строки — остаток после первой кодовой точки.
pub fn chain_tail(value: &Value) -> Value {
    match value {
        Value::Text(source) => match source.chars().next() {
            Some(point) => text(&source[point.len_utf8()..]),
            None => text(""),
        },
        Value::List(items) => Value::List(items.tail()),
        _ => Value::List(Items::new(Vec::new())),
    }
}

/// Имя типа значения для диагностик (`typeName` интерпретатора).
pub fn type_name(value: &Value) -> String {
    match value {
        Value::Nothing => "ничто".to_string(),
        Value::Text(_) => "строка".to_string(),
        Value::Number(_) => "число".to_string(),
        Value::Flag(_) => "признак".to_string(),
        Value::List(_) => "список".to_string(),
        Value::Variant(data) => format!("вариант «{}»", data.name),
        Value::Record(_) => "запись".to_string(),
    }
}

/// Короткое описание значения для диагностик (`describeValue` интерпретатора).
/// Порядок разбора повторяет оригинал: строка, вариант, список, запись,
/// «ничто», признак, число.
pub fn describe(value: &Value) -> String {
    match value {
        Value::Text(item) => quote_json(item),
        Value::Variant(data) => {
            if data.fields.is_empty() {
                return data.name.to_string();
            }
            let names: Vec<&str> = data.fields.iter().map(|item| &*item.name).collect();
            format!("{}({})", data.name, names.join(", "))
        }
        Value::List(items) => format!("список из {}", items.len()),
        Value::Record(fields) => {
            let names: Vec<&str> = fields.iter().map(|item| &*item.name).collect();
            format!("запись {{{}}}", names.join(", "))
        }
        Value::Nothing => "ничто".to_string(),
        Value::Flag(item) => (if *item { "да" } else { "нет" }).to_string(),
        Value::Number(item) => number_text(*item),
    }
}

// ───────────────────────────── равенство ─────────────────────────────

/// `Object.is` для чисел: NaN равен NaN, 0 не равен −0 (SPEC, раздел 5).
///
/// Это не придирка: ядро FTS сравнивает значения именно так, и «0.1 плюс 0.2
/// равно 0.3» обязано быть ложью в обоих движках — сравнение с допуском
/// сделало бы его истиной, то есть расхождением с интерпретатором.
fn same_number(left: f64, right: f64) -> bool {
    if left.is_nan() && right.is_nan() {
        return true;
    }
    if left == 0.0 && right == 0.0 {
        return left.is_sign_negative() == right.is_sign_negative();
    }
    left == right
}

/// Равенство значений: скаляры как `Object.is`, составные структурно.
///
/// Рекурсия здесь по данным, а не по программе: её глубина ограничена
/// вложенностью значения, а не длиной вычисления.
pub fn equal(left: &Value, right: &Value) -> bool {
    if is_scalar(left) || is_scalar(right) {
        return match (left, right) {
            (Value::Number(a), Value::Number(b)) => same_number(*a, *b),
            (Value::Flag(a), Value::Flag(b)) => a == b,
            (Value::Text(a), Value::Text(b)) => a == b,
            (Value::Nothing, Value::Nothing) => true,
            _ => false,
        };
    }
    match (left, right) {
        (Value::List(a), Value::List(b)) => {
            a.len() == b.len() && a.iter().zip(b.iter()).all(|(one, other)| equal(one, other))
        }
        (Value::Variant(a), Value::Variant(b)) => a.name == b.name && fields_equal(&a.fields, &b.fields),
        (Value::Record(a), Value::Record(b)) => fields_equal(a, b),
        _ => false,
    }
}

/// Равенство записей: по именам полей, а не по их порядку.
fn fields_equal(left: &[Field], right: &[Field]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter().all(|item| match lookup(right, &item.name) {
        Some(other) => equal(&item.value, other),
        None => false,
    })
}

fn lookup<'a>(fields: &'a [Field], name: &str) -> Option<&'a Value> {
    fields.iter().find(|item| &*item.name == name).map(|item| &item.value)
}

// ───────────────────────────── число в текст ─────────────────────────────

/// Печатает число ровно по правилам ECMAScript Number::toString.
///
/// Это не украшение: «к строке» от числа и тексты диагностик содержат числа, и
/// расхождение хотя бы в одном знаке — это расхождение наблюдаемого поведения
/// с интерпретатором. `{}` для `f64` не годится (1e21 печатается как
/// «1000000000000000000000»), `{:e}` тоже (1 печатается как «1e0»): пороги
/// перехода к экспоненте у ECMAScript свои — n > 21 и n ≤ −6.
pub fn number_text(value: f64) -> String {
    if value.is_nan() {
        return "NaN".to_string();
    }
    if value == 0.0 {
        // String(-0) === "0": знак нуля не печатается, хотя Object.is его различает.
        return "0".to_string();
    }
    let negative = value < 0.0;
    let sign = if negative { "-" } else { "" };
    let value = if negative { -value } else { value };
    if value.is_infinite() {
        return format!("{sign}Infinity");
    }

    /* Кратчайшая запись, читающаяся обратно тем же double: ровно то «s», о
    котором говорит спецификация («k как можно меньше»). */
    let shortest = format!("{value:e}");
    let (mantissa, exponent_text) = match shortest.split_once('e') {
        Some(parts) => parts,
        None => return format!("{sign}{shortest}"),
    };
    let digits: String = mantissa.chars().filter(|symbol| *symbol != '.').collect();
    let exponent: i64 = match exponent_text.parse() {
        Ok(parsed) => parsed,
        Err(_) => return format!("{sign}{shortest}"),
    };

    let k = digits.len() as i64;
    let n = exponent + 1;

    if k <= n && n <= 21 {
        let zeros = "0".repeat((n - k).max(0) as usize);
        return format!("{sign}{digits}{zeros}");
    }
    if 0 < n && n <= 21 {
        let (head, tail) = split_digits(&digits, n as usize);
        return format!("{sign}{head}.{tail}");
    }
    if -6 < n && n <= 0 {
        let zeros = "0".repeat((-n).max(0) as usize);
        return format!("{sign}0.{zeros}{digits}");
    }

    let mut power = n - 1;
    let mark = if power < 0 {
        power = -power;
        "-"
    } else {
        "+"
    };
    if k == 1 {
        return format!("{sign}{digits}e{mark}{power}");
    }
    let (head, tail) = split_digits(&digits, 1);
    format!("{sign}{head}.{tail}e{mark}{power}")
}

/// Деление строки цифр надвое. Цифры — ASCII, поэтому границы по байтам
/// совпадают с границами символов; за пределы длины не выходим никогда.
fn split_digits(digits: &str, at: usize) -> (&str, &str) {
    let at = at.min(digits.len());
    (digits.get(..at).unwrap_or(""), digits.get(at..).unwrap_or(""))
}

/// Строка в кавычках по правилам `JSON.stringify`: ими пользуется
/// `describeValue` интерпретатора, и тексты диагностик обязаны совпасть.
pub fn quote_json(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for symbol in value.chars() {
        match symbol {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            _ => {
                if (symbol as u32) < 0x20 {
                    out.push_str(&format!("\\u{:04x}", symbol as u32));
                } else {
                    out.push(symbol);
                }
            }
        }
    }
    out.push('"');
    out
}

// ───────────────────────────── контекст вызова ─────────────────────────────

/// Предел глубины вызовов по умолчанию — тот же, что у интерпретатора.
pub const DEFAULT_MAX_DEPTH: i64 = 10000;
/// Лимит шагов по умолчанию — тот же, что у интерпретатора.
pub const DEFAULT_MAX_STEPS: i64 = 1000000;
/// База индексации строк по умолчанию: «первый символ» — это первый.
pub const DEFAULT_BASE: i64 = 1;

/// Счётчики пределов и настройка индексации строк.
///
/// Пределы — не украшение. Обычная (не тотальная) функция flang может не
/// завершаться, и интерпретатор ловит это лимитом шагов и глубины. Без
/// счётчиков напечатанная программа в том же месте либо крутилась бы вечно,
/// либо съела бы стек — то есть давала бы не `FLANG_RECURSION_LIMIT`, а
/// зависание или аварийный останов.
///
/// Счётчики лежат в `Cell`, а не за `&mut`: тогда контекст передаётся общей
/// ссылкой, и страж глубины (`Frame`) может держать её же. С `&mut Ctx`
/// страж занял бы контекст целиком, и тело функции не смогло бы им
/// воспользоваться — а без стража глубина не убывала бы на ошибке.
///
/// Оговорка о шаге. Шаг интерпретатора — итерация его машины, а не вызов
/// функции: одно применение функции стоит там многих шагов. Здесь шагом
/// считается вход в функцию, виток цикла хвостового самовызова и отскок
/// батута. Значит счётчик здесь всегда МЕНЬШЕ счётчика интерпретатора при том
/// же вычислении, и при одинаковом пределе интерпретатор упирается в лимит
/// первым. Расхождение, таким образом, одностороннее и безопасное:
/// напечатанный код не объявит исчерпанным то, что интерпретатор досчитал.
#[derive(Debug)]
pub struct Ctx {
    depth: Cell<i64>,
    max_depth: Cell<i64>,
    steps: Cell<i64>,
    max_steps: Cell<i64>,
    index_base: Cell<i64>,
}

impl Default for Ctx {
    fn default() -> Ctx {
        Ctx::new()
    }
}

impl Ctx {
    /// Контекст с пределами интерпретатора и индексацией строк с 1.
    pub fn new() -> Ctx {
        Ctx {
            depth: Cell::new(0),
            max_depth: Cell::new(DEFAULT_MAX_DEPTH),
            steps: Cell::new(0),
            max_steps: Cell::new(DEFAULT_MAX_STEPS),
            index_base: Cell::new(DEFAULT_BASE),
        }
    }

    /// Текущая глубина вызовов.
    pub fn depth(&self) -> i64 {
        self.depth.get()
    }

    /// База индексации строк: 1 по умолчанию, 0 — если так печатали.
    pub fn index_base(&self) -> i64 {
        self.index_base.get()
    }

    /// Меняет базу индексации строк.
    pub fn set_index_base(&self, value: i64) {
        self.index_base.set(value);
    }

    /// Меняет предел глубины вызовов.
    pub fn set_max_depth(&self, value: i64) {
        self.max_depth.set(value);
    }

    /// Меняет лимит шагов.
    pub fn set_max_steps(&self, value: i64) {
        self.max_steps.set(value);
    }

    /// Виток вычисления: цикл хвостового самовызова, отскок батута, вход в
    /// функцию. Считается отдельно от глубины: хвостовая рекурсия глубину не
    /// растит, но завершаться от этого не начинает.
    pub fn step(&self, function: &str) -> Result<(), Error> {
        let steps = self.steps.get().saturating_add(1);
        self.steps.set(steps);
        let limit = self.max_steps.get();
        if limit > 0 && steps > limit {
            return Err(fail(
                CODE_RECURSION_LIMIT,
                format!(
                    "функция «{function}» исчерпала лимит шагов ({limit}) на глубине вызовов {}",
                    self.depth.get()
                ),
            ));
        }
        Ok(())
    }

    /// Вход в функцию, способную к рекурсии. Возвращённый страж уменьшает
    /// глубину при выходе — в том числе при выходе с ошибкой, потому что
    /// иначе первая же пойманная ошибка навсегда съела бы предел.
    pub fn enter(&self, function: &str) -> Result<Frame<'_>, Error> {
        self.step(function)?;
        let limit = self.max_depth.get();
        let next = self.depth.get().saturating_add(1);
        if limit > 0 && next > limit {
            return Err(fail(
                CODE_RECURSION_LIMIT,
                format!("функция «{function}» превысила предел глубины вызовов ({limit}) на глубине {next}"),
            ));
        }
        self.depth.set(next);
        Ok(Frame { ctx: self })
    }
}

/// Страж глубины: пока он жив, кадр вызова учтён.
///
/// В Go то же самое делает `defer ctx.Leave()`; в Rust — `Drop`, и это даже
/// надёжнее: страж срабатывает и на раннем возврате через `?`, и на любом
/// другом выходе из области видимости.
#[derive(Debug)]
pub struct Frame<'a> {
    ctx: &'a Ctx,
}

impl Drop for Frame<'_> {
    fn drop(&mut self) {
        self.ctx.depth.set(self.ctx.depth.get().saturating_sub(1));
    }
}

// ───────────────────────────── батут ─────────────────────────────

/// Шаг батута: либо кладёт значение, либо заполняет отскок.
pub type StepFn = fn(&Ctx, Vec<Value>, &mut Bounce) -> Result<Value, Error>;

/// Отскок: следующая функция компоненты и её аргументы.
///
/// Взаимная хвостовая рекурсия («Чётное»/«Нечётное») у интерпретатора идёт в
/// постоянной глубине — он переиспользует кадр возврата. Обычный вызов Rust
/// рос бы по стеку и упёрся бы в предел там, где интерпретатор считает штатно.
#[derive(Debug, Default)]
pub struct Bounce {
    /// Функция, к которой отскакиваем; `None` — значение уже получено.
    pub next: Option<StepFn>,
    /// Аргументы отскока.
    pub args: Vec<Value>,
}

/// Крутит отскоки в цикле, пока шаг не вернёт значение.
pub fn trampoline(ctx: &Ctx, step: StepFn, args: Vec<Value>, function: &str) -> Result<Value, Error> {
    let mut step = step;
    let mut args = args;
    loop {
        let mut bounce = Bounce { next: None, args: Vec::new() };
        let value = step(ctx, args, &mut bounce)?;
        match bounce.next {
            None => return Ok(value),
            Some(next) => {
                ctx.step(function)?;
                step = next;
                args = bounce.args;
            }
        }
    }
}

/// Аргумент шага батута по номеру: отсутствующий — «ничто», а не паника.
pub fn arg(args: &[Value], index: usize) -> Value {
    args.get(index).cloned().unwrap_or(Value::Nothing)
}

// ───────────────────────────── операции языка ─────────────────────────────

/// Доступ к полю записи.
pub fn field_get(_ctx: &Ctx, target: Value, name: &str) -> Result<Value, Error> {
    match &target {
        Value::Variant(data) => Err(fail(
            CODE_TYPE,
            format!("поле «{name}» нельзя взять у варианта «{}» — нужен разбор", data.name),
        )),
        Value::Record(fields) => match lookup(fields, name) {
            Some(value) => Ok(value.clone()),
            None => Err(fail(CODE_UNKNOWN_NAME, format!("запись не содержит поле «{name}»"))),
        },
        other => Err(fail(
            CODE_TYPE,
            format!("поле «{name}» можно взять только у записи, получено {}", type_name(other)),
        )),
    }
}

/// Поле варианта при сопоставлении с образцом. Отсутствующее поле — ошибка
/// прямо здесь, а не «случай не подошёл»: так же ведёт себя `matchPattern`
/// интерпретатора.
pub fn variant_field(_ctx: &Ctx, target: &Value, name: &str) -> Result<Value, Error> {
    /* Не-вариант сюда не доходит: поле берётся только внутри случая, чей
    дискриминант уже проверен. Имя всё же берётся из значения, а не
    подставляется, чтобы текст совпадал с интерпретатором дословно. */
    let (fields, owner): (&[Field], &str) = match target {
        Value::Variant(data) => (&data.fields, &data.name),
        _ => (&[], ""),
    };
    match lookup(fields, name) {
        Some(value) => Ok(value.clone()),
        None => Err(fail(
            CODE_UNKNOWN_NAME,
            format!("вариант «{owner}» не содержит поле «{name}»"),
        )),
    }
}

/// Условие «если»: обязано быть признаком.
pub fn cond(_ctx: &Ctx, value: Value) -> Result<bool, Error> {
    match value {
        Value::Flag(item) => Ok(item),
        other => Err(fail(
            CODE_TYPE,
            format!("условие «если» должно быть признаком, получено {}", type_name(&other)),
        )),
    }
}

/// Условие «отфильтровать»: обязано быть признаком.
pub fn keep(_ctx: &Ctx, value: Value) -> Result<bool, Error> {
    match value {
        Value::Flag(item) => Ok(item),
        other => Err(fail(
            CODE_TYPE,
            format!("условие «отфильтровать» должно быть признаком, получено {}", type_name(&other)),
        )),
    }
}

/// Значение постусловия: обязано быть признаком.
pub fn post(_ctx: &Ctx, value: Value, property: &str, function: &str) -> Result<bool, Error> {
    match value {
        Value::Flag(item) => Ok(item),
        other => Err(fail(
            CODE_TYPE,
            format!(
                "постусловие «{property}» функции «{function}» должно давать признак, получено {}",
                type_name(&other)
            ),
        )),
    }
}

/// Разбор не покрыл значение.
///
/// Возвращает `Result`, а не голую ошибку, хотя успешным не бывает никогда: у
/// разбора-выражения это последняя ветвь `else`, и она обязана иметь тип
/// значения. `Err(…)?` даёт его через расходящееся выражение, а отдельная
/// форма для хвостовой позиции и для позиции значения развела бы один и тот же
/// отказ на два места.
pub fn match_fail(_ctx: &Ctx, value: &Value) -> Result<Value, Error> {
    Err(fail(CODE_MATCH, format!("разбор не покрывает значение {}", describe(value))))
}

/// «свёртка», «отобразить» и «отфильтровать» работают только со списком.
pub fn require_list(_ctx: &Ctx, value: Value, label: &str) -> Result<Items, Error> {
    match value {
        Value::List(items) => Ok(items),
        other => Err(fail(
            CODE_TYPE,
            format!("«{label}» работает только со списком, получено {}", type_name(&other)),
        )),
    }
}

// ───────────────────────────── арифметика ─────────────────────────────

fn arithmetic(op: &str, left: &Value, right: &Value) -> Result<(f64, f64), Error> {
    match (left, right) {
        (Value::Number(a), Value::Number(b)) => Ok((*a, *b)),
        _ => Err(fail(
            CODE_TYPE,
            format!(
                "операция «{op}» допустима только для чисел, получено {} и {}",
                type_name(left),
                type_name(right)
            ),
        )),
    }
}

/// Сообщение дословно как в ядре FTS (src/utility.ts, compare).
fn ordered(left: &Value, right: &Value) -> Result<(f64, f64), Error> {
    match (left, right) {
        (Value::Number(a), Value::Number(b)) => Ok((*a, *b)),
        _ => Err(fail(CODE_TYPE, "сравнения порядка допустимы только для чисел".to_string())),
    }
}

/// «плюс».
pub fn add(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = arithmetic("add", &left, &right)?;
    Ok(number(a + b))
}

/// «минус».
pub fn sub(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = arithmetic("sub", &left, &right)?;
    Ok(number(a - b))
}

/// «умножить на».
pub fn mul(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = arithmetic("mul", &left, &right)?;
    Ok(number(a * b))
}

/// «делить на». Деление на ноль даёт ±Infinity, а 0/0 — NaN: это значения
/// IEEE-754, а не ошибка (SPEC, раздел 5). Rust здесь ведёт себя как JS,
/// потому что оба делят `f64`.
pub fn div(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = arithmetic("div", &left, &right)?;
    Ok(number(a / b))
}

/// «остаток от» как двуместная операция. `%` для `f64` в Rust — это fmod, то
/// есть ровно оператор `%` из JS: знак берётся от делимого, деление на ноль
/// даёт NaN.
pub fn modulo(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = arithmetic("mod", &left, &right)?;
    Ok(number(a % b))
}

/// «процентов от». Порядок операций ядра: (процент / 100) * значение.
/// Переписать в значение * процент / 100 нельзя — меняется последний бит
/// мантиссы.
pub fn percent(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = arithmetic("percent", &left, &right)?;
    Ok(number((a / 100.0) * b))
}

/// «больше».
pub fn gt(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = ordered(&left, &right)?;
    Ok(flag(a > b))
}

/// «меньше».
pub fn lt(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = ordered(&left, &right)?;
    Ok(flag(a < b))
}

/// «не меньше».
pub fn gte(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = ordered(&left, &right)?;
    Ok(flag(a >= b))
}

/// «не больше».
pub fn lte(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let (a, b) = ordered(&left, &right)?;
    Ok(flag(a <= b))
}

/// «соединить» как двуместная операция над строками.
pub fn concat(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    match (&left, &right) {
        (Value::Text(a), Value::Text(b)) => Ok(text(&format!("{a}{b}"))),
        _ => Err(fail(
            CODE_TYPE,
            format!(
                "«соединить» допустимо только для строк, получено {} и {}",
                type_name(&left),
                type_name(&right)
            ),
        )),
    }
}

// ───────────────────────────── проверки аргументов ─────────────────────────

fn expect_string<'a>(name: &str, value: &'a Value, role: &str) -> Result<&'a str, Error> {
    match value {
        Value::Text(item) => Ok(item),
        other => Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«{name}»: {role} должна быть строкой, получено {}", type_name(other)),
        )),
    }
}

fn expect_number(name: &str, value: &Value, role: &str) -> Result<f64, Error> {
    match value {
        Value::Number(item) => Ok(*item),
        other => Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«{name}»: {role} должно быть числом, получено {}", type_name(other)),
        )),
    }
}

fn expect_integer(name: &str, value: &Value, role: &str) -> Result<f64, Error> {
    let value = expect_number(name, value, role)?;
    // Number.isInteger: ни NaN, ни бесконечность целыми не считаются.
    if !value.is_finite() || value != value.trunc() {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«{name}»: {role} должно быть целым числом, получено {}", number_text(value)),
        ));
    }
    Ok(value)
}

fn expect_list<'a>(name: &str, value: &'a Value, role: &str) -> Result<&'a Items, Error> {
    match value {
        Value::List(items) => Ok(items),
        other => Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«{name}»: {role} должен быть списком, получено {}", type_name(other)),
        )),
    }
}

/// Смещение внутри строки из позиции flang: индекс минус база.
///
/// Считается в `f64`, а не в `usize`: индекс приезжает числом flang и вполне
/// может быть −1 или 10^18, и превращать его в беззнаковое до проверки границ
/// значило бы получить огромное число вместо отрицательного.
fn offset(position: f64, base: i64) -> f64 {
    position - base as f64
}

// ───────────────────────────── встроенные формы ─────────────────────────────

/// «длина»: строка в кодовых точках, список в элементах.
pub fn b_length(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    match &value {
        Value::Text(item) => Ok(number(item.chars().count() as f64)),
        Value::List(items) => Ok(number(items.len() as f64)),
        other => Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«длина»: ожидается строка или список, получено {}", type_name(other)),
        )),
    }
}

/// «символ … в …». Индексация с 1 и включительно (SPEC, раздел 5); нулевую
/// базу включает `Ctx::set_index_base`.
pub fn b_char(ctx: &Ctx, index: Value, source: Value) -> Result<Value, Error> {
    let position = expect_integer("символ", &index, "индекс")?;
    let string = expect_string("символ", &source, "строка")?;
    let runes: Vec<char> = string.chars().collect();
    let at = offset(position, ctx.index_base());
    if at < 0.0 || at >= runes.len() as f64 {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«символ»: индекс {} вне строки длиной {}",
                number_text(position),
                runes.len()
            ),
        ));
    }
    match runes.get(at as usize) {
        Some(symbol) => Ok(text(&symbol.to_string())),
        None => Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«символ»: индекс {} вне строки длиной {}",
                number_text(position),
                runes.len()
            ),
        )),
    }
}

/// «подстрока … с … по …»: оба конца включительно при базе 1.
pub fn b_substring(ctx: &Ctx, source: Value, from: Value, to: Value) -> Result<Value, Error> {
    let string = expect_string("подстрока", &source, "строка")?;
    let start = expect_integer("подстрока", &from, "начало")?;
    let end = expect_integer("подстрока", &to, "конец")?;
    let runes: Vec<char> = string.chars().collect();
    let length = runes.len() as f64;
    let begin = offset(start, ctx.index_base());
    if begin < 0.0 || begin > length {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«подстрока»: начало {} вне строки длиной {}",
                number_text(start),
                runes.len()
            ),
        ));
    }
    if end < begin || end > length {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«подстрока»: конец {} вне диапазона [{}, {}]",
                number_text(end),
                number_text(start),
                runes.len()
            ),
        ));
    }
    let taken: String = runes
        .iter()
        .skip(begin as usize)
        .take((end - begin).max(0.0) as usize)
        .collect();
    Ok(text(&taken))
}

/// «соединить». Две формы: строка со строкой и список с разделителем;
/// различаются по типу первого аргумента, как в builtins.mjs.
pub fn b_join(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    if let Value::List(items) = &left {
        let separator = expect_string("соединить", &right, "разделитель")?;
        let mut parts: Vec<&str> = Vec::with_capacity(items.len());
        for (index, item) in items.iter().enumerate() {
            match item {
                Value::Text(part) => parts.push(part),
                other => {
                    return Err(fail(
                        CODE_BUILTIN_ARGS,
                        format!(
                            "«соединить»: элемент {} списка должен быть строкой, получено {}",
                            index + 1,
                            type_name(other)
                        ),
                    ))
                }
            }
        }
        return Ok(text(&parts.join(separator)));
    }
    let first = expect_string("соединить", &left, "первая строка")?;
    let second = expect_string("соединить", &right, "вторая строка")?;
    Ok(text(&format!("{first}{second}")))
}

/// «разделить … по …».
pub fn b_split(_ctx: &Ctx, source: Value, separator: Value) -> Result<Value, Error> {
    let string = expect_string("разделить", &source, "строка")?;
    let mark = expect_string("разделить", &separator, "разделитель")?;
    if mark.is_empty() {
        return Err(fail(CODE_BUILTIN_ARGS, "«разделить»: разделитель не может быть пустым".to_string()));
    }
    Ok(list(string.split(mark).map(text).collect()))
}

/// «символы»: разложение строки в список односимвольных строк.
///
/// `chars()` идёт по скалярным значениям Unicode — то же деление, что у
/// «длина» и «подстрока». Пустая строка даёт пустой список.
pub fn b_characters(_ctx: &Ctx, source: Value) -> Result<Value, Error> {
    let string = expect_string("символы", &source, "строка")?;
    Ok(list(string.chars().map(|point| text(&point.to_string())).collect()))
}

/// «содержит»: подстрока в строке либо значение в списке.
pub fn b_contains(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    if let Value::List(items) = &left {
        return Ok(flag(items.iter().any(|item| equal(item, &right))));
    }
    let source = expect_string("содержит", &left, "строка или список")?;
    let part = expect_string("содержит", &right, "искомая подстрока")?;
    Ok(flag(source.contains(part)))
}

/// «начинается с».
pub fn b_starts_with(_ctx: &Ctx, source: Value, prefix: Value) -> Result<Value, Error> {
    let string = expect_string("начинается с", &source, "строка")?;
    let start = expect_string("начинается с", &prefix, "префикс")?;
    Ok(flag(string.starts_with(start)))
}

/// Пробел по правилам ECMAScript `String.prototype.trim`.
///
/// `char::is_whitespace` из Rust не подходит: он считает пробелом U+0085 (NEL),
/// которого в наборе ECMAScript нет, и не считает U+FEFF, который там есть.
/// Разошлись бы ровно на тех входах, ради которых «к числу» и проверяется.
fn is_js_space(symbol: char) -> bool {
    matches!(
        symbol,
        '\t' | '\n'
            | '\u{b}'
            | '\u{c}'
            | '\r'
            | ' '
            | '\u{a0}'
            | '\u{feff}'
            | '\u{1680}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
    ) || ('\u{2000}'..='\u{200a}').contains(&symbol)
}

/// Строгий разбор «к числу»: без Infinity, NaN, шестнадцатеричных и пустой
/// строки, иначе форма молча превращает мусор в значение. Набор символов тот
/// же, что у регулярного выражения в builtins.mjs.
fn looks_like_number(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut index = 0;
    if matches!(bytes.get(index), Some(b'+') | Some(b'-')) {
        index += 1;
    }
    let mut digits_before = 0;
    while matches!(bytes.get(index), Some(byte) if byte.is_ascii_digit()) {
        index += 1;
        digits_before += 1;
    }
    let mut digits_after = 0;
    if bytes.get(index) == Some(&b'.') {
        index += 1;
        while matches!(bytes.get(index), Some(byte) if byte.is_ascii_digit()) {
            index += 1;
            digits_after += 1;
        }
        /* «1.» и «.» недопустимы: после точки обязана быть хотя бы одна цифра,
        а «.5» допустимо только потому, что цифры есть после точки. */
        if digits_after == 0 {
            return false;
        }
    }
    if digits_before == 0 && digits_after == 0 {
        return false;
    }
    if matches!(bytes.get(index), Some(b'e') | Some(b'E')) {
        index += 1;
        if matches!(bytes.get(index), Some(b'+') | Some(b'-')) {
            index += 1;
        }
        let mut digits = 0;
        while matches!(bytes.get(index), Some(byte) if byte.is_ascii_digit()) {
            index += 1;
            digits += 1;
        }
        if digits == 0 {
            return false;
        }
    }
    index == bytes.len()
}

/// «к числу».
pub fn b_to_number(_ctx: &Ctx, source: Value) -> Result<Value, Error> {
    let string = expect_string("к числу", &source, "строка")?;
    let trimmed = string.trim_matches(is_js_space);
    if !looks_like_number(trimmed) {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«к числу»: строка {} не является числом", quote_json(string)),
        ));
    }
    // Ошибка диапазона (1e999) даёт ±inf и обрабатывается следующей проверкой:
    // текст разобран, но конечным числом не является.
    let parsed: f64 = trimmed.parse().unwrap_or(f64::NAN);
    if !parsed.is_finite() {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«к числу»: строка {} не является конечным числом", quote_json(string)),
        ));
    }
    Ok(number(parsed))
}

/// «к числу или беда»: отказ, ставший значением (builtins.mjs, раздел «отказ,
/// ставший значением»).
///
/// Разбор не повторяется, а переиспользуется: тексты обязаны совпасть с
/// интерпретатором, и единственный способ гарантировать это — один разбор на обе
/// формы. Отказать эта форма не может вовсе, поэтому `Err` отсюда не выходит;
/// `Result` в сигнатуре остаётся только ради общей формы вызова у бэкенда.
pub fn b_to_number_or_failure(ctx: &Ctx, source: Value) -> Result<Value, Error> {
    match b_to_number(ctx, source) {
        Ok(parsed) => Ok(variant("Разобрано", vec![field("значение", parsed)])),
        Err(failure) => Ok(variant(
            "Не разобрано",
            vec![
                field("код", text(&failure.code)),
                field("сообщение", text(&failure.message)),
            ],
        )),
    }
}

/// «к строке». Признак печатается по-русски («да»/«нет»), «ничто» — словом
/// «ничто»: поверхность языка русская, и кодогенераторы обязаны это повторять,
/// а не печатать true/false (SPEC, раздел 5).
pub fn b_to_string(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    match value {
        Value::Text(item) => Ok(Value::Text(item)),
        Value::Number(item) => Ok(text(&number_text(item))),
        Value::Flag(item) => Ok(text(if item { "да" } else { "нет" })),
        Value::Nothing => Ok(text("ничто")),
        other => Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«к строке»: ожидается скаляр, получено {}", type_name(&other)),
        )),
    }
}

/// «пусто».
pub fn b_empty(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    match &value {
        Value::List(items) => Ok(flag(items.is_empty())),
        Value::Text(item) => Ok(flag(item.is_empty())),
        other => Err(fail(
            CODE_BUILTIN_ARGS,
            format!("«пусто»: ожидается строка или список, получено {}", type_name(other)),
        )),
    }
}

/// «голова».
pub fn b_head(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    let items = expect_list("голова", &value, "аргумент")?;
    match items.get(0) {
        Some(item) => Ok(item.clone()),
        None => Err(fail(CODE_BUILTIN_ARGS, "«голова»: список пуст".to_string())),
    }
}

/// «хвост». Суффикс, а не копия: значения flang неизменяемы, память общая.
/// В JS «хвост» копирует (массив нельзя разделить с суффиксом), и рекурсия
/// «голова и хвост» там квадратична; здесь она линейна, а наблюдаемое значение
/// то же самое.
pub fn b_tail(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    let items = expect_list("хвост", &value, "аргумент")?;
    if items.is_empty() {
        return Err(fail(CODE_BUILTIN_ARGS, "«хвост»: список пуст".to_string()));
    }
    Ok(Value::List(items.tail()))
}

/// «добавить … к …»: дописывает в конец, исходный список не меняется.
/// Копия обязательна: «хвост» отдаёт суффикс чужого массива, и дописать в него
/// значило бы испортить значение, на которое ещё кто-то смотрит.
pub fn b_append(_ctx: &Ctx, item: Value, value: Value) -> Result<Value, Error> {
    let items = expect_list("добавить", &value, "второй аргумент")?;
    let mut result: Vec<Value> = Vec::with_capacity(items.len().saturating_add(1));
    result.extend(items.iter().cloned());
    result.push(item);
    Ok(list(result))
}

/// «остаток от».
pub fn b_remainder(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let a = expect_number("остаток от", &left, "делимое")?;
    let b = expect_number("остаток от", &right, "делитель")?;
    Ok(number(a % b))
}

/// «процентов от»: (процент / 100) * значение, порядок ядра.
pub fn b_percent_of(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    let a = expect_number("процентов от", &left, "процент")?;
    let b = expect_number("процентов от", &right, "значение")?;
    Ok(number((a / 100.0) * b))
}
