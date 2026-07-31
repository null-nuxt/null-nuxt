/** Espelho local do endpoint real: só ecoa o corpo pra conferir o wire format. */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  console.log('[playground] POST /api/tracking-pages', JSON.stringify(body, null, 2))
  return { ok: true }
})
