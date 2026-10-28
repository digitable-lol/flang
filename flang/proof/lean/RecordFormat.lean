import «RecordReader»

/-!
# Форма записи — функцией над строками, и леммы о читателе (задача 4572)

Формат записи описан прозой в `docs/flang/proof/record-format.md`, читает его
`RecordReader.lean`, и до сих пор читатель стоял вне теоремы целиком (ADR-0041 §2.3).
Здесь форма записи записана ФУНКЦИЕЙ над списком строк — отдельно от читателя,
прямо по описанию формата, — и доказано, что читатель режет запись на утверждения
ровно так, как велит эта функция, и что строй блока `вывод` он требует ровно тот,
что назван в описании.

## Что доказано выводом

- `«собрать-по-форме»`: нарезка утверждений читателем (`«Разбор».«собрать»`, `«утвержденияТекстом»`)
  совпадает со спецификацией `«блоки»`: блок — заголовок `утверждение «…` и обрезанные
  строки под ним до строки `конец утверждения` либо следующего заголовка; строки шапки,
  строки между `конец утверждения` и следующим заголовком блоку не принадлежат.
- `«блоков-столько-же-сколько-заголовков»`: блоков ровно столько, сколько строк
  `утверждение «…` в тексте, — читатель не теряет и не удваивает утверждений.
- `«заголовок-блока»`: заголовок каждого блока — строка текста, начинающаяся
  с `утверждение «`.
- `«стройБлока-по-форме»`: `«стройБлока»` принимает блок `вывод` тогда и только тогда,
  когда он по форме: `вывод цель` первой и одна, `вывод конец` последней и не больше
  одной, шагов от одного до шестидесяти четырёх (`«блокПоФорме»`).
- `«шапкаПоФорме»`: девять строк шапки по описанию формата — разрешимое условие; это
  спецификация, читатель шапку не читает (её судит второй сверщик), и прибор
  `ModelBlocks.lean` печатает, по форме ли шапка каждой записи; проверена пробами.

## Что проверено пробами, а не выводом

Строка шага `вывод N ИМЯ ⟨Ф⟩ ОСНОВАНИЕ` разбирается `«шаг»` через `String.splitOn`,
о котором в ядре Lean лемм нет; общей теоремы «печать шага читается назад» здесь
нет, есть пробы `#guard` на формы строк из описания формата и сверка на корпусе
(`bootstrap/flang run-script lean-model:blocks`: шагов в тексте = шагов прочитано,
`НЕ ПРОЧЁЛ` = 0). Чтение самих формул (`«форм»`, `partial def`) — вне теоремы, как
и прежде: его связывает с печатью сверка вердиктов (`run.fscript`).
-/

namespace «Форма»

open «Разбор»

/-- Заголовок утверждения. -/
def «заголовок?» (l : String) : Bool := l.startsWith "утверждение «"

/-- Строка, закрывающая утверждение. -/
def «конец?» (l : String) : Bool := l.«обр» = "конец утверждения"

/-- Строка принадлежит телу утверждения: не заголовок и не конец. -/
def «телу?» (l : String) : Bool := !(«заголовок?» l) && !(«конец?» l)

/-- Тело блока: обрезанные строки до конца утверждения либо следующего заголовка. -/
def «тело» (r : List String) : List String := (r.takeWhile «телу?»).map (·.«обр»)

/-- Спецификация нарезки записи на утверждения — по описанию формата, не по читателю:
    блок открывает строка `утверждение «…`, тело блока — строки под ней до
    `конец утверждения` либо следующего заголовка; прочие строки блоку не принадлежат. -/
def «блоки» : List String → List (String × List String)
  | [] => []
  | l :: r =>
    if «заголовок?» l then (l, «тело» r) :: «блоки» (r.drop («тело» r).length)
    else «блоки» r
termination_by ls => ls.length
decreasing_by
  all_goals simp_wf
  all_goals first | omega | (rw [List.length_drop]; omega)

/-- Остаток после тела — остаток после `dropWhile`. -/
theorem «drop-takeWhile» {α : Type} (p : α → Bool) : ∀ (l : List α),
    l.drop (l.takeWhile p).length = l.dropWhile p
  | [] => rfl
  | a :: l => by
      by_cases h : p a = true <;> simp [h, «drop-takeWhile» p l]

/-- Всё, что взял `takeWhile`, удовлетворяет условию. -/
theorem «из-takeWhile» {α : Type} (p : α → Bool) : ∀ (l : List α) (x : α), x ∈ l.takeWhile p → p x = true
  | [], x, h => by simp at h
  | a :: l, x, h => by
      by_cases ha : p a = true
      · simp [ha] at h
        rcases h with rfl | h
        · exact ha
        · exact «из-takeWhile» p l x h
      · simp [ha] at h

theorem «dropWhile-не-длиннее» {α : Type} (p : α → Bool) : ∀ (l : List α), (l.dropWhile p).length ≤ l.length
  | [] => Nat.le_refl _
  | a :: l => by
      by_cases h : p a = true
      · simp only [List.dropWhile_cons, h, ↓reduceIte, List.length_cons]
        exact Nat.le_succ_of_le («dropWhile-не-длиннее» p l)
      · simp [h]

theorem «drop-тела» (r : List String) : r.drop («тело» r).length = r.dropWhile «телу?» := by
  simp only [«тело», List.length_map]; exact «drop-takeWhile» _ r

/-- Что читатель собирает с открытым блоком `тек`: открытый блок дополняется телом,
    дальше — спецификация по остатку. -/
def «ожидаемое» («тек» : Option (String × List String)) (ls : List String) : List (String × List String) :=
  match «тек» with
  | none => «блоки» ls
  | some (h, b) => (h, b ++ «тело» ls) :: «блоки» (ls.drop («тело» ls).length)

theorem «тело-заголовок» {z : String} (r : List String) (h : «заголовок?» z = true) :
    «тело» (z :: r) = [] := by
  simp [«тело», List.takeWhile, «телу?», h]

theorem «тело-конец» {z : String} (r : List String) (h : «конец?» z = true) :
    «тело» (z :: r) = [] := by
  simp [«тело», List.takeWhile, «телу?», h]

theorem «тело-иное» {z : String} (r : List String) (h1 : «заголовок?» z = false)
    (h2 : «конец?» z = false) : «тело» (z :: r) = z.«обр» :: «тело» r := by
  simp [«тело», List.takeWhile, «телу?», h1, h2]

theorem «блоки-заголовок» {z : String} (r : List String) (h : «заголовок?» z = true) :
    «блоки» (z :: r) = (z, «тело» r) :: «блоки» (r.drop («тело» r).length) := by
  rw [«блоки»]; simp [h]

theorem «блоки-не-заголовок» {z : String} (r : List String) (h : «заголовок?» z = false) :
    «блоки» (z :: r) = «блоки» r := by
  rw [«блоки»]; simp [h]

/-- **Читатель режет по форме.** `«Разбор».«собрать»` с открытым блоком `тек` и уже собранным
    `итог` даёт `итог` и то, что велит спецификация. -/
theorem «собрать-по-форме» : ∀ (ls : List String) («тек» : Option (String × List String))
    («итог» : List (String × List String)),
    «Разбор».«собрать» ls «тек» «итог» = «итог» ++ «ожидаемое» «тек» ls
  | [], none, «итог» => by simp [«Разбор».«собрать», «ожидаемое», «блоки»]
  | [], some (h, b), «итог» => by simp [«Разбор».«собрать», «ожидаемое», «блоки», «тело»]
  | z :: r, «тек», «итог» => by
    by_cases hz : «заголовок?» z = true
    · -- заголовок открывает новый блок; открытый закрывается как есть
      have hz' : z.startsWith "утверждение «" = true := hz
      cases «тек» with
      | none =>
        simp only [«Разбор».«собрать», hz', ↓reduceIte]
        rw [«собрать-по-форме» r (some (z, [])) «итог»]
        simp [«ожидаемое», «блоки-заголовок» r hz]
      | some t =>
        obtain ⟨h, b⟩ := t
        simp only [«Разбор».«собрать», hz', ↓reduceIte]
        rw [«собрать-по-форме» r (some (z, [])) («итог» ++ [(h, b)])]
        simp [«ожидаемое», «блоки-заголовок» r hz, «тело-заголовок» r hz]
    · have hz0 : «заголовок?» z = false := by simpa using hz
      have hz' : z.startsWith "утверждение «" = false := hz0
      by_cases hk : «конец?» z = true
      · have hk' : z.«обр» = "конец утверждения" := by simpa [«конец?»] using hk
        cases «тек» with
        | none =>
          simp only [«Разбор».«собрать», hz', Bool.false_eq_true, ↓reduceIte, hk']
          rw [«собрать-по-форме» r none «итог»]
          simp [«ожидаемое», «блоки-не-заголовок» r hz0]
        | some t =>
          obtain ⟨h, b⟩ := t
          simp only [«Разбор».«собрать», hz', Bool.false_eq_true, ↓reduceIte, hk']
          rw [«собрать-по-форме» r none («итог» ++ [(h, b)])]
          simp [«ожидаемое», «блоки-не-заголовок» r hz0, «тело-конец» r hk]
      · have hk0 : «конец?» z = false := by simpa using hk
        have hk' : ¬ (z.«обр» = "конец утверждения") := by simpa [«конец?»] using hk
        cases «тек» with
        | none =>
          simp only [«Разбор».«собрать», hz', Bool.false_eq_true, ↓reduceIte, hk']
          rw [«собрать-по-форме» r none «итог»]
          simp [«ожидаемое», «блоки-не-заголовок» r hz0]
        | some t =>
          obtain ⟨h, b⟩ := t
          simp only [«Разбор».«собрать», hz', Bool.false_eq_true, ↓reduceIte, hk']
          rw [«собрать-по-форме» r (some (h, b ++ [z.«обр»])) «итог»]
          simp [«ожидаемое», «тело-иное» r hz0 hk0]
termination_by ls => ls.length

/-- Утверждения, нарезанные читателем из текста, — ровно спецификация по строкам текста. -/
theorem «утверждения-по-форме» («текст» : String) :
    «утвержденияТекстом» «текст» = «блоки» («текст».splitOn "\n") := by
  unfold «утвержденияТекстом»
  rw [«собрать-по-форме»]; simp [«ожидаемое»]

/-- Блоков ровно столько, сколько заголовков в тексте. -/
theorem «блоков-столько-же-сколько-заголовков» : ∀ (ls : List String),
    («блоки» ls).length = (ls.filter «заголовок?»).length
  | [] => by simp [«блоки»]
  | z :: r => by
    by_cases hz : «заголовок?» z = true
    · rw [«блоки-заголовок» r hz]
      simp only [List.length_cons, List.filter_cons, hz, ↓reduceIte]
      -- тело и остаток: заголовков в теле нет, остаток — хвост после тела
      have hsplit : r.takeWhile «телу?» ++ r.dropWhile «телу?» = r := List.takeWhile_append_dropWhile
      rw [«drop-тела», «блоков-столько-же-сколько-заголовков» (r.dropWhile «телу?»)]
      have hnone : (r.takeWhile «телу?»).filter «заголовок?» = [] := by
        rw [List.filter_eq_nil_iff]
        intro a ha
        have := «из-takeWhile» «телу?» r a ha
        simp [«телу?»] at this
        simp [this.1]
      have hr : (r.filter «заголовок?»).length = ((r.dropWhile «телу?»).filter «заголовок?»).length := by
        have := congrArg (fun l => (l.filter «заголовок?»).length) hsplit
        simp only [List.filter_append, hnone, List.nil_append] at this
        exact this.symm
      rw [hr]
    · have hz0 : «заголовок?» z = false := by simpa using hz
      rw [«блоки-не-заголовок» r hz0]
      simp [hz0, «блоков-столько-же-сколько-заголовков» r]
termination_by ls => ls.length
decreasing_by
  all_goals simp_wf
  all_goals first | omega | exact Nat.lt_succ_of_le («dropWhile-не-длиннее» _ _) | (rw [List.length_drop]; omega)

/-- Заголовок каждого блока — строка текста, начинающаяся с `утверждение «`. -/
theorem «заголовок-блока» : ∀ (ls : List String) (h : String) (b : List String),
    (h, b) ∈ «блоки» ls → «заголовок?» h = true ∧ h ∈ ls
  | [], h, b, hm => by simp [«блоки»] at hm
  | z :: r, h, b, hm => by
    by_cases hz : «заголовок?» z = true
    · rw [«блоки-заголовок» r hz] at hm
      rcases List.mem_cons.mp hm with heq | hrest
      · cases heq; exact ⟨hz, List.mem_cons_self⟩
      · obtain ⟨h1, h2⟩ := «заголовок-блока» _ h b hrest
        exact ⟨h1, List.mem_cons_of_mem _ (List.mem_of_mem_drop h2)⟩
    · have hz0 : «заголовок?» z = false := by simpa using hz
      rw [«блоки-не-заголовок» r hz0] at hm
      obtain ⟨h1, h2⟩ := «заголовок-блока» r h b hm
      exact ⟨h1, List.mem_cons_of_mem _ h2⟩
termination_by ls => ls.length
decreasing_by
  all_goals simp_wf
  all_goals first | omega | (rw [List.length_drop]; omega)

/-! ## Строй блока `вывод` -/

/-- Блок `вывод` по форме (описание формата §3; сверщик — `проиграть_вывод`): первой и
    единственной — `вывод цель`, последней — `вывод конец` и не больше одной, строк
    от трёх (цель, шаг, конец) до шестидесяти шести (64 шага). -/
def «блокПоФорме» («строки» : List String) : Prop :=
  ((«строки».head?).map (·.startsWith "вывод цель")).getD false = true ∧
  («строки».filter (·.startsWith "вывод цель")).length = 1 ∧
  («строки».filter (· = "вывод конец")).length ≤ 1 ∧
  «строки».getLast? = some "вывод конец" ∧
  3 ≤ «строки».length ∧ «строки».length ≤ 66

instance («строки» : List String) : Decidable («блокПоФорме» «строки») := by
  unfold «блокПоФорме»; infer_instance

/-- Читатель принимает строй блока тогда и только тогда, когда блок по форме. -/
theorem «стройБлока-по-форме» («строки» : List String) :
    «стройБлока» «строки» = .ok () ↔ «блокПоФорме» «строки» := by
  unfold «стройБлока» «блокПоФорме»
  by_cases h1 : ((«строки».head?).map (·.startsWith "вывод цель")).getD false = true <;>
  by_cases h2 : («строки».filter (·.startsWith "вывод цель")).length = 1 <;>
  by_cases h3 : («строки».filter (· = "вывод конец")).length ≤ 1 <;>
  by_cases h4 : «строки».getLast? = some "вывод конец" <;>
  by_cases h5 : 3 ≤ «строки».length <;>
  by_cases h6 : «строки».length ≤ 66 <;>
  simp [h1, h2, h3, h4, h5, h6, bind, Except.bind, pure, Except.pure, throw, throwThe, MonadExceptOf.throw]

/-! ## Шапка -/

/-- Строка `ключ N` с числом. -/
def «числоПосле?» («ключ» : String) (l : String) : Bool :=
  l.startsWith («ключ» ++ " ") && ((l.«сн» («ключ».length + 1)).toNat?).isSome

/-- Девять строк шапки по описанию формата (§1): версия записи, исходник, строк,
    знаков, два отпечатка, ядро, число утверждений, SHA-256 и число тотальностей либо
    пустая строка. -/
def «шапкаПоФорме» («строки» : List String) : Bool :=
  match «строки» with
  | l1 :: l2 :: l3 :: l4 :: l5 :: l6 :: l7 :: l8 :: l9 :: _ =>
    l1 = "запись доказательства 1" && l2.startsWith "исходник " &&
    «числоПосле?» "строк" l3 && «числоПосле?» "знаков" l4 &&
    (match (l5.splitOn " ") with
     | ["отпечаток", a, b] => a.toNat?.isSome && b.toNat?.isSome
     | _ => false) &&
    «числоПосле?» "ядро" l6 && «числоПосле?» "утверждений" l7 &&
    (l8.startsWith "отпечаток256 " && (l8.«сн» 13).length = 64) &&
    (l9 = "" || «числоПосле?» "тотальностей" l9)
  | _ => false

/- Шапка по форме — проба на примере из описания формата (вычислением, не выводом:
   ядро Lean не считает `String.toNat?` за разумное время). -/
#guard «шапкаПоФорме» ["запись доказательства 1", "исходник a.flang", "строк 3", "знаков 10",
      "отпечаток 7 7", "ядро 2", "утверждений 0",
      "отпечаток256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", ""] = true
#guard «шапкаПоФорме» ["запись доказательства 2", "исходник a.flang", "строк 3", "знаков 10",
      "отпечаток 7 7", "ядро 2", "утверждений 0",
      "отпечаток256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", ""] = false

/-! ## Пробы строки шага (не теорема: `String.splitOn` в ядре Lean лемм не имеет) -/

#guard match «шаг» "    вывод 3 Разв2 ⟨( длина результат ) равен ( длина элементы )⟩ из 2 строка 30" with
  | .ok s => s.«номер» = 3 && s.«правило» = "Разв2" && (s.«основание» matches .«изСтрока» 2 30)
  | .error _ => false
#guard match «шаг» "    вывод 1 Выч ⟨( длина элементы ) равен ( длина элементы )⟩ сам" with
  | .ok s => s.«номер» = 1 && s.«правило» = "Выч" && (s.«основание» matches .«сам»)
  | .error _ => false
#guard match «шаг» "    вывод 2 Н5 ⟨а не больше б⟩ из 1 3" with
  | .ok s => s.«номер» = 2 && s.«правило» = "Н5" && (s.«основание» matches .«из2» 1 3)
  | .error _ => false
#guard match «шаг» "    вывод 4 О5 ⟨а не больше б⟩ из 1 2 3" with
  | .ok s => s.«номер» = 4 && (s.«основание» matches .«из3» 1 2 3)
  | .error _ => false
#guard match «шаг» "    вывод 2 Т1 ⟨а не больше б⟩ строка 7" with
  | .ok s => s.«номер» = 2 && (s.«основание» matches .«строка» 7)
  | .error _ => false
#guard («шаг» "    вывод х Т1 ⟨а не больше б⟩ строка 7").isOk = false
#guard («шаг» "    вывод 2 Т1 ⟨а не больше б⟩").isOk = false

end «Форма»
