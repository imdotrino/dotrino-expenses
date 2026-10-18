import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMovement } from '../src/lib/parse.js'

const today = '2026-10-18'
const parse = (text) => parseMovement(text, { today })

test('an expense with its category from the words around the amount', () => {
  assert.deepEqual(parse('almuerzo 4.50'), { amount: 450, type: 'expense', category: 'food', note: 'almuerzo', date: today, hints: ['category-word'] })
  assert.equal(parse('taxi 3').category, 'transport')
  assert.equal(parse('netflix 15,99').category, 'subscriptions')
  assert.equal(parse('luz 32.10').category, 'utilities')
})

test('income is recognized by its words, by the sign, or by an income category', () => {
  const salary = parse('cobré 1200 del sueldo')
  assert.equal(salary.type, 'income')
  assert.equal(salary.category, 'salary')
  assert.equal(salary.amount, 120000)
  assert.equal(parse('+300 venta de la bici').type, 'income')
  assert.equal(parse('+300 venta de la bici').category, 'sales')
  assert.equal(parse('regalo 50').type, 'income')
  assert.equal(parse('me pagaron 80 por el proyecto').category, 'freelance')
})

test('the sign set by the user wins over the words', () => {
  const m = parse('-50 sueldo adelantado devuelto')
  assert.equal(m.type, 'expense')
})

test('relative and numeric dates', () => {
  assert.equal(parse('taxi 3 ayer').date, '2026-10-17')
  assert.equal(parse('yesterday coffee 2.5').date, '2026-10-17')
  assert.equal(parse('anteayer 10 farmacia').date, '2026-10-16')
  assert.equal(parse('arriendo 350 el 5').date, '2026-10-05')
  assert.equal(parse('arriendo 350 el 5/9').date, '2026-09-05')
  assert.equal(parse('arriendo 350 12/09').date, '2026-09-12')
})

test('a date is never taken for the amount, and the note keeps what is left', () => {
  const m = parse('12/10 pizza 8')
  assert.equal(m.amount, 800)
  assert.equal(m.date, '2026-10-12')
  assert.equal(m.note, 'pizza')
  assert.equal(parse('ayer 4.50 almuerzo').note, 'almuerzo')
})

test('without an amount there is no movement; unknown words fall to the other category', () => {
  assert.equal(parse('almuerzo con amigos'), null)
  assert.equal(parse(''), null)
  assert.equal(parse('0 nada'), null)
  assert.equal(parse('cosa rara 7').category, 'other-expense')
  assert.equal(parse('ingreso 7 raro').category, 'other-income')
})
