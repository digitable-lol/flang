import «Состоятельность»

open «Знач»

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

inductive «Отн» where
  | «меньше»
  | «неБольше»
  | «равен»
  | «неРавен»
  | «больше»
  | «неМеньше»
  deriving DecidableEq, Repr

def «отн» : «Отн» → «Знач» → «Знач» → Bool
  | .«меньше», x, y => «меньше» x y
  | .«неБольше», x, y => «неБольше» x y
  | .«равен», x, y => «равен» x y
  | .«неРавен», x, y => !(«равен» x y)
  | .«больше», x, y => «меньше» y x
  | .«неМеньше», x, y => «неМеньше» x y

def «атом» : «Отн» → «ТермЧ» → «ТермЧ» → «Форм»
  | .«меньше», a, b => .«меньше» a b
  | .«неБольше», a, b => .«неБольше» a b
  | .«равен», a, b => .«равен» a b
  | .«неРавен», a, b => .«не» (.«равен» a b)
  | .«больше», a, b => .«больше» a b
  | .«неМеньше», a, b => .«неМеньше» a b

theorem «атом-значение» (r : «Отн») (a b : «ТермЧ») (w : «Мир») :
    «оценитьФ» («атом» r a b) w = «отн» r («оценить» a w) («оценить» b w) := by
  cases r <;> rfl

def «атом?» : «Форм» → Option («ТермЧ» × «Отн» × «ТермЧ»)
  | .«меньше» a b => some (a, .«меньше», b)
  | .«неБольше» a b => some (a, .«неБольше», b)
  | .«равен» a b => some (a, .«равен», b)
  | .«не» (.«равен» a b) => some (a, .«неРавен», b)
  | .«больше» a b => some (a, .«больше», b)
  | .«неМеньше» a b => some (a, .«неМеньше», b)
  | _ => none

theorem «атом?-верно» {f : «Форм»} {a b : «ТермЧ»} {r : «Отн»} (h : «атом?» f = some (a, r, b)) :
    f = «атом» r a b := by
  unfold «атом?» at h
  split at h <;> (cases h) <;> rfl

def «зеркалоОтн» : «Отн» → «Отн»
  | .«меньше» => .«больше»
  | .«неБольше» => .«неМеньше»
  | .«равен» => .«равен»
  | .«неРавен» => .«неРавен»
  | .«больше» => .«меньше»
  | .«неМеньше» => .«неБольше»

theorem «зеркало_отношения» (r : «Отн») (x y : «Знач») : «отн» («зеркалоОтн» r) x y = «отн» r y x := by
  cases r <;> simp [«отн», «зеркалоОтн», «неМеньше», «равен», eq_comm]

def «порядокОтн» (r : «Отн») : Bool := r != .«равен» && r != .«неРавен»

theorem «порядок-не-нечисло» {r : «Отн»} {x y : «Знач»} (hr : «порядокОтн» r = true) (h : «отн» r x y = true) :
    x ≠ «неЧисло» ∧ y ≠ «неЧисло» := by
  cases r <;> simp [«порядокОтн»] at hr <;> cases x <;> cases y <;>
    simp_all [«отн», «меньше», «неБольше», «неМеньше»]

def «следствиеПары» : «Отн» → «Отн» → Option Bool
  | .«меньше», .«меньше» => some true
  | .«меньше», .«неБольше» => some true
  | .«меньше», .«равен» => some false
  | .«меньше», .«неРавен» => some true
  | .«меньше», .«больше» => some false
  | .«меньше», .«неМеньше» => some false
  | .«неБольше», .«неБольше» => some true
  | .«неБольше», .«больше» => some false
  | .«равен», .«равен» => some true
  | .«равен», .«неРавен» => some false
  | .«неРавен», .«равен» => some false
  | .«неРавен», .«неРавен» => some true
  | .«больше», .«меньше» => some false
  | .«больше», .«неБольше» => some false
  | .«больше», .«равен» => some false
  | .«больше», .«неРавен» => some true
  | .«больше», .«больше» => some true
  | .«больше», .«неМеньше» => some true
  | .«неМеньше», .«меньше» => some false
  | .«неМеньше», .«неМеньше» => some true
  | _, _ => none

theorem «следствие_пары» (r1 r2 : «Отн») (x y : «Знач») (b : Bool)
    (h : «отн» r1 x y = true) (hs : «следствиеПары» r1 r2 = some b) : «отн» r2 x y = b := by
  cases r1 <;> cases r2 <;> simp [«следствиеПары»] at hs <;> subst hs <;>
    cases x <;> cases y <;> simp_all [«отн», «меньше», «неБольше», «неМеньше», «равен»] <;> omega

theorem «следствие_пары-равенство» {α : Type} (x y : α) (r1 r2 : «Отн») (b : Bool)
    (h1 : r1 = .«равен» ∨ r1 = .«неРавен») (hs : «следствиеПары» r1 r2 = some b)
    (h : if r1 = .«равен» then x = y else x ≠ y) :
    if r2 = .«равен» then (x = y ↔ b = true) else (x ≠ y ↔ b = true) := by
  rcases h1 with rfl | rfl <;> cases r2 <;> simp [«следствиеПары»] at hs <;> subst hs <;> simp_all

def «нижняя» : «Отн» → Int → Option (Int × Bool)
  | .«больше», k => some (k, true)
  | .«неМеньше», k => some (k, false)
  | .«равен», k => some (k, false)
  | _, _ => none

def «верхняя» : «Отн» → Int → Option (Int × Bool)
  | .«меньше», k => some (k, true)
  | .«неБольше», k => some (k, false)
  | .«равен», k => some (k, false)
  | _, _ => none

def «нижеВыше» : Option (Int × Bool) → Int → Bool
  | some (n, o), k => decide (n > k) || (decide (n = k) && o)
  | none, _ => false

def «неНиже» : Option (Int × Bool) → Int → Bool
  | some (n, _), k => decide (n ≥ k)
  | none, _ => false

def «вышеНиже» : Option (Int × Bool) → Int → Bool
  | some (n, o), k => decide (n < k) || (decide (n = k) && o)
  | none, _ => false

def «неВыше» : Option (Int × Bool) → Int → Bool
  | some (n, _), k => decide (n ≤ k)
  | none, _ => false

def «следствиеПромежутка» (r1 : «Отн») (k1 : Int) (r2 : «Отн») (k2 : Int) : Option Bool :=
  let lo := «нижняя» r1 k1
  let hi := «верхняя» r1 k1
  if r1 = .«неРавен» then none else
  let «вне» := «нижеВыше» lo k2 || «вышеНиже» hi k2
  let «точка» := decide (r1 = .«равен») && decide (k1 = k2) && decide (k2 ≠ 0)
  match r2 with
  | .«меньше» => if «вышеНиже» hi k2 then some true else if «неНиже» lo k2 then some false else none
  | .«неБольше» => if «неВыше» hi k2 then some true else if «нижеВыше» lo k2 then some false else none
  | .«больше» => if «нижеВыше» lo k2 then some true else if «неВыше» hi k2 then some false else none
  | .«неМеньше» => if «неНиже» lo k2 then some true else if «вышеНиже» hi k2 then some false else none
  | .«равен» => if «вне» then some false else if «точка» then some true else none
  | .«неРавен» => if «вне» then some true else if «точка» then some false else none

theorem «следствие_промежутка» (r1 r2 : «Отн») (k1 k2 : Int) (x : «Знач») (b : Bool)
    (h : «отн» r1 x («кон» k1) = true) (hs : «следствиеПромежутка» r1 k1 r2 k2 = some b) :
    «отн» r2 x («кон» k2) = b := by
  cases r1 <;> cases r2 <;> cases x <;>
    simp only [«следствиеПромежутка», «нижняя», «верхняя», «нижеВыше», «неНиже», «вышеНиже», «неВыше»,
      «отн», «меньше», «неБольше», «неМеньше», «равен», reduceCtorEq, ite_false, ite_true,
      Bool.or_eq_true, Bool.and_eq_true, decide_eq_true_eq, Bool.false_or, Bool.or_false,
      Bool.false_and, Bool.and_false, Option.some.injEq] at h hs ⊢ <;>
    (repeat' split at hs) <;> (try cases hs) <;> simp_all <;> omega

def «литЧ?» : «ТермЧ» → Option Int
  | .«лит» k => some k
  | _ => none

def «следствиеЯдро» (lf : «ТермЧ») (rf : «Отн») (pf l : «ТермЧ») (r : «Отн») (p : «ТермЧ») : Option Bool :=
  if l = p ∧ «порядокОтн» rf = true ∧ (l = lf ∨ l = pf) ∧ (r = .«неБольше» ∨ r = .«неМеньше») then some true
  else if l = p ∧ «порядокОтн» rf = true ∧ (l = lf ∨ l = pf) ∧ (r = .«меньше» ∨ r = .«больше») then some false
  else if lf = l ∧ pf = p then «следствиеПары» rf r
  else if lf = p ∧ pf = l then «следствиеПары» rf («зеркалоОтн» r)
  else match «литЧ?» pf with
    | some k1 =>
      if lf = l ∧ («литЧ?» p).isSome then «следствиеПромежутка» rf k1 r ((«литЧ?» p).getD 0)
      else if lf = p ∧ («литЧ?» l).isSome then «следствиеПромежутка» rf k1 («зеркалоОтн» r) ((«литЧ?» l).getD 0)
      else none
    | none => none

def «следствиеАтома» (lf : «ТермЧ») (rf : «Отн») (pf l : «ТермЧ») (r : «Отн») (p : «ТермЧ») : Option Bool :=
  let «закрыто» :=
    (l = p ∧ «порядокОтн» rf = true ∧ (l = lf ∨ l = pf) ∧ r ≠ .«равен» ∧ r ≠ .«неРавен») ∨
    (lf = l ∧ pf = p) ∨ (lf = p ∧ pf = l) ∨
    (((«литЧ?» pf).isSome) ∧ ((lf = l ∧ («литЧ?» p).isSome) ∨ (lf = p ∧ («литЧ?» l).isSome)))
  if «закрыто» then «следствиеЯдро» lf rf pf l r p
  else if («литЧ?» lf).isSome ∧ («литЧ?» pf).isNone then «следствиеЯдро» pf («зеркалоОтн» rf) lf l r p
  else none

theorem «литЧ?-значение» {t : «ТермЧ»} {k : Int} (h : «литЧ?» t = some k) (w : «Мир») :
    «оценить» t w = «кон» k := by
  cases t <;> simp [«литЧ?»] at h; subst h; rfl

theorem «следствиеЯдро-верно» (lf pf l p : «ТермЧ») (rf r : «Отн») (b : Bool) (w : «Мир»)
    (h : «отн» rf («оценить» lf w) («оценить» pf w) = true)
    (hs : «следствиеЯдро» lf rf pf l r p = some b) :
    «отн» r («оценить» l w) («оценить» p w) = b := by
  unfold «следствиеЯдро» at hs
  split at hs
  · rename_i hc
    obtain ⟨hlp, hr, hl, hr2⟩ := hc
    cases hs
    have hn := «порядок-не-нечисло» hr h
    have hx : «оценить» l w ≠ «неЧисло» := by rcases hl with rfl | rfl <;> simp_all
    subst hlp
    rcases hr2 with rfl | rfl <;> simp [«отн», «неМеньше»] <;> exact «рефл» hx
  split at hs
  · rename_i _ hc
    obtain ⟨hlp, hr, hl, hr2⟩ := hc
    cases hs
    have hn := «порядок-не-нечисло» hr h
    have hx : «оценить» l w ≠ «неЧисло» := by rcases hl with rfl | rfl <;> simp_all
    subst hlp
    rcases hr2 with rfl | rfl <;> (generalize «оценить» l w = v at hx ⊢) <;> cases v <;> simp_all [«отн», «меньше»]
  split at hs
  · rename_i _ _ hc
    obtain ⟨rfl, rfl⟩ := hc
    exact «следствие_пары» rf r _ _ b h hs
  split at hs
  · rename_i _ _ _ hc
    obtain ⟨rfl, rfl⟩ := hc
    rw [← «зеркало_отношения»]
    exact «следствие_пары» rf («зеркалоОтн» r) _ _ b h hs
  split at hs
  · rename_i _ _ _ _ k1 hk1
    rw [«литЧ?-значение» hk1 w] at h
    split at hs
    · rename_i hc
      obtain ⟨rfl, hp⟩ := hc
      obtain ⟨k2, hk2⟩ := Option.isSome_iff_exists.mp hp
      rw [hk2] at hs
      rw [«литЧ?-значение» hk2 w]
      exact «следствие_промежутка» rf r k1 k2 _ b h hs
    split at hs
    · rename_i _ hc
      obtain ⟨rfl, hp⟩ := hc
      obtain ⟨k2, hk2⟩ := Option.isSome_iff_exists.mp hp
      rw [hk2] at hs
      rw [«литЧ?-значение» hk2 w, ← «зеркало_отношения»]
      exact «следствие_промежутка» rf («зеркалоОтн» r) k1 k2 _ b h hs
    · cases hs
  · cases hs

theorem «следствие_атома» (lf pf l p : «ТермЧ») (rf r : «Отн») (b : Bool) (w : «Мир»)
    (h : «оценитьФ» («атом» rf lf pf) w = true)
    (hs : «следствиеАтома» lf rf pf l r p = some b) :
    «оценитьФ» («атом» r l p) w = b := by
  rw [«атом-значение»] at h ⊢
  unfold «следствиеАтома» at hs
  dsimp only at hs
  split at hs
  · exact «следствиеЯдро-верно» lf pf l p rf r b w h hs
  split at hs
  · apply «следствиеЯдро-верно» pf lf l p («зеркалоОтн» rf) r b w _ hs
    rw [«зеркало_отношения»]; exact h
  · cases hs

def «литФ» : Bool → «Форм»
  | true => .«да»
  | false => .«нет»

theorem «литФ-значение» (b : Bool) (w : «Мир») : «оценитьФ» («литФ» b) w = b := by
  cases b <;> rfl

def «решеноФактом» (lf : «ТермЧ») (rf : «Отн») (pf : «ТермЧ») : «Тело» → «Тело» → Bool
  | .«признак» a, B =>
    match «атом?» a with
    | some (l, r, p) =>
      match «следствиеАтома» lf rf pf l r p with
      | some b => decide (B = .«признак» («литФ» b))
      | none => false
    | none => false
  | _, _ => false

theorem «решеноФактом-верно» (lf pf : «ТермЧ») (rf : «Отн») (w : «Мир»)
    (h : «оценитьФ» («атом» rf lf pf) w = true) :
    ∀ A B, «решеноФактом» lf rf pf A B = true → «значение» A w = «значение» B w := by
  intro A B hAB
  cases A with
  | «признак» a =>
    simp only [«решеноФактом»] at hAB
    split at hAB
    · rename_i l r p ha
      split at hAB
      · rename_i b hb
        simp only [decide_eq_true_eq] at hAB
        subst hAB
        rw [«атом?-верно» ha]
        simp only [«значение», «литФ-значение»]
        rw [«следствие_атома» lf pf l p rf r b w h hb]
      · cases hAB
    · cases hAB
  | _ => simp [«решеноФактом»] at hAB

theorem «применить_отношение» (lf pf : «ТермЧ») (rf : «Отн») (w : «Мир»)
    (h : «оценитьФ» («атом» rf lf pf) w = true) (f f' : «Форм»)
    (hz : «замФ» («решеноФактом» lf rf pf) f f' = true) :
    «оценитьФ» f w = «оценитьФ» f' w :=
  «замФ-верно» _ w («решеноФактом-верно» lf pf rf w h) f f' hz

theorem «метки_разошлись» (a b : String) (fs gs : «Поля») (w : «Мир») (h : a ≠ b) :
    «оценитьСм» (.«вариант» a fs) w ≠ «оценитьСм» (.«вариант» b gs) w := by
  simp [«оценитьСм», h]

theorem «решить_не_меткой» (v : «Значение») (K : String) (hk : «вариантЗнач» v ≠ some K)
    (fs : List (String × «Значение»)) : v ≠ .«сумма» K fs := by
  intro e; subst e; exact hk rfl

theorem «без_метки» (v : «Значение») (K : String) (hk : «вариантЗнач» v ≠ some K)
    (fs : List (String × «Значение»)) : (v = .«сумма» K fs) = False ∧ (v ≠ .«сумма» K fs) = True := by
  have := «решить_не_меткой» v K hk fs
  exact ⟨by simp [this], by simp [this]⟩

def «сторона» (s s' : «Тело») : «Тело» → «Тело» → Bool := fun A B => decide (A = s ∧ B = s')

theorem «заменить_сторону» (s s' : «Тело») (w : «Мир») (hs : «значение» s w = «значение» s' w)
    (f f' : «Форм») (hz : «замФ» («сторона» s s') f f' = true) :
    «оценитьФ» f w = «оценитьФ» f' w := by
  apply «замФ-верно» _ w _ f f' hz
  intro A B h
  simp only [«сторона», decide_eq_true_eq] at h
  obtain ⟨rfl, rfl⟩ := h
  exact hs

theorem «заменить_сторону-равен» (a b : «ТермЧ») (w : «Мир»)
    (h : «оценитьФ» (.«равен» a b) w = true) : «значение» (.«число» a) w = «значение» (.«число» b) w := by
  simp only [«оценитьФ», «равен», decide_eq_true_eq] at h
  simp [«значение», h]

theorem «заменить_сторону-равенС» (a b : «ТермС») (w : «Мир»)
    (h : «оценитьФ» (.«равенС» a b) w = true) : «значение» (.«список» a) w = «значение» (.«список» b) w := by
  simp only [«оценитьФ», decide_eq_true_eq] at h
  simp [«значение», h]

theorem «заменить_сторону-равенТ» (a b : «ТермТ») (w : «Мир»)
    (h : «оценитьФ» (.«равенТ» a b) w = true) : «значение» (.«текст» a) w = «значение» (.«текст» b) w := by
  simp only [«оценитьФ», decide_eq_true_eq] at h
  simp [«значение», h]

theorem «минус-себя» (o : «Округление») (v : «Знач») (h : «минус» o v v = «кон» 0) : «неБольше» v v = true := by
  have ho := o.«точно» 0 (by unfold «порог»; omega) (by unfold «порог»; omega)
  cases v <;> simp_all [«минус», «плюс», «отр», «неБольше», «чис»]

theorem «с_фактом» (w : «Мир») :
    (∀ a b : «Форм», «оценитьФ» (.«и» a b) w = true → «оценитьФ» a w = true ∧ «оценитьФ» b w = true) ∧
    (∀ a b : «Форм», «оценитьФ» (.«или» a b) w = false → «оценитьФ» a w = false ∧ «оценитьФ» b w = false) ∧
    (∀ (a : «Форм») (t : Bool), «оценитьФ» (.«не» a) w = t → «оценитьФ» a w = !t) ∧
    (∀ a b : «ТермЧ», «оценитьФ» (.«равен» a b) w = false → «оценитьФ» («атом» .«неРавен» a b) w = true) ∧
    (∀ a b : «ТермЧ», «оценитьФ» («атом» .«неРавен» a b) w = false → «оценитьФ» (.«равен» a b) w = true) ∧
    (∀ x : «ТермЧ», «оценитьФ» (.«равен» (.«минус» x x) (.«лит» 0)) w = true →
      «оценитьФ» («атом» .«неБольше» x x) w = true) := by
  refine ⟨?_, ?_, ?_, ?_, ?_, ?_⟩
  · intro a b h; simpa [«оценитьФ»] using h
  · intro a b h; simpa [«оценитьФ»] using h
  · intro a t h; simp only [«оценитьФ»] at h; subst h; simp
  · intro a b h; simp only [«атом», «оценитьФ»] at h ⊢; simp [h]
  · intro a b h; simp only [«атом», «оценитьФ»] at h ⊢; simpa using h
  · intro x h
    simp only [«атом», «оценитьФ», «оценить», «равен», decide_eq_true_eq] at h ⊢
    exact «минус-себя» w.«о» _ (of_decide_eq_true h)

inductive «Лин» where
  | «мера» (i : Nat)
  | «конст» (k : Int)
  | «плюс» (a b : «Лин»)
  | «минус» (a b : «Лин»)

def «лин» (o : «Округление») (m : Nat → Nat) : «Лин» → «Знач»
  | .«мера» i => «кон» (m i)
  | .«конст» k => «кон» k
  | .«плюс» a b => «плюс» o («лин» o m a) («лин» o m b)
  | .«минус» a b => «минус» o («лин» o m a) («лин» o m b)

def «точноЛин» (m : Nat → Nat) : «Лин» → Int
  | .«мера» i => m i
  | .«конст» k => k
  | .«плюс» a b => «точноЛин» m a + «точноЛин» m b
  | .«минус» a b => «точноЛин» m a - «точноЛин» m b

def «листья» : «Лин» → Nat
  | .«мера» _ => 1
  | .«конст» _ => 1
  | .«плюс» a b => «листья» a + «листья» b
  | .«минус» a b => «листья» a + «листья» b

def «малыЛин» (m : Nat → Nat) : «Лин» → Prop
  | .«мера» i => (m i : Int) ≤ 281474976710656
  | .«конст» k => -281474976710656 ≤ k ∧ k ≤ 281474976710656
  | .«плюс» a b => «малыЛин» m a ∧ «малыЛин» m b
  | .«минус» a b => «малыЛин» m a ∧ «малыЛин» m b

theorem «листья-полож» (L : «Лин») : 1 ≤ «листья» L := by
  induction L <;> simp [«листья»] <;> omega

theorem «мера_в» (l : «Список») (t : «Текст») :
    0 ≤ (l.length : Int) ∧ 0 ≤ (t.length : Int) ∧ ([] : «Список»).length = 0 := by
  simp

theorem «минус-кон» (o : «Округление») (x y : Int) : «минус» o («кон» x) («кон» y) = o.«ф» (x - y) := by
  by_cases h : y = 0
  · subst h; simp [«минус», «отр», «плюс», «чис»]
  · simp [«минус», «отр», «плюс», «чис», h, Int.sub_eq_add_neg]

theorem «длины_терма» (o : «Округление») (m : Nat → Nat) :
    ∀ L : «Лин», «малыЛин» m L → «листья» L ≤ 16 →
      «лин» o m L = «кон» («точноЛин» m L) ∧
      -(«листья» L : Int) * 281474976710656 ≤ «точноЛин» m L ∧ «точноЛин» m L ≤ («листья» L : Int) * 281474976710656
  | .«мера» i, hm, _ => by
      simp only [«малыЛин»] at hm
      have h1 : («листья» (.«мера» i) : Int) = 1 := rfl
      simp only [«лин», «точноЛин», h1]; exact ⟨trivial, by omega, by omega⟩
  | .«конст» k, hm, _ => by
      simp only [«малыЛин»] at hm
      have h1 : («листья» (.«конст» k) : Int) = 1 := rfl
      simp only [«лин», «точноЛин», h1]; exact ⟨trivial, by omega, by omega⟩
  | .«плюс» a b, hm, hl => by
      simp only [«малыЛин»] at hm
      simp only [«листья»] at hl
      have ha1 := «листья-полож» a
      have hb1 := «листья-полож» b
      obtain ⟨ea, la, ua⟩ := «длины_терма» o m a hm.1 (by omega)
      obtain ⟨eb, lb, ub⟩ := «длины_терма» o m b hm.2 (by omega)
      have hp : («листья» a + «листья» b : Int) ≤ 16 := by omega
      simp only [«лин», «точноЛин», «листья», ea, eb, «плюс», «чис»]
      refine ⟨o.«точно» _ (by unfold «порог»; omega) (by unfold «порог»; omega), by push_cast; omega, by push_cast; omega⟩
  | .«минус» a b, hm, hl => by
      simp only [«малыЛин»] at hm
      simp only [«листья»] at hl
      have ha1 := «листья-полож» a
      have hb1 := «листья-полож» b
      obtain ⟨ea, la, ua⟩ := «длины_терма» o m a hm.1 (by omega)
      obtain ⟨eb, lb, ub⟩ := «длины_терма» o m b hm.2 (by omega)
      have hp : («листья» a + «листья» b : Int) ≤ 16 := by omega
      simp only [«лин», «точноЛин», «листья», ea, eb, «минус-кон»]
      refine ⟨o.«точно» _ (by unfold «порог»; omega) (by unfold «порог»; omega), by push_cast; omega, by push_cast; omega⟩

def «влить» : List (Nat × Int) → Nat → Int → List (Nat × Int)
  | [], i, s => [(i, s)]
  | (j, c) :: r, i, s => if j = i then (j, c + s) :: r else (j, c) :: «влить» r i s

def «суммаЛин» (m : Nat → Nat) : List (Nat × Int) → Int
  | [] => 0
  | (j, c) :: r => c * (m j : Int) + «суммаЛин» m r

theorem «влить-сумма» (m : Nat → Nat) : ∀ (acc : List (Nat × Int)) (i : Nat) (s : Int),
    «суммаЛин» m («влить» acc i s) = s * (m i : Int) + «суммаЛин» m acc
  | [], i, s => by simp [«влить», «суммаЛин»]
  | (j, c) :: r, i, s => by
      simp only [«влить»]
      split
      · rename_i h; subst h; simp only [«суммаЛин»]; rw [Int.add_mul]; omega
      · simp only [«суммаЛин»]; rw [«влить-сумма» m r i s]; omega

def «сложить» : «Лин» → Int → List (Nat × Int) × Int → List (Nat × Int) × Int
  | .«мера» i, σ, (acc, c) => («влить» acc i σ, c)
  | .«конст» k, σ, (acc, c) => (acc, c + σ * k)
  | .«плюс» a b, σ, st => «сложить» b σ («сложить» a σ st)
  | .«минус» a b, σ, st => «сложить» b (-σ) («сложить» a σ st)

theorem «сложить-верно» (m : Nat → Nat) : ∀ (L : «Лин») (σ : Int) (st : List (Nat × Int) × Int),
    «суммаЛин» m («сложить» L σ st).1 + («сложить» L σ st).2 = «суммаЛин» m st.1 + st.2 + σ * «точноЛин» m L
  | .«мера» i, σ, (acc, c) => by simp only [«сложить», «точноЛин», «влить-сумма»]; omega
  | .«конст» k, σ, (acc, c) => by simp only [«сложить», «точноЛин»]; omega
  | .«плюс» a b, σ, st => by
      simp only [«сложить», «точноЛин»]
      rw [«сложить-верно» m b σ, «сложить-верно» m a σ, Int.mul_add]; omega
  | .«минус» a b, σ, st => by
      simp only [«сложить», «точноЛин»]
      rw [«сложить-верно» m b (-σ), «сложить-верно» m a σ, Int.mul_sub, Int.neg_mul]; omega

def «всеНеПол» (cs : List (Nat × Int)) : Bool := cs.all (fun q => decide (q.2 ≤ 0))
def «всеНеОтр» (cs : List (Nat × Int)) : Bool := cs.all (fun q => decide (0 ≤ q.2))
def «всеНоль» (cs : List (Nat × Int)) : Bool := cs.all (fun q => decide (q.2 = 0))

theorem «всеНеПол-сумма» (m : Nat → Nat) : ∀ cs, «всеНеПол» cs = true → «суммаЛин» m cs ≤ 0
  | [] => by simp [«суммаЛин»]
  | (j, c) :: r => by
      intro h
      simp only [«всеНеПол», List.all_cons, Bool.and_eq_true, decide_eq_true_eq] at h
      have := «всеНеПол-сумма» m r h.2
      have hc : c * (m j : Int) ≤ 0 := Int.mul_nonpos_of_nonpos_of_nonneg h.1 (Int.natCast_nonneg _)
      simp only [«суммаЛин»]; omega

theorem «всеНеОтр-сумма» (m : Nat → Nat) : ∀ cs, «всеНеОтр» cs = true → 0 ≤ «суммаЛин» m cs
  | [] => by simp [«суммаЛин»]
  | (j, c) :: r => by
      intro h
      simp only [«всеНеОтр», List.all_cons, Bool.and_eq_true, decide_eq_true_eq] at h
      have := «всеНеОтр-сумма» m r h.2
      have hc : 0 ≤ c * (m j : Int) := Int.mul_nonneg h.1 (Int.natCast_nonneg _)
      simp only [«суммаЛин»]; omega

theorem «всеНоль-сумма» (m : Nat → Nat) : ∀ cs, «всеНоль» cs = true → «суммаЛин» m cs = 0
  | [] => by simp [«суммаЛин»]
  | (j, c) :: r => by
      intro h
      simp only [«всеНоль», List.all_cons, Bool.and_eq_true, decide_eq_true_eq] at h
      have := «всеНоль-сумма» m r h.2
      simp only [«суммаЛин», h.1, Int.zero_mul]; omega

def «решениеДлин» (cs : List (Nat × Int)) (c : Int) : «Отн» → Option Bool
  | .«неБольше» => if «всеНеПол» cs ∧ c ≤ 0 then some true else if «всеНеОтр» cs ∧ c > 0 then some false else none
  | .«меньше» => if «всеНеПол» cs ∧ c < 0 then some true else if «всеНеОтр» cs ∧ c ≥ 0 then some false else none
  | .«неМеньше» => if «всеНеОтр» cs ∧ c ≥ 0 then some true else if «всеНеПол» cs ∧ c < 0 then some false else none
  | .«больше» => if «всеНеОтр» cs ∧ c > 0 then some true else if «всеНеПол» cs ∧ c ≤ 0 then some false else none
  | .«равен» => if «всеНоль» cs then some (decide (c = 0))
      else if («всеНеОтр» cs ∧ c > 0) ∨ («всеНеПол» cs ∧ c < 0) then some false else none
  | .«неРавен» => if «всеНоль» cs then some (decide (c ≠ 0))
      else if («всеНеОтр» cs ∧ c > 0) ∨ («всеНеПол» cs ∧ c < 0) then some true else none

theorem «решениеДлин-верно» (m : Nat → Nat) (cs : List (Nat × Int)) (c x y : Int) (r : «Отн») (b : Bool)
    (hxy : x - y = «суммаЛин» m cs + c) (h : «решениеДлин» cs c r = some b) :
    «отн» r («кон» x) («кон» y) = b := by
  have h1 := «всеНеПол-сумма» m cs
  have h2 := «всеНеОтр-сумма» m cs
  have h3 := «всеНоль-сумма» m cs
  cases r <;> simp only [«решениеДлин»] at h <;> (repeat' split at h) <;> (try cases h) <;>
    simp_all [«отн», «меньше», «неБольше», «неМеньше», «равен»] <;> (try omega) <;>
    (rename_i hh; rcases hh with ⟨ha, hc⟩ | ⟨ha, hc⟩ <;> (first | have := h2 ha | have := h1 ha) <;> omega)

theorem «отношение_длин» (o : «Округление») (m : Nat → Nat) (L R : «Лин») (r : «Отн») (b : Bool)
    (hL : «малыЛин» m L) (hR : «малыЛин» m R) (nL : «листья» L ≤ 16) (nR : «листья» R ≤ 16)
    (h : «решениеДлин» («сложить» R (-1) («сложить» L 1 ([], 0))).1 («сложить» R (-1) («сложить» L 1 ([], 0))).2 r = some b) :
    «отн» r («лин» o m L) («лин» o m R) = b := by
  rw [(«длины_терма» o m L hL nL).1, («длины_терма» o m R hR nR).1]
  apply «решениеДлин-верно» m _ _ _ _ r b _ h
  have e1 := «сложить-верно» m R (-1) («сложить» L 1 ([], 0))
  have e2 := «сложить-верно» m L 1 ([], 0)
  simp only [«суммаЛин»] at e2
  omega

def «шестн» (n : Nat) : Char := if n < 10 then Char.ofNat (48 + n) else Char.ofNat (55 + n)

def «знакШестн?» (c : Char) : Option Nat :=
  if 48 ≤ c.toNat ∧ c.toNat ≤ 57 then some (c.toNat - 48)
  else if 65 ≤ c.toNat ∧ c.toNat ≤ 70 then some (c.toNat - 55)
  else if 97 ≤ c.toNat ∧ c.toNat ≤ 102 then some (c.toNat - 87)
  else none

def «экран» (n : Nat) : List Char :=
  ['\\', 'u', «шестн» (n / 4096 % 16), «шестн» (n / 256 % 16), «шестн» (n / 16 % 16), «шестн» (n % 16)]

def «код4?» (a b c d : Char) : Option Nat :=
  match «знакШестн?» a, «знакШестн?» b, «знакШестн?» c, «знакШестн?» d with
  | some x, some y, some z, some t => some (((x * 16 + y) * 16 + z) * 16 + t)
  | _, _, _, _ => none

def «годныйКод» (n : Nat) : Bool := decide (0 < n) && decide (n < 0xD800 ∨ (0xDFFF < n ∧ n < 0x110000))

def «простоЭкран» (e : Char) : Char :=
  if e = 'n' then '\n' else if e = 'r' then '\r' else if e = 't' then '\t' else e

def «раскрыть» : List Char → Option (List Char)
  | [] => some []
  | '\\' :: 'u' :: a :: b :: c :: d :: r =>
    match «код4?» a b c d with
    | some n => if «годныйКод» n then (Char.ofNat n :: ·) <$> «раскрыть» r else none
    | none => none
  | '\\' :: e :: r => if e = 'u' then none else («простоЭкран» e :: ·) <$> «раскрыть» r
  | ['\\'] => none
  | c :: r => (c :: ·) <$> «раскрыть» r

def «кодЭкрана?» (e : Char) : Option Nat :=
  if e = 'n' then some 10 else if e = 'r' then some 13 else if e = 't' then some 9
  else if e = '"' then some 34 else if e = '\\' then some 92 else none

def «буквоЦифра» (c : Char) : Bool :=
  decide (48 ≤ c.toNat ∧ c.toNat ≤ 57) || decide (65 ≤ c.toNat ∧ c.toNat ≤ 90) || decide (97 ≤ c.toNat ∧ c.toNat ≤ 122)

def «закрыть» : List Char → Option (List Char)
  | [] => some []
  | '\\' :: 'u' :: a :: b :: c :: d :: r =>
    if («код4?» a b c d).isSome then (['\\', 'u', a, b, c, d] ++ ·) <$> «закрыть» r else none
  | '\\' :: e :: r =>
    match «кодЭкрана?» e with
    | some n => («экран» n ++ ·) <$> «закрыть» r
    | none => none
  | ['\\'] => none
  | c :: r =>
    if c.toNat = 0 then none
    else if c.toNat < 128 ∧ «буквоЦифра» c = false then («экран» c.toNat ++ ·) <$> «закрыть» r
    else if c = '«' then («экран» 0xAB ++ ·) <$> «закрыть» r
    else if c = '»' then («экран» 0xBB ++ ·) <$> «закрыть» r
    else (c :: ·) <$> «закрыть» r

theorem «шестн-обратно» (k : Nat) (h : k < 16) : «знакШестн?» («шестн» k) = some k := by
  have : k = 0 ∨ k = 1 ∨ k = 2 ∨ k = 3 ∨ k = 4 ∨ k = 5 ∨ k = 6 ∨ k = 7 ∨ k = 8 ∨ k = 9 ∨ k = 10 ∨
      k = 11 ∨ k = 12 ∨ k = 13 ∨ k = 14 ∨ k = 15 := by omega
  rcases this with rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl | rfl <;> decide

theorem «экран-код» (n : Nat) (h : n < 65536) :
    «код4?» («шестн» (n / 4096 % 16)) («шестн» (n / 256 % 16)) («шестн» (n / 16 % 16)) («шестн» (n % 16)) = some n := by
  simp only [«код4?», «шестн-обратно» _ (Nat.mod_lt _ (by omega))]
  congr 1; omega

theorem «раскрыть-экран» (n : Nat) (h : n < 65536) (hg : «годныйКод» n = true) (r : List Char) :
    «раскрыть» («экран» n ++ r) = (Char.ofNat n :: ·) <$> «раскрыть» r := by
  simp only [«экран», List.cons_append, List.nil_append, «раскрыть», «экран-код» n h, hg, ite_true]

theorem «раскрыть-знак» (c : Char) (hc : c ≠ '\\') (r : List Char) :
    «раскрыть» (c :: r) = (c :: ·) <$> «раскрыть» r := by
  conv => lhs; rw [«раскрыть».eq_def]
  split <;> simp_all

theorem «раскрыть-экранированный» (e : Char) (he : e ≠ 'u') (r : List Char) :
    «раскрыть» ('\\' :: e :: r) = («простоЭкран» e :: ·) <$> «раскрыть» r := by
  conv => lhs; rw [«раскрыть».eq_def]
  split
  all_goals first
    | (simp_all; done)
    | (rename_i h3; rcases h3 with ⟨rfl, rfl⟩; simp_all; done)
    | (rename_i h3; rcases h3 with ⟨rfl, rfl⟩; exfalso; rename_i hx; first | exact hx _ _ _ _ _ rfl rfl | exact hx _ _ _ _ _ rfl rfl rfl rfl rfl)

theorem «раскрыть-юникод» (a b c d : Char) (r : List Char) :
    «раскрыть» ('\\' :: 'u' :: a :: b :: c :: d :: r) =
      match «код4?» a b c d with
      | some n => if «годныйКод» n then (Char.ofNat n :: ·) <$> «раскрыть» r else none
      | none => none := by
  conv => lhs; rw [«раскрыть».eq_def]
  split
  all_goals first
    | (simp_all; done)
    | (rename_i h3; rcases h3 with ⟨rfl, rfl⟩; simp_all; done)
    | (rename_i h3; rcases h3 with ⟨rfl, rfl⟩; exfalso; rename_i hx; first | exact hx _ _ _ _ _ rfl rfl | exact hx _ _ _ _ _ rfl rfl rfl rfl rfl)

theorem «кодЭкрана-верно» {e : Char} {n : Nat} (h : «кодЭкрана?» e = some n) :
    e ≠ 'u' ∧ n < 65536 ∧ «годныйКод» n = true ∧ Char.ofNat n = «простоЭкран» e := by
  unfold «кодЭкрана?» at h
  split at h
  · cases h; subst_vars; decide
  split at h
  · cases h; subst_vars; decide
  split at h
  · cases h; subst_vars; decide
  split at h
  · cases h; subst_vars; decide
  split at h
  · cases h; subst_vars; decide
  · cases h

theorem «закрыть_кавычки» (s : List Char) : ∀ s', «закрыть» s = some s' → «раскрыть» s' = «раскрыть» s := by
  fun_induction «закрыть» s <;> intro s' h
  · cases h; rfl
  · rename_i a b c d r hs ih
    cases hr : «закрыть» r with
    | none => rw [hr] at h; cases h
    | some t =>
      rw [hr] at h; cases h
      simp only [List.cons_append, List.nil_append, «раскрыть-юникод»]
      rw [ih t hr]
  · cases h
  · rename_i e r hno n hn ih
    obtain ⟨heu, hlt, hg, hch⟩ := «кодЭкрана-верно» hn
    cases hr : «закрыть» r with
    | none => rw [hr] at h; cases h
    | some t =>
      rw [hr] at h; cases h
      simp only [Functor.map, Option.map_some, «раскрыть-экран» n hlt hg, «раскрыть-экранированный» e heu, ih t hr, hch]
  · cases h
  · cases h
  · cases h
  · rename_i c r h1 h2 h3 hz hc ih
    have hcb : c ≠ '\\' := by
      intro e; subst e
      cases r with
      | nil => exact h3 rfl rfl
      | cons e r' => exact h2 e r' rfl rfl
    have hlt : c.toNat < 65536 := by omega
    have hg : «годныйКод» c.toNat = true := by simp [«годныйКод»]; omega
    cases hr : «закрыть» r with
    | none => rw [hr] at h; cases h
    | some t =>
      rw [hr] at h; cases h
      simp only [Functor.map, Option.map_some, «раскрыть-экран» _ hlt hg, «раскрыть-знак» c hcb, ih t hr,
        Char.ofNat_toNat]
  · rename_i r h1 h2 h3 hz hc ih
    cases hr : «закрыть» r with
    | none => rw [hr] at h; cases h
    | some t =>
      rw [hr] at h; cases h
      simp only [Functor.map, Option.map_some, «раскрыть-экран» 171 (by decide) (by decide), «раскрыть-знак» '«' (by decide), ih t hr]
  · rename_i r h1 h2 h3 hz hc hd ih
    cases hr : «закрыть» r with
    | none => rw [hr] at h; cases h
    | some t =>
      rw [hr] at h; cases h
      simp only [Functor.map, Option.map_some, «раскрыть-экран» 187 (by decide) (by decide), «раскрыть-знак» '»' (by decide), ih t hr]
  · rename_i c r h1 h2 h3 hz hc hd he ih
    have hcb : c ≠ '\\' := by
      intro e; subst e
      cases r with
      | nil => exact h3 rfl rfl
      | cons e r' => exact h2 e r' rfl rfl
    cases hr : «закрыть» r with
    | none => rw [hr] at h; cases h
    | some t =>
      rw [hr] at h; cases h
      simp only [Functor.map, Option.map_some, «раскрыть-знак» c hcb, ih t hr]

inductive «Образец» where
  | «любое»
  | «пусто»
  | «голова» (h t : String)
  | «тег» (k : String)
  | «поля» (k : String) (bs : List (String × String))

def «совпал» : «Образец» → «Значение» → Bool
  | .«любое», _ => true
  | .«пусто», .«список» [] => true
  | .«пусто», .«текст» [] => true
  | .«пусто», _ => false
  | .«голова» _ _, .«список» (_ :: _) => true
  | .«голова» _ _, .«текст» (_ :: _) => true
  | .«голова» _ _, _ => false
  | .«тег» k, v => «вариантЗнач» v == some k
  | .«поля» k _, v => «вариантЗнач» v == some k

def «привязать» (w : «Мир») : «Образец» → «Значение» → «Мир»
  | .«голова» h t, .«список» (x :: r) => «связать» («связать» w t (.«список» r)) h (.«число» x)
  | .«голова» h t, .«текст» (c :: r) => «связать» («связать» w t (.«текст» r)) h (.«текст» [c])
  | .«поля» _ bs, v => «связатьПоля» w bs v
  | _, _ => w

def «именаОбразца» : «Образец» → List String
  | .«голова» h t => [h, t]
  | .«поля» _ bs => bs.map Prod.snd
  | _ => []

def «первый» : List «Образец» → «Значение» → Option Nat
  | [], _ => none
  | p :: ps, v => if «совпал» p v then some 0 else («первый» ps v).map (· + 1)

def «значениеРазбора» (ps : List «Образец») (Bs : List «Тело») (S : «Тело») (w : «Мир») : «Значение» :=
  match «первый» ps («значение» S w) with
  | some i =>
    match ps[i]?, Bs[i]? with
    | some p, some B => «значение» B («привязать» w p («значение» S w))
    | _, _ => .«признак» false
  | none => .«признак» false

inductive «ЛитералS» where
  | «пустойСписок»
  | «метка» (k : String)
  | «сПолями» (k : String) (fs : List (String × «Значение»))

def «значениеЛитерала» : «ЛитералS» → «Значение»
  | .«пустойСписок» => .«список» []
  | .«метка» k => .«сумма» k []
  | .«сПолями» k fs => .«сумма» k fs

def «совпалОбразец» : «Образец» → «ЛитералS» → Option Bool
  | .«любое», _ => some true
  | .«пусто», .«пустойСписок» => some true
  | .«голова» _ _, .«пустойСписок» => some false
  | _, .«пустойСписок» => none
  | .«тег» k, .«метка» t => some (t == k)
  | .«поля» k _, .«метка» t => if t = k then none else some false
  | .«тег» k, .«сПолями» t _ => if t = k then none else some false
  | .«поля» k _, .«сПолями» t _ => some (t == k)
  | _, _ => none

theorem «совпал_образец» (p : «Образец») (S : «ЛитералS») (b : Bool) (h : «совпалОбразец» p S = some b) :
    «совпал» p («значениеЛитерала» S) = b := by
  cases p <;> cases S <;> simp [«совпалОбразец»] at h <;> (try split at h) <;> simp_all [«совпал», «значениеЛитерала», «вариантЗнач»]

theorem «первый-выбор» (ps : List «Образец») (v : «Значение») (i : Nat) (p : «Образец»)
    (hp : ps[i]? = some p) (hm : «совпал» p v = true) (hb : ∀ (j : Nat) q, j < i → ps[j]? = some q → «совпал» q v = false) :
    «первый» ps v = some i := by
  induction ps generalizing i with
  | nil => simp at hp
  | cons q qs ih =>
    cases i with
    | zero =>
      simp at hp; subst hp
      simp [«первый», hm]
    | succ i =>
      simp at hp
      have hq := hb 0 q (by omega) (by simp)
      simp only [«первый», hq]
      rw [ih i hp (fun j q' hj hq' => hb (j + 1) q' (by omega) (by simpa using hq'))]
      rfl

theorem «первый-верно» : ∀ (ps : List «Образец») (v : «Значение») (i : Nat), «первый» ps v = some i →
    ∃ p, ps[i]? = some p ∧ «совпал» p v = true ∧ ∀ (j : Nat) q, j < i → ps[j]? = some q → «совпал» q v = false
  | [], v, i, h => by simp [«первый»] at h
  | p :: ps, v, i, h => by
      simp only [«первый»] at h
      split at h
      · rename_i hm; cases h; exact ⟨p, by simp, hm, fun j q hj _ => absurd hj (by omega)⟩
      · rename_i hm
        cases hr : «первый» ps v with
        | none => rw [hr] at h; cases h
        | some k =>
          rw [hr] at h; cases h
          obtain ⟨q, hq, hqm, hb⟩ := «первый-верно» ps v k hr
          refine ⟨q, by simpa using hq, hqm, fun j q' hj hq' => ?_⟩
          cases j with
          | zero => simp at hq'; subst hq'; simpa using hm
          | succ j => exact hb j q' (by simp at hj; omega) (by simpa using hq')

theorem «привязать-согласие» (w : «Мир») (p : «Образец») (v : «Значение») (xs : List String)
    (h : ∀ x ∈ «именаОбразца» p, x ∉ xs) : «Согласны» w («привязать» w p v) xs := by
  cases p with
  | «голова» hh t =>
    have h1 := h hh (by simp [«именаОбразца»])
    have h2 := h t (by simp [«именаОбразца»])
    cases v with
    | «список» l =>
      cases l with
      | nil => exact ⟨rfl, rfl, fun _ _ => rfl⟩
      | cons x r =>
        refine ⟨rfl, rfl, fun y hy => ?_⟩
        have a1 : y ≠ hh := fun e => h1 (e ▸ hy)
        have a2 : y ≠ t := fun e => h2 (e ▸ hy)
        simp [«привязать», a1, a2]
    | «текст» l =>
      cases l with
      | nil => exact ⟨rfl, rfl, fun _ _ => rfl⟩
      | cons x r =>
        refine ⟨rfl, rfl, fun y hy => ?_⟩
        have a1 : y ≠ hh := fun e => h1 (e ▸ hy)
        have a2 : y ≠ t := fun e => h2 (e ▸ hy)
        simp [«привязать», a1, a2]
    | _ => exact ⟨rfl, rfl, fun _ _ => rfl⟩
  | «поля» k bs =>
    simp only [«привязать», «связатьПоля»]
    induction bs with
    | nil => exact ⟨rfl, rfl, fun _ _ => rfl⟩
    | cons b r ih =>
      have hb : b.2 ∉ xs := h b.2 (by simp [«именаОбразца»])
      have ih' := ih (fun x hx => h x (by simp [«именаОбразца»] at hx ⊢; exact Or.inr hx))
      refine ⟨by simpa using ih'.1, by simpa using ih'.2.1, fun y hy => ?_⟩
      have a1 : y ≠ b.2 := fun e => hb (e ▸ hy)
      simp only [List.foldr_cons, «связать-имя», a1, ite_false]
      exact ih'.2.2 y hy
  | _ => exact ⟨rfl, rfl, fun _ _ => rfl⟩

def «фактыВерны» (F : List «Форм») (w : «Мир») : Prop := ∀ f ∈ F, «оценитьФ» f w = true

theorem «связатьПоля-имя» (w : «Мир») (v : «Значение») (y : String) : ∀ (bs : List (String × String)),
    («связатьПоля» w bs v).«имя» y = match bs.find? (fun b => b.2 == y) with
      | some b => «полеЗнач» v b.1
      | none => w.«имя» y
  | [] => rfl
  | b :: r => by
      simp only [«связатьПоля», List.foldr_cons, «связать-имя», List.find?_cons]
      by_cases h : y = b.2
      · subst h; simp
      · have hb : (b.2 == y) = false := by simp; exact fun e => h e.symm
        simp only [h, ite_false, hb]
        exact «связатьПоля-имя» w v y r

theorem «связатьПоля-о» (w : «Мир») (v : «Значение») : ∀ (bs : List (String × String)),
    («связатьПоля» w bs v).«о» = w.«о» ∧ («связатьПоля» w bs v).«функции» = w.«функции»
  | [] => ⟨rfl, rfl⟩
  | b :: r => by
      simp only [«связатьПоля», List.foldr_cons, «связать-о», «связать-функции»]
      exact «связатьПоля-о» w v r

theorem «мир-равен» (w w' : «Мир») (h1 : w.«о» = w'.«о») (h2 : w.«имя» = w'.«имя») (h3 : w.«функции» = w'.«функции») :
    w = w' := by
  cases w; cases w'; simp_all

theorem «привязать-дважды» (w : «Мир») (p : «Образец») (v : «Значение») :
    «привязать» («привязать» w p v) p v = «привязать» w p v := by
  cases p with
  | «голова» hh t =>
    cases v with
    | «список» l =>
      cases l with
      | nil => rfl
      | cons x r =>
        apply «мир-равен» <;> (try rfl)
        funext y; simp only [«привязать», «связать-имя»]
        by_cases a : y = hh <;> by_cases b : y = t <;> simp [a, b]
    | «текст» l =>
      cases l with
      | nil => rfl
      | cons x r =>
        apply «мир-равен» <;> (try rfl)
        funext y; simp only [«привязать», «связать-имя»]
        by_cases a : y = hh <;> by_cases b : y = t <;> simp [a, b]
    | _ => rfl
  | «поля» k bs =>
    simp only [«привязать»]
    apply «мир-равен»
    · rw [(«связатьПоля-о» _ v bs).1]
    · funext y
      rw [«связатьПоля-имя», «связатьПоля-имя»]
      cases h : bs.find? (fun b => b.2 == y) with
      | none => rfl
      | some b => rfl
    · rw [(«связатьПоля-о» _ v bs).2]
  | _ => rfl

theorem «разбор_в_половине» (ψ : «Форм») (m : String) (S : «Тело») (ps : List «Образец»)
    (Bs : List «Тело») (F : List «Форм»)
    (cover : ∀ w, «фактыВерны» F w → («первый» ps («значение» S w)).isSome = true)
    (fresh : ∀ (i : Nat) p, ps[i]? = some p → ∀ x ∈ «именаОбразца» p,
      x ∉ «свободныеФ» ψ ∧ x ∉ «свободныеТело» S ∧ (∀ f ∈ F, x ∉ «свободныеФ» f))
    (lens : ps.length = Bs.length)
    (clean : ∀ (i : Nat) B, Bs[i]? = some B → «Чисто» («связанныеФ» ψ) m B)
    (halves : ∀ (i : Nat) p B, ps[i]? = some p → Bs[i]? = some B → ∀ w', «фактыВерны» F w' →
      «совпал» p («значение» S w') = true →
      (∀ (j : Nat) q, j < i → ps[j]? = some q → «совпал» q («значение» S w') = false) →
      «привязать» w' p («значение» S w') = w' →
      «оценитьФ» («подстФ» ψ m B) w' = true) :
    ∀ w, «фактыВерны» F w → «оценитьФ» ψ («связать» w m («значениеРазбора» ps Bs S w)) = true := by
  intro w hF
  obtain ⟨i, hi⟩ := Option.isSome_iff_exists.mp (cover w hF)
  obtain ⟨p, hp, hm, hb⟩ := «первый-верно» ps _ i hi
  have hiB : i < Bs.length := by
    have := (List.getElem?_eq_some_iff.mp hp).1; omega
  obtain ⟨B, hB⟩ : ∃ B, Bs[i]? = some B := ⟨Bs[i], List.getElem?_eq_getElem hiB⟩
  have hfr := fresh i p hp
  let w' := «привязать» w p («значение» S w)
  have hS : «значение» S w' = «значение» S w :=
    («согласиеТело» S w w' («привязать-согласие» w p _ _ (fun x hx => (hfr x hx).2.1))).symm
  have hF' : «фактыВерны» F w' := fun f hf => by
    rw [← «согласиеФ» f w w' («привязать-согласие» w p _ _ (fun x hx => (hfr x hx).2.2 f hf))]
    exact hF f hf
  have hh := halves i p B hp hB w' hF' (by rw [hS]; exact hm) (fun j q hj hq => by rw [hS]; exact hb j q hj hq)
    (by rw [hS]; exact «привязать-дважды» w p _)
  rw [«подстановкаФ» ψ m B _ (clean i B hB)] at hh
  simp only [«мир-с»] at hh
  have hv : «значениеРазбора» ps Bs S w = «значение» B w' := by
    simp only [«значениеРазбора», hi, hp, hB, w']
  rw [hv, ← hh]
  apply «согласиеФ»
  have hc := «привязать-согласие» w p («значение» S w) («свободныеФ» ψ) (fun x hx => (hfr x hx).1)
  refine ⟨by simpa using hc.1, by simpa using hc.2.1, fun y hy => ?_⟩
  by_cases hym : y = m
  · subst hym; simp
  · simp only [«связать-имя», hym, ite_false]
    exact hc.2.2 y hy

theorem «найтиПоле-ключи» : ∀ (fs : List (String × «Значение»)), (fs.map Prod.fst).Nodup →
    ∀ q ∈ fs, «найтиПоле» q.1 fs = some q.2
  | [], _, q, hq => by simp at hq
  | p :: r, hn, q, hq => by
      simp only [List.map_cons, List.nodup_cons] at hn
      simp only [«найтиПоле»]
      rcases List.mem_cons.mp hq with rfl | hq'
      · simp
      · have hne : p.1 ≠ q.1 := fun e => hn.1 (e ▸ List.mem_map_of_mem hq')
        simp only [hne, ite_false]
        exact «найтиПоле-ключи» r hn.2 q hq'

theorem «связатьПоля-своё» (w : «Мир») (v : «Значение») : ∀ (bs : List (String × String)),
    (bs.map Prod.snd).Nodup → ∀ b ∈ bs, («связатьПоля» w bs v).«имя» b.2 = «полеЗнач» v b.1
  | [], _, b, hb => by simp at hb
  | c :: r, hn, b, hb => by
      simp only [List.map_cons, List.nodup_cons] at hn
      simp only [«связатьПоля», List.foldr_cons, «связать-имя»]
      rcases List.mem_cons.mp hb with rfl | hb'
      · simp
      · have hne : b.2 ≠ c.2 := fun e => hn.1 (e ▸ List.mem_map_of_mem hb')
        simp only [hne, ite_false]
        exact «связатьПоля-своё» w v r hn.2 b hb'

theorem «конструктор_образца» (w : «Мир») (k : String) (bs : List (String × String))
    (fs : List (String × «Значение»)) (hord : fs.map Prod.fst = bs.map Prod.fst)
    (hk : (fs.map Prod.fst).Nodup) (hn : (bs.map Prod.snd).Nodup)
    (hb : «привязать» w (.«поля» k bs) (.«сумма» k fs) = w) :
    («Значение».«сумма» k fs) = .«сумма» k (bs.map (fun b => (b.1, w.«имя» b.2))) := by
  congr 1
  apply List.ext_getElem
  · have := congrArg List.length hord; simpa using this
  · intro n h1 h2
    have hl : fs.length = bs.length := by have := congrArg List.length hord; simpa using this
    have hb2 : bs[n] ∈ bs := List.getElem_mem _
    have hf : fs[n].1 = bs[n].1 := by
      have := congrArg (fun l => l[n]?) hord
      simp [List.getElem?_map, List.getElem?_eq_getElem h1, List.getElem?_eq_getElem (by omega : n < bs.length)] at this
      exact this
    simp only [List.getElem_map]
    have hw : w.«имя» bs[n].2 = «полеЗнач» (.«сумма» k fs) bs[n].1 := by
      rw [← hb]; simp only [«привязать»]; exact «связатьПоля-своё» w _ bs hn _ hb2
    rw [hw]
    simp only [«полеЗнач»]
    rw [← hf, «найтиПоле-ключи» fs hk fs[n] (List.getElem_mem _)]
    simp

theorem «с_фактами_пути» (u : «Форм») (t : Bool) (w : «Мир») (h : «оценитьФ» u w = t) (f f' : «Форм»)
    (hz : «замФ» («кусок» u («литФ» t)) f f' = true) : «оценитьФ» f w = «оценитьФ» f' w :=
  «замФ-верно» _ w («кусок-верно» u («литФ» t) w (by rw [«литФ-значение», h])) f f' hz

theorem «деление» (F : List «Форм») (u f f1 f2 : «Форм»)
    (h1 : «замФ» («кусок» u .«да») f f1 = true) (h2 : «замФ» («кусок» u .«нет») f f2 = true)
    (c1 : ∀ w, «фактыВерны» F w → «оценитьФ» u w = true → «оценитьФ» f1 w = true)
    (c2 : ∀ w, «фактыВерны» F w → «оценитьФ» u w = false → «оценитьФ» f2 w = true) :
    ∀ w, «фактыВерны» F w → «оценитьФ» f w = true := by
  intro w hF
  cases hu : «оценитьФ» u w
  · rw [«с_фактами_пути» u false w hu f f2 h2]; exact c2 w hF hu
  · rw [«с_фактами_пути» u true w hu f f1 h1]; exact c1 w hF hu

def «развернутьВызов?» (d : «Определение») (f : String) (ds : «Доводы») : Option «Тело» :=
  if f = d.«имя» ∧ «объявленное» f = true ∧ («доводыСписком» ds).length = d.«параметры».length ∧
     «цепьЧистаТ» d.«тело» (d.«параметры».zip («доводыСписком» ds)) = true
  then some («подстПарТ» d.«тело» (d.«параметры».zip («доводыСписком» ds))) else none

theorem «развернуть_вызов_группы» (d : «Определение») (w : «Мир») (hd : «определение-есть» d w)
    {f : String} {ds : «Доводы»} {R : «Тело»} (h : «развернутьВызов?» d f ds = some R) :
    w.«функции» («вызываемая» w f) («оценитьД» ds w) = «значение» R w := by
  unfold «развернутьВызов?» at h
  split at h
  · rename_i hc
    obtain ⟨rfl, hob, hlen, hch⟩ := hc
    cases h
    rw [«вызываемая-объявленная» w hob, «оценитьД-списком»,
      hd ((«доводыСписком» ds).map (fun t => «значение» t w)) (by simp [hlen]),
      «связатьВсе-пары», «подстПарТ-значение» w _ _ hch]
  · cases h

def «развёрнутоОдним» (ds : List «Определение») (A B : «Тело») : Bool :=
  match «вызовТела?» A with
  | some (f, args) => ds.any (fun d =>
      match «развернутьВызов?» d f args with
      | some R => decide (B = «сортом» A R)
      | none => false)
  | none => false

theorem «половина_закрыта» (defs : List «Определение») (w : «Мир»)
    (hd : ∀ d ∈ defs, «определение-есть» d w) (f f' : «Форм»)
    (hz : «замФ» («развёрнутоОдним» defs) f f' = true) : «оценитьФ» f w = «оценитьФ» f' w := by
  apply «замФ-верно» _ w _ f f' hz
  intro A B h
  unfold «развёрнутоОдним» at h
  split at h
  · rename_i fn args hA
    obtain ⟨d, hdm, hdd⟩ := List.any_eq_true.mp h
    split at hdd
    · rename_i R hR
      simp only [decide_eq_true_eq] at hdd
      subst hdd
      exact «вызовТела?-значение» hA («развернуть_вызов_группы» d w (hd d hdm) hR)
    · cases hdd
  · cases h

def «обещание-есть» (g : String) (params : List String) (post : «Форм») : «Факт» «Мир» :=
  fun w => ∀ vs : List «Значение», vs.length = params.length →
    «оценитьФ» post («связатьВсе» («связать» w "результат" (w.«функции» g vs)) params vs) = true

theorem «факты_цели» (g : String) (params : List String) (post : «Форм») (args : «Доводы») (w : «Мир»)
    (hp : «обещание-есть» g params post w) (hob : «объявленное» g = true)
    (hl : («доводыСписком» args).length = params.length)
    (hc : «цепьЧиста» post (params.zip («доводыСписком» args) ++ [("результат", .«вызов» g args)]) = true) :
    «оценитьФ» («подстПар» post (params.zip («доводыСписком» args) ++ [("результат", .«вызов» g args)])) w = true := by
  rw [«подстПар-значение» w _ _ hc, List.foldr_append]
  simp only [List.foldr_cons, List.foldr_nil, «значение», «вызываемая-объявленная» w hob]
  have := hp ((«доводыСписком» args).map (fun t => «значение» t w)) (by simp [hl])
  rw [«связатьВсе-пары»] at this
  rw [«оценитьД-списком»]
  exact this

theorem «факты_цели-требует» (F : List «Форм») (f : «Форм») (w : «Мир») (hf : f ∈ F) (hF : «фактыВерны» F w) :
    «оценитьФ» f w = true := hF f hf

inductive «Закрыта» : List «Форм» → «Форм» → Prop where
  | «да» (F : List «Форм») : «Закрыта» F .«да»
  | «лист» (F : List «Форм») (f : «Форм») :
      (∀ w, «фактыВерны» F w → «оценитьФ» f w = true) → «Закрыта» F f
  | «переписка» (F : List «Форм») (f f' : «Форм») :
      (∀ w, «фактыВерны» F w → «оценитьФ» f w = «оценитьФ» f' w) → «Закрыта» F f' → «Закрыта» F f
  | «деление» (F : List «Форм») (u f f1 f2 : «Форм») :
      «замФ» («кусок» u .«да») f f1 = true → «замФ» («кусок» u .«нет») f f2 = true →
      «Закрыта» (u :: F) f1 → «Закрыта» (.«не» u :: F) f2 → «Закрыта» F f
  | «выборДа» (F : List «Форм») (u a b : «Форм») :
      (∀ w, «фактыВерны» F w → «оценитьФ» u w = true) → «Закрыта» F a → «Закрыта» F (.«еслиФ» u a b)
  | «выборНет» (F : List «Форм») (u a b : «Форм») :
      (∀ w, «фактыВерны» F w → «оценитьФ» u w = false) → «Закрыта» F b → «Закрыта» F (.«еслиФ» u a b)
  | «и» (F : List «Форм») (a b : «Форм») : «Закрыта» F a → «Закрыта» F b → «Закрыта» F (.«и» a b)
  | «илиЛево» (F : List «Форм») (a b : «Форм») : «Закрыта» F a → «Закрыта» F (.«или» a b)
  | «илиПраво» (F : List «Форм») (a b : «Форм») : «Закрыта» F b → «Закрыта» F (.«или» a b)

theorem «половина_закрыта_по» {F : List «Форм»} {f : «Форм»} (h : «Закрыта» F f) :
    ∀ w, «фактыВерны» F w → «оценитьФ» f w = true := by
  induction h with
  | «да» F => intro w _; rfl
  | «лист» F f hf => exact hf
  | «переписка» F f f' he _ ih => intro w hw; rw [he w hw]; exact ih w hw
  | «деление» F u f f1 f2 h1 h2 _ _ ih1 ih2 =>
    apply «деление» F u f f1 f2 h1 h2
    · intro w hw hu
      exact ih1 w (fun g hg => by
        rcases List.mem_cons.mp hg with rfl | hg'
        · exact hu
        · exact hw g hg')
    · intro w hw hu
      exact ih2 w (fun g hg => by
        rcases List.mem_cons.mp hg with rfl | hg'
        · simp [«оценитьФ», hu]
        · exact hw g hg')
  | «выборДа» F u a b hu _ ih => intro w hw; simp [«оценитьФ», hu w hw, ih w hw]
  | «выборНет» F u a b hu _ ih => intro w hw; simp [«оценитьФ», hu w hw, ih w hw]
  | «и» F a b _ _ iha ihb => intro w hw; simp [«оценитьФ», iha w hw, ihb w hw]
  | «илиЛево» F a b _ ih => intro w hw; simp [«оценитьФ», ih w hw]
  | «илиПраво» F a b _ ih => intro w hw; simp [«оценитьФ», ih w hw]

theorem «закон_признака» (a : «Форм») (w : «Мир») :
    «оценитьФ» (.«и» .«да» a) w = «оценитьФ» a w ∧ «оценитьФ» (.«и» a .«да») w = «оценитьФ» a w ∧
    «оценитьФ» (.«и» .«нет» a) w = false ∧ «оценитьФ» (.«и» a .«нет») w = false ∧
    «оценитьФ» (.«или» .«нет» a) w = «оценитьФ» a w ∧ «оценитьФ» (.«или» a .«нет») w = «оценитьФ» a w ∧
    «оценитьФ» (.«или» .«да» a) w = true ∧ «оценитьФ» (.«или» a .«да») w = true ∧
    «оценитьФ» (.«не» .«да») w = false ∧ «оценитьФ» (.«не» .«нет») w = true := by
  simp [«оценитьФ»]

theorem «половина-верно» : True := by
  have _ := @«зеркало_отношения»
  have _ := @«следствие_пары»
  have _ := @«следствие_промежутка»
  have _ := @«следствие_атома»
  have _ := @«применить_отношение»
  have _ := @«решить_не_меткой»
  have _ := @«метки_разошлись»
  have _ := @«без_метки»
  have _ := @«заменить_сторону»
  have _ := @«с_фактом»
  have _ := @«мера_в»
  have _ := @«длины_терма»
  have _ := @«отношение_длин»
  have _ := @«закрыть_кавычки»
  have _ := @«совпал_образец»
  have _ := @«разбор_в_половине»
  have _ := @«с_фактами_пути»
  have _ := @«деление»
  have _ := @«развернуть_вызов_группы»
  have _ := @«факты_цели»
  have _ := @«половина_закрыта»
  have _ := @«половина_закрыта_по»
  trivial
