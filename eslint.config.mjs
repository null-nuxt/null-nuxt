import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: { tooling: true },
})
  .append({
    ignores: [
      '**/dist/**',
      '**/.nuxt/**',
      '**/node_modules/**',
    ],
  })
  // páginas de Nuxt são nomeadas pela rota; a regra de nome composto não se aplica
  .append({
    files: ['**/playground/**/pages/**/*.vue', '**/playground/**/app.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  })
