// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// Проба цели «go»: точное целое складывается разрядами основания 2²², и сумма
// за 2⁵³ печатается десятичной записью. Длинные целые у Go есть в стандартной
// библиотеке (ADR-0036 §6, вторая цена), поэтому десятичная запись здесь берёт
// math/big. В РАНТАЙМЕ math/big не нужен и не заведён: значение держится
// разрядами, и произвольная точность приходит от длины списка.

package main

import (
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

var base = big.NewInt(4194304)

func digits(values ...float64) Value {
	items := make([]Value, len(values))
	for index, value := range values {
		items[index] = Number(value)
	}
	return List(items)
}

func places(value Value) []int64 {
	out := make([]int64, len(value.List))
	for index, item := range value.List {
		out[index] = int64(item.Num)
	}
	return out
}

func decimal(value Value) string {
	total := big.NewInt(0)
	digits := places(value)
	for index := len(digits) - 1; index >= 0; index-- {
		total.Mul(total, base)
		total.Add(total, big.NewInt(digits[index]))
	}
	return total.String()
}

func total(label string, left, right Value) {
	out, err := Add(nil, left, right)
	if err != nil {
		fmt.Printf("%s\tОТКАЗ\t%v\n", label, err)
		return
	}
	words := make([]string, 0, len(out.List))
	for _, digit := range places(out) {
		words = append(words, strconv.FormatInt(digit, 10))
	}
	fmt.Printf("%s\t%s\t%s\n", label, strings.Join(words, ","), decimal(out))
}

func main() {
	total("beyond", digits(1, 0, 512), digits(1))
	total("carry", digits(4194303), digits(1))
	total("wide", digits(4194303, 4194303, 4194303), digits(1, 0, 0))
	total("denormal", digits(4194305), digits(0))
	total("forged", digits(1, 0, 511), digits(1))
	plain, _ := Add(nil, Number(2), Number(3))
	fmt.Printf("numbers\t%d\n", int64(plain.Num))
	if _, err := Add(nil, digits(1, 0, 512), Number(1)); err != nil {
		fmt.Printf("refusal\t%v\n", err)
	}
}
