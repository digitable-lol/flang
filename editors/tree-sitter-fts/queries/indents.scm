; Indent hints for FTS. Every block that opens with an implicit INDENT token
; and closes with DEDENT (see src/scanner.c) should indent its children by
; one level; the legacy brace surface indents between matching braces.

[
  (object_definition)
  (structure_definition)
  (morphism_definition)
  (theorem_definition)
  (utility_definition)
  (rule_definition)
  (property_definition)
  (example_definition)
  (functor_file_definition)
  (object_mapping)
  (category_definition)
] @indent

[
  (proposition_body)
  (array)
  (object)
] @indent

"{" @indent
"}" @outdent
