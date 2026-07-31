<script setup lang="ts">
definePageMeta({ track: 'catalogo' })
</script>

<template>
  <div>
    <h1>Catálogo</h1>
    <p>
      Os botões abaixo usam a diretiva <code>v-track</code> — clique puro, sem
      handler nenhum no componente.
    </p>

    <button v-track="{ name: 'add_to_cart', target: 'plano-anual' }">
      adicionar plano anual
    </button>
    <button v-track="{ name: 'add_to_cart', target: 'plano-mensal' }">
      adicionar plano mensal
    </button>

    <p style="margin-top: 1.2rem">
      O card abaixo é do tipo <code>hover</code>: passe o mouse e
      <strong>espere 400ms</strong>. Passar rápido não gera evento — é o limiar
      que impede hover de inundar o backend.
    </p>

    <div
      v-track="{ name: 'plano_destacado', target: 'plano-anual' }"
      class="card"
    >
      Plano Anual — passe o mouse e segure
    </div>
  </div>
</template>

<style scoped>
.card {
  border: 1px dashed #a1a1aa;
  border-radius: .5rem;
  padding: 1.2rem;
  margin-top: .6rem;
  font-size: .9rem;
  color: #52525b;
}
.card:hover { background: #f4f4f5; }
</style>
