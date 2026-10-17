import Binary64

set_option linter.unusedVariables false

namespace «Эталон»

open «Д64»

inductive «Зн» where
  | «число» (d : «Д64»)
  | «строка» (s : String)
  | «признак» (b : Bool)
  | «ничто»
  | «список» (l : List «Зн»)
  | «запись» (fs : List (String × «Зн»))
  | «вариант» (k : String) (fs : List (String × «Зн»))
deriving Repr, Inhabited

inductive «Образец» where
  | «пусто»
  | «звено» (h t : Option String)
  | «вариант» (k : String) (bs : List (String × String))
  | «лит» (v : «Зн»)
  | «любое»
deriving Repr, Inhabited

inductive «Выр» where
  | «лит» (v : «Зн»)
  | «имя» (x : String)
  | «двучлен» (op : String) (a b : «Выр»)
  | «если» (c t e : «Выр»)
  | «пусть» (x : String) (v b : «Выр»)
  | «вызов» (f : String) (args : List «Выр»)
  | «разбор» (t : «Выр») (cs : List («Образец» × «Выр»))
  | «свёртка» (l n : «Выр») (a x : String) (s : «Выр»)
  | «отобразить» (l : «Выр») (x : String) (s : «Выр»)
  | «отфильтровать» (l : «Выр») (x : String) (s : «Выр»)
  | «список» (es : List «Выр»)
  | «запись» (fs : List (String × «Выр»))
  | «конструктор» (k : String) (fs : List (String × «Выр»))
  | «поле» (t : «Выр») (p : String)
  | «форма» (n : String) (args : List «Выр»)
  | «ссылка» (f : String) (fs : List (String × «Выр»))
  | «применить» (f : «Выр») (args : List «Выр»)
deriving Repr, Inhabited

structure «Постусловие» where
  «связка» : String
  «код» : String
  «выражение» : «Выр»
deriving Repr, Inhabited

structure «Функция» where
  «имя» : String
  «параметры» : List String
  «тело» : «Выр»
  «постусловия» : List «Постусловие»
deriving Repr, Inhabited

abbrev «Программа» := List «Функция»

abbrev «Среда» := List (String × «Зн»)

inductive «Сбой» where
  | «беда» (k : String)
  | «топливо»
  | «вне» (k : String)
deriving Repr, DecidableEq, Inhabited

abbrev «Исход» := Except «Сбой» «Зн»

def «беда» {α : Type} (k : String) : Except «Сбой» α := .error (.«беда» k)

def «вне» {α : Type} (k : String) : Except «Сбой» α := .error (.«вне» k)

def «найти» {α : Type} (x : String) : List (String × α) → Option α
  | [] => none
  | (y, v) :: r => if y = x then some v else «найти» x r

def «функцияПрограммы» (P : «Программа») (f : String) : Option «Функция» := P.find? (fun g => g.«имя» = f)

def «тег» (f : String) (names : List String) : String :=
  if names.isEmpty then f else f ++ " с " ++ " и ".intercalate names

def «функцияТега» (P : «Программа») (k : String) : Option «Функция» :=
  match «функцияПрограммы» P k with
  | some g => some g
  | none => «функцияПрограммы» P ((k.splitOn " с ").headD k)

mutual
def «равны» : «Зн» → «Зн» → Bool
  | .«число» a, .«число» b => «равен64» a b
  | .«строка» a, .«строка» b => a == b
  | .«признак» a, .«признак» b => a == b
  | .«ничто», .«ничто» => true
  | .«список» a, .«список» b => «равныСписки» a b
  | .«запись» a, .«запись» b => a.length == b.length && «поляРавны» a b
  | .«вариант» k a, .«вариант» m b => k == m && a.length == b.length && «поляРавны» a b
  | _, _ => false
def «равныСписки» : List «Зн» → List «Зн» → Bool
  | [], [] => true
  | x :: xs, y :: ys => «равны» x y && «равныСписки» xs ys
  | _, _ => false
def «поляРавны» : List (String × «Зн») → List (String × «Зн») → Bool
  | [], _ => true
  | (k, v) :: r, b =>
    (match «найти» k b with
     | some w => «равны» v w
     | none => false) && «поляРавны» r b
end

def «основание» : Nat := 4194304

def «целое64?» : «Д64» → Option Int
  | .«кон» s v => if v % «шаг» = 0 then some («вЕдиницах» s (v / «шаг»)) else none
  | _ => none

def «числа?» : List «Зн» → Option (List «Д64»)
  | [] => some []
  | .«число» d :: r => («числа?» r).map (d :: ·)
  | _ => none

def «разрядыВЧисло» : List «Д64» → Option Nat
  | [] => some 0
  | d :: r =>
    match «целое64?» d, «разрядыВЧисло» r with
    | some k, some m => if 0 ≤ k then some (k.toNat + «основание» * m) else none
    | _, _ => none

def «числоВРазряды» (n : Nat) : List «Зн» :=
  if h : n = 0 then [] else
    .«число» («изЦелого» ((n % «основание» : Nat) : Int)) :: «числоВРазряды» (n / «основание»)
termination_by n
decreasing_by
  unfold «основание»
  omega

def «разряды?» : «Зн» → Option (List «Д64»)
  | .«список» l => «числа?» l
  | _ => none

def «дробь?» : «Зн» → Bool
  | .«список» [a, b] => («разряды?» a).isSome && («разряды?» b).isSome
  | _ => false

def «счёт64» (op : String) (a b : «Д64») : Option «Д64» :=
  match op with
  | "add" => some («плюс64» a b)
  | "sub" => some («минус64» a b)
  | "mul" => some («умножить64» a b)
  | "div" => some («делить64» a b)
  | "mod" => some («остаток64» a b)
  | "percent" => some («умножить64» («делить64» a («изЦелого» 100)) b)
  | _ => none

def «точныйСчёт» (op : String) (a b : Nat) : Except «Сбой» «Зн» :=
  match op with
  | "add" => .ok (.«список» («числоВРазряды» (a + b)))
  | "mul" => .ok (.«список» («числоВРазряды» (a * b)))
  | "sub" => if a < b then «беда» "FLANG_PROPERTY" else .ok (.«список» («числоВРазряды» (a - b)))
  | "mod" => if b = 0 then «беда» "FLANG_PROPERTY" else .ok (.«список» («числоВРазряды» (a % b)))
  | _ => «беда» "FLANG_TYPE"

def «порядок64» (op : String) (a b : «Д64») : Bool :=
  match op with
  | "gt" => «меньше64» b a
  | "lt" => «меньше64» a b
  | "gte" => «неБольше64» b a
  | _ => «неБольше64» a b

def «порядокНат» (op : String) (a b : Nat) : Bool :=
  match op with
  | "gt" => decide (b < a)
  | "lt" => decide (a < b)
  | "gte" => decide (b ≤ a)
  | _ => decide (a ≤ b)

def «точно?» (a b : «Зн») : Option (Option (Nat × Nat)) :=
  match «разряды?» a, «разряды?» b with
  | some x, some y =>
    match «разрядыВЧисло» x, «разрядыВЧисло» y with
    | some m, some k => some (some (m, k))
    | _, _ => some none
  | _, _ => none

def «двучлен» (op : String) (a b : «Зн») : «Исход» :=
  if op = "eq" then .ok (.«признак» («равны» a b))
  else if op = "neq" then .ok (.«признак» (!«равны» a b))
  else if op = "concat" then
    match a, b with
    | .«строка» x, .«строка» y => .ok (.«строка» (x ++ y))
    | _, _ => «беда» "FLANG_TYPE"
  else if «дробь?» a && «дробь?» b && op ≠ "mod" && op ≠ "percent" then «вне» "точное дробное"
  else if op = "gt" ∨ op = "lt" ∨ op = "gte" ∨ op = "lte" then
    match «точно?» a b with
    | some (some (m, k)) => .ok (.«признак» («порядокНат» op m k))
    | some none => «вне» "разряды не в каноне"
    | none =>
      match a, b with
      | .«число» x, .«число» y => .ok (.«признак» («порядок64» op x y))
      | _, _ => «беда» "FLANG_TYPE"
  else if op = "div" ∨ op = "percent" then
    match a, b with
    | .«число» x, .«число» y =>
      match «счёт64» op x y with
      | some r => .ok (.«число» r)
      | none => «беда» "FLANG_TYPE"
    | _, _ => «беда» "FLANG_TYPE"
  else
    match «точно?» a b with
    | some (some (m, k)) => «точныйСчёт» op m k
    | some none => «вне» "разряды не в каноне"
    | none =>
      match a, b with
      | .«число» x, .«число» y =>
        match «счёт64» op x y with
        | some r => .ok (.«число» r)
        | none => «беда» "FLANG_TYPE"
      | _, _ => «беда» "FLANG_TYPE"

def «связки» (fs : List (String × «Зн»)) : List (String × String) → Except «Сбой» «Среда»
  | [] => .ok []
  | (k, x) :: r =>
    match «найти» k fs with
    | some v => do
      let w ← «связки» fs r
      pure ((x, v) :: w)
    | none => «беда» "FLANG_UNKNOWN_NAME"

def «подходит» : «Образец» → «Зн» → Except «Сбой» (Option «Среда»)
  | .«пусто», .«строка» s => .ok (if s.isEmpty then some [] else none)
  | .«пусто», .«список» l => .ok (if l.isEmpty then some [] else none)
  | .«звено» h t, .«строка» s =>
    match s.toList with
    | [] => .ok none
    | c :: r =>
      .ok (some ((match h with | some x => [(x, .«строка» (String.singleton c))] | none => []) ++
        (match t with | some y => [(y, .«строка» (String.ofList r))] | none => [])))
  | .«звено» h t, .«список» l =>
    match l with
    | [] => .ok none
    | v :: r =>
      .ok (some ((match h with | some x => [(x, v)] | none => []) ++
        (match t with | some y => [(y, .«список» r)] | none => [])))
  | .«вариант» k bs, .«вариант» m fs =>
    if k = m then (do let e ← «связки» fs bs; pure (some e)) else .ok none
  | .«лит» v, w => .ok (if «равны» v w then some [] else none)
  | .«любое», _ => .ok (some [])
  | _, _ => .ok none

def «связанные» : «Образец» → List String
  | .«звено» h t => h.toList ++ t.toList
  | .«вариант» _ bs => bs.map (·.2)
  | _ => []

def «вставить» (xs ys : «Среда») : «Среда» := xs ++ ys

def «индекс?» : «Зн» → Option Int
  | .«число» d => «целое64?» d
  | _ => none

def «содержитЧасть» (t p : List Char) : Bool :=
  match t with
  | [] => p.isEmpty
  | c :: r => p.isPrefixOf (c :: r) || «содержитЧасть» r p

def «знакиЧисла» : Nat → List Char
  | 0 => []
  | n + 1 => «знакиЧисла» ((n + 1) / 10) ++ [Char.ofNat (48 + (n + 1) % 10)]
termination_by n => n
decreasing_by omega

def «десятичная» (n : Nat) : String := if n = 0 then "0" else String.ofList («знакиЧисла» n)

def «дробьВД64» (s : Bool) (p : Nat) (k : Int) : «Д64» :=
  if k ≥ 0 then (if p = 0 then .«кон» s 0 else «округлить» s (p * 10 ^ k.toNat * «шаг») 1)
  else (if p = 0 then .«кон» s 0 else «округлить» s (p * «шаг») (10 ^ (-k).toNat))

def «порядок10» (v : Nat) : Int :=
  let b := «биты» v
  let est : Int := ((b : Int) - 1075) * 30103 / 100000
  let up : Int → Bool := fun k =>
    if k ≥ 0 then 10 ^ k.toNat * «шаг» ≤ v else «шаг» ≤ v * 10 ^ (-k).toNat
  let k1 := if up (est + 1) then est + 1 else est
  let k2 := if up (k1 + 1) then k1 + 1 else k1
  let k3 := if up k2 then k2 else k2 - 1
  if up k3 then k3 else k3 - 1

def «цифрыТочности» (v : Nat) (p : Nat) : Nat × Int :=
  let e := «порядок10» v
  let k := e - (p : Int) + 1
  let n := if k ≥ 0 then «кБлижнему» v (10 ^ k.toNat * «шаг») else «кБлижнему» (v * 10 ^ (-k).toNat) «шаг»
  if n = 10 ^ p then (10 ^ (p - 1), k + 1) else (n, k)

def «кратчайшие» (v : Nat) : Nat → Nat → Nat × Int
  | 0, _ => «цифрыТочности» v 17
  | f + 1, p =>
    let c := «цифрыТочности» v p
    if «дробьВД64» false c.1 c.2 = .«кон» false v then c else «кратчайшие» v f (p + 1)

def «нули» (k : Nat) : String := String.ofList (List.replicate k '0')

def «записьJS» (d : List Char) (n : Int) : String :=
  let p := d.length
  let ds := String.ofList d
  if (p : Int) ≤ n ∧ n ≤ 21 then ds ++ «нули» (n - p).toNat
  else if 0 < n ∧ n ≤ 21 then String.ofList (d.take n.toNat) ++ "." ++ String.ofList (d.drop n.toNat)
  else if -6 < n ∧ n ≤ 0 then "0." ++ «нули» (-n).toNat ++ ds
  else
    let e := n - 1
    let es := (if e < 0 then "-" else "+") ++ «десятичная» e.natAbs
    match d with
    | [c] => String.singleton c ++ "e" ++ es
    | c :: r => String.singleton c ++ "." ++ String.ofList r ++ "e" ++ es
    | [] => "0"

def «строкаЧисла» : «Д64» → String
  | .«нечисло» => "NaN"
  | .«беск» s => if s then "-Infinity" else "Infinity"
  | .«кон» s v =>
    if v = 0 then "0" else
      let c := «кратчайшие» v 17 1
      let d := («десятичная» c.1).toList
      (if s then "-" else "") ++ «записьJS» d (c.2 + d.length)

def «вНат» (k : Int) : Nat := k.toNat

def «форма» (n : String) (vs : List «Зн») : «Исход» :=
  match n, vs with
  | "длина", [.«строка» s] => .ok (.«число» («изЦелого» s.length))
  | "длина", [.«список» l] => .ok (.«число» («изЦелого» l.length))
  | "длина", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "пусто", [.«строка» s] => .ok (.«признак» s.isEmpty)
  | "пусто", [.«список» l] => .ok (.«признак» l.isEmpty)
  | "пусто", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "голова", [.«список» (v :: _)] => .ok v
  | "голова", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "хвост", [.«список» (_ :: r)] => .ok (.«список» r)
  | "хвост", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "добавить", [v, .«список» l] => .ok (.«список» (l ++ [v]))
  | "добавить", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "приписать", [v, .«список» l] => .ok (.«список» (v :: l))
  | "приписать", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "элемент", [i, .«список» l] =>
    match «индекс?» i with
    | some k => if 1 ≤ k ∧ k ≤ l.length then .ok (l.getD (k.toNat - 1) .«ничто») else «беда» "FLANG_BUILTIN_ARGS"
    | none => «беда» "FLANG_BUILTIN_ARGS"
  | "элемент", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "символ", [i, .«строка» s] =>
    match «индекс?» i with
    | some k =>
      if 1 ≤ k ∧ k ≤ s.length then .ok (.«строка» (String.singleton (s.toList.getD (k.toNat - 1) ' ')))
      else «беда» "FLANG_BUILTIN_ARGS"
    | none => «беда» "FLANG_BUILTIN_ARGS"
  | "символ", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "символы", [.«строка» s] => .ok (.«список» (s.toList.map (fun c => .«строка» (String.singleton c))))
  | "символы", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "код символа", [.«строка» s] =>
    match s.toList with
    | c :: _ => .ok (.«число» («изЦелого» c.toNat))
    | [] => «беда» "FLANG_BUILTIN_ARGS"
  | "код символа", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "символ по коду", [i] =>
    match «индекс?» i with
    | some k =>
      if k < 0 ∨ 1114111 < k then «беда» "FLANG_BUILTIN_ARGS"
      else if 55296 ≤ k ∧ k ≤ 57343 then «беда» "FLANG_BUILTIN_ARGS"
      else .ok (.«строка» (String.singleton (Char.ofNat k.toNat)))
    | none => «беда» "FLANG_BUILTIN_ARGS"
  | "символ по коду", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "подстрока", [.«строка» s, a, b] =>
    match «индекс?» a, «индекс?» b with
    | some i, some j =>
      if i < 1 ∨ s.length + 1 < i then «беда» "FLANG_BUILTIN_ARGS"
      else if j < i - 1 ∨ s.length < j then «беда» "FLANG_BUILTIN_ARGS"
      else .ok (.«строка» (String.ofList ((s.toList.drop (i.toNat - 1)).take (j - i + 1).toNat)))
    | _, _ => «беда» "FLANG_BUILTIN_ARGS"
  | "подстрока", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "соединить", [.«список» l, .«строка» r] =>
    match l.mapM (fun v => match v with | .«строка» t => some t | _ => none) with
    | some ts => .ok (.«строка» (String.intercalate r ts))
    | none => «беда» "FLANG_BUILTIN_ARGS"
  | "соединить", [.«строка» a, .«строка» b] => .ok (.«строка» (a ++ b))
  | "соединить", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "разделить", [.«строка» s, .«строка» r] =>
    if r.isEmpty then «беда» "FLANG_BUILTIN_ARGS"
    else .ok (.«список» ((s.splitOn r).map .«строка»))
  | "разделить", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "содержит", [.«список» l, v] => .ok (.«признак» (l.any (fun w => «равны» w v)))
  | "содержит", [.«строка» s, .«строка» p] => .ok (.«признак» («содержитЧасть» s.toList p.toList))
  | "содержит", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "начинается с", [.«строка» s, .«строка» p] => .ok (.«признак» (s.startsWith p))
  | "начинается с", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "к строке", [.«строка» s] => .ok (.«строка» s)
  | "к строке", [.«число» d] => .ok (.«строка» («строкаЧисла» d))
  | "к строке", [.«признак» b] => .ok (.«строка» (if b then "да" else "нет"))
  | "к строке", [.«ничто»] => .ok (.«строка» "ничто")
  | "к строке", _ => «беда» "FLANG_BUILTIN_ARGS"
  | "остаток от", [.«число» a, .«число» b] => .ok (.«число» («остаток64» a b))
  | "остаток от", _ => «беда» "FLANG_BUILTIN_ARGS"
  | _, _ => «вне» n

def «привязать» (ps : List String) (vs : List «Зн») : «Среда» := ps.zip vs

def «свободныеПараметры» (f : «Функция») (cap : List (String × «Зн»)) : List String :=
  f.«параметры».filter (fun p => !(cap.any (fun b => b.1 = p)))

def «связатьСЗахватом» (f : «Функция») (cap : List (String × «Зн»)) (vs : List «Зн») : «Среда» :=
  f.«параметры».filterMap (fun p =>
    match cap.find? (fun b => b.1 = p) with
    | some b => some (p, b.2)
    | none => none) ++ «привязать» («свободныеПараметры» f cap) vs

def «проверитьПост» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») (v : «Зн») :
    List «Постусловие» → «Исход»
  | [] => .ok v
  | q :: r => do
    let c ← rec ((q.«связка», v) :: ρ) q.«выражение»
    match c with
    | .«признак» true => «проверитьПост» rec ρ v r
    | .«признак» false => «беда» q.«код»
    | _ => «беда» "FLANG_TYPE"

def «вызватьТело» (rec : «Среда» → «Выр» → «Исход») (f : «Функция») (ρ : «Среда») : «Исход» := do
  let v ← rec ρ f.«тело»
  «проверитьПост» rec ρ v f.«постусловия»

def «разобрать» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») (v : «Зн») :
    List («Образец» × «Выр») → «Исход»
  | [] => «беда» "FLANG_MATCH_NOT_EXHAUSTIVE"
  | (p, b) :: r =>
    match «подходит» p v with
    | .error e => .error e
    | .ok (some bs) => rec («вставить» bs ρ) b
    | .ok none => «разобрать» rec ρ v r

def «вычПоля» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») :
    List (String × «Выр») → Except «Сбой» (List (String × «Зн»))
  | [] => .ok []
  | (k, e) :: r => do
    let v ← rec ρ e
    let w ← «вычПоля» rec ρ r
    pure ((k, v) :: w)

def «вычВсе» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») :
    List «Выр» → Except «Сбой» (List «Зн»)
  | [] => .ok []
  | e :: r => do
    let v ← rec ρ e
    let w ← «вычВсе» rec ρ r
    pure (v :: w)

def «свернуть» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») (a x : String) (s : «Выр») :
    «Зн» → List «Зн» → «Исход»
  | acc, [] => .ok acc
  | acc, v :: r => do
    let acc' ← rec ((a, acc) :: (x, v) :: ρ) s
    «свернуть» rec ρ a x s acc' r

def «образы» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») (x : String) (s : «Выр») :
    List «Зн» → Except «Сбой» (List «Зн»)
  | [] => .ok []
  | v :: r => do
    let w ← rec ((x, v) :: ρ) s
    let ws ← «образы» rec ρ x s r
    pure (w :: ws)

def «отбор» (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») (x : String) (s : «Выр») :
    List «Зн» → Except «Сбой» (List «Зн»)
  | [] => .ok []
  | v :: r => do
    let c ← rec ((x, v) :: ρ) s
    let ws ← «отбор» rec ρ x s r
    match c with
    | .«признак» true => pure (v :: ws)
    | .«признак» false => pure ws
    | _ => «беда» "FLANG_TYPE"

def «шаг» (P : «Программа») (rec : «Среда» → «Выр» → «Исход») (ρ : «Среда») : «Выр» → «Исход»
  | .«лит» v => .ok v
  | .«имя» x =>
    match «найти» x ρ with
    | some v => .ok v
    | none => «беда» "FLANG_NAME"
  | .«двучлен» op a b => do
    let x ← rec ρ a
    let y ← rec ρ b
    «двучлен» op x y
  | .«если» c t e => do
    let u ← rec ρ c
    match u with
    | .«признак» true => rec ρ t
    | .«признак» false => rec ρ e
    | _ => «беда» "FLANG_TYPE"
  | .«пусть» x v b => do
    let w ← rec ρ v
    rec ((x, w) :: ρ) b
  | .«вызов» f args => do
    let vs ← «вычВсе» rec ρ args
    match «функцияПрограммы» P f with
    | some g =>
      if g.«параметры».length = vs.length then «вызватьТело» rec g («привязать» g.«параметры» vs)
      else «беда» "FLANG_ARITY"
    | none => «вне» f
  | .«разбор» t cs => do
    let v ← rec ρ t
    «разобрать» rec ρ v cs
  | .«свёртка» l n a x s => do
    let lv ← rec ρ l
    let nv ← rec ρ n
    match lv with
    | .«список» xs => «свернуть» rec ρ a x s nv xs
    | _ => «беда» "FLANG_TYPE"
  | .«отобразить» l x s => do
    let lv ← rec ρ l
    match lv with
    | .«список» xs => do
      let ws ← «образы» rec ρ x s xs
      pure (.«список» ws)
    | _ => «беда» "FLANG_TYPE"
  | .«отфильтровать» l x s => do
    let lv ← rec ρ l
    match lv with
    | .«список» xs => do
      let ws ← «отбор» rec ρ x s xs
      pure (.«список» ws)
    | _ => «беда» "FLANG_TYPE"
  | .«список» es => do
    let vs ← «вычВсе» rec ρ es
    pure (.«список» vs)
  | .«запись» fs => do
    let vs ← «вычПоля» rec ρ fs
    pure (.«запись» vs)
  | .«конструктор» k fs => do
    let vs ← «вычПоля» rec ρ fs
    pure (.«вариант» k vs)
  | .«поле» t p => do
    let v ← rec ρ t
    match v with
    | .«запись» fs =>
      match «найти» p fs with
      | some w => pure w
      | none => «беда» "FLANG_FIELD"
    | .«вариант» _ fs =>
      match «найти» p fs with
      | some w => pure w
      | none => «беда» "FLANG_FIELD"
    | _ => «беда» "FLANG_FIELD"
  | .«форма» n args => do
    let vs ← «вычВсе» rec ρ args
    «форма» n vs
  | .«ссылка» f fs => do
    let vs ← «вычПоля» rec ρ fs
    pure (.«вариант» («тег» f (vs.map (·.1))) vs)
  | .«применить» fe args => do
    let fv ← rec ρ fe
    let vs ← «вычВсе» rec ρ args
    match fv with
    | .«вариант» f cap =>
      match «функцияТега» P f with
      | some g =>
        if («свободныеПараметры» g cap).length = vs.length then «вызватьТело» rec g («связатьСЗахватом» g cap vs)
        else «беда» "FLANG_ARITY"
      | none => «вне» f
    | _ => «беда» "FLANG_TYPE"

def «выч» (P : «Программа») : Nat → «Среда» → «Выр» → «Исход»
  | 0, _, _ => .error .«топливо»
  | n + 1, ρ, e => «шаг» P («выч» P n) ρ e

end «Эталон»
