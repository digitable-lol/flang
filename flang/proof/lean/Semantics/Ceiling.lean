import Semantics.Nonnegative

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

namespace «Эталон»

open «Д64»

def «длинаЗн» : «Зн» → Option Nat
  | .«строка» s => some s.length
  | .«список» l => some l.length
  | _ => none

def «Влезает» (w : «Зн») (n : Nat) : Prop := ∃ k, «длинаЗн» w = some k ∧ k ≤ n

def «ВерноП» (M : List (String × Nat)) (T : List String) (ρ : «Среда») : Prop :=
  (∀ x n, (x, n) ∈ M → ∀ w, «найти» x ρ = some w → «Влезает» w n) ∧
  (∀ x ∈ T, ∀ w, «найти» x ρ = some w → ∃ s, w = .«строка» s)

def «безП» (M : List (String × Nat)) (xs : List String) : List (String × Nat) :=
  M.filter (fun e => !xs.contains e.1)

def «головаСтроки» : «Образец» → List (String × Nat)
  | .«звено» (some h) _ => [(h, 1)]
  | _ => []

def «границаИмени» (M : List (String × Nat)) (x : String) : Option Nat :=
  (M.find? (fun e => e.1 == x)).map (·.2)

mutual
def «потолок» (M : List (String × Nat)) (T : List String) : «Выр» → Option Nat
  | .«лит» (.«строка» s) => some s.length
  | .«имя» x => «границаИмени» M x
  | .«если» _ t e =>
    match «потолок» M T t, «потолок» M T e with
    | some a, some b => some (max a b)
    | _, _ => none
  | .«разбор» (.«имя» t) cs => «потолокСлучаев» M T (T.contains t) cs
  | _ => none
def «потолокСлучаев» (M : List (String × Nat)) (T : List String) (str : Bool) :
    List («Образец» × «Выр») → Option Nat
  | [] => some 0
  | (p, b) :: r =>
    match «потолок» ((if str then «головаСтроки» p else []) ++ «безП» M («связанные» p))
        (T.filter (fun y => !(«связанные» p).contains y)) b, «потолокСлучаев» M T str r with
    | some a, some c => some (max a c)
    | _, _ => none
end

theorem «влезает-шире» {w : «Зн»} {a b : Nat} (h : «Влезает» w a) (hab : a ≤ b) : «Влезает» w b := by
  obtain ⟨k, hk, hka⟩ := h
  exact ⟨k, hk, by omega⟩

theorem «граница-верна» {M : List (String × Nat)} {x : String} {n : Nat} (h : «границаИмени» M x = some n) :
    (x, n) ∈ M := by
  unfold «границаИмени» at h
  cases hf : M.find? (fun e => e.1 == x) with
  | none => rw [hf] at h; cases h
  | some e =>
    rw [hf] at h
    simp only [Option.map_some, Option.some.injEq] at h
    have hm := List.mem_of_find?_eq_some hf
    have he := List.find?_some hf
    simp only [beq_iff_eq] at he
    obtain ⟨a, b⟩ := e
    simp only at h he
    subst h he
    exact hm

theorem «верноП-случай» {M : List (String × Nat)} {T : List String} {ρ : «Среда»} (hP : «ВерноП» M T ρ)
    (p : «Образец») (v0 : «Зн») (bs : «Среда») (hbs : «подходит» p v0 = .ok (some bs))
    (str : Bool) (hstr : str = true → ∃ s, v0 = .«строка» s) :
    «ВерноП» ((if str then «головаСтроки» p else []) ++ «безП» M («связанные» p))
      (T.filter (fun y => !(«связанные» p).contains y)) (bs ++ ρ) := by
  have hkeys := «подходит-ключи» p v0 bs hbs
  have hmimo : ∀ y, y ∉ «связанные» p → «найти» y (bs ++ ρ) = «найти» y ρ :=
    fun y hy => «найти-мимо» y ρ bs (fun k hk e => hy (e ▸ hkeys k hk))
  constructor
  · intro x n hx w hw
    rcases List.mem_append.mp hx with hx | hx
    · cases str with
      | false => simp at hx
      | true =>
        obtain ⟨s, rfl⟩ := hstr rfl
        cases p with
        | «звено» h t =>
          cases h with
          | none => simp [«головаСтроки»] at hx
          | some h =>
            simp only [«головаСтроки», ↓reduceIte, List.mem_singleton, Prod.mk.injEq] at hx
            obtain ⟨rfl, rfl⟩ := hx
            simp only [«подходит»] at hbs
            split at hbs
            · cases hbs
            · rename_i c r hc
              simp only [Except.ok.injEq, Option.some.injEq] at hbs
              subst hbs
              simp only [List.cons_append, «найти», ↓reduceIte, Option.some.injEq] at hw
              subst hw
              exact ⟨1, by simp [«длинаЗн», String.length_singleton], Nat.le_refl _⟩
        | _ => simp [«головаСтроки»] at hx
    · simp only [«безП», List.mem_filter] at hx
      obtain ⟨hx1, hx2⟩ := hx
      have hnb : x ∉ «связанные» p := by simpa using hx2
      rw [hmimo x hnb] at hw
      exact hP.1 x n hx1 w hw
  · intro x hx w hw
    simp only [List.mem_filter, Bool.not_eq_true'] at hx
    have hnb : x ∉ «связанные» p := by simpa using hx.2
    rw [hmimo x hnb] at hw
    exact hP.2 x hx.1 w hw

theorem «потолок-верен» (P : «Программа») :
    ∀ n M T ρ e v B, «ВерноП» M T ρ → «потолок» M T e = some B → «выч» P n ρ e = .ok v → «Влезает» v B := by
  intro n
  induction n with
  | zero => intro M T ρ e v B _ _ h; cases h
  | succ n ih =>
    intro M T ρ e v B hP he hv
    have hv' : «шаг» P («выч» P n) ρ e = .ok v := hv
    clear hv
    cases e with
    | «лит» c =>
      cases c
      case «строка» s =>
        simp only [«потолок», Option.some.injEq] at he
        simp only [«шаг», Except.ok.injEq] at hv'
        subst hv' he
        exact ⟨s.length, rfl, Nat.le_refl _⟩
      all_goals simp [«потолок»] at he
    | «имя» x =>
      simp only [«потолок»] at he
      simp only [«шаг»] at hv'
      split at hv'
      · rename_i w hw
        injection hv' with hv'
        subst hv'
        exact hP.1 x B («граница-верна» he) w hw
      · cases hv'
    | «если» c t e =>
      simp only [«потолок»] at he
      split at he
      · rename_i a b ha hb
        simp only [Option.some.injEq] at he
        subst he
        simp only [«шаг»] at hv'
        obtain ⟨u, hu, hv'⟩ := «ок-связь» hv'
        split at hv'
        · exact «влезает-шире» (ih M T ρ t v a hP ha hv') (Nat.le_max_left a b)
        · exact «влезает-шире» (ih M T ρ e v b hP hb hv') (Nat.le_max_right a b)
        · cases hv'
      · cases he
    | «разбор» t cs =>
      cases t
      case «имя» x =>
        simp only [«потолок»] at he
        simp only [«шаг»] at hv'
        obtain ⟨v0, hv0, hv'⟩ := «ок-связь» hv'
        have hstr : (T.contains x) = true → ∃ s, v0 = .«строка» s := by
          intro hx
          simp only [List.contains_iff_mem] at hx
          cases n with
          | zero => cases hv0
          | succ n =>
            have hv0' : «шаг» P («выч» P n) ρ (.«имя» x) = .ok v0 := hv0
            simp only [«шаг»] at hv0'
            split at hv0'
            · rename_i w hw
              injection hv0' with hv0'
              subst hv0'
              exact hP.2 x hx w hw
            · cases hv0'
        have key : ∀ cs B, «потолокСлучаев» M T (T.contains x) cs = some B →
            «разобрать» («выч» P n) ρ v0 cs = .ok v → «Влезает» v B := by
          intro cs
          induction cs with
          | nil => intro B _ h; simp [«разобрать», «беда»] at h
          | cons c r ihc =>
            intro B hc h
            obtain ⟨p, b⟩ := c
            simp only [«потолокСлучаев»] at hc
            split at hc
            · rename_i a d ha hd
              simp only [Option.some.injEq] at hc
              subst hc
              unfold «разобрать» at h
              split at h
              · cases h
              · rename_i bs hbs
                exact «влезает-шире» (ih _ _ (bs ++ ρ) b v a («верноП-случай» hP p v0 bs hbs _ hstr) ha h)
                  (Nat.le_max_left a d)
              · exact «влезает-шире» (ihc d hd h) (Nat.le_max_right a d)
            · cases hc
        exact key cs B he hv'
      all_goals simp [«потолок»] at he
    | _ => simp [«потолок»] at he

theorem «целое-литерал» (k : Nat) : «дробьВД64» false k 0 = «изЦелого» k := by
  unfold «дробьВД64» «изЦелого» «изЗнач»
  by_cases hk : k = 0
  · subst hk; simp
  · have hs := _root_.«шаг-полож»
    have h1 : ((k : Int) * (_root_.«шаг» : Int)) ≠ 0 := Int.mul_ne_zero (by exact_mod_cast hk) (by omega)
    have h2 : ¬ ((k : Int) * (_root_.«шаг» : Int) < 0) := by
      have : (0 : Int) ≤ (k : Int) * (_root_.«шаг» : Int) := Int.mul_nonneg (by omega) (by omega)
      omega
    simp only [hk, h1, h2, ↓reduceIte, decide_false]
    have h3 : ((k : Int) * (_root_.«шаг» : Int)).natAbs = k * _root_.«шаг» := by
      rw [Int.natAbs_mul]; simp
    rw [h3]
    simp

theorem «округлить-моно» {N1 N2 : Nat} (h : N1 ≤ N2) :
    «неБольше64» («округлить» false N1 1) («округлить» false N2 1) = true := by
  have hm : «окрЕд» N1 1 ≤ «окрЕд» N2 1 := «окрЕд-моно» (by omega) (by omega) (by omega)
  unfold «округлить»
  by_cases h2 : «предел» ≤ «окрЕд» N2 1
  · by_cases h1 : «предел» ≤ «окрЕд» N1 1
    · simp [h1, h2, «неБольше64»]
    · simp [h1, h2, «неБольше64»]
  · have h1 : ¬ «предел» ≤ «окрЕд» N1 1 := by omega
    simp [h1, h2, «неБольше64», «вЕдиницах»]
    omega

theorem «целые-моно» {a b : Nat} (h : a ≤ b) : «неБольше64» («изЦелого» a) («изЦелого» b) = true := by
  unfold «изЦелого» «изЗнач»
  have hs := _root_.«шаг-полож»
  by_cases ha : a = 0
  · subst ha
    have hz : ((0 : Nat) : Int) * (_root_.«шаг» : Int) = 0 := by simp
    rw [ite_eq_left_of_eq_true _ _ (by simp [hz])]
    by_cases hb : b = 0
    · subst hb; simp [«неБольше64», «вЕдиницах»]
    · have hb1 : ((b : Int) * (_root_.«шаг» : Int)) ≠ 0 := Int.mul_ne_zero (by exact_mod_cast hb) (by omega)
      have hb2 : decide ((b : Int) * (_root_.«шаг» : Int) < 0) = false := by
        have : (0 : Int) ≤ (b : Int) * (_root_.«шаг» : Int) := Int.mul_nonneg (by omega) (by omega)
        simp; omega
      simp only [hb1, hb2, ↓reduceIte]
      exact «нн-округлить» _ _
  · have hb : b ≠ 0 := by omega
    have ha1 : ((a : Int) * (_root_.«шаг» : Int)) ≠ 0 := Int.mul_ne_zero (by exact_mod_cast ha) (by omega)
    have hb1 : ((b : Int) * (_root_.«шаг» : Int)) ≠ 0 := Int.mul_ne_zero (by exact_mod_cast hb) (by omega)
    have ha2 : decide ((a : Int) * (_root_.«шаг» : Int) < 0) = false := by
      have : (0 : Int) ≤ (a : Int) * (_root_.«шаг» : Int) := Int.mul_nonneg (by omega) (by omega)
      simp; omega
    have hb2 : decide ((b : Int) * (_root_.«шаг» : Int) < 0) = false := by
      have : (0 : Int) ≤ (b : Int) * (_root_.«шаг» : Int) := Int.mul_nonneg (by omega) (by omega)
      simp; omega
    simp only [ha1, hb1, ha2, hb2, ↓reduceIte]
    apply «округлить-моно»
    rw [Int.natAbs_mul, Int.natAbs_mul]
    simp only [Int.natAbs_natCast]
    exact Nat.mul_le_mul_right _ h

theorem «неБольше-цепь» {a b c : «Д64»} (h1 : «неБольше64» a b = true) (h2 : «неБольше64» b c = true) :
    «неБольше64» a c = true := by
  rcases a with _ | sa | ⟨sa, xa⟩ <;> rcases b with _ | sb | ⟨sb, xb⟩ <;> rcases c with _ | sc | ⟨sc, xc⟩ <;>
    (try cases sa) <;> (try cases sb) <;> (try cases sc) <;> simp_all [«неБольше64», «вЕдиницах»] <;> omega

def «постПотолок?» (q : «Постусловие») : Option «Д64» :=
  match q.«выражение» with
  | .«двучлен» op (.«форма» n [.«имя» y]) (.«лит» (.«число» d)) =>
    if op == "lte" && n == "длина" && y == q.«связка» then some d else none
  | _ => none

theorem «постПотолок-вид» {q : «Постусловие»} {d : «Д64»} (h : «постПотолок?» q = some d) :
    q.«выражение» = .«двучлен» "lte" (.«форма» "длина" [.«имя» q.«связка»]) (.«лит» (.«число» d)) := by
  unfold «постПотолок?» at h
  split at h
  · rename_i op n y d' he
    split at h
    · rename_i hc
      simp only [Bool.and_eq_true, beq_iff_eq] at hc
      obtain ⟨⟨rfl, rfl⟩, rfl⟩ := hc
      simp only [Option.some.injEq] at h
      subst h
      exact he
    · cases h
  · cases h

def «потолокДаёт» (B : Nat) (q : «Постусловие») : Bool :=
  match «постПотолок?» q with
  | some d => «неБольше64» («изЦелого» B) d
  | none => false

theorem «пост-потолок-верно» (P : «Программа») {q : «Постусловие»} {B : Nat} (hq : «потолокДаёт» B q = true)
    {m : Nat} (hm : 3 ≤ m) (ρ : «Среда») {w : «Зн»} (hw : «Влезает» w B) :
    «выч» P m ((q.«связка», w) :: ρ) q.«выражение» = .ok (.«признак» true) := by
  unfold «потолокДаёт» at hq
  cases hd : «постПотолок?» q with
  | none => rw [hd] at hq; cases hq
  | some d =>
    rw [hd] at hq
    simp only at hq
    rw [«постПотолок-вид» hd]
    obtain ⟨k, hk, hkB⟩ := hw
    obtain ⟨j, rfl⟩ : ∃ j, m = j + 3 := ⟨m - 3, by omega⟩
    have hlen : «форма» "длина" [w] = .ok (.«число» («изЦелого» k)) := by
      cases w with
      | «строка» s => simp only [«длинаЗн», Option.some.injEq] at hk; subst hk; simp [«форма»]
      | «список» l => simp only [«длинаЗн», Option.some.injEq] at hk; subst hk; simp [«форма»]
      | _ => simp [«длинаЗн»] at hk
    have hle : «неБольше64» («изЦелого» k) d = true := «неБольше-цепь» («целые-моно» hkB) hq
    show «шаг» P («выч» P (j + 2)) ((q.«связка», w) :: ρ)
      (.«двучлен» "lte" (.«форма» "длина" [.«имя» q.«связка»]) (.«лит» (.«число» d))) = .ok (.«признак» true)
    simp only [«шаг», «выч», «вычВсе», «найти», ↓reduceIte, bind, Except.bind, pure, Except.pure, hlen]
    simp [«двучлен», «дробь?», «точно?», «разряды?», «порядок64», hle]

def «принятьПотолок» (P : «Программа») («строки» : List String) (f «имя» : String) («строка» : Nat)
    (T : List String) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    T.all (g.«параметры».contains ·) &&
      (decide («хозяинСтроки» «строки» «строка» = some f) &&
        (((«строкаИсходника» «строки» «строка»).splitOn
            ("обеспечивает «" ++ «имя» ++ "» (длина результат) не больше ")).length == 2 &&
          match «потолок» [] T g.«тело» with
          | some B => g.«постусловия».any («потолокДаёт» B)
          | none => false))

theorem «ограниченность-по-построению» (P : «Программа») («строки» : List String) (f «имя» : String)
    («строка» : Nat) (T : List String) (h : «принятьПотолок» P «строки» f «имя» «строка» T = true) :
    ∃ g B, «функцияПрограммы» P f = some g ∧ (∀ x ∈ T, x ∈ g.«параметры») ∧
      «хозяинСтроки» «строки» «строка» = some f ∧
      (∃ q ∈ g.«постусловия», «потолокДаёт» B q = true) ∧
      ∀ m ρ v, (∀ x ∈ T, ∀ w, «найти» x ρ = some w → ∃ s, w = .«строка» s) →
        «выч» P m ρ g.«тело» = .ok v →
        «Влезает» v B ∧ ∀ q ∈ g.«постусловия», «потолокДаёт» B q = true → ∀ m', 3 ≤ m' →
          «выч» P m' ((q.«связка», v) :: ρ) q.«выражение» = .ok (.«признак» true) := by
  unfold «принятьПотолок» at h
  cases hg : «функцияПрограммы» P f with
  | none => rw [hg] at h; cases h
  | some g =>
    rw [hg] at h
    simp only [Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true, List.contains_iff_mem] at h
    obtain ⟨hT, hown, _, hb⟩ := h
    cases hB : «потолок» [] T g.«тело» with
    | none => rw [hB] at hb; cases hb
    | some B =>
      rw [hB] at hb
      simp only [List.any_eq_true] at hb
      refine ⟨g, B, rfl, hT, hown, hb, fun m ρ v hρ hv => ?_⟩
      have hM : ∀ x n, (x, n) ∈ ([] : List (String × Nat)) → ∀ w, «найти» x ρ = some w → «Влезает» w n :=
        fun x n hx => absurd hx List.not_mem_nil
      have hin := «потолок-верен» P m [] T ρ g.«тело» v B ⟨hM, hρ⟩ hB hv
      exact ⟨hin, fun q _ hq m' hm' => «пост-потолок-верно» P hq hm' ρ hin⟩

namespace «ПробыПотолка»

def «голова» : «Функция» :=
  { «имя» := "Голова", «параметры» := ["текст"],
    «тело» := .«разбор» (.«имя» "текст") [(.«пусто», .«лит» (.«строка» "")),
      (.«звено» (some "г") (some "х"), .«имя» "г")],
    «постусловия» := [] }

def «пост» (k : Nat) : «Постусловие» :=
  { «связка» := "результат", «код» := "FLANG_PROPERTY",
    «выражение» := .«двучлен» "lte" (.«форма» "длина" [.«имя» "результат"]) (.«лит» (.«число» («дробьВД64» false k 0))) }

def «исходник» : List String :=
  ["тотальная функция «Голова»", "  принимает текст: строка", "  обеспечивает «один знак» (длина результат) не больше 1"]

#guard «потолок» [] ["текст"] «голова».«тело» = some 1
#guard «потолок» [] [] «голова».«тело» = none
#guard «потолок» [] ["текст"] (.«разбор» (.«имя» "текст") [(.«звено» (some "г") (some "х"), .«имя» "х")]) = none
#guard «потолокДаёт» 1 («пост» 1)
#guard «потолокДаёт» 1 («пост» 5)
#guard !«потолокДаёт» 1 («пост» 0)
#guard «принятьПотолок» [{ «голова» with «постусловия» := [«пост» 1] }] «исходник» "Голова" "один знак" 3 ["текст"]
#guard !«принятьПотолок» [{ «голова» with «постусловия» := [«пост» 0] }] «исходник» "Голова" "один знак" 3 ["текст"]
#guard !«принятьПотолок» [{ «голова» with «постусловия» := [«пост» 1] }] «исходник» "Голова" "один знак" 3 []

end «ПробыПотолка»

end «Эталон»
