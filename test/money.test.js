import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount, toDecimal, formatMoney } from '../src/lib/money.js'

test('amounts are parsed to integer cents, with either decimal separator', () => {
  assert.equal(parseAmount('4.50'), 450)
  assert.equal(parseAmount('4,50'), 450)
  assert.equal(parseAmount('12'), 1200)
  assert.equal(parseAmount('$ 12.5'), 1250)
  assert.equal(parseAmount('1.200,50'), 120050)
  assert.equal(parseAmount('1,200.50'), 120050)
  assert.equal(parseAmount('1,200'), 120000)
  assert.equal(parseAmount('0.07'), 7)
  assert.equal(parseAmount('-20'), -2000)
})

test('what is not an amount is rejected with a code', () => {
  for (const bad of ['', 'abc', '.', '-', null]) {
    assert.throws(() => parseAmount(bad), (e) => e.code === 'bad-amount')
  }
})

test('cents go back to a neutral decimal text', () => {
  assert.equal(toDecimal(450), '4.50')
  assert.equal(toDecimal(7), '0.07')
  assert.equal(toDecimal(120050), '1200.50')
  assert.equal(toDecimal(-2000), '-20.00')
})

test('money is formatted per language, optionally with its sign', () => {
  assert.equal(formatMoney(450, { lang: 'en' }), '$4.50')
  assert.equal(formatMoney(-450, { lang: 'en' }), '-$4.50')
  assert.equal(formatMoney(450, { lang: 'en', signed: true }), '+$4.50')
  assert.match(formatMoney(120050, { lang: 'es' }), /1\.?200,50/)
})
