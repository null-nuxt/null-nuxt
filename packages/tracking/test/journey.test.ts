import { describe, expect, it } from 'vitest'
import { createJourney, memoryStorage } from '../src/runtime/journey'
import type { TrackingStorage } from '../src/runtime/types'

let clock = 0
let counter = 0

const build = (storage: TrackingStorage = memoryStorage(), maxNodes = 100) => {
  clock = 1000
  counter = 0
  return createJourney({
    storage,
    maxNodes,
    now: () => (clock += 100),
    createId: () => `n${++counter}`,
  })
}

const page = (path: string, position: number) => ({
  path,
  url: `https://exemplo.com.br${path}`,
  position,
})

describe('encadeamento', () => {
  it('encadeia navegações em sequência', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    journey.visit(page('/b', 1))

    const { nodes } = journey.snapshot()
    expect(nodes.map(n => n.path)).toEqual(['/a', '/b'])
    expect(nodes[1]?.parent).toBe(nodes[0]?.id)
  })

  it('primeiro nó não tem pai', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    expect(journey.snapshot().nodes[0]?.parent).toBeUndefined()
  })

  it('preenche o dwell do nó ao sair dele', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    journey.visit(page('/b', 1))

    const [primeiro, segundo] = journey.snapshot().nodes
    expect(primeiro?.dwell).toBe(100)
    expect(segundo?.dwell).toBeUndefined()
  })
})

describe('ramificação ao voltar', () => {
  /**
   * O motivo de ser árvore e não lista: dá pra ver que o usuário tentou um
   * caminho, voltou e seguiu por outro.
   */
  it('voltar reaproveita o nó em vez de criar outro', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    journey.visit(page('/b', 1))
    journey.visit(page('/a', 0))

    expect(journey.snapshot().nodes).toHaveLength(2)
    expect(journey.current?.path).toBe('/a')
  })

  it('navegar depois de voltar cria um ramo irmão', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    journey.visit(page('/b', 1))
    journey.visit(page('/a', 0))
    journey.visit(page('/c', 1))

    const { nodes } = journey.snapshot()
    const raiz = nodes.find(n => n.path === '/a')
    const filhos = nodes.filter(n => n.parent === raiz?.id)

    expect(filhos.map(n => n.path).sort()).toEqual(['/b', '/c'])
  })

  it('avançar pra mesma rota sem voltar cria nó novo', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    journey.visit(page('/b', 1))
    journey.visit(page('/a', 2))

    expect(journey.snapshot().nodes).toHaveLength(3)
  })
})

describe('eventos folha', () => {
  it('clique pendura no nó atual sem virar o atual', () => {
    const journey = build()
    journey.visit(page('/a', 0))
    const clique = journey.record({ type: 'click', path: '/a', url: 'u', name: 'add_to_cart' })

    expect(clique.parent).toBe(journey.current?.id)
    expect(journey.current?.type).toBe('page_view')
  })
})

describe('persistência', () => {
  it('restaura a jornada de um storage anterior', () => {
    const storage = memoryStorage()
    const primeira = build(storage)
    primeira.visit(page('/a', 0))
    primeira.visit(page('/b', 1))

    const segunda = build(storage)
    segunda.restore()

    expect(segunda.snapshot().nodes.map(n => n.path)).toEqual(['/a', '/b'])
    expect(segunda.current?.path).toBe('/b')
  })

  it('storage corrompido não derruba o tracking', () => {
    const storage: TrackingStorage = { read: () => '{lixo', write: () => {} }
    const journey = build(storage)
    expect(() => journey.restore()).not.toThrow()
    expect(journey.snapshot().nodes).toEqual([])
  })

  it('storage que lança na escrita não derruba a navegação', () => {
    const storage: TrackingStorage = {
      read: () => null,
      write: () => {
        throw new Error('storage cheio')
      },
    }
    const journey = build(storage)

    expect(() => journey.visit(page('/a', 0))).not.toThrow()
    // sem persistir, mas a jornada continua válida em memória
    expect(journey.snapshot().nodes).toHaveLength(1)
  })
})

describe('teto de nós', () => {
  it('descarta os mais antigos e não deixa pai órfão', () => {
    const journey = build(memoryStorage(), 3)
    for (let i = 0; i < 6; i++) journey.visit(page(`/p${i}`, i))

    const { nodes } = journey.snapshot()
    const ids = new Set(nodes.map(n => n.id))

    expect(nodes).toHaveLength(3)
    expect(nodes.every(n => !n.parent || ids.has(n.parent))).toBe(true)
  })
})
