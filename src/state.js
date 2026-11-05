// Estado compartido de la interfaz. Los pilares (identidad, almacén) NO viven aquí: un Proxy
// reactivo de Vue rompe el postMessage de los iframes. Aquí solo hay datos planos.
import { reactive } from 'vue'
import { getStore } from './services/store.js'
import { DEFAULT_PREFS, listRecurring, listCustomCategories, readPrefs, listInbox, listMovements, isMovementsThread, isSettingsThread, isInboxThread } from './lib/repo.js'
import { allCategories, categoryLabel, findCategory } from './lib/categories.js'
import { formatMoney } from './lib/money.js'
import { lang, errorText, t } from './i18n.js'
import { loadAi } from './lib/ai.js'
import { reminderDays, syncPushReminders, PUSH_HORIZON_DAYS } from './lib/reminders.js'
import { localDay, shiftMonth } from './lib/dates.js'
import { getIdentity } from './services/identity.js'
import { connectProxy } from './services/push.js'


/** @typedef {import('./types').Category} Category */
/** @typedef {import('@dotrino/store').Store} Store */
/** @typedef {import('@dotrino/store').VaultBackupStatus} VaultBackupStatus */

/**
 * @typedef {object} AppState
 * @property {boolean} booting
 * @property {unknown} bootError
 * @property {import('./types').Prefs} prefs
 * @property {import('./types').RecurringRule[]} recurring
 * @property {Category[]} customCategories
 * @property {VaultBackupStatus | null} backup
 * @property {import('./types').AiStatus} ai
 * @property {unknown} aiError
 * @property {import('./types').InboxItem[]} inbox
 * @property {'on' | 'off'} reminderPush
 * @property {import('./types').RemindersSync | null} remindersSync
 * @property {number} movementsVersion
 * @property {import('./types').Toast | null} toast
 */

/** @type {AppState} */
export const state = reactive({
  booting: true,
  bootError: null,
  prefs: { ...DEFAULT_PREFS },
  recurring: [],
  customCategories: [],
  // Respaldo del almacén en la bóveda (`store.vault` de @dotrino/store).
  backup: null,
  // La IA del usuario: si hay y de quién (nunca la llave, ver lib/ai.js), y si no abrió, por qué.
  ai: { configured: false },
  aiError: null,
  // La bandeja «Por confirmar»: lo que llegó del correo y espera una decisión.
  inbox: [],
  // El timbre de los recordatorios con la app cerrada, en ESTE aparato (la suscripción al push
  // es del aparato, no de la cuenta): 'off' | 'on'. `remindersSync`: cómo fue la última vez.
  reminderPush: readReminderPush(),
  remindersSync: null,     // { state: 'syncing'|'ok'|'error', scheduled?, error? }
  // Sube cuando llegan movimientos de la bóveda: el mes abierto lo mira para recargarse.
  movementsVersion: 0,
  toast: null,
})

/** El nombre del proveedor de IA para los textos; '' sin IA. */
export function aiLabel () {
  return state.ai.configured ? state.ai.label : ''
}

/** @returns {Category[]} */
export function categories () {
  return allCategories(state.customCategories)
}

/** @param {string} key */
export function categoryOf (key) {
  return findCategory(key, state.customCategories)
}

/** @param {string} key @returns {string} */
export function categoryName (key) {
  const c = categoryOf(key)
  return c ? categoryLabel(c, lang.value) : key
}

/** @param {string} key @returns {string} */
export function categoryIcon (key) {
  return categoryOf(key)?.icon || '•'
}

/**
 * @param {number} cents
 * @param {{ signed?: boolean }} [opts]
 * @returns {string}
 */
export function money (cents, opts) {
  return formatMoney(cents, { lang: lang.value, currency: state.prefs.currency, ...opts })
}

/** Abre el almacén y carga ajustes, IA, bandeja y recordatorios. Un fallo queda en `bootError`. */
export async function boot () {
  state.booting = true
  state.bootError = null
  try {
    const store = await getStore()
    watchBackup(store)
    await refreshSettings()
    await refreshAi()
    await refreshInbox()
    refreshReminders()
  } catch (e) {
    console.error('[expenses] boot:', e)
    state.bootError = e
  } finally {
    state.booting = false
  }
}

let watching = false

/** @param {Store} store */
function watchBackup (store) {
  state.backup = store.vault
  if (watching) return
  watching = true
  store.on('vault', (/** @type {import('@dotrino/store').VaultBackupEvent} */ status) => {
    state.backup = status
    if (status.state !== 'synced' || status.changed.length === 0) return
    // Lo que llegó de otro aparato: se recarga lo que cambió, no la app entera.
    if (status.changed.some(isMovementsThread)) state.movementsVersion++
    if (status.changed.some(isInboxThread)) {
      refreshInbox().catch((e) => {
        console.error('[expenses] refresh inbox after vault sync:', e)
        toast(errorText(e), 'error')
      })
    }
    if (status.changed.some(isSettingsThread)) {
      refreshSettings().then(refreshAi).then(() => refreshReminders()).catch((e) => {
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

/** Relee reglas, categorías propias y preferencias del almacén. */
export async function refreshSettings () {
  const [recurring, customCategories, prefs] = await Promise.all([listRecurring(), listCustomCategories(), readPrefs()])
  state.recurring = recurring
  state.customCategories = customCategories
  state.prefs = prefs
}

/** Relee la bandeja «Por confirmar». */
export async function refreshInbox () {
  state.inbox = await listInbox()
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

/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastTimer

/**
 * @param {string} message
 * @param {import('./types').Toast['kind']} [kind]
 */
export function toast (message, kind = 'info') {
  state.toast = { message, kind }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = null }, kind === 'error' ? 7000 : 3000)
}

// ---------- el timbre de los recordatorios (lib/reminders.js) ----------

const PUSH_KEY = 'expenses.reminderPush'

/** @returns {'on' | 'off'} */
function readReminderPush () {
  try { return localStorage.getItem(PUSH_KEY) === 'on' ? 'on' : 'off' } catch { return 'off' }
}

/** @param {boolean} on */
export function setReminderPush (on) {
  state.reminderPush = on ? 'on' : 'off'
  try { localStorage.setItem(PUSH_KEY, state.reminderPush) } catch { /* modo privado */ }
}

/** @type {Promise<void> | null} */
let syncing = null

/**
 * Vuelve a programar los timbres con las reglas de ahora. Sin el timbre encendido en este
 * aparato no hace nada (`force` para apagarlo: borra lo programado). Un fallo no para la app:
 * se dice en Ajustes.
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export function refreshReminders ({ force = false } = {}) {
  if (state.reminderPush !== 'on' && !force) return Promise.resolve()
  if (syncing) return syncing
  state.remindersSync = { state: 'syncing' }
  syncing = (async () => {
    try {
      const today = localDay()
      const months = [today.slice(0, 7), shiftMonth(today.slice(0, 7), 1), shiftMonth(today.slice(0, 7), 2)]
      const resolved = (await Promise.all(months.map(listMovements))).flat()
      const days = reminderDays(state.recurring, today, PUSH_HORIZON_DAYS, resolved)
      const { scheduled } = await syncPushReminders({
        enabled: state.reminderPush === 'on',
        days,
        text: { title: 'Expenses', body: t('reminders.pushBody') },
        url: `${location.origin}/`,
        getIdentity,
        connect: connectProxy,
      })
      state.remindersSync = { state: 'ok', scheduled }
    } catch (e) {
      console.error('[expenses] sync reminders:', e)
      state.remindersSync = { state: 'error', error: e }
      throw e
    } finally {
      syncing = null
    }
  })()
  return syncing.catch(() => {})
}
