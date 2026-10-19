// Estado compartido de la interfaz. Los pilares (identidad, almacén) NO viven aquí: un Proxy
// reactivo de Vue rompe el postMessage de los iframes. Aquí solo hay datos planos.
import { reactive } from 'vue'
import { getStore } from './services/store.js'
import { listRecurring, listCustomCategories, readPrefs, isMovementsThread, isSettingsThread } from './lib/repo.js'
import { allCategories, categoryLabel, findCategory } from './lib/categories.js'
import { formatMoney } from './lib/money.js'
import { lang, errorText } from './i18n.js'
import { loadAi } from './lib/ai.js'

export const state = reactive({
  booting: true,
  bootError: null,
  prefs: { currency: 'USD' },
  recurring: [],
  customCategories: [],
  // Respaldo del almacén en la bóveda (`store.vault` de @dotrino/store).
  backup: null,
  // La IA del usuario: si hay y de quién (nunca la llave, ver lib/ai.js), y si no abrió, por qué.
  ai: { configured: false },
  aiError: null,
  // Sube cuando llegan movimientos de la bóveda: el mes abierto lo mira para recargarse.
  movementsVersion: 0,
  toast: null,
})

export function categories () {
  return allCategories(state.customCategories)
}

export function categoryOf (key) {
  return findCategory(key, state.customCategories)
}

export function categoryName (key) {
  const c = categoryOf(key)
  return c ? categoryLabel(c, lang.value) : key
}

export function categoryIcon (key) {
  return categoryOf(key)?.icon || '•'
}

export function money (cents, opts) {
  return formatMoney(cents, { lang: lang.value, currency: state.prefs.currency, ...opts })
}

export async function boot () {
  state.booting = true
  state.bootError = null
  try {
    const store = await getStore()
    watchBackup(store)
    await refreshSettings()
    await refreshAi()
  } catch (e) {
    console.error('[expenses] boot:', e)
    state.bootError = e
  } finally {
    state.booting = false
  }
}

let watching = false

function watchBackup (store) {
  state.backup = store.vault
  if (watching) return
  watching = true
  store.on('vault', (status) => {
    state.backup = status
    if (status.state !== 'synced' || status.changed.length === 0) return
    // Lo que llegó de otro aparato: se recarga lo que cambió, no la app entera.
    if (status.changed.some(isMovementsThread)) state.movementsVersion++
    if (status.changed.some(isSettingsThread)) {
      refreshSettings().then(refreshAi).catch((e) => {
        console.error('[expenses] refresh after vault sync:', e)
        toast(errorText(e), 'error')
      })
    }
  })
}

/** «Sincronizar ahora». Lanza con el código del almacén si no se pudo. */
export async function syncBackup () {
  const store = await getStore()
  state.backup = await store.vaultSync()
}

export async function refreshSettings () {
  const [recurring, customCategories, prefs] = await Promise.all([listRecurring(), listCustomCategories(), readPrefs()])
  state.recurring = recurring
  state.customCategories = customCategories
  state.prefs = prefs
}

/**
 * Abre la llave de IA guardada. Que no abra NO para la app (la IA no sostiene nada), pero se
 * dice en Ajustes y la IA queda apagada: nunca se sigue con una configuración a medias.
 */
export async function refreshAi () {
  try {
    state.ai = await loadAi()
    state.aiError = null
  } catch (e) {
    console.error('[expenses] load ai:', e)
    state.ai = { configured: false }
    state.aiError = e
  }
}

let toastTimer = null

export function toast (message, kind = 'info') {
  state.toast = { message, kind }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = null }, kind === 'error' ? 7000 : 3000)
}
