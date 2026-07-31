import { describe, expect, it } from 'vitest'
import { createSendLedger } from '../src/runtime/ledger'
import { memoryStorage } from '../src/runtime/journey'
import type { TrackingStorage } from '../src/runtime/types'

const build = (storage: TrackingStorage = memoryStorage()) => createSendLedger({ storage })

describe('dedupe', () => {
  it('chave nova passa; repetida não', () => {
    const ledger = build()
    expect(ledger.isNew('add_to_cart@/loja')).toBe(true)

    ledger.record('add_to_cart@/loja', 'add_to_cart')
    expect(ledger.isNew('add_to_cart@/loja')).toBe(false)
  })

  it('chaves diferentes do mesmo slug são independentes', () => {
    const ledger = build()
    ledger.record('add_to_cart@/a', 'add_to_cart')

    expect(ledger.isNew('add_to_cart@/b')).toBe(true)
    expect(ledger.sends('add_to_cart')).toBe(1)
  })
})

describe('contagem de envios', () => {
  /**
   * O que o ledger antigo não respondia: ele guardava só "já vi esta chave",
   * então dava pra deduplicar mas não dava pra dizer quantos envios saíram.
   */
  it('conta envios por slug, somando chaves diferentes', () => {
    const ledger = build()
    ledger.record('checkout@/a', 'checkout')
    ledger.record('checkout@/b', 'checkout')
    ledger.record('add_to_cart@/a', 'add_to_cart')

    expect(ledger.sends('checkout')).toBe(2)
    expect(ledger.sends('add_to_cart')).toBe(1)
    expect(ledger.total()).toBe(3)
  })

  it('slug nunca enviado conta zero', () => {
    expect(build().sends('nunca')).toBe(0)
  })

  /**
   * Com dedupe desligado não há chave de corte, mas o envio ACONTECEU e precisa
   * ser contado — senão `stats.sends()` fica zerado justamente em quem manda
   * todo evento.
   */
  it('sem chave de dedupe o envio continua sendo contado', () => {
    const ledger = build()
    ledger.record(null, 'payment_tried')
    ledger.record(null, 'payment_tried')

    expect(ledger.sends('payment_tried')).toBe(2)
    expect(ledger.total()).toBe(2)
  })

  it('sem chave, nada é bloqueado depois', () => {
    const ledger = build()
    ledger.record(null, 'payment_tried')
    expect(ledger.isNew('payment_tried')).toBe(true)
  })
})

describe('rollback', () => {
  it('desfaz o envio e libera a chave pro retry', () => {
    const ledger = build()
    ledger.record('checkout@/a', 'checkout')
    ledger.rollback('checkout@/a', 'checkout')

    expect(ledger.isNew('checkout@/a')).toBe(true)
    expect(ledger.sends('checkout')).toBe(0)
  })

  it('não deixa contagem negativa', () => {
    const ledger = build()
    ledger.rollback('nunca@/a', 'nunca')
    expect(ledger.sends('nunca')).toBe(0)
  })
})

describe('persistência', () => {
  it('restaura as contagens de uma sessão anterior', () => {
    const storage = memoryStorage()
    const primeiro = build(storage)
    primeiro.record('checkout@/a', 'checkout')
    primeiro.record('checkout@/b', 'checkout')

    const segundo = build(storage)
    segundo.restore()

    expect(segundo.sends('checkout')).toBe(2)
    expect(segundo.isNew('checkout@/a')).toBe(false)
  })

  it('storage corrompido começa limpo em vez de explodir', () => {
    const storage: TrackingStorage = { read: () => 'não é json', write: () => {} }
    const ledger = build(storage)

    expect(() => ledger.restore()).not.toThrow()
    expect(ledger.total()).toBe(0)
  })

  it('storage que lança na escrita não derruba o envio', () => {
    const storage: TrackingStorage = {
      read: () => null,
      write: () => {
        throw new Error('cheio')
      },
    }
    const ledger = build(storage)

    expect(() => ledger.record('a', 'a')).not.toThrow()
    expect(ledger.sends('a')).toBe(1)
  })
})
