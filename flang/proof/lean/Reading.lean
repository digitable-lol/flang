import RecordReader

set_option linter.unusedVariables false

namespace «Разбор»

def «НеПозже» {α : Type} (x y : «Чтение» α) : Prop := x = .error true ∨ x = y

theorem «неПозже-сам» {α : Type} (x : «Чтение» α) : «НеПозже» x x := Or.inr rfl

theorem «неПозже-связать» {α β : Type} {x x' : «Чтение» α} {f f' : α → «Чтение» β}
    (hx : «НеПозже» x x') (hf : ∀ a, «НеПозже» (f a) (f' a)) : «НеПозже» (x >>= f) (x' >>= f') := by
  rcases hx with hx | hx
  · subst hx; exact Or.inl rfl
  · subst hx
    cases x with
    | error e => exact Or.inr rfl
    | ok a => exact hf a

theorem «неПозже-либо» {α β : Type} {x x' : «Чтение» α} {f f' : α → «Чтение» β} {k k' : «Чтение» β}
    (hx : «НеПозже» x x') (hf : ∀ a, «НеПозже» (f a) (f' a)) (hk : «НеПозже» k k') :
    «НеПозже» («либо» x f k) («либо» x' f' k') := by
  rcases hx with hx | hx
  · subst hx; exact Or.inl rfl
  · subst hx
    cases x with
    | ok a => exact hf a
    | error e => cases e with
      | true => exact Or.inl rfl
      | false => exact hk

structure «Ступень» (n : Nat) : Prop where
  «ч» : ∀ s, «НеПозже» («числоЗ» n s) («числоЗ» (n + 1) s)
  «с» : ∀ s, «НеПозже» («списокЗ» n s) («списокЗ» (n + 1) s)
  «т» : ∀ s, «НеПозже» («текстЗ» n s) («текстЗ» (n + 1) s)
  «ф» : ∀ s, «НеПозже» («формЗ» n s) («формЗ» (n + 1) s)
  «тл» : ∀ s, «НеПозже» («телоЗ» n s) («телоЗ» (n + 1) s)
  «см» : ∀ s, «НеПозже» («суммаЗ» n s) («суммаЗ» (n + 1) s)
  «п» : ∀ l, «НеПозже» («поляЗ» n l) («поляЗ» (n + 1) l)
  «сл» : ∀ l, «НеПозже» («случаиЗ» n l) («случаиЗ» (n + 1) l)
  «д» : ∀ l, «НеПозже» («доводыЗ» n l) («доводыЗ» (n + 1) l)
  «чл» : ∀ l, «НеПозже» («членыЗ» n l) («членыЗ» (n + 1) l)

set_option hygiene false in
macro "mono_step" : tactic => `(tactic| (
  repeat' first
    | with_reducible exact «неПозже-сам» _
    | with_reducible exact h1 _
    | with_reducible exact h2 _
    | with_reducible exact h3 _
    | with_reducible exact h4 _
    | with_reducible exact h5 _
    | with_reducible exact h6 _
    | with_reducible exact h7 _
    | with_reducible exact h8 _
    | with_reducible exact h9 _
    | with_reducible exact h10 _
    | (with_reducible apply «неПозже-связать») <;> try intro _
    | (with_reducible apply «неПозже-либо») <;> try intro _
    | split))

theorem «сравнение-мон» {a a' : String → «Чтение» «ТермЧ»} {b b' : String → «Чтение» «ТермС»}
    {c c' : String → «Чтение» «ТермТ»} {d d' : List String → «Чтение» «Доводы»}
    (h1 : ∀ s, «НеПозже» (a s) (a' s)) (h2 : ∀ s, «НеПозже» (b s) (b' s))
    (h3 : ∀ s, «НеПозже» (c s) (c' s)) (h9 : ∀ l, «НеПозже» (d l) (d' l)) (s : String) :
    «НеПозже» («шагСравнения» a b c d s) («шагСравнения» a' b' c' d' s) := by
  unfold «шагСравнения»; try dsimp only; mono_step

theorem «ступень» : ∀ n, «Ступень» n
  | 0 => ⟨fun _ => Or.inl rfl, fun _ => Or.inl rfl, fun _ => Or.inl rfl, fun _ => Or.inl rfl,
      fun _ => Or.inl rfl, fun _ => Or.inl rfl, fun _ => Or.inl rfl, fun _ => Or.inl rfl,
      fun _ => Or.inl rfl, fun _ => Or.inl rfl⟩
  | n + 1 => by
    have ih := «ступень» n
    obtain ⟨h1, h2, h3, h4, h5, h6, h7, h8, h9, h10⟩ := ih
    refine ⟨fun s => ?_, fun s => ?_, fun s => ?_, fun s => ?_, fun s => ?_, fun s => ?_,
      fun l => ?_, fun l => ?_, fun l => ?_, fun l => ?_⟩
    · rw [«числоЗ».eq_2, «числоЗ».eq_2]; unfold «шагЧисла»; try dsimp only; mono_step
    · rw [«списокЗ».eq_2, «списокЗ».eq_2]; unfold «шагСписка»; try dsimp only; mono_step
    · rw [«текстЗ».eq_2, «текстЗ».eq_2]; unfold «шагТекста»; try dsimp only; mono_step
    · rw [«формЗ».eq_2, «формЗ».eq_2]; unfold «шагФормулы»; try dsimp only; mono_step
      all_goals exact «сравнение-мон» h1 h2 h3 h9 _
    · rw [«телоЗ».eq_2, «телоЗ».eq_2]; unfold «шагТела»
      by_cases hc : («ужать» s).startsWith "вариант «" = true
      · rw [if_pos hc, if_pos hc]; mono_step
      · rw [if_neg hc, if_neg hc]; mono_step
    · rw [«суммаЗ».eq_2, «суммаЗ».eq_2]; unfold «шагСуммы»; try dsimp only; mono_step
    · rw [«поляЗ».eq_2, «поляЗ».eq_2]; cases l <;> simp only [«шагПолей»] <;> mono_step
    · rw [«случаиЗ».eq_2, «случаиЗ».eq_2]; cases l <;> simp only [«шагСлучаев»] <;> mono_step
    · rw [«доводыЗ».eq_2, «доводыЗ».eq_2]; cases l <;> simp only [«шагДоводов»] <;> mono_step
    · rw [«членыЗ».eq_2, «членыЗ».eq_2]; cases l <;> simp only [«шагЧленов»] <;> mono_step

theorem «неПозже-цепь» {α : Type} {x y z : «Чтение» α} (h1 : «НеПозже» x y) (h2 : «НеПозже» y z) :
    «НеПозже» x z := by
  rcases h1 with h1 | h1
  · exact Or.inl h1
  · subst h1; exact h2

theorem «запас-растёт» {α β : Type} (f : Nat → β → «Чтение» α) (hf : ∀ n b, «НеПозже» (f n b) (f (n + 1) b))
    (n : Nat) (b : β) : ∀ k, «НеПозже» (f n b) (f (n + k) b)
  | 0 => «неПозже-сам» _
  | k + 1 => «неПозже-цепь» («запас-растёт» f hf n b k) (hf (n + k) b)

theorem «запас-не-меняет» {α β : Type} (f : Nat → β → «Чтение» α) (hf : ∀ n b, «НеПозже» (f n b) (f (n + 1) b))
    {n m : Nat} (h : n ≤ m) (b : β) (hn : f n b ≠ .error true) : f m b = f n b := by
  obtain ⟨k, rfl⟩ := Nat.exists_eq_add_of_le h
  rcases «запас-растёт» f hf n b k with q | q
  · exact absurd q hn
  · exact q.symm

theorem «формула-не-зависит-от-запаса» (s : String) {m : Nat} (h : «запасЧтения» s ≤ m)
    (hn : «формЗ» («запасЧтения» s) s ≠ .error true) :
    «формЗ» m s = «формЗ» («запасЧтения» s) s :=
  «запас-не-меняет» «формЗ» (fun n => («ступень» n).«ф») h s hn

theorem «число-не-зависит-от-запаса» (s : String) {m : Nat} (h : «запасЧтения» s ≤ m)
    (hn : «числоЗ» («запасЧтения» s) s ≠ .error true) :
    «числоЗ» m s = «числоЗ» («запасЧтения» s) s :=
  «запас-не-меняет» «числоЗ» (fun n => («ступень» n).«ч») h s hn

theorem «список-не-зависит-от-запаса» (s : String) {m : Nat} (h : «запасЧтения» s ≤ m)
    (hn : «списокЗ» («запасЧтения» s) s ≠ .error true) :
    «списокЗ» m s = «списокЗ» («запасЧтения» s) s :=
  «запас-не-меняет» «списокЗ» (fun n => («ступень» n).«с») h s hn

theorem «текст-не-зависит-от-запаса» (s : String) {m : Nat} (h : «запасЧтения» s ≤ m)
    (hn : «текстЗ» («запасЧтения» s) s ≠ .error true) :
    «текстЗ» m s = «текстЗ» («запасЧтения» s) s :=
  «запас-не-меняет» «текстЗ» (fun n => («ступень» n).«т») h s hn

theorem «тело-не-зависит-от-запаса» (s : String) {m : Nat} (h : «запасЧтения» s ≤ m)
    (hn : «телоЗ» («запасЧтения» s) s ≠ .error true) :
    «телоЗ» m s = «телоЗ» («запасЧтения» s) s :=
  «запас-не-меняет» «телоЗ» (fun n => («ступень» n).«тл») h s hn

end «Разбор»
