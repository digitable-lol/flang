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
  u.«до».endsWith "вариант " || u.«до».endsWith "случай " || u.«до».endsWith "."

def «Исх».«зовы» (s : «Исх») (f : String) : List (String × Nat) :=
  let «свои» := s.«функции»
  let k := «кодИсходника» s.«текст»
  (s.«внутри» f).filter (s.«строкаТела?» f) |>.flatMap fun i =>
    («упоминания» («кодСтроки» k i)).filterMap fun u =>
      if «конструктор?» u then none
      else if u.«после».startsWith "от " || u.«после» = "от" || u.«имя» = f || «свои».contains u.«имя» then some (u.«имя», i)
      else none

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

def «судитьБлок» (s : «Исх») («все» : List «Тотальность») (t : «Тотальность») : «Суд» := Id.run do
  let f := t.«имя»
  let mut r : «Суд» := {}
  let (n, «рек») := match t with
    | .«композиция» _ n _ => (n, false)
    | .«структура» _ n _ _ _ _ _ => (n, true)
    | .«шаг» _ n _ _ _ _ _ => (n, true)
  let h := s.«сырая» n
  r := r.«еслиНе» (h.startsWith "тотальная функция «" && «имяФункции» h = f)
    s!"тотальность «{f}»: строка {n} исходника — не заголовок «тотальная функция «{f}»»"
  let «зовыТела» := s.«зовы» f
  let «сам» := «зовыТела».filter (·.1 = f)
  let «чужие» := («зовыТела».filter (·.1 ≠ f)).map (·.1) |>.eraseDups
  let «записаны» : List String := match t with
    | .«композиция» _ _ zs => zs.filterMap (fun | .«функ» g _ => some g | _ => none)
    | _ => []
  match t with
  | .«композиция» _ _ zs =>
    r := r.«еслиНе» «сам».isEmpty s!"тотальность «{f}» вида composition: тело зовёт саму «{f}» (строка {(«сам».headD ("", 0)).2})"
    for z in zs do
      match z with
      | .«прим» p => r := r.«еслиНе» («примитивы».contains p) s!"тотальность «{f}»: «{p}» не примитив языка"
      | .«функ» g m =>
        r := r.«еслиНе» («чужие».contains g) s!"тотальность «{f}»: запись называет вызов «{g}», а тело его не зовёт"
        r := r.«еслиНе» («все».any (·.«имя» = g)) s!"тотальность «{f}»: у зовомого «{g}» нет своего блока тотальности"
        r := r.«еслиНе» ((s.«блок» g).map (·.1) == some m) s!"тотальность «{f}»: «{g}» объявлена не на строке {m}"
    for g in «чужие» do
      r := r.«еслиНе» («записаны».contains g) s!"тотальность «{f}»: тело зовёт «{g}», а запись о нём молчит"
    for x in s.«голыеЧужие» f do
      if !«записаны».contains x then
        if s.«взятоТолько?» x then r := r.«беда» s!"тотальность «{f}»: «{x}» взята списком только, тело её зовёт, а запись молчит"
        else r := r.«слово» s!"тотальность «{f}»: голое «{x}» может быть нульместной функцией ввезённого модуля — не берусь"
  | .«структура» _ _ k a d vs _ =>
    r := r.«еслиНе» (!«сам».isEmpty) s!"тотальность «{f}» вида structure: самовызова в теле нет"
    let p := (s.«подпись» f).getD (k - 1) ("", "")
    r := r.«еслиНе» (k ≥ 1 && «голо» p.1 = a) s!"тотальность «{f}»: аргумент {k} — не «{a}»"
    r := r.«еслиНе» («голо» p.2 = d) s!"тотальность «{f}»: дно «{d}» — не тип аргумента {k} «{p.2}»"
    let «вар» := match s.«видТипа» d with | .«сумма» v => v | _ => []
    r := r.«еслиНе» (!«вар».isEmpty) s!"тотальность «{f}»: тип «{d}» не объявлен вариантами — дна нет"
    r := r.«еслиНе» (!vs.isEmpty) s!"тотальность «{f}»: нет ни одного витка"
    for v in vs do
      match v.«часть» with
      | none => r := r.«беда» s!"тотальность «{f}»: виток без части"
      | some (x, «поле», «в») =>
        let ok := match s.«строкаВарианта» d «в» with
          | some l => («поляВарианта» l).any (fun q => q.1 = «поле» && «голо» q.2 = d && q.2.startsWith "«")
          | none => false
        r := r.«еслиНе» ok s!"тотальность «{f}»: поле «{«поле»}» варианта «{«в»}» не той же суммы «{d}»"
        let «связано» := (s.«внутри» f).any fun i =>
          let l := s.«строка» i
          l.startsWith "случай " && «имяВарианта» (l.«сн» 7) = «в» &&
            ((l.splitOn s!"{«поле»} как {x}").length > 1)
        r := r.«еслиНе» «связано» s!"тотальность «{f}»: «{x}» не связано полем «{«поле»}» варианта «{«в»}» в разборе тела"
        match «сАргументом?» (s.«строка» v.«строка») f v.«доводы» with
        | none => r := r.«беда» s!"тотальность «{f}»: в строке {v.«строка»} нет самовызова «{f}» от {v.«доводы»}"
        | some ds => r := r.«еслиНе» («ужать» (ds.getD (k - 1) "") = x) s!"тотальность «{f}»: на убывающем месте витка строки {v.«строка»} стоит не «{x}»"
  | .«шаг» _ _ k a d vs _ =>
    r := r.«еслиНе» (!«сам».isEmpty) s!"тотальность «{f}» вида step: самовызова в теле нет"
    let p := (s.«подпись» f).getD (k - 1) ("", "")
    r := r.«еслиНе» (k ≥ 1 && «голо» p.1 = a) s!"тотальность «{f}»: аргумент {k} — не «{a}»"
    r := r.«еслиНе» («голо» p.2 = d) s!"тотальность «{f}»: дно «{d}» — не тип аргумента {k} «{p.2}»"
    r := r.«еслиНе» (s.«видТипа» d == .«отрезок») s!"тотальность «{f}»: тип «{d}» не отрезок с дном 0"
    r := r.«еслиНе» (!vs.isEmpty) s!"тотальность «{f}»: нет ни одного витка"
    for v in vs do
      match «сАргументом?» (s.«строка» v.«строка») f v.«доводы» with
      | none => r := r.«беда» s!"тотальность «{f}»: в строке {v.«строка»} нет самовызова «{f}» от {v.«доводы»}"
      | some ds =>
        let ok := match «надвое» (ds.getD (k - 1) "") "минус" with
          | some (x, c) => «ужать» x = a && (match «литерал?» c with | some m => m > 0 | none => false)
          | none => false
        r := r.«еслиНе» ok s!"тотальность «{f}»: на месте {k} витка строки {v.«строка»} не «{a} минус <положительное>»"
  if «рек» then
    for g in «чужие» do
      r := r.«еслиНе» («все».any (·.«имя» = g)) s!"тотальность «{f}»: у зовомого «{g}» нет своего блока тотальности"
  return r

def «круги» («все» : List «Тотальность») : List String :=
  let «рёбра» : List (String × String) := «все».flatMap fun t => match t with
    | .«композиция» f _ zs => zs.filterMap (fun | .«функ» g _ => some (f, g) | _ => none)
    | _ => []
  let «шаг» := fun (e : List (String × String)) =>
    (e ++ e.flatMap (fun (a, b) => e.filterMap (fun (c, d) => if c = b then some (a, d) else none))).eraseDups
  let «замк» := (List.range («все».length + 1)).foldl (fun e _ => «шаг» e) «рёбра»
  («замк».filter (fun (a, b) => a = b)).map (·.1) |>.eraseDups

def «судитьТотальности» (s : «Исх») («обещано» : Option Nat) («блоки» : List (List String)) : «Суд» := Id.run do
  let mut r : «Суд» := {}
  r := r.«еслиНе» («обещано».getD 0 = «блоки».length)
    s!"шапка обещает тотальностей {«обещано».getD 0}, а блоков {«блоки».length}"
  let mut «все» : List «Тотальность» := []
  for b in «блоки» do
    match «разобратьБлок» b with
    | some t => «все» := «все» ++ [t]
    | none => r := r.«беда» s!"блок тотальности «{«вЁлочках» (b.headD "") 1}» не по форме печати"
  for t in «все» do
    r := r.«и» («судитьБлок» s «все» t)
  let k := «круги» «все»
  r := r.«еслиНе» k.isEmpty s!"тотальность: зовы по кругу — {", ".intercalate k}"
  return r

end «Второй»
