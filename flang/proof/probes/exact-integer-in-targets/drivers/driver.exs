# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Проба цели «elixir»: точное целое складывается разрядами основания 2²², и
# сумма за 2⁵³ печатается десятичной записью. Длинные целые у Erlang есть в
# самом языке (ADR-0036 §6, первая цена), поэтому десятичная запись — одно
# целое BEAM, а не своя арифметика, как в целях «c», «cpp» и «rust».

Code.require_file(Enum.at(System.argv(), 0))

alias Flang.Rt, as: Rt

base = 4_194_304

digits = fn values -> Rt.list(Enum.map(values, &{:num, &1 * 1.0})) end
places = fn value -> Enum.map(Rt.items(value), fn {:num, digit} -> trunc(digit) end) end

decimal = fn value ->
  value |> places.() |> Enum.reverse() |> Enum.reduce(0, fn digit, total -> total * base + digit end)
end

total = fn label, left, right ->
  sum = Rt.add(left, right)
  IO.puts("#{label}\t#{Enum.join(places.(sum), ",")}\t#{decimal.(sum)}")
end

total.("beyond", digits.([1, 0, 512]), digits.([1]))
total.("carry", digits.([4_194_303]), digits.([1]))
total.("wide", digits.([4_194_303, 4_194_303, 4_194_303]), digits.([1, 0, 0]))
total.("denormal", digits.([4_194_305]), digits.([0]))
total.("forged", digits.([1, 0, 511]), digits.([1]))

{:num, plain} = Rt.add({:num, 2.0}, {:num, 3.0})
IO.puts("numbers\t#{trunc(plain)}")

try do
  Rt.add(digits.([1, 0, 512]), {:num, 1.0})
rescue
  refusal -> IO.puts("refusal\t#{Exception.message(refusal)}")
end
