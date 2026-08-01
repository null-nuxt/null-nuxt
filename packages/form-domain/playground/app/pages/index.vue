<script setup lang="ts">
const { fields: campos, canShow, options, values, payload, shape, reset, isPF, sku, price, resumo } = useFormDomain('justica-federal')

const camposNoSchema = computed(() => Object.keys(shape.value))
</script>

<template>
  <main style="font-family: system-ui; padding: 2rem; display: grid; gap: 1rem; max-width: 46rem">
    <h1>@null-nuxt/form-domain</h1>
    <p style="color:#52525b; font-size:.9rem">
      Este domínio é um setup: os campos num arquivo, e cada bloco — documento,
      região — dono da própria regra e da própria validação.
    </p>

    <label>
      {{ campos.tipoPessoa.label }}
      <select v-model="campos.tipoPessoa.value">
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
      {{ campos.cpf.label }}
      <input v-model="campos.cpf.value">
    </label>

    <label v-if="canShow.cnpj">
      {{ campos.cnpj.label }}
      <input v-model="campos.cnpj.value">
    </label>

    <label v-if="canShow.regiao">
      {{ campos.regiao.label }}
      <select v-model="campos.regiao.value">
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
      <div><strong>derivados</strong>: isPF={{ isPF }} · sku={{ sku }}</div>
      <div><strong>preço</strong>: R$ {{ price.toFixed(2) }}</div>
      <div>
        <strong>carrinho</strong>: {{ resumo }}
        <br>
        <small style="opacity:.6">
          o campo guarda <code>{{ values.regiao || '—' }}</code>; o label vem
          derivado, então acompanha se a lista mudar
        </small>
      </div>
      <div>
        <strong>payload</strong>: <code>{{ payload }}</code>
        <br>
        <small style="opacity:.6">
          projeção do formulário: o texto da região entra aqui sem existir um
          campo pra ele, e o documento escondido fica de fora
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
