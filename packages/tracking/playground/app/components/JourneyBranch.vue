<script lang="ts" setup>
import type { JourneyNode } from '#tracking'

type TreeNode = JourneyNode & { children: TreeNode[] }

defineProps<{
  nodes: TreeNode[]
  currentId: string | null
}>()

const icon = (type: JourneyNode['type']) =>
  type === 'page_view' ? '▸' : type === 'click' ? '·' : '◆'
</script>

<template>
  <ul class="branch">
    <li
      v-for="node in nodes"
      :key="node.id"
    >
      <span
        class="node"
        :class="[node.type, { current: node.id === currentId }]"
      >
        <span class="icon">{{ icon(node.type) }}</span>
        <strong>{{ node.name ?? node.type }}</strong>
        <code v-if="node.type === 'page_view'">{{ node.path }}</code>
        <em v-if="node.target">→ {{ node.target }}</em>
        <span
          v-if="node.dwell !== undefined"
          class="dwell"
        >{{ (node.dwell / 1000).toFixed(1) }}s</span>
        <span
          v-if="node.id === currentId"
          class="badge"
        >aqui</span>
      </span>

      <!-- recursivo: a ramificação é o que faz a árvore valer a pena -->
      <JourneyBranch
        v-if="node.children.length"
        :nodes="node.children"
        :current-id="currentId"
      />
    </li>
  </ul>
</template>

<style scoped>
.branch {
  list-style: none;
  margin: 0;
  padding-left: 1.1rem;
  border-left: 1px solid #d4d4d8;
}
.branch > li { margin: .3rem 0; }
.node {
  display: inline-flex;
  gap: .4rem;
  align-items: baseline;
  padding: .2rem .5rem;
  border-radius: .35rem;
  font-size: .82rem;
}
.node.page_view { background: #eef2ff; }
.node.click { background: #f4f4f5; }
.node.event { background: #ecfdf5; }
.node.current { outline: 2px solid #6366f1; }
.icon { opacity: .5; }
code { font-size: .78rem; opacity: .7; }
em { font-style: normal; opacity: .65; }
.dwell { opacity: .5; font-variant-numeric: tabular-nums; }
.badge {
  background: #6366f1;
  color: #fff;
  border-radius: .25rem;
  padding: 0 .35rem;
  font-size: .7rem;
}
</style>
