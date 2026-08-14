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

func main() {
	reader := bufio.NewScanner(os.Stdin)
	// Строка запроса бывает длинной: список из тысяч элементов приезжает одной
	// строкой, а буфер Scanner по умолчанию — 64 КиБ.
	reader.Buffer(make([]byte, 0, 1<<20), 1<<28)
	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()
	for reader.Scan() {
		line := strings.TrimSpace(reader.Text())
		if line == "" {
			continue
		}
		fmt.Fprintln(writer, runRequest(line))
		writer.Flush()
	}
}
