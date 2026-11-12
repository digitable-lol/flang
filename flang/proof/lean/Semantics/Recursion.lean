import Semantics.Termination

set_option linter.unusedVariables false

namespace «Эталон»

def «Мон» {α : Type} (F : «Вычислитель» → Except «Сбой» α) : Prop :=
  ∀ r r', «Раньше» r r' → «Не позже» (F r) (F r')

def «Вечно» (P : «Программа») {α : Type} (F : «Вычислитель» → Except «Сбой» α) : Prop :=
  ∃ N, ∀ m, N ≤ m → F («выч» P m) ≠ .error .«топливо»

theorem «цепь» (P : «Программа») {n m : Nat} (h : n ≤ m) : «Раньше» («выч» P n) («выч» P m) := by
  obtain ⟨k, rfl⟩ := Nat.exists_eq_add_of_le h
  exact «топливо-запас» P n k

theorem «подъём» (P : «Программа») {α : Type} {F : «Вычислитель» → Except «Сбой» α} (hF : «Мон» F)
    {n m : Nat} (h : n ≤ m) (hn : F («выч» P n) ≠ .error .«топливо») : F («выч» P m) = F («выч» P n) := by
  rcases hF _ _ («цепь» P h) with q | q
  · exact absurd q hn
  · exact q.symm

theorem «вечно-чистое» (P : «Программа») {α : Type} {F : «Вычислитель» → Except «Сбой» α}
    (h : ∀ r, F r ≠ .error .«топливо») : «Вечно» P F := ⟨0, fun m _ => h _⟩

theorem «вечно-связать» (P : «Программа») {α β : Type} {F : «Вычислитель» → Except «Сбой» α}
    {G : α → «Вычислитель» → Except «Сбой» β} (hF : «Мон» F) (h1 : «Вечно» P F)
    (h2 : ∀ a, (∃ N, F («выч» P N) = .ok a) → «Вечно» P (G a)) :
    «Вечно» P (fun r => F r >>= fun a => G a r) := by
  obtain ⟨N1, h1⟩ := h1
  have h0 := h1 N1 (Nat.le_refl _)
  cases hx : F («выч» P N1) with
  | error e =>
    refine ⟨N1, fun m hm => ?_⟩
    have hm' := «подъём» P hF hm h0
    show (F («выч» P m) >>= fun a => G a («выч» P m)) ≠ _
    rw [hm', hx]
    intro h
    have h' : (Except.error e : Except «Сбой» β) = .error .«топливо» := h
    injection h' with h'
    exact h0 (by rw [hx, h'])
  | ok a =>
    obtain ⟨N2, h2⟩ := h2 a ⟨N1, hx⟩
    refine ⟨max N1 N2, fun m hm => ?_⟩
    have hm' := «подъём» P hF (show N1 ≤ m by omega) h0
    show (F («выч» P m) >>= fun a => G a («выч» P m)) ≠ _
    rw [hm', hx]
    exact h2 m (by omega)

def «Сходится» (P : «Программа») (ρ : «Среда») (e : «Выр») : Prop := «Вечно» P (fun r => r ρ e)

theorem «мон-выч» (ρ : «Среда») (e : «Выр») : «Мон» (fun r : «Вычислитель» => r ρ e) := fun r r' H => H ρ e

theorem «сходится-шагом» {P : «Программа»} {ρ : «Среда»} {e : «Выр»}
    (h : «Вечно» P (fun r => «шаг» P r ρ e)) : «Сходится» P ρ e := by
  obtain ⟨N, h⟩ := h
  refine ⟨N + 1, fun m hm => ?_⟩
  obtain ⟨k, rfl⟩ : ∃ k, m = k + 1 := ⟨m - 1, by omega⟩
  exact h k (by omega)

theorem «вычВсе-вечно» (P : «Программа») (ρ : «Среда») :
    ∀ es, (∀ e ∈ es, «Сходится» P ρ e) → «Вечно» P (fun r => «вычВсе» r ρ es)
  | [], _ => «вечно-чистое» P (fun r => by simp [«вычВсе»])
  | e :: t, h => by
    have ht := «вычВсе-вечно» P ρ t (fun x hx => h x (List.mem_cons_of_mem _ hx))
    simp only [«вычВсе»]
    refine «вечно-связать» P («мон-выч» ρ e) (h e List.mem_cons_self) (fun v _ => ?_)
    refine «вечно-связать» P (fun r r' H => «вычВсе-раньше» H ρ t) ht (fun w _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])

theorem «вычПоля-вечно» (P : «Программа») (ρ : «Среда») :
    ∀ fs, (∀ q ∈ fs, «Сходится» P ρ q.2) → «Вечно» P (fun r => «вычПоля» r ρ fs)
  | [], _ => «вечно-чистое» P (fun r => by simp [«вычПоля»])
  | (k, e) :: t, h => by
    have ht := «вычПоля-вечно» P ρ t (fun x hx => h x (List.mem_cons_of_mem _ hx))
    simp only [«вычПоля»]
    refine «вечно-связать» P («мон-выч» ρ e) (h (k, e) List.mem_cons_self) (fun v _ => ?_)
    refine «вечно-связать» P (fun r r' H => «вычПоля-раньше» H ρ t) ht (fun w _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])

theorem «свернуть-вечно» (P : «Программа») (ρ : «Среда») (a x : String) (s : «Выр»)
    (hs : ∀ acc v, «Сходится» P ((a, acc) :: (x, v) :: ρ) s) :
    ∀ l acc, «Вечно» P (fun r => «свернуть» r ρ a x s acc l)
  | [], acc => «вечно-чистое» P (fun r => by simp [«свернуть»])
  | v :: t, acc => by
    simp only [«свернуть»]
    exact «вечно-связать» P («мон-выч» _ s) (hs acc v) (fun w _ => «свернуть-вечно» P ρ a x s hs t w)

theorem «образы-вечно» (P : «Программа») (ρ : «Среда») (x : String) (s : «Выр»)
    (hs : ∀ v, «Сходится» P ((x, v) :: ρ) s) :
    ∀ l, «Вечно» P (fun r => «образы» r ρ x s l)
  | [] => «вечно-чистое» P (fun r => by simp [«образы»])
  | v :: t => by
    have ht := «образы-вечно» P ρ x s hs t
    simp only [«образы»]
    refine «вечно-связать» P («мон-выч» _ s) (hs v) (fun w _ => ?_)
    refine «вечно-связать» P (fun r r' H => «образы-раньше» H ρ x s t) ht (fun ws _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])

theorem «отбор-вечно» (P : «Программа») (ρ : «Среда») (x : String) (s : «Выр»)
    (hs : ∀ v, «Сходится» P ((x, v) :: ρ) s) :
    ∀ l, «Вечно» P (fun r => «отбор» r ρ x s l)
  | [] => «вечно-чистое» P (fun r => by simp [«отбор»])
  | v :: t => by
    have ht := «отбор-вечно» P ρ x s hs t
    simp only [«отбор»]
    refine «вечно-связать» P («мон-выч» _ s) (hs v) (fun c _ => ?_)
    refine «вечно-связать» P (fun r r' H => «отбор-раньше» H ρ x s t) ht (fun ws _ => ?_)
    exact «вечно-чистое» P (fun r => by split <;> simp [pure, Except.pure, «беда»])

theorem «разобрать-вечно» (P : «Программа») (ρ : «Среда») (v : «Зн») :
    ∀ cs, (∀ c ∈ cs, ∀ bs, «подходит» c.1 v = .ok (some bs) → «Сходится» P («вставить» bs ρ) c.2) →
      «Вечно» P (fun r => «разобрать» r ρ v cs)
  | [], _ => «вечно-чистое» P (fun r => by simp [«разобрать», «беда»])
  | (p, b) :: t, h => by
    cases hp : «подходит» p v with
    | error e =>
      refine «вечно-чистое» P (fun r => ?_)
      simp only [«разобрать», hp]
      intro q
      injection q with q
      exact «подходит-живо» p v (by rw [hp, q])
    | ok o =>
      cases o with
      | none =>
        have e : (fun r : «Вычислитель» => «разобрать» r ρ v ((p, b) :: t)) = fun r => «разобрать» r ρ v t := by
          funext r
          simp only [«разобрать», hp]
        rw [e]
        exact «разобрать-вечно» P ρ v t (fun c hc => h c (List.mem_cons_of_mem _ hc))
      | some bs =>
        have e : (fun r : «Вычислитель» => «разобрать» r ρ v ((p, b) :: t)) = fun r => r («вставить» bs ρ) b := by
          funext r
          simp only [«разобрать», hp]
        rw [e]
        exact h (p, b) List.mem_cons_self bs hp

theorem «пост-вечно» (P : «Программа») :
    ∀ qs : List «Постусловие», (∀ q ∈ qs, ∀ ρ, «Сходится» P ρ q.«выражение») →
      ∀ ρ v, «Вечно» P (fun r => «проверитьПост» r ρ v qs)
  | [], _, ρ, v => «вечно-чистое» P (fun r => by simp [«проверитьПост»])
  | q :: t, h, ρ, v => by
    simp only [«проверитьПост»]
    refine «вечно-связать» P («мон-выч» _ _) (h q List.mem_cons_self _) (fun c _ => ?_)
    cases c with
    | «признак» b =>
      cases b with
      | true => exact «пост-вечно» P t (fun x hx => h x (List.mem_cons_of_mem _ hx)) ρ v
      | false => exact «вечно-чистое» P (fun r => «беда-жива» _)
    | _ => exact «вечно-чистое» P (fun r => «беда-жива» _)

def «СходитсяТело» (P : «Программа») (g : «Функция») (ρ : «Среда») : Prop :=
  «Вечно» P (fun r => «вызватьТело» r g ρ)

theorem «тело-вечно» (P : «Программа») (g : «Функция») (ρ : «Среда») (hb : «Сходится» P ρ g.«тело»)
    (hq : ∀ q ∈ g.«постусловия», ∀ ρ', «Сходится» P ρ' q.«выражение») : «СходитсяТело» P g ρ := by
  show «Вечно» P (fun r => r ρ g.«тело» >>= fun v => «проверитьПост» r ρ v g.«постусловия»)
  exact «вечно-связать» P («мон-выч» ρ g.«тело») hb (fun v _ => «пост-вечно» P _ hq ρ v)

theorem «тело-исход» (P : «Программа») (g : «Функция») (ρ : «Среда») (h : «СходитсяТело» P g ρ) :
    ∃ N r, r ≠ .error .«топливо» ∧ ∀ m, N ≤ m → «вызватьТело» («выч» P m) g ρ = r := by
  obtain ⟨N, hN⟩ := h
  refine ⟨N, «вызватьТело» («выч» P N) g ρ, hN N (Nat.le_refl _), fun m hm => ?_⟩
  exact «подъём» P (F := fun r => «вызватьТело» r g ρ) (fun r r' H => «тело-раньше» H g ρ) hm (hN N (Nat.le_refl _))

theorem «имя-значение» (P : «Программа») (N : Nat) (ρ : «Среда») (y : String) (v : «Зн»)
    (h : «выч» P N ρ (.«имя» y) = .ok v) : «найти» y ρ = some v := by
  cases N with
  | zero => simp [«выч»] at h
  | succ k =>
    simp only [«выч», «шаг»] at h
    split at h
    · rename_i w hw
      injection h with h
      rw [hw, h]
    · simp [«беда»] at h

theorem «вычВсе-довод» (r : «Вычислитель») (ρ : «Среда») (p : String) (e : «Выр») :
    ∀ (args : List «Выр») (ps : List String) (vs : List «Зн»), «вычВсе» r ρ args = .ok vs →
      «найти» p (ps.zip args) = some e → ∃ v, «найти» p (ps.zip vs) = some v ∧ r ρ e = .ok v
  | [], ps, vs, _, hf => by simp [«найти»] at hf
  | a :: as, [], vs, _, hf => by simp [«найти»] at hf
  | a :: as, q :: qs, vs, h, hf => by
    simp only [«вычВсе»] at h
    cases hra : r ρ a with
    | error x => rw [hra] at h; cases h
    | ok v =>
      cases hw : «вычВсе» r ρ as with
      | error x => rw [hra, hw] at h; cases h
      | ok w =>
        rw [hra, hw] at h
        have hvs : vs = v :: w := by
          have h' : (Except.ok (v :: w) : Except «Сбой» (List «Зн»)) = .ok vs := h
          injection h' with h'
          exact h'.symm
        subst hvs
        simp only [List.zip_cons_cons, «найти»] at hf ⊢
        by_cases hq : q = p
        · simp only [hq, ↓reduceIte] at hf ⊢
          injection hf with hf
          exact ⟨v, rfl, hf ▸ hra⟩
        · simp only [hq, ↓reduceIte] at hf ⊢
          exact «вычВсе-довод» r ρ p e as qs w hw hf

theorem «найти-мимо» {α : Type} (y : String) (ρ : List (String × α)) :
    ∀ bs : List (String × α), (∀ k ∈ bs.map (·.1), k ≠ y) → «найти» y (bs ++ ρ) = «найти» y ρ
  | [], _ => rfl
  | (k, w) :: t, h => by
    have hk : k ≠ y := h k (by simp)
    simp only [List.cons_append, «найти», hk, ↓reduceIte]
    exact «найти-мимо» y ρ t (fun k' hk' => h k' (by simp at hk' ⊢; exact Or.inr hk'))

theorem «найти-слева» {α : Type} (y : String) (ρ : List (String × α)) (w : α) :
    ∀ bs : List (String × α), «найти» y bs = some w → «найти» y (bs ++ ρ) = some w
  | [], h => by simp [«найти»] at h
  | (k, u) :: t, h => by
    simp only [List.cons_append, «найти»] at h ⊢
    by_cases hk : k = y
    · simp only [hk, ↓reduceIte] at h ⊢
      exact h
    · simp only [hk, ↓reduceIte] at h ⊢
      exact «найти-слева» y ρ w t h

theorem «связки-имена» (fs : List (String × «Зн»)) :
    ∀ (bs : List (String × String)) (e : «Среда»), «связки» fs bs = .ok e → e.map (·.1) = bs.map (·.2)
  | [], e, h => by
    simp only [«связки»] at h
    injection h with h
    subst h
    rfl
  | (k, x) :: t, e, h => by
    simp only [«связки»] at h
    split at h
    · cases hw : «связки» fs t with
      | error z => rw [hw] at h; cases h
      | ok w =>
        rw [hw] at h
        have h' : (Except.ok ((x, _) :: w) : Except «Сбой» «Среда») = .ok e := h
        injection h' with h'
        subst h'
        simp only [List.map_cons]
        rw [«связки-имена» fs t w hw]
    · simp [«беда»] at h

theorem «подходит-имена» (pat : «Образец») (v : «Зн») (bs : «Среда»)
    (h : «подходит» pat v = .ok (some bs)) : ∀ k ∈ bs.map (·.1), k ∈ «связанные» pat := by
  unfold «подходит» at h
  split at h
  · split at h <;> simp at h <;> subst h <;> simp
  · split at h <;> simp at h <;> subst h <;> simp
  · rename_i hd tl s
    split at h
    · simp at h
    · simp only [Except.ok.injEq, Option.some.injEq] at h
      subst h
      cases hd <;> cases tl <;> simp [«связанные»]
  · rename_i hd tl l
    split at h
    · simp at h
    · simp only [Except.ok.injEq, Option.some.injEq] at h
      subst h
      cases hd <;> cases tl <;> simp [«связанные»]
  · rename_i k bs' m fs
    split at h
    · cases hw : «связки» fs bs' with
      | error z => rw [hw] at h; cases h
      | ok w =>
        rw [hw] at h
        have h' : (Except.ok (some w) : Except «Сбой» (Option «Среда»)) = .ok (some bs) := h
        injection h' with h'
        injection h' with h'
        subst h'
        intro k' hk'
        rw [«связки-имена» fs bs' w hw] at hk'
        exact hk'
    · simp at h
  · split at h <;> simp at h <;> subst h <;> simp
  · simp only [Except.ok.injEq, Option.some.injEq] at h
    subst h
    simp
  · simp at h

def «мера» : «Зн» → Nat
  | .«список» l => l.length
  | .«строка» s => s.toList.length
  | _ => 0

def «хвостОбразца» : «Образец» → Option String
  | .«звено» h (some t) => if h = some t then none else some t
  | _ => none

theorem «подходит-хвост» (pat : «Образец») (v : «Зн») (bs : «Среда») (y : String)
    (hy : «хвостОбразца» pat = some y) (h : «подходит» pat v = .ok (some bs)) :
    ∃ w, «найти» y bs = some w ∧ «мера» w < «мера» v := by
  cases pat with
  | «звено» hd tl =>
    cases tl with
    | none => simp [«хвостОбразца»] at hy
    | some t =>
      simp only [«хвостОбразца»] at hy
      split at hy
      · cases hy
      · rename_i hne
        injection hy with hy
        subst hy
        cases v with
        | «строка» s =>
          simp only [«подходит»] at h
          split at h
          · simp at h
          · rename_i c r hs
            simp only [Except.ok.injEq, Option.some.injEq] at h
            subst h
            refine ⟨.«строка» (String.ofList r), ?_, ?_⟩
            · cases hd with
              | none => simp [«найти»]
              | some x =>
                have hx : x ≠ t := fun e => hne (by rw [e])
                simp [«найти», hx]
            · simp [«мера», hs]
        | «список» l =>
          simp only [«подходит»] at h
          split at h
          · simp at h
          · rename_i u r
            simp only [Except.ok.injEq, Option.some.injEq] at h
            subst h
            refine ⟨.«список» r, ?_, ?_⟩
            · cases hd with
              | none => simp [«найти»]
              | some x =>
                have hx : x ≠ t := fun e => hne (by rw [e])
                simp [«найти», hx]
            · simp [«мера»]
        | _ => simp [«подходит»] at h
  | _ => simp [«хвостОбразца»] at hy

def «свойЗов» (ps : List String) (p : String) (t : Option String) (args : List «Выр») : Bool :=
  match t, «найти» p (ps.zip args) with
  | some y, some (.«имя» z) => y == z
  | _, _ => false

theorem «свойЗов-довод» (ps : List String) (p : String) (t : Option String) (args : List «Выр»)
    (h : «свойЗов» ps p t args = true) : ∃ y, t = some y ∧ «найти» p (ps.zip args) = some (.«имя» y) := by
  unfold «свойЗов» at h
  cases t with
  | none => simp at h
  | some y =>
    cases hf : «найти» p (ps.zip args) with
    | none => simp [hf] at h
    | some e =>
      cases e with
      | «имя» z =>
        have hyz : y = z := by simpa [hf] using h
        exact ⟨y, rfl, by rw [hyz]⟩
      | _ => simp [hf] at h

def «свободно» (t : Option String) (x : String) : Bool :=
  match t with
  | some y => !(y == x)
  | none => true

mutual
def «годноР» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) : «Выр» → Bool
  | .«лит» _ => true
  | .«имя» _ => true
  | .«двучлен» _ a b => «годноР» ok f ps p t a && «годноР» ok f ps p t b
  | .«если» c u e => «годноР» ok f ps p t c && («годноР» ok f ps p t u && «годноР» ok f ps p t e)
  | .«пусть» x v b => «свободно» t x && («годноР» ok f ps p t v && «годноР» ok f ps p t b)
  | .«вызов» h args => (ok h || (h == f && «свойЗов» ps p t args)) && «годныВсеР» ok f ps p t args
  | .«разбор» s cs => «годноР» ok f ps p t s && «годныСлучаиР» ok f ps p t cs
  | .«свёртка» l n a x s =>
    («свободно» t a && «свободно» t x) && («годноР» ok f ps p t l && («годноР» ok f ps p t n && «годноР» ok f ps p t s))
  | .«отобразить» l x s => «свободно» t x && («годноР» ok f ps p t l && «годноР» ok f ps p t s)
  | .«отфильтровать» l x s => «свободно» t x && («годноР» ok f ps p t l && «годноР» ok f ps p t s)
  | .«список» es => «годныВсеР» ok f ps p t es
  | .«запись» fs => «годныПоляР» ok f ps p t fs
  | .«конструктор» _ fs => «годныПоляР» ok f ps p t fs
  | .«поле» u _ => «годноР» ok f ps p t u
  | .«форма» _ args => «годныВсеР» ok f ps p t args
  | .«ссылка» _ fs => «годныПоляР» ok f ps p t fs
  | .«применить» _ _ => false
def «годныВсеР» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) : List «Выр» → Bool
  | [] => true
  | e :: r => «годноР» ok f ps p t e && «годныВсеР» ok f ps p t r
def «годныПоляР» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) :
    List (String × «Выр») → Bool
  | [] => true
  | (_, e) :: r => «годноР» ok f ps p t e && «годныПоляР» ok f ps p t r
def «годныСлучаиР» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) :
    List («Образец» × «Выр») → Bool
  | [] => true
  | (pat, e) :: r =>
    («связанные» pat).all («свободно» t) && («годноР» ok f ps p t e && «годныСлучаиР» ok f ps p t r)
end

theorem «годныВсеР-член» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) :
    ∀ es, «годныВсеР» ok f ps p t es = true → ∀ e ∈ es, «годноР» ok f ps p t e = true
  | [], _, e, he => by cases he
  | x :: r, h, e, he => by
    simp only [«годныВсеР», Bool.and_eq_true] at h
    rcases List.mem_cons.mp he with rfl | he
    · exact h.1
    · exact «годныВсеР-член» ok f ps p t r h.2 e he

theorem «годныПоляР-член» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) :
    ∀ fs, «годныПоляР» ok f ps p t fs = true → ∀ q ∈ fs, «годноР» ok f ps p t q.2 = true
  | [], _, q, hq => by cases hq
  | (k, x) :: r, h, q, hq => by
    simp only [«годныПоляР», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hq with rfl | hq
    · exact h.1
    · exact «годныПоляР-член» ok f ps p t r h.2 q hq

theorem «годныСлучаиР-член» (ok : String → Bool) (f : String) (ps : List String) (p : String) (t : Option String) :
    ∀ cs, «годныСлучаиР» ok f ps p t cs = true →
      ∀ c ∈ cs, («связанные» c.1).all («свободно» t) = true ∧ «годноР» ok f ps p t c.2 = true
  | [], _, c, hc => by cases hc
  | (k, x) :: r, h, c, hc => by
    simp only [«годныСлучаиР», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hc with rfl | hc
    · exact ⟨h.1, h.2.1⟩
    · exact «годныСлучаиР-член» ok f ps p t r h.2.2 c hc

def «Хвост» (t : Option String) (vt : «Зн») (ρ : «Среда») : Prop := ∀ y, t = some y → «найти» y ρ = some vt

theorem «хвост-добавить» {t : Option String} {vt : «Зн»} {ρ : «Среда»} (hρ : «Хвост» t vt ρ) (x : String) (w : «Зн»)
    (hx : «свободно» t x = true) : «Хвост» t vt ((x, w) :: ρ) := by
  intro y hy
  subst hy
  have hne : x ≠ y := by
    intro e
    subst e
    simp [«свободно»] at hx
  simp only [«найти», hne, ↓reduceIte]
  exact hρ y rfl

theorem «хвост-вставить» {t : Option String} {vt : «Зн»} {ρ : «Среда»} (hρ : «Хвост» t vt ρ) (pat : «Образец»)
    (v : «Зн») (bs : «Среда») (hb : «подходит» pat v = .ok (some bs))
    (hx : («связанные» pat).all («свободно» t) = true) : «Хвост» t vt («вставить» bs ρ) := by
  intro y hy
  subst hy
  show «найти» y (bs ++ ρ) = some vt
  rw [«найти-мимо» y ρ bs (fun k hk e => by
    have hk' := «подходит-имена» pat v bs hb k hk
    have := List.all_eq_true.mp hx k hk'
    subst e
    simp [«свободно»] at this)]
  exact hρ y rfl

def «ТотР» (P : «Программа») (ok : String → Bool) : Prop :=
  ∀ h g, ok h = true → «функцияПрограммы» P h = some g →
    ∀ vs, g.«параметры».length = vs.length → «СходитсяТело» P g («привязать» g.«параметры» vs)

def «Свой» (P : «Программа») (f : String) (ps : List String) (p : String) (t : Option String) (vt : «Зн») : Prop :=
  ∀ y, t = some y → ∀ g, «функцияПрограммы» P f = some g → ∀ vs, g.«параметры».length = vs.length →
    «найти» p (ps.zip vs) = some vt → «СходитсяТело» P g («привязать» g.«параметры» vs)

theorem «годноР-сходится» (P : «Программа») (ok : String → Bool) (f : String) (ps : List String) (p : String)
    (H : «ТотР» P ok) (t : Option String) (vt : «Зн») (S : «Свой» P f ps p t vt) :
    (e : «Выр») → «годноР» ok f ps p t e = true → ∀ ρ, «Хвост» t vt ρ → «Сходится» P ρ e
  | .«лит» v, _, ρ, _ => «сходится-шагом» («вечно-чистое» P (fun r => by simp [«шаг»]))
  | .«имя» x, _, ρ, _ => «сходится-шагом» («вечно-чистое» P (fun r => by
      simp only [«шаг»]
      split
      · simp
      · exact «беда-жива» _))
  | .«двучлен» op a b, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have ha := «годноР-сходится» P ok f ps p H t vt S a h.1 ρ hρ
    have hb := «годноР-сходится» P ok f ps p H t vt S b h.2 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P («мон-выч» ρ a) ha (fun x _ => ?_)
    refine «вечно-связать» P («мон-выч» ρ b) hb (fun y _ => ?_)
    exact «вечно-чистое» P (fun r => «двучлен-жив» _ _ _)
  | .«если» c u e, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have hc := «годноР-сходится» P ok f ps p H t vt S c h.1 ρ hρ
    have hu := «годноР-сходится» P ok f ps p H t vt S u h.2.1 ρ hρ
    have he := «годноР-сходится» P ok f ps p H t vt S e h.2.2 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P («мон-выч» ρ c) hc (fun w _ => ?_)
    cases w with
    | «признак» b =>
      cases b with
      | true => exact hu
      | false => exact he
    | _ => exact «вечно-чистое» P (fun r => «беда-жива» _)
  | .«пусть» x v b, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have hv := «годноР-сходится» P ok f ps p H t vt S v h.2.1 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    exact «вечно-связать» P («мон-выч» ρ v) hv (fun w _ =>
      «годноР-сходится» P ok f ps p H t vt S b h.2.2 _ («хвост-добавить» hρ x w h.1))
  | .«вызов» c args, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true, Bool.or_eq_true] at h
    have ha := «вычВсе-вечно» P ρ args (fun e he =>
      «годноР-сходится» P ok f ps p H t vt S e («годныВсеР-член» ok f ps p t args h.2 e he) ρ hρ)
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P (fun r r' Hr => «вычВсе-раньше» Hr ρ args) ha (fun vs hvs => ?_)
    cases hg : «функцияПрограммы» P c with
    | none => exact «вечно-чистое» P (fun r => «вне-живо» _)
    | some g =>
      by_cases hl : g.«параметры».length = vs.length
      · simp only [hl, ↓reduceIte]
        rcases h.1 with hok | hself
        · exact H c g hok hg vs hl
        · obtain ⟨hcf, hown⟩ := hself
          have hcf' : c = f := by simpa using hcf
          obtain ⟨y, hty, harg⟩ := «свойЗов-довод» ps p t args hown
          obtain ⟨N, hN⟩ := hvs
          obtain ⟨v, hv, hev⟩ := «вычВсе-довод» («выч» P N) ρ p (.«имя» y) args ps vs hN harg
          have hvt : v = vt := by
            have h1 := «имя-значение» P N ρ y v hev
            rw [hρ y hty] at h1
            injection h1 with h1
            exact h1.symm
          exact S y hty g (hcf' ▸ hg) vs hl (hvt ▸ hv)
      · simp only [hl, ↓reduceIte]
        exact «вечно-чистое» P (fun r => «беда-жива» _)
  | .«разбор» s cs, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have hs := «годноР-сходится» P ok f ps p H t vt S s h.1 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    exact «вечно-связать» P («мон-выч» ρ s) hs (fun v _ =>
      «разобрать-вечно» P ρ v cs (fun c hc bs hb =>
        «годноР-сходится» P ok f ps p H t vt S c.2 («годныСлучаиР-член» ok f ps p t cs h.2 c hc).2 _
          («хвост-вставить» hρ c.1 v bs hb («годныСлучаиР-член» ok f ps p t cs h.2 c hc).1)))
  | .«свёртка» l n a x s, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have hl := «годноР-сходится» P ok f ps p H t vt S l h.2.1 ρ hρ
    have hn := «годноР-сходится» P ok f ps p H t vt S n h.2.2.1 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P («мон-выч» ρ l) hl (fun lv _ => ?_)
    refine «вечно-связать» P («мон-выч» ρ n) hn (fun nv _ => ?_)
    cases lv with
    | «список» xs =>
      exact «свернуть-вечно» P ρ a x s (fun acc v =>
        «годноР-сходится» P ok f ps p H t vt S s h.2.2.2 _
          («хвост-добавить» («хвост-добавить» hρ x v h.1.2) a acc h.1.1)) xs nv
    | _ => exact «вечно-чистое» P (fun r => «беда-жива» _)
  | .«отобразить» l x s, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have hl := «годноР-сходится» P ok f ps p H t vt S l h.2.1 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P («мон-выч» ρ l) hl (fun lv _ => ?_)
    cases lv with
    | «список» xs =>
      refine «вечно-связать» P (fun r r' Hr => «образы-раньше» Hr ρ x s xs)
        («образы-вечно» P ρ x s (fun v =>
          «годноР-сходится» P ok f ps p H t vt S s h.2.2 _ («хвост-добавить» hρ x v h.1)) xs) (fun ws _ => ?_)
      exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])
    | _ => exact «вечно-чистое» P (fun r => «беда-жива» _)
  | .«отфильтровать» l x s, h, ρ, hρ => by
    simp only [«годноР», Bool.and_eq_true] at h
    have hl := «годноР-сходится» P ok f ps p H t vt S l h.2.1 ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P («мон-выч» ρ l) hl (fun lv _ => ?_)
    cases lv with
    | «список» xs =>
      refine «вечно-связать» P (fun r r' Hr => «отбор-раньше» Hr ρ x s xs)
        («отбор-вечно» P ρ x s (fun v =>
          «годноР-сходится» P ok f ps p H t vt S s h.2.2 _ («хвост-добавить» hρ x v h.1)) xs) (fun ws _ => ?_)
      exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])
    | _ => exact «вечно-чистое» P (fun r => «беда-жива» _)
  | .«список» es, h, ρ, hρ => by
    simp only [«годноР»] at h
    have ha := «вычВсе-вечно» P ρ es (fun e he =>
      «годноР-сходится» P ok f ps p H t vt S e («годныВсеР-член» ok f ps p t es h e he) ρ hρ)
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P (fun r r' Hr => «вычВсе-раньше» Hr ρ es) ha (fun vs _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])
  | .«запись» fs, h, ρ, hρ => by
    simp only [«годноР»] at h
    have ha := «вычПоля-вечно» P ρ fs (fun q hq =>
      «годноР-сходится» P ok f ps p H t vt S q.2 («годныПоляР-член» ok f ps p t fs h q hq) ρ hρ)
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P (fun r r' Hr => «вычПоля-раньше» Hr ρ fs) ha (fun vs _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])
  | .«конструктор» k fs, h, ρ, hρ => by
    simp only [«годноР»] at h
    have ha := «вычПоля-вечно» P ρ fs (fun q hq =>
      «годноР-сходится» P ok f ps p H t vt S q.2 («годныПоляР-член» ok f ps p t fs h q hq) ρ hρ)
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P (fun r r' Hr => «вычПоля-раньше» Hr ρ fs) ha (fun vs _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])
  | .«поле» u k, h, ρ, hρ => by
    simp only [«годноР»] at h
    have hu := «годноР-сходится» P ok f ps p H t vt S u h ρ hρ
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P («мон-выч» ρ u) hu (fun v _ => ?_)
    refine «вечно-чистое» P (fun r => ?_)
    repeat' split
    all_goals first
      | exact «беда-жива» _
      | simp [pure, Except.pure]
  | .«форма» n args, h, ρ, hρ => by
    simp only [«годноР»] at h
    have ha := «вычВсе-вечно» P ρ args (fun e he =>
      «годноР-сходится» P ok f ps p H t vt S e («годныВсеР-член» ok f ps p t args h e he) ρ hρ)
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P (fun r r' Hr => «вычВсе-раньше» Hr ρ args) ha (fun vs _ => ?_)
    exact «вечно-чистое» P (fun r => «форма-жива» _ _)
  | .«ссылка» c fs, h, ρ, hρ => by
    simp only [«годноР»] at h
    have ha := «вычПоля-вечно» P ρ fs (fun q hq =>
      «годноР-сходится» P ok f ps p H t vt S q.2 («годныПоляР-член» ok f ps p t fs h q hq) ρ hρ)
    apply «сходится-шагом»
    simp only [«шаг»]
    refine «вечно-связать» P (fun r r' Hr => «вычПоля-раньше» Hr ρ fs) ha (fun vs _ => ?_)
    exact «вечно-чистое» P (fun r => by simp [pure, Except.pure])
  | .«применить» fe args, h, _, _ => by simp [«годноР»] at h
termination_by e => sizeOf e
decreasing_by
  all_goals simp_wf
  all_goals first
    | omega
    | (have := List.sizeOf_lt_of_mem ‹_ ∈ _›; omega)
    | (have h1 := List.sizeOf_lt_of_mem ‹_ ∈ _›
       have h2 : ∀ q : String × «Выр», sizeOf q.2 < sizeOf q := fun q => by cases q; simp; omega
       have h3 : ∀ q : «Образец» × «Выр», sizeOf q.2 < sizeOf q := fun q => by cases q; simp; omega
       first
         | (have := h2 ‹String × «Выр»›; omega)
         | (have := h3 ‹«Образец» × «Выр»›; omega))

theorem «свой-пусто» (P : «Программа») (f : String) (ps : List String) (p : String) (vt : «Зн») :
    «Свой» P f ps p none vt := fun y hy => by cases hy

theorem «хвост-пусто» (vt : «Зн») (ρ : «Среда») : «Хвост» none vt ρ := fun y hy => by cases hy

def «годнаКомпозиция» (ok : String → Bool) (g : «Функция») : Bool :=
  «годноР» ok "" [] "" none g.«тело» && g.«постусловия».all (fun q => «годноР» ok "" [] "" none q.«выражение»)

theorem «композиция-сходится» (P : «Программа») (ok : String → Bool) (H : «ТотР» P ok) (g : «Функция»)
    (h : «годнаКомпозиция» ok g = true) (ρ : «Среда») : «СходитсяТело» P g ρ := by
  simp only [«годнаКомпозиция», Bool.and_eq_true, List.all_eq_true] at h
  exact «тело-вечно» P g ρ
    («годноР-сходится» P ok "" [] "" H none .«ничто» («свой-пусто» P _ _ _ _) g.«тело» h.1 ρ («хвост-пусто» _ _))
    (fun q hq ρ' => «годноР-сходится» P ok "" [] "" H none .«ничто» («свой-пусто» P _ _ _ _) _ (h.2 q hq) ρ'
      («хвост-пусто» _ _))

def «случаиР» (ok : String → Bool) (f : String) (ps : List String) (p : String) : List («Образец» × «Выр») → Bool
  | [] => true
  | (pat, b) :: r => «годноР» ok f ps p («хвостОбразца» pat) b && «случаиР» ok f ps p r

theorem «случаиР-член» (ok : String → Bool) (f : String) (ps : List String) (p : String) :
    ∀ cs, «случаиР» ok f ps p cs = true → ∀ c ∈ cs, «годноР» ok f ps p («хвостОбразца» c.1) c.2 = true
  | [], _, c, hc => by cases hc
  | (k, x) :: r, h, c, hc => by
    simp only [«случаиР», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hc with rfl | hc
    · exact h.1
    · exact «случаиР-член» ok f ps p r h.2 c hc

def «рекурсивнаПоЧасти» (ok : String → Bool) (f : String) (g : «Функция») : Bool :=
  match g.«тело» with
  | .«разбор» (.«имя» p) cs =>
    «случаиР» ok f g.«параметры» p cs &&
      g.«постусловия».all (fun q => «годноР» ok f g.«параметры» p none q.«выражение»)
  | _ => false

theorem «рекурсия-сходится» (P : «Программа») (ok : String → Bool) (H : «ТотР» P ok) (f : String) (g : «Функция»)
    (hg : «функцияПрограммы» P f = some g) (hr : «рекурсивнаПоЧасти» ok f g = true) :
    ∀ vs, g.«параметры».length = vs.length → «СходитсяТело» P g («привязать» g.«параметры» vs) := by
  unfold «рекурсивнаПоЧасти» at hr
  split at hr
  · rename_i p cs hbody
    simp only [Bool.and_eq_true, List.all_eq_true] at hr
    obtain ⟨hcs, hposts⟩ := hr
    have hq : ∀ q ∈ g.«постусловия», ∀ ρ', «Сходится» P ρ' q.«выражение» := fun q hq ρ' =>
      «годноР-сходится» P ok f g.«параметры» p H none .«ничто» («свой-пусто» P _ _ _ _) _ (hposts q hq) ρ'
        («хвост-пусто» _ _)
    have key : ∀ n vs, g.«параметры».length = vs.length →
        (∀ v, «найти» p (g.«параметры».zip vs) = some v → «мера» v < n) →
        «СходитсяТело» P g («привязать» g.«параметры» vs) := by
      intro n
      induction n with
      | zero =>
        intro vs hl hm
        refine «тело-вечно» P g _ ?_ hq
        rw [hbody]
        apply «сходится-шагом»
        simp only [«шаг»]
        refine «вечно-связать» P («мон-выч» _ _)
          («сходится-шагом» («вечно-чистое» P (fun r => by
            simp only [«шаг»]
            split
            · simp
            · exact «беда-жива» _))) (fun v hv => ?_)
        obtain ⟨N, hN⟩ := hv
        exact absurd (hm v («имя-значение» P N _ p v hN)) (Nat.not_lt_zero _)
      | succ n ih =>
        intro vs hl hm
        refine «тело-вечно» P g _ ?_ hq
        rw [hbody]
        apply «сходится-шагом»
        simp only [«шаг»]
        refine «вечно-связать» P («мон-выч» _ _)
          («сходится-шагом» («вечно-чистое» P (fun r => by
            simp only [«шаг»]
            split
            · simp
            · exact «беда-жива» _))) (fun v hv => ?_)
        obtain ⟨N, hN⟩ := hv
        have hv0 := «имя-значение» P N _ p v hN
        have hmv := hm v hv0
        refine «разобрать-вечно» P _ v cs (fun c hc bs hb => ?_)
        have hc' := «случаиР-член» ok f g.«параметры» p cs hcs c hc
        cases ht : «хвостОбразца» c.1 with
        | none =>
          rw [ht] at hc'
          exact «годноР-сходится» P ok f g.«параметры» p H none .«ничто» («свой-пусто» P _ _ _ _) c.2 hc' _
            («хвост-пусто» _ _)
        | some y =>
          rw [ht] at hc'
          obtain ⟨w, hw, hlt⟩ := «подходит-хвост» c.1 v bs y ht hb
          refine «годноР-сходится» P ok f g.«параметры» p H (some y) w ?_ c.2 hc' _ ?_
          · intro y' _ g' hg' vs' hl' hf'
            have hgg : g' = g := by
              rw [hg] at hg'
              injection hg' with hg'
              exact hg'.symm
            subst hgg
            exact ih vs' hl' (fun v' hv' => by
              rw [hf'] at hv'
              injection hv' with hv'
              subst hv'
              omega)
          · intro y' hy'
            injection hy' with hy'
            subst hy'
            exact «найти-слева» y _ w bs hw
    intro vs hl
    cases hf : «найти» p (g.«параметры».zip vs) with
    | none => exact key 0 vs hl (fun v hv => by rw [hf] at hv; cases hv)
    | some v0 =>
      exact key («мера» v0 + 1) vs hl (fun v hv => by
        rw [hf] at hv
        injection hv with hv
        subst hv
        omega)
  · cases hr

def «кругР» (P : «Программа») (S : List String) : List String :=
  S ++ (P.filter (fun g =>
    match «функцияПрограммы» P g.«имя» with
    | some g0 => «годнаКомпозиция» («ниже» P S) g0 || «рекурсивнаПоЧасти» («ниже» P S) g.«имя» g0
    | none => false)).map (·.«имя»)

def «сходящиеся» (P : «Программа») : Nat → List String
  | 0 => []
  | k + 1 => «кругР» P («сходящиеся» P k)

theorem «сходящиеся-тот» (P : «Программа») : ∀ k, «ТотР» P («ниже» P («сходящиеся» P k))
  | 0 => fun c g h hg => by simp [«ниже», «сходящиеся», hg] at h
  | k + 1 => fun c g h hg => by
    have ih := «сходящиеся-тот» P k
    have h' : c ∈ «кругР» P («сходящиеся» P k) := by
      have h2 : «ниже» P («кругР» P («сходящиеся» P k)) c = true := h
      simpa [«ниже», hg] using h2
    simp only [«кругР», List.mem_append, List.mem_map, List.mem_filter] at h'
    rcases h' with h | ⟨g', ⟨_, hok⟩, hname⟩
    · exact ih c g (by simp [«ниже», h]) hg
    · rw [hname, hg] at hok
      simp only [Bool.or_eq_true] at hok
      rcases hok with hok | hok
      · exact fun vs _ => «композиция-сходится» P _ ih g hok _
      · exact «рекурсия-сходится» P _ ih c g hg hok

def «принятьНадРекурсией» (P : «Программа») (f : String) («названы» : List String) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    «годнаКомпозиция» («ниже» P («сходящиеся» P (P.length + 1))) g &&
      (!decide (f ∈ «зовыТела» g) &&
        ((«зовыТела» g).all (fun c => decide (c ∈ «названы»)) &&
          «названы».all (fun c => decide (c ∈ «зовыТела» g))))

theorem «композиция-над-рекурсией-завершается» (P : «Программа») (f : String) («названы» : List String)
    (h : «принятьНадРекурсией» P f «названы» = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧
      (∀ c, c ∈ «названы» ↔ c ∈ «зовыТела» g) ∧ f ∉ «зовыТела» g ∧
      ∀ ρ, ∃ N r, r ≠ .error .«топливо» ∧ ∀ m, N ≤ m → «вызватьТело» («выч» P m) g ρ = r := by
  unfold «принятьНадРекурсией» at h
  cases hg : «функцияПрограммы» P f with
  | none => simp [hg] at h
  | some g =>
  simp only [hg, Bool.and_eq_true, Bool.not_eq_true', decide_eq_false_iff_not, decide_eq_true_eq,
    List.all_eq_true] at h
  obtain ⟨hcomp, hself, hbody, hnamed⟩ := h
  exact ⟨g, rfl, fun c => ⟨hnamed c, hbody c⟩, hself, fun ρ =>
    «тело-исход» P g ρ («композиция-сходится» P _ («сходящиеся-тот» P (P.length + 1)) g hcomp ρ)⟩

namespace «ПробыРекурсии»

def «длина» (b : «Выр») : «Функция» :=
  { «имя» := "Длина", «параметры» := ["элементы"], «постусловия» := [],
    «тело» := .«разбор» (.«имя» "элементы")
      [(.«пусто», .«лит» (.«признак» true)), (.«звено» (some "голова") (some "хвост"), b)] }

def «принята» (b : «Выр») : Bool :=
  «рекурсивнаПоЧасти» («ниже» [«длина» b] []) "Длина" («длина» b)

#guard «принята» (.«вызов» "Длина" [.«имя» "хвост"])
#guard !«принята» (.«вызов» "Длина" [.«имя» "элементы"])
#guard !«принята» (.«вызов» "Длина" [.«имя» "голова"])
#guard !«принята» (.«пусть» "хвост" (.«имя» "элементы") (.«вызов» "Длина" [.«имя» "хвост"]))
#guard !«принята» (.«разбор» (.«имя» "элементы")
  [(.«звено» none (some "хвост"), .«вызов» "Длина" [.«имя» "хвост"])])
#guard !«принята» (.«свёртка» (.«имя» "элементы") (.«лит» .«ничто») "акк" "хвост" (.«вызов» "Длина" [.«имя» "хвост"]))
#guard !«принята» (.«вызов» "Длина" [.«форма» "хвост" [.«имя» "элементы"]])
#guard «принятьНадРекурсией»
  [«длина» (.«вызов» "Длина" [.«имя» "хвост"]),
   { «имя» := "Вдвое", «параметры» := ["элементы"], «тело» := .«вызов» "Длина" [.«имя» "элементы"],
     «постусловия» := [] }] "Вдвое" ["Длина"]
#guard !«принятьНадРекурсией»
  [«длина» (.«вызов» "Длина" [.«имя» "элементы"]),
   { «имя» := "Вдвое", «параметры» := ["элементы"], «тело» := .«вызов» "Длина" [.«имя» "элементы"],
     «постусловия» := [] }] "Вдвое" ["Длина"]

end «ПробыРекурсии»

end «Эталон»
