/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Генерат flang лежит вне src/ — Vite собирает его как обычный ESM-модуль.
export default defineConfig({
  plugins: [react()],
})
