// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
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

use std::cell::{Cell, Ref, RefCell};
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

/// Элементы списка: общий массив плюс начало и конец ЭТОГО списка.
///
/// Начало — это и есть «хвост»: суффикс списка не копируется, а разделяется.
/// Значения flang неизменяемы, поэтому разделять безопасно, а рекурсия «голова
/// и хвост» из квадратичной становится линейной.
///
/// ── Конец, а не «до конца массива»: «добавить» за постоянное время ─────────
///
/// Раньше длина бралась как `data.len() - start`, а «добавить» копировало весь
/// список. Копия ВЕРНА, но стоит O(длины) за вызов, и накопление списка n
/// вызовами стоит O(n²). Это не теория: точка сетки
/// `«Строить скобки» от 42 и 0 и 0 и "" и []` при объявленном пределе
/// 5 000 000 шагов упиралась в предел через ДВАДЦАТЬ МИНУТ вместо секунды —
/// от вечного цикла неотличимо. Тот же предел на той же точке напечатанный C
/// берёт за 1,3 с, и именно потому, что там «добавить» сделано за постоянное
/// время (`fl_b_dobavit` в `flang_runtime.c`, приём «запас + filled»).
///
/// Здесь тот же приём и тот же инвариант, только вместо арены — общий `Vec`:
///
///   длина общего массива — это число ячеек, УЖЕ кем-то занятых; оно только
///   растёт, а занять ячейку `end` вправе единственный список — тот, у кого
///   `end` совпал с этой длиной.
///
/// Отсюда неизменяемость: ячейки `start…end−1` не пишет никто и никогда, а
/// ячейку за концом занимают не более одного раза за жизнь массива — второе
/// «добавить» к тому же списку видит занято > своего конца и уходит на копию.
/// Разветвление
///
///     пусть «а» равно (добавить 1 к «с»)   ← занимает ячейку n, занято = n+1
///     пусть «б» равно (добавить 2 к «с»)   ← конец n ≠ занято → копия
///
/// даёт два независимых списка, и ни один не портит «с». Удвоение запаса берёт
/// на себя сам `Vec`, поэтому за n «добавить» массив перевыделяется log₂n раз,
/// а не n.
#[derive(Debug, Clone)]
pub struct Items {
    data: Rc<RefCell<Vec<Value>>>,
    start: usize,
    end: usize,
}

impl Items {
    /// Список из готового массива.
    pub fn new(data: Vec<Value>) -> Items {
        let end = data.len();
        Items { data: Rc::new(RefCell::new(data)), start: 0, end }
    }

    /// Число элементов.
    pub fn len(&self) -> usize {
        self.end.saturating_sub(self.start)
    }

    /// Пуст ли список.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Элемент по индексу от нуля; `None` вместо паники за границей.
    ///
    /// Отдаётся копия значения, а не ссылка: за концом этого списка в общем
    /// массиве могут лежать чужие ячейки, и заимствование пришлось бы держать
    /// живым дольше, чем нужно вызывающему. Копия значения flang — это один
    /// инкремент счётчика ссылок.
    pub fn get(&self, index: usize) -> Option<Value> {
        let at = self.start.checked_add(index)?;
        if at >= self.end {
            return None;
        }
        self.data.borrow().get(at).cloned()
    }

    /// Все элементы подряд, под заимствованием общего массива.
    ///
    /// Заимствование держать МОЖНО ровно до тех пор, пока не исполняется код
    /// программы: «добавить» на живом заимствовании уйдёт на копию (см.
    /// `grown`), то есть сработает верно, но дороже. Там, где во время обхода
    /// исполняется тело свёртки или «отобразить», берётся `snapshot`.
    pub fn as_slice(&self) -> Ref<'_, [Value]> {
        Ref::map(self.data.borrow(), |cells| cells.get(self.start..self.end).unwrap_or(&[]))
    }

    /// Копия элементов: для обхода, внутри которого исполняется код программы.
    pub fn snapshot(&self) -> Vec<Value> {
        self.as_slice().to_vec()
    }

    /// Суффикс без первого элемента — сдвиг начала, а не копия.
    pub fn tail(&self) -> Items {
        Items {
            data: Rc::clone(&self.data),
            start: self.start.saturating_add(1).min(self.end),
            end: self.end,
        }
    }

    /// Список, продлённый одним значением. За постоянное время, если ячейка за
    /// концом ещё ничья; иначе — копией, и следующие «добавить» к ней снова
    /// пойдут на месте.
    pub fn grown(&self, item: Value) -> Items {
        /* Быстрый путь: наш конец — это и конец занятого. Заимствование может
        быть занято чужим обходом (`as_slice` в свёртке); тогда не паника, а
        медленный путь: значение то же, цена выше. */
        if let Ok(mut cells) = self.data.try_borrow_mut() {
            if cells.len() == self.end && self.end < usize::MAX {
                cells.push(item);
                return Items { data: Rc::clone(&self.data), start: self.start, end: self.end + 1 };
            }
        }
        let mut copy: Vec<Value> = Vec::with_capacity(self.len().saturating_add(1));
        copy.extend(self.as_slice().iter().cloned());
        copy.push(item);
        Items::new(copy)
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
        Value::List(items) => items.get(0).unwrap_or(Value::Nothing),
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
            if a.len() != b.len() {
                return false;
            }
            /* Заимствования именованы, а не вложены в одно выражение: так
            видно, что оба живут ровно до конца сравнения и ни одно из них не
            переживает вызов кода программы (его тут и нет). */
            let (left_cells, right_cells) = (a.as_slice(), b.as_slice());
            left_cells.iter().zip(right_cells.iter()).all(|(one, other)| equal(one, other))
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

// ───────────────────────────── стек под предел ─────────────────────────────

/// Сколько байт стека отводить на один кадр flang.
///
/// Не с потолка, и мерилось по худшему, а не по среднему: предел глубины обещан
/// ВСЕМ программам, значит стек обязан нести худшую. `cc -fstack-usage` по
/// всему корпусу репозитория (7 896 функций из 157 программ) дал худший кадр
/// 6 496 байт — у самого компилятора flang.
///
/// Число взято общим с бэкендом C намеренно, хотя кадр Rust ТОНЬШЕ: замер на той
/// же функции с сорока связываниями дал здесь около 1,7 КиБ против 5,5 КиБ в C.
/// Общее число означает, что одна и та же программа получает в двух целях
/// одинаковую достижимую глубину, а не разную по случайности кодогенератора; в
/// Rust оно просто даёт ещё больший запас.
pub const STACK_PER_FRAME: usize = 16 * 1024;
/// Ниже этого просить нечего: столько даёт система и так.
pub const STACK_MIN: usize = 8 * 1024 * 1024;
/// Выше этого предел просто не несётся стеком, и о том честно говорит сторож.
pub const STACK_MAX: usize = 1024 * 1024 * 1024;
/// Неснижаемый запас под последним входом: тело, текст диагностики, возврат.
pub const STACK_MARGIN: usize = 128 * 1024;

/// Сколько байт стека несёт расчёт. Ноль — сторож молчит.
static STACK_ROOM: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

/// Сколько стека просить под предел глубины `max_depth` (с учётом границ).
pub fn stack_wanted(max_depth: i64) -> usize {
    if max_depth <= 0 {
        return STACK_MIN;
    }
    let depth = max_depth as usize;
    if depth > STACK_MAX / STACK_PER_FRAME {
        return STACK_MAX;
    }
    (depth * STACK_PER_FRAME + STACK_MARGIN).clamp(STACK_MIN, STACK_MAX)
}

/// Объявить, сколько стека несёт расчёт. Так говорит прогонщик про поток,
/// который сам и завёл; так же может сказать встраивающий. Ноль выключает
/// сторожа — это выбор того, кто знает, что делает.
pub fn set_stack_room(bytes: usize) {
    STACK_ROOM.store(bytes, std::sync::atomic::Ordering::Relaxed);
}

/// Сколько стека объявлено под расчёт.
pub fn stack_room() -> usize {
    STACK_ROOM.load(std::sync::atomic::Ordering::Relaxed)
}

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
///
/// Сторож стека — третье поле того же прибора, а не третий прибор. Счётчик
/// считает КАДРЫ, а несёт их стек, и толщина кадра — свойство ПРОГРАММЫ:
/// у функции с одним параметром она в шестнадцать раз меньше, чем у функции с
/// сорока связываниями. Поэтому при поднятом `--max-depth` напечатанный Rust
/// умирал не отказом, а `fatal runtime error: stack overflow` — то есть
/// объявленный предел глубины пределом НЕ БЫЛ. `enter` — та же и единственная
/// точка, где сходятся все пределы, — смотрит теперь ещё и на остаток стека.
#[derive(Debug)]
pub struct Ctx {
    depth: Cell<i64>,
    max_depth: Cell<i64>,
    steps: Cell<i64>,
    max_steps: Cell<i64>,
    index_base: Cell<i64>,
    /// Отметка стека, снятая при заведении контекста, и запас под ней.
    stack_base: Cell<usize>,
    stack_room: Cell<usize>,
    /// Наибольшая измеренная толщина одного кадра ЭТОЙ программы.
    stack_seen: Cell<usize>,
    stack_step: Cell<usize>,
}

impl Default for Ctx {
    fn default() -> Ctx {
        Ctx::new()
    }
}

impl Ctx {
    /// Контекст с пределами интерпретатора и индексацией строк с 1.
    pub fn new() -> Ctx {
        /* Отметка стека — адрес локальной этой самой функции: расчёт начинается
        там, где заводят контекст, и всё, что он займёт под отметкой, сторож и
        меряет. */
        let here: u8 = 0;
        Ctx {
            depth: Cell::new(0),
            max_depth: Cell::new(DEFAULT_MAX_DEPTH),
            steps: Cell::new(0),
            max_steps: Cell::new(DEFAULT_MAX_STEPS),
            index_base: Cell::new(DEFAULT_BASE),
            stack_base: Cell::new(&here as *const u8 as usize),
            stack_room: Cell::new(stack_room()),
            stack_seen: Cell::new(0),
            stack_step: Cell::new(0),
        }
    }

    /// Текущая глубина вызовов.
    pub fn depth(&self) -> i64 {
        self.depth.get()
    }

    /// Объявленный предел глубины: прогонщику он нужен, чтобы отвести под него стек.
    pub fn max_depth(&self) -> i64 {
        self.max_depth.get()
    }

    /// Съеден ли стек под отметкой настолько, что дальше идти нельзя.
    ///
    /// Мерить надо байты, а не кадры: запас под последним входом считается по
    /// САМОМУ ТОЛСТОМУ кадру, который эта программа уже показала, а не по числу
    /// из заголовка. Между двумя проверками ложится ровно такой кадр, и запас в
    /// четыре его толщины покрывает это с обеих сторон; программе с тонким
    /// кадром это не стоит ничего — её запас тоже тонкий.
    fn stack_spent(&self) -> bool {
        let room = self.stack_room.get();
        if room == 0 {
            return false; // сторож выключен: так решил тот, кто знает, что делает
        }
        let here: u8 = 0;
        let point = &here as *const u8 as usize;
        let base = self.stack_base.get();
        /* Стек растёт вниз почти везде, но «почти» здесь не годится: разность
        берётся по модулю, и направление роста перестаёт быть допущением. */
        let used = if point < base { base - point } else { point - base };
        if used > self.stack_seen.get() {
            let step = used - self.stack_seen.get();
            if step > self.stack_step.get() {
                self.stack_step.set(step);
            }
            self.stack_seen.set(used);
        }
        let step = self.stack_step.get();
        if step > (STACK_MAX - STACK_MARGIN) / 4 {
            return true; // кадр толще всего мыслимого стека — дальше идти некуда
        }
        used + STACK_MARGIN + step * 4 > room
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
        if self.stack_spent() {
            /* Стек хозяина кончился раньше объявленного предела. Отказ всё
            равно ОБЪЯВЛЕННЫЙ — код из закрытого набора, — а текст называет
            хозяина, а не предел, до которого не добрались: врать про предел
            нельзя, молчать тоже. Тот же текст и по той же причине печатают
            бэкенды C (`fl_enter`) и JavaScript (`$hostDepth`). */
            return Err(fail(
                CODE_RECURSION_LIMIT,
                format!(
                    "функция «{function}» исчерпала стек хозяина на глубине {}, не дойдя до предела глубины вызовов ({limit})",
                    self.depth.get()
                ),
            ));
        }
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
        // Поле СУММЫ ИЗ ОДНОГО ВАРИАНТА. Что вариант ровно один, проверила проверка типов, поэтому сюда приезжает значение, у которого поле есть. Отказ ниже остаётся прежним: он про сумму из двух и более.
        Value::Variant(data) => match lookup(&data.fields, name) {
            Some(value) => Ok(value.clone()),
            None => Err(fail(
                CODE_TYPE,
                format!("поле «{name}» нельзя взять у варианта «{}» — нужен разбор", data.name),
            )),
        },
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
/// Значение предусловия: обязано быть признаком.
///
/// Отдельно от `post`, а не тот же помощник со вторым текстом: слова отказа
/// дословно те же, что у интерпретатора (`checkPreconditions` в
/// flang/src/interpret.mjs), и одно сообщение на две разные вещи разошлось бы
/// молча. Зовёт это ТОЛЬКО дверь программы — вызов по имени (`call`): внутри
/// программы предусловие снял вызывающий на проверке.
pub fn pre(_ctx: &Ctx, value: Value, property: &str, function: &str) -> Result<bool, Error> {
    match value {
        Value::Flag(item) => Ok(item),
        other => Err(fail(
            CODE_TYPE,
            format!(
                "предусловие «{property}» функции «{function}» должно давать признак, получено {}",
                type_name(&other)
            ),
        )),
    }
}

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
        let cells = items.as_slice();
        let mut parts: Vec<&str> = Vec::with_capacity(cells.len());
        for (index, item) in cells.iter().enumerate() {
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

/// «код символа»: кодовая точка первого символа строки.
///
/// `chars()` идёт по скалярам Unicode — та же нарезка, что у `b_characters`;
/// `as_bytes()[0]` отдал бы первый байт UTF-8, а не символ.
pub fn b_char_code(_ctx: &Ctx, source: Value) -> Result<Value, Error> {
    let string = expect_string("код символа", &source, "строка")?;
    match string.chars().next() {
        Some(point) => Ok(number(point as u32 as f64)),
        None => Err(fail(CODE_BUILTIN_ARGS, "«код символа»: строка пуста".to_string())),
    }
}

/// Константы раундов SHA-256 — первые тридцать два бита дробных частей кубических
/// корней первых 64 простых (FIPS 180-4, §4.2.2).
const SHA256_K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/// Один блок в 64 байта — сжатие состояния (FIPS 180-4, §6.2.2).
fn sha256_block(state: &mut [u32; 8], block: &[u8; 64]) {
    let mut w = [0u32; 64];
    for i in 0..16 {
        w[i] = u32::from_be_bytes([block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]]);
    }
    for i in 16..64 {
        let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
        let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16]
            .wrapping_add(s0)
            .wrapping_add(w[i - 7])
            .wrapping_add(s1);
    }
    let (mut a, mut b, mut c, mut d) = (state[0], state[1], state[2], state[3]);
    let (mut e, mut f, mut g, mut h) = (state[4], state[5], state[6], state[7]);
    for i in 0..64 {
        let big1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ ((!e) & g);
        let t1 = h
            .wrapping_add(big1)
            .wrapping_add(ch)
            .wrapping_add(SHA256_K[i])
            .wrapping_add(w[i]);
        let big0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let t2 = big0.wrapping_add(maj);
        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(t1);
        d = c;
        c = b;
        b = a;
        a = t1.wrapping_add(t2);
    }
    state[0] = state[0].wrapping_add(a);
    state[1] = state[1].wrapping_add(b);
    state[2] = state[2].wrapping_add(c);
    state[3] = state[3].wrapping_add(d);
    state[4] = state[4].wrapping_add(e);
    state[5] = state[5].wrapping_add(f);
    state[6] = state[6].wrapping_add(g);
    state[7] = state[7].wrapping_add(h);
}

/// «хеш256»: SHA-256 байтов строки шестнадцатеричной записью строчными буквами.
///
/// Написан здесь целиком, а не взят библиотекой: у напечатанного ящика Rust
/// зависимостей ноль, и заводить первую ради одного отпечатка значило бы менять
/// договор печати. В стандартной библиотеке Rust криптографии нет — в отличие
/// от Go, Python, Java, C# и Elixir, где та же форма зовёт штатное средство.
/// Строка Rust — уже UTF-8, поэтому хешируются ровно её байты, и отпечаток
/// совпадает с `sha256sum` и с восемью остальными целями знак в знак.
pub fn b_hash256(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    let body = expect_string("хеш256", &value, "строка")?;
    let bytes = body.as_bytes();
    let mut state: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    let mut block = [0u8; 64];
    let mut filled = 0usize;
    for byte in bytes {
        block[filled] = *byte;
        filled += 1;
        if filled == 64 {
            sha256_block(&mut state, &block);
            filled = 0;
        }
    }
    let bits = (bytes.len() as u64).wrapping_mul(8);
    block[filled] = 0x80;
    filled += 1;
    if filled > 56 {
        for slot in block.iter_mut().skip(filled) {
            *slot = 0;
        }
        sha256_block(&mut state, &block);
        filled = 0;
    }
    for slot in block.iter_mut().take(56).skip(filled) {
        *slot = 0;
    }
    block[56..64].copy_from_slice(&bits.to_be_bytes());
    sha256_block(&mut state, &block);
    let mut out = String::with_capacity(64);
    for word in state.iter() {
        out.push_str(&format!("{:08x}", word));
    }
    Ok(text(&out))
}

/// «символ по коду»: строка ровно из одного символа.
///
/// `char::from_u32` отдаёт `None` на суррогате и за концом Unicode — то есть
/// сам Rust называет ровно ту границу, которую форма обязана держать. Проверки
/// выписаны до вызова, чтобы текст отказа был тем же, что у семи остальных
/// целей; ветка `None` после них недостижима и оставлена отказом, а не
/// `unwrap()`, потому что паника рантайма не является отказом языка.
pub fn b_char_from_code(_ctx: &Ctx, code: Value) -> Result<Value, Error> {
    let point = expect_integer("символ по коду", &code, "код")?;
    if point < 0.0 || point > 1_114_111.0 {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«символ по коду»: код {} вне диапазона Unicode [0, 1114111]",
                number_text(point)
            ),
        ));
    }
    if (55_296.0..=57_343.0).contains(&point) {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«символ по коду»: код {} — половина суррогатной пары, а не символ",
                number_text(point)
            ),
        ));
    }
    match char::from_u32(point as u32) {
        Some(sign) => Ok(text(&sign.to_string())),
        None => Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«символ по коду»: код {} вне диапазона Unicode [0, 1114111]",
                number_text(point)
            ),
        )),
    }
}

/// «содержит»: подстрока в строке либо значение в списке.
pub fn b_contains(_ctx: &Ctx, left: Value, right: Value) -> Result<Value, Error> {
    if let Value::List(items) = &left {
        let cells = items.as_slice();
        return Ok(flag(cells.iter().any(|item| equal(item, &right))));
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
        Some(item) => Ok(item),
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

// ── Доказанный путь четырёх форм: то же действие без сторожа частичности ────
//
// Частичная форма отказывает не всегда, а на пустом. Там, где непустота
// ДОКАЗАНА проверкой типов (flang/src/types.mjs, «длинаНиз»), узел приезжает с
// отметкой «доказана», и печать зовёт эти функции. Сверка типа остаётся:
// `expect_list` ловит не пустоту, а другой вид значения.
pub fn b_split_proven(_ctx: &Ctx, source: Value, separator: Value) -> Result<Value, Error> {
    let string = expect_string("разделить", &source, "строка")?;
    let mark = expect_string("разделить", &separator, "разделитель")?;
    Ok(list(string.split(mark).map(text).collect()))
}

pub fn b_char_code_proven(_ctx: &Ctx, source: Value) -> Result<Value, Error> {
    let string = expect_string("код символа", &source, "строка")?;
    Ok(number(string.chars().next().unwrap_or('\0') as u32 as f64))
}

pub fn b_head_proven(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    let items = expect_list("голова", &value, "аргумент")?;
    /* Ветвь `None` недостижима — непустота доказана при печати. Здесь не
       `unwrap` и не `unreachable!`: паника из тотальной функции была бы отказом
       вида, которого нет в множестве отказов языка (`src/failures.mjs`), и
       восемь целей разошлись бы поведением на ошибке доказательства. Пустое
       значение — то же, что вернул бы C, читая нулевой элемент пустого
       массива, и в отличие от него оно определено. */
    Ok(items.get(0).unwrap_or(Value::Nothing))
}

pub fn b_tail_proven(_ctx: &Ctx, value: Value) -> Result<Value, Error> {
    let items = expect_list("хвост", &value, "аргумент")?;
    Ok(Value::List(items.tail()))
}

/// «элемент N в СПИСОК». Элементы лежат в `Vec` с началом, поэтому N-й стоит
/// того же, что первый: обхода нет ни здесь, ни в `Items::get`. Границы и
/// текст отказа повторяют вычислитель дословно — их сверяет дифференциальная
/// проверка, и «похоже» тут не годится.
pub fn b_element(ctx: &Ctx, index: Value, value: Value) -> Result<Value, Error> {
    let position = expect_integer("элемент", &index, "индекс")?;
    let items = expect_list("элемент", &value, "список")?;
    let at = offset(position, ctx.index_base());
    if at < 0.0 || at >= items.len() as f64 {
        return Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«элемент»: индекс {} вне списка длиной {}",
                number_text(position),
                items.len()
            ),
        ));
    }
    match items.get(at as usize) {
        Some(item) => Ok(item),
        None => Err(fail(
            CODE_BUILTIN_ARGS,
            format!(
                "«элемент»: индекс {} вне списка длиной {}",
                number_text(position),
                items.len()
            ),
        )),
    }
}

/// «добавить … к …»: дописывает в конец, исходный список не меняется.
///
/// За постоянное время, когда ячейка за концом ещё ничья, и копией во всех
/// остальных случаях — разбор приёма и доказательство неизменяемости лежат при
/// `Items::grown`. Прежняя безусловная копия была верна, но делала накопление
/// списка квадратичным, и предел шагов переставал быть сроком.
pub fn b_append(_ctx: &Ctx, item: Value, value: Value) -> Result<Value, Error> {
    let items = expect_list("добавить", &value, "второй аргумент")?;
    Ok(Value::List(items.grown(item)))
}

/// «приписать … к …»: тот же список с элементом впереди.
///
/// Копия, и постоянного времени здесь быть не может. `Items` смотрит в
/// `Rc<Vec<Value>>` через `start`, то есть суффикс он отдаёт даром, а вот запас
/// СПЕРЕДИ (как арена в бэкенде C) потребовал бы записи в общий буфер, значит
/// внутренней изменяемости — а `as_slice` отдаёт заимствованный срез и с ней
/// несовместим. Зато копия ОДНА на вызов, а не одна на элемент, как у свёртки,
/// которой приписывание в начало писали до появления формы. Цена по всем восьми
/// целям — в SPEC, раздел «Стоимость встроенных форм».
pub fn b_prepend(_ctx: &Ctx, item: Value, value: Value) -> Result<Value, Error> {
    let items = expect_list("приписать", &value, "второй аргумент")?;
    let mut result: Vec<Value> = Vec::with_capacity(items.len().saturating_add(1));
    result.push(item);
    result.extend_from_slice(&items.as_slice());
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

// ───────────────────────────── граница входа ─────────────────────────────
//
// Объявленные типы параметров — ДАННЫМИ. Прогонщик сверяет по ним значения,
// пришедшие снаружи, ДО вызова функции.
//
// Зачем это здесь, а не в самих функциях. Доказательство завершения
// `тотальной` стоит НА ТИПЕ: у `неотрицательное` есть дно 0 и потолок 2^53−1, ниже
// которого `н минус 1` точно меньше `н`, и сторож убывания в такую функцию не
// печатается вовсе. Значение вне типа выносит вместе с типом и доказательство:
// `1e300 минус 1` равно `1e300`, цепочка вечна, а ловить её нечем — сторожа
// нет. Поэтому дверь одна и стоит она ДО вычисления.
//
// Таблицу печатает бэкенд вместе с программой (`entry`), а строит её
// `flang/src/types.mjs` (`таблицаВхода`) — тем же пониманием слов «значение
// подходит типу», каким сверяется `flang run --args`.

/// Вид объявленного типа. `Unknown` — значение-функция, параметр полиморфизма
/// и применение типа с аргументами: одной таблицы им мало, и они не сверяются.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TypeKind {
    /// не сверяется
    Unknown,
    /// число, включая уточнения `неотрицательное` и `целое`
    Number,
    /// строка
    Text,
    /// признак
    Flag,
    /// «ничто»
    Null,
    /// список
    List,
    /// запись
    Record,
    /// сумма типов
    Sum,
}

/// Поле записи или варианта: имя и место его типа в таблице типов.
#[derive(Debug)]
pub struct TypeField {
    /// имя поля в исходной программе flang
    pub name: &'static str,
    /// индекс типа поля в `EntryTable::types`
    pub type_at: usize,
}

/// Вариант суммы: имя дискриминанта и отрезок его полей в общем массиве.
#[derive(Debug)]
pub struct TypeVariant {
    /// имя варианта
    pub name: &'static str,
    /// начало отрезка полей в `EntryTable::fields`
    pub field_from: usize,
    /// длина отрезка полей
    pub field_count: usize,
}

/// Объявленный тип. Поля и варианты лежат сплошными отрезками общих массивов:
/// так печать в каждой цели — это однородные списки, а не россыпь имён.
#[derive(Debug)]
pub struct Type {
    /// вид типа
    pub kind: TypeKind,
    /// печатное имя типа: «неотрицательное», «список числа»
    pub name: &'static str,
    /// имя записи или суммы без кавычек — для текстов о полях
    pub owner: &'static str,
    /// «… или ничто»: отсутствие значения законно
    pub optional: bool,
    /// целое ли
    pub integral: bool,
    /// есть ли конечный отрезок (у `число` его нет)
    pub bounded: bool,
    /// нижняя граница отрезка
    pub low: f64,
    /// верхняя граница отрезка
    pub high: f64,
    /// тип элемента списка — индекс в `EntryTable::types`
    pub of: usize,
    /// начало отрезка полей записи в `EntryTable::fields`
    pub field_from: usize,
    /// длина отрезка полей записи
    pub field_count: usize,
    /// начало отрезка вариантов в `EntryTable::variants`
    pub variant_from: usize,
    /// длина отрезка вариантов
    pub variant_count: usize,
}

/// Параметр функции: чей он, как называется и какого он типа.
#[derive(Debug)]
pub struct EntryParam {
    /// имя функции flang
    pub function: &'static str,
    /// имя параметра
    pub name: &'static str,
    /// индекс типа в `EntryTable::types`
    pub type_at: usize,
}

/// Граница входа программы целиком.
#[derive(Debug)]
pub struct EntryTable {
    /// объявленные типы
    pub types: &'static [Type],
    /// поля записей и вариантов, сплошным массивом
    pub fields: &'static [TypeField],
    /// варианты сумм, сплошным массивом
    pub variants: &'static [TypeVariant],
    /// параметры функций в объявленном порядке
    pub params: &'static [EntryParam],
}

fn check_number_type(spec: &Type, value: &Value, label: &str) -> Result<(), Error> {
    let found = match value {
        Value::Number(number) if number.is_finite() => *number,
        _ => return Err(fail(CODE_TYPE, format!("{} не соответствует типу {}", label, spec.name))),
    };
    /* Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
    порядок, и второй отказ на одном значении был бы вторым текстом про одну
    беду. */
    if spec.integral && found.floor() != found {
        return Err(fail(
            CODE_TYPE,
            format!("{}: {} не целое, а тип {} — целый", label, number_text(found), spec.name),
        ));
    }
    if spec.bounded && (found < spec.low || found > spec.high) {
        return Err(fail(CODE_TYPE, format!("{}: {} вне {}", label, number_text(found), spec.name)));
    }
    Ok(())
}

fn check_fields(
    table: &EntryTable,
    from: usize,
    count: usize,
    given: &[Field],
    label: &str,
    owner: &str,
    of_variant: bool,
) -> Result<(), Error> {
    for index in 0..count {
        let declared = &table.fields[from + index];
        match given.iter().find(|field| &*field.name == declared.name) {
            /* Необязательное поле можно не задавать: отсутствие — это «ничто». */
            None if table.types[declared.type_at].optional => continue,
            None if of_variant => {
                return Err(fail(
                    CODE_TYPE,
                    format!("{}: вариант «{}» требует поле «{}»", label, owner, declared.name),
                ))
            }
            None => {
                return Err(fail(
                    CODE_TYPE,
                    format!("{}: не задано поле «{}» записи «{}»", label, declared.name, owner),
                ))
            }
            Some(found) => check_typed(
                table,
                declared.type_at,
                &found.value,
                &format!("{}.{}", label, declared.name),
            )?,
        }
    }
    Ok(())
}

fn check_typed(table: &EntryTable, index: usize, value: &Value, label: &str) -> Result<(), Error> {
    let spec = match table.types.get(index) {
        Some(spec) => spec,
        None => return Ok(()),
    };
    /* Необязательный аргумент можно не задавать: отсутствие — это «ничто», а не
    пропуск. Так же считает и ядро FTS. */
    if spec.optional && matches!(value, Value::Nothing) {
        return Ok(());
    }
    let mismatch = || Err(fail(CODE_TYPE, format!("{} не соответствует типу {}", label, spec.name)));
    match spec.kind {
        TypeKind::Number => check_number_type(spec, value, label),
        TypeKind::Text => match value {
            Value::Text(_) => Ok(()),
            _ => mismatch(),
        },
        TypeKind::Flag => match value {
            Value::Flag(_) => Ok(()),
            _ => mismatch(),
        },
        TypeKind::Null => match value {
            Value::Nothing => Ok(()),
            _ => mismatch(),
        },
        TypeKind::List => match value {
            Value::List(items) => {
                /* `Items` — это вид на общий массив с запасом, а не `Vec`, и
                своего `iter` у него нет: элементы берутся заимствованием
                (`as_slice`). Держать его тут можно — граница входа кода
                программы не исполняет, а значит и «добавить» на живом
                заимствовании не случится. */
                for (at, item) in items.as_slice().iter().enumerate() {
                    check_typed(table, spec.of, item, &format!("{}[{}]", label, at))?;
                }
                Ok(())
            }
            _ => mismatch(),
        },
        TypeKind::Record => match value {
            Value::Record(fields) => {
                check_fields(table, spec.field_from, spec.field_count, fields, label, spec.owner, false)?;
                /* Лишнее поле — тоже несоответствие типу: запись flang тотальна,
                и поля сверх объявленных в ней взяться неоткуда. */
                for field in fields.iter() {
                    let declared =
                        (0..spec.field_count).any(|at| table.fields[spec.field_from + at].name == &*field.name);
                    if !declared {
                        return Err(fail(
                            CODE_TYPE,
                            format!("{}: запись «{}» не имеет поля «{}»", label, spec.owner, field.name),
                        ));
                    }
                }
                Ok(())
            }
            _ => mismatch(),
        },
        TypeKind::Sum => {
            let data = match value {
                Value::Variant(data) => Some(data),
                Value::Record(_) => None,
                _ => return mismatch(),
            };
            let found = data.and_then(|data| {
                (0..spec.variant_count)
                    .map(|at| &table.variants[spec.variant_from + at])
                    .find(|variant| variant.name == &*data.name)
                    .map(|variant| (variant, data))
            });
            match found {
                None => Err(fail(CODE_TYPE, format!("{}: ожидался вариант типа «{}»", label, spec.owner))),
                Some((variant, data)) => check_fields(
                    table,
                    variant.field_from,
                    variant.field_count,
                    &data.fields,
                    label,
                    variant.name,
                    true,
                ),
            }
        }
        TypeKind::Unknown => Ok(()),
    }
}

/// Сверка набора значений с объявленными типами параметров функции.
///
/// Молчит там, где сверять нечем: имени в таблице нет, число значений с числом
/// параметров не сошлось (об этом скажет диспетчер своим текстом), тип приехал
/// видом `Unknown`. Тексты отказов дословно те же, что у `checkValue` свидетеля:
/// расхождение здесь означало бы, что у языка два ответа на вопрос «подходит ли
/// значение типу».
pub fn check_entry(table: &EntryTable, name: &str, args: &[Value]) -> Result<(), Error> {
    let declared = table.params.iter().filter(|param| param.function == name).count();
    if declared == 0 || declared != args.len() {
        return Ok(());
    }
    for (at, param) in table.params.iter().filter(|param| param.function == name).enumerate() {
        check_typed(
            table,
            param.type_at,
            &args[at],
            &format!("вызов функции «{}»: аргумент «{}»", name, param.name),
        )?;
    }
    Ok(())
}
