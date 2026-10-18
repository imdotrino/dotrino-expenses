import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appliesTo, missingMovements, validateRule } from '../src/lib/recurring.js'

const rent = { id: 'r1', name: 'Arriendo', amount: 35000, type: 'expense', category: 'home', day: 5, startMonth: '2026-01' }
const salary = { id: 'r2', name: 'Sueldo', amount: 120000, type: 'income', category: 'salary', day: 31, startMonth: '2026-03', endMonth: '2026-09' }

test('a rule applies between its start and end months, except the months it was skipped', () => {
  assert.equal(appliesTo(rent, '2025-12'), false)
  assert.equal(appliesTo(rent, '2026-01'), true)
  assert.equal(appliesTo(rent, '2030-06'), true)
  assert.equal(appliesTo(salary, '2026-10'), false)
  assert.equal(appliesTo({ ...rent, skipped: ['2026-04'] }, '2026-04'), false)
})

test('missing movements are generated once, pending, on a day that exists in that month', () => {
  const opts = { now: 1, uuid: () => 'u' }
  const first = missingMovements([rent, salary], [], '2026-04', '2026-10', opts)
  assert.equal(first.length, 2)
  assert.deepEqual(first[0], { id: 'u', date: '2026-04-05', amount: 35000, type: 'expense', category: 'home', note: 'Arriendo', source: 'recurring', recurringId: 'r1', pending: true, ts: 1 })
  assert.equal(first[1].date, '2026-04-30', 'the 31st is clamped to the last day')
  // With the movements present (even confirmed), nothing is generated again.
  const confirmed = first.map((m) => ({ ...m, pending: false }))
  assert.deepEqual(missingMovements([rent, salary], confirmed, '2026-04', '2026-10', opts), [])
})

test('future months are left alone', () => {
  assert.deepEqual(missingMovements([rent], [], '2026-11', '2026-10'), [])
})

test('a rule is validated field by field', () => {
  assert.deepEqual(validateRule(rent), [])
  assert.deepEqual(validateRule({ ...rent, name: ' ', amount: 0, day: 32 }), ['name', 'amount', 'day'])
  assert.deepEqual(validateRule({ ...rent, endMonth: '2025-01' }), ['endMonth'])
})
