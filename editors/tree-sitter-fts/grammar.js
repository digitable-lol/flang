/**
 * tree-sitter grammar for FTS.
 *
 * FTS has three surfaces that coexist in real files (see docs/language.ru.md
 * and tools/ftsc/src/parse-module.mjs upstream):
 *
 *  1. The natural, indentation-significant surface (Russian and English
 *     keywords over the same structure) - "категория «Имя»" / "category Name"
 *     followed by an indented body of объект/морфизм/теорема/утилита blocks.
 *  2. The legacy brace/JSON-like surface - "category Name { structure X {...} }"
 *     - kept for backward compatibility (see examples/task-status.fts,
 *     examples/socrates.fts).
 *  3. The ftsc module/functor-mapping headers layered on top of a document
 *     (модуль/module, использует/uses, экспортирует/exports, and standalone
 *     функтор/functor mapping files) - see tools/ftsc/stdlib/**.
 *
 * Indentation for surface (1) is handled by an external scanner
 * (src/scanner.c) that emits _newline/_indent/_dedent tokens, modelled after
 * the approach used by tree-sitter-python and tree-sitter-yaml. Those tokens
 * are only produced when a real line break is crossed, so the brace surface
 * (2), which never asks for them mid-line, is unaffected and parses with
 * ordinary token rules.
 */

const PREC = {
  comment: -1,
}

module.exports = grammar({
  name: "fts",

  // '\n' is an ordinary extra (needed so the legacy brace surface, which
  // never asks the external scanner for NEWLINE/INDENT/DEDENT, treats line
  // breaks as insignificant whitespace exactly like natural-parser.ts's
  // skipSeparators() does for ';' and ','). Whenever the parser state does
  // expect NEWLINE/INDENT/DEDENT, the external scanner runs first and
  // claims the line break before it would ever be swallowed as an extra.
  extras: ($) => [/[ \t\r\n]/, $.comment],

  externals: ($) => [$._newline, $._indent, $._dedent],

  word: ($) => $._word,

  rules: {
    source_file: ($) => repeat($._top_level_item),

    _top_level_item: ($) =>
      choice(
        $.module_declaration,
        $.uses_declaration,
        $.exports_declaration,
        $.category_definition,
        $.functor_file_definition,
        $._blank_line,
      ),

    _blank_line: ($) => $._newline,

    comment: (_$) =>
      token(
        prec(
          PREC.comment,
          choice(seq("//", /[^\n]*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
        ),
      ),

    // ---------------------------------------------------------------------
    // Names, literals, values shared by every surface
    // ---------------------------------------------------------------------

    _word: (_$) => /[\p{ID_Start}_$][\p{ID_Continue}$\u200C\u200D-]*/u,

    identifier: ($) => $._word,

    string: (_$) =>
      choice(
        /«[^»]*»/u,
        token(seq('"', repeat(choice(/[^"\\]/, /\\./)), '"')),
        token(seq("'", repeat(choice(/[^'\\]/, /\\./)), "'")),
      ),

    number: (_$) => /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/,

    _name: ($) => choice($.identifier, $.string),

    boolean: (_$) => choice("да", "нет", "true", "false"),
    null_: (_$) => choice("ничто", "null"),

    _scalar: ($) => choice($.string, $.number, $.boolean, $.null_, $.identifier),

    // ---------------------------------------------------------------------
    // Module headers (ftsc): модуль/module, использует/uses, экспортирует/exports
    // ---------------------------------------------------------------------

    module_declaration: ($) =>
      seq(choice("модуль", "module"), field("name", $._name), $._newline),

    uses_declaration: ($) =>
      seq(
        choice("использует", "uses"),
        field("category", $._name),
        choice("из", "from"),
        field("path", $._name),
        $._newline,
      ),

    exports_declaration: ($) =>
      seq(
        choice("экспортирует", "exports"),
        field("names", $._name_list),
        $._newline,
      ),

    _name_list: ($) => seq($._name, repeat(seq(",", $._name))),

    // ---------------------------------------------------------------------
    // Functor mapping files (standalone .fts files that start with
    // функтор/functor instead of категория/category)
    // ---------------------------------------------------------------------

    functor_file_definition: ($) =>
      seq(
        choice("функтор", "functor"),
        field("name", $._name),
        choice("из", "from"),
        field("domain", $._name),
        choice("в", "to", "into"),
        field("codomain", $._name),
        $._newline,
        $._indent,
        repeat1(choice($.uses_declaration, $.object_mapping, $.morphism_mapping)),
        $._dedent,
      ),

    object_mapping: ($) =>
      seq(
        choice("объект", "object"),
        field("from", $._name),
        choice("отображается в", "maps to"),
        field("to", $._name),
        $._newline,
        $._indent,
        repeat1($.field_mapping),
        $._dedent,
      ),

    field_mapping: ($) =>
      seq(
        choice("поле", "field"),
        field("from", $._name),
        choice("отображается в поле", "maps to field"),
        field("to", $._name),
        $._newline,
      ),

    morphism_mapping: ($) =>
      seq(
        choice("морфизм", "morphism"),
        field("from", $._name),
        choice("отображается в морфизм", "maps to morphism"),
        field("to", $._name),
        $._newline,
      ),

    // ---------------------------------------------------------------------
    // category ... { ... }   (legacy brace / JSON-like surface)
    // category ...           (natural indentation surface)
    // ---------------------------------------------------------------------

    category_definition: ($) =>
      seq(
        choice("категория", "category"),
        field("name", $._name),
        choice($._brace_category_body, $._natural_category_body),
      ),

    _brace_category_body: ($) =>
      seq(
        "{",
        repeat(choice($.structure_definition, $.functor_signature, $.proposition)),
        "}",
      ),

    _natural_category_body: ($) =>
      seq(
        $._newline,
        $._indent,
        repeat1(
          choice(
            $.object_definition,
            $.morphism_definition,
            $.theorem_definition,
            $.utility_definition,
          ),
        ),
        $._dedent,
      ),

    // --- brace-surface members ------------------------------------------

    structure_definition: ($) =>
      seq(
        choice("structure", "структура"),
        field("name", $._name),
        "{",
        repeat($.brace_field),
        "}",
      ),

    brace_field: ($) =>
      seq(
        field("name", $._name),
        optional("?"),
        ":",
        field("type", $.type_expression),
        optional(choice(";", ",")),
      ),

    // Excludes '-' and '=' so a bare type never swallows the following
    // '->'/'=>' arrow token in functor_signature (e.g. "TaskRow -> TaskStatus").
    type_expression: (_$) => token(/[^\n;,{}=-]+/),

    functor_signature: ($) =>
      seq(
        choice("functor", "функтор"),
        field("name", $._name),
        ":",
        field("domain", $.type_expression),
        choice("->", "=>"),
        field("codomain", $.type_expression),
      ),

    proposition: ($) =>
      seq(
        optional(choice("proposition", "утверждение")),
        $._proposition_kind_body,
      ),

    _proposition_kind_body: ($) =>
      choice($.witness_proposition, $.apply_proposition, $.compose_proposition),

    witness_proposition: ($) =>
      seq(
        choice("witness", "свидетельство"),
        field("structure", $._name),
        ".",
        field("field", $._name),
        $.proposition_body,
      ),

    apply_proposition: ($) =>
      seq(
        choice("apply", "применить"),
        optional(field("functor", $._name)),
        $.proposition_body,
      ),

    compose_proposition: ($) =>
      seq(
        choice("compose", "композиция"),
        optional(field("functors", $.array)),
        $.proposition_body,
      ),

    proposition_body: ($) => seq("{", repeat($._proposition_body_entry), "}"),

    _proposition_body_entry: ($) =>
      choice(
        seq(optional(choice("proposition", "утверждение")), $._proposition_kind_body),
        $.proposition_property,
      ),

    proposition_property: ($) =>
      seq(
        field(
          "key",
          choice(
            "selector",
            "селектор",
            "value",
            "значение",
            "path",
            "путь",
            "detail",
            "описание",
            "functor",
            "функтор",
            "functors",
            "функторы",
          ),
        ),
        optional(":"),
        field("value", $._json_value),
      ),

    // Generic JSON-ish value grammar reused by proposition bodies.
    _json_value: ($) => choice($._scalar, $.array, $.object),

    array: ($) =>
      seq("[", optional(seq($._json_value, repeat(seq(",", $._json_value)), optional(","))), "]"),

    object: ($) =>
      seq(
        "{",
        optional(seq($.pair, repeat(seq(",", $.pair)), optional(","))),
        "}",
      ),

    pair: ($) => seq(field("key", choice($._name)), ":", field("value", $._json_value)),

    // --- natural-surface declarations ------------------------------------

    object_definition: ($) =>
      seq(
        choice("объект", "структура", "object", "structure"),
        field("name", $._name),
        $._newline,
        $._indent,
        repeat1($.field_definition),
        $._dedent,
      ),

    field_definition: ($) =>
      choice($.nested_object_field, $.plain_field),

    nested_object_field: ($) =>
      seq(
        choice(
          seq(choice("вложен", "nested"), choice("объект", "object")),
          seq(choice("вложена", "nested"), choice("структура", "structure")),
        ),
        field("name", $._name),
        $._newline,
      ),

    plain_field: ($) =>
      seq(
        field("name", $._name),
        field(
          "modality",
          choice(
            alias(choice("является", "is"), $.keyword),
            alias(choice("иногда является", "may be"), $.keyword),
          ),
        ),
        field("type", $._field_type),
        $._newline,
      ),

    _field_type: ($) =>
      choice($.state_type, $.builtin_type, $._name),

    state_type: ($) =>
      seq(alias(choice("состоянием", "state"), $.keyword), field("name", $._name)),

    builtin_type: (_$) =>
      choice(
        "строкой",
        "текстом",
        "числом",
        "датой",
        "деньгами",
        "признаком",
        "string",
        "number",
        "date",
        "money",
        "boolean",
      ),

    morphism_definition: ($) =>
      seq(
        choice("морфизм", "morphism"),
        field("name", $._name),
        $._newline,
        $._indent,
        repeat1($.morphism_clause),
        $._dedent,
      ),

    morphism_clause: ($) =>
      choice(
        seq(alias(choice("если", "if"), $.keyword), field("domain", $._name), $._newline),
        seq(alias(choice("то", "then"), $.keyword), field("codomain", $._name), $._newline),
        seq(alias(choice("из", "from"), $.keyword), field("domain", $._name), $._newline),
        seq(alias(choice("в", "to"), $.keyword), field("codomain", $._name), $._newline),
        seq(
          alias(choice("по закону", "under law"), $.keyword),
          field("law", $._name),
          $._newline,
        ),
      ),

    theorem_definition: ($) =>
      seq(
        choice("теорема", "theorem"),
        field("name", $._name),
        $._newline,
        $._indent,
        repeat1($.theorem_clause),
        $._dedent,
      ),

    theorem_clause: ($) =>
      choice(
        $.given_clause,
        $.data_lookup_clause,
        $.by_morphism_clause,
        $.then_by_morphism_clause,
        $.apply_morphism_clause,
        $.then_apply_morphism_clause,
        $.therefore_clause,
      ),

    given_clause: ($) =>
      seq(
        alias(choice("дано", "given"), $.keyword),
        field("structure", $._name),
        alias(choice("имеет", "has"), $.keyword),
        field("field", $._name),
        alias(choice("равное", "equal to"), $.keyword),
        field("value", $._scalar),
        $._newline,
      ),

    data_lookup_clause: ($) =>
      seq(
        alias(choice("в данных", "in data"), $.keyword),
        field("collection", $._name),
        alias(choice("найти где", "find where"), $.keyword),
        field("field", $._name),
        alias(choice("равен", "equals"), $.keyword),
        field("value", $._scalar),
        $._newline,
      ),

    by_morphism_clause: ($) =>
      seq(
        alias(choice("по морфизму", "by morphism"), $.keyword),
        field("name", $._name),
        $._newline,
      ),

    then_by_morphism_clause: ($) =>
      seq(
        alias(choice("затем по морфизму", "then by morphism"), $.keyword),
        field("name", $._name),
        $._newline,
      ),

    apply_morphism_clause: ($) =>
      seq(
        alias(choice("применить морфизм", "apply morphism"), $.keyword),
        field("name", $._name),
        $._newline,
      ),

    then_apply_morphism_clause: ($) =>
      seq(
        alias(choice("затем применить морфизм", "then apply morphism"), $.keyword),
        field("name", $._name),
        $._newline,
      ),

    therefore_clause: ($) =>
      seq(
        alias(choice("следовательно", "получаем", "therefore"), $.keyword),
        field("name", $._name),
        $._newline,
      ),

    utility_definition: ($) =>
      seq(
        choice("утилита", "utility"),
        field("name", $._name),
        $._newline,
        $._indent,
        repeat1(
          choice(
            $.accepts_clause,
            $.returns_clause,
            $.starts_with_clause,
            $.rule_definition,
            $.property_definition,
            $.example_definition,
          ),
        ),
        $._dedent,
      ),

    accepts_clause: ($) =>
      seq(alias(choice("принимает", "accepts"), $.keyword), field("type", $._name), $._newline),

    returns_clause: ($) =>
      seq(
        alias(choice("возвращает", "returns"), $.keyword),
        field("type", choice($.builtin_type, $._name)),
        $._newline,
      ),

    starts_with_clause: ($) =>
      seq(
        alias(choice("начинает с", "starts with"), $.keyword),
        field("value", $._scalar),
        $._newline,
      ),

    rule_definition: ($) =>
      seq(
        choice("правило", "rule"),
        field("name", $._name),
        $._newline,
        $._indent,
        repeat1(choice($.if_condition, $.and_condition, $.then_add_action, $.then_result_action)),
        $._dedent,
      ),

    if_condition: ($) =>
      seq(alias(choice("если", "if"), $.keyword), $._condition_body, $._newline),

    and_condition: ($) =>
      seq(alias(choice("и", "and"), $.keyword), $._condition_body, $._newline),

    _condition_body: ($) =>
      seq(field("field", $._name), field("operator", $.comparison_operator), field("value", $._operand)),

    then_add_action: ($) =>
      seq(
        alias(choice("то добавить", "then add"), $.keyword),
        field("value", $._operand),
        $._newline,
      ),

    then_result_action: ($) =>
      seq(
        alias(choice("то результат", "then result"), $.keyword),
        field("operator", $.comparison_operator),
        field("value", $._operand),
        $._newline,
      ),

    comparison_operator: (_$) =>
      choice(
        "не меньше",
        "не больше",
        "не равен",
        "не равна",
        "не равно",
        "равен",
        "равна",
        "равно",
        "больше",
        "меньше",
        "is at least",
        "is at most",
        "is not equal to",
        "equals",
        "is greater than",
        "is less than",
      ),

    _operand: ($) => choice($.percent_operand, $.field_operand, $.result_operand, $._scalar),

    percent_operand: ($) =>
      seq(
        field("percent", $.number),
        alias(
          choice("процентов от поля", "процента от поля", "процент от поля", "percent of field", "percents of field"),
          $.keyword,
        ),
        field("field", $._name),
      ),

    field_operand: ($) =>
      seq(alias(choice("поле", "field"), $.keyword), field("field", $._name)),

    result_operand: (_$) => choice("результат", "result"),

    property_definition: ($) =>
      seq(
        choice("свойство", "property"),
        field("name", $._name),
        $._newline,
        $._indent,
        $.result_comparison,
        $._dedent,
      ),

    result_comparison: ($) =>
      seq(
        alias(choice("результат", "result"), $.keyword),
        field("operator", $.comparison_operator),
        field("value", $._operand),
        $._newline,
      ),

    example_definition: ($) =>
      seq(
        choice("пример", "example"),
        field("name", $._name),
        $._newline,
        $._indent,
        repeat1(choice($.given_input, $.expected_output)),
        $._dedent,
      ),

    given_input: ($) =>
      seq(
        alias(choice("дано", "given"), $.keyword),
        field("field", $._name),
        field("operator", $.comparison_operator),
        field("value", $._scalar),
        $._newline,
      ),

    expected_output: ($) =>
      seq(
        alias(choice("ожидается", "expected"), $.keyword),
        field("field", choice("результат", "result")),
        field("operator", $.comparison_operator),
        field("value", $._scalar),
        $._newline,
      ),
  },
})
