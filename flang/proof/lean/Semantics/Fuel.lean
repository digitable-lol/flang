import Semantics.Eval

set_option linter.unusedVariables false

namespace «Эталон»

def «Не позже» {α : Type} (x y : Except «Сбой» α) : Prop := x = .error .«топливо» ∨ x = y

theorem «не позже-сам» {α : Type} (x : Except «Сбой» α) : «Не позже» x x := Or.inr rfl

theorem «не позже-цепь» {α : Type} {x y z : Except «Сбой» α} (h1 : «Не позже» x y) (h2 : «Не позже» y z) :
    «Не позже» x z := by
  rcases h1 with h1 | h1
  · exact Or.inl h1
  · subst h1; exact h2

theorem «не позже-связать» {α β : Type} {x x' : Except «Сбой» α} {f f' : α → Except «Сбой» β}
    (hx : «Не позже» x x') (hf : ∀ a, «Не позже» (f a) (f' a)) : «Не позже» (x >>= f) (x' >>= f') := by
  rcases hx with hx | hx
  · subst hx; exact Or.inl rfl
  · subst hx
    cases x with
    | error e => exact Or.inr rfl
    | ok a => exact hf a

abbrev «Вычислитель» := «Среда» → «Выр» → «Исход»

def «Раньше» (r r' : «Вычислитель») : Prop := ∀ ρ e, «Не позже» (r ρ e) (r' ρ e)

theorem «вычВсе-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») :
    ∀ es, «Не позже» («вычВсе» r ρ es) («вычВсе» r' ρ es)
  | [] => «не позже-сам» _
  | e :: t => «не позже-связать» (H ρ e) (fun v => «не позже-связать» («вычВсе-раньше» H ρ t) (fun w => «не позже-сам» _))

theorem «вычПоля-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») :
    ∀ fs, «Не позже» («вычПоля» r ρ fs) («вычПоля» r' ρ fs)
  | [] => «не позже-сам» _
  | (k, e) :: t => «не позже-связать» (H ρ e) (fun v => «не позже-связать» («вычПоля-раньше» H ρ t) (fun w => «не позже-сам» _))

theorem «свернуть-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») (a x : String) (s : «Выр») :
    ∀ l acc, «Не позже» («свернуть» r ρ a x s acc l) («свернуть» r' ρ a x s acc l)
  | [], acc => «не позже-сам» _
  | v :: t, acc => «не позже-связать» (H _ s) (fun w => «свернуть-раньше» H ρ a x s t w)

theorem «образы-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») (x : String) (s : «Выр») :
    ∀ l, «Не позже» («образы» r ρ x s l) («образы» r' ρ x s l)
  | [] => «не позже-сам» _
  | v :: t => «не позже-связать» (H _ s) (fun w => «не позже-связать» («образы-раньше» H ρ x s t) (fun _ => «не позже-сам» _))

theorem «отбор-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») (x : String) (s : «Выр») :
    ∀ l, «Не позже» («отбор» r ρ x s l) («отбор» r' ρ x s l)
  | [] => «не позже-сам» _
  | v :: t => «не позже-связать» (H _ s) (fun w => «не позже-связать» («отбор-раньше» H ρ x s t) (fun _ => «не позже-сам» _))

theorem «разобрать-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») (v : «Зн») :
    ∀ cs, «Не позже» («разобрать» r ρ v cs) («разобрать» r' ρ v cs)
  | [] => «не позже-сам» _
  | (p, b) :: t => by
    simp only [«разобрать»]
    cases «подходит» p v with
    | error e => exact «не позже-сам» _
    | ok o =>
      cases o with
      | none => exact «разобрать-раньше» H ρ v t
      | some bs => exact H _ b

theorem «пост-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (ρ : «Среда») (v : «Зн») :
    ∀ qs, «Не позже» («проверитьПост» r ρ v qs) («проверитьПост» r' ρ v qs)
  | [] => «не позже-сам» _
  | q :: t => «не позже-связать» (H _ _) (fun c => by
      cases c with
      | «признак» b => cases b with
        | true => exact «пост-раньше» H ρ v t
        | false => exact «не позже-сам» _
      | _ => exact «не позже-сам» _)

theorem «тело-раньше» {r r' : «Вычислитель»} (H : «Раньше» r r') (g : «Функция») (ρ : «Среда») :
    «Не позже» («вызватьТело» r g ρ) («вызватьТело» r' g ρ) :=
  «не позже-связать» (H ρ g.«тело») (fun v => «пост-раньше» H ρ v _)

theorem «шаг-раньше» (P : «Программа») {r r' : «Вычислитель»} (H : «Раньше» r r') : «Раньше» («шаг» P r) («шаг» P r') := by
  intro ρ e
  cases e with
  | «лит» v => exact «не позже-сам» _
  | «имя» x => exact «не позже-сам» _
  | «двучлен» op a b =>
    exact «не позже-связать» (H ρ a) (fun x => «не позже-связать» (H ρ b) (fun y => «не позже-сам» _))
  | «если» c t e =>
    refine «не позже-связать» (H ρ c) (fun u => ?_)
    cases u with
    | «признак» b => cases b with
      | true => exact H ρ t
      | false => exact H ρ e
    | _ => exact «не позже-сам» _
  | «пусть» x v b => exact «не позже-связать» (H ρ v) (fun w => H _ b)
  | «вызов» f args =>
    refine «не позже-связать» («вычВсе-раньше» H ρ args) (fun vs => ?_)
    show «Не позже» (match «функцияПрограммы» P f with
      | some g => if g.«параметры».length = vs.length then «вызватьТело» r g («привязать» g.«параметры» vs) else «беда» "FLANG_ARITY"
      | none => «вне» f) _
    cases «функцияПрограммы» P f with
    | none => exact «не позже-сам» _
    | some g =>
      by_cases hl : g.«параметры».length = vs.length
      · simp only [hl, ↓reduceIte]; exact «тело-раньше» H g _
      · simp only [hl, ↓reduceIte]; exact «не позже-сам» _
  | «разбор» t cs => exact «не позже-связать» (H ρ t) (fun v => «разобрать-раньше» H ρ v cs)
  | «свёртка» l n a x s =>
    refine «не позже-связать» (H ρ l) (fun lv => «не позже-связать» (H ρ n) (fun nv => ?_))
    cases lv with
    | «список» xs => exact «свернуть-раньше» H ρ a x s xs nv
    | _ => exact «не позже-сам» _
  | «отобразить» l x s =>
    refine «не позже-связать» (H ρ l) (fun lv => ?_)
    cases lv with
    | «список» xs => exact «не позже-связать» («образы-раньше» H ρ x s xs) (fun _ => «не позже-сам» _)
    | _ => exact «не позже-сам» _
  | «отфильтровать» l x s =>
    refine «не позже-связать» (H ρ l) (fun lv => ?_)
    cases lv with
    | «список» xs => exact «не позже-связать» («отбор-раньше» H ρ x s xs) (fun _ => «не позже-сам» _)
    | _ => exact «не позже-сам» _
  | «список» es => exact «не позже-связать» («вычВсе-раньше» H ρ es) (fun _ => «не позже-сам» _)
  | «запись» fs => exact «не позже-связать» («вычПоля-раньше» H ρ fs) (fun _ => «не позже-сам» _)
  | «конструктор» k fs => exact «не позже-связать» («вычПоля-раньше» H ρ fs) (fun _ => «не позже-сам» _)
  | «поле» t p => exact «не позже-связать» (H ρ t) (fun _ => «не позже-сам» _)
  | «форма» n args => exact «не позже-связать» («вычВсе-раньше» H ρ args) (fun _ => «не позже-сам» _)
  | «ссылка» f fs => exact «не позже-связать» («вычПоля-раньше» H ρ fs) (fun _ => «не позже-сам» _)
  | «применить» fe args =>
    refine «не позже-связать» (H ρ fe) (fun fv => «не позже-связать» («вычВсе-раньше» H ρ args) (fun vs => ?_))
    cases fv with
    | «вариант» f cap =>
      dsimp only
      cases «функцияТега» P f with
      | none => exact «не позже-сам» _
      | some g =>
        by_cases hl : («свободныеПараметры» g cap).length = vs.length
        · simp only [hl, ↓reduceIte]; exact «тело-раньше» H g _
        · simp only [hl, ↓reduceIte]; exact «не позже-сам» _
    | _ => exact «не позже-сам» _

theorem «топливо-шаг» (P : «Программа») : ∀ n, «Раньше» («выч» P n) («выч» P (n + 1))
  | 0 => fun ρ e => Or.inl rfl
  | n + 1 => fun ρ e => «шаг-раньше» P («топливо-шаг» P n) ρ e

theorem «топливо-запас» (P : «Программа») (n : Nat) : ∀ k, «Раньше» («выч» P n) («выч» P (n + k))
  | 0 => fun ρ e => «не позже-сам» _
  | k + 1 => fun ρ e => «не позже-цепь» («топливо-запас» P n k ρ e) («топливо-шаг» P (n + k) ρ e)

theorem «топливо-моно» (P : «Программа») {n m : Nat} (h : n ≤ m) (ρ : «Среда») (e : «Выр») {r : «Исход»}
    (hr : «выч» P n ρ e = r) (hn : r ≠ .error .«топливо») : «выч» P m ρ e = r := by
  obtain ⟨k, rfl⟩ := Nat.exists_eq_add_of_le h
  rcases «топливо-запас» P n k ρ e with q | q
  · exact absurd (hr ▸ q) hn
  · rw [← q, hr]

end «Эталон»
