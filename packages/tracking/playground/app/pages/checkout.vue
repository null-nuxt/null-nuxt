<script setup lang="ts">
definePageMeta({ track: 'checkout' })

const { track } = useTracking()

/**
 * Evento de negócio é chamada imperativa, depois da validação — não diretiva
 * no botão. Clique que morre na validação não é tentativa de pagamento.
 */
const pagar = async (metodo: 'pix' | 'credit') => {
  const valido = true
  if (!valido) return
  await track('payment_tried', { target: metodo })
}
</script>

<template>
  <div>
    <h1>Checkout</h1>
    <p>
      Aqui o evento é imperativo, dentro do handler, depois da validação —
      é a diferença entre "clicou no botão" e "tentou pagar".
    </p>

    <button @click="pagar('pix')">
      pagar com pix
    </button>
    <button @click="pagar('credit')">
      pagar com cartão
    </button>
  </div>
</template>
