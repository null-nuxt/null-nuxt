import { describe, expect, it } from 'vitest'
import { rawPreset, trackingPagesPreset } from '../src/runtime/presets'
import { detectDevice, readSourceParam } from '../src/runtime/context'
import type { TrackContext } from '../src/runtime/types'

const payload = trackingPagesPreset.payload

const context: TrackContext = {
  event: 'click',
  name: 'add_to_cart',
  target: 'pix',
  url: 'https://exemplo.com.br/certidao/civil',
  device: 'mobile',
  source: 'campanha-x',
  cookieId: 'cuid-123',
  language: 'pt-BR',
  userAgent: 'mozilla/5.0 iphone',
}

describe('convenções por preset', () => {
  /**
   * O ponto de desacoplar: convenção de backend legado não pode virar default
   * global e contaminar projeto novo de outra empresa.
   */
  it('tracking-pages carrega as convenções legadas', () => {
    expect(trackingPagesPreset.defaults).toEqual({
      endpoint: '/tracking-pages',
      queryParams: ['src', 'source'],
      directPrefix: 'acesso-direto-',
      dedupe: 'name',
    })
  })

  it('raw não herda nenhuma convenção legada', () => {
    expect(rawPreset.defaults.directPrefix).not.toBe('acesso-direto-')
    expect(rawPreset.defaults.endpoint).not.toBe('/tracking-pages')
  })
})

describe('preset tracking-pages', () => {
  /**
   * Este teste é o contrato com o backend, que não podemos mudar. Se ele quebrar,
   * o payload mudou de forma e o servidor vai receber lixo.
   */
  it('produz exatamente o wire format legado', () => {
    expect(payload(context)).toEqual({
      source: 'campanha-x',
      target: 'pix',
      url: 'https://exemplo.com.br/certidao/civil',
      event: 'click',
      track: 'add_to_cart',
      cookieId: 'cuid-123',
      device: 'mobile',
      metadata: {
        language: 'pt-BR',
        userAgent: 'mozilla/5.0 iphone',
      },
    })
  })

  it('manda `name` no campo `track` e não vaza `name`', () => {
    const body = payload(context) as Record<string, unknown>
    expect(body.track).toBe('add_to_cart')
    expect(body).not.toHaveProperty('name')
  })

  it('omite target quando não informado', () => {
    const body = payload({ ...context, target: undefined }) as Record<string, unknown>
    expect(body.target).toBeUndefined()
  })
})

describe('detectDevice', () => {
  it.each([
    ['mozilla/5.0 (iphone; cpu iphone os 17_0)', 'mobile'],
    ['mozilla/5.0 (linux; android 14)', 'mobile'],
    ['mozilla/5.0 (macintosh; intel mac os x 10_15_7)', 'desktop'],
  ])('%s → %s', (userAgent, expected) => {
    expect(detectDevice(userAgent)).toBe(expected)
  })
})

describe('readSourceParam', () => {
  it('pega o primeiro param configurado que existir', () => {
    expect(readSourceParam('?source=b', ['src', 'source'])).toBe('b')
    expect(readSourceParam('?src=a&source=b', ['src', 'source'])).toBe('a')
  })

  it('devolve null sem atribuição', () => {
    expect(readSourceParam('?utm_medium=cpc', ['src', 'source'])).toBeNull()
  })
})
