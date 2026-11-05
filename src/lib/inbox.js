// Un correo del banco → una propuesta en la bandeja «Por confirmar». Lo usan las dos entradas:
// el correo pegado a mano (InboxView) y el que trae el agente del PC (MailboxCard). Lee la IA
// del usuario si la hay y, si no contesta, el lector genérico; el usuario confirma siempre.

import { state, categories } from '../state.js'
import { lang } from '../i18n.js'
import { parseBankMail, mailText, messageIdFingerprint } from './mail.js'
import { parseMailWithAi } from './ai.js'
import { addToInbox } from './repo.js'
import { localDay } from './dates.js'

/**
 * @param {string} text
 * @returns {Promise<{ found: null | (import('../types').ProposedMovement & { bank: string }), engine: 'ai'|'rules', aiError: unknown }>}
 *   `found`: { amount, type, category, note, date, bank } o null si el correo no es una operación.
 */
export async function proposeFromMail (text) {
  const today = localDay()
  /** @type {unknown} */
  let aiError = null
  if (state.ai.configured) {
    try {
      return { found: await parseMailWithAi(text, { today, categories: categories(), lang: lang.value }), engine: 'ai', aiError }
    } catch (e) {
      console.error('[expenses] ai mail parse:', e)
      aiError = e
    }
  }
  const parsed = parseBankMail(text, { today })
  if (!parsed) return { found: null, engine: 'rules', aiError }
  const { hints, ...found } = parsed
  return { found, engine: 'rules', aiError }
}

/**
 * Lo que trajo el agente → la bandeja. El mismo correo (por su Message-ID) no entra dos veces.
 * @param {import('../types').AgentMail[]} mails
 * @returns {Promise<{ added: number, seen: number, empty: number, aiError: unknown }>}
 */
export async function importAgentMails (mails) {
  /** @type {{ added: number, seen: number, empty: number, aiError: unknown }} */
  const out = { added: 0, seen: 0, empty: 0, aiError: null }
  for (const m of mails) {
    const fingerprint = await messageIdFingerprint(m.id)
    const text = mailText(`${m.subject}\n${m.text}`)
    const { found, engine, aiError } = await proposeFromMail(text)
    if (aiError && !out.aiError) out.aiError = aiError
    if (!found) { out.empty++; continue }
    const { bank, ...movement } = found
    const excerpt = `${m.subject}\n${m.from}${m.date ? ` · ${m.date.slice(0, 10)}` : ''}\n\n${mailText(m.text)}`
    const res = await addToInbox({ fingerprint, source: 'imap', movement, bank, excerpt, engine })
    if (res.added) out.added++
    else out.seen++
  }
  return out
}
