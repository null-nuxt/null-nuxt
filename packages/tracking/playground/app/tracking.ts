/**
 * Fonte única dos eventos do projeto. Daqui saem o metadado de runtime E os
 * tipos — não existe `.d.ts` escrito à mão em lugar nenhum.
 */
import { defineTracking } from '#tracking'

export default defineTracking({
  types: {
    // tipo personalizado: alvo opcional
    conversao: { target: 'optional' },
  },

  events: {
    // page_view → alvo proibido
    landing_page: 'page_view',
    catalogo: 'page_view',
    produto: 'page_view',
    checkout: 'page_view',

    // click → alvo obrigatório
    add_to_cart: 'click',

    // hover → alvo obrigatório e só dispara após 400ms parado
    plano_destacado: 'hover',

    // conversao → alvo opcional
    payment_tried: 'conversao',
  },
})
