import { useState } from '#imports'

export interface SinkEntry {
  trigger: string
  quando: string
  corpo: unknown
}

/** Só pra demo: guarda o que o sink resolveu mandar, pra mostrar na tela. */
export const useSinkLog = () => useState<SinkEntry[]>('sink-log', () => [])
