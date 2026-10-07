# Map of the language constructs

Every word of the language is a node. A solid arrow means "the second is
written inside the first". A dashed arrow means "the first gives the second" or
"the first refers to the second". Which construct to take for which action is on
the page [Which construct to use when](which-construct.html).

## How to read it

| Node | What it means |
| --- | --- |
| a filled rectangle | a concept of the [glossary](../glossary.html); it stands on the map exactly once |
| a rounded rectangle | a construct that the glossary does not have |
| an oval marked "layer N" | a reference to a concept drawn in layer N |
| an oval without a mark | a label: what goes in or what comes out |

A filled rectangle carries two spellings: the Russian word and the English one.
Both are the same word of the language on two writing surfaces.

## Compared with the glossary

The glossary holds {{словарь.понятий}} concepts. The map holds 156 glossary
concepts, each of them once; there is no difference. Beyond the glossary the map
has 22 nodes: constructs that the [specification](../spec.html) has and the
glossary does not. There are 17 layers.

The glossary concepts are
counted with the command below. The nodes of the map are
counted from the text of the diagrams of this page: for a glossary concept the
number of the node is the number of its row in the glossary.

```bash
grep -c '^| `' docs/glossary.md
```

| Layer | What is in it | Glossary concepts | Nodes beyond the glossary |
| --- | --- | ---: | ---: |
| 1 | File and declarations | 14 | 0 |
| 2 | Own types: sum and record | 7 | 0 |
| 3 | Built-in types and values | 12 | 6 |
| 4 | Function | 11 | 0 |
| 5 | Body: match | 6 | 0 |
| 6 | Body: if, fold, let | 5 | 0 |
| 7 | Call and connectives | 8 | 0 |
| 8 | Arithmetic, comparison, logic | 15 | 0 |
| 9 | Forms over a list | 8 | 0 |
| 10 | Forms over a string | 14 | 0 |
| 11 | Proofs | 12 | 0 |
| 12 | Plans and orders | 3 | 12 |
| 13 | Processes and supervision | 5 | 4 |
| 14 | Category and morphisms | 13 | 0 |
| 15 | Functors | 7 | 0 |
| 16 | Monoid and monad | 10 | 0 |
| 17 | Legacy surface | 6 | 0 |
| | **total** | **156** | **22** |

The nodes beyond the glossary, by name:

| Layer | Nodes | Where they come from |
| --- | --- | --- |
| 3 | `неотрицательное` (also `нат`), `целое`, `вес` (also `стоимость`), `сотых`, `тысячных`, the function type | the [specification](../spec.html), section «Типы» |
| 12 | the sums «Продолжение» with four variants, «Отклик», six groups of orders | the [specification](../spec.html), section «Ввод-вывод» |
| 13 | the sum «Действие», three supervision strategies | the [process contract](../spec-conc.html) |

## 1. File and declarations

Glossary concepts in the diagram: 14. Nodes beyond the glossary: 0. References and labels: 1.

```mermaid File and declarations
flowchart LR
  c1[модуль<br>module]
  c2[экспортирует<br>exports]
  c3[использует<br>uses]
  c35[только<br>only]
  c11[примечание<br>note]
  c7[тип<br>type]
  c5[объект<br>object]
  c16[функция<br>function]
  c124[утверждение<br>proposition]
  c119[теорема<br>theorem]
  c156[план<br>plan]
  c147[процесс<br>process]
  c151[надзор<br>supervision]
  c154[прогон<br>run]
  g_cat([category, functor, monoid, monad<br>layers 14–16])
  c1 --> c2
  c1 --> c3
  c3 --> c35
  c1 --> c11
  c1 --> c7
  c1 --> c5
  c1 --> c16
  c1 --> c124
  c1 --> c119
  c1 --> c156
  c1 --> c147
  c1 --> c151
  c1 --> c154
  c1 --> g_cat
  class c1,c2,c3,c35,c11,c7,c5,c16,c124,c119,c156,c147,c151,c154 vyvod
```

## 2. Own types: sum and record

Glossary concepts in the diagram: 7. Nodes beyond the glossary: 0. References and labels: 6.

```mermaid Own types: sum and record
flowchart LR
  p7([тип · type<br>layer 1])
  c9[это]
  c8[вариант<br>variant]
  p52([содержит · contains<br>layer 10])
  c97[поле<br>field]
  p5([объект · object<br>layer 1])
  c10[вложен объект<br>nested object]
  c90[является<br>is]
  c91[иногда является<br>may be]
  p65([список · list<br>layer 3])
  p26([разбор · match<br>layer 5])
  c6[запись<br>record]
  p33([с · with<br>layer 7])
  p7 --> c9
  p7 --> c8
  c8 --> p52
  p52 --> c97
  p5 --> c97
  p5 --> c10
  c97 --> c90
  c97 --> c91
  c9 -.-> p65
  c8 -.-> p26
  p5 -.-> c6
  c6 --> p33
  class c9,c8,c97,c10,c90,c91,c6 vyvod
```

## 3. Built-in types and values

Glossary concepts in the diagram: 12. Nodes beyond the glossary: 6. References and labels: 1.

```mermaid Built-in types and values
flowchart LR
  g_types([type of a value])
  c84[число<br>number]
  c85[строка<br>string]
  c86[признак<br>boolean]
  c83[ничто<br>null]
  c65[список<br>list]
  c68[любое<br>any]
  s_fntype(функция из … в …<br>function type)
  c87[деньги<br>money]
  c88[дата<br>date]
  s_nat(неотрицательное, нат<br>non-negative)
  s_int(целое<br>integer)
  s_weight(вес, стоимость<br>weight, cost)
  s_cent(сотых<br>hundredths)
  s_mille(тысячных<br>thousandths)
  c81[да<br>true]
  c82[нет<br>false]
  c64[список из<br>list of]
  c63[пустой список<br>empty list]
  g_types --> c84
  g_types --> c85
  g_types --> c86
  g_types --> c83
  g_types --> c65
  g_types --> c68
  g_types --> s_fntype
  g_types --> c87
  g_types --> c88
  c84 -.-> s_nat
  c84 -.-> s_int
  c84 -.-> s_weight
  c84 -.-> s_cent
  c84 -.-> s_mille
  c86 --> c81
  c86 --> c82
  c65 --> c64
  c65 --> c63
  class c84,c85,c86,c83,c65,c68,c87,c88,c81,c82,c64,c63 vyvod
```

The types `неотрицательное`, `целое`, `вес`, `сотых`, `тысячных` and the function type are not in the glossary: the glossary is printed from the table of words, and these names are read in the position of a type. In the diagram they are nodes beyond the glossary.

## 4. Function

Glossary concepts in the diagram: 11. Nodes beyond the glossary: 0. References and labels: 2.

```mermaid Function
flowchart LR
  p16([функция · function<br>layer 1])
  c15[тотальная<br>total]
  c17[принимает<br>accepts]
  c18[возвращает<br>returns]
  c135[требует<br>requires]
  c14[убывает<br>decreases]
  c136[обеспечивает<br>ensures]
  c19[пример<br>example]
  g_body([function body])
  c137[для всех<br>for all]
  c95[результат<br>result]
  c20[дано<br>given]
  c21[ожидается<br>expected]
  p16 --> c15
  p16 --> c17
  p16 --> c18
  p16 --> c135
  p16 --> c14
  p16 --> c136
  p16 --> c19
  p16 --> g_body
  c136 --> c137
  c136 --> c95
  c19 --> c20
  c19 --> c21
  class c15,c17,c18,c135,c14,c136,c19,c137,c95,c20,c21 vyvod
```

## 5. Body: match

Glossary concepts in the diagram: 6. Nodes beyond the glossary: 0. References and labels: 3.

```mermaid Body: match
flowchart LR
  g_body([function body])
  c26[разбор<br>match]
  c27[случай<br>case]
  p8([вариант · variant<br>layer 2])
  c62[пусто<br>empty]
  c61[голова и хвост<br>head and tail]
  p68([любое · any<br>layer 3])
  c39[как<br>as]
  c24[то<br>then]
  g_body --> c26
  c26 --> c27
  c27 --> p8
  c27 --> c62
  c27 --> c61
  c27 --> p68
  c27 --> c39
  c27 --> c24
  class c26,c27,c62,c61,c39,c24 vyvod
```

Induction in a proof attaches to this form. There are five patterns: a variant of a sum, `пусто`, `голова и хвост`, `любое`, and binding a field with the word `как`.

## 6. Body: if, fold, let

Glossary concepts in the diagram: 5. Nodes beyond the glossary: 0. References and labels: 4.

```mermaid Body: if, fold, let
flowchart LR
  g_body2([function body])
  c23[если<br>if]
  c44[свёртка<br>fold]
  c22[пусть<br>let]
  p24([то · then<br>layer 5])
  c25[иначе<br>else]
  c41[начиная с<br>starting with]
  p39([как · as<br>layer 5])
  p75([равен · equals<br>layer 8])
  g_body2 --> c23
  g_body2 --> c44
  g_body2 --> c22
  c23 --> p24
  c23 --> c25
  c44 --> c41
  c44 --> p39
  c22 --> p75
  class c23,c44,c22,c25,c41 vyvod
```

## 7. Call and connectives

Glossary concepts in the diagram: 8. Nodes beyond the glossary: 0. References and labels: 7.

```mermaid Call and connectives
flowchart LR
  g_expr([expression])
  g_call([call of «Name»])
  c28[от<br>of]
  c29[и<br>and]
  p6([запись · record<br>layer 2])
  c33[с<br>with]
  p43([отфильтровать · filter<br>layer 9])
  c40[где<br>where]
  p51([разделить · split<br>layer 10])
  c37[по<br>by]
  p60([элемент · item<br>layer 9])
  c36[в, к<br>to]
  p137([для всех · for all<br>layer 4])
  c34[из<br>from]
  c38[у<br>at]
  g_expr --> g_call
  g_call --> c28
  c28 --> c29
  g_expr --> p6
  p6 --> c33
  g_expr --> p43
  p43 --> c40
  g_expr --> p51
  p51 --> c37
  g_expr --> p60
  p60 --> c36
  g_expr --> p137
  p137 --> c34
  g_expr --> c38
  class c28,c29,c33,c40,c37,c36,c34,c38 vyvod
```

## 8. Arithmetic, comparison, logic

Glossary concepts in the diagram: 15. Nodes beyond the glossary: 0. References and labels: 6.

```mermaid Arithmetic, comparison, logic
flowchart LR
  g_two_numbers([two numbers])
  c69[плюс<br>plus]
  c70[минус<br>minus]
  c71[умножить на<br>times]
  c72[делить на<br>divided by]
  c73[остаток от<br>modulo]
  c74[процентов<br>percent]
  g_number_out([number])
  g_two_values([two values])
  c75[равен<br>equals]
  c76[не равен<br>is not equal to]
  c77[больше<br>is greater than]
  c78[меньше<br>is less than]
  c79[не больше<br>is at most]
  c80[не меньше<br>is at least]
  g_flag_out([flag])
  g_flags([flags])
  c30[и притом<br>and also]
  c31[или<br>or]
  c32[не<br>not]
  g_flag_out2([flag])
  g_two_numbers --> c69
  g_two_numbers --> c70
  g_two_numbers --> c71
  g_two_numbers --> c72
  g_two_numbers --> c73
  g_two_numbers --> c74
  c69 -.-> g_number_out
  c70 -.-> g_number_out
  c71 -.-> g_number_out
  c72 -.-> g_number_out
  c73 -.-> g_number_out
  c74 -.-> g_number_out
  g_two_values --> c75
  g_two_values --> c76
  g_two_values --> c77
  g_two_values --> c78
  g_two_values --> c79
  g_two_values --> c80
  c75 -.-> g_flag_out
  c76 -.-> g_flag_out
  c77 -.-> g_flag_out
  c78 -.-> g_flag_out
  c79 -.-> g_flag_out
  c80 -.-> g_flag_out
  g_flags --> c30
  g_flags --> c31
  g_flags --> c32
  c30 -.-> g_flag_out2
  c31 -.-> g_flag_out2
  c32 -.-> g_flag_out2
  class c69,c70,c71,c72,c73,c74,c75,c76,c77,c78,c79,c80,c30,c31,c32 vyvod
```

## 9. Forms over a list

Glossary concepts in the diagram: 8. Nodes beyond the glossary: 0. References and labels: 5.

```mermaid Forms over a list
flowchart LR
  g_list_in([list])
  c42[отобразить<br>map]
  c43[отфильтровать<br>filter]
  c66[добавить<br>add]
  c67[приписать<br>prepend]
  c59[хвост<br>tail]
  c58[голова<br>head]
  c60[элемент<br>item]
  c45[длина<br>length]
  p44([свёртка · fold<br>layer 6])
  g_list_out([new list])
  g_item_out([one item])
  g_num_out([number])
  g_list_in --> c42
  g_list_in --> c43
  g_list_in --> c66
  g_list_in --> c67
  g_list_in --> c59
  g_list_in --> c58
  g_list_in --> c60
  g_list_in --> c45
  g_list_in --> p44
  c42 -.-> g_list_out
  c43 -.-> g_list_out
  c66 -.-> g_list_out
  c67 -.-> g_list_out
  c59 -.-> g_list_out
  c58 -.-> g_item_out
  c60 -.-> g_item_out
  c45 -.-> g_num_out
  class c42,c43,c66,c67,c59,c58,c60,c45 vyvod
```

## 10. Forms over a string

Glossary concepts in the diagram: 14. Nodes beyond the glossary: 0. References and labels: 9.

```mermaid Forms over a string
flowchart LR
  g_text_in([string])
  c46[символ<br>char]
  c49[подстрока<br>substring]
  c51[разделить<br>split]
  c47[разложить<br>decompose]
  c48[на символы<br>into characters]
  c52[содержит<br>contains]
  c53[начинается с<br>begins with]
  c55[к числу<br>to number]
  c54[к числу или беда<br>to number or failure]
  c12[код символа<br>character code]
  c57[хеш256<br>hash256]
  g_texts_in([list of strings])
  c50[соединить<br>join]
  g_code_in([code number])
  c13[символ по коду<br>character by code]
  g_any_in([any value])
  c56[к строке<br>to text]
  g_text_out([string])
  g_texts_out([list of strings])
  g_flag_out3([flag])
  g_num_out2([number])
  g_parsed_out([parsed or not parsed])
  g_text_in --> c46
  g_text_in --> c49
  g_text_in --> c51
  g_text_in --> c47
  c47 --> c48
  g_text_in --> c52
  g_text_in --> c53
  g_text_in --> c55
  g_text_in --> c54
  g_text_in --> c12
  g_text_in --> c57
  g_texts_in --> c50
  g_code_in --> c13
  g_any_in --> c56
  c46 -.-> g_text_out
  c49 -.-> g_text_out
  c57 -.-> g_text_out
  c50 -.-> g_text_out
  c13 -.-> g_text_out
  c56 -.-> g_text_out
  c51 -.-> g_texts_out
  c48 -.-> g_texts_out
  c52 -.-> g_flag_out3
  c53 -.-> g_flag_out3
  c55 -.-> g_num_out2
  c12 -.-> g_num_out2
  c54 -.-> g_parsed_out
  class c46,c49,c51,c47,c48,c52,c53,c55,c54,c12,c57,c50,c13,c56 vyvod
```

## 11. Proofs

Glossary concepts in the diagram: 12. Nodes beyond the glossary: 0. References and labels: 10.

```mermaid Proofs
flowchart LR
  p124([утверждение · proposition<br>layer 1])
  p137([для всех · for all<br>layer 4])
  c138[таких что<br>such that]
  c141[утверждаем<br>claim]
  p119([теорема · theorem<br>layer 1])
  p20([дано · given<br>layer 4])
  c139[есть такой<br>there is]
  c140[а именно<br>namely]
  c142[индукция по<br>induction on]
  p27([случай · case<br>layer 5])
  g_step([justification of a step])
  c143[по свойству<br>by property]
  c144[по примеру<br>by example]
  c145[по предположению<br>by hypothesis]
  c131[по закону<br>under law]
  c129[следовательно<br>therefore]
  c130[следует<br>follows]
  c146[следовательно доказано<br>therefore proved]
  p136([обеспечивает · ensures<br>layer 4])
  p19([пример · example<br>layer 4])
  p135([требует · requires<br>layer 4])
  p105([закон · law<br>layer 16])
  p124 --> p137
  p137 --> c138
  p124 --> c141
  p119 --> p20
  p119 --> c141
  c141 --> c139
  c139 --> c140
  p119 --> c142
  c142 --> p27
  p119 --> g_step
  g_step --> c143
  g_step --> c144
  g_step --> c145
  g_step --> c131
  p119 --> c129
  p119 --> c130
  p119 --> c146
  c143 -.-> p136
  c144 -.-> p19
  c145 -.-> p135
  c131 -.-> p105
  class c138,c141,c139,c140,c142,c143,c144,c145,c131,c129,c130,c146 vyvod
```

## 12. Plans and orders

Glossary concepts in the diagram: 3. Nodes beyond the glossary: 12. References and labels: 4.

```mermaid Plans and orders
flowchart LR
  p156([план · plan<br>layer 1])
  c89[состояние<br>state]
  c96[начинает с<br>starts with]
  c148[обрабатывает<br>handles]
  g_own_state([own sum: plan state])
  g_start_fn([function without arguments])
  g_step_fn([function: state and reply])
  s_reply(«Отклик»: 21 вид<br>reply: 21 kinds)
  s_cont(«Продолжение»<br>continuation)
  s_do(«Сделать» поручение:<br>их 23 вида<br>do an order:<br>23 kinds)
  s_end(«Конец работы»<br>finished)
  s_fail(«Провал»<br>failed)
  s_unchecked(«Не проверено»<br>not checked)
  s_ofile(файл и каталог: 7<br>file and directory: 7)
  s_onet(сеть и соединение: 7<br>network and connection: 7)
  s_oproc(чужая программа: 2<br>child program: 2)
  s_oscreen(экран и клавиши: 3<br>screen and keys: 3)
  s_otime(время и случай: 2<br>clock and random: 2)
  s_oenv(среда и доводы: 2<br>environment and arguments: 2)
  p156 --> c89
  p156 --> c96
  p156 --> c148
  c89 -.-> g_own_state
  c96 -.-> g_start_fn
  c148 -.-> g_step_fn
  g_step_fn --> s_reply
  g_step_fn -.-> s_cont
  s_cont --> s_do
  s_cont --> s_end
  s_cont --> s_fail
  s_cont --> s_unchecked
  s_do --> s_ofile
  s_do --> s_onet
  s_do --> s_oproc
  s_do --> s_oscreen
  s_do --> s_otime
  s_do --> s_oenv
  class c89,c96,c148 vyvod
```

The names in guillemets are the input-output vocabulary: three sums that the compiler adds to a program with a plan. They are not in the glossary. The numbers of kinds come from `flang/self/parser.flang`, the functions «Варианты поручения», «Варианты отклика», «Варианты продолжения».

## 13. Processes and supervision

Glossary concepts in the diagram: 5. Nodes beyond the glossary: 4. References and labels: 9.

```mermaid Processes and supervision
flowchart LR
  p147([процесс · process<br>layer 1])
  p89([состояние · state<br>layer 12])
  p96([начинает с · starts with<br>layer 12])
  p17([принимает · accepts<br>layer 4])
  p148([обрабатывает · handles<br>layer 12])
  c149[с запасом<br>with budget]
  c150[с ящиком<br>with mailbox]
  s_action(«Действие»<br>action)
  p151([надзор · supervision<br>layer 1])
  c152[стратегия<br>strategy]
  c153[порог отказов<br>failure threshold]
  s_restart(«перезапустить»<br>restart)
  s_stop(«остановить»<br>stop)
  s_escalate(«передать выше»<br>pass upward)
  p154([прогон · run<br>layer 1])
  c155[семя<br>seed]
  p20([дано · given<br>layer 4])
  p21([ожидается · expected<br>layer 4])
  p147 --> p89
  p147 --> p96
  p147 --> p17
  p147 --> p148
  p147 --> c149
  p147 --> c150
  p148 -.-> s_action
  p151 --> p147
  p151 --> c152
  p151 --> c153
  c152 --> s_restart
  c152 --> s_stop
  c152 --> s_escalate
  p154 --> c155
  p154 --> p20
  p154 --> p21
  class c149,c150,c152,c153,c155 vyvod
```

`flang check` on a program with processes answers with code 2: parsing, types, termination and examples pass, while the rules of the declarations themselves are not judged by the binary compiler, which says so in words.

## 14. Category and morphisms

Glossary concepts in the diagram: 13. Nodes beyond the glossary: 0. References and labels: 3.

```mermaid Category and morphisms
flowchart LR
  c4[категория<br>category]
  c98[морфизм<br>morphism]
  p5([объект · object<br>layer 1])
  p34([из · from<br>layer 7])
  c104[даёт<br>gives]
  p105([закон · law<br>layer 16])
  c99[после<br>after]
  c103[единица<br>identity]
  c100[цепочка<br>chain]
  c101[сначала<br>first]
  c102[затем<br>next]
  c106[изоморфизм<br>isomorphism]
  c107[прямой морфизм<br>forward morphism]
  c108[обратный морфизм<br>inverse morphism]
  c109[вложение<br>embedding]
  c110[пересечение<br>intersection]
  c4 --> c98
  c4 --> p5
  c98 --> p34
  c98 --> c104
  c98 --> p105
  c98 --> c99
  c98 --> c103
  c100 --> c101
  c100 --> c102
  c106 --> c107
  c106 --> c108
  c109 --> c104
  c110 --> p34
  c99 -.-> c100
  class c4,c98,c104,c99,c103,c100,c101,c102,c106,c107,c108,c109,c110 vyvod
```

A program with these declarations also gets code 2 from `flang check`, for the same reason.

## 15. Functors

Glossary concepts in the diagram: 7. Nodes beyond the glossary: 0. References and labels: 0.

```mermaid Functors
flowchart LR
  c120[функтор<br>functor]
  c132[отображается в<br>maps to]
  c133[отображается в поле<br>maps to field]
  c134[отображается в морфизм<br>maps to morphism]
  c121[бифунктор<br>bifunctor]
  c122[объекты<br>objects]
  c123[морфизмы<br>morphisms]
  c120 --> c132
  c132 --> c133
  c120 --> c134
  c121 --> c122
  c121 --> c123
  c122 -.-> c132
  c123 -.-> c134
  class c120,c132,c133,c134,c121,c122,c123 vyvod
```

## 16. Monoid and monad

Glossary concepts in the diagram: 10. Nodes beyond the glossary: 0. References and labels: 2.

```mermaid Monoid and monad
flowchart LR
  c111[моноид<br>monoid]
  c112[носитель<br>carrier]
  c113[операция<br>operation]
  g_unit_value([unit: a value of the carrier])
  c114[обратный элемент<br>inverse element]
  c105[закон<br>law]
  c94[свойство<br>property]
  c115[монада<br>monad]
  c116[возврат<br>return]
  c117[соединение<br>flatten]
  c118[в монаде<br>in monad]
  p22([пусть · let<br>layer 6])
  c111 --> c112
  c111 --> c113
  c111 --> g_unit_value
  c111 --> c114
  c111 -.-> c105
  c94 --> c112
  c94 --> c113
  c94 -.-> c105
  c115 --> c116
  c115 --> c117
  c115 -.-> c105
  c118 --> p22
  c118 --> c116
  c115 -.-> c118
  class c111,c112,c113,c114,c105,c94,c115,c116,c117,c118 vyvod
```

## 17. Legacy surface

Glossary concepts in the diagram: 6. Nodes beyond the glossary: 0. References and labels: 1.

```mermaid Legacy surface
flowchart LR
  g_legacy([legacy surface])
  c92[утилита<br>utility]
  c93[правило<br>rule]
  c125[имеет<br>has]
  c126[в данных<br>in data]
  c127[найти где<br>find where]
  c128[по морфизму<br>by morphism]
  g_legacy --> c92
  c92 --> c93
  g_legacy --> c125
  g_legacy --> c126
  g_legacy --> c127
  g_legacy --> c128
  class c92,c93,c125,c126,c127,c128 vyvod
```

These words are parsed, but no program can be made of them today. They are not written in new code.

## Next

- [Which construct to use when](which-construct.html) — the choice by action, and examples
- [Language reference](language.html) — how every construct is written
- [Glossary](../glossary.html) — every word on four surfaces, in Russian
