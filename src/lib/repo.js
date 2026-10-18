// Qué guarda la app en el almacén del usuario y con qué forma (docs/DISENO.md §3).
//
//   expenses.movements.aaaa-mm   un movimiento por entrada, un hilo POR MES; id = uuid
//   expenses.settings            { id: 'recurring:<uuid>', … }  una regla recurrente
//                                { id: 'category:<key>', … }    una categoría propia
//                                { id: 'prefs', … }             preferencias
//
// Escribir con el mismo id actualiza la entrada (el almacén fusiona por id).

import { getStore } from '../services/store.js'
import { missingMovements } from './recurring.js'
import { localMonth } from './dates.js'
import { codeError } from './errors.js'

const SETTINGS = 'expenses.settings'
const MOVEMENTS_PREFIX = 'expenses.movements.'
const RECURRING_PREFIX = 'recurring:'
const CATEGORY_PREFIX = 'category:'
const PREFS = 'prefs'

export const DEFAULT_PREFS = Object.freeze({ currency: 'USD' })

export function movementsThread (month) {
  return MOVEMENTS_PREFIX + month
}

export function isMovementsThread (key) {
  return key.startsWith(MOVEMENTS_PREFIX)
}

export function isSettingsThread (key) {
  return key === SETTINGS
}

// Lo que llega de Vue puede ser un Proxy reactivo, y postMessage no lo clona.
const plain = (v) => JSON.parse(JSON.stringify(v))

// ---------- movimientos ----------

export async function listMovements (month) {
  const store = await getStore()
  return (await store.listThread(movementsThread(month))).map(toMovement)
}

function toMovement (entry) {
  // El almacén añade lo suyo (dir, etc.); aquí solo lo que es del movimiento.
  const { id, date, amount, type, category, note, source, recurringId, pending, ts } = entry
  return { id, date, amount, type, category, note: note || '', source: source || 'manual', recurringId, pending: !!pending, ts }
}

export function validateMovement (m) {
  const problems = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || '')) problems.push('date')
  if (!Number.isSafeInteger(m.amount) || m.amount <= 0) problems.push('amount')
  if (m.type !== 'expense' && m.type !== 'income') problems.push('type')
  if (!m.category) problems.push('category')
  return problems
}

/** Guarda (nuevo o cambiado). Si cambió de mes, se quita del hilo viejo. */
export async function saveMovement (movement, { previousDate } = {}) {
  const problems = validateMovement(movement)
  if (problems.length) throw codeError('bad-movement', `invalid movement: ${problems.join(', ')}`, { problems })
  const store = await getStore()
  // El almacén FUSIONA por id: una clave que falta conserva el valor viejo. Por eso `pending`
  // se escribe siempre (confirmar es pasarlo a false, no quitarlo).
  const m = plain({ ...movement, id: movement.id || crypto.randomUUID(), ts: Date.now(), pending: !!movement.pending })
  if (!m.recurringId) delete m.recurringId
  if (previousDate && previousDate.slice(0, 7) !== m.date.slice(0, 7)) {
    await store.removeMessage(movementsThread(previousDate.slice(0, 7)), m.id)
  }
  await store.appendMessage(movementsThread(m.date.slice(0, 7)), m)
  return toMovement(m)
}

export async function removeMovement (movement) {
  const store = await getStore()
  await store.removeMessage(movementsThread(movement.date.slice(0, 7)), movement.id)
  // Descartar lo que generó una regla deja constancia: ese mes no se vuelve a generar.
  if (movement.recurringId && movement.pending) {
    const rule = (await listRecurring()).find((r) => r.id === movement.recurringId)
    if (rule) {
      const skipped = new Set(rule.skipped || [])
      skipped.add(movement.date.slice(0, 7))
      await saveRecurring({ ...rule, skipped: [...skipped] })
    }
  }
}

/**
 * Genera lo que las reglas deben a este mes y lo devuelve junto con lo que ya había.
 * Se llama al abrir un mes: es idempotente (lo generado queda en el almacén con su recurringId).
 */
export async function ensureRecurring (month) {
  const [movements, rules] = await Promise.all([listMovements(month), listRecurring()])
  const missing = missingMovements(rules, movements, month, localMonth())
  if (!missing.length) return movements
  const store = await getStore()
  for (const m of missing) await store.appendMessage(movementsThread(month), m)
  return [...movements, ...missing.map(toMovement)]
}

// ---------- ajustes ----------

async function settings () {
  const store = await getStore()
  return store.listThread(SETTINGS)
}

async function writeSetting (id, value) {
  const store = await getStore()
  return store.appendMessage(SETTINGS, { ...plain(value), id, ts: Date.now() })
}

async function removeSetting (id) {
  const store = await getStore()
  return store.removeMessage(SETTINGS, id)
}

const stripPrefix = (prefix) => ({ id, ts, ...rest }) => ({ ...rest, id: id.slice(prefix.length) })

export async function listRecurring () {
  return (await settings()).filter((e) => e.id.startsWith(RECURRING_PREFIX)).map(stripPrefix(RECURRING_PREFIX))
}

export async function saveRecurring (rule) {
  const id = rule.id || crypto.randomUUID()
  const { id: _, ...rest } = rule
  await writeSetting(RECURRING_PREFIX + id, rest)
  return { ...rest, id }
}

export async function removeRecurring (id) {
  return removeSetting(RECURRING_PREFIX + id)
}

export async function listCustomCategories () {
  return (await settings()).filter((e) => e.id.startsWith(CATEGORY_PREFIX)).map(({ id, ts, ...rest }) => ({ ...rest, key: id.slice(CATEGORY_PREFIX.length) }))
}

export async function saveCustomCategory (category) {
  const { key, ...rest } = category
  if (!key) throw codeError('bad-category', 'a category needs a key')
  await writeSetting(CATEGORY_PREFIX + key, rest)
  return category
}

export async function removeCustomCategory (key) {
  return removeSetting(CATEGORY_PREFIX + key)
}

export async function readPrefs () {
  const entry = (await settings()).find((e) => e.id === PREFS)
  if (!entry) return { ...DEFAULT_PREFS }
  const { id, ts, ...rest } = entry
  return { ...DEFAULT_PREFS, ...rest }
}

export async function savePrefs (prefs) {
  await writeSetting(PREFS, prefs)
  return { ...DEFAULT_PREFS, ...prefs }
}
