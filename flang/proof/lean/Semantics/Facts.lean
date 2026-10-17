import Semantics.Eval

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

namespace «Эталон»

theorem «пара-меньше» {α : Type} [SizeOf α] {p : α × «Выр»} {l : List (α × «Выр»)} (h : p ∈ l) :
    sizeOf p.2 < 1 + sizeOf l := by
  have := List.sizeOf_lt_of_mem h
  obtain ⟨a, e⟩ := p
  simp at this ⊢
  omega

def «вне?» (xs : List String) (y : String) : Bool := !(xs.contains y)

def «свободные» : «Выр» → List String
  | .«лит» _ => []
  | .«имя» x => [x]
  | .«двучлен» _ a b => «свободные» a ++ «свободные» b
  | .«если» c t e => «свободные» c ++ «свободные» t ++ «свободные» e
  | .«пусть» x v b => «свободные» v ++ («свободные» b).filter («вне?» [x])
  | .«вызов» _ args => args.flatMap «свободные»
  | .«разбор» t cs => «свободные» t ++ cs.flatMap (fun c => («свободные» c.2).filter («вне?» («связанные» c.1)))
  | .«свёртка» l n a x s => «свободные» l ++ «свободные» n ++ («свободные» s).filter («вне?» [a, x])
  | .«отобразить» l x s => «свободные» l ++ («свободные» s).filter («вне?» [x])
  | .«отфильтровать» l x s => «свободные» l ++ («свободные» s).filter («вне?» [x])
  | .«список» es => es.flatMap «свободные»
  | .«запись» fs => fs.flatMap (fun p => «свободные» p.2)
  | .«конструктор» _ fs => fs.flatMap (fun p => «свободные» p.2)
  | .«поле» t _ => «свободные» t
  | .«форма» _ args => args.flatMap «свободные»
  | .«ссылка» _ fs => fs.flatMap (fun p => «свободные» p.2)
  | .«применить» f args => «свободные» f ++ args.flatMap «свободные»
decreasing_by
  all_goals simp_wf
  all_goals first
    | omega
    | (have := List.sizeOf_lt_of_mem ‹_›; omega)
    | (have := «пара-меньше» ‹_›; omega)

def «убрать» {α : Type} (σ : List (String × α)) (xs : List String) : List (String × α) := σ.filter (fun b => «вне?» xs b.1)

def «подст» (σ : «Среда») : «Выр» → «Выр»
  | .«лит» v => .«лит» v
  | .«имя» x =>
    match «найти» x σ with
    | some v => .«лит» v
    | none => .«имя» x
  | .«двучлен» op a b => .«двучлен» op («подст» σ a) («подст» σ b)
  | .«если» c t e => .«если» («подст» σ c) («подст» σ t) («подст» σ e)
  | .«пусть» x v b => .«пусть» x («подст» σ v) («подст» («убрать» σ [x]) b)
  | .«вызов» f args => .«вызов» f (args.map («подст» σ))
  | .«разбор» t cs => .«разбор» («подст» σ t) (cs.map (fun c => (c.1, «подст» («убрать» σ («связанные» c.1)) c.2)))
  | .«свёртка» l n a x s => .«свёртка» («подст» σ l) («подст» σ n) a x («подст» («убрать» σ [a, x]) s)
  | .«отобразить» l x s => .«отобразить» («подст» σ l) x («подст» («убрать» σ [x]) s)
  | .«отфильтровать» l x s => .«отфильтровать» («подст» σ l) x («подст» («убрать» σ [x]) s)
  | .«список» es => .«список» (es.map («подст» σ))
  | .«запись» fs => .«запись» (fs.map (fun p => (p.1, «подст» σ p.2)))
  | .«конструктор» k fs => .«конструктор» k (fs.map (fun p => (p.1, «подст» σ p.2)))
  | .«поле» t p => .«поле» («подст» σ t) p
  | .«форма» n args => .«форма» n (args.map («подст» σ))
  | .«ссылка» f fs => .«ссылка» f (fs.map (fun p => (p.1, «подст» σ p.2)))
  | .«применить» f args => .«применить» («подст» σ f) (args.map («подст» σ))
termination_by e => sizeOf e
decreasing_by
  all_goals simp_wf
  all_goals first
    | omega
    | (have := List.sizeOf_lt_of_mem ‹_›; omega)
    | (have := «пара-меньше» ‹_›; omega)

def «Согласны» (σ ρ ρ' : «Среда») (xs : List String) : Prop :=
  ∀ y ∈ xs, «найти» y ρ' = («найти» y σ).or («найти» y ρ)

theorem «согласны-часть» {σ ρ ρ' : «Среда»} {xs ys : List String} (h : «Согласны» σ ρ ρ' xs)
    (hs : ∀ y ∈ ys, y ∈ xs) : «Согласны» σ ρ ρ' ys := fun y hy => h y (hs y hy)

theorem «найти-склейка» {α : Type} (y : String) : ∀ (bs ρ : List (String × α)), «найти» y (bs ++ ρ) = («найти» y bs).or («найти» y ρ)
  | [], ρ => by simp [«найти»]
  | (k, v) :: r, ρ => by
    simp only [List.cons_append, «найти»]
    split
    · rfl
    · exact «найти-склейка» y r ρ

theorem «найти-убрать» {α : Type} (y : String) (xs : List String) : ∀ (σ : List (String × α)),
    «найти» y («убрать» σ xs) = if xs.contains y then none else «найти» y σ
  | [] => by simp [«убрать», «найти»]
  | (k, v) :: r => by
    have ih := «найти-убрать» y xs r
    simp only [«убрать»] at ih ⊢
    rw [List.filter_cons]
    by_cases hk : «вне?» xs k = true
    · simp only [hk, ite_true, «найти»]
      by_cases hy : k = y
      · subst hy
        simp only [«вне?», Bool.not_eq_true'] at hk
        have hm : k ∉ xs := by simpa using hk
        simp [hm]
      · simp only [hy, ite_false]; rw [ih]
    · simp only [hk, Bool.false_eq_true, ite_false]
      rw [ih]
      simp only [«найти»]
      by_cases hy : k = y
      · subst hy
        simp only [«вне?», Bool.not_eq_true, Bool.not_eq_false'] at hk
        have hm : k ∈ xs := by simpa using hk
        simp [hm]
      · simp [hy]

theorem «найти-ключи» {α : Type} (y : String) : ∀ (bs : List (String × α)), y ∉ bs.map (·.1) → «найти» y bs = none
  | [], _ => rfl
  | (k, v) :: r, h => by
    simp only [List.map_cons, List.mem_cons, not_or] at h
    simp only [«найти»]
    have : ¬ k = y := fun e => h.1 e.symm
    simp only [this, ite_false]
    exact «найти-ключи» y r h.2

theorem «найти-есть» {α : Type} (y : String) : ∀ (bs : List (String × α)), y ∈ bs.map (·.1) → («найти» y bs).isSome
  | [], h => by simp at h
  | (k, v) :: r, h => by
    simp only [«найти»]
    split
    · rfl
    · rename_i hk
      simp only [List.map_cons, List.mem_cons] at h
      rcases h with h | h
      · exact absurd h.symm hk
      · exact «найти-есть» y r h

theorem «согласны-под» {σ ρ ρ' : «Среда»} {xs : List String} {fv outer : List String}
    (bs : «Среда») (hk : bs.map (·.1) = xs)
    (hout : ∀ y ∈ fv, xs.contains y = false → y ∈ outer)
    (h : «Согласны» σ ρ ρ' outer) : «Согласны» («убрать» σ xs) (bs ++ ρ) (bs ++ ρ') fv := by
  intro y hy
  rw [«найти-склейка», «найти-склейка», «найти-убрать»]
  by_cases hc : xs.contains y = true
  · simp only [hc, ite_true, Option.none_or]
    have hm : y ∈ bs.map (·.1) := by rw [hk]; simpa using hc
    obtain ⟨w, hw⟩ := Option.isSome_iff_exists.mp («найти-есть» y bs hm)
    rw [hw]; rfl
  · have hc' : xs.contains y = false := by simpa using hc
    simp only [hc', Bool.false_eq_true, ite_false]
    have hm : y ∉ bs.map (·.1) := by rw [hk]; simpa using hc'
    rw [«найти-ключи» y bs hm, Option.none_or, Option.none_or]
    exact h y (hout y hy hc')

theorem «вычВсе-подст» (rec : «Среда» → «Выр» → «Исход») (ρ ρ' : «Среда») (f : «Выр» → «Выр») :
    ∀ es : List «Выр», (∀ e ∈ es, rec ρ (f e) = rec ρ' e) → «вычВсе» rec ρ (es.map f) = «вычВсе» rec ρ' es
  | [], _ => rfl
  | e :: r, h => by
    simp only [List.map_cons, «вычВсе»]
    rw [h e List.mem_cons_self, «вычВсе-подст» rec ρ ρ' f r (fun x hx => h x (List.mem_cons_of_mem _ hx))]

theorem «вычПоля-подст» (rec : «Среда» → «Выр» → «Исход») (ρ ρ' : «Среда») (f : «Выр» → «Выр») :
    ∀ fs : List (String × «Выр»), (∀ p ∈ fs, rec ρ (f p.2) = rec ρ' p.2) →
      «вычПоля» rec ρ (fs.map (fun p => (p.1, f p.2))) = «вычПоля» rec ρ' fs
  | [], _ => rfl
  | (k, e) :: r, h => by
    simp only [List.map_cons, «вычПоля»]
    rw [h (k, e) List.mem_cons_self, «вычПоля-подст» rec ρ ρ' f r (fun x hx => h x (List.mem_cons_of_mem _ hx))]

theorem «свернуть-подст» (rec : «Среда» → «Выр» → «Исход») (ρ ρ' : «Среда») (a x : String) (s s' : «Выр»)
    (h : ∀ acc v, rec ((a, acc) :: (x, v) :: ρ) s' = rec ((a, acc) :: (x, v) :: ρ') s) :
    ∀ (l : List «Зн») (acc : «Зн»), «свернуть» rec ρ a x s' acc l = «свернуть» rec ρ' a x s acc l
  | [], acc => rfl
  | v :: r, acc => by
    simp only [«свернуть»]
    rw [h acc v]
    congr 1
    funext acc'
    exact «свернуть-подст» rec ρ ρ' a x s s' h r acc'

theorem «образы-подст» (rec : «Среда» → «Выр» → «Исход») (ρ ρ' : «Среда») (x : String) (s s' : «Выр»)
    (h : ∀ v, rec ((x, v) :: ρ) s' = rec ((x, v) :: ρ') s) :
    ∀ (l : List «Зн»), «образы» rec ρ x s' l = «образы» rec ρ' x s l
  | [] => rfl
  | v :: r => by
    simp only [«образы»]
    rw [h v, «образы-подст» rec ρ ρ' x s s' h r]

theorem «отбор-подст» (rec : «Среда» → «Выр» → «Исход») (ρ ρ' : «Среда») (x : String) (s s' : «Выр»)
    (h : ∀ v, rec ((x, v) :: ρ) s' = rec ((x, v) :: ρ') s) :
    ∀ (l : List «Зн»), «отбор» rec ρ x s' l = «отбор» rec ρ' x s l
  | [] => rfl
  | v :: r => by
    simp only [«отбор»]
    rw [h v, «отбор-подст» rec ρ ρ' x s s' h r]

theorem «разобрать-подст» (rec : «Среда» → «Выр» → «Исход») (ρ ρ' : «Среда») (v : «Зн»)
    (g : «Образец» × «Выр» → «Выр») :
    ∀ cs : List («Образец» × «Выр»),
      (∀ c ∈ cs, ∀ bs, «подходит» c.1 v = .ok (some bs) → rec (bs ++ ρ) (g c) = rec (bs ++ ρ') c.2) →
      «разобрать» rec ρ v (cs.map (fun c => (c.1, g c))) = «разобрать» rec ρ' v cs
  | [], _ => rfl
  | (p, b) :: r, h => by
    simp only [List.map_cons, «разобрать»]
    cases hp : «подходит» p v with
    | error e => rfl
    | ok o =>
      cases o with
      | none => exact «разобрать-подст» rec ρ ρ' v g r (fun c hc => h c (List.mem_cons_of_mem _ hc))
      | some bs => exact h (p, b) List.mem_cons_self bs hp

theorem «связки-ключи» (fs : List (String × «Зн»)) : ∀ (bs : List (String × String)) (e : «Среда»),
    «связки» fs bs = .ok e → e.map (·.1) = bs.map (·.2)
  | [], e, h => by simp [«связки»] at h; subst h; rfl
  | (k, x) :: r, e, h => by
    simp only [«связки»] at h
    split at h
    · rename_i v hv
      cases hr : «связки» fs r with
      | error q => rw [hr] at h; cases h
      | ok w =>
        rw [hr] at h
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at h
        subst h
        simp [«связки-ключи» fs r w hr]
    · cases h

theorem «подходит-ключи» : ∀ (p : «Образец») (v : «Зн») (bs : «Среда»),
    «подходит» p v = .ok (some bs) → bs.map (·.1) = «связанные» p
  | .«пусто», .«строка» s, bs, h => by
    simp only [«подходит», Except.ok.injEq] at h; split at h <;> simp_all [«связанные»]
  | .«пусто», .«список» l, bs, h => by
    simp only [«подходит», Except.ok.injEq] at h; split at h <;> simp_all [«связанные»]
  | .«звено» hh tt, .«строка» s, bs, h => by
    simp only [«подходит»] at h
    split at h
    · cases h
    · simp only [Except.ok.injEq, Option.some.injEq] at h
      subst h
      cases hh <;> cases tt <;> rfl
  | .«звено» hh tt, .«список» l, bs, h => by
    simp only [«подходит»] at h
    split at h
    · cases h
    · simp only [Except.ok.injEq, Option.some.injEq] at h
      subst h
      cases hh <;> cases tt <;> rfl
  | .«вариант» k ps, .«вариант» m fs, bs, h => by
    simp only [«подходит»] at h
    split at h
    · cases hc : «связки» fs ps with
      | error q => rw [hc] at h; cases h
      | ok w =>
        rw [hc] at h
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq, Option.some.injEq] at h
        subst h
        exact «связки-ключи» fs ps w hc
    · cases h
  | .«лит» u, w, bs, h => by
    simp only [«подходит», Except.ok.injEq] at h; split at h <;> simp_all [«связанные»]
  | .«любое», w, bs, h => by
    simp only [«подходит», Except.ok.injEq, Option.some.injEq] at h; subst h; rfl
  | .«пусто», .«число» _, bs, h => by simp [«подходит»] at h
  | .«пусто», .«признак» _, bs, h => by simp [«подходит»] at h
  | .«пусто», .«ничто», bs, h => by simp [«подходит»] at h
  | .«пусто», .«запись» _, bs, h => by simp [«подходит»] at h
  | .«пусто», .«вариант» _ _, bs, h => by simp [«подходит»] at h
  | .«звено» _ _, .«число» _, bs, h => by simp [«подходит»] at h
  | .«звено» _ _, .«признак» _, bs, h => by simp [«подходит»] at h
  | .«звено» _ _, .«ничто», bs, h => by simp [«подходит»] at h
  | .«звено» _ _, .«запись» _, bs, h => by simp [«подходит»] at h
  | .«звено» _ _, .«вариант» _ _, bs, h => by simp [«подходит»] at h
  | .«вариант» _ _, .«число» _, bs, h => by simp [«подходит»] at h
  | .«вариант» _ _, .«строка» _, bs, h => by simp [«подходит»] at h
  | .«вариант» _ _, .«признак» _, bs, h => by simp [«подходит»] at h
  | .«вариант» _ _, .«ничто», bs, h => by simp [«подходит»] at h
  | .«вариант» _ _, .«список» _, bs, h => by simp [«подходит»] at h
  | .«вариант» _ _, .«запись» _, bs, h => by simp [«подходит»] at h

theorem «согласны-связать» {σ ρ ρ' : «Среда»} {outer : List String} (x : String) (w : «Зн») (b : «Выр»)
    (hout : ∀ y ∈ «свободные» b, [x].contains y = false → y ∈ outer) (h : «Согласны» σ ρ ρ' outer) :
    «Согласны» («убрать» σ [x]) ((x, w) :: ρ) ((x, w) :: ρ') («свободные» b) :=
  «согласны-под» [(x, w)] rfl hout h

theorem «согласны-связать2» {σ ρ ρ' : «Среда»} {outer : List String} (a x : String) (u w : «Зн») (b : «Выр»)
    (hout : ∀ y ∈ «свободные» b, [a, x].contains y = false → y ∈ outer) (h : «Согласны» σ ρ ρ' outer) :
    «Согласны» («убрать» σ [a, x]) ((a, u) :: (x, w) :: ρ) ((a, u) :: (x, w) :: ρ') («свободные» b) :=
  «согласны-под» [(a, u), (x, w)] rfl hout h

theorem «вне-фильтр» {xs : List String} {y : String} {l : List String} (hy : y ∈ l) (hc : xs.contains y = false) :
    y ∈ l.filter («вне?» xs) := by
  have hm : y ∉ xs := by simpa using hc
  simp [List.mem_filter, «вне?», hy, hm]

theorem «в-плоском» {l : List «Выр»} {e : «Выр»} {y : String} (he : e ∈ l) (hy : y ∈ «свободные» e) :
    y ∈ l.flatMap «свободные» := List.mem_flatMap.mpr ⟨e, he, hy⟩

theorem «в-полях» {l : List (String × «Выр»)} {p : String × «Выр»} {y : String} (he : p ∈ l)
    (hy : y ∈ «свободные» p.2) : y ∈ l.flatMap (fun q => «свободные» q.2) := List.mem_flatMap.mpr ⟨p, he, hy⟩

theorem «подст-верна» (P : «Программа») : ∀ (n : Nat) (σ ρ ρ' : «Среда») (e : «Выр»),
    «Согласны» σ ρ ρ' («свободные» e) → «выч» P n ρ («подст» σ e) = «выч» P n ρ' e
  | 0, _, _, _, _, _ => rfl
  | n + 1, σ, ρ, ρ', e, h => by
    have ih := «подст-верна» P n
    cases e with
    | «лит» v => simp only [«подст», «выч», «шаг»]
    | «имя» x =>
      have hx := h x (by simp [«свободные»])
      simp only [«подст»]
      cases hs : «найти» x σ with
      | some v => simp only [«выч», «шаг»]; rw [hx, hs]; rfl
      | none => simp only [«выч», «шаг»]; rw [hx, hs]; rfl
    | «двучлен» op a b =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' a («согласны-часть» h (by intro y hy; simp [«свободные», hy])),
        ih σ ρ ρ' b («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
    | «если» c t e =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' c («согласны-часть» h (by intro y hy; simp [«свободные», hy])),
        ih σ ρ ρ' t («согласны-часть» h (by intro y hy; simp [«свободные», hy])),
        ih σ ρ ρ' e («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
    | «пусть» x v b =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' v («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
      congr 1
      funext w
      exact ih _ _ _ b («согласны-связать» x w b (fun y hy hc => by
        simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)
    | «вызов» f args =>
      simp only [«подст», «выч», «шаг»]
      rw [«вычВсе-подст» _ ρ ρ' _ args (fun a ha => ih σ ρ ρ' a («согласны-часть» h (fun y hy => by
        simp only [«свободные»]; exact «в-плоском» ha hy)))]
    | «разбор» t cs =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' t («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
      congr 1
      funext v
      exact «разобрать-подст» _ ρ ρ' v _ cs (fun c hc bs hb => ih _ _ _ c.2
        («согласны-под» bs («подходит-ключи» c.1 v bs hb) (fun y hy hcy => by
          simp only [«свободные»]
          exact List.mem_append_right _ (List.mem_flatMap.mpr ⟨c, hc, «вне-фильтр» hy hcy⟩)) h))
    | «свёртка» l m a x b =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' l («согласны-часть» h (by intro y hy; simp [«свободные», hy])),
        ih σ ρ ρ' m («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
      congr 1; funext lv; congr 1; funext mv
      cases lv with
      | «список» xs =>
        exact «свернуть-подст» _ ρ ρ' a x b _ (fun acc w => ih _ _ _ b («согласны-связать2» a x acc w b
          (fun y hy hc => by
            simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)) xs mv
      | _ => rfl
    | «отобразить» l x b =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' l («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
      congr 1; funext lv
      cases lv with
      | «список» xs =>
        simp only
        rw [«образы-подст» _ ρ ρ' x b _ (fun w => ih _ _ _ b («согласны-связать» x w b
          (fun y hy hc => by
            simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)) xs]
      | _ => rfl
    | «отфильтровать» l x b =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' l («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
      congr 1; funext lv
      cases lv with
      | «список» xs =>
        simp only
        rw [«отбор-подст» _ ρ ρ' x b _ (fun w => ih _ _ _ b («согласны-связать» x w b
          (fun y hy hc => by
            simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)) xs]
      | _ => rfl
    | «список» es =>
      simp only [«подст», «выч», «шаг»]
      rw [«вычВсе-подст» _ ρ ρ' _ es (fun a ha => ih σ ρ ρ' a («согласны-часть» h (fun y hy => by
        simp only [«свободные»]; exact «в-плоском» ha hy)))]
    | «запись» fs =>
      simp only [«подст», «выч», «шаг»]
      rw [«вычПоля-подст» _ ρ ρ' _ fs (fun q hq => ih σ ρ ρ' q.2 («согласны-часть» h (fun y hy => by
        simp only [«свободные»]; exact «в-полях» hq hy)))]
    | «конструктор» k fs =>
      simp only [«подст», «выч», «шаг»]
      rw [«вычПоля-подст» _ ρ ρ' _ fs (fun q hq => ih σ ρ ρ' q.2 («согласны-часть» h (fun y hy => by
        simp only [«свободные»]; exact «в-полях» hq hy)))]
    | «поле» t q =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' t («согласны-часть» h (by intro y hy; simp [«свободные», hy]))]
    | «форма» nm args =>
      simp only [«подст», «выч», «шаг»]
      rw [«вычВсе-подст» _ ρ ρ' _ args (fun a ha => ih σ ρ ρ' a («согласны-часть» h (fun y hy => by
        simp only [«свободные»]; exact «в-плоском» ha hy)))]
    | «ссылка» f fs =>
      simp only [«подст», «выч», «шаг»]
      rw [«вычПоля-подст» _ ρ ρ' _ fs (fun q hq => ih σ ρ ρ' q.2 («согласны-часть» h (fun y hy => by
        simp only [«свободные»]; exact «в-полях» hq hy)))]
    | «применить» f args =>
      simp only [«подст», «выч», «шаг»]
      rw [ih σ ρ ρ' f («согласны-часть» h (by intro y hy; simp [«свободные», hy])),
        «вычВсе-подст» _ ρ ρ' _ args (fun a ha => ih σ ρ ρ' a («согласны-часть» h (fun y hy => by
          simp only [«свободные»]; exact List.mem_append_right _ («в-плоском» ha hy))))]

end «Эталон»
