; Highlighting queries for FTS (Russian and English natural surface, the
; legacy brace surface, and the ftsc module/functor-mapping headers).
;
; Ordering matters: most tree-sitter consumers (Neovim, Helix, Zed) resolve
; overlapping captures on the same node by taking the *last* matching
; pattern in this file, so generic fallbacks (bare identifier -> @variable)
; are listed first and specific overrides (a field name, a declared type,
; ...) are listed after them.

; --- generic fallback (overridden below by more specific patterns) -------
(identifier) @variable

; --- literals -----------------------------------------------------------
(string) @string
(number) @number
(boolean) @constant.builtin.boolean
(null_) @constant.builtin

; --- comments -------------------------------------------------------------
(comment) @comment

; --- structural keywords --------------------------------------------------
[
  "категория"
  "category"
] @keyword

[
  "объект"
  "структура"
  "object"
  "structure"
] @keyword

[
  "морфизм"
  "morphism"
] @keyword

[
  "теорема"
  "theorem"
] @keyword

[
  "утилита"
  "utility"
] @keyword

[
  "правило"
  "rule"
] @keyword

[
  "свойство"
  "property"
] @keyword

[
  "пример"
  "example"
] @keyword

; module / functor-mapping headers (ftsc)
[
  "модуль"
  "module"
  "использует"
  "uses"
  "экспортирует"
  "exports"
  "функтор"
  "functor"
] @keyword

[
  "из"
  "from"
  "в"
  "to"
  "into"
] @keyword

[
  "отображается в"
  "maps to"
  "отображается в поле"
  "maps to field"
  "отображается в морфизм"
  "maps to morphism"
] @keyword

[
  "поле"
  "field"
] @keyword

; legacy brace surface
[
  "proposition"
  "утверждение"
] @keyword

[
  "witness"
  "свидетельство"
  "apply"
  "применить"
  "compose"
  "композиция"
] @keyword

; clause / phrase keywords captured via alias($.keyword, ...) in the
; natural surface (является/is, если/if, дано/given, ...)
(keyword) @keyword

; --- types ------------------------------------------------------------
(builtin_type) @type.builtin
(type_expression) @type

(object_definition name: (_) @type)
(structure_definition name: (_) @type)
(state_type name: (_) @type)
(plain_field type: (identifier) @type)
(plain_field type: (string) @type)
(returns_clause type: (_) @type)
(accepts_clause type: (_) @type)

; --- names ------------------------------------------------------------
(morphism_definition name: (_) @function)
(functor_signature name: (_) @function)
(theorem_definition name: (_) @function)
(utility_definition name: (_) @function)
(rule_definition name: (_) @function)
(property_definition name: (_) @function)
(example_definition name: (_) @function)
(category_definition name: (_) @namespace)
(module_declaration name: (_) @namespace)
(functor_file_definition name: (_) @function)

(plain_field name: (_) @property)
(nested_object_field name: (_) @property)
(field_operand field: (_) @property)
(pair key: (_) @property)

; --- operators --------------------------------------------------------
(comparison_operator) @operator
[
  "->"
  "=>"
] @operator
"." @punctuation.delimiter
":" @punctuation.delimiter
"," @punctuation.delimiter
"?" @punctuation.special

; --- punctuation --------------------------------------------------------
[ "{" "}" ] @punctuation.bracket
[ "[" "]" ] @punctuation.bracket
