// El mes de principio a fin, en un navegador de verdad (la identidad y el almacén son los
// iframes de producción, así que necesita red): una frase → revisar → guardar → aparece en el
// calendario y en los totales → una regla recurrente genera su pendiente → confirmar → el
// resumen lo cuenta → editar y eliminar.

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

const browser = await chromium.launch()
after(() => browser.close())

test('record, confirm a recurring one, summarize, edit and delete', { timeout: 180_000 }, async () => {
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
  const page = await ctx.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  await page.goto(ORIGIN + '/')
  await page.getByTestId('month-view').waitFor({ timeout: 40_000 })
  await page.getByTestId('empty').waitFor({ timeout: 20_000 })

  // Una frase: el parser propone, el formulario enseña, y se guarda.
  await page.getByTestId('quick-input').fill('almuerzo 4.50')
  await page.getByTestId('quick-go').click()
  const form = page.getByTestId('movement-form')
  await form.waitFor()
  assert.equal(await page.getByTestId('amount').inputValue(), '4.50')
  assert.equal(await page.getByTestId('category').inputValue(), 'food')
  assert.equal(await page.getByTestId('note').inputValue(), 'almuerzo')
  await page.getByTestId('save').click()
  await form.waitFor({ state: 'detached' })

  const item = page.getByTestId('movement')
  await item.waitFor()
  assert.equal(await item.count(), 1)
  assert.match(await page.getByTestId('total-expense').innerText(), /4,50/)
  assert.match(await page.getByTestId('total-balance').innerText(), /-.*4,50/)

  // Un ingreso con el botón +, en el día de hoy ya seleccionado por el calendario.
  await page.getByTestId('add').click()
  await form.waitFor()
  await page.getByTestId('type-income').click()
  await page.getByTestId('amount').fill('1200')
  await page.getByTestId('category').selectOption('salary')
  await page.getByTestId('note').fill('Sueldo')
  await page.getByTestId('save').click()
  await form.waitFor({ state: 'detached' })
  await page.getByTestId('movement').nth(1).waitFor()
  assert.match(await page.getByTestId('total-income').innerText(), /1\.?200,00/)

  // Una regla recurrente para este mes genera un pendiente, que no cuenta hasta confirmarse.
  await page.getByTestId('tab-recurring').click()
  await page.getByTestId('recurring-empty').waitFor()
  await page.getByTestId('rule-add').click()
  await page.getByTestId('rule-name').fill('Arriendo')
  await page.getByTestId('rule-amount').fill('350')
  await page.getByTestId('rule-day').fill('5')
  await page.getByTestId('rule-category').selectOption('home')
  await page.getByTestId('rule-save').click()
  await page.getByTestId('rule').waitFor()

  await page.getByTestId('tab-month').click()
  await page.getByTestId('pending-banner').waitFor()
  assert.match(await page.getByTestId('total-expense').innerText(), /4,50/, 'pending does not count yet')
  await page.getByTestId('confirm').click()
  await page.getByTestId('pending-banner').waitFor({ state: 'detached' })
  assert.match(await page.getByTestId('total-expense').innerText(), /354,50/)

  // El resumen: por categoría, con la casa delante de la comida.
  await page.getByTestId('tab-summary').click()
  const cats = page.getByTestId('expenses-by-category').locator('li')
  await cats.first().waitFor()
  assert.equal(await cats.count(), 2)
  assert.match(await cats.first().innerText(), /Casa/)

  // Editar el almuerzo y eliminarlo.
  await page.getByTestId('tab-month').click()
  await page.getByTestId('movement').filter({ hasText: 'almuerzo' }).click()
  await form.waitFor()
  await page.getByTestId('amount').fill('5')
  await page.getByTestId('save').click()
  await form.waitFor({ state: 'detached' })
  await page.getByTestId('total-expense').filter({ hasText: '355,00' }).waitFor()
  await page.getByTestId('movement').filter({ hasText: 'almuerzo' }).click()
  await form.waitFor()
  await page.getByTestId('remove').click()
  await page.getByTestId('remove-yes').click()
  await form.waitFor({ state: 'detached' })
  await page.getByTestId('total-expense').filter({ hasText: /\$350,00/ }).waitFor()
  assert.equal(await page.getByTestId('movement').count(), 2)

  // Sobrevive a recargar.
  await page.reload()
  await page.getByTestId('movement').nth(1).waitFor({ timeout: 40_000 })

  assert.deepEqual(problems, [])
  await ctx.close()
})
