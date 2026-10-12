// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Прогонщик программы flang: JSON на входе, JSON на выходе.
//
// Зачем он есть. Напечатанный модуль на Go — это библиотека, и вызвать её можно
// только из Go. Но проверить кодогенератор нужно ровно одним способом — сверкой
// с интерпретатором на сетке из тысяч входов, а пересобирать программу ради
// каждой точки сетки невозможно. Поэтому бэкенд печатает ещё и прогонщик: одна
// сборка, дальше поток запросов через трубу.
//
// Побочная польза больше основной: точно так же программу на flang вызывает
// любой язык, у которого есть трубы, — Python, Node, shell. Ни FFI, ни cgo.
//
// ── Протокол (тот же, что у бэкенда C) ──────────────────────────────────────
// Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
// Ответ  — одна строка:  {"ok":true,"value":…}
//
//	или {"ok":false,"code":"FLANG_TYPE","message":"…"}
//
// Значения размечены тегами, потому что JSON беднее flang:
//
//	null            «ничто»
//	true / false    признак
//	{"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
//	                (по той же причине строкой едут «depth» и «steps»)
//	{"s":"текст"}   строка
//	{"l":[…]}       список
//	{"r":[["поле",…]]}                 запись (порядок полей сохраняется)
//	{"v":"Имя","f":[["поле",…]]}       вариант
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"flangprogram/flang"
	rt "flangprogram/flangrt"
)

// ───────────────────────────── чтение значений ─────────────────────────────

func decodeValue(raw json.RawMessage) (rt.Value, error) {
	text := strings.TrimSpace(string(raw))
	switch text {
	case "null":
		return rt.Nothing(), nil
	case "true":
		return rt.Flag(true), nil
	case "false":
		return rt.Flag(false), nil
	}

	var node map[string]json.RawMessage
	if err := json.Unmarshal(raw, &node); err != nil {
		return rt.Nothing(), fmt.Errorf("нечего декодировать: %s", text)
	}

	if item, found := node["n"]; found {
		var number string
		if err := json.Unmarshal(item, &number); err != nil {
			return rt.Nothing(), err
		}
		return rt.Number(parseNumber(number)), nil
	}
	if item, found := node["s"]; found {
		var value string
		if err := json.Unmarshal(item, &value); err != nil {
			return rt.Nothing(), err
		}
		return rt.Text(value), nil
	}
	if item, found := node["l"]; found {
		var items []json.RawMessage
		if err := json.Unmarshal(item, &items); err != nil {
			return rt.Nothing(), err
		}
		values := make([]rt.Value, len(items))
		for index, element := range items {
			value, err := decodeValue(element)
			if err != nil {
				return rt.Nothing(), err
			}
			values[index] = value
		}
		return rt.List(values), nil
	}
	if item, found := node["r"]; found {
		fields, err := decodePairs(item)
		if err != nil {
			return rt.Nothing(), err
		}
		return rt.Record(fields), nil
	}
	if item, found := node["v"]; found {
		var name string
		if err := json.Unmarshal(item, &name); err != nil {
			return rt.Nothing(), err
		}
		fields := []rt.Field{}
		if pairs, found := node["f"]; found {
			decoded, err := decodePairs(pairs)
			if err != nil {
				return rt.Nothing(), err
			}
			fields = decoded
		}
		return rt.Variant(name, fields), nil
	}
	return rt.Nothing(), fmt.Errorf("нечего декодировать: %s", text)
}

func decodePairs(raw json.RawMessage) ([]rt.Field, error) {
	var pairs [][]json.RawMessage
	if err := json.Unmarshal(raw, &pairs); err != nil {
		return nil, err
	}
	fields := make([]rt.Field, 0, len(pairs))
	for _, pair := range pairs {
		if len(pair) != 2 {
			return nil, fmt.Errorf("пара «имя, значение» обязана быть из двух элементов")
		}
		var name string
		if err := json.Unmarshal(pair[0], &name); err != nil {
			return nil, err
		}
		value, err := decodeValue(pair[1])
		if err != nil {
			return nil, err
		}
		fields = append(fields, rt.Field{Name: name, Value: value})
	}
	return fields, nil
}

// Число приезжает строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля.
func parseNumber(text string) float64 {
	switch text {
	case "NaN":
		return math.NaN()
	case "Infinity":
		return math.Inf(1)
	case "-Infinity":
		return math.Inf(-1)
	}
	value, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return math.NaN()
	}
	return value
}

// ───────────────────────────── печать значений ─────────────────────────────

func writeValue(out *strings.Builder, value rt.Value) {
	switch value.Tag {
	case rt.TagNothing:
		out.WriteString("null")
	case rt.TagFlag:
		if value.Flag {
			out.WriteString("true")
		} else {
			out.WriteString("false")
		}
	case rt.TagNumber:
		out.WriteString("{\"n\":")
		// −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно.
		if value.Num == 0 && math.Signbit(value.Num) {
			out.WriteString(rt.QuoteJSON("-0"))
		} else {
			out.WriteString(rt.QuoteJSON(rt.NumberText(value.Num)))
		}
		out.WriteString("}")
	case rt.TagString:
		out.WriteString("{\"s\":")
		out.WriteString(rt.QuoteJSON(value.Str))
		out.WriteString("}")
	case rt.TagList:
		out.WriteString("{\"l\":[")
		for index, item := range value.List {
			if index > 0 {
				out.WriteString(",")
			}
			writeValue(out, item)
		}
		out.WriteString("]}")
	case rt.TagRecord:
		out.WriteString("{\"r\":[")
		writeFields(out, value.Fields)
		out.WriteString("]}")
	case rt.TagVariant:
		out.WriteString("{\"v\":")
		out.WriteString(rt.QuoteJSON(value.Str))
		out.WriteString(",\"f\":[")
		writeFields(out, value.Fields)
		out.WriteString("]}")
	default:
		out.WriteString("null")
	}
}

func writeFields(out *strings.Builder, fields []rt.Field) {
	for index, field := range fields {
		if index > 0 {
			out.WriteString(",")
		}
		out.WriteString("[")
		out.WriteString(rt.QuoteJSON(field.Name))
		out.WriteString(",")
		writeValue(out, field.Value)
		out.WriteString("]")
	}
}

// ───────────────────────────── запрос ─────────────────────────────

type request struct {
	Fn    string            `json:"fn"`
	Args  []json.RawMessage `json:"args"`
	Depth string            `json:"depth"`
	Steps string            `json:"steps"`
}

func failure(code, message string) string {
	var out strings.Builder
	out.WriteString("{\"ok\":false,\"code\":")
	out.WriteString(rt.QuoteJSON(code))
	out.WriteString(",\"message\":")
	out.WriteString(rt.QuoteJSON(message))
	out.WriteString("}")
	return out.String()
}

func runRequest(line string) string {
	var query request
	if err := json.Unmarshal([]byte(line), &query); err != nil {
		return failure("CLI", "неразборчивый запрос")
	}
	if query.Fn == "" {
		return failure("CLI", "в запросе нет имени функции")
	}

	ctx := flang.NewContext()
	if query.Depth != "" {
		ctx.MaxDepth = int(parseNumber(query.Depth))
	}
	if query.Steps != "" {
		ctx.MaxSteps = int(parseNumber(query.Steps))
	}

	args := make([]rt.Value, len(query.Args))
	for index, raw := range query.Args {
		value, err := decodeValue(raw)
		if err != nil {
			return failure("CLI", "неразборчивые аргументы")
		}
		args[index] = value
	}

	// Граница входа — ДО вызова: значения приехали снаружи, программой не
	// являются и сверяются с объявленными типами. Значение вне типа выносит
	// вместе с типом и доказательство завершения `тотальной`, а поймать вечную
	// цепочку потом нечем — сторожа в доказанно тотальной функции нет.
	if err := rt.CheckEntry(flang.Entry(), query.Fn, args); err != nil {
		var diagnostic *rt.Error
		if found, ok := err.(*rt.Error); ok {
			diagnostic = found
		} else {
			diagnostic = &rt.Error{Code: "FLANG_UNKNOWN", Message: err.Error()}
		}
		return failure(diagnostic.Code, diagnostic.Message)
	}

	result, err := flang.Call(ctx, query.Fn, args)
	if err != nil {
		var diagnostic *rt.Error
		if found, ok := err.(*rt.Error); ok {
			diagnostic = found
		} else {
			diagnostic = &rt.Error{Code: "FLANG_UNKNOWN", Message: err.Error()}
		}
		return failure(diagnostic.Code, diagnostic.Message)
	}

	var out strings.Builder
	out.WriteString("{\"ok\":true,\"value\":")
	writeValue(&out, result)
	out.WriteString("}")
	return out.String()
}

// ── СТРОКА, КОТОРАЯ НЕ ТЕКСТ ────────────────────────────────────────────────
//
// Запрос протокола — строка, а строка в этом языке UTF-8 (SPEC, раздел 5). До
// 22 августа 2026 негодный октет проходил сквозь восемь прогонщиков ПЯТЬЮ
// разными способами, и отказом не был ни один. Go был среди тех пяти, кто
// МОЛЧА подменял октет знаком замены U+FFFD и отвечал FLANG_UNKNOWN_NAME — то
// есть врал о содержимом запроса. Замер и таблица —
// scripts/bad-octet-guard.sh.
//
// Теперь у семи целей из восьми одно: диагностика FLANG_IO_NOT_TEXT в поток
// ошибок, код возврата 1, разбора нет. Строки ДО негодной уже отвечены и
// остаются отвеченными. Восьмая, js, названа долгом вслух: её прогонщик —
// рукописный JavaScript, править который в этом дереве запрещено.

// Первый октет, не складывающийся в UTF-8, — номером с единицы; 0 значит
// «текст». Свой разбор, а не utf8.Valid: ответ нужен НОМЕРОМ, и правила обязаны
// совпасть с `fl_utf8_not_text_at` рантайма C до пересокращённой записи и
// суррогатов включительно.
func notTextAt(raw []byte) int {
	at := 0
	for at < len(raw) {
		lead := raw[at]
		var point uint32
		var more int
		switch {
		case lead < 0x80:
			at++
			continue
		case lead&0xE0 == 0xC0:
			more, point = 1, uint32(lead&0x1F)
		case lead&0xF0 == 0xE0:
			more, point = 2, uint32(lead&0x0F)
		case lead&0xF8 == 0xF0:
			more, point = 3, uint32(lead&0x07)
		default:
			return at + 1
		}
		if at+more >= len(raw) {
			return at + 1
		}
		for step := 1; step <= more; step++ {
			next := raw[at+step]
			if next&0xC0 != 0x80 {
				return at + 1
			}
			point = point<<6 | uint32(next&0x3F)
		}
		// Пересокращённая запись, суррогат и всё выше U+10FFFF — тоже не текст:
		// иначе у одного знака было бы два написания, и счёт разошёлся бы.
		if (more == 1 && point < 0x80) || (more == 2 && point < 0x800) ||
			(more == 3 && point < 0x10000) || point > 0x10FFFF ||
			(point >= 0xD800 && point <= 0xDFFF) {
			return at + 1
		}
		at += more + 1
	}
	return 0
}

// Отказ «строка не текст»: номер строки, номер октета в ней (с единицы), длина
// строки в октетах и значение негодного октета. Текст один на семь целей —
// сторож сверяет его байт в байт.
func refuseNotText(line int, raw []byte, at int) {
	fmt.Fprintf(os.Stderr,
		"FLANG_IO_NOT_TEXT: строка %d не текст: октет %d из %d (0x%02X) не складывается в UTF-8; запрос обязан ехать в UTF-8\n",
		line, at, len(raw), raw[at-1])
}

func main() {
	// `--plan <имя> [довод…]` — исполнить план программы (ADR-0100).
	if len(os.Args) > 1 && (os.Args[1] == "--plan" || os.Args[1] == "--план") {
		os.Exit(runPlan(os.Args[2:]))
	}
	reader := bufio.NewScanner(os.Stdin)
	// Строка запроса бывает длинной: список из тысяч элементов приезжает одной
	// строкой, а буфер Scanner по умолчанию — 64 КиБ.
	reader.Buffer(make([]byte, 0, 1<<20), 1<<28)
	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()
	number := 0
	for reader.Scan() {
		number++
		// Октеты, а не Text(): Text() уже перевёл бы негодный октет в знак
		// замены, и спрашивать было бы не о чем.
		raw := reader.Bytes()
		if at := notTextAt(raw); at > 0 {
			writer.Flush()
			refuseNotText(number, raw, at)
			os.Exit(1)
		}
		line := strings.TrimSpace(string(raw))
		if line == "" {
			continue
		}
		fmt.Fprintln(writer, runRequest(line))
		writer.Flush()
	}
	// Молчать о неудавшемся чтении нельзя: оборванный вход и кончившийся вход
	// различимы только здесь, и раньше их обоих звали концом работы.
	if err := reader.Err(); err != nil {
		writer.Flush()
		fmt.Fprintf(os.Stderr, "FLANG_IO_READ: вход прогонщика не читается: %v\n", err)
		os.Exit(1)
	}
}

// ───────────────────────────── план ─────────────────────────────
//
// Исполнитель плана — порт `flang/src/emit/js/flang_io.js` на значения
// рантайма Go: тот же цикл «шаг → поручение → отклик», те же исходы и коды
// возврата, что у `flang io`: 0 — конец работы, 1 — «Провал» (план сдался
// сам), 3 — «Не проверено» либо сломанный инструмент. Хозяин ниже исполняет
// девять родов поручений — файлы текстом и октетами, каталоги, среду и доводы; на остальные он
// отвечает отказом с кодом, называющим род. Пути считаются от каталога запуска.

// Сколько поручений исполнитель выдаёт, прежде чем сдаться, — то же число,
// что у свидетеля и у цели JavaScript.
const ioLimit = 10000

// ioOrders — роды поручений словаря языка: поручение не из списка до хозяина
// не доходит.
var ioOrders = map[string]bool{
	"Прочитать файл": true, "Записать файл": true, "Прочитать октеты из файла": true,
	"Записать октеты в файл": true, "Запросить": true, "Текущее время": true,
	"Случайное число": true, "Случайные октеты": true, "Показать": true,
	"Ждать событие": true, "Перечислить каталог": true, "Запустить процесс": true,
	"Запустить процесс с вводом": true, "Запустить процесс с пределом": true,
	"Открыть соединение": true, "Принять соединение": true, "Прочитать из соединения": true,
	"Ответить в соединение": true, "Прочитать октеты из соединения": true,
	"Ответить октетами в соединение": true, "Удалить файл": true,
	"Завести временный каталог": true, "Прочитать переменную среды": true,
	"Прочитать доводы": true, "Размер экрана": true,
}

// planError — беда прогона плана; gaveUp ставится только «Провалу».
type planError struct {
	code    string
	message string
	gaveUp  bool
}

func planFail(code, message string) *planError {
	return &planError{code: code, message: message}
}

func ioField(value rt.Value, name string) rt.Value {
	for _, field := range value.Fields {
		if field.Name == name {
			return field.Value
		}
	}
	return rt.Nothing()
}

func ioSay(value rt.Value, spare string, allowEmpty bool) string {
	if value.Tag == rt.TagString && (allowEmpty || value.Str != "") {
		return value.Str
	}
	return spare
}

func findPlan(name string) (rt.Plan, *planError) {
	if len(rt.Plans) == 0 {
		return rt.Plan{}, planFail("FLANG_UNKNOWN_PLAN", "в программе нет ни одного плана: исполнять нечего")
	}
	if name == "" {
		if len(rt.Plans) == 1 {
			return rt.Plans[0], nil
		}
		names := make([]string, 0, len(rt.Plans))
		for _, plan := range rt.Plans {
			names = append(names, "«"+plan.Name+"»")
		}
		return rt.Plan{}, planFail("FLANG_UNKNOWN_PLAN", "планов несколько ("+strings.Join(names, ", ")+") — назовите нужный")
	}
	for _, plan := range rt.Plans {
		if plan.Name == name {
			return plan, nil
		}
	}
	return rt.Plan{}, planFail("FLANG_UNKNOWN_PLAN", "не найден план «"+name+"»")
}

// planCall зовёт функцию программы в свежем контексте: пределы шагов и глубины
// — на одно обращение плана, как у `flang io`.
func planCall(name string, args []rt.Value) (rt.Value, *planError) {
	value, err := flang.Call(flang.NewContext(), name, args)
	if err != nil {
		if bad, ok := err.(*rt.Error); ok {
			return rt.Value{}, planFail(bad.Code, bad.Message)
		}
		return rt.Value{}, planFail("FLANG_IO", err.Error())
	}
	return value, nil
}

func ioRun(name string, perform func(rt.Value) rt.Value) (rt.Value, int, *planError) {
	plan, bad := findPlan(name)
	if bad != nil {
		return rt.Value{}, 0, bad
	}
	state, bad := planCall(plan.Initial, nil)
	if bad != nil {
		return rt.Value{}, 0, bad
	}
	response := rt.Variant("Пока ничего", nil)
	given := 0
	for {
		step, bad := planCall(plan.Step, []rt.Value{state, response})
		if bad != nil {
			return rt.Value{}, given, bad
		}
		if step.Tag != rt.TagVariant {
			return rt.Value{}, given, planFail("FLANG_IO", "шаг плана «"+plan.Name+"» вернул не «Продолжение»")
		}
		switch step.Str {
		case "Конец работы":
			return ioField(step, "значение"), given, nil
		case "Провал":
			bad := planFail(ioSay(ioField(step, "код"), "FLANG_IO_FAILED", false),
				ioSay(ioField(step, "сообщение"), "план «"+plan.Name+"» отказался продолжать", true))
			bad.gaveUp = true
			return rt.Value{}, given, bad
		case "Не проверено":
			return rt.Value{}, given, planFail(ioSay(ioField(step, "код"), "FLANG_IO_NOT_CHECKED", false),
				ioSay(ioField(step, "сообщение"), "план «"+plan.Name+"» не смог проверить предмет", true))
		case "Сделать":
		default:
			return rt.Value{}, given, planFail("FLANG_IO", "шаг плана «"+plan.Name+"» вернул не «Продолжение»")
		}
		if given >= ioLimit {
			return rt.Value{}, given, planFail("FLANG_IO_LIMIT",
				fmt.Sprintf("план «%s» исчерпал предел поручений (%d)", plan.Name, ioLimit))
		}
		order := ioField(step, "поручение")
		if order.Tag != rt.TagVariant || !ioOrders[order.Str] {
			what := "не вариант суммы"
			if order.Tag == rt.TagVariant {
				what = "вариант «" + order.Str + "»"
			}
			return rt.Value{}, given, planFail("FLANG_IO", "план «"+plan.Name+"» просит выполнить не поручение: "+what)
		}
		state = ioField(step, "потом")
		response = perform(order)
		given++
	}
}

// ioHost — хозяин: функция «поручение → отклик» над каталогом запуска.
func ioHost(args []string) func(rt.Value) rt.Value {
	fault := func(code, message string) rt.Value {
		return rt.Variant("Сбой", []rt.Field{{Name: "код", Value: rt.Text(code)}, {Name: "сообщение", Value: rt.Text(message)}})
	}
	why := func(err error) string {
		var cause error = err
		if bad, ok := err.(*os.PathError); ok {
			cause = bad.Err
		}
		text := cause.Error()
		if text != "" {
			text = strings.ToUpper(text[:1]) + text[1:]
		}
		return text
	}
	text := func(order rt.Value, name string) (string, bool) {
		value := ioField(order, name)
		return value.Str, value.Tag == rt.TagString
	}
	path := func(order rt.Value, name string) (string, *rt.Value) {
		given, ok := text(order, name)
		if !ok || given == "" {
			bad := fault("FLANG_IO_PATH", "поручению нужен непустой путь")
			return "", &bad
		}
		return given, nil
	}
	return func(order rt.Value) rt.Value {
		switch order.Str {
		case "Прочитать файл":
			full, bad := path(order, "путь")
			if bad != nil {
				return *bad
			}
			octets, err := os.ReadFile(full)
			if err != nil {
				return fault("FLANG_IO_READ", "файл не прочитан: "+why(err))
			}
			if notTextAt(octets) > 0 {
				return fault("FLANG_IO_NOT_TEXT", fmt.Sprintf("файл не текст: %d октет(ов) не складываются в UTF-8; октеты возит «Прочитать октеты из файла»", len(octets)))
			}
			return rt.Variant("Прочитано", []rt.Field{{Name: "содержимое", Value: rt.Text(string(octets))}})
		case "Записать файл":
			body, _ := text(order, "содержимое")
			full, bad := path(order, "путь")
			if bad != nil {
				return *bad
			}
			if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
				return fault("FLANG_IO_WRITE", "файл не записан: "+why(err))
			}
			// Кодовые точки, а не октеты: «сколько» обязано совпасть с `длина`.
			return rt.Variant("Записано", []rt.Field{{Name: "сколько", Value: rt.Number(float64(len([]rune(body))))}})
		case "Прочитать октеты из файла":
			full, bad := path(order, "путь")
			if bad != nil {
				return *bad
			}
			octets, err := os.ReadFile(full)
			if err != nil {
				return fault("FLANG_IO_READ", "файл не прочитан: "+why(err))
			}
			items := make([]rt.Value, len(octets))
			for at, octet := range octets {
				items[at] = rt.Number(float64(octet))
			}
			return rt.Variant("Октеты", []rt.Field{{Name: "октеты", Value: rt.List(items)}})
		case "Записать октеты в файл":
			given := ioField(order, "октеты")
			if given.Tag != rt.TagList {
				return fault("FLANG_IO_OCTETS", "поручению нужен список октетов, а дан не список")
			}
			octets := make([]byte, len(given.List))
			for at, item := range given.List {
				if item.Tag != rt.TagNumber || item.Num < 0 || item.Num > 255 || item.Num != float64(int(item.Num)) {
					return fault("FLANG_IO_OCTETS", fmt.Sprintf("октет %d не годится: нужно целое от 0 до 255", at+1))
				}
				octets[at] = byte(item.Num)
			}
			full, bad := path(order, "путь")
			if bad != nil {
				return *bad
			}
			if err := os.WriteFile(full, octets, 0o644); err != nil {
				return fault("FLANG_IO_WRITE", "файл не записан: "+why(err))
			}
			return rt.Variant("Записано", []rt.Field{{Name: "сколько", Value: rt.Number(float64(len(octets)))}})
		case "Перечислить каталог":
			full, bad := path(order, "путь")
			if bad != nil {
				return *bad
			}
			entries, err := os.ReadDir(full)
			if err != nil {
				return fault("FLANG_IO_LIST", "каталог не открыт: "+why(err))
			}
			names := make([]string, 0, len(entries))
			for _, entry := range entries {
				names = append(names, entry.Name())
			}
			// По байтам UTF-8, то есть по кодовым точкам, — как у двоичного хозяина.
			sort.Strings(names)
			items := make([]rt.Value, 0, len(names))
			for _, name := range names {
				items = append(items, rt.Text(name))
			}
			return rt.Variant("Перечислено", []rt.Field{{Name: "имена", Value: rt.List(items)}})
		case "Удалить файл":
			full, bad := path(order, "путь")
			if bad != nil {
				return *bad
			}
			if err := os.Remove(full); err != nil {
				return fault("FLANG_IO_REMOVE", "имя не убрано: "+why(err))
			}
			return rt.Variant("Убрано", nil)
		case "Завести временный каталог":
			given, bad := path(order, "образец")
			if bad != nil {
				return *bad
			}
			made, err := os.MkdirTemp(filepath.Dir(given), filepath.Base(given)+"*")
			if err != nil {
				return fault("FLANG_IO_TEMPDIR", "временный каталог не заведён: "+why(err))
			}
			// Обратно — образец плюс хвост, в координатах плана.
			tail := filepath.Base(made)[len(filepath.Base(given)):]
			return rt.Variant("Заведено", []rt.Field{{Name: "путь", Value: rt.Text(given + tail)}})
		case "Прочитать переменную среды":
			name, ok := text(order, "имя")
			if !ok || name == "" {
				return fault("FLANG_IO_ENV", "поручению нужно непустое имя переменной")
			}
			value, found := os.LookupEnv(name)
			if !found {
				return rt.Variant("Переменной среды нет", nil)
			}
			return rt.Variant("Значение среды", []rt.Field{{Name: "значение", Value: rt.Text(value)}})
		case "Прочитать доводы":
			items := make([]rt.Value, 0, len(args))
			for _, arg := range args {
				items = append(items, rt.Text(arg))
			}
			return rt.Variant("Доводы", []rt.Field{{Name: "доводы", Value: rt.List(items)}})
		case "Показать", "Ждать событие", "Размер экрана":
			return fault("FLANG_IO_NO_SCREEN", "у хозяина Go нет экрана: поручение «"+order.Str+"» исполнить нечем")
		default:
			return fault("FLANG_IO_NOT_WIRED", "поручение «"+order.Str+"» в этом хозяине не заведено; исполните план двоичным: flang io <файл.flang>")
		}
	}
}

// writePlain — значение в JSON того же вида, каким `flang io` печатает итог.
func writePlain(out *strings.Builder, value rt.Value) {
	switch value.Tag {
	case rt.TagFlag:
		if value.Flag {
			out.WriteString("true")
		} else {
			out.WriteString("false")
		}
	case rt.TagNumber:
		out.WriteString(rt.NumberText(value.Num))
	case rt.TagString:
		out.WriteString(rt.QuoteJSON(value.Str))
	case rt.TagList:
		out.WriteString("[")
		for index, item := range value.List {
			if index > 0 {
				out.WriteString(",")
			}
			writePlain(out, item)
		}
		out.WriteString("]")
	case rt.TagRecord:
		writePlainFields(out, value.Fields)
	case rt.TagVariant:
		out.WriteString("{\"variant\":")
		out.WriteString(rt.QuoteJSON(value.Str))
		out.WriteString(",\"fields\":")
		writePlainFields(out, value.Fields)
		out.WriteString("}")
	default:
		out.WriteString("null")
	}
}

func writePlainFields(out *strings.Builder, fields []rt.Field) {
	out.WriteString("{")
	for index, field := range fields {
		if index > 0 {
			out.WriteString(",")
		}
		out.WriteString(rt.QuoteJSON(field.Name))
		out.WriteString(":")
		writePlain(out, field.Value)
	}
	out.WriteString("}")
}

func runPlan(argv []string) int {
	name := ""
	if len(argv) > 0 {
		name = argv[0]
		argv = argv[1:]
	}
	value, given, bad := ioRun(name, ioHost(argv))
	if bad != nil {
		fmt.Fprintf(os.Stderr, "{\"error\":%s,\"code\":%s}\n", rt.QuoteJSON(bad.message), rt.QuoteJSON(bad.code))
		if bad.gaveUp {
			return 1
		}
		return 3
	}
	var out strings.Builder
	out.WriteString("{\"result\":")
	writePlain(&out, value)
	out.WriteString(",\"orders\":")
	out.WriteString(strconv.Itoa(given))
	out.WriteString("}\n")
	fmt.Print(out.String())
	return 0
}
