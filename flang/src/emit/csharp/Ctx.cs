// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause

// Счётчики пределов и настройка индексации строк.
//
// Пределы — не украшение. Обычная (не тотальная) функция flang может не
// завершаться, и интерпретатор ловит это лимитом шагов и глубины. Без счётчиков
// напечатанная программа в том же месте либо крутилась бы вечно, либо падала бы
// по стеку — то есть давала бы не FLANG_RECURSION_LIMIT, а зависание или
// StackOverflowException.
//
// ── Предел стека .NET не имеет права подменять предел языка ────────────────
// StackOverflowException в .NET, в отличие от Java и почти всего остального, не
// ловится вовсе: начиная с .NET 2.0 среда завершает процесс немедленно, и ни
// catch, ни finally не выполняются. То есть переполнение стека здесь даже не
// «не диагностика» — это потеря всех ответов, которые прогонщик успел
// накопить. Поэтому вычисление считается в потоке с явно заданным большим
// стеком (Flang.WithDeepStack), а предел глубины считает этот класс — и
// упирается в него первым, там же, где интерпретатор.
//
// ── Оговорка о шаге ────────────────────────────────────────────────────────
// Шаг интерпретатора — итерация его машины, а не вызов функции: одно применение
// функции стоит там многих шагов. Здесь шагом считается вход в функцию, виток
// цикла хвостового самовызова и отскок батута. Значит счётчик здесь всегда
// МЕНЬШЕ счётчика интерпретатора при том же вычислении, и при одинаковом
// пределе интерпретатор упирается в лимит первым. Расхождение одностороннее и
// безопасное.
#nullable enable

using System.Globalization;

/// <summary>Контекст вычисления: пределы и индексация строк.</summary>
public sealed class Ctx
{
    /// <summary>Значения по умолчанию — те же, что у интерпретатора.</summary>
    public const int DefaultMaxDepth = 10000;
    public const long DefaultMaxSteps = 1000000L;
    public const int DefaultIndexBase = 1;

    /// <summary>База индексации строк: 1 (SPEC, раздел 5) либо 0.</summary>
    public int IndexBase = DefaultIndexBase;

    /// <summary>Предел глубины вызовов; 0 и меньше — предела нет.</summary>
    public int MaxDepth = DefaultMaxDepth;

    /// <summary>Предел шагов; 0 и меньше — предела нет.</summary>
    public long MaxSteps = DefaultMaxSteps;

    /// <summary>Текущая глубина вызовов.</summary>
    public int Depth;

    /// <summary>Сделано шагов.</summary>
    public long Steps;

    /// <summary>Вход в функцию, способную к рекурсии.</summary>
    public void Enter(string function)
    {
        Step(function);
        if (MaxDepth > 0 && Depth + 1 > MaxDepth)
        {
            throw new FlangError(
                FlangError.CodeRecursionLimit,
                "функция «" + function + "» превысила предел глубины вызовов ("
                    + MaxDepth.ToString(CultureInfo.InvariantCulture) + ") на глубине "
                    + (Depth + 1).ToString(CultureInfo.InvariantCulture));
        }
        Depth += 1;
    }

    /// <summary>
    /// Выход из функции. Вызывается и на ошибке (через finally): счётчик глубины
    /// обязан вернуться назад, иначе первая же пойманная ошибка навсегда съела
    /// бы предел.
    /// </summary>
    public void Leave()
    {
        Depth -= 1;
    }

    /// <summary>
    /// Виток вычисления: вход в функцию, цикл самовызова, отскок батута.
    /// Считается отдельно от глубины: хвостовая рекурсия глубину не растит, но
    /// завершаться от этого не начинает.
    /// </summary>
    public void Step(string function)
    {
        Steps += 1;
        if (MaxSteps > 0 && Steps > MaxSteps)
        {
            throw new FlangError(
                FlangError.CodeRecursionLimit,
                "функция «" + function + "» исчерпала лимит шагов ("
                    + MaxSteps.ToString(CultureInfo.InvariantCulture) + ") на глубине вызовов "
                    + Depth.ToString(CultureInfo.InvariantCulture));
        }
    }
}
