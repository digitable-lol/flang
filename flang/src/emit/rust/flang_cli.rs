// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
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
            for (index, item) in items.as_slice().iter().enumerate() {
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

    /* Граница входа — ДО вызова: значения приехали снаружи, программой не
    являются и сверяются с объявленными типами. Значение вне типа выносит вместе
    с типом и доказательство завершения `тотальной`, а поймать вечную цепочку
    потом нечем — сторожа в доказанно тотальной функции нет. */
    if let Err(error) = rt::check_entry(program::entry(), &name, &args) {
        return failure(&error.code, &error.message);
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

// ───────────────────────── строка, которая не текст ─────────────────────────
//
// Запрос протокола — строка, а строка в этом языке UTF-8 (SPEC, раздел 5). До
// 22 августа 2026 негодный октет проходил сквозь восемь прогонщиков ПЯТЬЮ
// разными способами, и отказом не был ни один. Rust был ХУДШИМ: `lines()`
// отдавал ошибку, цикл делал `break`, процесс выходил кодом 0 — ни ответа, ни
// отказа. Зелёный код при несделанной работе читается как «всё хорошо».
// Замер и таблица — scripts/bad-octet-guard.sh.
//
// Теперь у семи целей из восьми одно: диагностика FLANG_IO_NOT_TEXT в поток
// ошибок, код возврата 1, разбора нет. Строки ДО негодной уже отвечены и
// остаются отвеченными. Восьмая, js, названа долгом вслух: её прогонщик —
// рукописный JavaScript, править который в этом дереве запрещено.

/// Первый октет, не складывающийся в UTF-8, — номером с единицы; 0 значит
/// «текст». Свой разбор, а не `str::from_utf8`: ответ нужен НОМЕРОМ, и правила
/// обязаны совпасть с `fl_utf8_not_text_at` рантайма C до пересокращённой
/// записи и суррогатов включительно.
fn not_text_at(raw: &[u8]) -> usize {
    let mut at = 0usize;
    while at < raw.len() {
        let lead = raw[at];
        let (more, mut point): (usize, u32) = if lead < 0x80 {
            at += 1;
            continue;
        } else if lead & 0xE0 == 0xC0 {
            (1, u32::from(lead & 0x1F))
        } else if lead & 0xF0 == 0xE0 {
            (2, u32::from(lead & 0x0F))
        } else if lead & 0xF8 == 0xF0 {
            (3, u32::from(lead & 0x07))
        } else {
            return at + 1;
        };
        if at + more >= raw.len() {
            return at + 1;
        }
        for step in 1..=more {
            let next = raw[at + step];
            if next & 0xC0 != 0x80 {
                return at + 1;
            }
            point = (point << 6) | u32::from(next & 0x3F);
        }
        /* Пересокращённая запись, суррогат и всё выше U+10FFFF — тоже не текст:
        иначе у одного знака было бы два написания, и счёт разошёлся бы. */
        if (more == 1 && point < 0x80)
            || (more == 2 && point < 0x800)
            || (more == 3 && point < 0x10000)
            || point > 0x10FFFF
            || (0xD800..=0xDFFF).contains(&point)
        {
            return at + 1;
        }
        at += more + 1;
    }
    0
}

/// Отказ «строка не текст»: номер строки, номер октета в ней (с единицы), длина
/// строки в октетах и значение негодного октета. Текст один на семь целей —
/// сторож сверяет его байт в байт.
fn refuse_not_text(line: usize, raw: &[u8], at: usize) -> ! {
    eprintln!(
        "FLANG_IO_NOT_TEXT: строка {} не текст: октет {} из {} (0x{:02X}) не складывается в UTF-8; запрос обязан ехать в UTF-8",
        line,
        at,
        raw.len(),
        raw[at - 1]
    );
    std::process::exit(1)
}

fn serve() {
    let input = std::io::stdin();
    let mut source = input.lock();
    let mut out = std::io::BufWriter::new(std::io::stdout());
    let mut raw: Vec<u8> = Vec::new();
    let mut number = 0usize;
    loop {
        raw.clear();
        /* Октеты, а не `lines()`: `lines()` требует UTF-8 и на негодном октете
        отдаёт ошибку вместо строки — то есть отбирает возможность НАЗВАТЬ
        октет, ради которой всё и делается. */
        match source.read_until(b'\n', &mut raw) {
            Ok(0) => break,
            Ok(_) => {}
            Err(error) => {
                let _ = out.flush();
                eprintln!("FLANG_IO_READ: вход прогонщика не читается: {error}");
                std::process::exit(1);
            }
        }
        number += 1;
        /* Хвостовой «\r» снимается ТОЛЬКО для счёта: он ASCII и текстом быть не
        мешает, а число «из скольких» обязано совпасть с теми целями, чей
        построчный читатель снимает его сам (Go, Java, C#). */
        while matches!(raw.last(), Some(b'\n') | Some(b'\r')) {
            raw.pop();
        }
        let at = not_text_at(&raw);
        if at > 0 {
            let _ = out.flush();
            refuse_not_text(number, &raw, at);
        }
        let line = match std::str::from_utf8(&raw) {
            Ok(value) => value,
            /* Недостижимо: выше судили по тем же правилам. Отказ, а не
            `unwrap`: паника прогонщика — это то же молчание, от которого
            лечим. */
            Err(_) => {
                let _ = out.flush();
                refuse_not_text(number, &raw, 1);
            }
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
    main_with_plans(&[]);
}

/// Таблица планов программы: имя плана, функция начала, функция шага —
/// исходными именами flang. Печать кладёт её в модуль программы и зовёт
/// `main_with_plans` из `main.rs` только у программы с планом (ADR-0100).
pub type Plans = &'static [(&'static str, &'static str, &'static str)];

/// Точка входа прогонщика у программы с планом: `--plan <имя> [довод…]`
/// исполняет план, без ключа — прежний поток запросов.
pub fn main_with_plans(plans: Plans) {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && (args[1] == "--plan" || args[1] == "--план") {
        let name = args.get(2).cloned().unwrap_or_default();
        let rest: Vec<String> = args.iter().skip(3).cloned().collect();
        let code = deep(move || run_plan(plans, &name, &rest));
        std::process::exit(code);
    }
    deep(|| {
        serve();
        0
    });
}

/// Работа в потоке с большим стеком; код возврата — её же.
fn deep<F: FnOnce() -> i32 + Send + Clone + 'static>(work: F) -> i32 {
    let stack = rt::stack_wanted(program::new_context().max_depth());
    /* Запас объявляется ДО запуска: поток спросит о нём в первом же
    `rt::Ctx::new`, и объявить после `join` значило бы сторожить весь расчёт по
    стеку главного потока — то есть не воспользоваться заведённым ни на байт. */
    rt::set_stack_room(stack.saturating_sub(rt::STACK_MARGIN));
    match std::thread::Builder::new()
        .stack_size(stack)
        .spawn(work.clone())
    {
        Ok(handle) => match handle.join() {
            Ok(code) => code,
            Err(_) => std::process::exit(1),
        },
        /* Поток не создался — считаем на главном: лучше меньший стек, чем
        отказ обслуживать запросы вовсе. Сторожу объявляется не ноль (ноль его
        выключил бы, и вернулся бы аварийный останов), а восемь мегабайт —
        столько даёт главному потоку система по умолчанию. Занизить значит
        отказать раньше, чем нужно, и сказать об этом словами; завысить значит
        упасть молча. Первое — диагностика, второе — дефект. */
        Err(_) => {
            rt::set_stack_room(rt::STACK_MIN - rt::STACK_MARGIN);
            work()
        }
    }
}

// ───────────────────────────── план ─────────────────────────────
//
// Исполнитель плана — порт `flang/src/emit/js/flang_io.js` на значения
// рантайма Rust: тот же цикл «шаг → поручение → отклик», те же исходы и коды
// возврата, что у `flang io`: 0 — конец работы, 1 — «Провал» (план сдался
// сам), 3 — «Не проверено» либо сломанный инструмент. Хозяин ниже исполняет
// девять родов поручений — файлы текстом и октетами, каталоги, среду и доводы; на остальные он
// отвечает отказом с кодом, называющим род. Пути считаются от каталога запуска.

/// Сколько поручений исполнитель выдаёт, прежде чем сдаться.
const IO_LIMIT: usize = 10000;

/// Роды поручений словаря языка: поручение не из списка до хозяина не доходит.
const IO_ORDERS: &[&str] = &[
    "Прочитать файл",
    "Записать файл",
    "Прочитать октеты из файла",
    "Записать октеты в файл",
    "Запросить",
    "Текущее время",
    "Случайное число",
    "Случайные октеты",
    "Показать",
    "Ждать событие",
    "Перечислить каталог",
    "Запустить процесс",
    "Запустить процесс с вводом",
    "Запустить процесс с пределом",
    "Открыть соединение",
    "Принять соединение",
    "Прочитать из соединения",
    "Ответить в соединение",
    "Прочитать октеты из соединения",
    "Ответить октетами в соединение",
    "Удалить файл",
    "Завести временный каталог",
    "Прочитать переменную среды",
    "Прочитать доводы",
    "Размер экрана",
];

/// Беда прогона плана; `gave_up` ставится только «Провалу».
struct PlanError {
    code: String,
    message: String,
    gave_up: bool,
}

fn plan_fail(code: &str, message: String) -> PlanError {
    PlanError {
        code: code.to_string(),
        message,
        gave_up: false,
    }
}

fn io_field(value: &rt::Value, name: &str) -> rt::Value {
    if let rt::Value::Variant(data) = value {
        for field in data.fields.iter() {
            if &*field.name == name {
                return field.value.clone();
            }
        }
    }
    rt::nothing()
}

fn io_name(value: &rt::Value) -> Option<String> {
    match value {
        rt::Value::Variant(data) => Some(data.name.to_string()),
        _ => None,
    }
}

fn io_say(value: &rt::Value, spare: &str, allow_empty: bool) -> String {
    match value {
        rt::Value::Text(text) if allow_empty || !text.is_empty() => text.to_string(),
        _ => spare.to_string(),
    }
}

fn io_text(order: &rt::Value, name: &str) -> Option<String> {
    match io_field(order, name) {
        rt::Value::Text(text) => Some(text.to_string()),
        _ => None,
    }
}

fn field(name: &str, value: rt::Value) -> rt::Field {
    rt::Field {
        name: std::rc::Rc::from(name),
        value,
    }
}

/// Функция программы в свежем контексте: пределы — на одно обращение плана.
fn plan_call(name: &str, args: Vec<rt::Value>) -> Result<rt::Value, PlanError> {
    program::call(&program::new_context(), name, args).map_err(|bad| PlanError {
        code: bad.code.clone(),
        message: bad.message.clone(),
        gave_up: false,
    })
}

fn find_plan(
    plans: Plans,
    name: &str,
) -> Result<(&'static str, &'static str, &'static str), PlanError> {
    if plans.is_empty() {
        return Err(plan_fail(
            "FLANG_UNKNOWN_PLAN",
            "в программе нет ни одного плана: исполнять нечего".to_string(),
        ));
    }
    if name.is_empty() {
        if plans.len() == 1 {
            return Ok(plans[0]);
        }
        let names: Vec<String> = plans.iter().map(|plan| format!("«{}»", plan.0)).collect();
        return Err(plan_fail(
            "FLANG_UNKNOWN_PLAN",
            format!("планов несколько ({}) — назовите нужный", names.join(", ")),
        ));
    }
    plans
        .iter()
        .find(|plan| plan.0 == name)
        .copied()
        .ok_or_else(|| plan_fail("FLANG_UNKNOWN_PLAN", format!("не найден план «{name}»")))
}

fn io_run(
    plans: Plans,
    name: &str,
    perform: &dyn Fn(&rt::Value) -> rt::Value,
) -> Result<(rt::Value, usize), PlanError> {
    let (plan, initial, step_name) = find_plan(plans, name)?;
    let mut state = plan_call(initial, Vec::new())?;
    let mut response = rt::variant("Пока ничего", Vec::new());
    let mut given = 0usize;
    loop {
        let step = plan_call(step_name, vec![state, response])?;
        let not_step = || {
            plan_fail(
                "FLANG_IO",
                format!("шаг плана «{plan}» вернул не «Продолжение»"),
            )
        };
        match io_name(&step).as_deref() {
            Some("Конец работы") => return Ok((io_field(&step, "значение"), given)),
            Some("Провал") => {
                let mut bad = plan_fail(
                    &io_say(&io_field(&step, "код"), "FLANG_IO_FAILED", false),
                    io_say(
                        &io_field(&step, "сообщение"),
                        &format!("план «{plan}» отказался продолжать"),
                        true,
                    ),
                );
                bad.gave_up = true;
                return Err(bad);
            }
            Some("Не проверено") => {
                return Err(plan_fail(
                    &io_say(&io_field(&step, "код"), "FLANG_IO_NOT_CHECKED", false),
                    io_say(
                        &io_field(&step, "сообщение"),
                        &format!("план «{plan}» не смог проверить предмет"),
                        true,
                    ),
                ))
            }
            Some("Сделать") => {}
            _ => return Err(not_step()),
        }
        if given >= IO_LIMIT {
            return Err(plan_fail(
                "FLANG_IO_LIMIT",
                format!("план «{plan}» исчерпал предел поручений ({IO_LIMIT})"),
            ));
        }
        let order = io_field(&step, "поручение");
        match io_name(&order) {
            Some(kind) if IO_ORDERS.contains(&kind.as_str()) => {}
            Some(kind) => {
                return Err(plan_fail(
                    "FLANG_IO",
                    format!("план «{plan}» просит выполнить не поручение: вариант «{kind}»"),
                ))
            }
            None => {
                return Err(plan_fail(
                    "FLANG_IO",
                    format!("план «{plan}» просит выполнить не поручение: не вариант суммы"),
                ))
            }
        }
        state = io_field(&step, "потом");
        response = perform(&order);
        given += 1;
    }
}

fn io_fault(code: &str, message: String) -> rt::Value {
    rt::variant(
        "Сбой",
        vec![
            field("код", rt::text(code)),
            field("сообщение", rt::text(&message)),
        ],
    )
}

/// Причина отказа системы словами `strerror`, без хвоста « (os error N)».
fn io_why(error: &std::io::Error) -> String {
    let text = error.to_string();
    match text.find(" (os error") {
        Some(at) => text[..at].to_string(),
        None => text,
    }
}

fn io_path(order: &rt::Value, name: &str) -> Result<String, rt::Value> {
    match io_text(order, name) {
        Some(given) if !given.is_empty() => Ok(given),
        _ => Err(io_fault(
            "FLANG_IO_PATH",
            "поручению нужен непустой путь".to_string(),
        )),
    }
}

/// Хозяин: функция «поручение → отклик» над каталогом запуска.
fn io_perform(order: &rt::Value, args: &[String]) -> rt::Value {
    let kind = io_name(order).unwrap_or_default();
    match kind.as_str() {
        "Прочитать файл" => {
            let full = match io_path(order, "путь") {
                Ok(full) => full,
                Err(bad) => return bad,
            };
            match std::fs::read(&full) {
                Err(error) => io_fault(
                    "FLANG_IO_READ",
                    format!("файл не прочитан: {}", io_why(&error)),
                ),
                Ok(octets) => match String::from_utf8(octets) {
                    Ok(body) => rt::variant("Прочитано", vec![field("содержимое", rt::text(&body))]),
                    Err(bad) => io_fault(
                        "FLANG_IO_NOT_TEXT",
                        format!(
                            "файл не текст: {} октет(ов) не складываются в UTF-8; октеты возит «Прочитать октеты из файла»",
                            bad.as_bytes().len()
                        ),
                    ),
                },
            }
        }
        "Записать файл" => {
            let body = io_text(order, "содержимое").unwrap_or_default();
            let full = match io_path(order, "путь") {
                Ok(full) => full,
                Err(bad) => return bad,
            };
            match std::fs::write(&full, body.as_bytes()) {
                Err(error) => io_fault(
                    "FLANG_IO_WRITE",
                    format!("файл не записан: {}", io_why(&error)),
                ),
                /* Кодовые точки, а не октеты: «сколько» обязано совпасть с `длина`. */
                Ok(()) => rt::variant(
                    "Записано",
                    vec![field("сколько", rt::number(body.chars().count() as f64))],
                ),
            }
        }
        "Прочитать октеты из файла" => {
            let full = match io_path(order, "путь") {
                Ok(full) => full,
                Err(bad) => return bad,
            };
            match std::fs::read(&full) {
                Err(error) => io_fault(
                    "FLANG_IO_READ",
                    format!("файл не прочитан: {}", io_why(&error)),
                ),
                Ok(octets) => {
                    let items = octets
                        .iter()
                        .map(|octet| rt::number(f64::from(*octet)))
                        .collect();
                    rt::variant("Октеты", vec![field("октеты", rt::list(items))])
                }
            }
        }
        "Записать октеты в файл" => {
            let given = io_field(order, "октеты");
            let rt::Value::List(items) = given else {
                return io_fault(
                    "FLANG_IO_OCTETS",
                    "поручению нужен список октетов, а дан не список".to_string(),
                );
            };
            let mut octets: Vec<u8> = Vec::new();
            for (at, item) in items.as_slice().iter().enumerate() {
                match item {
                    rt::Value::Number(number)
                        if (0.0..=255.0).contains(number) && number.fract() == 0.0 =>
                    {
                        octets.push(*number as u8);
                    }
                    _ => {
                        return io_fault(
                            "FLANG_IO_OCTETS",
                            format!("октет {} не годится: нужно целое от 0 до 255", at + 1),
                        )
                    }
                }
            }
            let full = match io_path(order, "путь") {
                Ok(full) => full,
                Err(bad) => return bad,
            };
            match std::fs::write(&full, &octets) {
                Err(error) => io_fault(
                    "FLANG_IO_WRITE",
                    format!("файл не записан: {}", io_why(&error)),
                ),
                Ok(()) => rt::variant(
                    "Записано",
                    vec![field("сколько", rt::number(octets.len() as f64))],
                ),
            }
        }
        "Перечислить каталог" => {
            let full = match io_path(order, "путь") {
                Ok(full) => full,
                Err(bad) => return bad,
            };
            match std::fs::read_dir(&full) {
                Err(error) => io_fault(
                    "FLANG_IO_LIST",
                    format!("каталог не открыт: {}", io_why(&error)),
                ),
                Ok(entries) => {
                    let mut names: Vec<String> = entries
                        .filter_map(|entry| entry.ok())
                        .map(|entry| entry.file_name().to_string_lossy().to_string())
                        .collect();
                    /* По байтам UTF-8, то есть по кодовым точкам. */
                    names.sort();
                    let items = names.iter().map(|name| rt::text(name)).collect();
                    rt::variant("Перечислено", vec![field("имена", rt::list(items))])
                }
            }
        }
        "Удалить файл" => {
            let full = match io_path(order, "путь") {
                Ok(full) => full,
                Err(bad) => return bad,
            };
            let is_dir = std::fs::symlink_metadata(&full)
                .map(|meta| meta.is_dir())
                .unwrap_or(false);
            let done = if is_dir {
                std::fs::remove_dir(&full)
            } else {
                std::fs::remove_file(&full)
            };
            match done {
                Err(error) => io_fault(
                    "FLANG_IO_REMOVE",
                    format!("имя не убрано: {}", io_why(&error)),
                ),
                Ok(()) => rt::variant("Убрано", Vec::new()),
            }
        }
        "Завести временный каталог" => {
            let given = match io_path(order, "образец") {
                Ok(given) => given,
                Err(bad) => return bad,
            };
            let letters: Vec<char> =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                    .chars()
                    .collect();
            let mut seed = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|time| time.as_nanos() as u64)
                .unwrap_or(0)
                ^ u64::from(std::process::id());
            for _ in 0..100 {
                let mut tail = String::new();
                for _ in 0..6 {
                    seed = seed
                        .wrapping_mul(6364136223846793005)
                        .wrapping_add(1442695040888963407);
                    tail.push(letters[((seed >> 33) % letters.len() as u64) as usize]);
                }
                let made = format!("{given}{tail}");
                match std::fs::create_dir(&made) {
                    /* Обратно — образец плюс хвост, в координатах плана. */
                    Ok(()) => return rt::variant("Заведено", vec![field("путь", rt::text(&made))]),
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(error) => {
                        return io_fault(
                            "FLANG_IO_TEMPDIR",
                            format!("временный каталог не заведён: {}", io_why(&error)),
                        )
                    }
                }
            }
            io_fault(
                "FLANG_IO_TEMPDIR",
                "временный каталог не заведён: имена заняты".to_string(),
            )
        }
        "Прочитать переменную среды" => match io_text(order, "имя") {
            Some(name) if !name.is_empty() => match std::env::var(&name) {
                Ok(value) => rt::variant("Значение среды", vec![field("значение", rt::text(&value))]),
                Err(_) => rt::variant("Переменной среды нет", Vec::new()),
            },
            _ => io_fault(
                "FLANG_IO_ENV",
                "поручению нужно непустое имя переменной".to_string(),
            ),
        },
        "Прочитать доводы" => {
            let items = args.iter().map(|arg| rt::text(arg)).collect();
            rt::variant("Доводы", vec![field("доводы", rt::list(items))])
        }
        "Показать" | "Ждать событие" | "Размер экрана" => io_fault(
            "FLANG_IO_NO_SCREEN",
            format!("у хозяина Rust нет экрана: поручение «{kind}» исполнить нечем"),
        ),
        _ => io_fault(
            "FLANG_IO_NOT_WIRED",
            format!("поручение «{kind}» в этом хозяине не заведено; исполните план двоичным: flang io <файл.flang>"),
        ),
    }
}

/// Значение в JSON того же вида, каким `flang io` печатает итог плана.
fn write_plain(out: &mut String, value: &rt::Value) {
    match value {
        rt::Value::Nothing => out.push_str("null"),
        rt::Value::Flag(item) => out.push_str(if *item { "true" } else { "false" }),
        rt::Value::Number(item) => out.push_str(&rt::number_text(*item)),
        rt::Value::Text(item) => out.push_str(&rt::quote_json(item)),
        rt::Value::List(items) => {
            out.push('[');
            for (index, item) in items.as_slice().iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_plain(out, item);
            }
            out.push(']');
        }
        rt::Value::Record(fields) => write_plain_fields(out, fields),
        rt::Value::Variant(data) => {
            out.push_str("{\"variant\":");
            out.push_str(&rt::quote_json(&data.name));
            out.push_str(",\"fields\":");
            write_plain_fields(out, &data.fields);
            out.push('}');
        }
    }
}

fn write_plain_fields(out: &mut String, fields: &[rt::Field]) {
    out.push('{');
    for (index, item) in fields.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(&rt::quote_json(&item.name));
        out.push(':');
        write_plain(out, &item.value);
    }
    out.push('}');
}

fn run_plan(plans: Plans, name: &str, args: &[String]) -> i32 {
    match io_run(plans, name, &|order| io_perform(order, args)) {
        Ok((value, given)) => {
            let mut out = String::from("{\"result\":");
            write_plain(&mut out, &value);
            out.push_str(&format!(",\"orders\":{given}}}"));
            println!("{out}");
            0
        }
        Err(bad) => {
            eprintln!(
                "{{\"error\":{},\"code\":{}}}",
                rt::quote_json(&bad.message),
                rt::quote_json(&bad.code)
            );
            if bad.gave_up {
                1
            } else {
                3
            }
        }
    }
}
