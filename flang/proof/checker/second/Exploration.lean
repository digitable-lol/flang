namespace «Перебор»

structure «Процесс» where
  «имя» : String
  «начало» : String
  «ящик» : Nat
  «конечные» : List String

structure «Правило» where
  «кто» : String
  «в» : String
  «получив» : String
  «куда» : String
  «стоп» : Bool
  «письма» : List (String × String)

structure «Модель» where
  «процессы» : List «Процесс» := []
  «правила» : List «Правило» := []
  «первые» : List (String × String) := []
  «условие» : List String := []

structure «Место» where
  «в» : String
  «ящик» : List String
  «жив» : Bool
  «потеряно» : Nat
deriving BEq

abbrev «Система» := List «Место»

def «номер» (m : «Модель») (name : String) : Option Nat :=
  m.«процессы».findIdx? (fun p => p.«имя» == name)

def «начало» (m : «Модель») : «Система» :=
  m.«процессы».map (fun p =>
    { «в» := p.«начало», «ящик» := (m.«первые».filter (fun l => l.1 == p.«имя»)).map (fun l => l.2),
      «жив» := true, «потеряно» := 0 })

def «доставить» (m : «Модель») (acc : «Система» × Bool × List String) (letter : String × String) :
    «Система» × Bool × List String :=
  let (s, alive, notes) := acc
  let sign := letter.1 ++ " " ++ letter.2
  if !alive then acc else
  match «номер» m letter.1 with
  | none => (s, alive, notes ++ ["некому " ++ sign])
  | some k =>
    match s[k]?, m.«процессы»[k]? with
    | some c, some p =>
      if !c.«жив» then (s.set k { c with «потеряно» := c.«потеряно» + 1 }, alive, notes ++ ["потеряно " ++ sign])
      else if p.«ящик» > 0 && c.«ящик».length >= p.«ящик» then (s, false, notes ++ ["переполнен " ++ sign])
      else (s.set k { c with «ящик» := c.«ящик» ++ [letter.2] }, alive, notes ++ ["отправлено " ++ sign])
    | _, _ => (s, alive, notes ++ ["некому " ++ sign])

def «ход» (m : «Модель») (s : «Система») (i : Nat) : Option («Система» × String × String) :=
  match s[i]?, m.«процессы»[i]? with
  | some place, some p =>
    if !place.«жив» then none else
    match place.«ящик» with
    | [] => none
    | letter :: rest =>
      let s1 := s.set i { place with «ящик» := rest }
      match m.«правила».find? (fun r => r.«кто» == p.«имя» && r.«в» == place.«в» && r.«получив» == letter) with
      | none => some (s1, place.«в», "без правила")
      | some r =>
        let s2 := s1.set i { place with «ящик» := rest, «в» := r.«куда» }
        let (s3, alive, notes) := r.«письма».foldl («доставить» m) (s2, true, [])
        let notes2 := if r.«стоп» then notes ++ ["остановился"] else notes
        let s4 := match s3[i]? with
          | some c => s3.set i { c with «жив» := alive && !r.«стоп» }
          | none => s3
        some (s4, r.«куда», if notes2.isEmpty then "принято" else String.intercalate "; " notes2)
  | _, _ => none

def «тупик» (m : «Модель») (s : «Система») : Bool :=
  let pairs := m.«процессы».zip s
  let ready := pairs.filter (fun q => q.2.«жив» && !q.2.«ящик».isEmpty)
  let stuck := pairs.filter (fun q => q.2.«жив» && !q.1.«конечные».contains q.2.«в»)
  ready.isEmpty && !stuck.isEmpty

def «верно» (m : «Модель») (s : «Система») : Nat → List String → Option (Bool × List String)
  | 0, _ => none
  | _, [] => none
  | f + 1, t :: r =>
    if t == "не тупик" then some (!«тупик» m s, r)
    else if t == "не" then («верно» m s f r).map (fun v => (!v.1, v.2))
    else if t == "и" || t == "или" then
      match «верно» m s f r with
      | none => none
      | some (a, q) =>
        match «верно» m s f q with
        | none => none
        | some (b, q2) => some (if t == "и" then a && b else a || b, q2)
    else
      match r with
      | [] => none
      | who :: q =>
        let place := («номер» m who).bind (fun k => s[k]?)
        if t == "жив" then some ((place.map (fun c => c.«жив»)).getD false, q)
        else if t == "письма доходят" then some ((place.map (fun c => c.«потеряно» == 0)).getD true, q)
        else
          match q with
          | [] => none
          | x :: q2 =>
            if t == "в состоянии" then some ((place.map (fun c => c.«в» == x)).getD false, q2)
            else if t == "ящик не больше" then
              x.toNat?.map (fun n => ((place.map (fun c => decide (c.«ящик».length ≤ n))).getD true, q2))
            else none

def «условие» (m : «Модель») (s : «Система») : Option Bool :=
  match «верно» m s (m.«условие».length + 1) m.«условие» with
  | some (v, []) => some v
  | _ => none

def «ходы» (m : «Модель») (s : «Система») : List «Система» :=
  (List.range m.«процессы».length).filterMap (fun i => («ход» m s i).map (fun x => x.1))

def «слои» (m : «Модель») : Nat → List «Система» → List «Система» → Nat →
    Option (Bool × Nat × List «Система» × List «Система»)
  | 0, seen, front, d => some (false, d, seen, front)
  | k + 1, seen, front, d =>
    if front.isEmpty then some (false, d, seen, front) else
    let fresh := front.foldl (fun acc node => («ходы» m node).foldl
      (fun a n => if seen.contains n || a.contains n then a else a ++ [n]) acc) []
    let d2 := if fresh.isEmpty then d else d + 1
    match fresh.mapM («условие» m) with
    | none => none
    | some verdicts =>
      if verdicts.all id then «слои» m k (seen ++ fresh) fresh d2
      else some (true, d2, seen ++ fresh, fresh)

structure «Чтение» where
  «модель» : «Модель» := {}
  «граница» : Option Nat := none
  «имя» : String := ""
  «исход» : String := ""
  «глубина» : String := ""
  «состояний» : String := ""
  «целиком» : String := ""
  «шаги» : List (List String) := []
  «беда» : Option String := none

def «пары» : List String → List (String × String)
  | a :: b :: r => (a, b) :: «пары» r
  | _ => []

def «сБедой» (rd : «Чтение») (why : String) : «Чтение» := { rd with «беда» := some why }

def «строка» (rd : «Чтение») (line : String) : «Чтение» :=
  if rd.«беда».isSome || line.isEmpty then rd else
  let m := rd.«модель»
  match line.splitOn "\t" with
  | ["перебор", _] => rd
  | ["граница", x] =>
    match x.toNat? with
    | some n => { rd with «граница» := some n }
    | none => «сБедой» rd "негодная граница"
  | ["свойство", x] => { rd with «имя» := x }
  | ["исход", x] => { rd with «исход» := x }
  | ["глубина", x] => { rd with «глубина» := x }
  | ["состояний", x] => { rd with «состояний» := x }
  | ["целиком", x] => { rd with «целиком» := x }
  | "шаг" :: fields => { rd with «шаги» := rd.«шаги» ++ [fields] }
  | "процесс" :: name :: start :: box :: finals =>
    match box.toNat? with
    | some n => { rd with «модель» := { m with «процессы» := m.«процессы» ++
        [{ «имя» := name, «начало» := start, «ящик» := n, «конечные» := finals }] } }
    | none => «сБедой» rd "негодная строка процесса"
  | "правило" :: who :: state :: got :: to :: stop :: letters =>
    if (stop != "да" && stop != "нет") || letters.length % 2 != 0 then «сБедой» rd "негодная строка правила"
    else { rd with «модель» := { m with «правила» := m.«правила» ++
        [{ «кто» := who, «в» := state, «получив» := got, «куда» := to, «стоп» := stop == "да",
           «письма» := «пары» letters }] } }
  | ["первое", to, what] => { rd with «модель» := { m with «первые» := m.«первые» ++ [(to, what)] } }
  | "условие" :: tokens => { rd with «модель» := { m with «условие» := m.«условие» ++ tokens } }
  | _ => «сБедой» rd "строка неизвестного вида"

def «переиграть» (m : «Модель») : «Система» → Nat → List (List String) → Except String «Система»
  | s, _, [] => .ok s
  | s, n, [who, letter, src, dst, note] :: r =>
    match («номер» m who).bind (fun i => (s[i]?).map (fun c => (i, c))) with
    | none => .error s!"шаг {n} невозможен: процесса «{who}» нет"
    | some (i, c) =>
      if c.«ящик».head? != some letter || c.«в» != src then
        .error s!"шаг {n} невозможен: у «{who}» нет письма «{letter}» во главе ящика в состоянии «{src}»"
      else
        match «ход» m s i with
        | none => .error s!"шаг {n} невозможен: «{who}» остановлен"
        | some (s2, k, e) =>
          if k == dst && e == note then «переиграть» m s2 (n + 1) r
          else .error s!"шаг {n} не совпал с моделью: она даёт «{k}, {e}»"
  | _, n, _ :: _ => .error s!"шаг {n} не из шести полей"

def «нарушение» (rd : «Чтение») : String × UInt32 :=
  let m := rd.«модель»
  match «переиграть» m («начало» m) 1 rd.«шаги» with
  | .error why => ("НЕ СОШЛОСЬ: " ++ why, 1)
  | .ok s =>
    match «условие» m s with
    | some false =>
      (s!"ПЕРЕБОР СВЕРЕН: встречный прогон переигран, шагов {rd.«шаги».length}, в конце свойство «{rd.«имя»}» " ++
        "ложно; это перебор модели, не доказательство", 0)
    | _ => ("НЕ СОШЛОСЬ: в конце следа свойство держится: это не встречный прогон", 1)

def «отсутствие» (rd : «Чтение») (bound : Nat) : String × UInt32 :=
  let m := rd.«модель»
  let s0 := «начало» m
  if !rd.«шаги».isEmpty then ("НЕ СОШЛОСЬ: при исходе «не нарушено» в записи стоят шаги", 1) else
  match «условие» m s0 with
  | some false => ("НЕ СОШЛОСЬ: записано «не нарушено», а перебор заново нашёл нарушение", 1)
  | _ =>
    match «слои» m bound [s0] [s0] 0 with
    | none => ("НЕ СОШЛОСЬ: условие записано не по форме", 1)
    | some (true, _, _, _) => ("НЕ СОШЛОСЬ: записано «не нарушено», а перебор заново нашёл нарушение", 1)
    | some (false, d, seen, front) =>
      let whole := if front.isEmpty then "да" else "нет"
      if rd.«глубина» == toString d && rd.«состояний» == toString seen.length && rd.«целиком» == whole then
        (s!"ПЕРЕБОР СВЕРЕН: перебор повторён, глубина {d}, состояний {seen.length}, целиком {whole}; " ++
          "это не доказательство", 0)
      else (s!"НЕ СОШЛОСЬ: перебор заново даёт глубину {d}, состояний {seen.length}, целиком {whole}", 1)

def «сверить» (text : String) : String × UInt32 :=
  if (text.splitOn "доказано").length > 1 then ("НЕ СОШЛОСЬ: перебор не доказывает, а в записи слово «доказано»", 1)
  else
  let rd := (text.splitOn "\n").foldl «строка» {}
  let m := rd.«модель»
  match rd.«беда», rd.«граница» with
  | some why, _ => ("НЕ СОШЛОСЬ: " ++ why, 1)
  | none, none => ("НЕ СОШЛОСЬ: в записи нет границы", 1)
  | none, some bound =>
    if m.«процессы».isEmpty || m.«условие».isEmpty then ("НЕ СОШЛОСЬ: в записи нет модели или условия", 1) else
    match «условие» m («начало» m) with
    | none => ("НЕ СОШЛОСЬ: условие записано не по форме", 1)
    | some _ =>
      if rd.«исход» == "нарушено" then «нарушение» rd
      else if rd.«исход» == "не нарушено" then «отсутствие» rd bound
      else (s!"НЕ СОШЛОСЬ: исход «{rd.«исход»}» не из двух: «нарушено» или «не нарушено»", 1)

end «Перебор»
