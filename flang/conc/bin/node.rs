// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//! ПОЛНЫЙ УЗЕЛ на цели rust: таблица процессов, планировщик и связь.
//!
//! ── Из чего он собран ───────────────────────────────────────────────────────
//!
//! Ни одного решения в этом файле нет. Все три части решают напечатанные модули:
//!
//!   1. связь        `flang/conc/link.flang`          — 11 событий, 8 велений
//!   2. процессы     `flang/conc/scheduler.flang` — 7 событий, 6 велений
//!   3. программа    `flang/conc/examples/distributed.flang` — обработчики
//!
//! Собраны они в один модуль `flang/conc/node-benchmark.flang` и напечатаны
//! компилятором в цель rust. Хозяин лежит вторым двоичным того же ящика
//! (`src/bin/node.rs`) и ввозит напечатанное как библиотеку: `Cargo.toml`
//! напечатан и не правится, а второй `[[bin]]` cargo находит сам.
//!
//! ── Что делает этот файл и только он ────────────────────────────────────────
//!
//!   1. держит сокеты, часы, таймеры и очередь готовых;
//!   2. переводит события мира в варианты двух эталонов;
//!   3. исполняет веления, которые эталоны вернули;
//!   4. зовёт обработчик по имени — это и есть та граница, из-за которой цикл
//!      принадлежит хозяину: передать функцию туда, где она приезжает данными,
//!      язык не умеет.
//!
//! Груз письма хозяин держит У СЕБЯ и кладёт в таблицу БИЛЕТ — число.
//!
//! ── Чем цель rust отличается от пяти прежних ────────────────────────────────
//!
//! Значение flang здесь — публичное перечисление `Value`, и читается оно
//! сопоставлением образца без единого объявления типа. Разбор JSON пришлось
//! ПОВТОРИТЬ, а не написать: он напечатан рядом (`src/cli.rs`, `enum Json` и
//! `parse_json`), но закрыт областью видимости модуля. Печать JSON своя, зато
//! цитирование строки и текст числа взяты у напечатанного рантайма
//! (`rt::quote_json`, `rt::number_text`) — иначе число на проводе разошлось бы
//! с тем, что печатают остальные хозяева.
//!
//! Второе отличие — ожидание мира. В стандартной библиотеке Rust нет `select`,
//! поэтому там, где Python ждёт мира одним вызовом, здесь стоит опрос
//! неблокирующих сокетов с шагом 5 мс и выходом по первым же байтам. Порядок
//! витка от этого не меняется: набрать → ждать мира → таймеры → пульсы →
//! сторож → пробеги.
//!
//! ── Надзор ──────────────────────────────────────────────────────────────────
//!
//! Отказ процесса доезжает до веления «Уронить процесс», и хозяин передаёт его
//! НАДЗОРУ — четвёртому напечатанному модулю, `flang/conc/supervisor.flang`. Кого
//! поднимать, кого укладывать и когда передавать выше, решает он; хозяин только
//! исполняет. Дерево надзора приезжает данными в плане, как и размещение.
//!
//! ── Чего здесь нет, и это названо ───────────────────────────────────────────
//!
//! БИЛЕТЫ НЕ ЧИСТЯТСЯ: словарь «билет → груз» растёт на долгой работе. То же у
//! остальных хозяев; названо, не починено.
//!
//! Запуск (журнал построчным JSON на stdout, как у остальных хозяев):
//!
//!     ./target/debug/node --я счёт --слушать 127.0.0.1:0 --хэш <hex> \
//!       --план-файл plan.json --размещение <json> [--срок 1000] [--жить 5]

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use flangprogram::runtime as rt;
use flangprogram::uzel_zamera as resh;

const CEL: &str = "rust";

/* ── JSON: разбор и печать ────────────────────────────────────────────────
   ПЕРЕВОЗКА, а не решение. Тот же разбор компилятор печатает рядом в
   `src/cli.rs`, но там он закрыт областью видимости модуля, и позвать его
   нельзя. Число хранится ТЕКСТОМ: на проводе оно и так едет текстом, а разбор
   в `f64` с последующей печатью потерял бы «-0». */
#[derive(Debug, Clone)]
enum Json {
    Nichto,
    Priznak(bool),
    Chislo(String),
    Stroka(String),
    Spisok(Vec<Json>),
    Zapis(Vec<(String, Json)>),
}

impl Json {
    fn pole(&self, imya: &str) -> Option<&Json> {
        match self {
            Json::Zapis(pary) => pary.iter().find(|(k, _)| k == imya).map(|(_, v)| v),
            _ => None,
        }
    }

    fn tekst_polya(&self, imya: &str, po_umolchaniyu: &str) -> String {
        match self.pole(imya) {
            Some(Json::Stroka(s)) => s.clone(),
            _ => po_umolchaniyu.to_string(),
        }
    }

    fn pechat(&self) -> String {
        match self {
            Json::Nichto => "null".to_string(),
            Json::Priznak(p) => if *p { "true".to_string() } else { "false".to_string() },
            Json::Chislo(t) => t.clone(),
            Json::Stroka(s) => rt::quote_json(s),
            Json::Spisok(xs) => {
                let vnutri: Vec<String> = xs.iter().map(|x| x.pechat()).collect();
                format!("[{}]", vnutri.join(","))
            }
            Json::Zapis(pary) => {
                let vnutri: Vec<String> =
                    pary.iter().map(|(k, v)| format!("{}:{}", rt::quote_json(k), v.pechat())).collect();
                format!("{{{}}}", vnutri.join(","))
            }
        }
    }
}

struct Chtec {
    znaki: Vec<char>,
    gde: usize,
}

impl Chtec {
    fn probely(&mut self) {
        while self.gde < self.znaki.len() && self.znaki[self.gde].is_whitespace() {
            self.gde += 1;
        }
    }

    fn znak(&self) -> Option<char> {
        self.znaki.get(self.gde).copied()
    }

    fn slovo(&mut self, slovo: &str, chem: Json) -> Option<Json> {
        for bukva in slovo.chars() {
            if self.znak() != Some(bukva) {
                return None;
            }
            self.gde += 1;
        }
        Some(chem)
    }

    fn stroka(&mut self) -> Option<Json> {
        self.gde += 1;
        let mut sobrano = String::new();
        loop {
            let znak = self.znak()?;
            self.gde += 1;
            match znak {
                '"' => return Some(Json::Stroka(sobrano)),
                '\\' => {
                    let sled = self.znak()?;
                    self.gde += 1;
                    match sled {
                        '"' => sobrano.push('"'),
                        '\\' => sobrano.push('\\'),
                        '/' => sobrano.push('/'),
                        'b' => sobrano.push('\u{8}'),
                        'f' => sobrano.push('\u{c}'),
                        'n' => sobrano.push('\n'),
                        'r' => sobrano.push('\r'),
                        't' => sobrano.push('\t'),
                        'u' => {
                            let mut kod = String::new();
                            for _ in 0..4 {
                                kod.push(self.znak()?);
                                self.gde += 1;
                            }
                            let nomer = u32::from_str_radix(&kod, 16).ok()?;
                            sobrano.push(char::from_u32(nomer)?);
                        }
                        _ => return None,
                    }
                }
                inoy => sobrano.push(inoy),
            }
        }
    }

    fn chislo(&mut self) -> Option<Json> {
        let nachalo = self.gde;
        while let Some(znak) = self.znak() {
            if znak.is_ascii_digit() || znak == '-' || znak == '+' || znak == '.' || znak == 'e' || znak == 'E' {
                self.gde += 1;
            } else {
                break;
            }
        }
        if self.gde == nachalo {
            return None;
        }
        Some(Json::Chislo(self.znaki[nachalo..self.gde].iter().collect()))
    }

    fn znachenie(&mut self) -> Option<Json> {
        self.probely();
        match self.znak()? {
            '{' => {
                self.gde += 1;
                let mut pary = Vec::new();
                self.probely();
                if self.znak() == Some('}') {
                    self.gde += 1;
                    return Some(Json::Zapis(pary));
                }
                loop {
                    self.probely();
                    let klyuch = match self.znachenie()? {
                        Json::Stroka(s) => s,
                        _ => return None,
                    };
                    self.probely();
                    if self.znak() != Some(':') {
                        return None;
                    }
                    self.gde += 1;
                    let chto = self.znachenie()?;
                    pary.push((klyuch, chto));
                    self.probely();
                    match self.znak()? {
                        ',' => self.gde += 1,
                        '}' => {
                            self.gde += 1;
                            return Some(Json::Zapis(pary));
                        }
                        _ => return None,
                    }
                }
            }
            '[' => {
                self.gde += 1;
                let mut vnutri = Vec::new();
                self.probely();
                if self.znak() == Some(']') {
                    self.gde += 1;
                    return Some(Json::Spisok(vnutri));
                }
                loop {
                    vnutri.push(self.znachenie()?);
                    self.probely();
                    match self.znak()? {
                        ',' => self.gde += 1,
                        ']' => {
                            self.gde += 1;
                            return Some(Json::Spisok(vnutri));
                        }
                        _ => return None,
                    }
                }
            }
            '"' => self.stroka(),
            't' => self.slovo("true", Json::Priznak(true)),
            'f' => self.slovo("false", Json::Priznak(false)),
            'n' => self.slovo("null", Json::Nichto),
            _ => self.chislo(),
        }
    }
}

fn razobrat_json(istochnik: &str) -> Option<Json> {
    let mut chtec = Chtec { znaki: istochnik.chars().collect(), gde: 0 };
    let chto = chtec.znachenie()?;
    chtec.probely();
    if chtec.gde == chtec.znaki.len() { Some(chto) } else { None }
}

/* ── граница значений: снаружи Rust, внутри значения flang ─────────────── */

/// Отказ эталона — поломка хозяина, а не ветвь вычисления: эталоны тотальны и
/// проверены. Поэтому здесь выход, а не молчание, — ровно как `SystemExit` у
/// хозяина на Python.
fn dolzhno(itog: Result<rt::Value, rt::Error>) -> rt::Value {
    match itog {
        Ok(znachenie) => znachenie,
        Err(beda) => {
            eprintln!("узел встал: [{}] {}", beda.code, beda.message);
            std::process::exit(1)
        }
    }
}

fn pole(ctx: &rt::Ctx, znachenie: &rt::Value, imya: &str) -> rt::Value {
    dolzhno(rt::field_get(ctx, znachenie.clone(), imya))
}

fn vn_tekst(znachenie: &rt::Value) -> String {
    match znachenie {
        rt::Value::Text(tekst) => tekst.to_string(),
        _ => String::new(),
    }
}

fn vn_chislo(znachenie: &rt::Value) -> f64 {
    match znachenie {
        rt::Value::Number(chislo) => *chislo,
        _ => 0.0,
    }
}

fn vn_priznak(znachenie: &rt::Value) -> bool {
    matches!(znachenie, rt::Value::Flag(true))
}

fn spisok(znachenie: &rt::Value) -> Vec<rt::Value> {
    match znachenie {
        rt::Value::List(elementy) => (0..elementy.len()).filter_map(|nomer| elementy.get(nomer)).collect(),
        _ => Vec::new(),
    }
}

/* ── провод: те же метки, что у остальных хозяев ───────────────────────────
   Перевод, а не решение: правило «у каждого значения метка одной буквой» живёт
   в `flang/conc/DISTRIBUTED.md`, и разойтись с ним нельзя. */
fn zakodirovat(znachenie: &rt::Value) -> Json {
    match znachenie {
        rt::Value::Nothing => Json::Spisok(vec![Json::Stroka("н".into())]),
        rt::Value::Flag(priznak) => Json::Spisok(vec![Json::Stroka("п".into()), Json::Priznak(*priznak)]),
        rt::Value::Text(tekst) => Json::Spisok(vec![Json::Stroka("с".into()), Json::Stroka(tekst.to_string())]),
        rt::Value::Number(chislo) => Json::Spisok(vec![Json::Stroka("ч".into()), chislo_naruzhu(*chislo)]),
        rt::Value::List(_) => Json::Spisok(vec![
            Json::Stroka("л".into()),
            Json::Spisok(spisok(znachenie).iter().map(zakodirovat).collect()),
        ]),
        rt::Value::Record(polya) => Json::Spisok(vec![
            Json::Stroka("з".into()),
            Json::Zapis(polya.iter().map(|p| (p.name.to_string(), zakodirovat(&p.value))).collect()),
        ]),
        rt::Value::Variant(vnutri) => Json::Spisok(vec![
            Json::Stroka("в".into()),
            Json::Stroka(vnutri.name.to_string()),
            Json::Zapis(vnutri.fields.iter().map(|p| (p.name.to_string(), zakodirovat(&p.value))).collect()),
        ]),
    }
}

/// Число наружу — текстом по правилам ECMAScript, теми же, какими его печатает
/// напечатанный рантайм. Иначе «2» уехало бы как «2.0», а «-0» как «0».
fn chislo_naruzhu(chislo: f64) -> Json {
    if chislo.is_nan() {
        return Json::Stroka("NaN".into());
    }
    if chislo == f64::INFINITY {
        return Json::Stroka("+∞".into());
    }
    if chislo == f64::NEG_INFINITY {
        return Json::Stroka("-∞".into());
    }
    if chislo == 0.0 && chislo.is_sign_negative() {
        return Json::Stroka("-0".into());
    }
    Json::Chislo(rt::number_text(chislo))
}

fn chislo_vnutr(tekst: &str) -> f64 {
    match tekst {
        "NaN" => f64::NAN,
        "+∞" => f64::INFINITY,
        "-∞" => f64::NEG_INFINITY,
        _ => tekst.parse::<f64>().unwrap_or(0.0),
    }
}

fn raskodirovat(kod: &Json) -> rt::Value {
    let chleny = match kod {
        Json::Spisok(chleny) if !chleny.is_empty() => chleny,
        _ => {
            eprintln!("не значение на проводе: {}", kod.pechat());
            std::process::exit(1)
        }
    };
    let metka = match &chleny[0] {
        Json::Stroka(metka) => metka.as_str(),
        _ => "",
    };
    match (metka, chleny.get(1), chleny.get(2)) {
        ("н", _, _) => rt::nothing(),
        ("п", Some(Json::Priznak(priznak)), _) => rt::flag(*priznak),
        ("с", Some(Json::Stroka(tekst)), _) => rt::text(tekst),
        ("ч", Some(Json::Chislo(tekst)), _) => rt::number(chislo_vnutr(tekst)),
        ("ч", Some(Json::Stroka(tekst)), _) => rt::number(chislo_vnutr(tekst)),
        ("л", Some(Json::Spisok(vnutri)), _) => rt::list(vnutri.iter().map(raskodirovat).collect()),
        ("з", Some(Json::Zapis(pary)), _) => {
            rt::record(pary.iter().map(|(imya, chto)| rt::field(imya, raskodirovat(chto))).collect())
        }
        ("в", Some(Json::Stroka(imya)), Some(Json::Zapis(pary))) => rt::variant(
            imya,
            pary.iter().map(|(polye, chto)| rt::field(polye, raskodirovat(chto))).collect(),
        ),
        _ => {
            eprintln!("неизвестная метка значения: {}", kod.pechat());
            std::process::exit(1)
        }
    }
}

fn skazat(zapis: Vec<(String, Json)>) {
    println!("{}", Json::Zapis(zapis).pechat()); // МИР
}

fn stroka(chto: &str) -> Json {
    Json::Stroka(chto.to_string())
}

/// Единственное чтение часов во всём файле.
fn chasy() -> f64 {
    let ot_nachala = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::ZERO); // МИР
    ot_nachala.as_millis() as f64
}

fn adres_bez_hozyaina(adres: &str) -> String {
    adres.to_string()
}

/* ── каналы и узел ─────────────────────────────────────────────────────── */

struct Kanal {
    kto: String,
    adres: String,
    soket: Option<TcpStream>,
    hvost: String,
    kogda_zvonit: f64,
    posledniy_puls: f64,
    sostoyanie: rt::Value,
}

struct Process {
    imya: String,
    nachalnoe: String,
    obrabotchik: String,
    yaschik: f64,
}

struct Uzel {
    imya: String,
    plan: Vec<Process>,
    hesh: String,
    srok: f64,
    puls: f64,
    pauza: f64,
    rabotaet: bool,
    semya: u32,
    ctx: rt::Ctx,
    sostoyaniya: Vec<(String, rt::Value)>,
    uzel: rt::Value,
    kanaly: Vec<Kanal>,
    server: Option<TcpListener>,
    bilet: i64,
    gruzy: HashMap<i64, rt::Value>,
    taymery: Vec<(f64, String, f64)>,
    posledniy_kadr: Option<Json>,
    sleduyuschiy_storozh: f64,
    derevo: rt::Value,
}

impl Uzel {
    fn novyy(imya: &str, plan: Vec<Process>, razmeschenie: &Json, hesh: &str, sroki: (f64, f64, f64), semya: u32, nadzory: &[Json]) -> Uzel {
        let ctx = resh::new_context();
        let mut processy = Vec::new();
        let mut sostoyaniya = Vec::new();
        for p in &plan {
            let gde = razmeschenie.tekst_polya(&p.imya, "");
            let svoy = gde == imya;
            processy.push(dolzhno(resh::funkciya_process_uzla(
                &ctx,
                rt::text(&p.imya),
                rt::flag(svoy),
                rt::text(if svoy { "" } else { &gde }),
                rt::flag(true),
                rt::text(""),
                rt::number(p.yaschik),
                rt::number(0.0),
                rt::list(vec![]),
            )));
            if svoy {
                sostoyaniya.push((p.imya.clone(), dolzhno(resh::call(&ctx, &p.nachalnoe, vec![]))));
            }
        }
        let uzel = dolzhno(resh::funkciya_uzel_zanovo(
            &ctx,
            rt::text(imya),
            rt::list(processy),
            rt::list(vec![]),
            rt::text(""),
            rt::number(0.0),
            rt::flag(true),
        ));

        /* Соседи считаются по ПРЕДСТАВИТЕЛЯМ, а не по «звонить»: узел, которого
        набирает сосед, ждёт его ровно так же, и место под связь ему нужно
        такое же. Без этого принимающая сторона отказывала бы в соединении. */
        let mut kanaly: Vec<Kanal> = Vec::new();
        for p in &plan {
            let gde = razmeschenie.tekst_polya(&p.imya, "");
            if gde != imya && !kanaly.iter().any(|k| k.kto == gde) {
                let kuda = match razmeschenie.pole("звонить") {
                    Some(zvonit) => adres_bez_hozyaina(&zvonit.tekst_polya(&gde, "")),
                    None => String::new(),
                };
                let sostoyanie = dolzhno(resh::funkciya_svyaz_uzla_zanovo(
                    &ctx,
                    rt::text(&gde),
                    rt::flag(false),
                    rt::flag(false),
                    rt::flag(false),
                    rt::flag(false),
                    rt::flag(false),
                    rt::number(0.0),
                ));
                kanaly.push(Kanal {
                    kto: gde,
                    adres: kuda,
                    soket: None,
                    hvost: String::new(),
                    kogda_zvonit: 0.0,
                    posledniy_puls: 0.0,
                    sostoyanie,
                });
            }
        }

        // Дерево надзора — данные, ровно как размещение. Решает по нему
        // напечатанный `supervisor.flang`, а не этот файл.
        let mut nadzirateli = Vec::new();
        let mut nad_processom = Vec::new();
        let mut nad_nadzorom = Vec::new();
        for n in nadzory {
            let imya_nadzora = n.tekst_polya("имя", "");
            nadzirateli.push(dolzhno(resh::funkciya_nadziratel_uzla(
                &ctx,
                rt::text(&imya_nadzora),
                rt::number(chislo_polya(n, "порог")),
                rt::number(chislo_polya(n, "окно")),
                rt::text(&n.tekst_polya("иначе", "остановить")),
            )));
            for (klyuch, kuda) in [("процессы", &mut nad_processom), ("надзоры", &mut nad_nadzorom)] {
                if let Some(Json::Spisok(svyazi)) = n.pole(klyuch) {
                    for svyaz in svyazi {
                        kuda.push(dolzhno(resh::funkciya_svyaz_nadzora_uzla(
                            &ctx,
                            rt::text(&svyaz.tekst_polya("кто", "")),
                            rt::text(&imya_nadzora),
                            rt::text(&svyaz.tekst_polya("стратегия", "")),
                        )));
                    }
                }
            }
        }
        let derevo = dolzhno(resh::funkciya_derevo_nadzora_uzla(
            &ctx,
            rt::list(nadzirateli),
            rt::list(nad_processom),
            rt::list(nad_nadzorom),
        ));

        Uzel {
            imya: imya.to_string(),
            plan,
            hesh: hesh.to_string(),
            srok: sroki.0,
            puls: sroki.1,
            pauza: sroki.2,
            rabotaet: true,
            semya,
            ctx,
            sostoyaniya,
            uzel,
            kanaly,
            server: None,
            bilet: 0,
            gruzy: HashMap::new(),
            taymery: Vec::new(),
            posledniy_kadr: None,
            sleduyuschiy_storozh: 0.0,
            derevo,
        }
    }

    // ── единственная дорога от отказа к решению надзора ────────────────────
    fn nadzor_sluchilsya(&mut self, kto: &str, kod: &str) {
        let hod = dolzhno(resh::funkciya_shag_nadzora_uzla(
            &self.ctx,
            self.derevo.clone(),
            rt::text(kto),
            rt::text(kod),
            rt::number(chasy()),
        ));
        self.derevo = pole(&self.ctx, &hod, "дерево");
        for velenie in spisok(&pole(&self.ctx, &hod, "веления")) {
            self.ispolnit_nadzor(&velenie);
        }
    }

    fn ispolnit_nadzor(&mut self, velenie: &rt::Value) {
        let (imya, polya) = match velenie {
            rt::Value::Variant(vnutri) => (vnutri.name.to_string(), vnutri.clone()),
            _ => return,
        };
        let tekst = |kak: &str| -> String {
            polya.fields.iter().find(|p| p.name.as_ref() == kak).map(|p| vn_tekst(&p.value)).unwrap_or_default()
        };
        let kto = tekst("кто");
        match imya.as_str() {
            "Поднять" => {
                // Перезапуск трогает состояние и не трогает ящик — это решено на
                // flang; здесь состояние берётся тем же путём, что при подъёме узла.
                self.uzel = dolzhno(resh::funkciya_podnyat_process_uzla(&self.ctx, self.uzel.clone(), rt::text(&kto)));
                let nachalnoe = self.plan.iter().find(|p| p.imya == kto).map(|p| p.nachalnoe.clone());
                if let Some(nachalnoe) = nachalnoe {
                    let novoe = dolzhno(resh::call(&self.ctx, &nachalnoe, vec![]));
                    // Строки может и НЕ БЫТЬ: при подъёме узла состояние заводят
                    // только своим процессам, а подхваченный чужой становится
                    // своим сейчас. Без этой ветки он поднимался бы в таблице
                    // процессов и оставался без состояния — то есть навсегда
                    // молчащим.
                    match self.sostoyaniya.iter_mut().find(|para| para.0 == kto) {
                        Some(para) => para.1 = novoe,
                        None => self.sostoyaniya.push((kto.clone(), novoe)),
                    }
                }
                skazat(vec![
                    ("в".into(), stroka("надзор")),
                    ("узел".into(), stroka(&self.imya)),
                    ("цель".into(), stroka(CEL)),
                    ("что".into(), stroka("поднят")),
                    ("кто".into(), stroka(&kto)),
                ]);
            }
            "Уложить" => {
                self.uzel = dolzhno(resh::funkciya_ulozhit_process_uzla(
                    &self.ctx,
                    self.uzel.clone(),
                    rt::text(&kto),
                    rt::text("остановлен надзором"),
                ));
                skazat(vec![
                    ("в".into(), stroka("надзор")),
                    ("узел".into(), stroka(&self.imya)),
                    ("цель".into(), stroka(CEL)),
                    ("что".into(), stroka("уложен")),
                    ("кто".into(), stroka(&kto)),
                    ("надзор".into(), stroka(&tekst("надзор"))),
                ]);
            }
            "Решено" => skazat(vec![
                ("в".into(), stroka("надзор")),
                ("узел".into(), stroka(&self.imya)),
                ("цель".into(), stroka(CEL)),
                ("что".into(), stroka("решено")),
                ("кто".into(), stroka(&kto)),
                ("надзор".into(), stroka(&tekst("надзор"))),
                ("стратегия".into(), stroka(&tekst("стратегия"))),
            ]),
            "Некому надзирать" => {
                self.uzel = dolzhno(resh::funkciya_ostanovit_uzel_celikom(&self.ctx, self.uzel.clone()));
                self.rabotaet = false;
                skazat(vec![
                    ("в".into(), stroka("надзор")),
                    ("узел".into(), stroka(&self.imya)),
                    ("цель".into(), stroka(CEL)),
                    ("что".into(), stroka("некому")),
                    ("кто".into(), stroka(&kto)),
                    ("надзор".into(), stroka(&tekst("надзор"))),
                ]);
            }
            inoe => {
                eprintln!("узел не знает веления надзора «{inoe}»");
                std::process::exit(1)
            }
        }
    }

    // ── мир: сокеты ────────────────────────────────────────────────────────
    fn slushat(&mut self, adres: &str) -> u16 {
        let sluh = TcpListener::bind(adres).unwrap_or_else(|beda| { // МИР
            eprintln!("узел не встал на {adres}: {beda}");
            std::process::exit(1)
        });
        let port = sluh.local_addr().map(|это| это.port()).unwrap_or(0); // МИР
        let _ = sluh.set_nonblocking(true); // МИР
        self.server = Some(sluh);
        port
    }

    fn pozvonit(&mut self, nomer: usize) {
        if self.kanaly[nomer].soket.is_some() || !self.rabotaet {
            return;
        }
        let adres = self.kanaly[nomer].adres.clone();
        match TcpStream::connect(&adres) { // МИР
            Ok(sok) => {
                let _ = sok.set_nodelay(true); // МИР
                let _ = sok.set_nonblocking(true); // МИР
                self.kanaly[nomer].soket = Some(sok);
                self.svyaz_sluchilas(nomer, resh::variant_soket_zavyolsya(rt::number(chasy())));
            }
            Err(_) => self.svyaz_sluchilas(nomer, resh::variant_zvonok_ne_udalsya()),
        }
    }

    /// Кто позвонил, скажет его «привет»; до него связь безымянная, и место для
    /// неё берётся первое свободное.
    fn prinyat(&mut self) {
        let sok = match self.server.as_ref() {
            Some(sluh) => match sluh.accept() { // МИР
                Ok((sok, _)) => sok,
                Err(_) => return,
            },
            None => return,
        };
        let svobodnyy = self.kanaly.iter().position(|k| k.soket.is_none());
        match svobodnyy {
            None => drop(sok), // МИР
            Some(nomer) => {
                let _ = sok.set_nodelay(true); // МИР
                let _ = sok.set_nonblocking(true); // МИР
                self.kanaly[nomer].soket = Some(sok);
                self.svyaz_sluchilas(nomer, resh::variant_soket_zavyolsya(rt::number(chasy())));
            }
        }
    }

    fn poslat(&mut self, nomer: usize, vid: &str, pary: Vec<(String, Json)>) {
        if self.kanaly[nomer].soket.is_none() {
            return;
        }
        let gotova = vn_priznak(&pole(&self.ctx, &self.kanaly[nomer].sostoyanie, "готова"));
        if !gotova && vid != "привет" {
            return;
        }
        let mut polya = vec![("в".to_string(), stroka(vid))];
        polya.extend(pary);
        let tekst = format!("{}\n", Json::Zapis(polya).pechat());
        let ushlo = match self.kanaly[nomer].soket.as_ref() {
            Some(sok) => {
                let mut kuda = sok;
                kuda.write_all(tekst.as_bytes()).is_ok() // МИР
            }
            None => false,
        };
        if !ushlo {
            self.svyaz_sluchilas(nomer, resh::variant_soket_otkazal(rt::text("запись в сокет отказала")));
        }
    }

    /// Читает всё, что пришло. Отвечает, были ли байты, — по этому ответу круг
    /// выходит из ожидания мира раньше срока, как выходит `select` у остальных.
    fn prochest(&mut self, nomer: usize) -> bool {
        let mut kusok = [0u8; 65536];
        let itog = match self.kanaly[nomer].soket.as_ref() {
            Some(sok) => {
                let mut otkuda = sok;
                otkuda.read(&mut kusok) // МИР
            }
            None => return false,
        };
        let dlina = match itog {
            Err(beda) if beda.kind() == std::io::ErrorKind::WouldBlock => return false,
            Err(_) => {
                self.svyaz_sluchilas(nomer, resh::variant_soket_otkazal(rt::text("сокет отказал")));
                return true;
            }
            Ok(0) => {
                self.svyaz_sluchilas(nomer, resh::variant_soket_otkazal(rt::text("сокет закрыт")));
                return true;
            }
            Ok(dlina) => dlina,
        };
        self.svyaz_sluchilas(nomer, resh::variant_bayty_prishli(rt::number(chasy())));
        self.kanaly[nomer].hvost.push_str(&String::from_utf8_lossy(&kusok[..dlina]));
        while self.kanaly[nomer].soket.is_some() {
            let kray = match self.kanaly[nomer].hvost.find('\n') {
                Some(kray) => kray,
                None => break,
            };
            let stroka_kadra = self.kanaly[nomer].hvost[..kray].trim().to_string();
            self.kanaly[nomer].hvost = self.kanaly[nomer].hvost[kray + 1..].to_string();
            if stroka_kadra.is_empty() {
                continue;
            }
            match razobrat_json(&stroka_kadra) {
                Some(kadr) => {
                    self.posledniy_kadr = Some(kadr.clone());
                    self.kadrom(nomer, &kadr);
                }
                None => {
                    self.svyaz_sluchilas(nomer, resh::variant_soket_otkazal(rt::text("кадр не разобран")));
                    return true;
                }
            }
        }
        true
    }

    fn pribrat(&mut self, nomer: usize) {
        self.kanaly[nomer].soket = None; // МИР: сокет закрывается своим Drop
        self.kanaly[nomer].hvost.clear();
    }

    // ── перевод: кадр провода → вариант эталона связи ──────────────────────
    fn kadrom(&mut self, nomer: usize, kadr: &Json) {
        let vid = kadr.tekst_polya("в", "");
        let sobytie = match vid.as_str() {
            "привет" => resh::variant_prishyol_privet(
                rt::text(&kadr.tekst_polya("узел", "")),
                rt::text(&kadr.tekst_polya("хэш", "")),
            ),
            "пульс" => resh::variant_prishyol_puls(),
            "письмо" => resh::variant_prishlo_pismo(rt::text(&kadr.tekst_polya("кому", ""))),
            "отбой" => resh::variant_prishyol_otboy(rt::text(&kadr.tekst_polya("почему", "без причины"))),
            inoy => resh::variant_prishyol_chuzhoy_kadr(rt::text(inoy)),
        };
        self.svyaz_sluchilas(nomer, sobytie);
    }

    // ── единственная дорога от мира к решению о связи ──────────────────────
    fn svyaz_sluchilas(&mut self, nomer: usize, sobytie: rt::Value) {
        let hod = dolzhno(resh::funkciya_shag_svyazi_uzla(
            &self.ctx,
            self.kanaly[nomer].sostoyanie.clone(),
            sobytie,
            rt::text(&self.hesh),
            rt::number(self.srok),
            rt::number(self.pauza),
            rt::flag(self.rabotaet),
        ));
        self.kanaly[nomer].sostoyanie = pole(&self.ctx, &hod, "связь");
        for velenie in spisok(&pole(&self.ctx, &hod, "веления")) {
            self.ispolnit_svyaz(nomer, &velenie);
        }
    }

    fn ispolnit_svyaz(&mut self, nomer: usize, velenie: &rt::Value) {
        let (imya, polya) = match velenie {
            rt::Value::Variant(vnutri) => (vnutri.name.to_string(), vnutri.clone()),
            _ => return,
        };
        let vzyat = |kak: &str| -> String {
            polya.fields.iter().find(|p| p.name.as_ref() == kak).map(|p| vn_tekst(&p.value)).unwrap_or_default()
        };
        match imya.as_str() {
            "Послать привет" => {
                let uzel = self.imya.clone();
                let hesh = self.hesh.clone();
                self.poslat(nomer, "привет", vec![("узел".into(), stroka(&uzel)), ("хэш".into(), stroka(&hesh))]);
            }
            "Прибрать" => {
                let kto = self.kanaly[nomer].kto.clone();
                self.pribrat(nomer);
                self.uzel_sluchilsya(resh::variant_svyaz_poteryana(rt::text(&kto), rt::text("сокет прибран")));
            }
            "Связь заведена" => {
                let kto = self.kanaly[nomer].kto.clone();
                skazat(vec![
                    ("в".into(), stroka("связь")),
                    ("узел".into(), stroka(&self.imya)),
                    ("цель".into(), stroka(CEL)),
                    ("сосед".into(), stroka(&kto)),
                    ("что".into(), stroka("заведена")),
                ]);
                self.uzel_sluchilsya(resh::variant_svyaz_gotova(rt::text(&kto)));
            }
            "Связь отвергнута" => skazat(vec![
                ("в".into(), stroka("связь")),
                ("узел".into(), stroka(&self.imya)),
                ("цель".into(), stroka(CEL)),
                ("сосед".into(), stroka(&vzyat("сосед"))),
                ("что".into(), stroka("отвергнута")),
                ("почему".into(), stroka(&vzyat("почему"))),
            ]),
            "Доложить о потере" => self.doklad_o_svyazi(nomer, "потеряна", &vzyat("почему")),
            "Доложить о несостоявшемся знакомстве" => self.doklad_o_svyazi(nomer, "не состоялась", &vzyat("почему")),
            "Позвонить снова" => {
                let pauza = polya
                    .fields
                    .iter()
                    .find(|p| p.name.as_ref() == "пауза")
                    .map(|p| vn_chislo(&p.value))
                    .unwrap_or(0.0);
                self.kanaly[nomer].kogda_zvonit = chasy() + pauza;
            }
            "Доставить письмо" => {
                /* Эталон связи назвал АДРЕСАТА, груз оставил узлу — вот он. */
                let gruz = match self.posledniy_kadr.as_ref().and_then(|kadr| kadr.pole("что")) {
                    Some(chto) => raskodirovat(chto),
                    None => {
                        eprintln!("кадр письма без груза");
                        std::process::exit(1)
                    }
                };
                let bilet = self.novyy_bilet(gruz);
                self.uzel_sluchilsya(resh::variant_pismo_snaruzhi(rt::text(&vzyat("кому")), rt::number(bilet)));
            }
            inoe => {
                eprintln!("узел не знает веления связи «{inoe}»");
                std::process::exit(1)
            }
        }
    }

    /// Пропажа соседа — на ДОКЛАД, а не на «Прибрать»: сокет прибирают и когда
    /// терять было нечего, и по второму разу на одном разрыве, а доклад слой
    /// связи выдаёт ровно один раз на разрыв — доказано в `link.flang`.
    fn doklad_o_svyazi(&mut self, nomer: usize, chto: &str, pochemu: &str) {
        skazat(vec![
            ("в".into(), stroka("связь")),
            ("узел".into(), stroka(&self.imya)),
            ("цель".into(), stroka(CEL)),
            ("сосед".into(), stroka(&self.kanaly[nomer].kto)),
            ("что".into(), stroka(chto)),
            ("почему".into(), stroka(pochemu)),
        ]);
        let kto = self.kanaly[nomer].kto.clone();
        self.uzel_sluchilsya(resh::variant_uzel_propal(rt::text(&kto), rt::text(pochemu)));
    }

    // ── билеты: груз живёт у хозяина, в таблице едет число ─────────────────
    fn novyy_bilet(&mut self, gruz: rt::Value) -> f64 {
        self.bilet += 1;
        self.gruzy.insert(self.bilet, gruz);
        self.bilet as f64
    }

    // ── единственная дорога от мира к решению о процессах ──────────────────
    fn uzel_sluchilsya(&mut self, sobytie: rt::Value) {
        let hod = dolzhno(resh::funkciya_shag_uzla_celikom(&self.ctx, self.uzel.clone(), sobytie));
        self.uzel = pole(&self.ctx, &hod, "узел");
        for velenie in spisok(&pole(&self.ctx, &hod, "веления")) {
            self.ispolnit_uzel(&velenie);
        }
    }

    fn ispolnit_uzel(&mut self, velenie: &rt::Value) {
        let (imya, polya) = match velenie {
            rt::Value::Variant(vnutri) => (vnutri.name.to_string(), vnutri.clone()),
            _ => return,
        };
        let tekst = |kak: &str| -> String {
            polya.fields.iter().find(|p| p.name.as_ref() == kak).map(|p| vn_tekst(&p.value)).unwrap_or_default()
        };
        let chislo = |kak: &str| -> f64 {
            polya.fields.iter().find(|p| p.name.as_ref() == kak).map(|p| vn_chislo(&p.value)).unwrap_or(0.0)
        };
        match imya.as_str() {
            "Позвать обработчик" => self.pozvat(&tekst("кто"), chislo("билет") as i64),
            "Послать по проводу" => {
                let kto = tekst("узел");
                let gruz = self.gruzy.get(&(chislo("билет") as i64)).cloned();
                let nomer = self.kanaly.iter().position(|k| k.kto == kto);
                if let (Some(nomer), Some(gruz)) = (nomer, gruz) {
                    self.poslat(
                        nomer,
                        "письмо",
                        vec![("кому".into(), stroka(&tekst("кому"))), ("что".into(), zakodirovat(&gruz))],
                    );
                }
            }
            "Поставить таймер" => {
                let kogda = chasy() + chislo("задержка");
                self.taymery.push((kogda, tekst("кому"), chislo("билет")));
            }
            "Записать в журнал" => skazat(vec![
                ("в".into(), stroka(&tekst("вид"))),
                ("узел".into(), stroka(&self.imya)),
                ("цель".into(), stroka(CEL)),
                ("кто".into(), stroka(&tekst("кто"))),
                ("почему".into(), stroka(&tekst("почему"))),
            ]),
            "Уронить процесс" => {
                skazat(vec![
                    ("в".into(), stroka("отказ")),
                    ("узел".into(), stroka(&self.imya)),
                    ("цель".into(), stroka(CEL)),
                    ("процесс".into(), stroka(&tekst("кто"))),
                    ("код".into(), stroka(&tekst("код"))),
                    ("текст".into(), stroka(&tekst("текст"))),
                ]);
                // Отказ уходит НАДЗОРУ, а не в журнал: решает напечатанный
                // `supervisor.flang`, здесь только дорога к нему.
                self.nadzor_sluchilsya(&tekst("кто"), &tekst("код"));
            }
            "Письмо пропало" => skazat(vec![
                ("в".into(), stroka("потеря")),
                ("узел".into(), stroka(&self.imya)),
                ("цель".into(), stroka(CEL)),
                ("кому".into(), stroka(&tekst("кому"))),
                ("почему".into(), stroka(&tekst("почему"))),
            ]),
            inoe => {
                eprintln!("узел не знает веления планировщика «{inoe}»");
                std::process::exit(1)
            }
        }
    }

    // ── вызов обработчика по имени: та самая граница языка ─────────────────
    fn pozvat(&mut self, kto: &str, bilet: i64) {
        let obrabotchik = self.plan.iter().find(|p| p.imya == kto).map(|p| p.obrabotchik.clone());
        let gruz = self.gruzy.get(&bilet).cloned();
        let sostoyanie = self.sostoyaniya.iter().find(|(imya, _)| imya == kto).map(|(_, zn)| zn.clone());
        let (obrabotchik, gruz, sostoyanie) = match (obrabotchik, gruz, sostoyanie) {
            (Some(o), Some(g), Some(s)) => (o, g, s),
            _ => {
                self.uzel_sluchilsya(resh::variant_obrabotchik_otkazal(
                    rt::text("FLANG_PROCESS"),
                    rt::text("обработчика или груза нет"),
                ));
                return;
            }
        };
        let itog = match resh::call(&self.ctx, &obrabotchik, vec![sostoyanie, gruz]) {
            Ok(itog) => itog,
            Err(beda) => {
                self.uzel_sluchilsya(resh::variant_obrabotchik_otkazal(
                    rt::text(&beda.code),
                    rt::text(&beda.message),
                ));
                return;
            }
        };
        let novoe = pole(&self.ctx, &itog, "состояние");
        for para in self.sostoyaniya.iter_mut() {
            if para.0 == kto {
                para.1 = novoe.clone();
            }
        }
        let mut deystviya = Vec::new();
        for d in spisok(&pole(&self.ctx, &itog, "действия")) {
            deystviya.push(self.v_deystvie(&d));
        }
        self.uzel_sluchilsya(resh::variant_obrabotchik_vernul(rt::list(deystviya)));
    }

    /// Действие языка → действие планировщика. Перевод, а не решение: имена
    /// разные нарочно, иначе словарь действий языка и тип планировщика не
    /// собрались бы в один модуль.
    fn v_deystvie(&mut self, d: &rt::Value) -> rt::Value {
        let vnutri = match d {
            rt::Value::Variant(vnutri) => vnutri.clone(),
            _ => {
                eprintln!("действие не вариант");
                std::process::exit(1)
            }
        };
        let vzyat = |kak: &str| -> Option<rt::Value> {
            vnutri.fields.iter().find(|p| p.name.as_ref() == kak).map(|p| p.value.clone())
        };
        let komu = vzyat("кому").unwrap_or_else(|| rt::text(""));
        match vnutri.name.as_ref() {
            "отправить" => {
                let bilet = self.novyy_bilet(vzyat("что").unwrap_or_else(rt::nothing));
                resh::variant_veleno_slat(komu, rt::number(bilet))
            }
            "через" => {
                let bilet = self.novyy_bilet(vzyat("что").unwrap_or_else(rt::nothing));
                resh::variant_veleno_slat_pozzhe(
                    komu,
                    rt::number(bilet),
                    vzyat("задержка").unwrap_or_else(|| rt::number(0.0)),
                )
            }
            "отложить" => resh::variant_veleno_otlozhit(),
            "продолжить" => resh::variant_veleno_prodolzhit(),
            "остановить" => resh::variant_veleno_ostanovit(vzyat("почему").unwrap_or_else(|| rt::text(""))),
            inoe => {
                eprintln!("узел не знает действия «{inoe}»");
                std::process::exit(1)
            }
        }
    }

    // ── круг: сокеты, часы, таймеры и очередь готовых ──────────────────────
    fn period(&self) -> f64 {
        f64::max(20.0, self.srok / 5.0)
    }

    fn zhrebiy(&mut self) -> f64 {
        self.semya = self.semya.wrapping_add(0x6D2B79F5);
        let mut t = (self.semya ^ (self.semya >> 15)).wrapping_mul(self.semya | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }

    /// Ждать мира. `select` в стандартной библиотеке Rust нет, поэтому это
    /// опрос: сокеты неблокирующие, шаг 5 мс, выход по первым же байтам или по
    /// сроку. Место в витке — то же, что у `select` у остальных хозяев: между
    /// набором и пробегами, иначе первое письмо чужому ушло бы до знакомства.
    fn zhdat_mira(&mut self) {
        let kray = chasy() + f64::min(self.period(), self.puls);
        loop {
            self.prinyat();
            let mut bylo = false;
            for nomer in 0..self.kanaly.len() {
                if self.kanaly[nomer].soket.is_some() && self.prochest(nomer) {
                    bylo = true;
                }
            }
            if bylo || chasy() >= kray {
                return;
            }
            std::thread::sleep(Duration::from_millis(5)); // МИР
        }
    }

    fn krug(&mut self, dokole: f64) {
        while chasy() < dokole && self.rabotaet {
            let seychas = chasy();
            for nomer in 0..self.kanaly.len() {
                let zvonit = self.kanaly[nomer].soket.is_none()
                    && seychas >= self.kanaly[nomer].kogda_zvonit
                    && !self.kanaly[nomer].adres.is_empty();
                if zvonit {
                    self.pozvonit(nomer);
                }
            }
            self.zhdat_mira();

            let seychas = chasy();
            let sozrevshie: Vec<(f64, String, f64)> =
                self.taymery.iter().filter(|t| t.0 <= seychas).cloned().collect();
            self.taymery.retain(|t| t.0 > seychas);
            for (_, komu, bilet) in sozrevshie {
                self.uzel_sluchilsya(resh::variant_taymer_srabotal(rt::text(&komu), rt::number(bilet)));
            }

            for nomer in 0..self.kanaly.len() {
                let pora = self.kanaly[nomer].soket.is_some()
                    && vn_priznak(&pole(&self.ctx, &self.kanaly[nomer].sostoyanie, "готова"))
                    && seychas - self.kanaly[nomer].posledniy_puls >= self.puls;
                if pora {
                    self.kanaly[nomer].posledniy_puls = seychas;
                    self.poslat(nomer, "пульс", vec![]);
                }
            }

            if seychas >= self.sleduyuschiy_storozh {
                self.sleduyuschiy_storozh = seychas + self.period();
                for nomer in 0..self.kanaly.len() {
                    if self.kanaly[nomer].soket.is_some() {
                        self.svyaz_sluchilas(nomer, resh::variant_storozh_prosnulsya(rt::number(seychas)));
                    }
                }
            }

            // Пробеги — до покоя, но с уступкой миру после каждого витка.
            for _ in 0..64 {
                let bylo = self.uzel.clone();
                let vypal = self.zhrebiy();
                self.uzel_sluchilsya(resh::variant_pora_bezhat(rt::number(vypal)));
                if rt::equal(&self.uzel, &bylo) {
                    break;
                }
            }
        }
    }

    fn sostoyaniya_naruzhu(&self) -> Vec<(String, Json)> {
        self.sostoyaniya.iter().map(|(imya, zn)| (imya.clone(), zakodirovat(zn))).collect()
    }
}

/* ── доводы, план, размещение ───────────────────────────────────────────── */

fn dovody(argv: &[String]) -> HashMap<String, String> {
    let mut sobrannye = HashMap::new();
    let mut imya: Option<String> = None;
    for dovod in argv {
        if let Some(klyuch) = dovod.strip_prefix("--") {
            sobrannye.insert(klyuch.to_string(), String::new());
            imya = Some(klyuch.to_string());
        } else if let Some(klyuch) = imya.take() {
            sobrannye.insert(klyuch, dovod.clone());
        }
    }
    sobrannye
}

fn nuzhen<'a>(klyuchi: &'a HashMap<String, String>, imya: &str) -> &'a str {
    match klyuchi.get(imya) {
        Some(chto) => chto,
        None => {
            eprintln!("нужен довод --{imya}");
            std::process::exit(1)
        }
    }
}

fn chislo_klyucha(klyuchi: &HashMap<String, String>, imya: &str, po_umolchaniyu: f64) -> f64 {
    match klyuchi.get(imya) {
        Some(tekst) if !tekst.is_empty() => tekst.parse::<f64>().unwrap_or(po_umolchaniyu),
        _ => po_umolchaniyu,
    }
}

fn json_iz_teksta(tekst: &str) -> Json {
    match razobrat_json(tekst) {
        Some(chto) => chto,
        None => {
            eprintln!("не разобран JSON: {tekst}");
            std::process::exit(1)
        }
    }
}

fn chislo_polya(gde: &Json, imya: &str) -> f64 {
    match gde.pole(imya) {
        Some(Json::Chislo(tekst)) => chislo_vnutr(tekst),
        _ => 0.0,
    }
}

/// Надзоры плана — данные для дерева надзора.
fn nadzory_iz(plan: &Json) -> Vec<Json> {
    match plan.pole("надзоры") {
        Some(Json::Spisok(nadzory)) => nadzory.clone(),
        _ => Vec::new(),
    }
}

fn plan_iz_teksta(klyuchi: &HashMap<String, String>) -> Json {
    let tekst = match klyuchi.get("план") {
        Some(gotovyy) if !gotovyy.is_empty() => gotovyy.clone(),
        _ => std::fs::read_to_string(nuzhen(klyuchi, "план-файл")).unwrap_or_else(|beda| { // МИР
            eprintln!("план не прочитан: {beda}");
            std::process::exit(1)
        }),
    };
    json_iz_teksta(&tekst)
}

fn plan_iz(plan: &Json) -> Vec<Process> {
    let processy = match plan.pole("процессы") {
        Some(Json::Spisok(processy)) => processy.clone(),
        _ => Vec::new(),
    };
    processy
        .iter()
        .map(|p| Process {
            imya: p.tekst_polya("имя", ""),
            nachalnoe: p.tekst_polya("начальное", ""),
            obrabotchik: p.tekst_polya("обработчик", ""),
            yaschik: match p.pole("ящик") {
                Some(Json::Chislo(dlina)) => chislo_vnutr(dlina),
                _ => 0.0,
            },
        })
        .collect()
}

fn main() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let klyuchi = dovody(&argv);
    let sroki = (
        chislo_klyucha(&klyuchi, "срок", 1000.0),
        chislo_klyucha(&klyuchi, "пульс", 200.0),
        chislo_klyucha(&klyuchi, "пауза", 250.0),
    );
    let razmeschenie = json_iz_teksta(nuzhen(&klyuchi, "размещение"));
    let plan = plan_iz_teksta(&klyuchi);
    let mut uzel = Uzel::novyy(
        nuzhen(&klyuchi, "я"),
        plan_iz(&plan),
        &razmeschenie,
        nuzhen(&klyuchi, "хэш"),
        sroki,
        chislo_klyucha(&klyuchi, "семя", 7.0) as u32,
        &nadzory_iz(&plan),
    );

    let port = match klyuchi.get("слушать") {
        Some(adres) if !adres.is_empty() => uzel.slushat(adres),
        _ => 0,
    };
    skazat(vec![
        ("в".into(), stroka("поднят")),
        ("узел".into(), stroka(&uzel.imya)),
        ("цель".into(), stroka(CEL)),
        ("порт".into(), Json::Chislo(port.to_string())),
        ("хэш".into(), stroka(&uzel.hesh.chars().take(12).collect::<String>())),
        (
            "сроки".into(),
            Json::Zapis(vec![
                ("срок".into(), Json::Chislo(rt::number_text(uzel.srok))),
                ("пульс".into(), Json::Chislo(rt::number_text(uzel.puls))),
                ("пауза".into(), Json::Chislo(rt::number_text(uzel.pauza))),
            ]),
        ),
    ]);

    // Начальные письма — тем же путём, каким приходят письма с провода.
    let vbrosy = match razobrat_json(klyuchi.get("вбросить").map(|s| s.as_str()).unwrap_or("[]")) {
        Some(Json::Spisok(vbrosy)) => vbrosy,
        _ => Vec::new(),
    };
    for vbros in &vbrosy {
        let gruz = match vbros.pole("что") {
            Some(chto) => raskodirovat(chto),
            None => continue,
        };
        let bilet = uzel.novyy_bilet(gruz);
        uzel.uzel_sluchilsya(resh::variant_pismo_snaruzhi(
            rt::text(&vbros.tekst_polya("кому", "")),
            rt::number(bilet),
        ));
    }

    let dokole = chasy() + chislo_klyucha(&klyuchi, "жить", 5.0) * 1000.0;
    uzel.krug(dokole);

    skazat(vec![
        ("в".into(), stroka("конец")),
        ("узел".into(), stroka(&uzel.imya)),
        ("цель".into(), stroka(CEL)),
        ("состояния".into(), Json::Zapis(uzel.sostoyaniya_naruzhu())),
    ]);
}
