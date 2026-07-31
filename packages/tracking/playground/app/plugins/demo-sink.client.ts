/**
 * É isto que o projeto escreve pra assumir o envio: escolhe o gatilho e projeta
 * do snapshot só o que o backend dele quer. O core não opina no formato.
 */
export default defineNuxtPlugin(() => {
  const log = useSinkLog()

  addTrackingSink(defineTrackingSink({
    name: 'demo',
    on: ['event', 'unload'],
    send: (snapshot, node) => {
      const corpo = {
        visitante: snapshot.cookieId.slice(0, 8),
        origem: snapshot.source,
        dispositivo: snapshot.device,
        evento: node ? { tipo: node.type, nome: node.name, alvo: node.target } : null,
        caminho: snapshot.journey.nodes
          .filter(item => item.type === 'page_view')
          .map(item => item.path),
        nos: snapshot.journey.nodes.length,
      }

      log.value = [...log.value, {
        trigger: node ? 'event' : 'unload',
        quando: new Date().toLocaleTimeString('pt-BR'),
        corpo,
      }]
    },
  }))
})
