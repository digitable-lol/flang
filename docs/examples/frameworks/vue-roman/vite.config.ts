import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Генерат flang лежит вне src/ — Vite и так его собирает как обычный ESM-модуль.
export default defineConfig({
  plugins: [vue()],
})
