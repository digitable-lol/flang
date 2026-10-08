import Source

open «Разбор»

namespace «Второй»

def «обрезать» (s : String) : String :=
  let cs := s.toList
  let «пуст» := fun (c : Char) => c = ' ' || c = '\t' || c = '\r'
  String.ofList ((cs.dropWhile «пуст»).reverse.dropWhile «пуст»).reverse

def «заменить» (t a b : String) : String := if a = "" then t else b.intercalate (t.splitOn a)

def «сжать» (t : String) : String := " ".intercalate ((t.splitOn " ").filter (· ≠ ""))

def «развести» (t : String) : String := Id.run do
  let mut out : List Char := []
  let mut «закр» : Option Char := none
  let mut «экран» := false
  let mut «пробел» := true
  for c in t.toList do
    match «закр» with
    | some z =>
      out := c :: out
      if «экран» || c ≠ z then pure () else «закр» := none
      «экран» := !«экран» && c = '\\'
      «пробел» := false
    | none =>
      if c = ':' || c = '(' || c = ')' then
        if !«пробел» then out := ' ' :: out
        out := ' ' :: c :: out
        «пробел» := true
      else if c = ' ' then
        if !«пробел» then out := ' ' :: out; «пробел» := true
      else
        out := c :: out
        «закр» := if c = '"' then some '"' else if c = '\'' then some '\'' else if c = '«' then some '»' else none
        «экран» := false
        «пробел» := false
  let r := String.ofList out.reverse
  return if «пробел» && r ≠ "" then (r.dropEnd 1).toString else r

def «скобкиРавны» (t : String) : Bool := (t.splitOn "(").length = (t.splitOn ")").length

def «непровал» (t : String) : Bool :=
  (t.toList.foldl (fun (a : Int × Bool) c =>
    if c = '(' then (a.1 + 1, a.2) else if c = ')' then (a.1 - 1, a.2 || a.1 - 1 < 0) else a) (0, false)).2 == false

def «безКраёвТ» (t : String) : String := if t.length < 3 then "" else ((t.drop 1).dropEnd 1).toString

def «однаПараТ» (t : String) : Bool :=
  t.length ≥ 3 && t.startsWith "(" && t.endsWith ")" && «скобкиРавны» t && «непровал» («безКраёвТ» t)

def «снятьПару» (t : String) : String := if «однаПараТ» t then «обрезать» («безКраёвТ» t) else t

def «ужатьТ» (t : String) : String := «снятьПару» («снятьПару» («снятьПару» («снятьПару» («обрезать» t))))

def «т» (t : String) : String := «ужатьТ» («развести» t)

def «вСкобки» (t : String) : String := if !((t.splitOn " ").length > 1) || «однаПараТ» t then t else "( " ++ t ++ " )"

def «вместо» («где» «что» «на» : String) : String :=
  let «одет» := " " ++ «вСкобки» «на» ++ " "
  let «п1» := «заменить» (" " ++ «где» ++ " ") (" ( " ++ «что» ++ " ) ") «одет»
  «обрезать» («заменить» «п1» (" " ++ «что» ++ " ") «одет»)

def «естьТ» («где» «что» : String) : Bool := ((" " ++ «где» ++ " ").splitOn (" " ++ «что» ++ " ")).length > 1

def «сверху» (t «знак» : String) : List String :=
  let sep := " " ++ «знак» ++ " "
  let r := (t.splitOn sep).foldl (fun (acc : List String × Option String) «ч» =>
    let «н» := match acc.2 with | some c => c ++ sep ++ «ч» | none => «ч»
    if «скобкиРавны» «н» then (acc.1 ++ [«н»], none) else (acc.1, some «н»)) ([], none)
  r.1

structure «Разрез» where
  «есть» : Bool := false
  «лево» : String := ""
  «право» : String := ""

def «разрез» (t «знак» : String) : «Разрез» :=
  match «сверху» («ужатьТ» t) «знак» with
  | a :: b :: r => ⟨true, «обрезать» a, «обрезать» ((" " ++ «знак» ++ " ").intercalate (b :: r))⟩
  | _ => {}

def «стороны» («цель» : String) : «Разрез» :=
  let r := «разрез» «цель» "равно"
  if r.«есть» then r else «разрез» «цель» "равен"

def «найтиСверху» (t «слово» : String) : Nat := Id.run do
  let cs := t.toList.toArray
  let w := «слово».toList
  let mut «гл» : Int := 0
  let mut «кав» := false
  let mut «экр» := false
  for i in [0:cs.size] do
    let c := cs[i]!
    if «кав» then
      if «экр» then «экр» := false
      else if c = '\\' then «экр» := true
      else if c = '"' then «кав» := false
    else if c = '"' then «кав» := true
    else if c = '(' then «гл» := «гл» + 1
    else if c = ')' then «гл» := «гл» - 1
    else if «гл» = 0 && c = ' ' && (cs.extract i (i + w.length)).toList = w then return i + 1
  return 0

def «разрезСловом» (t «слово» : String) : «Разрез» :=
  let «где» := «найтиСверху» t «слово»
  if «где» = 0 then {} else
  let cs := t.toList
  let «л» := «обрезать» (String.ofList (cs.take («где» - 1)))
  let «п» := «обрезать» (String.ofList (cs.drop («где» - 1 + «слово».length)))
  if «л» = "" || «п» = "" || «найтиСверху» «п» «слово» > 0 then {} else ⟨true, «л», «п»⟩

def «членыСписка» (t : String) : List String := Id.run do
  if t.length < 3 || !t.startsWith "[" || !t.endsWith "]" then return []
  let mut «кр» : Int := 0
  let mut «кв» : Int := 0
  let mut «кав» := false
  let mut «экр» := false
  let mut «тек» : List Char := []
  let mut «чл» : List String := []
  for c in («безКраёвТ» t).toList do
    if «кав» then
      «тек» := c :: «тек»
      if «экр» then «экр» := false else
        «кав» := c ≠ '"'
        «экр» := c = '\\'
    else if c = '"' then «кав» := true; «тек» := c :: «тек»
    else if c = ',' && «кр» = 0 && «кв» = 0 then «чл» := «чл» ++ [«обрезать» (String.ofList «тек».reverse)]; «тек» := []
    else
      if c = '(' then «кр» := «кр» + 1
      if c = ')' then «кр» := «кр» - 1
      if c = '[' then «кв» := «кв» + 1
      if c = ']' then «кв» := «кв» - 1
      «тек» := c :: «тек»
  return «чл» ++ [«обрезать» (String.ofList «тек».reverse)]

def «уголок» (s : String) (n : Nat) : String :=
  match (s.splitOn "⟨")[n]? with
  | some x => (x.splitOn "⟩").headD ""
  | none => ""

def «ёлочка» (s : String) (n : Nat) : String :=
  match (s.splitOn "«")[n]? with
  | some x => (x.splitOn "»").headD ""
  | none => ""

def «словаС» (s : String) (n : Nat) : String := " ".intercalate ((s.splitOn " ").drop n)

def «слово» (s : String) (n : Nat) : String := (s.splitOn " ").getD (n - 1) ""

def «после» (s m : String) : String :=
  match s.splitOn m with
  | _ :: b :: _ => «обрезать» b
  | _ => ""

def «простойТ» (t : String) : Bool :=
  let u := «обрезать» t
  !((u.splitOn " ").length > 1) || «однаПараТ» u

def «литералЧисла?» (s : String) : Option Float :=
  let u := «обрезать» s
  let («зн», r) := if u.startsWith "-" then (-1.0, u.drop 1 |>.toString) else (1.0, u)
  match r.splitOn "." with
  | [a] => if a ≠ "" && a.all Char.isDigit then some («зн» * a.toNat!.toFloat) else none
  | [a, b] =>
    if a ≠ "" && b ≠ "" && a.all Char.isDigit && b.all Char.isDigit then
      some («зн» * (a.toNat!.toFloat + b.toNat!.toFloat / (10.0 ^ b.length.toFloat)))
    else none
  | _ => none

def «доводыВызова» (t : String) : List String := Id.run do
  let mut acc : List String := []
  let mut cur : List Char := []
  let mut d : Nat := 0
  let mut q := false
  let mut e := false
  let mut cs := t.toList
  let mut fuel := cs.length + 1
  while fuel > 0 do
    fuel := fuel - 1
    match cs with
    | [] => fuel := 0
    | c :: r =>
      cs := r
      if q then
        cur := c :: cur
        if !e && c = '"' then q := false
        e := !e && c = '\\'
      else if c = '"' then q := true; cur := c :: cur
      else if c = '(' then d := d + 1; cur := c :: cur
      else if c = ')' then
        if d = 0 then fuel := 0; cs := [] else d := d - 1; cur := c :: cur
      else if d = 0 && c = ' ' && (String.ofList r).startsWith "и притом " then return []
      else if d = 0 && c = ' ' && (String.ofList r).startsWith "и " then
        acc := acc ++ [String.ofList cur.reverse]; cur := []; cs := r.drop 2
      else cur := c :: cur
  acc := acc ++ [String.ofList cur.reverse]
  return (acc.map String.«обр»).filter (· ≠ "")

end «Второй»
