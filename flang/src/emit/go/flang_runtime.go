// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Рантайм flang для бэкенда Go.
//
// Этот файл печатается бэкендом как есть, байт в байт: он лежит рядом
// настоящим .go, а не строкой внутри emit/go.mjs, поэтому его проверяет
// компилятор и gofmt прямо в репозитории, а правка рантайма не превращается в
// правку экранирования внутри шаблона. Единственное, что бэкенд делает с ним, —
// приписывает шапку «сгенерировано, не редактировать» перед объявлением пакета.
//
// ── Почему рантайм вообще нужен ─────────────────────────────────────────────
// В Go нет ни сумм типов, ни значения-объединения, ни семантики чисел
// ECMAScript. Значения flang (SPEC, раздел 2) — скаляр, список, запись,
// вариант — обязаны получить представление, и оно обязано совпадать по
// наблюдаемому поведению с интерпретатором: те же значения, те же коды и те же
// тексты ошибок.
//
// ── Представление значения: структура с тегом ───────────────────────────────
// `Value` — тег плюс поля под каждое представление. В Go нет объединений, и
// выбор был между этим и интерфейсом с методом-маркером (по одному типу на
// вариант суммы). Интерфейс читался бы приятнее ровно до первого требования
// SPEC: структурное равенство любых двух значений, сообщение «разбор не
// покрывает значение Лист(значение)», доступ к полю по имени, приём значения
// снаружи (прогонщик, FFI, тест). Всё это — рефлексия, то есть второе, теневое
// представление рядом с первым; два представления одного значения дают два
// набора расхождений с интерпретатором. Поэтому представление одно, а
// типизированный слой поверх него бэкенд печатает функциями-конструкторами:
// на каждый вариант суммы — своя функция с именованными параметрами.
//
// Числа — только float64. В flang нет целых: «1» и «1.0» это одно и то же
// значение IEEE-754, и печать числа обязана давать «1», а не «1.0» (см.
// NumberText — правила ECMAScript Number::toString дословно).
//
// Строки — UTF-8, как в самом Go, но меряются кодовыми точками: «длина» от
// «мир 🌍» это 5, а не 8 байт и не 6 единиц UTF-16. Поэтому индексация идёт
// через []rune, а не через байтовые срезы.
//
// ── Память ──────────────────────────────────────────────────────────────────
// В отличие от бэкенда C арены здесь нет и быть не может: у Go сборщик мусора,
// и значение, возвращённое функцией, живёт столько, сколько на него ссылаются.
// Единственное, за чем приходится следить, — совместное владение срезом:
// «хвост» отдаёт срез без копирования (значения неизменяемы), поэтому всякое
// построение нового списка обязано выделять свой массив, а не дописывать в
// чужой через append.
//
// ── Ошибки ──────────────────────────────────────────────────────────────────
// Идиоматичный Go возвращает ошибку значением, а не паникует, и здесь это
// совпало с требованием: у ошибки flang есть код («FLANG_TYPE») и текст,
// дословно совпадающий с интерпретатором. Код — строка, а не константа
// перечисления: коды flang перечислимы, но код нарушенного постусловия
// приезжает данными из AST («FTS_UTILITY_PROPERTY» у моделей FTS), и
// перечисление перестало бы быть источником истины ровно там, где важнее всего
// совпасть с ядром.
package flangrt

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"
)

// ───────────────────────────── коды диагностик ─────────────────────────────

// Коды диагностик (SPEC, раздел 7) — константами, чтобы не разъехались опечатки.
const (
	CodeType           = "FLANG_TYPE"
	CodeUnknownName    = "FLANG_UNKNOWN_NAME"
	CodeMatch          = "FLANG_MATCH_NOT_EXHAUSTIVE"
	CodeBuiltinArgs    = "FLANG_BUILTIN_ARGS"
	CodeRecursionLimit = "FLANG_RECURSION_LIMIT"
	CodeProperty       = "FLANG_PROPERTY"
	CodeParse          = "FLANG_PARSE"
)

// Error — диагностика flang: код и текст, дословно совпадающие с интерпретатором.
type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Message }

// Fail собирает диагностику. Возвращает error, а не паникует: вызывающий обязан
// уметь отличить нарушение свойства модели от поломки движка, а не ловить панику.
func Fail(code, format string, args ...interface{}) error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}

// ───────────────────────────── значения ─────────────────────────────

// Tag — вид значения flang (SPEC, раздел 2).
type Tag uint8

// Виды значений. Порядок значения не имеет: тег сравнивается только на равенство.
const (
	TagNothing Tag = iota // «ничто»
	TagNumber             // число — IEEE-754 double
	TagFlag               // признак
	TagString             // строка — UTF-8, меряется кодовыми точками
	TagList               // список
	TagRecord             // запись — объект FTS
	TagVariant            // вариант — конструктор суммы типов
)

// Field — поле записи или варианта. Порядок полей сохраняется: он наблюдаем
// при печати значения наружу, хотя на равенство и не влияет.
type Field struct {
	Name  string
	Value Value
}

// Grow — общая на все копии массива отметка «сколько ячеек уже занято».
//
// Нужна ровно одному месту — «добавить» (см. BAppend): без неё накопление
// списка n вызовами стоит O(n²), потому что каждый вызов копирует весь список.
// Это не теория: точка сетки «Строить скобки» от 42 и 0 и 0 и "" и [] при
// объявленном пределе 5 000 000 шагов не отвечала и за 60 с — то есть предел
// шагов переставал быть сроком. Тот же приём и по той же причине стоит в
// бэкендах C (fl_b_dobavit) и Rust (Items::grown).
//
// Инвариант, он же доказательство неизменяемости: Filled только растёт, и
// занять ячейку Filled вправе единственный список — тот, чей конец совпал с
// Filled. Значит ячейки внутри списка не пишет никто, а ячейка за концом
// занимается не более одного раза за жизнь массива: второе «добавить» к тому же
// значению видит Filled больше своего конца и уходит на копию.
type Grow struct {
	// Total — ёмкость исходного выделения: по ней и по cap среза считается,
	// на каком месте массива этот срез начинается.
	Total int
	// Filled — сколько ячеек массива уже занято.
	Filled int
}

// Value — значение flang. Ровно одно представление на все виды: см. шапку файла.
type Value struct {
	Tag    Tag
	Num    float64
	Flag   bool
	Str    string // строка либо имя варианта
	List   []Value
	Fields []Field
	// Grow — отметка занятого у общего массива; nil, если запаса нет. Живёт
	// только у списков, которые выдало «добавить»: срез чужого массива
	// («хвост», литерал, отобразить) её не наследует, и продлить его на месте
	// нельзя — только копией.
	Grow *Grow
}

// Nothing возвращает «ничто».
func Nothing() Value { return Value{Tag: TagNothing} }

// Number возвращает число.
func Number(value float64) Value { return Value{Tag: TagNumber, Num: value} }

// Flag возвращает признак.
func Flag(value bool) Value { return Value{Tag: TagFlag, Flag: value} }

// Text возвращает строку.
func Text(value string) Value { return Value{Tag: TagString, Str: value} }

// List возвращает список из готового среза. Срез переходит во владение
// значению: менять его после вызова нельзя, значения flang неизменяемы.
func List(items []Value) Value { return Value{Tag: TagList, List: items} }

// Record возвращает запись из готового среза полей.
func Record(fields []Field) Value { return Value{Tag: TagRecord, Fields: fields} }

// Variant возвращает вариант суммы типов.
func Variant(name string, fields []Field) Value {
	return Value{Tag: TagVariant, Str: name, Fields: fields}
}

// IsScalar — скаляр ли значение (SPEC, раздел 2: строка, число, признак, ничто).
func IsScalar(value Value) bool {
	switch value.Tag {
	case TagNothing, TagNumber, TagFlag, TagString:
		return true
	}
	return false
}

// IsList — список ли значение.
func IsList(value Value) bool { return value.Tag == TagList }

// IsRecord — запись ли значение.
func IsRecord(value Value) bool { return value.Tag == TagRecord }

// Цепочка — список ЛИБО строка: образцы «пусто» и «голова и хвост» разбирают
// обе. У строки ровно два случая, пустая и «первый символ и остаток», третьего
// нет. Голова строки — одна КОДОВАЯ ТОЧКА, а не байт: строка Go хранится в
// UTF-8, и байтовая нарезка разваливала бы эмодзи пополам, расходясь с «длина»
// и «символы».

// ChainEmpty — пустая ли цепочка: пустой список или пустая строка.
func ChainEmpty(value Value) bool {
	if value.Tag == TagString {
		return len(value.Str) == 0
	}
	return value.Tag == TagList && len(value.List) == 0
}

// ChainCons — непустая ли цепочка.
func ChainCons(value Value) bool {
	if value.Tag == TagString {
		return len(value.Str) > 0
	}
	return value.Tag == TagList && len(value.List) > 0
}

// ChainHead — голова цепочки: первый элемент списка или первый символ строки.
func ChainHead(value Value) Value {
	if value.Tag == TagString {
		return Text(string([]rune(value.Str)[:1]))
	}
	return value.List[0]
}

// ChainTail — хвост цепочки: остаток списка или остаток строки.
func ChainTail(value Value) Value {
	if value.Tag == TagString {
		return Text(string([]rune(value.Str)[1:]))
	}
	return List(value.List[1:])
}

// IsVariant — вариант ли значение.
func IsVariant(value Value) bool { return value.Tag == TagVariant }

// VariantIs — вариант ли значение с именно этим именем (проверка дискриминанта).
func VariantIs(value Value, name string) bool {
	return value.Tag == TagVariant && value.Str == name
}

// TypeName — имя типа значения для диагностик (typeName интерпретатора).
func TypeName(value Value) string {
	switch value.Tag {
	case TagNothing:
		return "ничто"
	case TagString:
		return "строка"
	case TagNumber:
		return "число"
	case TagFlag:
		return "признак"
	case TagList:
		return "список"
	case TagVariant:
		return "вариант «" + value.Str + "»"
	case TagRecord:
		return "запись"
	}
	return "неизвестное значение"
}

// Describe — короткое описание значения для диагностик (describeValue
// интерпретатора). Порядок проверок повторяет оригинал: строка, вариант,
// список, запись, «ничто», признак, число.
func Describe(value Value) string {
	switch value.Tag {
	case TagString:
		return QuoteJSON(value.Str)
	case TagVariant:
		if len(value.Fields) == 0 {
			return value.Str
		}
		names := make([]string, len(value.Fields))
		for index, field := range value.Fields {
			names[index] = field.Name
		}
		return value.Str + "(" + strings.Join(names, ", ") + ")"
	case TagList:
		return "список из " + strconv.Itoa(len(value.List))
	case TagRecord:
		names := make([]string, len(value.Fields))
		for index, field := range value.Fields {
			names[index] = field.Name
		}
		return "запись {" + strings.Join(names, ", ") + "}"
	case TagNothing:
		return "ничто"
	case TagFlag:
		if value.Flag {
			return "да"
		}
		return "нет"
	}
	return NumberText(value.Num)
}

// ───────────────────────────── равенство ─────────────────────────────

// sameNumber — Object.is для чисел: NaN равен NaN, 0 не равен −0 (SPEC, раздел 5).
// Это не придирка: ядро FTS сравнивает значения именно так, и «0.1 плюс 0.2
// равно 0.3» обязано быть ложью в обоих движках — сравнение с допуском сделало
// бы его истиной, то есть расхождением с интерпретатором.
func sameNumber(left, right float64) bool {
	if math.IsNaN(left) && math.IsNaN(right) {
		return true
	}
	if left == 0 && right == 0 {
		return math.Signbit(left) == math.Signbit(right)
	}
	return left == right
}

// Equal — равенство значений: скаляры как Object.is, составные структурно.
// Рекурсия здесь по данным, а не по программе: её глубина ограничена
// вложенностью значения, а не длиной вычисления.
func Equal(left, right Value) bool {
	if IsScalar(left) || IsScalar(right) {
		if !IsScalar(left) || !IsScalar(right) || left.Tag != right.Tag {
			return false
		}
		switch left.Tag {
		case TagNumber:
			return sameNumber(left.Num, right.Num)
		case TagFlag:
			return left.Flag == right.Flag
		case TagString:
			return left.Str == right.Str
		}
		return true // оба «ничто»
	}
	if left.Tag == TagList && right.Tag == TagList {
		if len(left.List) != len(right.List) {
			return false
		}
		for index := range left.List {
			if !Equal(left.List[index], right.List[index]) {
				return false
			}
		}
		return true
	}
	if left.Tag == TagVariant && right.Tag == TagVariant {
		return left.Str == right.Str && fieldsEqual(left.Fields, right.Fields)
	}
	if left.Tag == TagRecord && right.Tag == TagRecord {
		return fieldsEqual(left.Fields, right.Fields)
	}
	return false
}

// fieldsEqual — равенство записей: по именам полей, а не по их порядку.
func fieldsEqual(left, right []Field) bool {
	if len(left) != len(right) {
		return false
	}
	for _, field := range left {
		other, found := lookup(right, field.Name)
		if !found || !Equal(field.Value, other) {
			return false
		}
	}
	return true
}

func lookup(fields []Field, name string) (Value, bool) {
	for _, field := range fields {
		if field.Name == name {
			return field.Value, true
		}
	}
	return Nothing(), false
}

// ───────────────────────────── число в текст ─────────────────────────────

// NumberText печатает число ровно по правилам ECMAScript Number::toString.
//
// Это не украшение: «к строке» от числа и тексты диагностик содержат числа, и
// расхождение хотя бы в одном знаке — это расхождение наблюдаемого поведения с
// интерпретатором. strconv.FormatFloat(value, 'g', -1, 64) не годится: он
// переходит к экспоненциальной записи по своим порогам, а ECMAScript — по
// своим (n > 21 и n ≤ −6).
func NumberText(value float64) string {
	if math.IsNaN(value) {
		return "NaN"
	}
	if value == 0 {
		// String(-0) === "0": знак нуля не печатается, хотя Object.is его различает.
		return "0"
	}
	sign := ""
	if value < 0 {
		sign = "-"
		value = -value
	}
	if math.IsInf(value, 1) {
		return sign + "Infinity"
	}

	// Кратчайшая запись, читающаяся обратно тем же double: ровно то «s», о
	// котором говорит спецификация («k как можно меньше»).
	shortest := strconv.FormatFloat(value, 'e', -1, 64)
	mantissa, exponentText, _ := strings.Cut(shortest, "e")
	digits := strings.Replace(mantissa, ".", "", 1)
	exponent, err := strconv.Atoi(exponentText)
	if err != nil {
		return sign + shortest
	}

	k := len(digits)
	n := exponent + 1

	switch {
	case k <= n && n <= 21:
		return sign + digits + strings.Repeat("0", n-k)
	case 0 < n && n <= 21:
		return sign + digits[:n] + "." + digits[n:]
	case -6 < n && n <= 0:
		return sign + "0." + strings.Repeat("0", -n) + digits
	}

	power := n - 1
	mark := "+"
	if power < 0 {
		mark = "-"
		power = -power
	}
	tail := "e" + mark + strconv.Itoa(power)
	if k == 1 {
		return sign + digits + tail
	}
	return sign + digits[:1] + "." + digits[1:] + tail
}

// QuoteJSON — строка в кавычках по правилам JSON.stringify: им пользуется
// describeValue интерпретатора, и тексты диагностик обязаны совпасть.
func QuoteJSON(value string) string {
	var out strings.Builder
	out.WriteByte('"')
	for _, symbol := range value {
		switch symbol {
		case '"':
			out.WriteString("\\\"")
		case '\\':
			out.WriteString("\\\\")
		case '\n':
			out.WriteString("\\n")
		case '\r':
			out.WriteString("\\r")
		case '\t':
			out.WriteString("\\t")
		case '\b':
			out.WriteString("\\b")
		case '\f':
			out.WriteString("\\f")
		default:
			if symbol < 0x20 {
				out.WriteString(fmt.Sprintf("\\u%04x", symbol))
			} else {
				out.WriteRune(symbol)
			}
		}
	}
	out.WriteByte('"')
	return out.String()
}

// ───────────────────────────── контекст вызова ─────────────────────────────

// Значения по умолчанию — те же, что у интерпретатора (interpret.mjs).
const (
	DefaultMaxDepth = 10000
	DefaultMaxSteps = 1000000
	DefaultBase     = 1
)

// Ctx — счётчики пределов и настройка индексации строк.
//
// Пределы — не украшение. Обычная (не тотальная) функция flang может не
// завершаться, и интерпретатор ловит это лимитом шагов и глубины. Без
// счётчиков напечатанная программа в том же месте либо крутилась бы вечно,
// либо падала бы по стеку — то есть давала бы не FLANG_RECURSION_LIMIT, а
// зависание или panic.
//
// Оговорка о шаге. Шаг интерпретатора — итерация его машины, а не вызов
// функции: одно применение функции стоит там многих шагов. Здесь шагом считается
// вход в функцию, виток цикла хвостового самовызова и отскок батута. Значит
// счётчик здесь всегда МЕНЬШЕ счётчика интерпретатора при том же вычислении, и
// при одинаковом пределе интерпретатор упирается в лимит первым. Расхождение,
// таким образом, одностороннее и безопасное: напечатанный код не объявит
// исчерпанным то, что интерпретатор досчитал.
type Ctx struct {
	Depth     int
	MaxDepth  int
	Steps     int
	MaxSteps  int
	IndexBase int
}

// NewCtx — контекст с пределами интерпретатора и индексацией строк с 1.
func NewCtx() *Ctx {
	return &Ctx{MaxDepth: DefaultMaxDepth, MaxSteps: DefaultMaxSteps, IndexBase: DefaultBase}
}

// Enter — вход в функцию, способную к рекурсии. На превышении даёт
// FLANG_RECURSION_LIMIT с тем же кодом и текстом, что интерпретатор.
func (ctx *Ctx) Enter(function string) error {
	if err := ctx.Step(function); err != nil {
		return err
	}
	if ctx.MaxDepth > 0 && ctx.Depth+1 > ctx.MaxDepth {
		return Fail(CodeRecursionLimit,
			"функция «%s» превысила предел глубины вызовов (%d) на глубине %d",
			function, ctx.MaxDepth, ctx.Depth+1)
	}
	ctx.Depth++
	return nil
}

// Leave — выход из функции. Вызывается и на ошибке: счётчик глубины обязан
// вернуться назад, иначе первая же пойманная ошибка навсегда съела бы предел.
func (ctx *Ctx) Leave() { ctx.Depth-- }

// Step — виток вычисления: цикл хвостового самовызова, отскок батута, вход в
// функцию. Считается отдельно от глубины: хвостовая рекурсия глубину не растит,
// но завершаться от этого не начинает.
func (ctx *Ctx) Step(function string) error {
	ctx.Steps++
	if ctx.MaxSteps > 0 && ctx.Steps > ctx.MaxSteps {
		return Fail(CodeRecursionLimit,
			"функция «%s» исчерпала лимит шагов (%d) на глубине вызовов %d",
			function, ctx.MaxSteps, ctx.Depth)
	}
	return nil
}

// ───────────────────────────── батут ─────────────────────────────

// Step функция шага батута: либо кладёт значение, либо заполняет отскок.
type StepFunc func(ctx *Ctx, args []Value, bounce *Bounce) (Value, error)

// Bounce — отскок: следующая функция компоненты и её аргументы.
//
// Взаимная хвостовая рекурсия («Чётное»/«Нечётное») у интерпретатора идёт в
// постоянной глубине — он переиспользует кадр возврата. Обычный вызов Go рос бы
// по стеку и упёрся бы в предел там, где интерпретатор считает штатно.
type Bounce struct {
	Next StepFunc
	Args []Value
}

// Trampoline крутит отскоки в цикле, пока шаг не вернёт значение.
func Trampoline(ctx *Ctx, step StepFunc, args []Value, function string) (Value, error) {
	bounce := Bounce{}
	for {
		bounce.Next = nil
		bounce.Args = nil
		value, err := step(ctx, args, &bounce)
		if err != nil {
			return Nothing(), err
		}
		if bounce.Next == nil {
			return value, nil
		}
		if err := ctx.Step(function); err != nil {
			return Nothing(), err
		}
		step = bounce.Next
		args = bounce.Args
	}
}

// ───────────────────────────── операции языка ─────────────────────────────

// FieldGet — доступ к полю записи.
func FieldGet(ctx *Ctx, target Value, name string) (Value, error) {
	if target.Tag == TagVariant {
		// Поле СУММЫ ИЗ ОДНОГО ВАРИАНТА. Что вариант ровно один, проверила проверка типов, поэтому сюда приезжает значение, у которого поле есть. Отказ ниже остаётся прежним: он про сумму из двух и более.
		if value, found := lookup(target.Fields, name); found {
			return value, nil
		}
		return Nothing(), Fail(CodeType,
			"поле «%s» нельзя взять у варианта «%s» — нужен разбор", name, target.Str)
	}
	if target.Tag != TagRecord {
		return Nothing(), Fail(CodeType,
			"поле «%s» можно взять только у записи, получено %s", name, TypeName(target))
	}
	value, found := lookup(target.Fields, name)
	if !found {
		return Nothing(), Fail(CodeUnknownName, "запись не содержит поле «%s»", name)
	}
	return value, nil
}

// VariantField — поле варианта при сопоставлении с образцом. Отсутствующее поле
// это ошибка прямо здесь, а не «случай не подошёл»: так же ведёт себя
// matchPattern интерпретатора.
func VariantField(ctx *Ctx, target Value, name string) (Value, error) {
	value, found := lookup(target.Fields, name)
	if !found {
		return Nothing(), Fail(CodeUnknownName,
			"вариант «%s» не содержит поле «%s»", target.Str, name)
	}
	return value, nil
}

// Cond — условие «если»: обязано быть признаком.
func Cond(ctx *Ctx, value Value) (bool, error) {
	if value.Tag != TagFlag {
		return false, Fail(CodeType,
			"условие «если» должно быть признаком, получено %s", TypeName(value))
	}
	return value.Flag, nil
}

// Keep — условие «отфильтровать»: обязано быть признаком.
func Keep(ctx *Ctx, value Value) (bool, error) {
	if value.Tag != TagFlag {
		return false, Fail(CodeType,
			"условие «отфильтровать» должно быть признаком, получено %s", TypeName(value))
	}
	return value.Flag, nil
}

// Post — значение постусловия: обязано быть признаком.
func Post(ctx *Ctx, value Value, property, function string) (bool, error) {
	if value.Tag != TagFlag {
		return false, Fail(CodeType,
			"постусловие «%s» функции «%s» должно давать признак, получено %s",
			property, function, TypeName(value))
	}
	return value.Flag, nil
}

// Pre — значение предусловия: обязано быть признаком.
//
// Отдельно от Post, а не тот же помощник со вторым текстом: слова отказа
// дословно те же, что у интерпретатора (checkPreconditions в
// flang/src/interpret.mjs), и одно сообщение на две разные вещи разошлось бы
// молча. Зовёт это ТОЛЬКО дверь программы — вызов по имени (Call): внутри
// программы предусловие снял вызывающий на проверке, и проверять его там
// значило бы платить временем за доказанное.
func Pre(ctx *Ctx, value Value, property, function string) (bool, error) {
	if value.Tag != TagFlag {
		return false, Fail(CodeType,
			"предусловие «%s» функции «%s» должно давать признак, получено %s",
			property, function, TypeName(value))
	}
	return value.Flag, nil
}

// MatchFail — разбор не покрыл значение.
func MatchFail(ctx *Ctx, value Value) error {
	return Fail(CodeMatch, "разбор не покрывает значение %s", Describe(value))
}

// RequireList — «свёртка», «отобразить» и «отфильтровать» работают только со списком.
func RequireList(ctx *Ctx, value Value, label string) ([]Value, error) {
	if value.Tag != TagList {
		return nil, Fail(CodeType,
			"«%s» работает только со списком, получено %s", label, TypeName(value))
	}
	return value.List, nil
}

// ───────────────────────────── арифметика ─────────────────────────────

func arithmetic(op string, left, right Value) (float64, float64, error) {
	if left.Tag != TagNumber || right.Tag != TagNumber {
		return 0, 0, Fail(CodeType,
			"операция «%s» допустима только для чисел, получено %s и %s",
			op, TypeName(left), TypeName(right))
	}
	return left.Num, right.Num, nil
}

// Сообщение дословно как в ядре FTS (src/utility.ts, compare).
func ordered(left, right Value) (float64, float64, error) {
	if left.Tag != TagNumber || right.Tag != TagNumber {
		return 0, 0, Fail(CodeType, "сравнения порядка допустимы только для чисел")
	}
	return left.Num, right.Num, nil
}

// Add — «плюс».
func Add(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := arithmetic("add", left, right)
	if err != nil {
		return Nothing(), err
	}
	return Number(a + b), nil
}

// Sub — «минус».
func Sub(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := arithmetic("sub", left, right)
	if err != nil {
		return Nothing(), err
	}
	return Number(a - b), nil
}

// Mul — «умножить на».
func Mul(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := arithmetic("mul", left, right)
	if err != nil {
		return Nothing(), err
	}
	return Number(a * b), nil
}

// Div — «делить на». Деление на ноль даёт ±Infinity, а 0/0 — NaN: это значения
// IEEE-754, а не ошибка (SPEC, раздел 5). Go здесь ведёт себя как JS, потому
// что оба делят float64, — но только на переменных: деление константы на
// константный ноль Go не компилирует вовсе.
func Div(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := arithmetic("div", left, right)
	if err != nil {
		return Nothing(), err
	}
	return Number(a / b), nil
}

// Mod — «остаток от». math.Mod это fmod, то есть ровно оператор % из JS: знак
// берётся от делимого, деление на ноль даёт NaN.
func Mod(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := arithmetic("mod", left, right)
	if err != nil {
		return Nothing(), err
	}
	return Number(math.Mod(a, b)), nil
}

// Percent — «процентов от». Порядок операций ядра: (процент / 100) * значение.
// Переписать в значение * процент / 100 нельзя — меняется последний бит мантиссы.
func Percent(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := arithmetic("percent", left, right)
	if err != nil {
		return Nothing(), err
	}
	return Number((a / 100) * b), nil
}

// Gt — «больше».
func Gt(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := ordered(left, right)
	if err != nil {
		return Nothing(), err
	}
	return Flag(a > b), nil
}

// Lt — «меньше».
func Lt(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := ordered(left, right)
	if err != nil {
		return Nothing(), err
	}
	return Flag(a < b), nil
}

// Gte — «не меньше».
func Gte(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := ordered(left, right)
	if err != nil {
		return Nothing(), err
	}
	return Flag(a >= b), nil
}

// Lte — «не больше».
func Lte(ctx *Ctx, left, right Value) (Value, error) {
	a, b, err := ordered(left, right)
	if err != nil {
		return Nothing(), err
	}
	return Flag(a <= b), nil
}

// Concat — «соединить» как двуместная операция над строками.
func Concat(ctx *Ctx, left, right Value) (Value, error) {
	if left.Tag != TagString || right.Tag != TagString {
		return Nothing(), Fail(CodeType,
			"«соединить» допустимо только для строк, получено %s и %s",
			TypeName(left), TypeName(right))
	}
	return Text(left.Str + right.Str), nil
}

// ───────────────────────────── проверки аргументов ─────────────────────────

func expectString(name string, value Value, role string) (string, error) {
	if value.Tag != TagString {
		return "", Fail(CodeBuiltinArgs,
			"«%s»: %s должна быть строкой, получено %s", name, role, TypeName(value))
	}
	return value.Str, nil
}

func expectNumber(name string, value Value, role string) (float64, error) {
	if value.Tag != TagNumber {
		return 0, Fail(CodeBuiltinArgs,
			"«%s»: %s должно быть числом, получено %s", name, role, TypeName(value))
	}
	return value.Num, nil
}

func expectInteger(name string, value Value, role string) (float64, error) {
	number, err := expectNumber(name, value, role)
	if err != nil {
		return 0, err
	}
	// Number.isInteger: ни NaN, ни бесконечность целыми не считаются.
	if math.IsNaN(number) || math.IsInf(number, 0) || number != math.Trunc(number) {
		return 0, Fail(CodeBuiltinArgs,
			"«%s»: %s должно быть целым числом, получено %s", name, role, NumberText(number))
	}
	return number, nil
}

func expectList(name string, value Value, role string) ([]Value, error) {
	if value.Tag != TagList {
		return nil, Fail(CodeBuiltinArgs,
			"«%s»: %s должен быть списком, получено %s", name, role, TypeName(value))
	}
	return value.List, nil
}

// ───────────────────────────── встроенные формы ─────────────────────────────

// BLength — «длина»: строка в кодовых точках, список в элементах.
func BLength(ctx *Ctx, value Value) (Value, error) {
	switch value.Tag {
	case TagString:
		return Number(float64(utf8.RuneCountInString(value.Str))), nil
	case TagList:
		return Number(float64(len(value.List))), nil
	}
	return Nothing(), Fail(CodeBuiltinArgs,
		"«длина»: ожидается строка или список, получено %s", TypeName(value))
}

// BChar — «символ … в …». Индексация с 1 и включительно (SPEC, раздел 5);
// нулевую базу включает Ctx.IndexBase.
func BChar(ctx *Ctx, index, text Value) (Value, error) {
	position, err := expectInteger("символ", index, "индекс")
	if err != nil {
		return Nothing(), err
	}
	source, err := expectString("символ", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	runes := []rune(source)
	at := position - float64(ctx.IndexBase)
	if at < 0 || at >= float64(len(runes)) {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«символ»: индекс %s вне строки длиной %d", NumberText(position), len(runes))
	}
	return Text(string(runes[int(at)])), nil
}

// BSubstring — «подстрока … с … по …»: оба конца включительно при базе 1.
func BSubstring(ctx *Ctx, text, from, to Value) (Value, error) {
	source, err := expectString("подстрока", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	start, err := expectInteger("подстрока", from, "начало")
	if err != nil {
		return Nothing(), err
	}
	end, err := expectInteger("подстрока", to, "конец")
	if err != nil {
		return Nothing(), err
	}
	runes := []rune(source)
	length := float64(len(runes))
	begin := start - float64(ctx.IndexBase)
	if begin < 0 || begin > length {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«подстрока»: начало %s вне строки длиной %d", NumberText(start), len(runes))
	}
	if end < begin || end > length {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«подстрока»: конец %s вне диапазона [%s, %d]",
			NumberText(end), NumberText(start), len(runes))
	}
	return Text(string(runes[int(begin):int(end)])), nil
}

// ── Одна мера: где начинается знак ──────────────────────────────────────────
//
// «длина», «подстрока», «символ» и «разложить … на символы» ходят по []rune, а
// strings.Contains, strings.HasPrefix и strings.Split — по октетам. На
// правильном UTF-8 это одно и то же, а на неправильном — нет, и неправильный
// сюда приезжает: строка Go это произвольные октеты. Замер библиотечным входом
// 22 августа 2026: «мама» содержит октет D0 — true, начинается с него — true,
// разделить по нему — пять кусков, хотя знаков в «маме» четыре и ни один из них
// этому октету не равен.
//
// Поэтому вхождение засчитывается, только если оба его края стоят на начале
// руны — на том самом делении, по которому строку режет []rune.
func runeStarts(source string) []bool {
	starts := make([]bool, len(source)+1)
	for index := range source {
		starts[index] = true
	}
	starts[len(source)] = true
	return starts
}

// findAligned — первое вхождение, не разрезающее знак ни началом, ни концом.
func findAligned(source, part string, from int) int {
	if part == "" {
		return from
	}
	starts := runeStarts(source)
	for index := from; index+len(part) <= len(source); index++ {
		if starts[index] && starts[index+len(part)] && source[index:index+len(part)] == part {
			return index
		}
	}
	return -1
}

// splitAligned — разделение по тем же границам, что у поиска.
func splitAligned(source, mark string) []string {
	parts := []string{}
	from := 0
	for {
		at := findAligned(source, mark, from)
		if at < 0 {
			break
		}
		parts = append(parts, source[from:at])
		from = at + len(mark)
	}
	return append(parts, source[from:])
}

// glueFuses — слипнутся ли на стыке два знака в один. Считается прямо: мера
// склейки против суммы мер. Склейка и так копирует обе строки, поэтому лишний
// проход её порядка не меняет.
func glueFuses(left, right string) bool {
	return utf8.RuneCountInString(left+right) !=
		utf8.RuneCountInString(left)+utf8.RuneCountInString(right)
}

// BJoin — «соединить». Две формы: строка со строкой и список с разделителем;
// различаются по типу первого аргумента, как в builtins.mjs.
func BJoin(ctx *Ctx, left, right Value) (Value, error) {
	if left.Tag == TagList {
		separator, err := expectString("соединить", right, "разделитель")
		if err != nil {
			return Nothing(), err
		}
		parts := make([]string, len(left.List))
		for index, item := range left.List {
			if item.Tag != TagString {
				return Nothing(), Fail(CodeBuiltinArgs,
					"«соединить»: элемент %d списка должен быть строкой, получено %s",
					index+1, TypeName(item))
			}
			parts[index] = item.Str
		}
		tail := ""
		for index, part := range parts {
			if index != 0 {
				if glueFuses(tail, separator) {
					return Nothing(), Fail(CodeBuiltinArgs,
						"«соединить»: на стыке октет продолжения прирос бы к последнему знаку "+
							"левой строки — два знака слились бы в один")
				}
				if separator != "" {
					tail = separator
				}
			}
			if glueFuses(tail, part) {
				return Nothing(), Fail(CodeBuiltinArgs,
					"«соединить»: на стыке октет продолжения прирос бы к последнему знаку "+
						"левой строки — два знака слились бы в один")
			}
			if part != "" {
				tail = part
			}
		}
		return Text(strings.Join(parts, separator)), nil
	}
	first, err := expectString("соединить", left, "первая строка")
	if err != nil {
		return Nothing(), err
	}
	second, err := expectString("соединить", right, "вторая строка")
	if err != nil {
		return Nothing(), err
	}
	if glueFuses(first, second) {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«соединить»: на стыке октет продолжения прирос бы к последнему знаку левой "+
				"строки — два знака слились бы в один")
	}
	return Text(first + second), nil
}

// BSplit — «разделить … по …».
func BSplit(ctx *Ctx, text, separator Value) (Value, error) {
	source, err := expectString("разделить", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	mark, err := expectString("разделить", separator, "разделитель")
	if err != nil {
		return Nothing(), err
	}
	if mark == "" {
		return Nothing(), Fail(CodeBuiltinArgs, "«разделить»: разделитель не может быть пустым")
	}
	parts := splitAligned(source, mark)
	items := make([]Value, len(parts))
	for index, part := range parts {
		items[index] = Text(part)
	}
	return List(items), nil
}

// ── Доказанный путь четырёх форм: то же действие без сторожа частичности ────
//
// Частичная форма отказывает не всегда, а на пустом. Там, где непустота
// ДОКАЗАНА проверкой типов (flang/src/types.mjs, «длинаНиз»), узел приезжает с
// отметкой «доказана», и печать зовёт эти функции. Сверка типа остаётся:
// expectList ловит не пустоту, а другой вид значения.
func BSplitProven(ctx *Ctx, text, separator Value) (Value, error) {
	source, err := expectString("разделить", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	mark, err := expectString("разделить", separator, "разделитель")
	if err != nil {
		return Nothing(), err
	}
	parts := splitAligned(source, mark)
	items := make([]Value, len(parts))
	for index, part := range parts {
		items[index] = Text(part)
	}
	return List(items), nil
}

func BCharCodeProven(ctx *Ctx, text Value) (Value, error) {
	source, err := expectString("код символа", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	return Number(float64([]rune(source)[0])), nil
}

func BHeadProven(ctx *Ctx, value Value) (Value, error) {
	items, err := expectList("голова", value, "аргумент")
	if err != nil {
		return Nothing(), err
	}
	return items[0], nil
}

func BTailProven(ctx *Ctx, value Value) (Value, error) {
	items, err := expectList("хвост", value, "аргумент")
	if err != nil {
		return Nothing(), err
	}
	return List(items[1:]), nil
}

// BCharacters — «символы»: разложение строки в список односимвольных строк.
//
// []rune идёт по кодовым точкам, а не по байтам и не по единицам UTF-16, —
// то же деление, что у «длина» и «подстрока». Пустая строка даёт пустой
// список.
func BCharacters(ctx *Ctx, text Value) (Value, error) {
	source, err := expectString("символы", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	runes := []rune(source)
	items := make([]Value, len(runes))
	for index, point := range runes {
		items[index] = Text(string(point))
	}
	return List(items), nil
}

// BCharCode — «код символа»: кодовая точка первого символа строки.
//
// []rune идёт по кодовым точкам — та же нарезка, что у BCharacters; байтовый
// source[0] отдал бы первый байт UTF-8, а не символ.
func BCharCode(ctx *Ctx, text Value) (Value, error) {
	source, err := expectString("код символа", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	runes := []rune(source)
	if len(runes) == 0 {
		return Nothing(), Fail(CodeBuiltinArgs, "«код символа»: строка пуста")
	}
	return Number(float64(runes[0])), nil
}

// BCharFromCode — «символ по коду»: строка ровно из одного символа.
//
// string(rune(...)) годится только ПОСЛЕ обеих проверок: на непригодной руне
// Go молча подставляет U+FFFD, то есть портит данные вместо отказа. Суррогат
// отвергается потому, что строка Go — UTF-8, и половина пары в неё не
// записывается; тот же отказ дают все восемь целей.
func BCharFromCode(ctx *Ctx, code Value) (Value, error) {
	point, err := expectInteger("символ по коду", code, "код")
	if err != nil {
		return Nothing(), err
	}
	if point < 0 || point > 1114111 {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«символ по коду»: код %s вне диапазона Unicode [0, 1114111]", NumberText(point))
	}
	if point >= 55296 && point <= 57343 {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«символ по коду»: код %s — половина суррогатной пары, а не символ", NumberText(point))
	}
	return Text(string(rune(int32(point)))), nil
}

// BHash256 — «хеш256»: SHA-256 байтов строки шестнадцатеричной записью.
//
// Берётся `crypto/sha256` стандартной библиотеки Go: своей зависимости он не
// приносит, а писать восьмой раз тот же FIPS 180-4 значило бы завести восьмое
// место, где можно ошибиться поодиночке. Строка Go — уже UTF-8, поэтому
// хешируются ровно её байты, и отпечаток совпадает с `sha256sum` и с прочими
// восемью целями знак в знак.
func BHash256(ctx *Ctx, text Value) (Value, error) {
	body, err := expectString("хеш256", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	svod := sha256.Sum256([]byte(body))
	return Text(hex.EncodeToString(svod[:])), nil
}

// BContains — «содержит»: подстрока в строке либо значение в списке.
func BContains(ctx *Ctx, left, right Value) (Value, error) {
	if left.Tag == TagList {
		for _, item := range left.List {
			if Equal(item, right) {
				return Flag(true), nil
			}
		}
		return Flag(false), nil
	}
	source, err := expectString("содержит", left, "строка или список")
	if err != nil {
		return Nothing(), err
	}
	part, err := expectString("содержит", right, "искомая подстрока")
	if err != nil {
		return Nothing(), err
	}
	return Flag(findAligned(source, part, 0) >= 0), nil
}

// BStartsWith — «начинается с».
func BStartsWith(ctx *Ctx, text, prefix Value) (Value, error) {
	source, err := expectString("начинается с", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	start, err := expectString("начинается с", prefix, "префикс")
	if err != nil {
		return Nothing(), err
	}
	if !strings.HasPrefix(source, start) {
		return Flag(false), nil
	}
	// Левый край у префикса и у строки один, сторожится правый.
	return Flag(runeStarts(source)[len(start)]), nil
}

// isJSSpace — пробел по правилам ECMAScript String.prototype.trim.
//
// unicode.IsSpace из Go не подходит: он считает пробелом U+0085 (NEL), которого
// в наборе ECMAScript нет, и не считает U+FEFF, который там есть. Разошлись бы
// ровно на тех входах, ради которых «к числу» и проверяется.
func isJSSpace(symbol rune) bool {
	switch symbol {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x00A0, 0xFEFF, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000:
		return true
	}
	return symbol >= 0x2000 && symbol <= 0x200A
}

func trimJS(value string) string {
	return strings.TrimFunc(value, isJSSpace)
}

// numberPattern — строгий разбор «к числу»: без Infinity, NaN,
// шестнадцатеричных и пустой строки, иначе форма молча превращает мусор в
// значение. Набор символов тот же, что у регулярного выражения в builtins.mjs.
func looksLikeNumber(text string) bool {
	index := 0
	if index < len(text) && (text[index] == '+' || text[index] == '-') {
		index++
	}
	digitsBefore := 0
	for index < len(text) && text[index] >= '0' && text[index] <= '9' {
		index++
		digitsBefore++
	}
	digitsAfter := 0
	if index < len(text) && text[index] == '.' {
		index++
		for index < len(text) && text[index] >= '0' && text[index] <= '9' {
			index++
			digitsAfter++
		}
		// «1.» и «.» недопустимы: после точки обязана быть хотя бы одна цифра,
		// а «.5» допустимо только потому, что цифры есть после точки.
		if digitsAfter == 0 {
			return false
		}
	}
	if digitsBefore == 0 && digitsAfter == 0 {
		return false
	}
	if index < len(text) && (text[index] == 'e' || text[index] == 'E') {
		index++
		if index < len(text) && (text[index] == '+' || text[index] == '-') {
			index++
		}
		digits := 0
		for index < len(text) && text[index] >= '0' && text[index] <= '9' {
			index++
			digits++
		}
		if digits == 0 {
			return false
		}
	}
	return index == len(text)
}

// BToNumber — «к числу».
func BToNumber(ctx *Ctx, text Value) (Value, error) {
	source, err := expectString("к числу", text, "строка")
	if err != nil {
		return Nothing(), err
	}
	trimmed := trimJS(source)
	if !looksLikeNumber(trimmed) {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«к числу»: строка %s не является числом", QuoteJSON(source))
	}
	// Ошибка диапазона (1e999) даёт ±Inf и обрабатывается следующей проверкой:
	// текст разобран, но конечным числом не является.
	number, _ := strconv.ParseFloat(trimmed, 64)
	if math.IsNaN(number) || math.IsInf(number, 0) {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«к числу»: строка %s не является конечным числом", QuoteJSON(source))
	}
	return Number(number), nil
}

// BToNumberOrFailure — «к числу или беда»: отказ, ставший значением
// (builtins.mjs, раздел «отказ, ставший значением»).
//
// Разбор не повторяется, а переиспользуется: тексты обязаны совпасть с
// интерпретатором, и единственный способ гарантировать это — один разбор на обе
// формы. Отказать эта форма не может вовсе, поэтому ошибка наружу не идёт.
func BToNumberOrFailure(ctx *Ctx, text Value) (Value, error) {
	number, err := BToNumber(ctx, text)
	if err == nil {
		return Variant("Разобрано", []Field{{Name: "значение", Value: number}}), nil
	}
	code := CodeBuiltinArgs
	message := err.Error()
	if failure, ok := err.(*Error); ok {
		code = failure.Code
		message = failure.Message
	}
	return Variant("Не разобрано", []Field{
		{Name: "код", Value: Text(code)},
		{Name: "сообщение", Value: Text(message)},
	}), nil
}

// BToString — «к строке». Признак печатается по-русски («да»/«нет»), «ничто» —
// словом «ничто»: поверхность языка русская, и кодогенераторы обязаны это
// повторять, а не печатать true/false (SPEC, раздел 5).
func BToString(ctx *Ctx, value Value) (Value, error) {
	switch value.Tag {
	case TagString:
		return value, nil
	case TagNumber:
		return Text(NumberText(value.Num)), nil
	case TagFlag:
		if value.Flag {
			return Text("да"), nil
		}
		return Text("нет"), nil
	case TagNothing:
		return Text("ничто"), nil
	}
	return Nothing(), Fail(CodeBuiltinArgs,
		"«к строке»: ожидается скаляр, получено %s", TypeName(value))
}

// BEmpty — «пусто».
func BEmpty(ctx *Ctx, value Value) (Value, error) {
	switch value.Tag {
	case TagList:
		return Flag(len(value.List) == 0), nil
	case TagString:
		return Flag(len(value.Str) == 0), nil
	}
	return Nothing(), Fail(CodeBuiltinArgs,
		"«пусто»: ожидается строка или список, получено %s", TypeName(value))
}

// BHead — «голова».
func BHead(ctx *Ctx, value Value) (Value, error) {
	items, err := expectList("голова", value, "аргумент")
	if err != nil {
		return Nothing(), err
	}
	if len(items) == 0 {
		return Nothing(), Fail(CodeBuiltinArgs, "«голова»: список пуст")
	}
	return items[0], nil
}

// BTail — «хвост». Срез, а не копия: значения flang неизменяемы, память общая.
// В JS «хвост» копирует (массив нельзя разделить с суффиксом), и рекурсия
// «голова и хвост» там квадратична; здесь она линейна, а наблюдаемое значение
// то же самое.
// BElement — «элемент N в СПИСОК». Список в Go — срез, поэтому N-й элемент
// стоит того же, что первый: обхода нет. Границы и текст отказа повторяют
// вычислитель дословно — их сверяет дифференциальная проверка.
func BElement(ctx *Ctx, index, list Value) (Value, error) {
	position, err := expectInteger("элемент", index, "индекс")
	if err != nil {
		return Nothing(), err
	}
	items, err := expectList("элемент", list, "список")
	if err != nil {
		return Nothing(), err
	}
	at := position - float64(ctx.IndexBase)
	if at < 0 || at >= float64(len(items)) {
		return Nothing(), Fail(CodeBuiltinArgs,
			"«элемент»: индекс %s вне списка длиной %d", NumberText(position), len(items))
	}
	return items[int(at)], nil
}
func BTail(ctx *Ctx, value Value) (Value, error) {
	items, err := expectList("хвост", value, "аргумент")
	if err != nil {
		return Nothing(), err
	}
	if len(items) == 0 {
		return Nothing(), Fail(CodeBuiltinArgs, "«хвост»: список пуст")
	}
	return List(items[1:]), nil
}

// BAppend — «добавить … к …»: дописывает в конец, исходный список не меняется.
//
// За постоянное время, когда ячейка за концом ещё ничья, и копией во всех
// остальных случаях. Разбор приёма и доказательство неизменяемости — при типе
// Grow. Безусловная копия была верна, но делала накопление списка квадратичным,
// а вместе с ним и предел шагов — не сроком, а числом на бумаге.
//
// Голый append(items, item) здесь недопустим: срез чужого массива с запасом
// дописал бы в чужую ячейку, и два «добавить» от одного списка испортили бы
// друг друга. Разрешение спрашивается у Grow, а не у cap.
func BAppend(ctx *Ctx, item, value Value) (Value, error) {
	items, err := expectList("добавить", value, "второй аргумент")
	if err != nil {
		return Nothing(), err
	}
	if grow := value.Grow; grow != nil {
		// Начало среза в массиве: ёмкость исходного выделения минус ёмкость,
		// оставшаяся от этого места до конца.
		start := grow.Total - cap(items)
		end := start + len(items)
		if end == grow.Filled && end < grow.Total {
			grown := items[:len(items)+1]
			grown[len(items)] = item
			grow.Filled = end + 1
			return Value{Tag: TagList, List: grown, Grow: grow}, nil
		}
	}
	// Копия — с запасом, чтобы следующие «добавить» шли уже на месте. Запас
	// равен длине, то есть массив удваивается: за n «добавить» перевыделений
	// log₂n, а не n.
	capacity := 2 * (len(items) + 1)
	result := make([]Value, len(items)+1, capacity)
	copy(result, items)
	result[len(items)] = item
	return Value{Tag: TagList, List: result, Grow: &Grow{Total: capacity, Filled: len(result)}}, nil
}

// BPrepend — «приписать … к …»: тот же список с элементом впереди.
// Копия, и постоянного времени здесь быть не может: срез Go не умеет смотреть на
// ячейку ПЕРЕД своим началом, поэтому запаса спереди в нём не завести — для этого
// список пришлось бы представлять не срезом, а записью с общим буфером. Зато
// копия ОДНА на вызов, а не одна на элемент, как у свёртки, которой приписывание
// в начало писали до появления формы. Цена по всем восьми целям — в SPEC, раздел
// «Стоимость встроенных форм».
func BPrepend(ctx *Ctx, item, value Value) (Value, error) {
	items, err := expectList("приписать", value, "второй аргумент")
	if err != nil {
		return Nothing(), err
	}
	result := make([]Value, len(items)+1)
	result[0] = item
	copy(result[1:], items)
	return List(result), nil
}

// BRemainder — «остаток от».
func BRemainder(ctx *Ctx, left, right Value) (Value, error) {
	a, err := expectNumber("остаток от", left, "делимое")
	if err != nil {
		return Nothing(), err
	}
	b, err := expectNumber("остаток от", right, "делитель")
	if err != nil {
		return Nothing(), err
	}
	return Number(math.Mod(a, b)), nil
}

// BPercentOf — «процентов от»: (процент / 100) * значение, порядок ядра.
func BPercentOf(ctx *Ctx, left, right Value) (Value, error) {
	percent, err := expectNumber("процентов от", left, "процент")
	if err != nil {
		return Nothing(), err
	}
	value, err := expectNumber("процентов от", right, "значение")
	if err != nil {
		return Nothing(), err
	}
	return Number((percent / 100) * value), nil
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
// `1e300 минус 1` равно `1e300`, цепочка вечна, а ловить её нечем. Поэтому
// дверь одна и стоит она ДО вычисления.
//
// Таблицу печатает бэкенд вместе с программой (`Entry`), а строит её
// `flang/src/types.mjs` (`таблицаВхода`) — тем же пониманием слов «значение
// подходит типу», каким сверяется `flang run --args`.

// TypeKind — вид объявленного типа.
type TypeKind uint8

// Виды объявленного типа. TypeUnknown — значение-функция, параметр
// полиморфизма и применение типа с аргументами: одной таблицы им мало, и они
// не сверяются вовсе.
const (
	TypeUnknown TypeKind = iota
	TypeNumber
	TypeText
	TypeFlag
	TypeNull
	TypeList
	TypeRecord
	TypeSum
)

// TypeField — поле записи или варианта: имя и место его типа в таблице типов.
type TypeField struct {
	Name string
	Type int
}

// TypeVariant — вариант суммы: имя дискриминанта и отрезок его полей.
type TypeVariant struct {
	Name       string
	FieldFrom  int
	FieldCount int
}

// Type — объявленный тип. Поля и варианты лежат сплошными отрезками общих
// массивов, а тип называет своё начало и длину.
type Type struct {
	Kind         TypeKind
	Name         string // печатное имя типа: «неотрицательное», «список числа»
	Owner        string // имя записи или суммы без кавычек — для текстов о полях
	Optional     bool   // «… или ничто»: отсутствие значения законно
	Integral     bool
	Bounded      bool // есть ли конечный отрезок (у `число` его нет)
	Low          float64
	High         float64
	Of           int // тип элемента списка
	FieldFrom    int
	FieldCount   int
	VariantFrom  int
	VariantCount int
}

// EntryParam — параметр функции: чей он, как называется и какого он типа.
type EntryParam struct {
	Function string
	Name     string
	Type     int
}

// EntryTable — граница входа программы целиком.
type EntryTable struct {
	Types    []Type
	Fields   []TypeField
	Variants []TypeVariant
	Params   []EntryParam
}

func checkNumberType(spec *Type, value Value, label string) error {
	if value.Tag != TagNumber || math.IsNaN(value.Num) || math.IsInf(value.Num, 0) {
		return Fail(CodeType, "%s не соответствует типу %s", label, spec.Name)
	}
	// Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
	// порядок, и второй отказ на одном значении был бы вторым текстом про одну беду.
	if spec.Integral && math.Floor(value.Num) != value.Num {
		return Fail(CodeType, "%s: %s не целое, а тип %s — целый", label, NumberText(value.Num), spec.Name)
	}
	if spec.Bounded && (value.Num < spec.Low || value.Num > spec.High) {
		return Fail(CodeType, "%s: %s вне %s", label, NumberText(value.Num), spec.Name)
	}
	return nil
}

func checkFields(table *EntryTable, from, count int, given []Field, label, owner string, ofVariant bool) error {
	for index := 0; index < count; index++ {
		declared := table.Fields[from+index]
		found := -1
		for at, field := range given {
			if field.Name == declared.Name {
				found = at
				break
			}
		}
		if found < 0 {
			// Необязательное поле можно не задавать: отсутствие — это «ничто».
			if table.Types[declared.Type].Optional {
				continue
			}
			if ofVariant {
				return Fail(CodeType, "%s: вариант «%s» требует поле «%s»", label, owner, declared.Name)
			}
			return Fail(CodeType, "%s: не задано поле «%s» записи «%s»", label, declared.Name, owner)
		}
		inner := fmt.Sprintf("%s.%s", label, declared.Name)
		if err := checkTyped(table, declared.Type, given[found].Value, inner); err != nil {
			return err
		}
	}
	return nil
}

func checkTyped(table *EntryTable, index int, value Value, label string) error {
	if index < 0 || index >= len(table.Types) {
		return nil
	}
	spec := &table.Types[index]
	// Необязательный аргумент можно не задавать: отсутствие — это «ничто», а не
	// пропуск. Так же считает и ядро FTS.
	if spec.Optional && value.Tag == TagNothing {
		return nil
	}
	mismatch := func() error {
		return Fail(CodeType, "%s не соответствует типу %s", label, spec.Name)
	}
	switch spec.Kind {
	case TypeNumber:
		return checkNumberType(spec, value, label)
	case TypeText:
		if value.Tag != TagString {
			return mismatch()
		}
	case TypeFlag:
		if value.Tag != TagFlag {
			return mismatch()
		}
	case TypeNull:
		if value.Tag != TagNothing {
			return mismatch()
		}
	case TypeList:
		if value.Tag != TagList {
			return mismatch()
		}
		for at, item := range value.List {
			if err := checkTyped(table, spec.Of, item, fmt.Sprintf("%s[%d]", label, at)); err != nil {
				return err
			}
		}
	case TypeRecord:
		if value.Tag != TagRecord {
			return mismatch()
		}
		if err := checkFields(table, spec.FieldFrom, spec.FieldCount, value.Fields, label, spec.Owner, false); err != nil {
			return err
		}
		// Лишнее поле — тоже несоответствие типу: запись flang тотальна, и поля
		// сверх объявленных в ней взяться неоткуда.
		for _, field := range value.Fields {
			declared := false
			for at := 0; at < spec.FieldCount; at++ {
				if table.Fields[spec.FieldFrom+at].Name == field.Name {
					declared = true
					break
				}
			}
			if !declared {
				return Fail(CodeType, "%s: запись «%s» не имеет поля «%s»", label, spec.Owner, field.Name)
			}
		}
	case TypeSum:
		if value.Tag != TagVariant && value.Tag != TagRecord {
			return mismatch()
		}
		found := -1
		if value.Tag == TagVariant {
			for at := 0; at < spec.VariantCount; at++ {
				if table.Variants[spec.VariantFrom+at].Name == value.Str {
					found = spec.VariantFrom + at
					break
				}
			}
		}
		if found < 0 {
			return Fail(CodeType, "%s: ожидался вариант типа «%s»", label, spec.Owner)
		}
		variant := table.Variants[found]
		return checkFields(table, variant.FieldFrom, variant.FieldCount, value.Fields, label, variant.Name, true)
	}
	return nil
}

// CheckEntry сверяет набор значений с объявленными типами параметров функции.
//
// Молчит там, где сверять нечем: имени в таблице нет, число значений с числом
// параметров не сошлось (об этом скажет диспетчер своим текстом), тип приехал
// видом TypeUnknown. Тексты отказов дословно те же, что у `checkValue` свидетеля.
func CheckEntry(table *EntryTable, name string, args []Value) error {
	declared := 0
	for _, param := range table.Params {
		if param.Function == name {
			declared++
		}
	}
	if declared == 0 || declared != len(args) {
		return nil
	}
	at := 0
	for _, param := range table.Params {
		if param.Function != name {
			continue
		}
		label := fmt.Sprintf("вызов функции «%s»: аргумент «%s»", name, param.Name)
		if err := checkTyped(table, param.Type, args[at], label); err != nil {
			return err
		}
		at++
	}
	return nil
}
