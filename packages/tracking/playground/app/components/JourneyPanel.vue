<script lang="ts" setup>
import type { JourneyNode } from '#tracking'

type TreeNode = JourneyNode & { children: TreeNode[] }

const { journey, resetJourney, flush, consent, setConsent, stats, sendsVersion } = useTracking()
const sinkLog = useSinkLog()

/**
 * Relógio próprio: o tempo no nó atual muda sozinho, sem novo evento — sem
 * isto o número ficaria congelado até a próxima navegação.
 */
const agora = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (agora.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const resumo = computed(() => {
  void agora.value
  void journey.value
  void sendsVersion.value

  const longest = stats.longest()

  return {
    atual: stats.current()?.name ?? '—',
    tempoAtual: (stats.timeInCurrent() / 1000).toFixed(0),
    maisTempo: longest?.name ?? '—',
    maisTempoDwell: longest ? (stats.dwellOf(longest) / 1000).toFixed(0) : '0',
    ocorrenciasCarrinho: stats.occurrences('add_to_cart'),
    enviosCarrinho: stats.sends('add_to_cart'),
    totalEnvios: stats.totalSends(),
  }
})

/** Monta a árvore a partir dos ponteiros `parent`. */
const roots = computed<TreeNode[]>(() => {
  const byId = new Map<string, TreeNode>(
    journey.value.nodes.map(node => [node.id, { ...node, children: [] }]),
  )

  const result: TreeNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent ? byId.get(node.parent) : undefined
    if (parent) parent.children.push(node)
    else result.push(node)
  }
  return result
})

const total = computed(() => journey.value.nodes.length)
const ramificou = computed(() =>
  [...roots.value].some(function branchy(node): boolean {
    return node.children.length > 1 || node.children.some(branchy)
  }),
)
</script>

<template>
  <aside class="panel">
    <header>
      <h2>Árvore de navegação</h2>
      <span class="count">{{ total }} nós</span>
    </header>

    <p
      v-if="!total"
      class="hint"
    >
      Navegue pelas páginas acima. Depois <strong>volte no browser</strong> e
      siga por outro caminho — é aí que a árvore ramifica.
    </p>

    <p
      v-else-if="!ramificou"
      class="hint"
    >
      Até aqui é uma trilha reta. Use <strong>voltar</strong> e vá pra outra
      página pra ver o ramo aparecer.
    </p>

    <p
      v-else
      class="hint ok"
    >
      Ramificou — o nó com dois filhos é onde o usuário voltou e tentou outro caminho.
    </p>

    <JourneyBranch
      v-if="total"
      :nodes="roots"
      :current-id="journey.currentId"
    />

    <dl
      v-if="total"
      class="stats"
    >
      <div>
        <dt>evento atual</dt>
        <dd>{{ resumo.atual }} <small>há {{ resumo.tempoAtual }}s</small></dd>
      </div>
      <div>
        <dt>onde ficou mais</dt>
        <dd>{{ resumo.maisTempo }} <small>{{ resumo.maisTempoDwell }}s</small></dd>
      </div>
      <div class="destaque">
        <dt>add_to_cart</dt>
        <dd>
          ocorreu <strong>{{ resumo.ocorrenciasCarrinho }}×</strong> ·
          enviado <strong>{{ resumo.enviosCarrinho }}×</strong>
        </dd>
      </div>
      <div>
        <dt>envios no total</dt>
        <dd>{{ resumo.totalEnvios }}</dd>
      </div>
    </dl>

    <p
      v-if="total && resumo.ocorrenciasCarrinho !== resumo.enviosCarrinho"
      class="hint ok"
    >
      Repare: ocorreu {{ resumo.ocorrenciasCarrinho }}× e foi enviado
      {{ resumo.enviosCarrinho }}×. São perguntas diferentes — o dedupe corta o
      envio, nunca o registro.
    </p>

    <div class="actions">
      <button @click="resetJourney()">
        limpar árvore
      </button>
      <button @click="flush('unload')">
        disparar sink de unload
      </button>
      <button @click="setConsent(!consent)">
        consent: {{ consent ? 'on' : 'off' }}
      </button>
    </div>

    <section v-if="sinkLog.length">
      <h3>O que o sink decidiu mandar</h3>
      <pre>{{ sinkLog[sinkLog.length - 1] }}</pre>
      <small>{{ sinkLog.length }} disparo(s)</small>
    </section>
  </aside>
</template>

<style scoped>
.panel {
  border: 1px solid #e4e4e7;
  border-radius: .6rem;
  padding: 1rem;
  background: #fff;
}
header { display: flex; justify-content: space-between; align-items: baseline; }
h2 { font-size: 1rem; margin: 0 0 .6rem; }
h3 { font-size: .8rem; margin: 1rem 0 .3rem; opacity: .7; }
.count { font-size: .78rem; opacity: .5; }
.hint {
  font-size: .8rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: .4rem;
  padding: .5rem .6rem;
  margin: 0 0 .7rem;
}
.hint.ok { background: #ecfdf5; border-color: #a7f3d0; }
.stats {
  margin: .9rem 0 0;
  display: grid;
  gap: .35rem;
  font-size: .78rem;
}
.stats div {
  display: flex;
  justify-content: space-between;
  gap: .6rem;
  padding: .3rem .5rem;
  background: #fafafa;
  border-radius: .3rem;
}
.stats .destaque { background: #eef2ff; }
.stats dt { opacity: .6; margin: 0; }
.stats dd { margin: 0; text-align: right; }
.stats small { opacity: .5; }
.actions { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: .9rem; }
button {
  font-size: .78rem;
  padding: .3rem .6rem;
  border: 1px solid #d4d4d8;
  border-radius: .35rem;
  background: #fafafa;
  cursor: pointer;
}
pre {
  background: #18181b;
  color: #e4e4e7;
  padding: .6rem;
  border-radius: .4rem;
  font-size: .7rem;
  overflow: auto;
  max-height: 12rem;
}
small { opacity: .5; font-size: .7rem; }
</style>
