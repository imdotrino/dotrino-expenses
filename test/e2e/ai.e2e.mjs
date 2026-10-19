// La IA del usuario, en un navegador de verdad, con el proveedor SIMULADO (se intercepta
// api.openai.com: ninguna llave real ni ninguna llamada sale). Comprueba: guardar la llave
// sellada → la frase la entiende «el modelo» → el formulario enseña su propuesta → el resumen
// en palabras manda solo totales → si el proveedor falla, se dice y se usan las reglas →
// quitar la llave vuelve a las reglas.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ORIGIN = 'https://expenses.dotrino.com'
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

const browser = await chromium.launch()
after(() => browser.close())

test('AI key sealed, sentence read by the model, month described, failure shown', { timeout: 180_000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block', locale: 'es-EC' })
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    let path = new URL(route.request().url()).pathname
    if (!extname(path)) path = '/index.html'
    try {
      const body = await readFile(join(DIST, path))
      return route.fulfill({ status: 200, contentType: TYPES[extname(path)] || 'application/octet-stream', body })
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      return route.fulfill({ status: 404, body: 'not found' })
    }
  })

  // El proveedor simulado. Guarda lo que recibe para comprobar qué salió del navegador.
  const sent = []
  let failNext = false
  await ctx.route('https://api.openai.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const body = JSON.parse(req.postData() || '{}')
    sent.push({ auth: req.headers().authorization, body })
    if (failNext) {
      failNext = false
      return route.fulfill({ status: 401, headers: CORS, body: 'invalid key' })
    }
    const user = body.messages.at(-1).content
    let content = 'ok'
    if (body.response_format) {
      content = JSON.stringify({ amount: '12.30', type: 'expense', category: 'transport', note: 'gasolina', date: '2026-10-02' })
    } else if (/Expenses by category/.test(user)) {
      content = 'Este mes la mayor parte se fue en transporte.'
    }
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content } }] }) })
  })

  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(ORIGIN + '/')
  await page.getByTestId('month-view').waitFor({ timeout: 40_000 })
  assert.match(await page.getByTestId('quick-engine').innerText(), /reglas/)

  // Ajustes → configurar OpenAI con una llave de prueba, probarla y guardarla.
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('ai-edit').click()
  await page.getByTestId('ai-provider').selectOption('openai')
  await page.getByTestId('ai-key').fill('sk-test-123')
  await page.getByTestId('ai-test').click()
  await page.getByTestId('toast').filter({ hasText: 'Funciona' }).waitFor()
  await page.getByTestId('ai-save').click()
  await page.getByTestId('ai-status').filter({ hasText: 'OpenAI' }).waitFor({ timeout: 20_000 })
  assert.equal(sent[0].auth, 'Bearer sk-test-123')

  // La frase la entiende «el modelo»: el formulario enseña SU propuesta.
  await page.getByTestId('tab-month').click()
  assert.match(await page.getByTestId('quick-engine').innerText(), /OpenAI/)
  await page.getByTestId('quick-input').fill('llené el tanque 12.30 el jueves')
  await page.getByTestId('quick-go').click()
  await page.getByTestId('movement-form').waitFor()
  assert.equal(await page.getByTestId('amount').inputValue(), '12.30')
  assert.equal(await page.getByTestId('category').inputValue(), 'transport')
  assert.equal(await page.getByTestId('note').inputValue(), 'gasolina')
  const parseReq = sent.at(-1).body
  assert.equal(parseReq.response_format.type, 'json_schema')
  assert.equal(parseReq.messages.at(-1).content, 'llené el tanque 12.30 el jueves')
  await page.getByTestId('save').click()
  await page.getByTestId('movement-form').waitFor({ state: 'detached' })

  // Si el proveedor falla, se DICE y se usan las reglas.
  failNext = true
  await page.getByTestId('quick-input').fill('almuerzo 4.50')
  await page.getByTestId('quick-go').click()
  await page.getByTestId('toast').filter({ hasText: 'reglas' }).waitFor()
  await page.getByTestId('movement-form').waitFor()
  assert.equal(await page.getByTestId('category').inputValue(), 'food')
  await page.getByTestId('cancel').click()

  // El resumen en palabras: al proveedor van solo totales, no las notas.
  await page.getByTestId('tab-summary').click()
  await page.getByTestId('describe').click()
  await page.getByTestId('description').filter({ hasText: 'transporte' }).waitFor()
  const describeReq = JSON.stringify(sent.at(-1).body)
  assert.doesNotMatch(describeReq, /gasolina|tanque/, 'notes never go to the provider in the summary')
  assert.match(describeReq, /12\.30/)

  // La llave sobrevive a recargar (sellada en el almacén) y se puede quitar.
  // La pestaña abierta sobrevive a la recarga (sessionStorage, CONVENCIONES §4).
  await page.reload()
  await page.getByTestId('summary-view').waitFor({ timeout: 40_000 })
  await page.getByTestId('tab-month').click()
  await page.getByTestId('quick-engine').filter({ hasText: 'OpenAI' }).waitFor({ timeout: 20_000 })
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('ai-edit').click()
  await page.getByTestId('ai-remove').click()
  await page.getByTestId('ai-status').filter({ hasText: 'Sin IA' }).waitFor()

  assert.deepEqual(problems, [])
  await ctx.close()
})
