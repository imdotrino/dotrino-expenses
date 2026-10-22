// Los recordatorios en un navegador de verdad: lo que vence sale arriba del mes y se va al
// confirmarlo; la tarjeta de Ajustes está y, apagada, no programa nada.

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

const browser = await chromium.launch()
after(() => browser.close())

test('due items show above the month and leave when confirmed', { timeout: 120_000 }, async () => {
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
  const proxyTouched = []
  ctx.on('websocket', (ws) => { if (/proxy\.dotrino\.com/.test(ws.url())) proxyTouched.push(ws.url()) })
  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(ORIGIN + '/')
  await page.getByTestId('month-view').waitFor({ timeout: 40_000 })
  assert.equal(await page.getByTestId('due-banner').count(), 0)

  // Una regla que cae HOY.
  const today = await page.evaluate(() => new Date().getDate())
  await page.getByTestId('tab-recurring').click()
  await page.getByTestId('rule-add').click()
  await page.getByTestId('rule-name').fill('Netflix')
  await page.getByTestId('rule-amount').fill('9.99')
  await page.getByTestId('rule-day').fill(String(today))
  await page.getByTestId('rule-category').selectOption('subscriptions')
  await page.getByTestId('rule-save').click()
  await page.getByTestId('rule').waitFor()

  await page.getByTestId('tab-month').click()
  const item = page.getByTestId('due-item').filter({ hasText: 'Netflix' })
  await item.waitFor()
  assert.match(await item.innerText(), /9,99 · hoy/)
  await item.click()
  assert.match(await page.getByTestId('day-title').innerText(), new RegExp(String(today)))
  await page.getByTestId('confirm').click()
  await page.getByTestId('due-banner').waitFor({ state: 'detached' })

  // Ajustes: la tarjeta está, apagada, y sin encenderla nadie habla con el proxio.
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('reminders-card').waitFor()
  assert.equal(await page.getByTestId('reminders-push').isChecked(), false)
  assert.deepEqual(proxyTouched.filter((u) => !/store|id\./.test(u)), [], 'reminders off: no proxy connection for them')

  assert.deepEqual(problems, [])
  await ctx.close()
})
