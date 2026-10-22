// «Por confirmar» en un navegador de verdad: pegar avisos del banco, leerlos con reglas y con la
// IA (simulada: api.openai.com interceptado), aceptar, revisar, descartar, y que un correo ya
// visto no vuelva a entrar.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ORIGIN = 'https://expenses.dotrino.com'
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

const PURCHASE = `Banco Pichincha
Se registró un consumo con tu Tarjeta de Débito terminada en 1234
por USD 25,40 en SUPERMAXI EL JARDIN el 20/10/2026 a las 13:45.
Saldo disponible: USD 1.250,00`
const TRANSFER = 'Produbanco: Transferencia recibida por $150.00 de JUAN PEREZ el 2026-10-19.'
const ATM = 'Retiro en cajero automático por USD 40.00 el 18/10/2026.'
const BALANCE = 'Tu saldo disponible al día de hoy es USD 1.250,00'

const browser = await chromium.launch()
after(() => browser.close())

test('paste bank mails, accept, review, discard; AI reads them when configured', { timeout: 180_000 }, async () => {
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
  const sent = []
  await ctx.route('https://api.openai.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const body = JSON.parse(req.postData() || '{}')
    sent.push(body)
    const content = body.response_format
      ? JSON.stringify({ amount: '40.00', type: 'expense', category: 'other-expense', note: 'Retiro en cajero', date: '2026-10-18', bank: 'Banco de Prueba' })
      : 'ok'
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content } }] }) })
  })

  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(ORIGIN + '/')
  await page.getByTestId('month-view').waitFor({ timeout: 40_000 })
  await page.getByTestId('tab-inbox').click()
  await page.getByTestId('inbox-empty').waitFor()

  const paste = async (text) => {
    await page.getByTestId('mail-paste').fill(text)
    await page.getByTestId('mail-read').click()
  }

  // Un aviso de saldo no es un movimiento.
  await paste(BALANCE)
  await page.getByTestId('mail-problem').filter({ hasText: 'No encontré' }).waitFor()

  // Un consumo y una transferencia, con reglas.
  await paste(PURCHASE)
  await page.getByTestId('inbox-item').first().waitFor()
  await paste(TRANSFER)
  await page.getByTestId('inbox-item').nth(1).waitFor()
  assert.equal(await page.getByTestId('inbox-count').innerText(), '2')
  const amounts = await page.getByTestId('inbox-amount').allInnerTexts()
  assert.ok(amounts.some((a) => a.includes('25,40') && a.startsWith('-')), amounts.join(' | '))
  assert.ok(amounts.some((a) => a.includes('150,00') && a.startsWith('+')), amounts.join(' | '))

  // El mismo correo no entra dos veces.
  await paste(PURCHASE)
  await page.getByTestId('mail-problem').filter({ hasText: 'ya está en la bandeja' }).waitFor()

  // Aceptar el consumo: va al mes de octubre.
  const purchase = page.getByTestId('inbox-item').filter({ hasText: 'SUPERMAXI' })
  await page.locator('li').filter({ has: purchase }).getByTestId('inbox-accept').click()
  await page.getByTestId('inbox-item').filter({ hasText: 'SUPERMAXI' }).waitFor({ state: 'detached' })
  await paste(PURCHASE)
  await page.getByTestId('mail-problem').filter({ hasText: 'ya lo aceptaste' }).waitFor()

  // Revisar la transferencia: cambiar el importe antes de guardarla.
  const transfer = page.locator('li').filter({ has: page.getByTestId('inbox-item').filter({ hasText: 'JUAN PEREZ' }) })
  await transfer.getByTestId('inbox-show').click()
  assert.match(await page.getByTestId('inbox-excerpt').innerText(), /Transferencia recibida/)
  await transfer.getByTestId('inbox-review').click()
  await page.getByTestId('movement-form').waitFor()
  await page.getByTestId('amount').fill('155.00')
  await page.getByTestId('save').click()
  await page.getByTestId('movement-form').waitFor({ state: 'detached' })
  await page.getByTestId('inbox-empty').waitFor()

  // En el mes: los dos, con lo corregido.
  await page.getByTestId('tab-month').click()
  await page.getByTestId('movement').filter({ hasText: 'SUPERMAXI' }).waitFor({ timeout: 20_000 })
  const monthAmounts = await page.getByTestId('movement-amount').allInnerTexts()
  assert.ok(monthAmounts.some((a) => a.includes('155,00')), monthAmounts.join(' | '))

  // Con la IA: el correo lo lee el modelo; descartarlo no lo anota.
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('ai-edit').click()
  await page.getByTestId('ai-provider').selectOption('openai')
  await page.getByTestId('ai-key').fill('sk-test-123')
  await page.getByTestId('ai-save').click()
  await page.getByTestId('ai-status').filter({ hasText: 'OpenAI' }).waitFor({ timeout: 20_000 })
  await page.getByTestId('tab-inbox').click()
  await page.getByTestId('mail-ai-note').waitFor()
  await paste(ATM)
  await page.getByTestId('inbox-item').filter({ hasText: 'Banco de Prueba' }).waitFor()
  assert.match(await page.getByTestId('inbox-item').innerText(), /leído por tu IA/)
  assert.match(sent.at(-1).messages.at(-1).content, /Retiro en cajero/)
  await page.getByTestId('inbox-discard').click()
  await page.getByTestId('inbox-empty').waitFor()
  await paste(ATM)
  await page.getByTestId('mail-problem').filter({ hasText: 'ya lo descartaste' }).waitFor()

  assert.deepEqual(problems, [])
  await ctx.close()
})
