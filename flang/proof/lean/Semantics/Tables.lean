import Semantics.Fuel

set_option linter.unusedVariables false

namespace «Эталон»

mutual
def «постоянное» : «Выр» → Option «Зн»
  | .«лит» v => some v
  | .«список» es => («постоянныеВсе» es).map .«список»
  | .«запись» fs => («постоянныеПоля» fs).map .«запись»
  | .«конструктор» k fs => («постоянныеПоля» fs).map (.«вариант» k)
  | .«имя» _ => none
  | .«двучлен» _ _ _ => none
  | .«если» _ _ _ => none
  | .«пусть» _ _ _ => none
  | .«вызов» _ _ => none
  | .«разбор» _ _ => none
  | .«свёртка» _ _ _ _ _ => none
  | .«отобразить» _ _ _ => none
  | .«отфильтровать» _ _ _ => none
  | .«поле» _ _ => none
  | .«форма» _ _ => none
  | .«ссылка» _ _ => none
  | .«применить» _ _ => none
def «постоянныеВсе» : List «Выр» → Option (List «Зн»)
  | [] => some []
  | e :: r =>
    match «постоянное» e, «постоянныеВсе» r with
    | some v, some vs => some (v :: vs)
    | _, _ => none
def «постоянныеПоля» : List (String × «Выр») → Option (List (String × «Зн»))
  | [] => some []
  | (k, e) :: r =>
    match «постоянное» e, «постоянныеПоля» r with
    | some v, some vs => some ((k, v) :: vs)
    | _, _ => none
end

def «Стоит» (P : «Программа») (e : «Выр») (v : «Зн») : Prop :=
  ∃ N, ∀ m, N ≤ m → ∀ ρ, «выч» P m ρ e = .ok v

theorem «стоят-все» (P : «Программа») :
    ∀ es vs, «постоянныеВсе» es = some vs →
      (∀ e ∈ es, ∀ v, «постоянное» e = some v → «Стоит» P e v) →
      ∃ N, ∀ m, N ≤ m → ∀ ρ, «вычВсе» («выч» P m) ρ es = .ok vs
  | [], vs, h, _ => by
    simp only [«постоянныеВсе», Option.some.injEq] at h
    subst h
    exact ⟨0, fun m _ ρ => rfl⟩
  | e :: t, vs, h, ih => by
    unfold «постоянныеВсе» at h
    split at h
    · rename_i v ws hv hws
      simp only [Option.some.injEq] at h
      subst h
      obtain ⟨N1, h1⟩ := ih e (List.mem_cons_self) v hv
      obtain ⟨N2, h2⟩ := «стоят-все» P t ws hws (fun x hx => ih x (List.mem_cons_of_mem _ hx))
      refine ⟨max N1 N2, fun m hm ρ => ?_⟩
      simp only [«вычВсе», h1 m (by omega) ρ, h2 m (by omega) ρ]
      rfl
    · cases h

theorem «стоят-поля» (P : «Программа») :
    ∀ fs vs, «постоянныеПоля» fs = some vs →
      (∀ p ∈ fs, ∀ v, «постоянное» p.2 = some v → «Стоит» P p.2 v) →
      ∃ N, ∀ m, N ≤ m → ∀ ρ, «вычПоля» («выч» P m) ρ fs = .ok vs
  | [], vs, h, _ => by
    simp only [«постоянныеПоля», Option.some.injEq] at h
    subst h
    exact ⟨0, fun m _ ρ => rfl⟩
  | (k, e) :: t, vs, h, ih => by
    unfold «постоянныеПоля» at h
    split at h
    · rename_i v ws hv hws
      simp only [Option.some.injEq] at h
      subst h
      obtain ⟨N1, h1⟩ := ih (k, e) (List.mem_cons_self) v hv
      obtain ⟨N2, h2⟩ := «стоят-поля» P t ws hws (fun x hx => ih x (List.mem_cons_of_mem _ hx))
      refine ⟨max N1 N2, fun m hm ρ => ?_⟩
      simp only [«вычПоля», h1 m (by omega) ρ, h2 m (by omega) ρ]
      rfl
    · cases h

theorem «шагом-стоит» (P : «Программа») {N : Nat} {e : «Выр»} {v : «Зн»}
    (h : ∀ k, N ≤ k → ∀ ρ, «шаг» P («выч» P k) ρ e = .ok v) : «Стоит» P e v := by
  refine ⟨N + 1, fun m hm ρ => ?_⟩
  obtain ⟨k, rfl⟩ : ∃ k, m = k + 1 := ⟨m - 1, by omega⟩
  exact h k (by omega) ρ

theorem «постоянное-стоит» (P : «Программа») : (e : «Выр») → (v : «Зн») → «постоянное» e = some v → «Стоит» P e v
  | .«лит» w, v, h => by
    simp only [«постоянное», Option.some.injEq] at h
    subst h
    exact «шагом-стоит» P (N := 0) (fun k _ ρ => rfl)
  | .«список» es, v, h => by
    simp only [«постоянное», Option.map_eq_some_iff] at h
    obtain ⟨vs, hvs, rfl⟩ := h
    obtain ⟨N, hN⟩ := «стоят-все» P es vs hvs (fun e he w hw => «постоянное-стоит» P e w hw)
    exact «шагом-стоит» P (N := N) (fun k hk ρ => by simp only [«шаг», hN k hk ρ]; rfl)
  | .«запись» fs, v, h => by
    simp only [«постоянное», Option.map_eq_some_iff] at h
    obtain ⟨vs, hvs, rfl⟩ := h
    obtain ⟨N, hN⟩ := «стоят-поля» P fs vs hvs (fun p hp w hw => «постоянное-стоит» P p.2 w hw)
    exact «шагом-стоит» P (N := N) (fun k hk ρ => by simp only [«шаг», hN k hk ρ]; rfl)
  | .«конструктор» c fs, v, h => by
    simp only [«постоянное», Option.map_eq_some_iff] at h
    obtain ⟨vs, hvs, rfl⟩ := h
    obtain ⟨N, hN⟩ := «стоят-поля» P fs vs hvs (fun p hp w hw => «постоянное-стоит» P p.2 w hw)
    exact «шагом-стоит» P (N := N) (fun k hk ρ => by simp only [«шаг», hN k hk ρ]; rfl)
  | .«имя» _, _, h => by simp [«постоянное»] at h
  | .«двучлен» _ _ _, _, h => by simp [«постоянное»] at h
  | .«если» _ _ _, _, h => by simp [«постоянное»] at h
  | .«пусть» _ _ _, _, h => by simp [«постоянное»] at h
  | .«вызов» _ _, _, h => by simp [«постоянное»] at h
  | .«разбор» _ _, _, h => by simp [«постоянное»] at h
  | .«свёртка» _ _ _ _ _, _, h => by simp [«постоянное»] at h
  | .«отобразить» _ _ _, _, h => by simp [«постоянное»] at h
  | .«отфильтровать» _ _ _, _, h => by simp [«постоянное»] at h
  | .«поле» _ _, _, h => by simp [«постоянное»] at h
  | .«форма» _ _, _, h => by simp [«постоянное»] at h
  | .«ссылка» _ _, _, h => by simp [«постоянное»] at h
  | .«применить» _ _, _, h => by simp [«постоянное»] at h
termination_by e => sizeOf e
decreasing_by
  all_goals simp_wf
  all_goals first
    | (have := List.sizeOf_lt_of_mem ‹_ ∈ _›; omega)
    | (have h1 := List.sizeOf_lt_of_mem ‹_ ∈ _›
       have h2 : ∀ q : String × «Выр», sizeOf q.2 < sizeOf q := fun q => by cases q; simp; omega
       have := h2 ‹String × «Выр»›
       omega)

def «заголовок?» (l : String) : Option String :=
  if l.startsWith "функция «" || l.startsWith "тотальная функция «" then
    some ((((l.splitOn "«").getD 1 "").splitOn "»").headD "")
  else none

def «строкаИсходника» («строки» : List String) (i : Nat) : String :=
  ((«строки».getD (i - 1) "").trimAscii).toString

def «хозяинСтроки» («строки» : List String) (i : Nat) : Option String :=
  ((«строки».take (i - 1)).reverse).findSome? «заголовок?»

def «местоТаблицы» («строки» : List String) (f : String) (o c n : Nat) : Bool :=
  decide (1 ≤ o) && decide (c = o + n + 1) &&
    decide («строкаИсходника» «строки» o = "[") && decide («строкаИсходника» «строки» c = "]") &&
    decide («хозяинСтроки» «строки» o = some f) && decide («хозяинСтроки» «строки» c = some f)

def «принятьТаблицу» (P : «Программа») («строки» : List String) (f : String) (o c n : Nat) : Bool :=
  «местоТаблицы» «строки» f o c n &&
    match «функцияПрограммы» P f with
    | some g =>
      g.«параметры».isEmpty &&
        match g.«тело» with
        | .«список» es => («постоянныеВсе» es).isSome
        | _ => false
    | none => false

theorem «таблица-постоянна» (P : «Программа») («строки» : List String) (f : String) (o c n : Nat)
    (h : «принятьТаблицу» P «строки» f o c n = true) :
    (∃ g vs, «функцияПрограммы» P f = some g ∧ g.«параметры» = [] ∧
      ∃ N, ∀ m, N ≤ m → ∀ ρ, «выч» P m ρ g.«тело» = .ok (.«список» vs)) ∧
    c = o + n + 1 ∧ «строкаИсходника» «строки» o = "[" ∧ «строкаИсходника» «строки» c = "]" ∧
    «хозяинСтроки» «строки» o = some f ∧ «хозяинСтроки» «строки» c = some f := by
  unfold «принятьТаблицу» «местоТаблицы» at h
  simp only [Bool.and_eq_true, decide_eq_true_eq] at h
  obtain ⟨⟨⟨⟨⟨⟨_, hc⟩, ho⟩, hcl⟩, hho⟩, hhc⟩, hp⟩ := h
  refine ⟨?_, hc, ho, hcl, hho, hhc⟩
  split at hp
  · rename_i g hg
    simp only [Bool.and_eq_true, List.isEmpty_iff] at hp
    obtain ⟨hpar, hbody⟩ := hp
    split at hbody
    · rename_i es hes
      obtain ⟨vs, hvs⟩ := Option.isSome_iff_exists.mp hbody
      have hconst : «постоянное» (.«список» es) = some (.«список» vs) := by simp [«постоянное», hvs]
      obtain ⟨N, hN⟩ := «постоянное-стоит» P _ _ hconst
      exact ⟨g, vs, hg, hpar, N, fun m hm ρ => by rw [hes]; exact hN m hm ρ⟩
    · cases hbody
  · cases hp

end «Эталон»
