// Movimientos que se repiten cada mes (sueldo, arriendo, suscripciones). Una regla genera,
// en cada mes que ya empezó, un movimiento PENDIENTE que el usuario confirma o descarta.
// Funciones puras; quién lee y escribe es repo.js.

import { dayInMonth } from './dates.js'

/** ¿La regla aplica a este mes? */
export function appliesTo (rule, month) {
  if (rule.startMonth && month < rule.startMonth) return false
  if (rule.endMonth && month > rule.endMonth) return false
  if (Array.isArray(rule.skipped) && rule.skipped.includes(month)) return false
  return true
}

/**
 * Qué movimientos faltan generar en `month`: una regla que aplica y no tiene movimiento con
 * su `recurringId` en ese mes. Solo en meses que ya empezaron (`month <= currentMonth`), porque
 * anotar el futuro desordena el calendario del mes que se está mirando.
 */
export function missingMovements (rules, movements, month, currentMonth, { now = Date.now(), uuid = () => crypto.randomUUID() } = {}) {
  if (month > currentMonth) return []
  const present = new Set(movements.filter((m) => m.recurringId).map((m) => m.recurringId))
  return rules
    .filter((r) => appliesTo(r, month) && !present.has(r.id))
    .map((r) => ({
      id: uuid(),
      date: dayInMonth(month, r.day),
      amount: r.amount,
      type: r.type,
      category: r.category,
      note: r.name,
      source: 'recurring',
      recurringId: r.id,
      pending: true,
      ts: now,
    }))
}

export function validateRule (rule) {
  const problems = []
  if (!String(rule.name || '').trim()) problems.push('name')
  if (!Number.isSafeInteger(rule.amount) || rule.amount <= 0) problems.push('amount')
  if (rule.type !== 'expense' && rule.type !== 'income') problems.push('type')
  if (!rule.category) problems.push('category')
  if (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31) problems.push('day')
  if (!/^\d{4}-\d{2}$/.test(rule.startMonth || '')) problems.push('startMonth')
  if (rule.endMonth && (!/^\d{4}-\d{2}$/.test(rule.endMonth) || rule.endMonth < rule.startMonth)) problems.push('endMonth')
  return problems
}
