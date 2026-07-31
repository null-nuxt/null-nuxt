import { describe, expect, it } from 'vitest'
import { dwellOf, longestNode, occurrencesOf, timeInCurrent } from '../src/runtime/stats'
import type { JourneyNode, JourneySnapshot } from '../src/runtime/types'

const node = (partial: Partial<JourneyNode> & { id: string, at: number }): JourneyNode => ({
  type: 'page_view',
  path: '/',
  url: 'https://exemplo.com.br/',
  ...partial,
})

const AGORA = 10_000

const snapshot: JourneySnapshot = {
  startedAt: 0,
  currentId: 'atual',
  nodes: [
    node({ id: 'curto', at: 1000, dwell: 500, name: 'landing_page' }),
    node({ id: 'longo', at: 2000, dwell: 5000, name: 'catalogo' }),
    node({ id: 'clique1', at: 3000, type: 'click', name: 'add_to_cart' }),
    node({ id: 'clique2', at: 3500, type: 'click', name: 'add_to_cart' }),
    node({ id: 'atual', at: 9000, name: 'checkout' }),
  ],
}

describe('timeInCurrent', () => {
  it('conta desde a entrada no nó atual', () => {
    expect(timeInCurrent(snapshot, AGORA)).toBe(1000)
  })

  it('sem nó atual, devolve zero', () => {
    expect(timeInCurrent({ ...snapshot, currentId: null }, AGORA)).toBe(0)
  })
})

describe('dwellOf', () => {
  it('usa o dwell fechado quando existe', () => {
    expect(dwellOf(snapshot.nodes[1]!, snapshot, AGORA)).toBe(5000)
  })

  it('o nó atual conta o tempo corrente, que ainda não fechou', () => {
    expect(dwellOf(snapshot.nodes[4]!, snapshot, AGORA)).toBe(1000)
  })
})

describe('longestNode', () => {
  it('acha onde o usuário mais ficou', () => {
    expect(longestNode(snapshot, AGORA)?.id).toBe('longo')
  })

  it('o nó atual pode vencer se já passou mais tempo nele', () => {
    const agoraDistante = 20_000
    expect(longestNode(snapshot, agoraDistante)?.id).toBe('atual')
  })

  it('jornada vazia devolve null', () => {
    expect(longestNode({ startedAt: 0, currentId: null, nodes: [] }, AGORA)).toBeNull()
  })
})

describe('occurrencesOf', () => {
  /**
   * Ocorrência é independente de envio: o mesmo slug pode ter acontecido duas
   * vezes e ter sido enviado uma só, dependendo do dedupe do projeto.
   */
  it('conta quantas vezes o evento aconteceu', () => {
    expect(occurrencesOf(snapshot, 'add_to_cart')).toBe(2)
    expect(occurrencesOf(snapshot, 'checkout')).toBe(1)
  })

  it('slug que nunca aconteceu conta zero', () => {
    expect(occurrencesOf(snapshot, 'nunca')).toBe(0)
  })
})
