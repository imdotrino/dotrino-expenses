// Sumas del mes. Funciones puras sobre la lista de movimientos de un mes: lo pendiente
// (generado por una regla o llegado del correo y sin confirmar) NO cuenta hasta confirmarse.

/** @typedef {import('../types').Movement} Movement */

/**
 * @param {Movement[]} movements
 * @returns {{ income: number, expense: number, balance: number, pending: number }}
 */
export function monthTotals (movements) {
  let income = 0
  let expense = 0
  let pending = 0
  for (const m of movements) {
    if (m.pending) { pending++; continue }
    if (m.type === 'income') income += m.amount
    else expense += m.amount
  }
  return { income, expense, balance: income - expense, pending }
}

/**
 * Totales por día: { 'aaaa-mm-dd': { income, expense, pending } }
 * @param {Movement[]} movements
 * @returns {Record<string, import('../types').DayTotals>}
 */
export function dayTotals (movements) {
  /** @type {Record<string, import('../types').DayTotals>} */
  const days = {}
  for (const m of movements) {
    const d = days[m.date] || (days[m.date] = { income: 0, expense: 0, pending: 0, count: 0 })
    d.count++
    if (m.pending) { d.pending++; continue }
    d[m.type] += m.amount
  }
  return days
}

/**
 * Por categoría, de un tipo, de mayor a menor: [{ category, total, count, share }]
 * @param {Movement[]} movements
 * @param {import('../types').MovementType} type
 * @returns {import('../types').CategoryTotal[]}
 */
export function byCategory (movements, type) {
  /** @type {Map<string, { category: string, total: number, count: number }>} */
  const totals = new Map()
  let sum = 0
  for (const m of movements) {
    if (m.pending || m.type !== type) continue
    const t = totals.get(m.category) || { category: m.category, total: 0, count: 0 }
    t.total += m.amount
    t.count++
    totals.set(m.category, t)
    sum += m.amount
  }
  return [...totals.values()]
    .sort((a, b) => b.total - a.total)
    .map((t) => ({ ...t, share: sum ? t.total / sum : 0 }))
}
