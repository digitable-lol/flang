import Terms

open «Разбор»

namespace «Второй»

structure «Суд» where
  «беды» : List String := []
  «непонято» : List String := []
  «наСлово» : List String := []

def «Суд».«беда» (r : «Суд») (s : String) : «Суд» := { r with «беды» := r.«беды» ++ [s] }
def «Суд».«еслиНе» (r : «Суд») (c : Bool) (s : String) : «Суд» := if c then r else r.«беда» s
def «Суд».«слово» (r : «Суд») (s : String) : «Суд» := { r with «наСлово» := r.«наСлово» ++ [s] }
def «Суд».«не» (r : «Суд») (s : String) : «Суд» := { r with «непонято» := r.«непонято» ++ [s] }
def «Суд».«и» (a b : «Суд») : «Суд» :=
  ⟨a.«беды» ++ b.«беды», a.«непонято» ++ b.«непонято», a.«наСлово» ++ b.«наСлово»⟩

/-- Беда, если условие не держится: пусто либо одна строка. Пути, судимые теоремой
    (`Paths.lean`), собирают беды списком из таких кусков, а не циклом с изменяемым
    судом: принятие такого пути — пустота склейки, и теорема читает его условия прямо. -/
def «если» (c : Bool) (m : String) : List String := if c then [] else [m]

def «примитивы» : List String :=
  ["плюс", "минус", "умножить", "делить", "остаток", "длина", "соединить", "подстрока", "содержит",
   "начинается", "если", "разбор", "свёртка", "отобразить", "отфильтровать"]

inductive «Зов» where
  | «прим» (n : String)
  | «функ» (n : String) («строка» : Nat)

structure «Виток» where
  «строка» : Nat
  «доводы» : String
  «часть» : Option (String × String × String)

inductive «Тотальность» where
  | «композиция» («имя» : String) («строка» : Nat) («зовы» : List «Зов»)
  | «структура» («имя» : String) («строка» : Nat) («арг» : Nat) («имяАрг» «дно» : String) («витки» : List «Виток») («сам» : Nat)
  | «шаг» («имя» : String) («строка» : Nat) («арг» : Nat) («имяАрг» «дно» : String) («витки» : List «Виток») («сам» : Nat)

def «Тотальность».«имя» : «Тотальность» → String
  | .«композиция» n _ _ => n
  | .«структура» n _ _ _ _ _ _ => n
  | .«шаг» n _ _ _ _ _ _ => n

def «целое?» (s : String) : Option Nat := if s.isNat then s.toNat? else none

def «послеМетки» (s m : String) : Option String :=
  if s.startsWith m then some (s.«сн» m.length) else none

def «имяИХвост» (s : String) : Option (String × String) :=
  if !s.startsWith "«" then none else
  match (s.«сн» 1).splitOn "»" with
  | n :: r => if n = "" then none else some (n, "»".intercalate r)
  | [] => none

def «заголовокТ» (l : String) : Option (String × Nat) := do
  let l ← «послеМетки» l "тотальность "
  let (n, r) ← «имяИХвост» l
  let k ← «послеМетки» r " строка "
  let v ← «целое?» k
  pure (n, v)

def «строкаЗова» (l : String) : Option «Зов» :=
  match «послеМетки» l "  зовёт примитив " with
  | some r => match «имяИХвост» r with
    | some (n, "") => some (.«прим» n)
    | _ => none
  | none => do
    let r ← «послеМетки» l "  зовёт "
    let (n, t) ← «имяИХвост» r
    let k ← «послеМетки» t " строка "
    let w := k.splitOn " "
    if w.length = 2 && w.getD 1 "" = "тотальна" then
      let v ← «целое?» (w.getD 0 "")
      pure (.«функ» n v)
    else none

def «убывает» (l : String) : Option (Nat × String) := do
  let r ← «послеМетки» l "  убывает аргумент "
  match r.splitOn " " with
  | k :: rest =>
    let v ← «целое?» k
    let (n, t) ← «имяИХвост» (" ".intercalate rest)
    if t = "" then pure (v, n) else none
  | [] => none

def «дноТипа» (l : String) («метка» : String) : Option String := do
  let r ← «послеМетки» l «метка»
  let (n, t) ← «имяИХвост» r
  if t = "" then pure n else none

def «самовызов» (l : String) : Option Nat := do
  let r ← «послеМетки» l "  самовызов строка "
  «целое?» r

def «строкаВитка» (f l : String) : Option (Nat × String) := do
  let r ← «послеМетки» l "  виток строка "
  match r.splitOn " " with
  | k :: _ =>
    let v ← «целое?» k
    let a ← «послеМетки» (r.«сн» (k.length + 1)) s!"«{f}» от "
    pure (v, a)
  | [] => none

def «строкаЧасти» (l : String) : Option (String × String × String) := do
  let r ← «послеМетки» l "    часть "
  let (x, t1) ← «имяИХвост» r
  let t1 ← «послеМетки» t1 " поле "
  let (p, t2) ← «имяИХвост» t1
  let t2 ← «послеМетки» t2 " варианта "
  let (v, t3) ← «имяИХвост» t2
  if t3 = "" then pure (x, p, v) else none

partial def «витки» (f : String) («шаговый» : Bool) : List String → List «Виток» × List String
  | l :: r =>
    match «строкаВитка» f l with
    | none => ([], l :: r)
    | some (k, a) =>
      if «шаговый» then
        let (vs, rest) := «витки» f «шаговый» r
        (⟨k, a, none⟩ :: vs, rest)
      else match r with
        | p :: r2 => match «строкаЧасти» p with
          | some c =>
            let (vs, rest) := «витки» f «шаговый» r2
            (⟨k, a, some c⟩ :: vs, rest)
          | none => ([], l :: r)
        | [] => ([], l :: r)
  | [] => ([], [])

def «разобратьБлок» (ls : List String) : Option «Тотальность» := do
  let (f, n) ← «заголовокТ» (ls.headD "")
  let rest := ls.drop 1
  match rest with
  | "  вид composition" :: r =>
    let «зовы» := r.takeWhile (fun l => («строкаЗова» l).isSome)
    let «хв» := r.drop «зовы».length
    if «хв» = ["  самовызова нет", "  конец тотальности"] then
      pure (.«композиция» f n («зовы».filterMap «строкаЗова»))
    else none
  | "  вид structure" :: u :: d :: r =>
    let (k, a) ← «убывает» u
    let t ← «дноТипа» d "  дно тип "
    let (vs, «хв») := «витки» f false r
    match «хв» with
    | [s, "  конец тотальности"] =>
      let sc ← «самовызов» s
      pure (.«структура» f n k a t vs sc)
    | _ => none
  | "  вид step" :: u :: d :: r =>
    let (k, a) ← «убывает» u
    let t ← «дноТипа» d "  дно тип "
    let (vs, «хв») := «витки» f true r
    match «хв» with
    | [m, s, "  конец тотальности"] =>
      let t2 ← «дноТипа» m "  мера не меньше 0 тип "
      let sc ← «самовызов» s
      if t2 = t then pure (.«шаг» f n k a t vs sc) else none
    | _ => none
  | _ => none

inductive «Режим» where
  | «код» | «строка» (z : Char) | «блокТекста» | «ёлочка» | «примечание» | «доКонца»

partial def «лексКода» : List Char → «Режим» → List Char → List Char
    | [], _, acc => acc.reverse
    | '\n' :: r, .«доКонца», acc => «лексКода» r .«код» ('\n' :: acc)
    | '\n' :: r, m, acc => «лексКода» r m ('\n' :: acc)
    | c :: r, .«код», acc =>
      match c, r with
      | '/', '/' :: r2 => «лексКода» r2 .«доКонца» (' ' :: ' ' :: acc)
      | '/', '*' :: r2 => «лексКода» r2 .«примечание» (' ' :: ' ' :: acc)
      | '"', '"' :: '"' :: r2 => «лексКода» r2 .«блокТекста» (' ' :: ' ' :: ' ' :: acc)
      | '"', _ => «лексКода» r (.«строка» '"') (' ' :: acc)
      | '\'', _ => «лексКода» r (.«строка» '\'') (' ' :: acc)
      | '«', _ => «лексКода» r .«ёлочка» (c :: acc)
      | _, _ => «лексКода» r .«код» (c :: acc)
    | c :: r, .«строка» z, acc =>
      match c, r with
      | '\\', d :: r2 => if d = '\n' then «лексКода» r2 (.«строка» z) ('\n' :: ' ' :: acc) else «лексКода» r2 (.«строка» z) (' ' :: ' ' :: acc)
      | _, _ => if c = z then «лексКода» r .«код» (' ' :: acc) else «лексКода» r (.«строка» z) (' ' :: acc)
    | c :: r, .«блокТекста», acc =>
      match c, r with
      | '\\', d :: r2 => if d = '\n' then «лексКода» r2 .«блокТекста» ('\n' :: ' ' :: acc) else «лексКода» r2 .«блокТекста» (' ' :: ' ' :: acc)
      | '"', '"' :: '"' :: r2 => «лексКода» r2 .«код» (' ' :: ' ' :: ' ' :: acc)
      | _, _ => «лексКода» r .«блокТекста» (' ' :: acc)
    | c :: r, .«ёлочка», acc =>
      match c, r with
      | '\\', d :: r2 => if d = '\n' then «лексКода» r2 .«ёлочка» ('\n' :: c :: acc) else «лексКода» r2 .«ёлочка» (d :: c :: acc)
      | _, _ => «лексКода» r (if c = '»' then .«код» else .«ёлочка») (c :: acc)
    | c :: r, .«примечание», acc =>
      match c, r with
      | '*', '/' :: r2 => «лексКода» r2 .«код» (' ' :: ' ' :: acc)
      | _, _ => «лексКода» r .«примечание» (' ' :: acc)
    | _ :: r, .«доКонца», acc => «лексКода» r .«доКонца» (' ' :: acc)

def «кодИсходника» (t : String) : Array String :=
  ((String.ofList («лексКода» t.toList .«код» [])).splitOn "\n").toArray

def «кодСтроки» (k : Array String) (n : Nat) : String :=
  if n = 0 then "" else («сжатьПробелы» ((k.getD (n - 1) "").replace "\t" " ")).«обр»

structure «Упоминание» where
  «имя» : String
  «до» : String
  «после» : String

def «упоминания» (l : String) : List «Упоминание» :=
  let «ч» := l.splitOn "«"
  (List.range («ч».length - 1)).filterMap fun i =>
    let «перед» := "«".intercalate («ч».take (i + 1))
    let «хв» := "«".intercalate («ч».drop (i + 1))
    match «хв».splitOn "»" with
    | n :: r => if n = "" then none else some ⟨n, «перед», ("»".intercalate r).«обр»⟩
    | [] => none

def «конструктор?» (u : «Упоминание») : Bool :=
  u.«до».endsWith "вариант " || u.«до».endsWith "случай " || u.«до».endsWith "запись " || u.«до».endsWith "."

def «Исх».«словоМонады» (s : «Исх») (k : Array String) («монада» «слово» : String) : String := Id.run do
  let mut «внутри» := false
  for i in s.«номера» do
    let «сыр» := s.«сырая» i
    let l := «кодСтроки» k i
    if «сыр» ≠ "" && !«сыр».startsWith " " && !«сыр».startsWith "\t" then
      «внутри» := l = s!"монада «{«монада»}»" || l.startsWith s!"монада «{«монада»}» от "
    else if «внутри» && l.startsWith s!"{«слово»} «" then return «ёлочка» l 1
  return ""

def «Исх».«зовыМонады» (s : «Исх») (k : Array String) (f : String) : List (String × Nat) := Id.run do
  let mut «монада» := ""
  let mut r : List (String × Nat) := []
  for i in (s.«внутри» f).filter (s.«строкаТела?» f) do
    let l := «кодСтроки» k i
    if l.startsWith "в монаде «" then «монада» := «ёлочка» l 1
    else if «монада» ≠ "" && l.startsWith "пусть " && s.«словоМонады» k «монада» "соединение" ≠ "" then
      r := r ++ [(s.«словоМонады» k «монада» "соединение", i)]
    else if «монада» ≠ "" && l.startsWith "возврат " && s.«словоМонады» k «монада» "возврат" ≠ "" then
      r := r ++ [(s.«словоМонады» k «монада» "возврат", i)]
  return r

def «Исх».«зовы» (s : «Исх») (f : String) : List (String × Nat) :=
  let «свои» := s.«функции»
  let k := «кодИсходника» s.«текст»
  ((s.«внутри» f).filter (s.«строкаТела?» f) |>.flatMap fun i =>
    («упоминания» («кодСтроки» k i)).filterMap fun u =>
      if «конструктор?» u then none
      else if u.«после».startsWith "от " || u.«после» = "от" || u.«имя» = f || «свои».contains u.«имя» then some (u.«имя», i)
      else none) ++ s.«зовыМонады» k f

def «Исх».«объявлено?» (s : «Исх») (x : String) : Bool :=
  s.«функции».contains x ||
  s.«номера».any fun i =>
    let l := s.«строка» i
    ["как «", "голова «", "хвост «", ".«", "объект «", "тип «", "вариант «", "модуль «"].any (fun p => (l.splitOn (p ++ x ++ "»")).length > 1) ||
    ["»:", "» равно", "» →"].any (fun p => (l.splitOn ("«" ++ x ++ p)).length > 1) ||
    (l.startsWith "принимает " && (l.splitOn ("«" ++ x ++ "»")).length > 1)

def «Исх».«голыеЧужие» (s : «Исх») (f : String) : List String :=
  if !s.«ввозит?» then [] else
  let k := «кодИсходника» s.«текст»
  (s.«внутри» f).filter (s.«строкаТела?» f) |>.flatMap (fun i =>
    («упоминания» («кодСтроки» k i)).filterMap fun u =>
      if «конструктор?» u || u.«после».startsWith "от " || u.«после» = "от" || s.«объявлено?» u.«имя» then none
      else some u.«имя») |>.eraseDups

def «Исх».«взятоТолько?» (s : «Исх») (x : String) : Bool :=
  s.«номера».any fun i =>
    let l := s.«строка» i
    l.startsWith "использует «" && match l.splitOn " только " with
      | _ :: r => (("".intercalate r).splitOn s!"«{x}»").length > 1
      | [] => false

def «сАргументом?» (l f a : String) : Option (List String) :=
  let «меч» := s!"«{f}» от "
  ((l.splitOn «меч»).drop 1).findSome? fun «хв» =>
    let d := «доводыВызова» «хв»
    if «терм» (" и ".intercalate d) = «терм» a then some d else none

/-- Разбор, под которым стоит строка случая `i` тела функции `f`: ближайшая выше строка
    тела с меньшим отступом, если она «разбор X», — тогда X, иначе пусто. -/
def «Исх».«разборСлучая» (s : «Исх») (f : String) (i : Nat) : String :=
  let «ин» := «отступ» (s.«сырая» i)
  match ((s.«внутри» f).filter (· < i)).reverse.find? (fun j => «обрезать» (s.«сырая» j) ≠ "" && «отступ» (s.«сырая» j) < «ин») with
  | some j => let l := s.«строка» j; if l.startsWith "разбор " then «голо» («обрезать» ((l.drop 7).toString)) else ""
  | none => ""

/-- Доводы на убывающем месте `n` у каждого самовызова «f» от … в строке `i` кода. -/
def «самовызовыСтроки» (k : Array String) (f : String) (i n : Nat) : List String :=
  (((«кодСтроки» k i).splitOn s!"«{f}» от ").drop 1).map (fun «хв» => «ужать» ((«доводыВызова» «хв»).getD (n - 1) ""))

/-- Самовызов от `x` в строке `i` убывает: у структурной рекурсии `x` — часть, названная
    витком этой строки; у шаговой — «a минус c» с положительным литералом c. -/
def «самовызовУбывает» (a : String) («структурный» : Bool) (vs : List «Виток») (i : Nat) (x : String) : Bool :=
  if «структурный» then vs.any (fun v => v.«строка» = i && match v.«часть» with | some (y, _, _) => y = x | none => false)
  else match «надвое» x "минус" with
    | some (y, c) => «ужать» y = a && (match «литерал?» c with | some m => m > 0 | none => false)
    | none => false

/-- Беды самовызовов рекурсии: каждое упоминание «f» в строке тела — вызов «f» от …, и
    каждый самовызов убывает (`«самовызовУбывает»`). Без этого запись называла бы витками
    лишь убывающие вызовы и молчала о прочих (задача 5991). -/
def «бедыСамовызовов» (k : Array String) (f a : String) (n : Nat) («структурный» : Bool) (vs : List «Виток»)
    («сам» : List (String × Nat)) : List String :=
  («сам».map (·.2)).eraseDups.flatMap fun i =>
    let «доводы» := «самовызовыСтроки» k f i n
    «если» ((«сам».filter (·.2 = i)).length = «доводы».length)
      s!"тотальность «{f}»: в строке {i} «{f}» упомянута не вызовом «{f}» от …" ++
    «доводы».flatMap fun x => «если» («самовызовУбывает» a «структурный» vs i x)
      s!"тотальность «{f}»: самовызов в строке {i} от «{x}» на убывающем месте не назван убывающим витком"

/-- Виток структурной рекурсии проверен: часть — поле варианта той же суммы, связана
    полем этого варианта в случае разбора убывающего довода, и стоит на убывающем месте
    самовызова своей строки. -/
def «витокСтруктуры» (s : «Исх») (f a d : String) (n : Nat) (v : «Виток») : List String :=
  match v.«часть» with
  | none => [s!"тотальность «{f}»: виток без части"]
  | some (x, «поле», «в») =>
    let ok := match s.«строкаВарианта» d «в» with
      | some l => («поляВарианта» l).any (fun q => q.1 = «поле» && «голо» q.2 = d && q.2.startsWith "«")
      | none => false
    let «связано» := (s.«внутри» f).any fun i =>
      let l := s.«строка» i
      l.startsWith "случай " && «имяВарианта» (l.«сн» 7) = «в» &&
        ((l.splitOn s!"{«поле»} как {x}").length > 1) && s.«разборСлучая» f i = a
    «если» ok s!"тотальность «{f}»: поле «{«поле»}» варианта «{«в»}» не той же суммы «{d}»" ++
    «если» «связано» s!"тотальность «{f}»: «{x}» не связано полем «{«поле»}» варианта «{«в»}» в разборе убывающего довода «{a}»" ++
    match «сАргументом?» (s.«строка» v.«строка») f v.«доводы» with
    | none => [s!"тотальность «{f}»: в строке {v.«строка»} нет самовызова «{f}» от {v.«доводы»}"]
    | some ds => «если» («ужать» (ds.getD (n - 1) "") = x) s!"тотальность «{f}»: на убывающем месте витка строки {v.«строка»} стоит не «{x}»"

def «витокШага» (s : «Исх») (f a : String) (n : Nat) (v : «Виток») : List String :=
  match «сАргументом?» (s.«строка» v.«строка») f v.«доводы» with
  | none => [s!"тотальность «{f}»: в строке {v.«строка»} нет самовызова «{f}» от {v.«доводы»}"]
  | some ds =>
    let ok := match «надвое» (ds.getD (n - 1) "") "минус" with
      | some (x, c) => «ужать» x = a && (match «литерал?» c with | some m => m > 0 | none => false)
      | none => false
    «если» ok s!"тотальность «{f}»: на месте {n} витка строки {v.«строка»} не «{a} минус <положительное>»"

/-- Беды рекурсии (structure либо step): самовызов есть, убывающий довод и дно — по
    подписи функции, дно фундировано, витки проверены, каждый самовызов убывает, и других
    функций тело не зовёт — как требует сверщик на C («запись о нём молчит»): иначе круг
    через зовомую мимо проверки кругов. -/
def «бедыРекурсии» (s : «Исх») (k : Array String) (f : String) («структурный» : Bool) (n : Nat) (a d : String)
    (vs : List «Виток») («сам» : List (String × Nat)) («чужие» : List String) : List String :=
  let «вид» := if «структурный» then "structure" else "step"
  let p := (s.«подпись» f).getD (n - 1) ("", "")
  «если» (!«сам».isEmpty) s!"тотальность «{f}» вида {«вид»}: самовызова в теле нет" ++
  «если» (n ≥ 1 && «голо» p.1 = a) s!"тотальность «{f}»: аргумент {n} — не «{a}»" ++
  «если» («голо» p.2 = d) s!"тотальность «{f}»: дно «{d}» — не тип аргумента {n} «{p.2}»" ++
  (if «структурный» then
    «если» (match s.«видТипа» d with | .«сумма» v => !v.isEmpty | _ => false) s!"тотальность «{f}»: тип «{d}» не объявлен вариантами — дна нет"
  else «если» (s.«видТипа» d == .«отрезок») s!"тотальность «{f}»: тип «{d}» не отрезок с дном 0") ++
  «если» (!vs.isEmpty) s!"тотальность «{f}»: нет ни одного витка" ++
  vs.flatMap (fun v => if «структурный» then «витокСтруктуры» s f a d n v else «витокШага» s f a n v) ++
  «бедыСамовызовов» k f a n «структурный» vs «сам» ++
  «чужие».flatMap (fun g => [s!"тотальность «{f}»: тело зовёт «{g}», а запись о нём молчит"])

/-- Функции, которые композиция записала зовомыми. -/
def «зовомыеЗаписи» (zs : List «Зов») : List String :=
  zs.filterMap (fun z => match z with
    | .«функ» g _ => some g
    | _ => none)

/-- Беды композиции: самовызова нет, каждый записанный зов — примитив либо функция,
    которую тело зовёт, у которой есть свой блок и которая объявлена на названной строке;
    каждый вызов тела записан. -/
def «бедыКомпозиции» (s : «Исх») («все» : List «Тотальность») (f : String) (zs : List «Зов»)
    («сам» : List (String × Nat)) («чужие» : List String) : List String :=
  let «записаны» := «зовомыеЗаписи» zs
  «если» «сам».isEmpty s!"тотальность «{f}» вида composition: тело зовёт саму «{f}» (строка {(«сам».headD ("", 0)).2})" ++
  zs.flatMap (fun z => match z with
    | .«прим» p => «если» («примитивы».contains p) s!"тотальность «{f}»: «{p}» не примитив языка"
    | .«функ» g m =>
      «если» («чужие».contains g) s!"тотальность «{f}»: запись называет вызов «{g}», а тело его не зовёт" ++
      «если» («все».any (·.«имя» = g)) s!"тотальность «{f}»: у зовомого «{g}» нет своего блока тотальности" ++
      «если» ((s.«блок» g).map (·.1) == some m) s!"тотальность «{f}»: «{g}» объявлена не на строке {m}") ++
  «чужие».flatMap (fun g => «если» («записаны».contains g) s!"тотальность «{f}»: тело зовёт «{g}», а запись о нём молчит")

/-- Голые имена ввезённого модуля в теле композиции: взятое списком «только» — беда,
    прочее — место на слове. -/
def «голыеКомпозиции» (s : «Исх») (f : String) («записаны» : List String) : List String × List String :=
  let xs := (s.«голыеЧужие» f).filter (fun x => !«записаны».contains x)
  (xs.filter (s.«взятоТолько?» ·) |>.map (fun x => s!"тотальность «{f}»: «{x}» взята списком только, тело её зовёт, а запись молчит"),
   xs.filter (fun x => !s.«взятоТолько?» x) |>.map (fun x => s!"тотальность «{f}»: голое «{x}» может быть нульместной функцией ввезённого модуля — не берусь"))

def «судитьБлок» (s : «Исх») («все» : List «Тотальность») (t : «Тотальность») : «Суд» :=
  let f := t.«имя»
  let n := match t with
    | .«композиция» _ n _ => n
    | .«структура» _ n _ _ _ _ _ => n
    | .«шаг» _ n _ _ _ _ _ => n
  let h := s.«сырая» n
  let «зовыТела» := s.«зовы» f
  let «сам» := «зовыТела».filter (·.1 = f)
  let «чужие» := («зовыТела».filter (·.1 ≠ f)).map (·.1) |>.eraseDups
  let k := «кодИсходника» s.«текст»
  let «заг» := «если» (h.startsWith "тотальная функция «" && «имяФункции» h = f)
    s!"тотальность «{f}»: строка {n} исходника — не заголовок «тотальная функция «{f}»»"
  match t with
  | .«композиция» _ _ zs =>
    let (b, w) := «голыеКомпозиции» s f («зовомыеЗаписи» zs)
    { «беды» := «заг» ++ «бедыКомпозиции» s «все» f zs «сам» «чужие» ++ b, «наСлово» := w }
  | .«структура» _ _ m a d vs _ => { «беды» := «заг» ++ «бедыРекурсии» s k f true m a d vs «сам» «чужие» }
  | .«шаг» _ _ m a d vs _ => { «беды» := «заг» ++ «бедыРекурсии» s k f false m a d vs «сам» «чужие» }

def «круги» («все» : List «Тотальность») : List String :=
  let «рёбра» : List (String × String) := «все».flatMap fun t => match t with
    | .«композиция» f _ zs => zs.filterMap (fun | .«функ» g _ => some (f, g) | _ => none)
    | _ => []
  let «шаг» := fun (e : List (String × String)) =>
    (e ++ e.flatMap (fun (a, b) => e.filterMap (fun (c, d) => if c = b then some (a, d) else none))).eraseDups
  let «замк» := (List.range («все».length + 1)).foldl (fun e _ => «шаг» e) «рёбра»
  («замк».filter (fun (a, b) => a = b)).map (·.1) |>.eraseDups

/-- Ранг композиции по рангам зовомых: на единицу больше наибольшего, `none` — если
    чей-то ранг не считается. -/
def «свернутьРанги» (gl : List String) (rk : String → Option Nat) : Option Nat :=
  gl.foldl (fun acc g => match acc, rk g with
    | some a, some r => some (max a (r + 1))
    | _, _ => none) (some 0)

/-- Ранг функции по зовам композиций: у рекурсии и у имени без блока — 0, у композиции —
    на единицу больше наибольшего ранга записанных зовомых. Топливо — число блоков: без
    круга глубина зовов его не превышает, с кругом ранг не считается (`none`). -/
def «ранг» («все» : List «Тотальность») : Nat → String → Option Nat
  | 0, _ => none
  | fuel + 1, f =>
    match «все».find? (·.«имя» = f) with
    | some (.«композиция» _ _ zs) => «свернутьРанги» («зовомыеЗаписи» zs) («ранг» «все» fuel)
    | _ => some 0

def «судитьТотальности» (s : «Исх») («обещано» : Option Nat) («блоки» : List (List String)) : «Суд» :=
  let «все» := «блоки».filterMap «разобратьБлок»
  let «форма» := «блоки».flatMap (fun b => match «разобратьБлок» b with
    | some _ => []
    | none => [s!"блок тотальности «{«вЁлочках» (b.headD "") 1}» не по форме печати"])
  let r0 : «Суд» := { «беды» := («если» («обещано».getD 0 = «блоки».length)
      s!"шапка обещает тотальностей {«обещано».getD 0}, а блоков {«блоки».length}" ++ «форма») }
  let r := «все».foldl (fun r t => r.«и» («судитьБлок» s «все» t)) r0
  let k := «круги» «все»
  let «безРанга» := («все».filter (fun t => («ранг» «все» («все».length + 1) t.«имя»).isNone)).map (·.«имя»)
  let r1 := r.«еслиНе» k.isEmpty s!"тотальность: зовы по кругу — {", ".intercalate k}"
  r1.«еслиНе» «безРанга».isEmpty s!"тотальность: ранг зовов не считается — круг через {", ".intercalate «безРанга»}"

end «Второй»
