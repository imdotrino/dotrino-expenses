// Recordatorios de lo que se paga o se cobra cada mes (F5).
//
// Dos caras:
//   · DENTRO de la app: al abrirla, lo pendiente que vence hoy, ya pasó o vence en los próximos
//     días. Sale de los movimientos por confirmar del mes; no necesita nada más.
//   · Con la app CERRADA: un timbre el día del pago a las 9:00, programado en el proxio
//     (`schedulePush` de @dotrino/proxy-client, a la PROPIA llave y solo para esta app). No
//     necesita ningún agente encendido. El aviso dice que hay un pago, y nada más: ni el
//     nombre ni el importe salen del aparato.
//
// Funciones puras arriba; abajo, la sincronización con el proxio.

import { appliesTo } from './recurring.js'
import { dayInMonth, shiftMonth } from './dates.js'

export const SOON_DAYS = 3
export const PUSH_HORIZON_DAYS = 45
export const PUSH_HOUR = 9
export const APP = 'expenses'

function addDays (day, n) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Lo pendiente de un mes que pide atención: vencido, de hoy, o de los próximos `days` días.
 * @returns {{ overdue: object[], today: object[], soon: object[] }}
 */
export function dueItems (movements, today, days = SOON_DAYS) {
  const limit = addDays(today, days)
  const pending = movements.filter((m) => m.pending).sort((a, b) => a.date.localeCompare(b.date))
  return {
    overdue: pending.filter((m) => m.date < today),
    today: pending.filter((m) => m.date === today),
    soon: pending.filter((m) => m.date > today && m.date <= limit),
  }
}

/**
 * Los días (desde `from`, incluido, `days` días) en que cae alguna regla todavía sin resolver.
 * `resolved` son los movimientos ya CONFIRMADOS de esos meses: una regla ya pagada ese mes no
 * vuelve a sonar. Una regla descartada en un mes no aplica a ese mes (`skipped`).
 * @returns {string[]} 'aaaa-mm-dd', ordenados y sin repetir
 */
export function reminderDays (rules, from, days, resolved = []) {
  const until = addDays(from, days)
  const done = new Set(resolved.filter((m) => m.recurringId && !m.pending).map((m) => `${m.recurringId}@${m.date.slice(0, 7)}`))
  const out = new Set()
  for (let month = from.slice(0, 7); month <= until.slice(0, 7); month = shiftMonth(month, 1)) {
    for (const r of rules) {
      if (!appliesTo(r, month) || done.has(`${r.id}@${month}`)) continue
      const day = dayInMonth(month, r.day)
      if (day >= from && day <= until) out.add(day)
    }
  }
  return [...out].sort()
}

/** 'aaaa-mm-dd' → el instante de las `hour`:00 de ese día en la hora LOCAL del aparato. */
export function localTime (day, hour = PUSH_HOUR) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime()
}

// ---------- el timbre con la app cerrada ----------

/**
 * Deja programados en el proxio los timbres de los próximos días, y solo esos: borra los que
 * había de esta app y pone los nuevos. Con `enabled: false` los borra y quita la suscripción.
 *
 * @param {{ enabled: boolean, days: string[], text: { title: string, body: string }, url: string, now?: number,
 *   getIdentity: () => Promise<any>, connect: () => Promise<any> }} o
 * @returns {Promise<{ scheduled: number }>}
 */
export async function syncPushReminders ({ enabled, days, text, url, now = Date.now(), getIdentity, connect }) {
  const id = await getIdentity()
  const publicKey = id.me?.publickey
  if (!publicKey) throw Object.assign(new Error('no active profile key to schedule reminders with'), { code: 'store-no-profile' })
  const sign = (d) => id.signData(d)
  const client = await connect()
  try {
    await client.identifyAs({ publickey: publicKey, sign })
    if (enabled) await client.enablePush({ publicKey, sign })
    const jobs = await client.listScheduledPushes({ publicKey, sign })
    // Los de esta app: los marca el proxio (≥ 1.9.0) y, por si acaso, la etiqueta del aviso.
    for (const j of jobs.filter((j) => j.app === APP || j.payload?.tag === 'expenses-due')) {
      await client.cancelScheduledPush({ publicKey, sign, jobId: j.jobId })
    }
    if (!enabled) {
      await client.disablePush({ publicKey, sign }).catch((e) => console.error('[expenses] disable push:', e))
      return { scheduled: 0 }
    }
    let scheduled = 0
    for (const day of days) {
      const when = localTime(day)
      if (when <= now + 60_000) continue
      await client.schedulePush({
        publicKey, sign, when,
        payload: { title: text.title, body: text.body, tag: 'expenses-due', url },
      })
      scheduled++
    }
    return { scheduled }
  } finally {
    client.close?.()
  }
}
