// El mes abierto en pantalla, compartido por Mes y Resumen. Va en sessionStorage (CONVENCIONES
// §4): sobrevive a un refresco, y abrir la app de cero vuelve al mes actual.
import { localMonth } from './dates.js'

const KEY = 'expenses.month'

/** @returns {string} 'aaaa-mm' */
export function readOpenMonth () {
  try {
    const v = sessionStorage.getItem(KEY)
    if (v && /^\d{4}-\d{2}$/.test(v)) return v
  } catch { /* modo privado */ }
  return localMonth()
}

/** @param {string} month */
export function saveOpenMonth (month) {
  try { sessionStorage.setItem(KEY, month) } catch { /* modo privado */ }
}
