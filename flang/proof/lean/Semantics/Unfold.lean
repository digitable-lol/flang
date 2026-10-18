import Semantics.Facts
import Semantics.Fuel

set_option linter.unusedVariables false
set_option linter.unusedSimpArgs false

namespace «Эталон»

theorem «окружение-неважно» (P : «Программа») (n : Nat) (ρ ρ' : «Среда») (e : «Выр»)
    (h : ∀ y ∈ «свободные» e, «найти» y ρ' = «найти» y ρ) : «выч» P n ρ e = «выч» P n ρ' e := by
  have a := «подст-верна» P n [] ρ ρ' e (fun y hy => by rw [h y hy]; rfl)
  have b := «подст-верна» P n [] ρ ρ e (fun y hy => rfl)
  rw [← a, b]

def «связанныеВ» : «Выр» → List String
  | .«лит» _ => []
  | .«имя» _ => []
  | .«двучлен» _ a b => «связанныеВ» a ++ «связанныеВ» b
  | .«если» c t e => «связанныеВ» c ++ «связанныеВ» t ++ «связанныеВ» e
  | .«пусть» x v b => x :: («связанныеВ» v ++ «связанныеВ» b)
  | .«вызов» _ args => args.flatMap «связанныеВ»
  | .«разбор» t cs => «связанныеВ» t ++ cs.flatMap (fun c => «связанные» c.1 ++ «связанныеВ» c.2)
  | .«свёртка» l n a x s => a :: x :: («связанныеВ» l ++ «связанныеВ» n ++ «связанныеВ» s)
  | .«отобразить» l x s => x :: («связанныеВ» l ++ «связанныеВ» s)
  | .«отфильтровать» l x s => x :: («связанныеВ» l ++ «связанныеВ» s)
  | .«список» es => es.flatMap «связанныеВ»
  | .«запись» fs => fs.flatMap (fun p => «связанныеВ» p.2)
  | .«конструктор» _ fs => fs.flatMap (fun p => «связанныеВ» p.2)
  | .«поле» t _ => «связанныеВ» t
  | .«форма» _ args => args.flatMap «связанныеВ»
  | .«ссылка» _ fs => fs.flatMap (fun p => «связанныеВ» p.2)
  | .«применить» f args => «связанныеВ» f ++ args.flatMap «связанныеВ»
decreasing_by
  all_goals simp_wf
  all_goals first
    | omega
    | (have := List.sizeOf_lt_of_mem ‹_›; omega)
    | (have := «пара-меньше» ‹_›; omega)

def «подстВыр» (τ : List (String × «Выр»)) : «Выр» → «Выр»
  | .«лит» v => .«лит» v
  | .«имя» x =>
    match «найти» x τ with
    | some a => a
    | none => .«имя» x
  | .«двучлен» op a b => .«двучлен» op («подстВыр» τ a) («подстВыр» τ b)
  | .«если» c t e => .«если» («подстВыр» τ c) («подстВыр» τ t) («подстВыр» τ e)
  | .«пусть» x v b => .«пусть» x («подстВыр» τ v) («подстВыр» («убрать» τ [x]) b)
  | .«вызов» f args => .«вызов» f (args.map («подстВыр» τ))
  | .«разбор» t cs => .«разбор» («подстВыр» τ t) (cs.map (fun c => (c.1, «подстВыр» («убрать» τ («связанные» c.1)) c.2)))
  | .«свёртка» l n a x s => .«свёртка» («подстВыр» τ l) («подстВыр» τ n) a x («подстВыр» («убрать» τ [a, x]) s)
  | .«отобразить» l x s => .«отобразить» («подстВыр» τ l) x («подстВыр» («убрать» τ [x]) s)
  | .«отфильтровать» l x s => .«отфильтровать» («подстВыр» τ l) x («подстВыр» («убрать» τ [x]) s)
  | .«список» es => .«список» (es.map («подстВыр» τ))
  | .«запись» fs => .«запись» (fs.map (fun p => (p.1, «подстВыр» τ p.2)))
  | .«конструктор» k fs => .«конструктор» k (fs.map (fun p => (p.1, «подстВыр» τ p.2)))
  | .«поле» t p => .«поле» («подстВыр» τ t) p
  | .«форма» n args => .«форма» n (args.map («подстВыр» τ))
  | .«ссылка» f fs => .«ссылка» f (fs.map (fun p => (p.1, «подстВыр» τ p.2)))
  | .«применить» f args => .«применить» («подстВыр» τ f) (args.map («подстВыр» τ))
termination_by e => sizeOf e
decreasing_by
  all_goals simp_wf
  all_goals first
    | omega
    | (have := List.sizeOf_lt_of_mem ‹_›; omega)
    | (have := «пара-меньше» ‹_›; omega)

theorem «вычВсе-сравн» {r r' : «Вычислитель»} {ρ ρ' : «Среда»} {f : «Выр» → «Выр»} :
    ∀ es : List «Выр», (∀ e ∈ es, «Не позже» (r ρ e) (r' ρ' (f e))) →
      «Не позже» («вычВсе» r ρ es) («вычВсе» r' ρ' (es.map f))
  | [], _ => «не позже-сам» _
  | e :: t, h => «не позже-связать» (h e List.mem_cons_self) (fun v =>
      «не позже-связать» («вычВсе-сравн» t (fun x hx => h x (List.mem_cons_of_mem _ hx))) (fun w => «не позже-сам» _))

theorem «вычПоля-сравн» {r r' : «Вычислитель»} {ρ ρ' : «Среда»} {f : «Выр» → «Выр»} :
    ∀ fs : List (String × «Выр»), (∀ p ∈ fs, «Не позже» (r ρ p.2) (r' ρ' (f p.2))) →
      «Не позже» («вычПоля» r ρ fs) («вычПоля» r' ρ' (fs.map (fun p => (p.1, f p.2))))
  | [], _ => «не позже-сам» _
  | (k, e) :: t, h => «не позже-связать» (h (k, e) List.mem_cons_self) (fun v =>
      «не позже-связать» («вычПоля-сравн» t (fun x hx => h x (List.mem_cons_of_mem _ hx))) (fun w => «не позже-сам» _))

theorem «свернуть-сравн» {r r' : «Вычислитель»} {ρ ρ' : «Среда»} (a x : String) (s s' : «Выр»)
    (h : ∀ acc v, «Не позже» (r ((a, acc) :: (x, v) :: ρ) s) (r' ((a, acc) :: (x, v) :: ρ') s')) :
    ∀ (l : List «Зн») (acc : «Зн»), «Не позже» («свернуть» r ρ a x s acc l) («свернуть» r' ρ' a x s' acc l)
  | [], acc => «не позже-сам» _
  | v :: t, acc => «не позже-связать» (h acc v) (fun w => «свернуть-сравн» a x s s' h t w)

theorem «образы-сравн» {r r' : «Вычислитель»} {ρ ρ' : «Среда»} (x : String) (s s' : «Выр»)
    (h : ∀ v, «Не позже» (r ((x, v) :: ρ) s) (r' ((x, v) :: ρ') s')) :
    ∀ (l : List «Зн»), «Не позже» («образы» r ρ x s l) («образы» r' ρ' x s' l)
  | [] => «не позже-сам» _
  | v :: t => «не позже-связать» (h v) (fun w => «не позже-связать» («образы-сравн» x s s' h t) (fun _ => «не позже-сам» _))

theorem «отбор-сравн» {r r' : «Вычислитель»} {ρ ρ' : «Среда»} (x : String) (s s' : «Выр»)
    (h : ∀ v, «Не позже» (r ((x, v) :: ρ) s) (r' ((x, v) :: ρ') s')) :
    ∀ (l : List «Зн»), «Не позже» («отбор» r ρ x s l) («отбор» r' ρ' x s' l)
  | [] => «не позже-сам» _
  | v :: t => «не позже-связать» (h v) (fun w => «не позже-связать» («отбор-сравн» x s s' h t) (fun _ => «не позже-сам» _))

theorem «разобрать-сравн» {r r' : «Вычислитель»} {ρ ρ' : «Среда»} (v : «Зн») (g : «Образец» × «Выр» → «Выр») :
    ∀ cs : List («Образец» × «Выр»),
      (∀ c ∈ cs, ∀ bs, «подходит» c.1 v = .ok (some bs) → «Не позже» (r (bs ++ ρ) c.2) (r' (bs ++ ρ') (g c))) →
      «Не позже» («разобрать» r ρ v cs) («разобрать» r' ρ' v (cs.map (fun c => (c.1, g c))))
  | [], _ => «не позже-сам» _
  | (p, b) :: t, h => by
    simp only [List.map_cons, «разобрать»]
    cases hp : «подходит» p v with
    | error e => exact «не позже-сам» _
    | ok o =>
      cases o with
      | none => exact «разобрать-сравн» v g t (fun c hc => h c (List.mem_cons_of_mem _ hc))
      | some bs => exact h (p, b) List.mem_cons_self bs hp

def «Доводы верны» (P : «Программа») (m0 : Nat) (ρ0 : «Среда») (τ : List (String × «Выр»)) (σ : «Среда») : Prop :=
  (∀ y a, «найти» y τ = some a → ∃ u, «найти» y σ = some u ∧
    ∀ ρ k, (∀ z ∈ «свободные» a, «найти» z ρ = «найти» z ρ0) → «выч» P (m0 + k) ρ a = .ok u) ∧
  (∀ y, «найти» y τ = none → «найти» y σ = none)

def «Не задеты» (ρ0 ρ : «Среда») (τ : List (String × «Выр»)) : Prop :=
  ∀ y a, «найти» y τ = some a → ∀ z ∈ «свободные» a, «найти» z ρ = «найти» z ρ0

def «Без захвата» (τ : List (String × «Выр»)) (L : List String) : Prop :=
  ∀ y a, «найти» y τ = some a → ∀ z ∈ «свободные» a, z ∉ L

theorem «найти-из-убрать» {α : Type} {y : String} {xs : List String} {τ : List (String × α)} {a : α}
    (h : «найти» y («убрать» τ xs) = some a) : «найти» y τ = some a := by
  rw [«найти-убрать»] at h
  split at h
  · cases h
  · exact h

theorem «доводы-убрать» {P : «Программа»} {m0 : Nat} {ρ0 : «Среда»} {τ : List (String × «Выр»)} {σ : «Среда»}
    (xs : List String) (h : «Доводы верны» P m0 ρ0 τ σ) : «Доводы верны» P m0 ρ0 («убрать» τ xs) («убрать» σ xs) := by
  refine ⟨fun y a ha => ?_, fun y hn => ?_⟩
  · have ha' := ha
    rw [«найти-убрать»] at ha'
    split at ha'
    · cases ha'
    · rename_i hc
      obtain ⟨u, hu, hev⟩ := h.1 y a ha'
      refine ⟨u, ?_, hev⟩
      rw [«найти-убрать»]; simp only [hc, ite_false, Bool.false_eq_true]; exact hu
  · rw [«найти-убрать»] at hn ⊢
    split
    · rfl
    · rename_i hc
      simp only [hc, ite_false, Bool.false_eq_true] at hn
      exact h.2 y hn

theorem «без захвата-часть» {τ : List (String × «Выр»)} {L L' : List String} (h : «Без захвата» τ L)
    (hs : ∀ z ∈ L', z ∈ L) : «Без захвата» τ L' :=
  fun y a ha z hz hl => h y a ha z hz (hs z hl)

theorem «без захвата-убрать» {τ : List (String × «Выр»)} {L : List String} (xs : List String) (h : «Без захвата» τ L) :
    «Без захвата» («убрать» τ xs) L :=
  fun y a ha z hz => h y a («найти-из-убрать» ha) z hz

theorem «не задеты-под» {ρ0 ρ : «Среда»} {τ : List (String × «Выр»)} {L : List String} (bs : «Среда»)
    (xs : List String) (hk : bs.map (·.1) = xs) (hx : ∀ z ∈ xs, z ∈ L)
    (h : «Не задеты» ρ0 ρ τ) (hc : «Без захвата» τ L) : «Не задеты» ρ0 (bs ++ ρ) («убрать» τ xs) := by
  intro y a ha z hz
  have ha' := «найти-из-убрать» ha
  rw [«найти-склейка»]
  have hzx : z ∉ bs.map (·.1) := by
    rw [hk]; intro hm; exact hc y a ha' z hz (hx z hm)
  rw [«найти-ключи» z bs hzx, Option.none_or]
  exact h y a ha' z hz

theorem «подстВыр-верна» (P : «Программа») (m0 : Nat) (ρ0 : «Среда») : ∀ (n : Nat) (τ : List (String × «Выр»))
    (σ ρ ρ' : «Среда») (e : «Выр»), «Доводы верны» P m0 ρ0 τ σ → «Не задеты» ρ0 ρ τ →
    «Без захвата» τ («связанныеВ» e) → «Согласны» σ ρ ρ' («свободные» e) →
    «Не позже» («выч» P n ρ' e) («выч» P (n + m0) ρ («подстВыр» τ e))
  | 0, _, _, _, _, _, _, _, _, _ => Or.inl rfl
  | n + 1, τ, σ, ρ, ρ', e, hd, hn, hb, h => by
    have ih := «подстВыр-верна» P m0 ρ0 n
    have hf : n + 1 + m0 = (n + m0) + 1 := by omega
    have sub : ∀ e', (∀ z ∈ «свободные» e', z ∈ «свободные» e) → (∀ z ∈ «связанныеВ» e', z ∈ «связанныеВ» e) →
        «Не позже» («выч» P n ρ' e') («выч» P (n + m0) ρ («подстВыр» τ e')) :=
      fun e' h1 h2 => ih τ σ ρ ρ' e' hd hn («без захвата-часть» hb h2) («согласны-часть» h h1)
    cases e with
    | «лит» v => rw [hf]; simp only [«подстВыр», «выч», «шаг»]; exact «не позже-сам» _
    | «имя» x =>
      have hx := h x (by simp [«свободные»])
      cases ht : «найти» x τ with
      | some a =>
        obtain ⟨u, hu, hev⟩ := hd.1 x a ht
        simp only [«подстВыр», ht]
        rw [show n + 1 + m0 = m0 + (n + 1) by omega, hev ρ (n + 1) (hn x a ht)]
        simp only [«выч», «шаг»]
        rw [hx, hu]; exact «не позже-сам» _
      | none =>
        have hs := hd.2 x ht
        rw [hf]
        simp only [«подстВыр», ht, «выч», «шаг»]
        rw [hx, hs, Option.none_or]; exact «не позже-сам» _
    | «двучлен» op a b =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» (sub a (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy]))
        (fun x => «не позже-связать» (sub b (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy]))
          (fun y => «не позже-сам» _))
    | «если» c t e =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub c (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun u => ?_)
      cases u with
      | «признак» b => cases b with
        | true => exact sub t (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])
        | false => exact sub e (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])
      | _ => exact «не позже-сам» _
    | «пусть» x v b =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub v (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun w => ?_)
      exact ih _ _ ((x, w) :: ρ) ((x, w) :: ρ') b («доводы-убрать» [x] hd)
        («не задеты-под» [(x, w)] [x] rfl (by simp [«связанныеВ»]) hn hb)
        («без захвата-убрать» [x] («без захвата-часть» hb (by intro y hy; simp [«связанныеВ», hy])))
        («согласны-связать» x w b (fun y hy hc => by
          simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)
    | «вызов» f args =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» («вычВсе-сравн» args (fun a ha => sub a
        (fun y hy => by simp only [«свободные»]; exact «в-плоском» ha hy)
        (fun y hy => by simp only [«связанныеВ»]; exact List.mem_flatMap.mpr ⟨a, ha, hy⟩))) (fun vs => ?_)
      cases «функцияПрограммы» P f with
      | none => exact «не позже-сам» _
      | some g =>
        by_cases hl : g.«параметры».length = vs.length
        · simp only [hl, ↓reduceIte]; exact «тело-раньше» («топливо-запас» P n m0) g _
        · simp only [hl, ↓reduceIte]; exact «не позже-сам» _
    | «разбор» t cs =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub t (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun v => ?_)
      exact «разобрать-сравн» v _ cs (fun c hc bs hp => by
        have hk := «подходит-ключи» c.1 v bs hp
        have hxs : ∀ z ∈ «связанные» c.1, z ∈ «связанныеВ» (.«разбор» t cs) := fun z hz => by
          simp only [«связанныеВ»]
          exact List.mem_append_right _ (List.mem_flatMap.mpr ⟨c, hc, List.mem_append_left _ hz⟩)
        exact ih _ _ (bs ++ ρ) (bs ++ ρ') c.2 («доводы-убрать» _ hd)
          («не задеты-под» bs _ hk hxs hn hb)
          («без захвата-убрать» _ («без захвата-часть» hb (fun z hz => by
            simp only [«связанныеВ»]
            exact List.mem_append_right _ (List.mem_flatMap.mpr ⟨c, hc, List.mem_append_right _ hz⟩))))
          («согласны-под» bs hk (fun y hy hcy => by
            simp only [«свободные»]
            exact List.mem_append_right _ (List.mem_flatMap.mpr ⟨c, hc, «вне-фильтр» hy hcy⟩)) h))
    | «свёртка» l m a x b =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub l (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy]))
        (fun lv => «не позже-связать» (sub m (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun mv => ?_))
      cases lv with
      | «список» xs =>
        exact «свернуть-сравн» a x b _ (fun acc w => ih _ _ ((a, acc) :: (x, w) :: ρ) ((a, acc) :: (x, w) :: ρ') b
          («доводы-убрать» [a, x] hd)
          («не задеты-под» [(a, acc), (x, w)] [a, x] rfl (by simp [«связанныеВ»]) hn hb)
          («без захвата-убрать» [a, x] («без захвата-часть» hb (by intro y hy; simp [«связанныеВ», hy])))
          («согласны-связать2» a x acc w b (fun y hy hc => by
            simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)) xs mv
      | _ => exact «не позже-сам» _
    | «отобразить» l x b =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub l (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun lv => ?_)
      cases lv with
      | «список» xs =>
        exact «не позже-связать» («образы-сравн» x b _ (fun w => ih _ _ ((x, w) :: ρ) ((x, w) :: ρ') b
          («доводы-убрать» [x] hd)
          («не задеты-под» [(x, w)] [x] rfl (by simp [«связанныеВ»]) hn hb)
          («без захвата-убрать» [x] («без захвата-часть» hb (by intro y hy; simp [«связанныеВ», hy])))
          («согласны-связать» x w b (fun y hy hc => by
            simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)) xs) (fun _ => «не позже-сам» _)
      | _ => exact «не позже-сам» _
    | «отфильтровать» l x b =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub l (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun lv => ?_)
      cases lv with
      | «список» xs =>
        exact «не позже-связать» («отбор-сравн» x b _ (fun w => ih _ _ ((x, w) :: ρ) ((x, w) :: ρ') b
          («доводы-убрать» [x] hd)
          («не задеты-под» [(x, w)] [x] rfl (by simp [«связанныеВ»]) hn hb)
          («без захвата-убрать» [x] («без захвата-часть» hb (by intro y hy; simp [«связанныеВ», hy])))
          («согласны-связать» x w b (fun y hy hc => by
            simp only [«свободные»]; exact List.mem_append_right _ («вне-фильтр» hy hc)) h)) xs) (fun _ => «не позже-сам» _)
      | _ => exact «не позже-сам» _
    | «список» es =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» («вычВсе-сравн» es (fun a ha => sub a
        (fun y hy => by simp only [«свободные»]; exact «в-плоском» ha hy)
        (fun y hy => by simp only [«связанныеВ»]; exact List.mem_flatMap.mpr ⟨a, ha, hy⟩))) (fun _ => «не позже-сам» _)
    | «запись» fs =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» («вычПоля-сравн» fs (fun q hq => sub q.2
        (fun y hy => by simp only [«свободные»]; exact «в-полях» hq hy)
        (fun y hy => by simp only [«связанныеВ»]; exact List.mem_flatMap.mpr ⟨q, hq, hy⟩))) (fun _ => «не позже-сам» _)
    | «конструктор» k fs =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» («вычПоля-сравн» fs (fun q hq => sub q.2
        (fun y hy => by simp only [«свободные»]; exact «в-полях» hq hy)
        (fun y hy => by simp only [«связанныеВ»]; exact List.mem_flatMap.mpr ⟨q, hq, hy⟩))) (fun _ => «не позже-сам» _)
    | «поле» t q =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» (sub t (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy])) (fun _ => «не позже-сам» _)
    | «форма» nm args =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» («вычВсе-сравн» args (fun a ha => sub a
        (fun y hy => by simp only [«свободные»]; exact «в-плоском» ha hy)
        (fun y hy => by simp only [«связанныеВ»]; exact List.mem_flatMap.mpr ⟨a, ha, hy⟩))) (fun _ => «не позже-сам» _)
    | «ссылка» f fs =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      exact «не позже-связать» («вычПоля-сравн» fs (fun q hq => sub q.2
        (fun y hy => by simp only [«свободные»]; exact «в-полях» hq hy)
        (fun y hy => by simp only [«связанныеВ»]; exact List.mem_flatMap.mpr ⟨q, hq, hy⟩))) (fun _ => «не позже-сам» _)
    | «применить» fe args =>
      rw [hf]; simp only [«подстВыр», «выч», «шаг»]
      refine «не позже-связать» (sub fe (by intro y hy; simp [«свободные», hy]) (by intro y hy; simp [«связанныеВ», hy]))
        (fun fv => «не позже-связать» («вычВсе-сравн» args (fun a ha => sub a
          (fun y hy => by simp only [«свободные»]; exact List.mem_append_right _ («в-плоском» ha hy))
          (fun y hy => by simp only [«связанныеВ»]; exact List.mem_append_right _ (List.mem_flatMap.mpr ⟨a, ha, hy⟩))))
          (fun vs => ?_))
      cases fv with
      | «вариант» f cap =>
        dsimp only
        cases «функцияТега» P f with
        | none => exact «не позже-сам» _
        | some g =>
          by_cases hl : («свободныеПараметры» g cap).length = vs.length
          · simp only [hl, ↓reduceIte]; exact «тело-раньше» («топливо-запас» P n m0) g _
          · simp only [hl, ↓reduceIte]; exact «не позже-сам» _
      | _ => exact «не позже-сам» _

theorem «пост-сохраняет» (r : «Вычислитель») (ρ : «Среда») (w : «Зн») :
    ∀ (qs : List «Постусловие») (u : «Зн»), «проверитьПост» r ρ w qs = .ok u → u = w
  | [], u, h => by simp [«проверитьПост»] at h; exact h.symm
  | q :: t, u, h => by
    simp only [«проверитьПост»] at h
    cases hc : r ((q.«связка», w) :: ρ) q.«выражение» with
    | error e => rw [hc] at h; cases h
    | ok c =>
      rw [hc] at h
      simp only [bind, Except.bind] at h
      cases c with
      | «признак» b => cases b with
        | true => exact «пост-сохраняет» r ρ w t u h
        | false => cases h
      | _ => cases h

theorem «найти-пары» {α β : Type} (y : String) : ∀ (ps : List String) (xs : List α) (ys : List β),
    xs.length = ys.length → ((«найти» y (ps.zip xs)).isSome ↔ («найти» y (ps.zip ys)).isSome)
  | [], _, _, _ => by simp [«найти»]
  | p :: ps, [], [], _ => by simp [«найти»]
  | p :: ps, [], _ :: _, h => by simp at h
  | p :: ps, _ :: _, [], h => by simp at h
  | p :: ps, x :: xs, z :: zs, h => by
    simp only [List.zip_cons_cons, «найти»]
    split
    · simp
    · exact «найти-пары» y ps xs zs (by simpa using h)

theorem «найти-в-паре» {α : Type} {y : String} : ∀ {ps : List String} {xs : List α} {a : α},
    «найти» y (ps.zip xs) = some a → a ∈ xs
  | [], _, _, h => by simp [«найти»] at h
  | p :: ps, [], _, h => by simp [«найти»] at h
  | p :: ps, x :: xs, a, h => by
    simp only [List.zip_cons_cons, «найти»] at h
    split at h
    · cases h; exact List.mem_cons_self
    · exact List.mem_cons_of_mem _ («найти-в-паре» h)

theorem «доводы-из-вычисленных» (P : «Программа») (N : Nat) (ρ0 : «Среда») :
    ∀ (ps : List String) (args : List «Выр») (vs : List «Зн»),
      «вычВсе» («выч» P N) ρ0 args = .ok vs →
      «Доводы верны» P N ρ0 (ps.zip args) (ps.zip vs)
  | [], args, vs, _ => ⟨fun y a h => by simp [«найти»] at h, fun y _ => rfl⟩
  | p :: ps, [], vs, h => by
    simp [«вычВсе»] at h; subst h
    exact ⟨fun y a h => by simp [«найти»] at h, fun y _ => rfl⟩
  | p :: ps, a :: as, vs, h => by
    simp only [«вычВсе»] at h
    cases ha : «выч» P N ρ0 a with
    | error e => rw [ha] at h; cases h
    | ok u =>
      rw [ha] at h
      cases hr : «вычВсе» («выч» P N) ρ0 as with
      | error e => rw [hr] at h; simp [bind, Except.bind] at h
      | ok us =>
        rw [hr] at h
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at h
        subst h
        have ih := «доводы-из-вычисленных» P N ρ0 ps as us hr
        refine ⟨fun y b hb => ?_, fun y hn => ?_⟩
        · simp only [List.zip_cons_cons, «найти»] at hb ⊢
          split at hb
          · cases hb
            refine ⟨u, by simp [*], fun ρ k hρ => ?_⟩
            have e1 := «окружение-неважно» P N ρ0 ρ a (fun z hz => hρ z hz)
            exact «топливо-моно» P (by omega) ρ a (e1 ▸ ha) (by simp)
          · rename_i hne
            simp only [hne, ite_false]
            exact ih.1 y b hb
        · simp only [List.zip_cons_cons, «найти»] at hn ⊢
          split at hn
          · cases hn
          · rename_i hne
            simp only [hne, ite_false]
            exact ih.2 y hn

theorem «вычВсе-длина» {r : «Вычислитель»} {ρ : «Среда»} : ∀ (es : List «Выр») (vs : List «Зн»),
    «вычВсе» r ρ es = .ok vs → es.length = vs.length
  | [], vs, h => by simp [«вычВсе»] at h; subst h; rfl
  | e :: t, vs, h => by
    simp only [«вычВсе»] at h
    cases ha : r ρ e with
    | error q => rw [ha] at h; cases h
    | ok u =>
      rw [ha] at h
      cases hr : «вычВсе» r ρ t with
      | error q => rw [hr] at h; simp [bind, Except.bind] at h
      | ok us =>
        rw [hr] at h
        simp only [bind, Except.bind, pure, Except.pure, Except.ok.injEq] at h
        subst h
        simp [«вычВсе-длина» t us hr]

theorem «развёртка-доводами» (P : «Программа») (N : Nat) (ρ0 : «Среда») (f : String) (args : List «Выр»)
    (g : «Функция») (v : «Зн»)
    (hg : «функцияПрограммы» P f = some g)
    (hfv : ∀ y ∈ «свободные» g.«тело», y ∈ g.«параметры»)
    (hcap : ∀ a ∈ args, ∀ z ∈ «свободные» a, z ∉ «связанныеВ» g.«тело»)
    (hv : «выч» P (N + 1) ρ0 (.«вызов» f args) = .ok v) :
    «выч» P (N + N) ρ0 («подстВыр» (g.«параметры».zip args) g.«тело») = .ok v := by
  simp only [«выч», «шаг»] at hv
  cases hvs : «вычВсе» («выч» P N) ρ0 args with
  | error q => rw [hvs] at hv; cases hv
  | ok vs =>
    rw [hvs] at hv
    simp only [bind, Except.bind, hg] at hv
    by_cases hl : g.«параметры».length = vs.length
    · simp only [hl, ↓reduceIte, «вызватьТело»] at hv
      cases hb : «выч» P N («привязать» g.«параметры» vs) g.«тело» with
      | error q => rw [hb] at hv; cases hv
      | ok w =>
        rw [hb] at hv
        simp only [bind, Except.bind] at hv
        have hw := «пост-сохраняет» _ _ w _ v hv
        subst hw
        have hd := «доводы-из-вычисленных» P N ρ0 g.«параметры» args vs hvs
        have hlen := «вычВсе-длина» args vs hvs
        have key := «подстВыр-верна» P N ρ0 N (g.«параметры».zip args) (g.«параметры».zip vs) ρ0
          (g.«параметры».zip vs) g.«тело» hd (fun y a _ z _ => rfl)
          (fun y a ha z hz => hcap a («найти-в-паре» ha) z hz)
          (fun y hy => by
            have hk : y ∈ (g.«параметры».zip vs).map (·.1) := by
              rw [List.map_fst_zip (by omega)]; exact hfv y hy
            obtain ⟨u, hu⟩ := Option.isSome_iff_exists.mp («найти-есть» y _ hk)
            rw [hu]; rfl)
        unfold «привязать» at hb
        rw [hb] at key
        rcases key with key | key
        · cases key
        · exact key.symm
    · simp only [hl, ↓reduceIte] at hv; cases hv

def «число?» : «Исход» → Option «Д64»
  | .ok (.«число» d) => some d
  | _ => none

theorem «число?-верно» {r : «Исход»} {d : «Д64»} (h : «число?» r = some d) : r = .ok (.«число» d) := by
  unfold «число?» at h
  split at h <;> simp_all

def «пять» : «Зн» := .«число» («изЦелого» 5)

def «семь» : «Зн» := .«число» («изЦелого» 7)

def «Пять и тот же» : «Программа» :=
  [⟨"Тот же", ["н"], .«имя» "н", []⟩, ⟨"Пять", ["н"], .«вызов» "Тот же" [.«лит» «пять»], []⟩]

theorem «развёртка-без-подстановки-ложна» :
    «выч» «Пять и тот же» 4 [("н", «семь»)] (.«вызов» "Пять" [.«имя» "н"]) = .ok «пять» ∧
    «выч» «Пять и тот же» 4 [("н", «семь»)] (.«имя» "н") = .ok «семь» ∧ «пять» ≠ «семь» ∧
    «подстВыр» [("н", .«лит» «пять»)] (.«имя» "н") = .«лит» «пять» := by
  refine ⟨«число?-верно» (by decide +kernel), «число?-верно» (by decide +kernel), fun h => ?_, ?_⟩
  · have : «изЦелого» 5 = «изЦелого» 7 := «Зн».«число».inj h
    exact absurd this (by decide +kernel)
  · simp [«подстВыр», «найти»]

def «один» : «Зн» := .«число» («изЦелого» 1)

def «Сдвиг» : «Программа» :=
  [⟨"Сдвиг", ["н"], .«пусть» "м" (.«лит» «один») (.«двучлен» "add" (.«имя» "н") (.«имя» "м")), []⟩]

theorem «развёртка-с-захватом-ложна» :
    «выч» «Сдвиг» 6 [("м", «семь»)] (.«вызов» "Сдвиг" [.«имя» "м"]) = .ok (.«число» («изЦелого» 8)) ∧
    «выч» «Сдвиг» 6 [("м", «семь»)]
      («подстВыр» [("н", .«имя» "м")] (.«пусть» "м" (.«лит» «один») (.«двучлен» "add" (.«имя» "н") (.«имя» "м")))) =
      .ok (.«число» («изЦелого» 2)) ∧
    "м" ∈ «связанныеВ» (.«пусть» "м" (.«лит» «один») (.«двучлен» "add" (.«имя» "н") (.«имя» "м"))) := by
  refine ⟨«число?-верно» (by decide +kernel), ?_, by simp [«связанныеВ»]⟩
  have : «подстВыр» [("н", .«имя» "м")] (.«пусть» "м" (.«лит» «один») (.«двучлен» "add" (.«имя» "н") (.«имя» "м"))) =
      .«пусть» "м" (.«лит» «один») (.«двучлен» "add" (.«имя» "м") (.«имя» "м")) := by
    simp [«подстВыр», «найти», «убрать», «вне?»]
  rw [this]
  exact «число?-верно» (by decide +kernel)

end «Эталон»
