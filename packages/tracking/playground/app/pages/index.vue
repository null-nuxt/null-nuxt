<script setup lang="ts">
definePageMeta({ track: 'landing_page' })
</script>

<template>
  <div>
    <h1>Início</h1>
    <p>
      Esta página se declara sozinha com
      <code>definePageMeta({ track: 'landing_page' })</code> — nenhuma chamada
      no <code>onMounted</code>.
    </p>
    <p>
      Para ver a árvore ramificar: vá em <strong>Catálogo → Produto</strong>,
      clique em <strong>← voltar</strong> e então entre em <strong>Checkout</strong>.
    </p>
  </div>
</template>
