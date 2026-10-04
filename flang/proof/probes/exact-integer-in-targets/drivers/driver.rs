// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// Проба цели «rust»: точное целое складывается разрядами основания 2²², и сумма
// за 2⁵³ печатается десятичной записью.
//
// Десятичная запись считается здесь своими руками: длинных целых у Rust нет ни
// в языке, ни в стандартной библиотеке (ADR-0036 §6, третья цена), а крейт
// брать нельзя (ADR-0012). Рантайму она не нужна — он держит значение
// разрядами, — и потому лежит в пробе, а не в flang_runtime.rs.

mod flang_runtime;

use flang_runtime::{add, list, number, Ctx, Value};

const BASE: u64 = 4_194_304;

fn digits(values: &[f64]) -> Value {
    list(values.iter().map(|value| number(*value)).collect())
}

fn places(value: &Value) -> Vec<u64> {
    match value {
        Value::List(items) => items
            .as_slice()
            .iter()
            .map(|item| match item {
                Value::Number(digit) => *digit as u64,
                _ => 0,
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// Разряды → десятичная запись: школьным умножением на основание.
fn decimal(value: &Value) -> String {
    let mut cells: Vec<u8> = vec![0];
    for digit in places(value).iter().rev() {
        let mut carry = *digit;
        for cell in cells.iter_mut() {
            let wide = u64::from(*cell) * BASE + carry;
            *cell = (wide % 10) as u8;
            carry = wide / 10;
        }
        while carry > 0 {
            cells.push((carry % 10) as u8);
            carry /= 10;
        }
    }
    while cells.len() > 1 && cells.last() == Some(&0) {
        cells.pop();
    }
    cells.iter().rev().map(|cell| char::from(b'0' + cell)).collect()
}

fn total(ctx: &Ctx, label: &str, left: Value, right: Value) {
    match add(ctx, left, right) {
        Ok(sum) => {
            let words: Vec<String> = places(&sum).iter().map(|digit| digit.to_string()).collect();
            println!("{}\t{}\t{}", label, words.join(","), decimal(&sum));
        }
        Err(refusal) => println!("{}\tОТКАЗ\t{}", label, refusal.message),
    }
}

fn main() {
    let ctx = Ctx::new();
    total(&ctx, "beyond", digits(&[1.0, 0.0, 512.0]), digits(&[1.0]));
    total(&ctx, "carry", digits(&[4194303.0]), digits(&[1.0]));
    total(&ctx, "wide", digits(&[4194303.0, 4194303.0, 4194303.0]), digits(&[1.0, 0.0, 0.0]));
    total(&ctx, "denormal", digits(&[4194305.0]), digits(&[0.0]));
    total(&ctx, "forged", digits(&[1.0, 0.0, 511.0]), digits(&[1.0]));
    if let Ok(Value::Number(plain)) = add(&ctx, number(2.0), number(3.0)) {
        println!("numbers\t{}", plain as i64);
    }
    if let Err(refusal) = add(&ctx, digits(&[1.0, 0.0, 512.0]), number(1.0)) {
        println!("refusal\t{}", refusal.message);
    }
}
