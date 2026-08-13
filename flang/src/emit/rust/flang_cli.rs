// Прогонщик программы flang: JSON на входе, JSON на выходе.
//
// Зачем он есть. Напечатанный крейт — это библиотека, и вызвать её можно только
// из Rust. Но проверить кодогенератор нужно ровно одним способом — сверкой с
// интерпретатором на сетке из тысяч входов, а пересобирать программу ради
// каждой точки сетки невозможно. Поэтому бэкенд печатает ещё и прогонщик: одна
// сборка, дальше поток запросов через трубу.
//
// Побочная польза больше основной: точно так же программу на flang вызывает
// любой язык, у которого есть трубы, — Python, Node, shell. Ни FFI, ни C ABI.
//
// ── Протокол (тот же, что у бэкендов C и Go) ────────────────────────────────
// Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
// Ответ  — одна строка:  {"ok":true,"value":…}
//                   или {"ok":false,"code":"FLANG_TYPE","message":"…"}
//
// Значения размечены тегами, потому что JSON беднее flang:
//
//   null            «ничто»
//   true / false    признак
//   {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
//                   (по той же причине строкой едут «depth» и «steps»)
//   {"s":"текст"}   строка
//   {"l":[…]}       список
//   {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
//   {"v":"Имя","f":[["поле",…]]}       вариант
//
// ── Почему JSON разбирается вручную ─────────────────────────────────────────
// Внешних зависимостей у напечатанного крейта нет и не будет: код обязан
// собираться в офлайне, без реестра пакетов, на голом тулчейне. Разбор
// подмножества JSON, которого хватает этому протоколу, — двести строк, и они
// проверяются той же сверкой с интерпретатором, что и всё остальное.
//
// ── Почему вычисление уезжает в отдельный поток ─────────────────────────────
// Предел глубины вызовов у flang — 10 000 кадров, и нехвостовая рекурсия
// напечатанной программы занимает столько же настоящих кадров Rust. Стека
// главного потока (8 МиБ по умолчанию) на это не хватает, а переполнение стека
// в Rust — не паника, а аварийный останов процесса: ни кода, ни текста ошибки
// вызывающий не получит. Поэтому работа идёт в потоке с заведомо большим
// стеком, и предел срабатывает раньше, чем кончается стек, — то есть отказ
// приходит диагностикой `FLANG_RECURSION_LIMIT`, как у интерпретатора.

use std::io::{BufRead, Write};

use crate::program;
use crate::runtime as rt;

/// Стек потока вычисления считается по объявленному пределу глубины ЭТОЙ
/// программы (`rt::stack_wanted`), а не берётся числом.
///
/// Раньше здесь стояло `512 * 1024 * 1024` с подписью «с запасом на 10 000
/// кадров». Запас и правда был — на 10 000, — но предел глубины поднимается
/// ключом печати, а константа не поднималась вместе с ним: при `--max-depth
/// 500000` программа умирала не отказом, а `fatal runtime error: stack
/// overflow, aborting`. Стек обязан быть отведён под ТОТ предел, который
/// объявлен, иначе объявленный предел пределом не является.
///
/// Это резервирование адресного пространства, а не расход памяти: страницы
/// выделяются по мере касания. И это не всё лечение, а половина: там, где
/// система такого стека не даёт, обещание держит сторож в `rt::Ctx::enter`.

// ───────────────────────────── разбор JSON ─────────────────────────────

/// Дерево JSON — ровно то подмножество, которое встречается в протоколе.
#[derive(Debug, Clone)]
enum Json {
    Null,
    Bool(bool),
    Number(f64),
    Text(String),
    Array(Vec<Json>),
    Object(Vec<(String, Json)>),
}

impl Json {
    fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(pairs) => pairs.iter().find(|(name, _)| name == key).map(|(_, value)| value),
            _ => None,
        }
    }

    fn as_text(&self) -> Option<&str> {
        match self {
            Json::Text(value) => Some(value),
            _ => None,
        }
    }
}

struct Parser {
    text: Vec<char>,
    at: usize,
}

impl Parser {
    fn new(source: &str) -> Parser {
        Parser { text: source.chars().collect(), at: 0 }
    }

    fn peek(&self) -> Option<char> {
        self.text.get(self.at).copied()
    }

    fn bump(&mut self) -> Option<char> {
        let symbol = self.peek();
        if symbol.is_some() {
            self.at = self.at.saturating_add(1);
        }
        symbol
    }

    fn skip_spaces(&mut self) {
        while matches!(self.peek(), Some(' ') | Some('\t') | Some('\n') | Some('\r')) {
            self.at = self.at.saturating_add(1);
        }
    }

    fn expect(&mut self, symbol: char) -> Result<(), String> {
        if self.bump() == Some(symbol) {
            Ok(())
        } else {
            Err(format!("ожидался символ «{symbol}»"))
        }
    }

    fn literal(&mut self, word: &str) -> Result<(), String> {
        for symbol in word.chars() {
            if self.bump() != Some(symbol) {
                return Err(format!("ожидалось «{word}»"));
            }
        }
        Ok(())
    }

    fn value(&mut self) -> Result<Json, String> {
        self.skip_spaces();
        match self.peek() {
            None => Err("неожиданный конец строки".to_string()),
            Some('n') => {
                self.literal("null")?;
                Ok(Json::Null)
            }
            Some('t') => {
                self.literal("true")?;
                Ok(Json::Bool(true))
            }
            Some('f') => {
                self.literal("false")?;
                Ok(Json::Bool(false))
            }
            Some('"') => Ok(Json::Text(self.string()?)),
            Some('[') => self.array(),
            Some('{') => self.object(),
            Some(_) => self.number(),
        }
    }

    fn array(&mut self) -> Result<Json, String> {
        self.expect('[')?;
        let mut items = Vec::new();
        self.skip_spaces();
        if self.peek() == Some(']') {
            self.at = self.at.saturating_add(1);
            return Ok(Json::Array(items));
        }
        loop {
            items.push(self.value()?);
            self.skip_spaces();
            match self.bump() {
                Some(',') => continue,
                Some(']') => return Ok(Json::Array(items)),
                _ => return Err("ожидалась «,» или «]»".to_string()),
            }
        }
    }

    fn object(&mut self) -> Result<Json, String> {
        self.expect('{')?;
        let mut pairs = Vec::new();
        self.skip_spaces();
        if self.peek() == Some('}') {
            self.at = self.at.saturating_add(1);
            return Ok(Json::Object(pairs));
        }
        loop {
            self.skip_spaces();
            let key = self.string()?;
            self.skip_spaces();
            self.expect(':')?;
            pairs.push((key, self.value()?));
            self.skip_spaces();
            match self.bump() {
                Some(',') => continue,
                Some('}') => return Ok(Json::Object(pairs)),
                _ => return Err("ожидалась «,» или «}»".to_string()),
            }
        }
    }

    fn string(&mut self) -> Result<String, String> {
        self.expect('"')?;
        let mut out = String::new();
        loop {
            match self.bump() {
                None => return Err("строка не закрыта".to_string()),
                Some('"') => return Ok(out),
                Some('\\') => match self.bump() {
                    Some('"') => out.push('"'),
                    Some('\\') => out.push('\\'),
                    Some('/') => out.push('/'),
                    Some('b') => out.push('\u{8}'),
                    Some('f') => out.push('\u{c}'),
                    Some('n') => out.push('\n'),
                    Some('r') => out.push('\r'),
                    Some('t') => out.push('\t'),
                    Some('u') => out.push(self.escape()?),
                    _ => return Err("недопустимое экранирование".to_string()),
                },
                Some(symbol) => out.push(symbol),
            }
        }
    }

    /// `\uXXXX`, включая суррогатную пару: эмодзи приезжают именно так, если
    /// отправитель экранирует не-ASCII.
    fn escape(&mut self) -> Result<char, String> {
        let high = self.hex4()?;
        if (0xd800..0xdc00).contains(&high) {
            if self.peek() == Some('\\') {
                let mark = self.at;
                self.at = self.at.saturating_add(1);
                if self.peek() == Some('u') {
                    self.at = self.at.saturating_add(1);
                    let low = self.hex4()?;
                    if (0xdc00..0xe000).contains(&low) {
                        let code = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
                        return char::from_u32(code).ok_or_else(|| "недопустимый символ".to_string());
                    }
                }
                self.at = mark;
            }
            /* Одинокий суррогат в char не представим; символ замены сохраняет
            длину строки и не роняет разбор. */
            return Ok('\u{fffd}');
        }
        char::from_u32(high).ok_or_else(|| "недопустимый символ".to_string())
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let mut code = 0u32;
        for _ in 0..4 {
            let digit = match self.bump() {
                Some(symbol) => symbol.to_digit(16).ok_or_else(|| "ожидалась шестнадцатеричная цифра".to_string())?,
                None => return Err("оборванное экранирование".to_string()),
            };
            code = code.saturating_mul(16).saturating_add(digit);
        }
        Ok(code)
    }

    fn number(&mut self) -> Result<Json, String> {
        let start = self.at;
        while matches!(self.peek(), Some(symbol) if symbol.is_ascii_digit()
            || symbol == '-' || symbol == '+' || symbol == '.' || symbol == 'e' || symbol == 'E')
        {
            self.at = self.at.saturating_add(1);
        }
        let text: String = self.text.get(start..self.at).unwrap_or(&[]).iter().collect();
        text.parse().map(Json::Number).map_err(|_| format!("не число: {text}"))
    }
}

fn parse_json(source: &str) -> Result<Json, String> {
    let mut parser = Parser::new(source);
    let value = parser.value()?;
    parser.skip_spaces();
    if parser.at < parser.text.len() {
        return Err("лишние символы после значения".to_string());
    }
    Ok(value)
}

// ───────────────────────────── чтение значений ─────────────────────────────

/// Число приезжает строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля.
fn parse_number(text: &str) -> f64 {
    match text {
        "NaN" => f64::NAN,
        "Infinity" => f64::INFINITY,
        "-Infinity" => f64::NEG_INFINITY,
        _ => text.parse().unwrap_or(f64::NAN),
    }
}

fn decode_value(node: &Json) -> Result<rt::Value, String> {
    match node {
        Json::Null => Ok(rt::nothing()),
        Json::Bool(value) => Ok(rt::flag(*value)),
        Json::Number(value) => Ok(rt::number(*value)),
        Json::Text(_) | Json::Array(_) => Err("нечего декодировать".to_string()),
        Json::Object(_) => {
            if let Some(item) = node.get("n") {
                let text = item.as_text().ok_or_else(|| "число обязано ехать строкой".to_string())?;
                return Ok(rt::number(parse_number(text)));
            }
            if let Some(item) = node.get("s") {
                let text = item.as_text().ok_or_else(|| "строка обязана быть строкой".to_string())?;
                return Ok(rt::text(text));
            }
            if let Some(Json::Array(items)) = node.get("l") {
                let mut values = Vec::with_capacity(items.len());
                for item in items {
                    values.push(decode_value(item)?);
                }
                return Ok(rt::list(values));
            }
            if let Some(item) = node.get("r") {
                return Ok(rt::record(decode_pairs(item)?));
            }
            if let Some(item) = node.get("v") {
                let name = item.as_text().ok_or_else(|| "имя варианта обязано быть строкой".to_string())?;
                let fields = match node.get("f") {
                    Some(pairs) => decode_pairs(pairs)?,
                    None => Vec::new(),
                };
                return Ok(rt::variant(name, fields));
            }
            Err("нечего декодировать".to_string())
        }
    }
}

fn decode_pairs(node: &Json) -> Result<Vec<rt::Field>, String> {
    let items = match node {
        Json::Array(items) => items,
        _ => return Err("поля обязаны ехать списком пар".to_string()),
    };
    let mut fields = Vec::with_capacity(items.len());
    for item in items {
        let pair = match item {
            Json::Array(pair) if pair.len() == 2 => pair,
            _ => return Err("пара «имя, значение» обязана быть из двух элементов".to_string()),
        };
        let name = pair
            .first()
            .and_then(Json::as_text)
            .ok_or_else(|| "имя поля обязано быть строкой".to_string())?;
        let value = decode_value(pair.get(1).unwrap_or(&Json::Null))?;
        fields.push(rt::field(name, value));
    }
    Ok(fields)
}

// ───────────────────────────── печать значений ─────────────────────────────

fn write_value(out: &mut String, value: &rt::Value) {
    match value {
        rt::Value::Nothing => out.push_str("null"),
        rt::Value::Flag(item) => out.push_str(if *item { "true" } else { "false" }),
        rt::Value::Number(item) => {
            out.push_str("{\"n\":");
            // −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно.
            if *item == 0.0 && item.is_sign_negative() {
                out.push_str(&rt::quote_json("-0"));
            } else {
                out.push_str(&rt::quote_json(&rt::number_text(*item)));
            }
            out.push('}');
        }
        rt::Value::Text(item) => {
            out.push_str("{\"s\":");
            out.push_str(&rt::quote_json(item));
            out.push('}');
        }
        rt::Value::List(items) => {
            out.push_str("{\"l\":[");
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_value(out, item);
            }
            out.push_str("]}");
        }
        rt::Value::Record(fields) => {
            out.push_str("{\"r\":[");
            write_fields(out, fields);
            out.push_str("]}");
        }
        rt::Value::Variant(data) => {
            out.push_str("{\"v\":");
            out.push_str(&rt::quote_json(&data.name));
            out.push_str(",\"f\":[");
            write_fields(out, &data.fields);
            out.push_str("]}");
        }
    }
}

fn write_fields(out: &mut String, fields: &[rt::Field]) {
    for (index, item) in fields.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push('[');
        out.push_str(&rt::quote_json(&item.name));
        out.push(',');
        write_value(out, &item.value);
        out.push(']');
    }
}

// ───────────────────────────── запрос ─────────────────────────────

fn failure(code: &str, message: &str) -> String {
    format!(
        "{{\"ok\":false,\"code\":{},\"message\":{}}}",
        rt::quote_json(code),
        rt::quote_json(message)
    )
}

fn run_request(line: &str) -> String {
    let query = match parse_json(line) {
        Ok(value) => value,
        Err(_) => return failure("CLI", "неразборчивый запрос"),
    };
    let name = match query.get("fn").and_then(Json::as_text) {
        Some(value) if !value.is_empty() => value.to_string(),
        _ => return failure("CLI", "в запросе нет имени функции"),
    };

    let ctx = program::new_context();
    if let Some(depth) = query.get("depth").and_then(Json::as_text) {
        ctx.set_max_depth(parse_number(depth) as i64);
    }
    if let Some(steps) = query.get("steps").and_then(Json::as_text) {
        ctx.set_max_steps(parse_number(steps) as i64);
    }

    let mut args = Vec::new();
    if let Some(Json::Array(items)) = query.get("args") {
        for item in items {
            match decode_value(item) {
                Ok(value) => args.push(value),
                Err(_) => return failure("CLI", "неразборчивые аргументы"),
            }
        }
    }

    match program::call(&ctx, &name, args) {
        Ok(value) => {
            let mut out = String::from("{\"ok\":true,\"value\":");
            write_value(&mut out, &value);
            out.push('}');
            out
        }
        Err(error) => failure(&error.code, &error.message),
    }
}

fn serve() {
    let input = std::io::stdin();
    let mut out = std::io::BufWriter::new(std::io::stdout());
    for line in input.lock().lines() {
        let line = match line {
            Ok(value) => value,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if writeln!(out, "{}", run_request(trimmed)).is_err() {
            break;
        }
        if out.flush().is_err() {
            break;
        }
    }
}

/// Точка входа прогонщика.
pub fn main() {
    let stack = rt::stack_wanted(program::new_context().max_depth());
    /* Запас объявляется ДО запуска: поток спросит о нём в первом же
    `rt::Ctx::new`, и объявить после `join` значило бы сторожить весь расчёт по
    стеку главного потока — то есть не воспользоваться заведённым ни на байт. */
    rt::set_stack_room(stack.saturating_sub(rt::STACK_MARGIN));
    match std::thread::Builder::new().stack_size(stack).spawn(serve) {
        Ok(handle) => {
            if handle.join().is_err() {
                std::process::exit(1);
            }
        }
        /* Поток не создался — считаем на главном: лучше меньший стек, чем
        отказ обслуживать запросы вовсе. Сторожу объявляется не ноль (ноль его
        выключил бы, и вернулся бы аварийный останов), а восемь мегабайт —
        столько даёт главному потоку система по умолчанию. Занизить значит
        отказать раньше, чем нужно, и сказать об этом словами; завысить значит
        упасть молча. Первое — диагностика, второе — дефект. */
        Err(_) => {
            rt::set_stack_room(rt::STACK_MIN - rt::STACK_MARGIN);
            serve();
        }
    }
}
