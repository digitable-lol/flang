import Semantics.Examples

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

namespace «Эталон»

open «Д64»

def «Нн» (v : «Зн») : Prop := ∃ d, v = .«число» d ∧ «неБольше64» (.«кон» false 0) d = true

def «Кон» (v : «Зн») : Prop := ∃ s x, v = .«число» (.«кон» s x)

def «Пол» (v : «Зн») : Prop := ∃ x, v = .«число» (.«кон» false x) ∧ 0 < x

def «Верно» (Φ : «Зн» → Prop) (K : List String) (ρ : «Среда») : Prop :=
  ∀ x ∈ K, ∀ w, «найти» x ρ = some w → Φ w

abbrev «ВерноЗ» (K : List String) (ρ : «Среда») : Prop := «Верно» «Нн» K ρ

def «пол?» (Q : List String) : «Выр» → Bool
  | .«лит» (.«число» (.«кон» false x)) => decide (0 < x)
  | .«имя» y => Q.contains y
  | _ => false

def «без» (K xs : List String) : List String := K.filter (fun y => !xs.contains y)

def «тогдаПол» (F : List String) : «Выр» → List String
  | .«двучлен» op (.«имя» x) (.«лит» (.«число» (.«кон» false _))) => if op == "gt" && F.contains x then [x] else []
  | _ => []

def «иначеПол» (F : List String) : «Выр» → List String
  | .«двучлен» op (.«имя» x) (.«лит» (.«число» (.«кон» false _))) => if op == "lte" && F.contains x then [x] else []
  | _ => []

def «постНН?» (q : «Постусловие») : Bool :=
  match q.«выражение» with
  | .«двучлен» op (.«имя» y) (.«лит» (.«число» (.«кон» s k))) => op == "gte" && y == q.«связка» && !s && k == 0
  | _ => false

def «постНН-функции?» (P : «Программа») (g : String) : Bool :=
  match «функцияПрограммы» P g with
  | some h => h.«постусловия».any «постНН?»
  | none => false

mutual
def «нн» (P : «Программа») (S : List String) :
    Nat → List String → List String → List String → «Выр» → Bool
  | _, _, _, _, .«лит» (.«число» d) => «неБольше64» (.«кон» false 0) d
  | _, K, _, _, .«имя» x => K.contains x
  | d, K, F, Q, .«двучлен» op a b =>
    (op == "add" && («нн» P S d K F Q a && «нн» P S d K F Q b)) ||
      (op == "mul" && ((«пол?» Q a && «нн» P S d K F Q b) || («нн» P S d K F Q a && «пол?» Q b)))
  | d, K, F, Q, .«если» c t e =>
    «нн» P S d K F («тогдаПол» F c ++ Q) t && «нн» P S d K F («иначеПол» F c ++ Q) e
  | d, K, F, Q, .«пусть» x v b =>
    «нн» P S d (if «нн» P S d K F Q v then x :: K else «без» K [x]) («без» F [x]) («без» Q [x]) b
  | d, K, F, Q, .«вызов» g args =>
    (S.contains g && «постНН-функции?» P g) || (match d with
      | 0 => false
      | d' + 1 =>
        match «функцияПрограммы» P g with
        | some h => «нн» P S d' («ннИмена» P S (d' + 1) K F Q h.«параметры» args) [] [] h.«тело»
        | none => false)
  | d, K, F, Q, .«разбор» _ cs => «ннСлучаи» P S d K F Q cs
  | d, K, F, Q, .«свёртка» _ n a x s =>
    «нн» P S d K F Q n && «нн» P S d (a :: «без» K [a, x]) («без» F [a, x]) («без» Q [a, x]) s
  | _, _, _, _, .«форма» n _ => n.startsWith "#отказ "
  | _, _, _, _, _ => false
termination_by d _ _ _ e => (d, sizeOf e)
def «ннИмена» (P : «Программа») (S : List String) :
    Nat → List String → List String → List String → List String → List «Выр» → List String
  | d, K, F, Q, p :: ps, a :: as =>
    if «нн» P S d K F Q a then p :: «без» («ннИмена» P S d K F Q ps as) [p]
    else «без» («ннИмена» P S d K F Q ps as) [p]
  | _, _, _, _, _, _ => []
termination_by d _ _ _ _ as => (d, sizeOf as)
def «ннСлучаи» (P : «Программа») (S : List String) :
    Nat → List String → List String → List String → List («Образец» × «Выр») → Bool
  | _, _, _, _, [] => true
  | d, K, F, Q, (p, b) :: r =>
    «нн» P S d («без» K («связанные» p)) («без» F («связанные» p)) («без» Q («связанные» p)) b &&
      «ннСлучаи» P S d K F Q r
termination_by d _ _ _ cs => (d, sizeOf cs)
end

theorem «нн-кон» {s : Bool} {x : Nat} : «неБольше64» (.«кон» false 0) (.«кон» s x) = true ↔ 0 ≤ «вЕдиницах» s x := by
  simp [«неБольше64», «вЕдиницах»]

theorem «нн-округлить» (N D : Nat) : «неБольше64» (.«кон» false 0) («округлить» false N D) = true := by
  unfold «округлить»
  split <;> simp [«неБольше64», «вЕдиницах»]

theorem «нн-изЗнач» {x : Int} (hx : 0 ≤ x) (z : Bool) : «неБольше64» (.«кон» false 0) («изЗнач» x 1 z) = true := by
  unfold «изЗнач»
  split
  · cases z <;> simp [«неБольше64», «вЕдиницах»]
  · have h : decide (x < 0) = false := by simp; omega
    rw [h]
    exact «нн-округлить» _ _

theorem «нн-плюс» {a b : «Д64»} (ha : «неБольше64» (.«кон» false 0) a = true)
    (hb : «неБольше64» (.«кон» false 0) b = true) : «неБольше64» (.«кон» false 0) («плюс64» a b) = true := by
  cases a with
  | «нечисло» => simp [«неБольше64»] at ha
  | «беск» s =>
    cases b with
    | «нечисло» => simp [«неБольше64»] at hb
    | «беск» t => cases s <;> cases t <;> simp_all [«неБольше64», «плюс64»]
    | «кон» t y => cases s <;> simp_all [«неБольше64», «плюс64»]
  | «кон» s x =>
    cases b with
    | «нечисло» => simp [«неБольше64»] at hb
    | «беск» t => cases t <;> simp_all [«неБольше64», «плюс64»]
    | «кон» t y =>
      simp only [«плюс64»]
      rw [«нн-кон»] at ha hb
      exact «нн-изЗнач» (by omega) _

theorem «нн-умножить» {x : Nat} (hx : 0 < x) {b : «Д64»} (hb : «неБольше64» (.«кон» false 0) b = true) :
    «неБольше64» (.«кон» false 0) («безМинусНуля» («умножить64» (.«кон» false x) b)) = true ∧
      «неБольше64» (.«кон» false 0) («безМинусНуля» («умножить64» b (.«кон» false x))) = true := by
  cases b with
  | «нечисло» => simp [«неБольше64»] at hb
  | «беск» t =>
    have hx' : x ≠ 0 := by omega
    cases t <;> simp_all [«неБольше64», «умножить64», «безМинусНуля»]
  | «кон» t y =>
    rw [«нн-кон»] at hb
    by_cases hy : y = 0
    · subst hy
      cases t <;> simp [«умножить64», «безМинусНуля», «неБольше64», «вЕдиницах»]
    · have ht : t = false := by
        cases t
        · rfl
        · simp [«вЕдиницах»] at hb; omega
      subst ht
      have hxy : x * y ≠ 0 := Nat.mul_ne_zero (by omega) hy
      have hyx : y * x ≠ 0 := Nat.mul_ne_zero hy (by omega)
      constructor
      · simp only [«умножить64», hxy, ↓reduceIte, bne_self_eq_false]
        unfold «безМинусНуля»
        split
        · simp [«неБольше64», «вЕдиницах»]
        · rename_i hz; exact «нн-округлить» _ _
      · simp only [«умножить64», hyx, ↓reduceIte, bne_self_eq_false]
        unfold «безМинусНуля»
        split
        · simp [«неБольше64», «вЕдиницах»]
        · rename_i hz; exact «нн-округлить» _ _

theorem «двучлен-плюс» (x y : «Д64») : «двучлен» "add" (.«число» x) (.«число» y) = .ok (.«число» («плюс64» x y)) := by
  simp [«двучлен», «дробь?», «точно?», «разряды?», «счёт64»]

theorem «двучлен-умножить» (x y : «Д64») :
    «двучлен» "mul" (.«число» x) (.«число» y) = .ok (.«число» («безМинусНуля» («умножить64» x y))) := by
  simp [«двучлен», «дробь?», «точно?», «разряды?», «счёт64»]

theorem «двучлен-не-меньше-нуля» (w : «Зн») :
    «двучлен» "gte" w (.«число» (.«кон» false 0)) = .ok (.«признак» true) ↔ «Нн» w := by
  cases w with
  | «число» d => simp [«двучлен», «дробь?», «точно?», «разряды?», «порядок64», «Нн»]
  | «список» l =>
    constructor
    · intro h
      simp [«двучлен», «дробь?», «точно?», «разряды?», «беда»] at h
    · rintro ⟨d, hd, _⟩; cases hd
  | _ =>
    constructor
    · intro h
      simp [«двучлен», «дробь?», «точно?», «разряды?», «беда»] at h
    · rintro ⟨d, hd, _⟩; cases hd

theorem «ок-связь» {α β : Type} {x : Except «Сбой» α} {f : α → Except «Сбой» β} {v : β}
    (h : (x >>= f) = .ok v) : ∃ a, x = .ok a ∧ f a = .ok v := by
  cases x with
  | error e => cases h
  | ok a => exact ⟨a, rfl, h⟩

theorem «выч-лит» {P : «Программа»} {n : Nat} {ρ : «Среда»} {c w : «Зн»} (h : «выч» P n ρ (.«лит» c) = .ok w) :
    w = c := by
  cases n with
  | zero => cases h
  | succ n =>
    have h' : («шаг» P («выч» P n) ρ (.«лит» c)) = .ok w := h
    simp only [«шаг», Except.ok.injEq] at h'
    exact h'.symm

theorem «в-без» {K xs : List String} {y : String} (h : y ∈ «без» K xs) : y ∈ K ∧ y ∉ xs := by
  simp [«без»] at h
  exact h

theorem «выч-имя» {P : «Программа»} {n : Nat} {ρ : «Среда»} {x : String} {w : «Зн»}
    (h : «выч» P n ρ (.«имя» x) = .ok w) : «найти» x ρ = some w := by
  cases n with
  | zero => cases h
  | succ n =>
    have h' : («шаг» P («выч» P n) ρ (.«имя» x)) = .ok w := h
    simp only [«шаг»] at h'
    split at h'
    · rename_i u hu
      injection h' with h'
      rw [hu, h']
    · cases h'

theorem «пол-верно» {P : «Программа»} {Q : List String} {ρ : «Среда»} (hQ : «Верно» «Пол» Q ρ) {a : «Выр»}
    (h : «пол?» Q a = true) {n : Nat} {w : «Зн»} (hw : «выч» P n ρ a = .ok w) : «Пол» w := by
  unfold «пол?» at h
  split at h
  · rw [«выч-лит» hw]
    exact ⟨_, rfl, by simpa using h⟩
  · exact hQ _ (by simpa using h) w («выч-имя» hw)
  · cases h

theorem «больше-пол» {s : Bool} {v k : Nat}
    (h : «двучлен» "gt" (.«число» (.«кон» s v)) (.«число» (.«кон» false k)) = .ok (.«признак» true)) :
    «Пол» (.«число» (.«кон» s v)) := by
  simp [«двучлен», «дробь?», «точно?», «разряды?», «порядок64», «меньше64», «вЕдиницах»] at h
  cases s
  · exact ⟨v, rfl, by simp at h; omega⟩
  · simp at h; omega

theorem «не-больше-ложь-пол» {s : Bool} {v k : Nat}
    (h : «двучлен» "lte" (.«число» (.«кон» s v)) (.«число» (.«кон» false k)) = .ok (.«признак» false)) :
    «Пол» (.«число» (.«кон» s v)) := by
  simp [«двучлен», «дробь?», «точно?», «разряды?», «порядок64», «неБольше64», «вЕдиницах»] at h
  cases s
  · exact ⟨v, rfl, by simp at h; omega⟩
  · simp at h; omega

theorem «сравнение-с-литералом» {P : «Программа»} {n : Nat} {ρ : «Среда»} {op x : String} {k : Nat} {u : «Зн»}
    (h : «выч» P n ρ (.«двучлен» op (.«имя» x) (.«лит» (.«число» (.«кон» false k)))) = .ok u) :
    ∃ w, «найти» x ρ = some w ∧ «двучлен» op w (.«число» (.«кон» false k)) = .ok u := by
  cases n with
  | zero => cases h
  | succ n =>
    have h' : «шаг» P («выч» P n) ρ (.«двучлен» op (.«имя» x) (.«лит» (.«число» (.«кон» false k)))) = .ok u := h
    simp only [«шаг»] at h'
    obtain ⟨w, hw, h'⟩ := «ок-связь» h'
    obtain ⟨y, hy, h'⟩ := «ок-связь» h'
    rw [«выч-лит» hy] at h'
    exact ⟨w, «выч-имя» hw, h'⟩

theorem «тогда-верно» {P : «Программа»} {F Q : List String} {ρ : «Среда»} (hF : «Верно» «Кон» F ρ)
    (hQ : «Верно» «Пол» Q ρ) {n : Nat} {c : «Выр»} (hc : «выч» P n ρ c = .ok (.«признак» true)) :
    «Верно» «Пол» («тогдаПол» F c ++ Q) ρ := by
  intro y hy w hw
  rcases List.mem_append.mp hy with hy | hy
  · unfold «тогдаПол» at hy
    split at hy
    · rename_i op x k
      split at hy
      · rename_i hop
        simp only [Bool.and_eq_true, beq_iff_eq, List.contains_iff_mem] at hop
        obtain ⟨rfl, hx⟩ := hop
        simp only [List.mem_singleton] at hy
        subst hy
        obtain ⟨w', hw', hcmp⟩ := «сравнение-с-литералом» hc
        rw [hw] at hw'
        injection hw' with hw'
        subst hw'
        obtain ⟨s, v, rfl⟩ := hF _ hx w hw
        exact «больше-пол» hcmp
      · cases hy
    · cases hy
  · exact hQ y hy w hw

theorem «иначе-верно» {P : «Программа»} {F Q : List String} {ρ : «Среда»} (hF : «Верно» «Кон» F ρ)
    (hQ : «Верно» «Пол» Q ρ) {n : Nat} {c : «Выр»} (hc : «выч» P n ρ c = .ok (.«признак» false)) :
    «Верно» «Пол» («иначеПол» F c ++ Q) ρ := by
  intro y hy w hw
  rcases List.mem_append.mp hy with hy | hy
  · unfold «иначеПол» at hy
    split at hy
    · rename_i op x k
      split at hy
      · rename_i hop
        simp only [Bool.and_eq_true, beq_iff_eq, List.contains_iff_mem] at hop
        obtain ⟨rfl, hx⟩ := hop
        simp only [List.mem_singleton] at hy
        subst hy
        obtain ⟨w', hw', hcmp⟩ := «сравнение-с-литералом» hc
        rw [hw] at hw'
        injection hw' with hw'
        subst hw'
        obtain ⟨s, v, rfl⟩ := hF _ hx w hw
        exact «не-больше-ложь-пол» hcmp
      · cases hy
    · cases hy
  · exact hQ y hy w hw

theorem «верно-пусто» (Φ : «Зн» → Prop) (ρ : «Среда») : «Верно» Φ [] ρ := by
  intro y hy; cases hy

theorem «верно-пусть» {Φ : «Зн» → Prop} {K : List String} {ρ : «Среда»} (hK : «Верно» Φ K ρ) (x : String)
    (w : «Зн») : «Верно» Φ («без» K [x]) ((x, w) :: ρ) := by
  intro y hy w' hw'
  obtain ⟨hy1, hy2⟩ := «в-без» hy
  have hne : x ≠ y := fun e => hy2 (by simp [e])
  simp only [«найти», hne, ↓reduceIte] at hw'
  exact hK y hy1 w' hw'

theorem «верно-связанные» {Φ : «Зн» → Prop} {K xs : List String} {ρ bs : «Среда»} (hK : «Верно» Φ K ρ)
    (hkeys : ∀ k ∈ bs.map (·.1), k ∈ xs) : «Верно» Φ («без» K xs) (bs ++ ρ) := by
  intro y hy w hw
  obtain ⟨hy1, hy2⟩ := «в-без» hy
  have hm : «найти» y (bs ++ ρ) = «найти» y ρ :=
    «найти-мимо» y ρ bs (fun k hk e => hy2 (e ▸ hkeys k hk))
  rw [hm] at hw
  exact hK y hy1 w hw

theorem «верно-свёртки» {Φ : «Зн» → Prop} {K : List String} {ρ : «Среда»} (hK : «Верно» Φ K ρ) (a x : String)
    (u v : «Зн») : «Верно» Φ («без» K [a, x]) ((a, u) :: (x, v) :: ρ) := by
  intro y hy w hw
  obtain ⟨hy1, hy2⟩ := «в-без» hy
  have hya : a ≠ y := fun e => hy2 (by simp [e])
  have hyx : x ≠ y := fun e => hy2 (by simp [e])
  simp only [«найти», hya, hyx, ↓reduceIte] at hw
  exact hK y hy1 w hw

def «ВерноВсё» (K F Q : List String) (ρ : «Среда») : Prop :=
  «Верно» «Нн» K ρ ∧ «Верно» «Кон» F ρ ∧ «Верно» «Пол» Q ρ

theorem «постНН-вид» {q : «Постусловие»} (h : «постНН?» q = true) :
    q.«выражение» = .«двучлен» "gte" (.«имя» q.«связка») (.«лит» (.«число» (.«кон» false 0))) := by
  unfold «постНН?» at h
  split at h
  · rename_i op y s k he
    simp only [Bool.and_eq_true, beq_iff_eq, Bool.not_eq_true'] at h
    obtain ⟨⟨⟨rfl, rfl⟩, rfl⟩, rfl⟩ := h
    exact he
  · cases h

theorem «пост-нн» {P : «Программа»} {q : «Постусловие»} (hq : «постНН?» q = true) {n : Nat} {ρ : «Среда»} {w : «Зн»}
    (h : «выч» P n ((q.«связка», w) :: ρ) q.«выражение» = .ok (.«признак» true)) : «Нн» w := by
  rw [«постНН-вид» hq] at h
  cases n with
  | zero => cases h
  | succ n =>
    cases n with
    | zero => cases h
    | succ n =>
      have h' : «шаг» P («выч» P (n + 1)) ((q.«связка», w) :: ρ)
          (.«двучлен» "gte" (.«имя» q.«связка») (.«лит» (.«число» (.«кон» false 0)))) = .ok (.«признак» true) := h
      simp only [«шаг», «выч», «найти», ↓reduceIte] at h'
      exact («двучлен-не-меньше-нуля» w).mp h'

theorem «пост-нн-верно» (P : «Программа») {q : «Постусловие»} (hq : «постНН?» q = true) {m : Nat} (hm : 2 ≤ m)
    (ρ : «Среда») {w : «Зн»} (hw : «Нн» w) :
    «выч» P m ((q.«связка», w) :: ρ) q.«выражение» = .ok (.«признак» true) := by
  rw [«постНН-вид» hq]
  obtain ⟨k, rfl⟩ : ∃ k, m = k + 2 := ⟨m - 2, by omega⟩
  show «шаг» P («выч» P (k + 1)) ((q.«связка», w) :: ρ)
    (.«двучлен» "gte" (.«имя» q.«связка») (.«лит» (.«число» (.«кон» false 0)))) = .ok (.«признак» true)
  simp only [«шаг», «выч», «найти», ↓reduceIte]
  exact («двучлен-не-меньше-нуля» w).mpr hw

theorem «ннИмена-верны» (P : «Программа») (S : List String) (r : «Вычислитель») (d : Nat) (K F Q : List String)
    (ρ : «Среда») (H : ∀ a w, «нн» P S d K F Q a = true → r ρ a = .ok w → «Нн» w) :
    ∀ ps args vs, «вычВсе» r ρ args = .ok vs → «ВерноЗ» («ннИмена» P S d K F Q ps args) («привязать» ps vs)
  | [], args, vs, _ => by
    intro y hy
    cases args <;> simp [«ннИмена»] at hy
  | p :: ps, [], vs, _ => by
    intro y hy
    simp [«ннИмена»] at hy
  | p :: ps, a :: as, vs, h => by
    simp only [«вычВсе»] at h
    obtain ⟨w, hw, h⟩ := «ок-связь» h
    obtain ⟨ws, hws, h⟩ := «ок-связь» h
    have hvs : vs = w :: ws := by
      have h' : (Except.ok (w :: ws) : Except «Сбой» (List «Зн»)) = .ok vs := h
      injection h' with h'
      exact h'.symm
    subst hvs
    have ih := «ннИмена-верны» P S r d K F Q ρ H ps as ws hws
    have hrest : ∀ y ∈ «без» («ннИмена» P S d K F Q ps as) [p], ∀ w',
        «найти» y («привязать» (p :: ps) (w :: ws)) = some w' → «Нн» w' := by
      intro y hy w' hw'
      obtain ⟨hy1, hy2⟩ := «в-без» hy
      have hne : p ≠ y := fun e => hy2 (by simp [e])
      simp only [«привязать», List.zip_cons_cons, «найти», hne, ↓reduceIte] at hw'
      exact ih y hy1 w' hw'
    intro y hy w' hw'
    simp only [«ннИмена»] at hy
    split at hy
    · rename_i ha
      rcases List.mem_cons.mp hy with rfl | hy
      · simp only [«привязать», List.zip_cons_cons, «найти», ↓reduceIte, Option.some.injEq] at hw'
        subst hw'
        exact H a w ha hw
      · exact hrest y hy w' hw'
    · exact hrest y hy w' hw'

theorem «разобрать-нн» (P : «Программа») (S : List String) (r : «Вычислитель») (d : Nat) (v0 v : «Зн»)
    (H : ∀ K F Q ρ e w, «ВерноВсё» K F Q ρ → «нн» P S d K F Q e = true → r ρ e = .ok w → «Нн» w) :
    ∀ K F Q ρ cs, «ВерноВсё» K F Q ρ → «ннСлучаи» P S d K F Q cs = true → «разобрать» r ρ v0 cs = .ok v → «Нн» v
  | K, F, Q, ρ, [], _, _, h => by simp [«разобрать», «беда»] at h
  | K, F, Q, ρ, (p, b) :: cs, hK, hc, h => by
    simp only [«ннСлучаи», Bool.and_eq_true] at hc
    unfold «разобрать» at h
    split at h
    · cases h
    · rename_i bs hbs
      simp only [«вставить»] at h
      have hkeys := «подходит-ключи» p v0 bs hbs
      exact H _ _ _ _ b v ⟨«верно-связанные» hK.1 hkeys, «верно-связанные» hK.2.1 hkeys,
        «верно-связанные» hK.2.2 hkeys⟩ hc.1 h
    · exact «разобрать-нн» P S r d v0 v H K F Q ρ cs hK hc.2 h

theorem «свернуть-нн» (P : «Программа») (S : List String) (r : «Вычислитель») (d : Nat) (K F Q : List String)
    (ρ : «Среда») (a x : String) (s : «Выр») (hK : «ВерноВсё» K F Q ρ)
    (hs : «нн» P S d (a :: «без» K [a, x]) («без» F [a, x]) («без» Q [a, x]) s = true)
    (H : ∀ K' F' Q' ρ' w, «ВерноВсё» K' F' Q' ρ' → «нн» P S d K' F' Q' s = true → r ρ' s = .ok w → «Нн» w) :
    ∀ xs acc v, «Нн» acc → «свернуть» r ρ a x s acc xs = .ok v → «Нн» v
  | [], acc, v, ha, h => by
    simp only [«свернуть», Except.ok.injEq] at h
    subst h; exact ha
  | el :: xs, acc, v, ha, h => by
    simp only [«свернуть»] at h
    obtain ⟨acc', h1, h⟩ := «ок-связь» h
    refine «свернуть-нн» P S r d K F Q ρ a x s hK hs H xs acc' v ?_ h
    refine H _ _ _ _ acc' ⟨?_, «верно-свёртки» hK.2.1 a x acc el, «верно-свёртки» hK.2.2 a x acc el⟩ hs h1
    intro y hy w hw
    rcases List.mem_cons.mp hy with rfl | hy
    · simp only [«найти», ↓reduceIte, Option.some.injEq] at hw
      subst hw; exact ha
    · exact «верно-свёртки» hK.1 a x acc el y hy w hw

theorem «тело-нн» (P : «Программа») {g : «Функция»} {q : «Постусловие»} (hqm : q ∈ g.«постусловия»)
    (hq : «постНН?» q = true) {n : Nat} {ρ : «Среда»} {v : «Зн»}
    (h : «вызватьТело» («выч» P n) g ρ = .ok v) : «Нн» v := by
  unfold «вызватьТело» at h
  obtain ⟨w, hw, hp⟩ := «ок-связь» h
  obtain ⟨rfl, hall⟩ := «пост-верны» («выч» P n) ρ w v g.«постусловия» hp
  exact «пост-нн» hq (hall q hqm)

theorem «нн-верно» (P : «Программа») (S : List String) :
    ∀ n d K F Q ρ e v, «ВерноВсё» K F Q ρ → «нн» P S d K F Q e = true → «выч» P n ρ e = .ok v → «Нн» v := by
  intro n
  induction n with
  | zero => intro d K F Q ρ e v _ _ h; cases h
  | succ n ih =>
    intro d K F Q ρ e v hK he hv
    have hv' : «шаг» P («выч» P n) ρ e = .ok v := hv
    clear hv
    cases e with
    | «лит» c =>
      cases c
      case «число» dd =>
        simp only [«нн»] at he
        simp only [«шаг», Except.ok.injEq] at hv'
        exact ⟨dd, hv'.symm, he⟩
      all_goals simp [«нн»] at he
    | «имя» x =>
      simp only [«нн», List.contains_iff_mem] at he
      simp only [«шаг»] at hv'
      split at hv'
      · rename_i w hw
        injection hv' with hv'
        subst hv'
        exact hK.1 x he w hw
      · cases hv'
    | «двучлен» op a b =>
      simp only [«шаг»] at hv'
      obtain ⟨x, hx, hv'⟩ := «ок-связь» hv'
      obtain ⟨y, hy, hv'⟩ := «ок-связь» hv'
      simp only [«нн», Bool.or_eq_true, Bool.and_eq_true, beq_iff_eq] at he
      rcases he with ⟨rfl, ha, hb⟩ | ⟨rfl, hab⟩
      · obtain ⟨dx, rfl, hdx⟩ := ih d K F Q ρ a x hK ha hx
        obtain ⟨dy, rfl, hdy⟩ := ih d K F Q ρ b y hK hb hy
        rw [«двучлен-плюс»] at hv'
        injection hv' with hv'
        subst hv'
        exact ⟨_, rfl, «нн-плюс» hdx hdy⟩
      · rcases hab with ⟨hpa, hb⟩ | ⟨ha, hpb⟩
        · obtain ⟨xx, rfl, hxx⟩ := «пол-верно» hK.2.2 hpa hx
          obtain ⟨dy, rfl, hdy⟩ := ih d K F Q ρ b y hK hb hy
          rw [«двучлен-умножить»] at hv'
          injection hv' with hv'
          subst hv'
          exact ⟨_, rfl, («нн-умножить» hxx hdy).1⟩
        · obtain ⟨yy, rfl, hyy⟩ := «пол-верно» hK.2.2 hpb hy
          obtain ⟨dx, rfl, hdx⟩ := ih d K F Q ρ a x hK ha hx
          rw [«двучлен-умножить»] at hv'
          injection hv' with hv'
          subst hv'
          exact ⟨_, rfl, («нн-умножить» hyy hdx).2⟩
    | «если» c t e =>
      simp only [«шаг»] at hv'
      obtain ⟨u, hu, hv'⟩ := «ок-связь» hv'
      simp only [«нн», Bool.and_eq_true] at he
      split at hv'
      · exact ih d K F _ ρ t v ⟨hK.1, hK.2.1, «тогда-верно» hK.2.1 hK.2.2 hu⟩ he.1 hv'
      · exact ih d K F _ ρ e v ⟨hK.1, hK.2.1, «иначе-верно» hK.2.1 hK.2.2 hu⟩ he.2 hv'
      · cases hv'
    | «пусть» x v0 b =>
      simp only [«шаг»] at hv'
      obtain ⟨w, hw, hv'⟩ := «ок-связь» hv'
      simp only [«нн»] at he
      refine ih d _ _ _ ((x, w) :: ρ) b v ⟨?_, «верно-пусть» hK.2.1 x w, «верно-пусть» hK.2.2 x w⟩ he hv'
      split
      · rename_i hvn
        intro y hy w' hw'
        simp only [«найти»] at hw'
        split at hw'
        · injection hw' with hw'
          subst hw'
          exact ih d K F Q ρ v0 w hK hvn hw
        · rename_i hne
          rcases List.mem_cons.mp hy with rfl | hy
          · exact absurd rfl hne
          · exact hK.1 y hy w' hw'
      · exact «верно-пусть» hK.1 x w
    | «вызов» g args =>
      simp only [«шаг»] at hv'
      obtain ⟨vs, hvs, hv'⟩ := «ок-связь» hv'
      unfold «нн» at he
      simp only [Bool.or_eq_true, Bool.and_eq_true] at he
      rcases he with ⟨_, hpg⟩ | he
      · unfold «постНН-функции?» at hpg
        cases hg : «функцияПрограммы» P g with
        | none => rw [hg] at hpg; cases hpg
        | some h =>
          rw [hg] at hpg hv'
          simp only [List.any_eq_true] at hpg
          obtain ⟨q, hqm, hq⟩ := hpg
          simp only at hv'
          split at hv'
          · exact «тело-нн» P hqm hq hv'
          · cases hv'
      · cases d with
        | zero => simp at he
        | succ d' =>
          cases hg : «функцияПрограммы» P g with
          | none => rw [hg] at he; simp at he
          | some h =>
            rw [hg] at he hv'
            simp only at he hv'
            split at hv'
            · unfold «вызватьТело» at hv'
              obtain ⟨w, hw, hp⟩ := «ок-связь» hv'
              obtain ⟨hvw, _⟩ := «пост-верны» («выч» P n) _ w v h.«постусловия» hp
              rw [hvw]
              refine ih d' _ [] [] _ h.«тело» w ⟨?_, «верно-пусто» _ _, «верно-пусто» _ _⟩ he hw
              exact «ннИмена-верны» P S («выч» P n) (d' + 1) K F Q ρ
                (fun a w ha hw => ih (d' + 1) K F Q ρ a w hK ha hw) h.«параметры» args vs hvs
            · cases hv'
    | «разбор» t cs =>
      simp only [«шаг»] at hv'
      obtain ⟨v0, hv0, hv'⟩ := «ок-связь» hv'
      simp only [«нн»] at he
      exact «разобрать-нн» P S («выч» P n) d v0 v (fun K F Q ρ e w hK he hw => ih d K F Q ρ e w hK he hw)
        K F Q ρ cs hK he hv'
    | «свёртка» l n0 a x s =>
      simp only [«шаг»] at hv'
      obtain ⟨lv, hlv, hv'⟩ := «ок-связь» hv'
      obtain ⟨nv, hnv, hv'⟩ := «ок-связь» hv'
      simp only [«нн», Bool.and_eq_true] at he
      split at hv'
      · exact «свернуть-нн» P S («выч» P n) d K F Q ρ a x s hK he.2
          (fun K' F' Q' ρ' w hK' hs hw => ih d K' F' Q' ρ' s w hK' hs hw)
          _ nv v (ih d K F Q ρ n0 nv hK he.1 hnv) hv'
      · cases hv'
    | «форма» nm args =>
      simp only [«шаг»] at hv'
      obtain ⟨vs, hvs, hv'⟩ := «ок-связь» hv'
      simp only [«нн»] at he
      unfold «форма» at hv'
      rw [ite_eq_left_of_eq_true _ _ (by simp [he])] at hv'
      cases hv'
    | «отобразить» _ _ _ => simp [«нн»] at he
    | «отфильтровать» _ _ _ => simp [«нн»] at he
    | «список» _ => simp [«нн»] at he
    | «запись» _ => simp [«нн»] at he
    | «конструктор» _ _ => simp [«нн»] at he
    | «поле» _ _ => simp [«нн»] at he
    | «ссылка» _ _ => simp [«нн»] at he
    | «применить» _ _ => simp [«нн»] at he

def «глубинаРазвёртки» : Nat := 2

def «принятьНеотрицательность» (P : «Программа») («строки» : List String) (S : List String) (f «имя» : String)
    («строка» : Nat) (K F : List String) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    K.all (g.«параметры».contains ·) && F.all (g.«параметры».contains ·) &&
      (decide («хозяинСтроки» «строки» «строка» = some f) &&
        ((«строкаИсходника» «строки» «строка»).endsWith ("обеспечивает «" ++ «имя» ++ "» результат не меньше 0") &&
          (g.«постусловия».any «постНН?» && «нн» P S «глубинаРазвёртки» K F [] g.«тело»)))

def «неотрицательныеВместе» (P : «Программа») (K F : String → List String) :
    Nat → List String → List String
  | 0, S => S
  | k + 1, S =>
    let T := S.filter (fun g =>
      match «функцияПрограммы» P g with
      | some h => «нн» P S «глубинаРазвёртки» (K g) (F g) [] h.«тело»
      | none => false)
    if T.length = S.length then S else «неотрицательныеВместе» P K F k T

theorem «неотрицательность-по-построению» (P : «Программа») («строки» : List String) (S : List String)
    (f «имя» : String) («строка» : Nat) (K F : List String)
    (h : «принятьНеотрицательность» P «строки» S f «имя» «строка» K F = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧ (∀ x ∈ K, x ∈ g.«параметры») ∧ (∀ x ∈ F, x ∈ g.«параметры») ∧
      «хозяинСтроки» «строки» «строка» = some f ∧
      («строкаИсходника» «строки» «строка»).endsWith ("обеспечивает «" ++ «имя» ++ "» результат не меньше 0") = true ∧
      (∃ q ∈ g.«постусловия», «постНН?» q = true) ∧
      ∀ m ρ v, «ВерноЗ» K ρ → «Верно» «Кон» F ρ → «выч» P m ρ g.«тело» = .ok v →
        «Нн» v ∧ ∀ q ∈ g.«постусловия», «постНН?» q = true → ∀ m', 2 ≤ m' →
          «выч» P m' ((q.«связка», v) :: ρ) q.«выражение» = .ok (.«признак» true) := by
  unfold «принятьНеотрицательность» at h
  cases hg : «функцияПрограммы» P f with
  | none => rw [hg] at h; cases h
  | some g =>
    rw [hg] at h
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true, List.any_eq_true, List.contains_iff_mem] at h
    obtain ⟨⟨hK, hF⟩, hown, hline, hq, hb⟩ := h
    refine ⟨g, rfl, hK, hF, hown, hline, hq, fun m ρ v hρ hφ hv => ?_⟩
    have hn := «нн-верно» P S m «глубинаРазвёртки» K F [] ρ g.«тело» v ⟨hρ, hφ, «верно-пусто» _ _⟩ hb hv
    exact ⟨hn, fun q _ hq' m' hm' => «пост-нн-верно» P hq' hm' ρ hn⟩

namespace «ПробыНеотрицательности»

def «ноль» : «Выр» := .«лит» (.«число» (.«кон» false 0))

def «один» : «Выр» := .«лит» (.«число» (.«кон» false 1))

def «пост» : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY",
    «выражение» := .«двучлен» "gte" (.«имя» "результат") «ноль» }

def «сумма» (op : String) : «Функция» :=
  { «имя» := "Сумма до", «параметры» := ["н"],
    «тело» := .«если» (.«двучлен» "lte" (.«имя» "н") «ноль») «ноль»
      (.«двучлен» op (.«имя» "н") (.«вызов» "Сумма до" [.«двучлен» "sub" (.«имя» "н") «один»])),
    «постусловия» := [«пост»] }

def «сколько» (s : «Выр») : «Функция» :=
  { «имя» := "Сколько", «параметры» := ["л"],
    «тело» := .«свёртка» (.«имя» "л") «ноль» "акк" "эл" s, «постусловия» := [«пост»] }

def «исходник» : List String :=
  ["тотальная функция «Сумма до»", "  принимает н: нат", "  обеспечивает «сумма до неотрицательна» результат не меньше 0"]

#guard «постНН?» «пост»
#guard !«постНН?» { «пост» with «выражение» := .«двучлен» "gt" (.«имя» "результат") «ноль» }
#guard !«постНН?» { «пост» with «связка» := "р" }
def «факториал» (c : «Выр») (t e : «Выр» → «Выр») : «Функция» :=
  { «имя» := "Факториал", «параметры» := ["н"],
    «тело» := .«если» c (t (.«двучлен» "mul" (.«имя» "н") (.«вызов» "Факториал" [.«двучлен» "sub" (.«имя» "н") «один»])))
      (e (.«двучлен» "mul" (.«имя» "н") (.«вызов» "Факториал" [.«двучлен» "sub" (.«имя» "н") «один»]))),
    «постусловия» := [«пост»] }

def «спуск» : «Выр» → «Выр» := id

def «один?» : «Выр» → «Выр» := fun _ => «один»

def «не больше одного» : «Выр» := .«двучлен» "lte" (.«имя» "н") «один»

def «больше одного» : «Выр» := .«двучлен» "gt" (.«имя» "н") «один»

#guard «постНН?» «пост»
#guard !«постНН?» { «пост» with «выражение» := .«двучлен» "gt" (.«имя» "результат") «ноль» }
#guard !«постНН?» { «пост» with «связка» := "р" }
#guard «нн» [«сумма» "add"] ["Сумма до"] 2 ["н"] [] [] («сумма» "add").«тело»
#guard !«нн» [«сумма» "add"] ["Сумма до"] 2 [] [] [] («сумма» "add").«тело»
#guard !«нн» [«сумма» "add"] [] 2 ["н"] [] [] («сумма» "add").«тело»
#guard !«нн» [«сумма» "sub"] ["Сумма до"] 2 ["н"] [] [] («сумма» "sub").«тело»
#guard !«нн» [«сумма» "mul"] ["Сумма до"] 2 ["н"] [] [] («сумма» "mul").«тело»
#guard «нн» [] [] 2 [] [] [] (.«двучлен» "mul" «один» (.«имя» "н")) = false
#guard «нн» [] [] 2 ["н"] [] [] (.«двучлен» "mul" «один» (.«имя» "н"))
#guard !«нн» [] [] 2 ["н"] [] [] (.«двучлен» "mul" «ноль» (.«имя» "н"))
#guard «нн» [] [] 2 ["л"] [] [] (.«пусть» "л" (.«двучлен» "sub" «ноль» «один») (.«имя» "л")) = false
#guard «нн» [«сколько» (.«двучлен» "add" (.«имя» "акк") «один»)] [] 2 [] [] []
  («сколько» (.«двучлен» "add" (.«имя» "акк") «один»)).«тело»
#guard !«нн» [«сколько» (.«имя» "эл")] [] 2 [] [] [] («сколько» (.«имя» "эл")).«тело»
#guard !«нн» [«сколько» (.«имя» "эл")] [] 2 ["эл"] [] [] («сколько» (.«имя» "эл")).«тело»
#guard «нн» [«факториал» «не больше одного» «один?» «спуск»] ["Факториал"] 2 ["н"] ["н"] []
  («факториал» «не больше одного» «один?» «спуск»).«тело»
#guard «нн» [«факториал» «больше одного» «спуск» «один?»] ["Факториал"] 2 ["н"] ["н"] []
  («факториал» «больше одного» «спуск» «один?»).«тело»
#guard !«нн» [«факториал» «не больше одного» «один?» «спуск»] ["Факториал"] 2 ["н"] [] []
  («факториал» «не больше одного» «один?» «спуск»).«тело»
#guard !«нн» [«факториал» «не больше одного» «спуск» «один?»] ["Факториал"] 2 ["н"] ["н"] []
  («факториал» «не больше одного» «спуск» «один?»).«тело»
#guard !«нн» [«факториал» «больше одного» «один?» «спуск»] ["Факториал"] 2 ["н"] ["н"] []
  («факториал» «больше одного» «один?» «спуск»).«тело»
#guard !«нн» [«факториал» (.«двучлен» "lte" (.«имя» "н") (.«лит» (.«число» (.«кон» true 1)))) «один?» «спуск»]
  ["Факториал"] 2 ["н"] ["н"] []
  («факториал» (.«двучлен» "lte" (.«имя» "н") (.«лит» (.«число» (.«кон» true 1)))) «один?» «спуск»).«тело»
#guard !«нн» [«факториал» (.«двучлен» "lte" (.«имя» "м") «один») «один?» «спуск»] ["Факториал"] 2 ["н"] ["н", "м"] []
  («факториал» (.«двучлен» "lte" (.«имя» "м") «один») «один?» «спуск»).«тело»
#guard !«нн» [«факториал» «не больше одного» «один?» «спуск»] ["Факториал"] 2 ["н"] ["н"] []
  (.«если» «не больше одного» «один»
    (.«пусть» "н" (.«лит» (.«число» (.«беск» false)))
      (.«двучлен» "mul" (.«имя» "н") (.«вызов» "Факториал" [«ноль»]))))
#guard «принятьНеотрицательность» [«сумма» "add"] «исходник» ["Сумма до"] "Сумма до" "сумма до неотрицательна" 3 ["н"] []
#guard !«принятьНеотрицательность» [«сумма» "add"] «исходник» ["Сумма до"] "Сумма до" "сумма до неотрицательна" 2 ["н"] []
#guard !«принятьНеотрицательность» [«сумма» "add"] «исходник» ["Сумма до"] "Сумма до" "сумма до неотрицательна" 3 ["м"] []
#guard !«принятьНеотрицательность» [«сумма» "add"] «исходник» ["Сумма до"] "Сумма до" "сумма до неотрицательна" 3 ["н"] ["м"]
#guard «неотрицательныеВместе» [«сумма» "add"] (fun _ => ["н"]) (fun _ => []) 4 ["Сумма до"] = ["Сумма до"]
#guard «неотрицательныеВместе» [«сумма» "sub"] (fun _ => ["н"]) (fun _ => []) 4 ["Сумма до"] = []

end «ПробыНеотрицательности»

end «Эталон»
