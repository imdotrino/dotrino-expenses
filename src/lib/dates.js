// Fechas del DIARIO: el día local del aparato. No es un comprobante que compare un tercero,
// así que no hay zona horaria fija; lo que importa es que «hoy» sea el hoy del usuario.

/** 'aaaa-mm-dd' del día local. */
export function localDay (now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 'aaaa-mm' del mes local. */
export function localMonth (now = new Date()) {
  return localDay(now).slice(0, 7)
}

/** @param {string} day @returns {string} */
export function monthOf (day) {
  return day.slice(0, 7)
}

/** @param {string} month 'aaaa-mm' @param {number} delta @returns {string} */
export function shiftMonth (month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

/**
 * 'aaaa-mm-dd' movido `delta` días (por UTC al mediodía: el cambio de hora no lo mueve).
 * @param {string} day
 * @param {number} delta
 * @returns {string}
 */
export function shiftDay (day, delta) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** @param {string} month 'aaaa-mm' @returns {number} */
export function daysInMonth (month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * El día `n` del mes, acotado al último día si el mes es más corto (el 31 en febrero → 28/29).
 * @param {string} month
 * @param {number} n
 * @returns {string}
 */
export function dayInMonth (month, n) {
  return `${month}-${pad(Math.min(Math.max(1, n), daysInMonth(month)))}`
}

/**
 * 0 = lunes … 6 = domingo, del primer día del mes (el calendario empieza en lunes).
 * @param {string} month
 * @returns {number}
 */
export function firstWeekdayMonday (month) {
  const [y, m] = month.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
}

/**
 * Un 'aaaa-mm-dd' como Date a mediodía UTC: para Intl, sin que el huso lo mueva de día.
 * @param {string} day
 * @returns {Date}
 */
export function dayToDate (day) {
  return new Date(`${day}T12:00:00Z`)
}

/**
 * @param {unknown} day
 * @returns {day is string}
 */
export function isValidDay (day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const [y, m, d] = day.split('-').map(Number)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(`${y}-${pad(m)}`)
}

/** @param {number} n */
function pad (n) {
  return String(n).padStart(2, '0')
}
