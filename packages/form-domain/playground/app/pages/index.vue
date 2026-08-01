<script setup lang="ts">
const { data, canShow, options, values, meta, facts, shape, reset } = useFormDomain('justica-federal')

const camposNoSchema = computed(() => Object.keys(shape.value))
</script>

<template>
  <main style="font-family: system-ui; padding: 2rem; display: grid; gap: 1rem; max-width: 46rem">
    <h1>@null-nuxt/form-domain</h1>
    <p style="color:#52525b; font-size:.9rem">
      Este domínio está separado em <code>fields</code>, <code>rules</code>,
      <code>schema</code> e <code>meta</code> — quatro arquivos, um contexto
      compartilhado.
    </p>

    <label>
      {{ data.tipo_pessoa.label }}
      <select v-model="data.tipo_pessoa.value">
        <option value="">
          —
        </option>
        <option value="PF">
          Pessoa Física
        </option>
        <option value="PJ">
          Pessoa Jurídica
        </option>
      </select>
    </label>

    <label v-if="canShow.cpf">
      {{ data.cpf.label }}
      <input v-model="data.cpf.value">
    </label>

    <label v-if="canShow.cnpj">
      {{ data.cnpj.label }}
      <input v-model="data.cnpj.value">
    </label>

    <label v-if="canShow.regiao">
      {{ data.regiao.label }}
      <select v-model="data.regiao.value">
        <option value="">
          —
        </option>
        <option
          v-for="option in options.regiao"
          :key="String(option.value)"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <small style="opacity:.6"> options e validação saem da mesma lista</small>
    </label>

    <FormEcho />

    <div style="display:grid; gap:.4rem; background:#f4f4f5; padding:.8rem; border-radius:.4rem; font-size:.82rem">
      <div><strong>facts</strong>: isPF={{ facts.isPF }} · isPJ={{ facts.isPJ }}</div>
      <div><strong>meta</strong>: {{ meta.sku }} — R$ {{ meta.price.toFixed(2) }}</div>
      <div>
        <strong>carrinho</strong>: {{ meta.resumo }}
        <br>
        <small style="opacity:.6">
          o campo guarda <code>{{ values.regiao || '—' }}</code>; o label vem
          derivado, então acompanha se a lista mudar
        </small>
      </div>
      <div>
        <strong>schema valida</strong>: {{ camposNoSchema.join(', ') || '—' }}
        <br>
        <small style="opacity:.6">campo escondido sai do schema sozinho — nenhum <code>.when()</code> no arquivo</small>
      </div>
    </div>

    <button
      style="justify-self:start"
      @click="reset()"
    >
      reset
    </button>

    <pre style="background: #f4f4f5; padding: 1rem; overflow: auto; font-size:.75rem">{{ values }}</pre>
  </main>
</template>
