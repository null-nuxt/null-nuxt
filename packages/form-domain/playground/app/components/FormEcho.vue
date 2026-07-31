<script setup lang="ts">
import useJusticaFederalForm from '../forms/justica-federal';

/**
 * Sub-componente do mesmo domínio: consome a instância sem receber prop nenhuma
 * e sem registrar os watchers de novo.
 */
const { values, canShow } = useJusticaFederalForm()
</script>

<template>
  <div style="border-left: 3px solid #ddd; padding-left: .75rem; font-size: .875rem">
    <strong>sub-componente</strong> — tipo: {{ values.tipo_pessoa || '—' }} |
    mostra cpf: {{ canShow.cpf }}
  </div>
</template>
