export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: false },
  tracking: {
    baseURL: '/api',
    debug: true,
    // na demo interessa ver cada evento; em produção o padrão é 'name'
    dedupe: 'off',
  },
})
