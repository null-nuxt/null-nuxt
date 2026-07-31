import { describe, expect, it } from 'vitest'
import { builtinTypes, defineTracking, resolveEventType } from '../src/runtime/events'

const definition = defineTracking({
  types: {
    conversao: { target: 'optional' },
    engajamento: { target: 'required', minDwell: 1000 },
  },
  events: {
    landing_page: 'page_view',
    add_to_cart: 'click',
    plano_destacado: 'hover',
    payment_tried: 'conversao',
    leu_secao: 'engajamento',
  },
})

describe('tipos embutidos', () => {
  it('page_view proíbe alvo e click exige', () => {
    expect(builtinTypes.page_view.target).toBe('never')
    expect(builtinTypes.click.target).toBe('required')
  })

  /**
   * O limiar não é opcional por decisão de projeto: hover sem dwell mínimo
   * dispara a cada passada de mouse e inunda o backend.
   */
  it('hover já vem com limiar de permanência', () => {
    expect(builtinTypes.hover.minDwell).toBeGreaterThan(0)
  })
})

describe('resolveEventType', () => {
  it('resolve slug de tipo embutido', () => {
    expect(resolveEventType(definition, 'add_to_cart')).toEqual(builtinTypes.click)
  })

  it('resolve slug de tipo personalizado', () => {
    expect(resolveEventType(definition, 'payment_tried')).toEqual({ target: 'optional' })
  })

  it('tipo personalizado pode definir o próprio limiar', () => {
    expect(resolveEventType(definition, 'leu_secao')?.minDwell).toBe(1000)
  })

  it('slug desconhecido devolve undefined em vez de explodir', () => {
    expect(resolveEventType(definition, 'nao_registrado')).toBeUndefined()
  })
})

describe('defineTracking', () => {
  it('preserva os slugs e normaliza types ausente', () => {
    const semTipos = defineTracking({ events: { landing_page: 'page_view' } })
    expect(semTipos.types).toEqual({})
    expect(Object.keys(semTipos.events)).toEqual(['landing_page'])
  })
})
