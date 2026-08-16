// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Диагностика flang: код и текст, дословно совпадающие с интерпретатором.
//
// ── Почему исключение, а не Result ─────────────────────────────────────────
// В C# нет проверяемых исключений вовсе, поэтому здесь нет и того выбора,
// который пришлось делать в бэкенде Java. Остаётся другой: исключение против
// возвращаемого кода. Код возврата означал бы, что каждая напечатанная функция
// возвращает пару, а каждый вызов внутри выражения превращается в оператор с
// проверкой, — ровно то, чем занята половина тела каждой функции в бэкенде Go,
// где выбора нет. Исключение прерывает вычисление немедленно и доходит до того,
// кто действительно готов его обработать (прогонщик, тест, встраивающая
// система), а напечатанный код от этого становится короче на всю обработку
// ошибок.
//
// ── Почему код — строка, а не enum ─────────────────────────────────────────
// Коды flang перечислимы (SPEC, раздел 7), но код нарушенного постусловия
// приезжает данными из AST — у моделей FTS это «FTS_UTILITY_PROPERTY», и
// перечисление перестало бы быть источником истины ровно там, где важнее всего
// совпасть с ядром.
#nullable enable

using System;

/// <summary>Диагностика flang: код и текст.</summary>
public sealed class FlangError : Exception
{
    /// <summary>Коды диагностик (SPEC, раздел 7) — константами.</summary>
    public const string CodeType = "FLANG_TYPE";
    public const string CodeUnknownName = "FLANG_UNKNOWN_NAME";
    public const string CodeMatch = "FLANG_MATCH_NOT_EXHAUSTIVE";
    public const string CodeBuiltinArgs = "FLANG_BUILTIN_ARGS";
    public const string CodeRecursionLimit = "FLANG_RECURSION_LIMIT";
    public const string CodeProperty = "FLANG_PROPERTY";
    public const string CodeParse = "FLANG_PARSE";

    /// <summary>Код диагностики: «FLANG_TYPE», «FTS_UTILITY_PROPERTY» и прочие.</summary>
    public string Code { get; }

    public FlangError(string code, string message)
        : base(message)
    {
        Code = code;
    }

    /// <summary>Текст диагностики; никогда не null, в отличие от Message вообще.</summary>
    public string Text => Message ?? "";
}
