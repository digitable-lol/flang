import Semantics.Walk
import Semantics.Symbolic

namespace «Эталон»

partial def «изТ» : «Т» → Option «Терм»
  | .«ч» d => some (.«знач» (.«число» d))
  | .«п» b => some (.«знач» (.«признак» b))
  | .«с» s => some (.«знач» (.«строка» s))
  | .«имя» x => some (.«имя» x)
  | .«рез» k => some (.«рез» k)
  | .«оп» "list" ts => do
    let us ← ts.mapM «изТ»
    some (.«список» us)
  | .«оп» o [] =>
    if o.startsWith "variant:" then some (.«знач» (.«вариант» (o.drop 8).toString [])) else none
  | .«оп» o [a] => do
    let t ← «изТ» a
    if o.startsWith "is:" then some (.«вариант?» (o.drop 3).toString t)
    else if o.startsWith "field:" then some (.«поле» (o.drop 6).toString t)
    else if o = "empty?" then some (.«пусто?» t)
    else if o = "cons?" then some (.«звено?» t)
    else if o = "head" then some (.«голова» t)
    else if o = "tail" then some (.«хвост» t)
    else none
  | .«оп» o [a, b] => do
    let ta ← «изТ» a
    let tb ← «изТ» b
    if «операцииИсходника».contains o then some (.«двучлен» o ta tb) else none
  | .«оп» _ _ => none

partial def «изД» : «Д» → Option «Дерево»
  | .«знач» t => («изТ» t).map .«лист»
  | .«отказ» k => some (.«отказ» k)
  | .«если» c a b => do
    let tc ← «изТ» c
    let ta ← «изД» a
    let tb ← «изД» b
    some (.«если» tc ta tb)
  | .«вызов» f ts k r => do
    let us ← ts.mapM «изТ»
    let rr ← «изД» r
    if f.startsWith "form:" then some (.«форма» (f.drop 5).toString us k rr) else some (.«вызов» f us k rr)
  | .«обход» _ _ _ _ _ _ _ _ => none

def «равноЗн» : «Зн» → «Зн» → Bool
  | .«число» a, .«число» b => decide (a = b)
  | .«признак» a, .«признак» b => a == b
  | .«строка» a, .«строка» b => a == b
  | .«ничто», .«ничто» => true
  | .«вариант» a [], .«вариант» b [] => a == b
  | _, _ => false

theorem «равноЗн-верно» : ∀ (a b : «Зн»), «равноЗн» a b = true → a = b
  | .«число» a, .«число» b, h => by simp [«равноЗн»] at h; rw [h]
  | .«признак» a, .«признак» b, h => by simp [«равноЗн»] at h; rw [h]
  | .«строка» a, .«строка» b, h => by simp [«равноЗн»] at h; rw [h]
  | .«ничто», .«ничто», _ => rfl
  | .«вариант» a [], .«вариант» b [], h => by simp [«равноЗн»] at h; rw [h]
  | .«число» _, .«строка» _, h | .«число» _, .«признак» _, h | .«число» _, .«ничто», h
  | .«число» _, .«список» _, h | .«число» _, .«запись» _, h | .«число» _, .«вариант» _ _, h
  | .«строка» _, .«число» _, h | .«строка» _, .«признак» _, h | .«строка» _, .«ничто», h
  | .«строка» _, .«список» _, h | .«строка» _, .«запись» _, h | .«строка» _, .«вариант» _ _, h
  | .«признак» _, .«число» _, h | .«признак» _, .«строка» _, h | .«признак» _, .«ничто», h
  | .«признак» _, .«список» _, h | .«признак» _, .«запись» _, h | .«признак» _, .«вариант» _ _, h
  | .«ничто», .«число» _, h | .«ничто», .«строка» _, h | .«ничто», .«признак» _, h
  | .«ничто», .«список» _, h | .«ничто», .«запись» _, h | .«ничто», .«вариант» _ _, h
  | .«список» _, _, h | .«запись» _, _, h
  | .«вариант» _ _, .«число» _, h | .«вариант» _ _, .«строка» _, h | .«вариант» _ _, .«признак» _, h
  | .«вариант» _ _, .«ничто», h | .«вариант» _ _, .«список» _, h | .«вариант» _ _, .«запись» _, h
  | .«вариант» _ (_ :: _), .«вариант» _ _, h | .«вариант» _ [], .«вариант» _ (_ :: _), h => by
    simp [«равноЗн»] at h

mutual
def «равноТерм» : «Терм» → «Терм» → Bool
  | .«знач» a, .«знач» b => «равноЗн» a b
  | .«имя» a, .«имя» b => a == b
  | .«рез» a, .«рез» b => a == b
  | .«двучлен» o a b, .«двучлен» p c d => o == p && «равноТерм» a c && «равноТерм» b d
  | .«вариант?» k a, .«вариант?» m b => k == m && «равноТерм» a b
  | .«пусто?» a, .«пусто?» b => «равноТерм» a b
  | .«звено?» a, .«звено?» b => «равноТерм» a b
  | .«голова» a, .«голова» b => «равноТерм» a b
  | .«хвост» a, .«хвост» b => «равноТерм» a b
  | .«поле» f a, .«поле» g b => f == g && «равноТерм» a b
  | .«список» a, .«список» b => «равноТермов» a b
  | _, _ => false
def «равноТермов» : List «Терм» → List «Терм» → Bool
  | [], [] => true
  | a :: r, b :: q => «равноТерм» a b && «равноТермов» r q
  | _, _ => false
end

mutual
theorem «равноТерм-верно» : ∀ (a b : «Терм»), «равноТерм» a b = true → a = b
  | .«знач» x, b, h => by cases b <;> simp [«равноТерм»] at h; rw [«равноЗн-верно» _ _ h]
  | .«имя» x, b, h => by cases b <;> simp [«равноТерм»] at h; rw [h]
  | .«рез» x, b, h => by cases b <;> simp [«равноТерм»] at h; rw [h]
  | .«двучлен» o a c, b, h => by
    cases b <;> simp [«равноТерм»] at h
    obtain ⟨⟨h1, h2⟩, h3⟩ := h
    rw [h1, «равноТерм-верно» _ _ h2, «равноТерм-верно» _ _ h3]
  | .«вариант?» k a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [h.1, «равноТерм-верно» _ _ h.2]
  | .«пусто?» a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [«равноТерм-верно» _ _ h]
  | .«звено?» a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [«равноТерм-верно» _ _ h]
  | .«голова» a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [«равноТерм-верно» _ _ h]
  | .«хвост» a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [«равноТерм-верно» _ _ h]
  | .«поле» f a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [h.1, «равноТерм-верно» _ _ h.2]
  | .«список» a, b, h => by cases b <;> simp [«равноТерм»] at h; rw [«равноТермов-верно» _ _ h]
theorem «равноТермов-верно» : ∀ (a b : List «Терм»), «равноТермов» a b = true → a = b
  | [], [], _ => rfl
  | a :: r, b :: q, h => by
    simp [«равноТермов»] at h
    rw [«равноТерм-верно» _ _ h.1, «равноТермов-верно» _ _ h.2]
  | [], _ :: _, h => by simp [«равноТермов»] at h
  | _ :: _, [], h => by simp [«равноТермов»] at h
end

def «равноДерева» : «Дерево» → «Дерево» → Bool
  | .«лист» a, .«лист» b => «равноТерм» a b
  | .«отказ» a, .«отказ» b => a == b
  | .«если» c a b, .«если» d x y => «равноТерм» c d && «равноДерева» a x && «равноДерева» b y
  | .«вызов» f ts k r, .«вызов» g us m q => f == g && «равноТермов» ts us && k == m && «равноДерева» r q
  | .«форма» f ts k r, .«форма» g us m q => f == g && «равноТермов» ts us && k == m && «равноДерева» r q
  | _, _ => false

theorem «равноДерева-верно» : ∀ (a b : «Дерево»), «равноДерева» a b = true → a = b := by
  intro a
  induction a with
  | «лист» x => intro b h; cases b <;> simp [«равноДерева»] at h; rw [«равноТерм-верно» _ _ h]
  | «отказ» x => intro b h; cases b <;> simp [«равноДерева»] at h; rw [h]
  | «если» c a1 b1 ih1 ih2 =>
    intro b h; cases b <;> simp [«равноДерева»] at h
    obtain ⟨⟨h1, h2⟩, h3⟩ := h
    rw [«равноТерм-верно» _ _ h1, ih1 _ h2, ih2 _ h3]
  | «вызов» f ts k r ih =>
    intro b h; cases b <;> simp [«равноДерева»] at h
    obtain ⟨⟨⟨h1, h2⟩, h3⟩, h4⟩ := h
    rw [h1, «равноТермов-верно» _ _ h2, h3, ih _ h4]
  | «форма» f ts k r ih =>
    intro b h; cases b <;> simp [«равноДерева»] at h
    obtain ⟨⟨⟨h1, h2⟩, h3⟩, h4⟩ := h
    rw [h1, «равноТермов-верно» _ _ h2, h3, ih _ h4]

def «деревоПоТеореме?» (pres : List «Условие входа») (g : «Функция») (qs : List «Постусловие») (c : «Д») : Bool :=
  match «деревоФункции» pres g qs, «изД» c with
  | some w, some wc => «равноДерева» wc w
  | _, _ => false

def «смыслC» (P : «Программа») (N : Nat) (σ : «Среда») (c : «Д») : «Исход» :=
  match «изД» c with
  | some wc => «значДерева» P N σ [] wc
  | none => .error (.«вне» "дерево C вне фрагмента теоремы")

theorem «смысл-C-верен» (P : «Программа») (N : Nat) (pres : List «Условие входа») (g : «Функция»)
    (qs : List «Постусловие») (vs : List «Зн») (c : «Д»)
    (hc : «деревоПоТеореме?» pres g qs c = true)
    (hl : g.«параметры».length = vs.length)
    (hpre : ∀ q, q ∈ pres → ∃ b, «выч» P N («привязать» g.«параметры» vs) q.«выражение» = .ok (.«признак» b))
    (hrun : «проверитьВход» P N («привязать» g.«параметры» vs) pres = none →
      ∃ N' v, N = N' + 1 ∧ «выч» P N' («привязать» g.«параметры» vs) g.«тело» = .ok v ∧
        ∀ q, q ∈ qs → ∃ b,
          «выч» P N' ((q.«связка», v) :: «привязать» g.«параметры» vs) q.«выражение» = .ok (.«признак» b)) :
    «смыслC» P N («привязать» g.«параметры» vs) c = «исходСПостами» P N pres g qs vs := by
  unfold «деревоПоТеореме?» at hc
  cases hw : «деревоФункции» pres g qs with
  | none => simp [hw] at hc
  | some w =>
    cases hwc : «изД» c with
    | none => simp [hw, hwc] at hc
    | some wc =>
      simp only [hw, hwc] at hc
      have heq := «равноДерева-верно» _ _ hc
      subst heq
      unfold «смыслC»
      rw [hwc]
      exact «дерево-функции-верно» P N pres g qs vs wc hw hl hpre hrun

end «Эталон»
