<script lang="ts" setup>
const links = [
  { to: '/', label: 'Início' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/produto', label: 'Produto' },
  { to: '/checkout', label: 'Checkout' },
]
</script>

<template>
  <div class="app">
    <nav>
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
      >
        {{ link.label }}
      </NuxtLink>
      <button
        class="back"
        @click="$router.back()"
      >
        ← voltar
      </button>
    </nav>

    <div class="layout">
      <main>
        <NuxtPage />
      </main>
      <!-- a jornada vive no sessionStorage e no histórico: no servidor ela é
           vazia, então renderizar no SSR daria mismatch de hidratação -->
      <ClientOnly>
        <JourneyPanel />
      </ClientOnly>
    </div>
  </div>
</template>

<style>
body { margin: 0; background: #fafafa; }
.app {
  font-family: system-ui, sans-serif;
  color: #18181b;
  max-width: 68rem;
  margin: 0 auto;
  padding: 1.5rem;
}
nav {
  display: flex;
  gap: .4rem;
  align-items: center;
  margin-bottom: 1.2rem;
  flex-wrap: wrap;
}
nav a {
  padding: .35rem .7rem;
  border-radius: .35rem;
  text-decoration: none;
  color: #3f3f46;
  border: 1px solid #e4e4e7;
  background: #fff;
  font-size: .85rem;
}
nav a.router-link-exact-active { background: #6366f1; color: #fff; border-color: #6366f1; }
nav .back {
  margin-left: auto;
  padding: .35rem .7rem;
  border-radius: .35rem;
  border: 1px solid #d4d4d8;
  background: #fff;
  cursor: pointer;
  font-size: .85rem;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  gap: 1.2rem;
  align-items: start;
}
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
main {
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: .6rem;
  padding: 1.2rem;
}
main h1 { font-size: 1.15rem; margin: 0 0 .5rem; }
main p { font-size: .88rem; color: #52525b; margin: 0 0 1rem; }
main button {
  font-size: .82rem;
  padding: .4rem .8rem;
  border-radius: .35rem;
  border: 1px solid #d4d4d8;
  background: #fafafa;
  cursor: pointer;
  margin-right: .4rem;
}
</style>
