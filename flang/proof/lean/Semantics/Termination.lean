import Semantics.Fuel

set_option linter.unusedVariables false

namespace «Эталон»

theorem «беда-жива» {α : Type} (k : String) : («беда» k : Except «Сбой» α) ≠ .error .«топливо» := by
  simp [«беда»]

theorem «вне-живо» {α : Type} (k : String) : («вне» k : Except «Сбой» α) ≠ .error .«топливо» := by
  simp [«вне»]

theorem «связать-живо» {α β : Type} {x : Except «Сбой» α} {f : α → Except «Сбой» β}
    (hx : x ≠ .error .«топливо») (hf : ∀ a, f a ≠ .error .«топливо») : (x >>= f) ≠ .error .«топливо» := by
  cases x with
  | error e => exact fun h => hx (by injection h with h; rw [h])
  | ok a => exact hf a

theorem «точныйСчёт-жив» (op : String) (a b : Nat) : «точныйСчёт» op a b ≠ .error .«топливо» := by
  unfold «точныйСчёт»
  repeat' split
  all_goals simp [«беда»]

theorem «двучлен-жив» (op : String) (a b : «Зн») : «двучлен» op a b ≠ .error .«топливо» := by
  unfold «двучлен»
  repeat' split
  all_goals first
    | exact «точныйСчёт-жив» _ _ _
    | simp [«беда», «вне»]

theorem «кЧислу-живо» (s : String) : «кЧислу» s ≠ .error .«топливо» := by
  unfold «кЧислу»
  simp only
  repeat' split
  all_goals simp [«беда»]

theorem «форма-жива» (n : String) (vs : List «Зн») : «форма» n vs ≠ .error .«топливо» := by
  unfold «форма»
  split
  · exact «беда-жива» _
  · split
    all_goals first
      | with_reducible exact «кЧислу-живо» _
      | with_reducible exact «беда-жива» _
      | with_reducible exact «вне-живо» _
      | (intro h; with_reducible cases h)
      | (repeat' split
         all_goals first
           | with_reducible exact «беда-жива» _
           | (intro h; with_reducible cases h))

theorem «связки-живы» (fs : List (String × «Зн»)) :
    ∀ bs, «связки» fs bs ≠ .error .«топливо»
  | [] => by simp [«связки»]
  | (k, x) :: r => by
    unfold «связки»
    split
    · exact «связать-живо» («связки-живы» fs r) (fun w => by simp [pure, Except.pure])
    · exact «беда-жива» _

theorem «подходит-живо» (p : «Образец») (v : «Зн») : «подходит» p v ≠ .error .«топливо» := by
  unfold «подходит»
  repeat' split
  all_goals first
    | exact «связать-живо» («связки-живы» _ _) (fun w => by simp [pure, Except.pure])
    | simp

def «Жив» (r : «Вычислитель») (e : «Выр») : Prop := ∀ ρ, r ρ e ≠ .error .«топливо»

theorem «вычВсе-живо» {r : «Вычислитель»} (ρ : «Среда») :
    ∀ es, (∀ e ∈ es, «Жив» r e) → «вычВсе» r ρ es ≠ .error .«топливо»
  | [], _ => by simp [«вычВсе»]
  | e :: t, h => by
    unfold «вычВсе»
    exact «связать-живо» (h e (List.mem_cons_self) ρ) (fun v =>
      «связать-живо» («вычВсе-живо» ρ t (fun x hx => h x (List.mem_cons_of_mem _ hx)))
        (fun w => by simp [pure, Except.pure]))

theorem «вычПоля-живо» {r : «Вычислитель»} (ρ : «Среда») :
    ∀ fs, (∀ p ∈ fs, «Жив» r p.2) → «вычПоля» r ρ fs ≠ .error .«топливо»
  | [], _ => by simp [«вычПоля»]
  | (k, e) :: t, h => by
    unfold «вычПоля»
    exact «связать-живо» (h (k, e) (List.mem_cons_self) ρ) (fun v =>
      «связать-живо» («вычПоля-живо» ρ t (fun x hx => h x (List.mem_cons_of_mem _ hx)))
        (fun w => by simp [pure, Except.pure]))

theorem «свернуть-живо» {r : «Вычислитель»} (ρ : «Среда») (a x : String) (s : «Выр») (hs : «Жив» r s) :
    ∀ l acc, «свернуть» r ρ a x s acc l ≠ .error .«топливо»
  | [], acc => by simp [«свернуть»]
  | v :: t, acc => by
    unfold «свернуть»
    exact «связать-живо» (hs _) (fun w => «свернуть-живо» ρ a x s hs t w)

theorem «образы-живы» {r : «Вычислитель»} (ρ : «Среда») (x : String) (s : «Выр») (hs : «Жив» r s) :
    ∀ l, «образы» r ρ x s l ≠ .error .«топливо»
  | [] => by simp [«образы»]
  | v :: t => by
    unfold «образы»
    exact «связать-живо» (hs _) (fun w =>
      «связать-живо» («образы-живы» ρ x s hs t) (fun ws => by simp [pure, Except.pure]))

theorem «отбор-жив» {r : «Вычислитель»} (ρ : «Среда») (x : String) (s : «Выр») (hs : «Жив» r s) :
    ∀ l, «отбор» r ρ x s l ≠ .error .«топливо»
  | [] => by simp [«отбор»]
  | v :: t => by
    unfold «отбор»
    refine «связать-живо» (hs _) (fun c => «связать-живо» («отбор-жив» ρ x s hs t) (fun ws => ?_))
    split <;> simp [pure, Except.pure, «беда»]

theorem «разобрать-живо» {r : «Вычислитель»} (ρ : «Среда») (v : «Зн») :
    ∀ cs, (∀ c ∈ cs, «Жив» r c.2) → «разобрать» r ρ v cs ≠ .error .«топливо»
  | [], _ => by simp [«разобрать», «беда»]
  | (p, b) :: t, h => by
    unfold «разобрать»
    have hp := «подходит-живо» p v
    split
    · rename_i e he
      rw [he] at hp
      exact fun h => hp (by injection h with h; rw [h])
    · exact h (p, b) (List.mem_cons_self) _
    · exact «разобрать-живо» ρ v t (fun c hc => h c (List.mem_cons_of_mem _ hc))

theorem «пост-жив» {r : «Вычислитель»} (ρ : «Среда») (v : «Зн») :
    ∀ qs : List «Постусловие», (∀ q ∈ qs, «Жив» r q.«выражение») → «проверитьПост» r ρ v qs ≠ .error .«топливо»
  | [], _ => by simp [«проверитьПост»]
  | q :: t, h => by
    unfold «проверитьПост»
    refine «связать-живо» (h q (List.mem_cons_self) _) (fun c => ?_)
    split
    · exact «пост-жив» ρ v t (fun x hx => h x (List.mem_cons_of_mem _ hx))
    · exact «беда-жива» _
    · exact «беда-жива» _

def «ЖивоТело» (r : «Вычислитель») (g : «Функция») : Prop :=
  «Жив» r g.«тело» ∧ ∀ q ∈ g.«постусловия», «Жив» r q.«выражение»

theorem «тело-живо» {r : «Вычислитель»} (g : «Функция») (h : «ЖивоТело» r g) (ρ : «Среда») :
    «вызватьТело» r g ρ ≠ .error .«топливо» := by
  unfold «вызватьТело»
  exact «связать-живо» (h.1 ρ) (fun v => «пост-жив» ρ v _ h.2)

mutual
def «годно» (ok : String → Bool) : «Выр» → Bool
  | .«лит» _ => true
  | .«имя» _ => true
  | .«двучлен» _ a b => «годно» ok a && «годно» ok b
  | .«если» c t e => «годно» ok c && («годно» ok t && «годно» ok e)
  | .«пусть» _ v b => «годно» ok v && «годно» ok b
  | .«вызов» f args => ok f && «годныВсе» ok args
  | .«разбор» t cs => «годно» ok t && «годныСлучаи» ok cs
  | .«свёртка» l n _ _ s => «годно» ok l && («годно» ok n && «годно» ok s)
  | .«отобразить» l _ s => «годно» ok l && «годно» ok s
  | .«отфильтровать» l _ s => «годно» ok l && «годно» ok s
  | .«список» es => «годныВсе» ok es
  | .«запись» fs => «годныПоля» ok fs
  | .«конструктор» _ fs => «годныПоля» ok fs
  | .«поле» t _ => «годно» ok t
  | .«форма» _ args => «годныВсе» ok args
  | .«ссылка» _ fs => «годныПоля» ok fs
  | .«применить» _ _ => false
def «годныВсе» (ok : String → Bool) : List «Выр» → Bool
  | [] => true
  | e :: r => «годно» ok e && «годныВсе» ok r
def «годныПоля» (ok : String → Bool) : List (String × «Выр») → Bool
  | [] => true
  | (_, e) :: r => «годно» ok e && «годныПоля» ok r
def «годныСлучаи» (ok : String → Bool) : List («Образец» × «Выр») → Bool
  | [] => true
  | (_, e) :: r => «годно» ok e && «годныСлучаи» ok r
end

theorem «годныВсе-член» (ok : String → Bool) :
    ∀ es, «годныВсе» ok es = true → ∀ e ∈ es, «годно» ok e = true
  | [], _, e, he => by cases he
  | x :: t, h, e, he => by
    simp only [«годныВсе», Bool.and_eq_true] at h
    rcases List.mem_cons.mp he with rfl | he
    · exact h.1
    · exact «годныВсе-член» ok t h.2 e he

theorem «годныПоля-член» (ok : String → Bool) :
    ∀ fs, «годныПоля» ok fs = true → ∀ p ∈ fs, «годно» ok p.2 = true
  | [], _, p, hp => by cases hp
  | (k, x) :: t, h, p, hp => by
    simp only [«годныПоля», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hp with rfl | hp
    · exact h.1
    · exact «годныПоля-член» ok t h.2 p hp

theorem «годныСлучаи-член» (ok : String → Bool) :
    ∀ cs, «годныСлучаи» ok cs = true → ∀ c ∈ cs, «годно» ok c.2 = true
  | [], _, c, hc => by cases hc
  | (k, x) :: t, h, c, hc => by
    simp only [«годныСлучаи», Bool.and_eq_true] at h
    rcases List.mem_cons.mp hc with rfl | hc
    · exact h.1
    · exact «годныСлучаи-член» ok t h.2 c hc

def «Доживает» (P : «Программа») (e : «Выр») : Prop := ∃ N, ∀ m, N ≤ m → «Жив» («выч» P m) e

theorem «доживают-по» (P : «Программа») {α : Type} (f : α → «Выр») :
    ∀ l : List α, (∀ a ∈ l, «Доживает» P (f a)) → ∃ N, ∀ m, N ≤ m → ∀ a ∈ l, «Жив» («выч» P m) (f a)
  | [], _ => ⟨0, fun m _ a ha => by cases ha⟩
  | x :: t, h => by
    obtain ⟨N1, h1⟩ := h x (List.mem_cons_self)
    obtain ⟨N2, h2⟩ := «доживают-по» P f t (fun a ha => h a (List.mem_cons_of_mem _ ha))
    refine ⟨max N1 N2, fun m hm a ha => ?_⟩
    rcases List.mem_cons.mp ha with rfl | ha
    · exact h1 m (by omega)
    · exact h2 m (by omega) a ha

theorem «шагом» (P : «Программа») {N : Nat} {e : «Выр»}
    (h : ∀ k, N ≤ k → ∀ ρ, «шаг» P («выч» P k) ρ e ≠ .error .«топливо») : «Доживает» P e := by
  refine ⟨N + 1, fun m hm ρ => ?_⟩
  obtain ⟨k, rfl⟩ : ∃ k, m = k + 1 := ⟨m - 1, by omega⟩
  exact h k (by omega) ρ

def «Тот» (P : «Программа») (ok : String → Bool) : Prop :=
  ∀ f g, ok f = true → «функцияПрограммы» P f = some g → ∃ N, ∀ m, N ≤ m → «ЖивоТело» («выч» P m) g

theorem «годно-доживает» (P : «Программа») (ok : String → Bool) (H : «Тот» P ok) :
    (e : «Выр») → «годно» ok e = true → «Доживает» P e
  | .«лит» v, _ => «шагом» P (N := 0) (fun k _ ρ => by simp [«шаг»])
  | .«имя» x, _ => «шагом» P (N := 0) (fun k _ ρ => by
      simp only [«шаг»]
      split
      · simp
      · exact «беда-жива» _)
  | .«двучлен» op a b, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Na, ha⟩ := «годно-доживает» P ok H a h.1
    obtain ⟨Nb, hb⟩ := «годно-доживает» P ok H b h.2
    exact «шагом» P (N := max Na Nb) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» (ha k (by omega) ρ) (fun x =>
        «связать-живо» (hb k (by omega) ρ) (fun y => «двучлен-жив» _ _ _)))
  | .«если» c t e, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Nc, hc⟩ := «годно-доживает» P ok H c h.1
    obtain ⟨Nt, ht⟩ := «годно-доживает» P ok H t h.2.1
    obtain ⟨Ne, he⟩ := «годно-доживает» P ok H e h.2.2
    exact «шагом» P (N := max Nc (max Nt Ne)) (fun k hk ρ => by
      simp only [«шаг»]
      refine «связать-живо» (hc k (by omega) ρ) (fun u => ?_)
      split
      · exact ht k (by omega) ρ
      · exact he k (by omega) ρ
      · exact «беда-жива» _)
  | .«пусть» x v b, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Nv, hv⟩ := «годно-доживает» P ok H v h.1
    obtain ⟨Nb, hb⟩ := «годно-доживает» P ok H b h.2
    exact «шагом» P (N := max Nv Nb) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» (hv k (by omega) ρ) (fun w => hb k (by omega) _))
  | .«вызов» f args, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Na, ha⟩ := «доживают-по» P id args (fun e he =>
      «годно-доживает» P ok H e («годныВсе-член» ok args h.2 e he))
    cases hg : «функцияПрограммы» P f with
    | none =>
      exact «шагом» P (N := Na) (fun k hk ρ => by
        simp only [«шаг»]
        refine «связать-живо» («вычВсе-живо» ρ args (ha k hk)) (fun vs => ?_)
        rw [hg]
        exact «вне-живо» _)
    | some g =>
      obtain ⟨Ng, hgN⟩ := H f g h.1 hg
      exact «шагом» P (N := max Na Ng) (fun k hk ρ => by
        simp only [«шаг»]
        refine «связать-живо» («вычВсе-живо» ρ args (ha k (by omega))) (fun vs => ?_)
        rw [hg]
        simp only
        split
        · exact «тело-живо» g (hgN k (by omega)) _
        · exact «беда-жива» _)
  | .«разбор» t cs, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Nt, ht⟩ := «годно-доживает» P ok H t h.1
    obtain ⟨Nc, hc⟩ := «доживают-по» P (fun c : «Образец» × «Выр» => c.2) cs (fun c hc' =>
      «годно-доживает» P ok H c.2 («годныСлучаи-член» ok cs h.2 c hc'))
    exact «шагом» P (N := max Nt Nc) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» (ht k (by omega) ρ) (fun v => «разобрать-живо» ρ v cs (hc k (by omega))))
  | .«свёртка» l n a x s, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Nl, hl⟩ := «годно-доживает» P ok H l h.1
    obtain ⟨Nn, hn⟩ := «годно-доживает» P ok H n h.2.1
    obtain ⟨Ns, hs⟩ := «годно-доживает» P ok H s h.2.2
    exact «шагом» P (N := max Nl (max Nn Ns)) (fun k hk ρ => by
      simp only [«шаг»]
      refine «связать-живо» (hl k (by omega) ρ) (fun lv => «связать-живо» (hn k (by omega) ρ) (fun nv => ?_))
      split
      · exact «свернуть-живо» ρ a x s (hs k (by omega)) _ _
      · exact «беда-жива» _)
  | .«отобразить» l x s, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Nl, hl⟩ := «годно-доживает» P ok H l h.1
    obtain ⟨Ns, hs⟩ := «годно-доживает» P ok H s h.2
    exact «шагом» P (N := max Nl Ns) (fun k hk ρ => by
      simp only [«шаг»]
      refine «связать-живо» (hl k (by omega) ρ) (fun lv => ?_)
      split
      · exact «связать-живо» («образы-живы» ρ x s (hs k (by omega)) _) (fun ws => by simp [pure, Except.pure])
      · exact «беда-жива» _)
  | .«отфильтровать» l x s, h => by
    simp only [«годно», Bool.and_eq_true] at h
    obtain ⟨Nl, hl⟩ := «годно-доживает» P ok H l h.1
    obtain ⟨Ns, hs⟩ := «годно-доживает» P ok H s h.2
    exact «шагом» P (N := max Nl Ns) (fun k hk ρ => by
      simp only [«шаг»]
      refine «связать-живо» (hl k (by omega) ρ) (fun lv => ?_)
      split
      · exact «связать-живо» («отбор-жив» ρ x s (hs k (by omega)) _) (fun ws => by simp [pure, Except.pure])
      · exact «беда-жива» _)
  | .«список» es, h => by
    simp only [«годно»] at h
    obtain ⟨Na, ha⟩ := «доживают-по» P id es (fun e he =>
      «годно-доживает» P ok H e («годныВсе-член» ok es h e he))
    exact «шагом» P (N := Na) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» («вычВсе-живо» ρ es (ha k hk)) (fun vs => by simp [pure, Except.pure]))
  | .«запись» fs, h => by
    simp only [«годно»] at h
    obtain ⟨Na, ha⟩ := «доживают-по» P (fun p : String × «Выр» => p.2) fs (fun p hp =>
      «годно-доживает» P ok H p.2 («годныПоля-член» ok fs h p hp))
    exact «шагом» P (N := Na) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» («вычПоля-живо» ρ fs (ha k hk)) (fun vs => by simp [pure, Except.pure]))
  | .«конструктор» c fs, h => by
    simp only [«годно»] at h
    obtain ⟨Na, ha⟩ := «доживают-по» P (fun p : String × «Выр» => p.2) fs (fun p hp =>
      «годно-доживает» P ok H p.2 («годныПоля-член» ok fs h p hp))
    exact «шагом» P (N := Na) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» («вычПоля-живо» ρ fs (ha k hk)) (fun vs => by simp [pure, Except.pure]))
  | .«поле» t p, h => by
    simp only [«годно»] at h
    obtain ⟨Nt, ht⟩ := «годно-доживает» P ok H t h
    exact «шагом» P (N := Nt) (fun k hk ρ => by
      simp only [«шаг»]
      refine «связать-живо» (ht k hk ρ) (fun v => ?_)
      repeat' split
      all_goals first
        | exact «беда-жива» _
        | simp [pure, Except.pure])
  | .«форма» n args, h => by
    simp only [«годно»] at h
    obtain ⟨Na, ha⟩ := «доживают-по» P id args (fun e he =>
      «годно-доживает» P ok H e («годныВсе-член» ok args h e he))
    exact «шагом» P (N := Na) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» («вычВсе-живо» ρ args (ha k hk)) (fun vs => «форма-жива» _ _))
  | .«ссылка» f fs, h => by
    simp only [«годно»] at h
    obtain ⟨Na, ha⟩ := «доживают-по» P (fun p : String × «Выр» => p.2) fs (fun p hp =>
      «годно-доживает» P ok H p.2 («годныПоля-член» ok fs h p hp))
    exact «шагом» P (N := Na) (fun k hk ρ => by
      simp only [«шаг»]
      exact «связать-живо» («вычПоля-живо» ρ fs (ha k hk)) (fun vs => by simp [pure, Except.pure]))
  | .«применить» fe args, h => by simp [«годно»] at h
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

def «годнаФункция» (ok : String → Bool) (g : «Функция») : Bool :=
  «годно» ok g.«тело» && g.«постусловия».all (fun q => «годно» ok q.«выражение»)

def «ниже» (P : «Программа») (S : List String) (c : String) : Bool :=
  decide (c ∈ S) || («функцияПрограммы» P c).isNone

def «круг» (P : «Программа») (S : List String) : List String :=
  S ++ (P.filter (fun g =>
    match «функцияПрограммы» P g.«имя» with
    | some g0 => «годнаФункция» («ниже» P S) g0
    | none => false)).map (·.«имя»)

def «конечные» (P : «Программа») : Nat → List String
  | 0 => []
  | k + 1 => «круг» P («конечные» P k)

theorem «конечные-тот» (P : «Программа») : ∀ k, «Тот» P («ниже» P («конечные» P k))
  | 0 => fun f g h hg => by simp [«ниже», «конечные», hg] at h
  | k + 1 => fun f g h hg => by
    have ih := «конечные-тот» P k
    have h' : f ∈ «круг» P («конечные» P k) := by
      have h2 : «ниже» P («круг» P («конечные» P k)) f = true := h
      simpa [«ниже», hg] using h2
    simp only [«круг», List.mem_append, List.mem_map, List.mem_filter] at h'
    rcases h' with h | ⟨g', ⟨_, hok⟩, hname⟩
    · exact ih f g (by simp [«ниже», h]) hg
    · rw [hname, hg] at hok
      simp only [«годнаФункция», Bool.and_eq_true, List.all_eq_true] at hok
      obtain ⟨Nb, hb⟩ := «годно-доживает» P _ ih g.«тело» hok.1
      obtain ⟨Nq, hq⟩ := «доживают-по» P (fun q : «Постусловие» => q.«выражение») g.«постусловия» (fun q hq' =>
        «годно-доживает» P _ ih _ (hok.2 q hq'))
      exact ⟨max Nb Nq, fun m hm => ⟨hb m (by omega), fun q hq' => hq m (by omega) q hq'⟩⟩

mutual
def «узлы» : «Выр» → List «Выр»
  | .«лит» v => [.«лит» v]
  | .«имя» x => [.«имя» x]
  | .«двучлен» op a b => .«двучлен» op a b :: («узлы» a ++ «узлы» b)
  | .«если» c t e => .«если» c t e :: («узлы» c ++ («узлы» t ++ «узлы» e))
  | .«пусть» x v b => .«пусть» x v b :: («узлы» v ++ «узлы» b)
  | .«вызов» f args => .«вызов» f args :: «узлыВсех» args
  | .«разбор» t cs => .«разбор» t cs :: («узлы» t ++ «узлыСлучаев» cs)
  | .«свёртка» l n a x s => .«свёртка» l n a x s :: («узлы» l ++ («узлы» n ++ «узлы» s))
  | .«отобразить» l x s => .«отобразить» l x s :: («узлы» l ++ «узлы» s)
  | .«отфильтровать» l x s => .«отфильтровать» l x s :: («узлы» l ++ «узлы» s)
  | .«список» es => .«список» es :: «узлыВсех» es
  | .«запись» fs => .«запись» fs :: «узлыПолей» fs
  | .«конструктор» k fs => .«конструктор» k fs :: «узлыПолей» fs
  | .«поле» t p => .«поле» t p :: «узлы» t
  | .«форма» n args => .«форма» n args :: «узлыВсех» args
  | .«ссылка» f fs => .«ссылка» f fs :: «узлыПолей» fs
  | .«применить» fe args => .«применить» fe args :: («узлы» fe ++ «узлыВсех» args)
def «узлыВсех» : List «Выр» → List «Выр»
  | [] => []
  | e :: r => «узлы» e ++ «узлыВсех» r
def «узлыПолей» : List (String × «Выр») → List «Выр»
  | [] => []
  | (_, e) :: r => «узлы» e ++ «узлыПолей» r
def «узлыСлучаев» : List («Образец» × «Выр») → List «Выр»
  | [] => []
  | (_, e) :: r => «узлы» e ++ «узлыСлучаев» r
end

def «узлыФункции» (g : «Функция») : List «Выр» :=
  «узлы» g.«тело» ++ g.«постусловия».flatMap (fun q => «узлы» q.«выражение»)

def «зовыУзлов» (es : List «Выр») : List String :=
  es.filterMap (fun e =>
    match e with
    | .«вызов» f _ => some f
    | _ => none)

def «зовыФункции» (g : «Функция») : List String := «зовыУзлов» («узлыФункции» g)

def «зовыТела» (g : «Функция») : List String := «зовыУзлов» («узлы» g.«тело»)

def «принятьКомпозицию» (P : «Программа») (f : String) («названы» : List String) : Bool :=
  match «функцияПрограммы» P f with
  | none => false
  | some g =>
    decide (f ∈ «конечные» P (P.length + 1)) &&
      ((«зовыТела» g).all (fun c => decide (c ∈ «названы»)) &&
        «названы».all (fun c => decide (c ∈ «зовыТела» g)))

theorem «композиция-завершается» (P : «Программа») (f : String) («названы» : List String)
    (h : «принятьКомпозицию» P f «названы» = true) :
    ∃ g, «функцияПрограммы» P f = some g ∧
      (∀ c, c ∈ «названы» ↔ c ∈ «зовыТела» g) ∧
      ∃ N, ∀ ρ, ∃ r, r ≠ .error .«топливо» ∧ ∀ m, N ≤ m → «вызватьТело» («выч» P m) g ρ = r := by
  unfold «принятьКомпозицию» at h
  cases hg : «функцияПрограммы» P f with
  | none => simp [hg] at h
  | some g =>
  simp only [hg, Bool.and_eq_true, decide_eq_true_eq, List.all_eq_true] at h
  obtain ⟨hfin, hbody, hnamed⟩ := h
  refine ⟨g, rfl, fun c => ⟨hnamed c, hbody c⟩, ?_⟩
  obtain ⟨N, hN⟩ := «конечные-тот» P (P.length + 1) f g (by simp [«ниже», hfin]) hg
  refine ⟨N, fun ρ => ⟨«вызватьТело» («выч» P N) g ρ, «тело-живо» g (hN N (Nat.le_refl N)) ρ, fun m hm => ?_⟩⟩
  obtain ⟨j, rfl⟩ := Nat.exists_eq_add_of_le hm
  rcases «тело-раньше» («топливо-запас» P N j) g ρ with q | q
  · exact absurd q («тело-живо» g (hN N (Nat.le_refl N)) ρ)
  · exact q.symm

end «Эталон»
