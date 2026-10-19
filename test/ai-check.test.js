import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMovement } from '../src/lib/ai-check.js'
import { DEFAULT_CATEGORIES } from '../src/lib/categories.js'

const ctx = { today: '2026-10-18', categories: DEFAULT_CATEGORIES }

test('a good answer passes, amount to cents and note trimmed', () => {
  assert.deepEqual(checkMovement({ amount: '4.50', type: 'expense', category: 'food', note: ' almuerzo ', date: '2026-10-17' }, ctx),
    { amount: 450, type: 'expense', category: 'food', note: 'almuerzo', date: '2026-10-17' })
})

test('a category of the other kind or unknown falls to the generic one; a bad date to today', () => {
  const m = checkMovement({ amount: '20', type: 'expense', category: 'salary', note: '', date: '2026-02-30' }, ctx)
  assert.equal(m.category, 'other-expense')
  assert.equal(m.date, '2026-10-18')
  assert.equal(checkMovement({ amount: '1', type: 'income', category: 'nope', note: '', date: '' }, ctx).category, 'other-income')
})

test('no amount or an unknown type are rejected with a code', () => {
  assert.throws(() => checkMovement({ amount: '', type: 'expense', category: 'food', note: '', date: '' }, ctx), (e) => e.code === 'ai-no-amount')
  assert.throws(() => checkMovement({ amount: '0', type: 'expense', category: 'food', note: '', date: '' }, ctx), (e) => e.code === 'ai-no-amount')
  assert.throws(() => checkMovement({ amount: '3', type: 'loan', category: 'food', note: '', date: '' }, ctx), (e) => e.code === 'ai-bad-answer')
  assert.throws(() => checkMovement(null, ctx), (e) => e.code === 'ai-bad-answer')
})

test('a negative amount from the model is taken as its size', () => {
  assert.equal(checkMovement({ amount: '-12,5', type: 'expense', category: 'transport', note: 'taxi', date: '2026-10-18' }, ctx).amount, 1250)
})
