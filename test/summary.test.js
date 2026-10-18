import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthTotals, dayTotals, byCategory } from '../src/lib/summary.js'
import { movementsToCsv } from '../src/lib/csv.js'
import { daysInMonth, dayInMonth, firstWeekdayMonday, shiftMonth, isValidDay } from '../src/lib/dates.js'

const movements = [
  { id: 'a', date: '2026-10-03', amount: 450, type: 'expense', category: 'food', note: 'almuerzo', ts: 1 },
  { id: 'b', date: '2026-10-03', amount: 300, type: 'expense', category: 'transport', note: 'taxi', ts: 2 },
  { id: 'c', date: '2026-10-01', amount: 120000, type: 'income', category: 'salary', note: 'Sueldo', ts: 3 },
  { id: 'd', date: '2026-10-05', amount: 35000, type: 'expense', category: 'home', note: 'Arriendo', pending: true, ts: 4 },
]

test('month totals leave pending movements out and count them apart', () => {
  assert.deepEqual(monthTotals(movements), { income: 120000, expense: 750, balance: 119250, pending: 1 })
})

test('day totals for the calendar cells', () => {
  const days = dayTotals(movements)
  assert.deepEqual(days['2026-10-03'], { income: 0, expense: 750, pending: 0, count: 2 })
  assert.deepEqual(days['2026-10-05'], { income: 0, expense: 0, pending: 1, count: 1 })
})

test('by category, largest first, with its share', () => {
  const cats = byCategory(movements, 'expense')
  assert.deepEqual(cats.map((c) => c.category), ['food', 'transport'])
  assert.equal(cats[0].share, 0.6)
  assert.equal(byCategory(movements, 'income')[0].share, 1)
})

test('CSV sorted by date, with quotes only where needed', () => {
  const csv = movementsToCsv([{ ...movements[1], note: 'taxi, "centro"' }, movements[2]])
  const lines = csv.trim().split('\r\n')
  assert.equal(lines[0], 'date,type,category,amount,note,source,pending')
  assert.equal(lines[1], '2026-10-01,income,salary,1200.00,Sueldo,manual,')
  assert.equal(lines[2], '2026-10-03,expense,transport,3.00,"taxi, ""centro""",manual,')
})

test('calendar arithmetic', () => {
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(dayInMonth('2026-02', 31), '2026-02-28')
  assert.equal(firstWeekdayMonday('2026-10'), 3, 'October 1st 2026 is a Thursday')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(isValidDay('2026-02-29'), false)
  assert.equal(isValidDay('2026-10-18'), true)
})
