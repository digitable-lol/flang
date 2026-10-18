import Semantics.Json

namespace «Эталон»

open Lean

inductive «Т» where
  | «ч» (d : «Д64»)
  | «п» (b : Bool)
  | «с» (s : String)
  | «имя» (x : String)
  | «рез» (k : Nat)
  | «оп» (op : String) (args : List «Т»)
deriving Repr, Inhabited

inductive «Д» where
  | «знач» (t : «Т»)
  | «отказ» (k : String)
  | «если» (c : «Т») (a b : «Д»)
  | «вызов» (f : String) (args : List «Т») (k : Nat) (rest : «Д»)
deriving Repr, Inhabited

mutual
def «равныТ» : «Т» → «Т» → Bool
  | .«ч» a, .«ч» b => decide (a = b)
  | .«п» a, .«п» b => a == b
  | .«с» a, .«с» b => a == b
  | .«имя» a, .«имя» b => a == b
  | .«рез» a, .«рез» b => a == b
  | .«оп» o as, .«оп» p bs => o == p && «равныСпискиТ» as bs
  | _, _ => false
def «равныСпискиТ» : List «Т» → List «Т» → Bool
  | [], [] => true
  | a :: as, b :: bs => «равныТ» a b && «равныСпискиТ» as bs
  | _, _ => false
end

def «равныД» : «Д» → «Д» → Bool
  | .«знач» a, .«знач» b => «равныТ» a b
  | .«отказ» a, .«отказ» b => a == b
  | .«если» c a1 b1, .«если» d a2 b2 => «равныТ» c d && «равныД» a1 a2 && «равныД» b1 b2
  | .«вызов» f as k r, .«вызов» g bs m s => f == g && «равныСпискиТ» as bs && k == m && «равныД» r s
  | _, _ => false

partial def «текстТ» : «Т» → String
  | .«ч» d => «строкаЧисла» d
  | .«п» b => if b then "да" else "нет"
  | .«с» s => "строка из " ++ toString s.length ++ " знаков"
  | .«имя» x => x
  | .«рез» k => "р" ++ toString k
  | .«оп» o as => o ++ "(" ++ ", ".intercalate (as.map «текстТ») ++ ")"

partial def «текстД» : «Д» → String
  | .«знач» t => «текстТ» t
  | .«отказ» k => "отказ " ++ k
  | .«если» c a b => "если " ++ «текстТ» c ++ " то {" ++ «текстД» a ++ "} иначе {" ++ «текстД» b ++ "}"
  | .«вызов» f as k r => "р" ++ toString k ++ " = «" ++ f ++ "»(" ++ ", ".intercalate (as.map «текстТ») ++ "); " ++
      «текстД» r

def «операцииИсходника» : List String :=
  ["add", "sub", "mul", "div", "mod", "lt", "lte", "gt", "gte", "eq", "neq"]

def «цифра?» (c : Char) : Bool := '0' ≤ c && c ≤ '9'

def «цифрыВНат» (cs : List Char) : Nat := cs.foldl (fun n c => n * 10 + (c.toNat - '0'.toNat)) 0

def «читатьЧисло» (t : String) : Option «Д64» :=
  let neg := t.startsWith "-"
  let body := if neg then (t.drop 1).toString else t
  if body = "Infinity" then some (.«беск» neg)
  else if body = "NaN" then some .«нечисло»
  else
    let parts := body.splitOn "e"
    let mant := parts.headD ""
    let ex := (parts.drop 1).headD "0"
    let mp := mant.splitOn "."
    let whole := (mp.headD "").toList
    let frac := ((mp.drop 1).headD "").toList
    let exNeg := ex.startsWith "-"
    let exDigits := ((if exNeg || ex.startsWith "+" then (ex.drop 1).toString else ex)).toList
    if whole.all «цифра?» && frac.all «цифра?» && exDigits.all «цифра?» && !(whole ++ frac).isEmpty then
      let p := «цифрыВНат» (whole ++ frac)
      let e : Int := (if exNeg then -(«цифрыВНат» exDigits : Int) else («цифрыВНат» exDigits : Int)) - frac.length
      some («дробьВД64» neg p e)
    else none

abbrev «Сим» := Except String «Д»

partial def «сим» (P : «Программа») (ρ : List (String × «Т»)) (n : Nat) (e : «Выр»)
    (k : «Т» → Nat → «Сим») : «Сим» :=
  match e with
  | .«лит» (.«число» d) => k (.«ч» d) n
  | .«лит» (.«признак» b) => k (.«п» b) n
  | .«лит» (.«строка» s) => k (.«с» s) n
  | .«лит» _ => .error "литерал не числа, не признака и не строки"
  | .«имя» x =>
    match «найти» x ρ with
    | some t => k t n
    | none => .error ("имя «" ++ x ++ "» не связано")
  | .«двучлен» "percent" a b =>
    «сим» P ρ n a (fun ta n1 => «сим» P ρ n1 b (fun tb n2 =>
      k (.«оп» "mul" [.«оп» "div" [ta, .«ч» («изЦелого» 100)], tb]) n2))
  | .«двучлен» op a b =>
    if «операцииИсходника».contains op then
      «сим» P ρ n a (fun ta n1 => «сим» P ρ n1 b (fun tb n2 => k (.«оп» op [ta, tb]) n2))
    else .error ("операция " ++ op)
  | .«если» c t f =>
    «сим» P ρ n c (fun tc n1 => do
      let a ← «сим» P ρ n1 t k
      let b ← «сим» P ρ n1 f k
      pure (.«если» tc a b))
  | .«пусть» x v b => «сим» P ρ n v (fun tv n1 => «сим» P ((x, tv) :: ρ) n1 b k)
  | .«вызов» f args =>
    match «функцияПрограммы» P f with
    | none => .error ("вызов вне модуля «" ++ f ++ "»")
    | some g =>
      if g.«параметры».length ≠ args.length then .error "число доводов"
      else «симВсе» P ρ n args [] (fun ts n1 => do
        let r ← k (.«рез» n1) (n1 + 1)
        pure (.«вызов» f ts n1 r))
  | .«разбор» t cs => «сим» P ρ n t (fun tt n1 => «симСлучаи» P ρ n1 tt cs k)
  | .«свёртка» _ _ _ _ _ => .error "свёртка"
  | .«отобразить» _ _ _ => .error "отобразить"
  | .«отфильтровать» _ _ _ => .error "отфильтровать"
  | .«список» _ => .error "список"
  | .«запись» _ => .error "запись"
  | .«конструктор» v [] => k (.«оп» ("variant:" ++ v) []) n
  | .«конструктор» _ _ => .error "конструктор с полями"
  | .«поле» t p => «сим» P ρ n t (fun tt n1 => k (.«оп» ("field:" ++ p) [tt]) n1)
  | .«форма» f _ => .error ("форма " ++ f)
  | .«ссылка» _ _ => .error "значение-функция"
  | .«применить» _ _ => .error "применение значения-функции"
where
  «симСлучаи» (P : «Программа») (ρ : List (String × «Т»)) (n : Nat) (tt : «Т») :
      List («Образец» × «Выр») → («Т» → Nat → «Сим») → «Сим»
    | [], _ => .ok (.«отказ» "FLANG_MATCH_NOT_EXHAUSTIVE")
    | (.«любое», b) :: _, k => «сим» P ρ n b k
    | (.«вариант» v bs, b) :: r, k => do
      let ρ2 := bs.map (fun (f, x) => (x, «Т».«оп» ("field:" ++ f) [tt])) ++ ρ
      let yes ← «сим» P ρ2 n b k
      let no ← «симСлучаи» P ρ n tt r k
      pure (.«если» (.«оп» ("is:" ++ v) [tt]) yes no)
    | (_, _) :: _, _ => .error "образец не варианта"
  «симВсе» (P : «Программа») (ρ : List (String × «Т»)) (n : Nat) : List «Выр» → List «Т» →
      (List «Т» → Nat → «Сим») → «Сим»
    | [], acc, k => k acc.reverse n
    | e :: r, acc, k => «сим» P ρ n e (fun t n1 => «симВсе» P ρ n1 r (t :: acc) k)

structure «Условие» where
  «имя» : String
  «код» : String
  «связка» : String
  «выражение» : «Выр»

def «условияJson» (f : Json) (key : String) (code : String) : List «Условие» :=
  («массив» f key).map (fun q =>
    { «имя» := «строка?» q "name"
      «код» := («имя?» q "code").getD code
      «связка» := («имя?» q "bind").getD "результат"
      «выражение» := «вырJson» ((«поле?» q "expr").getD .null) })

partial def «симПосле» (P : «Программа») (ρ : List (String × «Т») ) (posts : List «Условие») (t : «Т»)
    (n : Nat) : «Сим» :=
  match posts with
  | [] => .ok (.«знач» t)
  | q :: r => «сим» P ((q.«связка», t) :: ρ) n q.«выражение» (fun c n1 => do
      let rest ← «симПосле» P ρ r t n1
      pure (.«если» c rest (.«отказ» q.«код»)))

partial def «симДо» (P : «Программа») (ρ : List (String × «Т»)) (pres : List «Условие») (n : Nat)
    (body : Nat → «Сим») : «Сим» :=
  match pres with
  | [] => body n
  | q :: r => «сим» P ρ n q.«выражение» (fun c n1 => do
      let rest ← «симДо» P ρ r n1 body
      pure (.«если» c rest (.«отказ» q.«код»)))

def «деревоИсходника» (P : «Программа») (params : List String) (pres posts : List «Условие»)
    (body : «Выр») : «Сим» :=
  let ρ := params.map (fun p => (p, .«имя» p))
  «симДо» P ρ pres 0 (fun n => «сим» P ρ n body (fun t n1 => «симПосле» P ρ posts t n1))

inductive «Лекс» where
  | «слово» (s : String)
  | «число» (s : String)
  | «строка» (s : String)
  | «знак» (s : String)
deriving Repr, Inhabited, BEq

def «буква?» (c : Char) : Bool := c.isAlpha || c = '_' || c.toNat ≥ 128

def «двойные» : List String := ["->", "!=", "==", ">=", "<=", "&&", "||", "++", "+=", "-="]

partial def «лексемы» : List Char → List «Лекс» → List «Лекс»
  | [], acc => acc.reverse
  | '/' :: '*' :: r, acc =>
    let rec skip : List Char → List Char
      | '*' :: '/' :: q => q
      | _ :: q => skip q
      | [] => []
    «лексемы» (skip r) acc
  | '/' :: '/' :: r, acc => «лексемы» (r.dropWhile (· ≠ '\n')) acc
  | '"' :: r, acc =>
    let rec str : List Char → List Char → List Char × List Char
      | '\\' :: c :: q, s => str q (c :: '\\' :: s)
      | '"' :: q, s => (s.reverse, q)
      | c :: q, s => str q (c :: s)
      | [], s => (s.reverse, [])
    let (s, q) := str r []
    «лексемы» q (.«строка» (String.ofList s) :: acc)
  | c :: r, acc =>
    if c.isWhitespace then «лексемы» r acc
    else if «буква?» c then
      let w := (c :: r).takeWhile (fun d => «буква?» d || d.isDigit)
      «лексемы» ((c :: r).drop w.length) (.«слово» (String.ofList w) :: acc)
    else if c.isDigit then
      let rec num : List Char → List Char → List Char × List Char
        | d :: e :: q, s => if (d = 'e' || d = 'E') && (e = '+' || e = '-') then num q (e :: d :: s)
            else if d.isDigit || d = '.' || d = 'e' || d = 'E' then num (e :: q) (d :: s) else (s.reverse, d :: e :: q)
        | [d], s => if d.isDigit || d = '.' then ((d :: s).reverse, []) else (s.reverse, [d])
        | [], s => (s.reverse, [])
      let (s, q) := num (c :: r) []
      «лексемы» q (.«число» (String.ofList s) :: acc)
    else
      match r with
      | d :: q =>
        let two := String.ofList [c, d]
        if «двойные».contains two then «лексемы» q (.«знак» two :: acc) else «лексемы» r (.«знак» (String.singleton c) :: acc)
      | [] => «лексемы» r (.«знак» (String.singleton c) :: acc)

structure «ФункцияC» where
  «имя» : String
  «параметры» : List String
  «тело» : List «Лекс»
deriving Inhabited

def «знак?» (l : «Лекс») (s : String) : Bool := l == .«знак» s

partial def «доПары» (open_ close : String) : Nat → List «Лекс» → List «Лекс» → Option (List «Лекс» × List «Лекс»)
  | _, [], _ => none
  | d, l :: r, acc =>
    if «знак?» l close then
      if d = 0 then some (acc.reverse, r) else «доПары» open_ close (d - 1) r (l :: acc)
    else if «знак?» l open_ then «доПары» open_ close (d + 1) r (l :: acc)
    else «доПары» open_ close d r (l :: acc)

def «разрезать» (ls : List «Лекс») : List (List «Лекс») :=
  let step := fun (acc : List (List «Лекс») × List «Лекс» × Nat) (l : «Лекс») =>
    let (done, cur, d) := acc
    if «знак?» l "," && d = 0 then (cur.reverse :: done, [], d)
    else if «знак?» l "(" || «знак?» l "[" then (done, l :: cur, d + 1)
    else if «знак?» l ")" || «знак?» l "]" then (done, l :: cur, d - 1)
    else (done, l :: cur, d)
  let (done, cur, _) := ls.foldl step ([], [], 0)
  (cur.reverse :: done).reverse

def «имяПараметра» (ls : List «Лекс») : Option String :=
  match ls.reverse with
  | .«слово» x :: .«слово» "fl_value" :: _ => some x
  | _ => none

partial def «функцииC» : List «Лекс» → List «ФункцияC» → List «ФункцияC»
  | .«слово» "fl_status" :: .«слово» f :: .«знак» "(" :: r, acc =>
    match «доПары» "(" ")" 0 r [] with
    | some (ps, .«знак» "{" :: q) =>
      match «доПары» "{" "}" 0 q [] with
      | some (body, rest) =>
        let params := («разрезать» ps).filterMap «имяПараметра»
        «функцииC» rest ({ «имя» := f, «параметры» := params, «тело» := body } :: acc)
      | none => acc.reverse
    | some (_, q) => «функцииC» q acc
    | none => acc.reverse
  | _ :: r, acc => «функцииC» r acc
  | [], acc => acc.reverse

structure «СредаC» where
  «знач» : List (String × «Т»)
  «числа» : List String
  «функции» : List (String × String)
  «числовые» : List String

def «опC» : List (String × String) :=
  [("+", "add"), ("-", "sub"), ("*", "mul"), ("/", "div"), ("<", "lt"), ("<=", "lte"), (">", "gt"), (">=", "gte"),
    ("==", "eq64"), ("!=", "ne64"), ("&&", "and"), ("||", "or")]

def «уровни» : List (List String) := [["||"], ["&&"], ["==", "!="], ["<", "<=", ">", ">="], ["+", "-"], ["*", "/"]]

def «помощники» : List String := ["add", "sub", "mul", "div", "mod", "percent", "lt", "lte", "gt", "gte", "concat"]

def «числовой?» (σ : «СредаC») : «Т» → Bool
  | .«ч» _ => true
  | .«имя» x => σ.«числа».contains x
  | .«оп» o _ => ["add", "sub", "mul", "div", "mod"].contains o
  | .«рез» _ => false
  | .«п» _ => false
  | .«с» _ => false

partial def «разэкранитьЗнаки» : List Char → List Char → List Char
  | '\\' :: 'n' :: r, acc => «разэкранитьЗнаки» r ('\n' :: acc)
  | '\\' :: 't' :: r, acc => «разэкранитьЗнаки» r ('\t' :: acc)
  | '\\' :: 'r' :: r, acc => «разэкранитьЗнаки» r ('\r' :: acc)
  | '\\' :: 'x' :: r, acc =>
    let ds := r.takeWhile (fun c => c.isDigit || ('a' ≤ c && c ≤ 'f') || ('A' ≤ c && c ≤ 'F'))
    let v := ds.foldl (fun n c => n * 16 + (if c.isDigit then c.toNat - 48 else (c.toLower.toNat - 87))) 0
    «разэкранитьЗнаки» (r.drop ds.length) (Char.ofNat v :: acc)
  | '\\' :: a :: r, acc =>
    if '0' ≤ a && a ≤ '7' then
      let ds := (a :: r).take 3 |>.takeWhile (fun c => '0' ≤ c && c ≤ '7')
      let v := ds.foldl (fun n c => n * 8 + (c.toNat - 48)) 0
      «разэкранитьЗнаки» ((a :: r).drop ds.length) (Char.ofNat v :: acc)
    else
      let e := if a = 'a' then Char.ofNat 7 else if a = 'b' then Char.ofNat 8 else if a = 'f' then Char.ofNat 12
        else if a = 'v' then Char.ofNat 11 else a
      «разэкранитьЗнаки» r (e :: acc)
  | c :: r, acc => «разэкранитьЗнаки» r (c :: acc)
  | [], acc => acc.reverse

def «разэкранить» (s : String) : String := String.ofList («разэкранитьЗнаки» s.toList [])

mutual
partial def «выражениеC» (σ : «СредаC») (ls : List «Лекс») : Except String «Т» :=
  «уровень» σ «уровни» ls
partial def «уровень» (σ : «СредаC») : List (List String) → List «Лекс» → Except String «Т»
  | [], ls => «одночлен» σ ls
  | ops :: rest, ls =>
    let operand := fun (l : «Лекс») => match l with
      | .«знак» s => s = ")" || s = "]"
      | _ => true
    let step := fun (acc : Nat × Int × Option Nat × Option «Лекс») (l : «Лекс») =>
      let (i, d, best, prev) := acc
      let d2 : Int := match l with
        | .«знак» "(" => d + 1
        | .«знак» "[" => d + 1
        | .«знак» ")" => d - 1
        | .«знак» "]" => d - 1
        | _ => d
      let hit := match l, prev with
        | .«знак» s, some q => d = 0 && ops.contains s && operand q
        | _, _ => false
      (i + 1, d2, if hit then some i else best, some l)
    let (_, _, best, _) := ls.foldl step (0, 0, none, none)
    match best with
    | none => «уровень» σ rest ls
    | some i =>
      match ls[i]? with
      | some (.«знак» s) => do
        let ta ← «уровень» σ (ops :: rest) (ls.take i)
        let tb ← «уровень» σ rest (ls.drop (i + 1))
        match «найти» s «опC» with
        | some o => pure (.«оп» o [ta, tb])
        | none => .error ("знак " ++ s)
      | _ => .error "разрез"
partial def «одночлен» (σ : «СредаC») (ls : List «Лекс») : Except String «Т» :=
  match ls with
  | [.«строка» v] => .ok (.«с» («разэкранить» v))
  | [.«число» s] =>
    match «читатьЧисло» s with
    | some d => .ok (.«ч» d)
    | none => .error ("число " ++ s)
  | .«знак» "-" :: [.«число» s] =>
    match «читатьЧисло» ("-" ++ s) with
    | some d => .ok (.«ч» d)
    | none => .error ("число -" ++ s)
  | .«знак» "!" :: r => do
    let t ← «одночлен» σ r
    match t with
    | .«оп» "eq" as => pure (.«оп» "neq" as)
    | _ => pure (.«оп» "not" [t])
  | .«знак» "(" :: r =>
    match «доПары» "(" ")" 0 r [] with
    | some (inner, []) => «выражениеC» σ inner
    | _ => .error "скобки"
  | [.«слово» "fl_flag", .«знак» "(", .«слово» "true", .«знак» ")"] => .ok (.«п» true)
  | [.«слово» "fl_flag", .«знак» "(", .«слово» "false", .«знак» ")"] => .ok (.«п» false)
  | [.«слово» "true"] => .ok (.«п» true)
  | [.«слово» "false"] => .ok (.«п» false)
  | [.«слово» x] =>
    match «найти» x σ.«знач» with
    | some t => .ok t
    | none => .error ("имя C " ++ x)
  | [.«слово» x, .«знак» ".", .«слово» "as", .«знак» ".", .«слово» "number"] => do
    let t ← «одночлен» σ [.«слово» x]
    if σ.«числа».contains x || «числовой?» σ t then pure t else .error ("не число " ++ x)
  | [.«слово» "args", .«знак» "[", .«число» i, .«знак» "]"] =>
    «одночлен» σ [.«слово» ("args[" ++ i ++ "]")]
  | [.«слово» "args", .«знак» "[", .«число» i, .«знак» "]", .«знак» ".", .«слово» "as", .«знак» ".",
      .«слово» "number"] =>
    «одночлен» σ [.«слово» ("args[" ++ i ++ "]"), .«знак» ".", .«слово» "as", .«знак» ".", .«слово» "number"]
  | .«слово» f :: .«знак» "(" :: r =>
    match «доПары» "(" ")" 0 r [] with
    | some (inner, []) => do
      let args ← («разрезать» inner).mapM («выражениеC» σ)
      match f, args with
      | "fl_number", [t] => pure t
      | "fl_flag", [t] => pure t
      | "fl_equal", [a, b] => pure (.«оп» "eq" [a, b])
      | "fmod", [a, b] => pure (.«оп» "mod" [a, b])
      | "fl_variant_is", [a, .«с» v] => pure (.«оп» ("is:" ++ v) [a])
      | _, _ => .error ("вызов C " ++ f)
    | _ => .error "скобки вызова"
  | _ => .error "выражение C"
end

def «поЛексемам» (ls : List «Лекс») : String :=
  " ".intercalate (ls.map (fun l => match l with
    | .«слово» s => s
    | .«число» s => s
    | .«строка» s => "\"" ++ s ++ "\""
    | .«знак» s => s))

partial def «доТочки» : List «Лекс» → List «Лекс» → Option (List «Лекс» × List «Лекс»)
  | [], _ => none
  | l :: r, acc => if «знак?» l ";" then some (acc.reverse, r) else «доТочки» r (l :: acc)

def «стражЧисла» (σ : «СредаC») (g : List «Лекс») : Bool :=
  let parts := (g.foldl (fun (acc : List (List «Лекс»)) l =>
    if «знак?» l "||" then [] :: acc else match acc with
      | c :: r => (c ++ [l]) :: r
      | [] => [[l]]) [[]])
  parts.all (fun p => match p with
    | [.«слово» x, .«знак» ".", .«слово» "tag", .«знак» "!=", .«слово» "FL_NUMBER"] =>
      σ.«числа».contains x || (match «найти» x σ.«знач» with
        | some t => «числовой?» σ t
        | none => false)
    | [.«слово» "args", .«знак» "[", .«число» i, .«знак» "]", .«знак» ".", .«слово» "tag", .«знак» "!=",
        .«слово» "FL_NUMBER"] =>
      σ.«числа».contains ("args[" ++ i ++ "]")
    | _ => false)

def «кодОтказа» (ls : List «Лекс») : Option String :=
  match ls with
  | .«слово» "return" :: .«слово» "fl_fail" :: .«знак» "(" :: .«слово» "ctx" :: .«знак» "," :: .«слово» "error" ::
      .«знак» "," :: .«строка» k :: _ => some k
  | .«слово» "return" :: .«слово» "fl_fail" :: .«знак» "(" :: .«слово» "ctx" :: .«знак» "," :: .«слово» "error" ::
      .«знак» "," :: .«слово» m :: _ =>
    if m.startsWith "FL_CODE_" then some ("FLANG_" ++ (m.drop 8).toString) else none
  | _ => none

partial def «исполнить» (σ : «СредаC») (n : Nat) (ls : List «Лекс») : Except String «Д» :=
  match ls with
  | [] => .error "тело кончилось без возврата"
  | .«знак» "*" :: .«слово» "result" :: .«знак» "=" :: r =>
    match «доТочки» r [] with
    | some (e, .«слово» "return" :: .«слово» "FL_OK" :: .«знак» ";" :: _) => do
      let t ← «выражениеC» σ e
      pure (.«знач» t)
    | _ => .error "возврат"
  | .«слово» "return" :: .«слово» "fl_match_fail" :: _ => .ok (.«отказ» "FLANG_MATCH_NOT_EXHAUSTIVE")
  | .«слово» "return" :: .«слово» f :: .«знак» "(" :: r =>
    match «найти» f σ.«функции», «доПары» "(" ")" 0 r [] with
    | some g, some (inner, _) =>
      let parts := «разрезать» inner
      let args := (parts.drop 1).take (parts.length - 3)
      match args.mapM («выражениеC» σ) with
      | .ok ts => .ok (.«вызов» g ts n (.«знач» (.«рез» n)))
      | .error m => .error m
    | _, _ =>
      match «кодОтказа» ls with
      | some k => .ok (.«отказ» k)
      | none => .error ("возврат вызовом " ++ f)
  | .«знак» "(" :: .«слово» "void" :: .«знак» ")" :: r =>
    match «доТочки» r [] with
    | some (_, q) => «исполнить» σ n q
    | none => .error "(void)"
  | .«слово» "if" :: .«знак» "(" :: r =>
    match «доПары» "(" ")" 0 r [] with
    | none => .error "if"
    | some (c, .«знак» "{" :: q) =>
      match «доПары» "{" "}" 0 q [] with
      | none => .error "блок if"
      | some (a, .«слово» "else" :: .«слово» "if" :: q2) =>
        match «доКонцаЕсли» q2 with
        | some (b, rest) => «ветвь» σ n c a b rest
        | none => .error "else if"
      | some (a, .«слово» "else" :: .«знак» "{" :: q2) =>
        match «доПары» "{" "}" 0 q2 [] with
        | some (b, rest) => «ветвь» σ n c a b rest
        | none => .error "блок else"
      | some (a, rest) => «ветвь» σ n c a [] rest
    | some (g, .«слово» "FL_TRY" :: .«знак» "(" :: .«слово» h :: q) =>
      if (h = "fl_not_numbers" || h = "fl_not_order") && «стражЧисла» σ g then
        match «доТочки» q [] with
        | some (_, rest) => «исполнить» σ n rest
        | none => .error "страж"
      else .error ("страж " ++ «поЛексемам» g)
    | some _ => .error "if без блока"
  | .«слово» "bool" :: .«слово» x :: .«знак» "=" :: .«слово» "false" :: .«знак» ";" :: r =>
    «исполнить» { σ with «знач» := (x, .«п» false) :: σ.«знач» } n r
  | .«слово» "fl_value" :: .«слово» x :: .«знак» "=" :: .«слово» "fl_nothing" :: .«знак» "(" :: .«знак» ")" ::
      .«знак» ";" :: r =>
    «исполнить» { σ with «знач» := (x, .«оп» "ничто" []) :: σ.«знач» } n r
  | .«слово» "const" :: .«слово» "fl_value" :: .«слово» x :: .«знак» "=" :: r
  | .«слово» "fl_value" :: .«слово» x :: .«знак» "=" :: r
  | .«слово» x :: .«знак» "=" :: r =>
    match «доТочки» r [] with
    | some (e, q) => do
      let t ← «выражениеC» σ e
      «исполнить» { σ with «знач» := (x, t) :: σ.«знач» } n q
    | none => .error "присвоение"
  | .«слово» "FL_TRY" :: .«знак» "(" :: .«слово» h :: .«знак» "(" :: r =>
    match «доПары» "(" ")" 0 r [] with
    | none => .error "FL_TRY"
    | some (inner, .«знак» ")" :: .«знак» ";" :: q) =>
      let parts := «разрезать» inner
      «попытка» σ n h parts q
    | some _ => .error "FL_TRY без точки"
  | l :: _ => .error ("оператор C " ++ «поЛексемам» [l])
where
  «доКонцаЕсли» (q : List «Лекс») : Option (List «Лекс» × List «Лекс») :=
    match q with
    | .«знак» "(" :: r =>
      match «доПары» "(" ")" 0 r [] with
      | some (c, .«знак» "{" :: q2) =>
        match «доПары» "{" "}" 0 q2 [] with
        | some (a, .«слово» "else" :: .«слово» "if" :: q3) =>
          match «доКонцаЕсли» q3 with
          | some (b, rest) => some ([.«слово» "if", .«знак» "("] ++ c ++ [.«знак» ")", .«знак» "{"] ++ a ++
              [.«знак» "}", .«слово» "else", .«знак» "{"] ++ b ++ [.«знак» "}"], rest)
          | none => none
        | some (a, .«слово» "else" :: .«знак» "{" :: q3) =>
          match «доПары» "{" "}" 0 q3 [] with
          | some (b, rest) => some ([.«слово» "if", .«знак» "("] ++ c ++ [.«знак» ")", .«знак» "{"] ++ a ++
              [.«знак» "}", .«слово» "else", .«знак» "{"] ++ b ++ [.«знак» "}"], rest)
          | none => none
        | some (a, rest) => some ([.«слово» "if", .«знак» "("] ++ c ++ [.«знак» ")", .«знак» "{"] ++ a ++
              [.«знак» "}"], rest)
        | none => none
      | _ => none
    | _ => none
  «ветвь» (σ : «СредаC») (n : Nat) (c a b rest : List «Лекс») : Except String «Д» := do
    let tc ← «выражениеC» σ c
    let ta ← «исполнить» σ n (a ++ rest)
    let tb ← «исполнить» σ n (b ++ rest)
    pure (.«если» tc ta tb)
  «попытка» (σ : «СредаC») (n : Nat) (h : String) (parts : List (List «Лекс»)) (q : List «Лекс») :
      Except String «Д» :=
    let target := fun (p : List «Лекс») => match p with
      | [.«знак» "&", .«слово» x] => some x
      | _ => none
    if h = "fl_variant_field" || h = "fl_field_get" then
      match parts with
      | [_, a, [.«строка» fld], p, _] =>
        match target p with
        | some x => do
          let t ← «выражениеC» σ a
          «исполнить» { σ with «знач» := (x, .«оп» ("field:" ++ «разэкранить» fld) [t]) :: σ.«знач» } n q
        | none => .error h
      | _ => .error h
    else if h = "fl_cond" then
      match parts with
      | [_, e, p, _] =>
        match target p with
        | some x => do
          let t ← «выражениеC» σ e
          «исполнить» { σ with «знач» := (x, t) :: σ.«знач» } n q
        | none => .error "fl_cond"
      | _ => .error "fl_cond"
    else if h = "fl_post" || h = "fl_pre" then
      match parts with
      | [_, e, [.«строка» name], _, p, _] =>
        match target p with
        | some x => do
          let t ← «выражениеC» σ e
          match q with
          | .«слово» "if" :: .«знак» "(" :: .«знак» "!" :: .«слово» y :: .«знак» ")" :: .«знак» "{" :: q2 =>
            match «доПары» "{" "}" 0 q2 [] with
            | some (fail, rest) =>
              if y ≠ x then .error "проверка не своего признака" else
              match «кодОтказа» fail with
              | some k => do
                let _ := name
                let ok ← «исполнить» σ n rest
                pure (.«если» t ok (.«отказ» k))
              | none => .error "отказ проверки"
            | none => .error "блок проверки"
          | _ => .error "проверка без отказа"
        | none => .error h
      | _ => .error h
    else
      let op := if h.startsWith "fl_" then (h.drop 3).toString else h
      match «найти» h σ.«функции» with
      | some g =>
        if g.startsWith "variant:" then
          match parts with
          | [_, p, _] =>
            match target p with
            | some x => «исполнить» { σ with «знач» := (x, .«оп» g []) :: σ.«знач» } n q
            | none => .error h
          | _ => .error h
        else
        match parts.reverse with
        | _ :: p :: argsRev =>
          match target p with
          | some x => do
            let ts ← (argsRev.reverse.drop 1).mapM («выражениеC» σ)
            let nums := if σ.«числовые».contains g then x :: σ.«числа» else σ.«числа»
            let σ2 : «СредаC» := { σ with «знач» := (x, .«рез» n) :: σ.«знач», «числа» := nums }
            let r ← «исполнить» σ2 (n + 1) q
            pure (.«вызов» g ts n r)
          | none => .error "вызов без места"
        | _ => .error "вызов"
      | none =>
        if «помощники».contains op then
          match parts with
          | [_, a, b, p, _] =>
            match target p with
            | some x => do
              let ta ← «выражениеC» σ a
              let tb ← «выражениеC» σ b
              let t := if op = "percent" then .«оп» "mul" [.«оп» "div" [ta, .«ч» («изЦелого» 100)], tb] else .«оп» op [ta, tb]
              «исполнить» { σ with «знач» := (x, t) :: σ.«знач» } n q
            | none => .error h
          | _ => .error h
        else .error ("помощник " ++ h)

end «Эталон»
