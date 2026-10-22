// El dictado en Expenses, en un Chromium con un micrófono falso que «dice»
// test/fixtures/es.wav («Almuerzo, cuatro dólares con cincuenta»).
//   1. Apagado: no hay micrófono.
//   2. En este aparato: baja el modelo de verdad (~77 MB, huggingface.co), transcribe aquí y
//      la frase se entiende con las reglas.
//   3. Con tu IA: el audio va al proveedor SIMULADO (api.openai.com interceptado).

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ORIGIN = 'https://expenses.dotrino.com'
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url))
const WAV = fileURLToPath(new URL('../fixtures/es.wav', import.meta.url))
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`],
})
after(() => browser.close())

async function speak (page, ms = 4500) {
  const btn = page.getByTestId('dictation-button')
  await btn.click()
  await page.locator('dotrino-dictation[state="recording"]').waitFor()
  await page.waitForTimeout(ms)
  await btn.click()
}

test('dictation: off, on this device, with the user AI', { timeout: 600_000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block', locale: 'es-EC', permissions: ['microphone'] })
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
    const url = new URL(req.url()).pathname
    sent.push({ url, size: (req.postDataBuffer() || Buffer.alloc(0)).length })
    if (url.endsWith('/audio/transcriptions')) {
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Taxi, tres dólares con veinte.' }) })
    }
    const content = url.endsWith('/chat/completions') && JSON.parse(req.postData()).response_format
      ? JSON.stringify({ amount: '3.20', type: 'expense', category: 'transport', note: 'taxi', date: '2026-10-21' })
      : 'ok'
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content } }] }) })
  })

  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(ORIGIN + '/')
  await page.getByTestId('month-view').waitFor({ timeout: 40_000 })

  // 1. Apagado por defecto: no hay micrófono.
  assert.equal(await page.getByTestId('dictation').count(), 0)

  // 2. En este aparato. «Con tu IA» se ve, deshabilitado, porque no hay IA.
  await page.getByTestId('tab-settings').click()
  assert.equal(await page.getByTestId('dictation-provider').isDisabled(), true)
  await page.getByTestId('dictation-local').click()
  await page.getByTestId('dictation-help').filter({ hasText: 'huggingface.co' }).waitFor()
  await page.getByTestId('tab-month').click()
  const btn = page.getByTestId('dictation-button')
  assert.match(await btn.getAttribute('aria-label'), /Descargar el modelo de voz/)
  await btn.click()
  await page.locator('dotrino-dictation[state="idle"]').and(page.locator(':not([error])')).waitFor({ timeout: 540_000 })
  await page.getByTestId('mic-status').filter({ hasText: 'Listo' }).waitFor()

  await speak(page)
  await page.getByTestId('movement-form').waitFor({ timeout: 120_000 })
  const said = await page.getByTestId('quick-input').inputValue()
  console.log(`# local dictation: «${said}»`)
  assert.equal(await page.getByTestId('amount').inputValue(), '4.50')
  await page.getByTestId('cancel').click()
  assert.deepEqual(sent, [], 'local dictation sends nothing to any provider')

  // 3. Con tu IA: configurar OpenAI (simulado) y elegir «Con tu IA».
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('ai-edit').click()
  await page.getByTestId('ai-provider').selectOption('openai')
  await page.getByTestId('ai-key').fill('sk-test-123')
  await page.getByTestId('ai-save').click()
  await page.getByTestId('ai-status').filter({ hasText: 'OpenAI' }).waitFor({ timeout: 20_000 })
  await page.getByTestId('dictation-provider').click()
  await page.getByTestId('dictation-help').filter({ hasText: 'OpenAI' }).waitFor()
  await page.getByTestId('tab-month').click()
  await speak(page, 2000)
  await page.getByTestId('movement-form').waitFor({ timeout: 30_000 })
  assert.equal(await page.getByTestId('quick-input').inputValue(), 'Taxi, tres dólares con veinte.')
  assert.equal(await page.getByTestId('amount').inputValue(), '3.20')
  const audio = sent.find((s) => s.url.endsWith('/audio/transcriptions'))
  assert.ok(audio && audio.size > 2000, 'the recorded audio went to the provider')

  assert.deepEqual(problems, [])
  await ctx.close()
})
