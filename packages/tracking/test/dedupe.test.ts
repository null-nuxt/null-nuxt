import { describe, expect, it } from 'vitest'
import { dedupeKeyFor } from '../src/runtime/dedupe'

const URL_A = 'https://exemplo.com.br/produto?src=campanha-a'
const URL_B = 'https://exemplo.com.br/produto?src=campanha-b'
const PATH = '/produto'

describe('escopo por página', () => {
  /**
   * O caso que motivou `name-path`: o próprio módulo escreve `?src=` na URL ao
   * propagar atribuição. Com escopo por URL, a mesma página vinda de duas
   * campanhas gravaria duas linhas no banco.
   */
  it('mesma página com query diferente gera a MESMA chave', () => {
    expect(dedupeKeyFor('checkout', true, 'name-path', URL_A, PATH))
      .toBe(dedupeKeyFor('checkout', true, 'name-path', URL_B, PATH))
  })

  it('páginas diferentes geram chaves diferentes', () => {
    expect(dedupeKeyFor('form', true, 'name-path', URL_A, '/a'))
      .not.toBe(dedupeKeyFor('form', true, 'name-path', URL_A, '/b'))
  })

  it('`per-page` por chamada ignora o escopo global', () => {
    expect(dedupeKeyFor('checkout', 'per-page', 'name', URL_A, PATH))
      .toBe(`checkout@${PATH}`)
  })
})

describe('escopo por URL', () => {
  it('query diferente gera chaves diferentes', () => {
    expect(dedupeKeyFor('checkout', true, 'name-url', URL_A, PATH))
      .not.toBe(dedupeKeyFor('checkout', true, 'name-url', URL_B, PATH))
  })

  it('`per-url` por chamada ignora o escopo global', () => {
    expect(dedupeKeyFor('checkout', 'per-url', 'name-path', URL_A, PATH))
      .toBe(`checkout@${URL_A}`)
  })
})

describe('escopo por nome', () => {
  it('ignora página e query', () => {
    expect(dedupeKeyFor('landing_page', true, 'name', URL_A, '/a'))
      .toBe(dedupeKeyFor('landing_page', true, 'name', URL_B, '/b'))
  })
})
