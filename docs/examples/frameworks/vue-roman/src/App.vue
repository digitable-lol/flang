<!-- SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) -->
<!-- SPDX-License-Identifier: BSD-2-Clause -->
<script setup lang="ts">
// Хозяин — Vue. Он держит поля ввода, реактивность и разметку.
// Решение — flang: перевод чисел в римскую запись и обратно считает
// доказанно-тотальное ядро roman_numerals.js. Ни одной строки самой
// арифметики здесь нет — только вызовы ядра.
import { ref, computed } from 'vue'
import { vRimskie, izRimskih, tudaIObratno } from '../printed/roman_numerals.js'

const arabskoe = ref(2024)
const rimskoe = ref('MMXXIV')

// В римские: ядро тотально на любом числе, JS-обёртке нечего проверять.
const vRimskoe = computed(() => vRimskie(arabskoe.value))
// Из римских: ядро возвращает число; «туда и обратно» — проверка ядром себя.
const izRimskogo = computed(() => izRimskih(rimskoe.value))
const krug = computed(() => tudaIObratno(arabskoe.value))
</script>

<template>
  <main>
    <h1>Римские цифры — ядро на flang, форма на Vue</h1>

    <section>
      <label>Арабское число
        <input type="number" v-model.number="arabskoe" />
      </label>
      <p>В римские: <b>{{ vRimskoe }}</b></p>
      <p>Туда и обратно ({{ arabskoe }} → римское → число) сходится:
        <b>{{ krug ? 'да' : 'нет' }}</b></p>
    </section>

    <section>
      <label>Римская запись
        <input type="text" v-model="rimskoe" />
      </label>
      <p>Из римских: <b>{{ izRimskogo }}</b></p>
    </section>

    <footer>
      Границу считает <code>core/roman-numerals.flang</code>;
      Vue только принимает ввод и рисует ответ.
    </footer>
  </main>
</template>
