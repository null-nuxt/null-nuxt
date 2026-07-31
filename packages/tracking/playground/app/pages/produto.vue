<script setup lang="ts">
definePageMeta({ track: 'produto' })
</script>

<template>
  <div>
    <h1>Produto</h1>
    <p>
      Um clique aqui vira um nó <strong>filho desta página</strong> na árvore —
      sem virar o nó atual, porque clicar não é navegar.
    </p>

    <button v-track="{ name: 'add_to_cart', target: 'produto-detalhe' }">
      adicionar ao carrinho
    </button>
  </div>
</template>
