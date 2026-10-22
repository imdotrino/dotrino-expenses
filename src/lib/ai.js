// La IA del usuario (docs/DISENO.md §4, F2). Con SU llave, al proveedor que ÉL eligió,
// directo desde su navegador (@dotrino/ai). Sin llave la app hace todo igual: esto afina.
//
// - La configuración (proveedor, llave, modelo, servidor) se guarda en el almacén SELLADA
//   con la llave de la CUENTA (`sealContent`): abre en todos sus aparatos y en ninguno más.
//   Al lado, en claro, solo el nombre del proveedor, para enseñarlo sin abrir nada.
// - Lo abierto vive en este módulo, fuera de Vue: un Proxy reactivo no tiene por qué ver la
//   llave, y la pantalla solo necesita saber qué proveedor hay.
// - Lo que contesta el modelo es una PROPUESTA: aquí se comprueba campo por campo y lo que
//   no encaja se corrige o se rechaza con un código. El usuario lo revisa antes de guardar.

import { createAI, PROVIDERS } from '@dotrino/ai'
import { getIdentity } from '../services/identity.js'
import { readAiRecord, saveAiRecord, removeAiRecord } from './repo.js'
import { categoryLabel } from './categories.js'
import { checkMovement } from './ai-check.js'
import { codeError } from './errors.js'

export { PROVIDERS }

/** Proveedores que se ofrecen, en el orden del selector. */
export const PROVIDER_KEYS = ['openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'openrouter', 'ollama', 'custom']

let config = null        // { provider, apiKey, model, baseUrl } abierto, o null
let loaded = false

/** Lo que la pantalla puede saber: si hay IA y de quién. Nunca la llave. */
export function aiStatus () {
  if (!config) return { configured: false }
  const preset = PROVIDERS[config.provider]
  return {
    configured: true,
    provider: config.provider,
    label: preset?.label || config.provider,
    model: config.model || preset?.model || '',
    canTranscribe: makeClient(config).info.canTranscribe,
  }
}

/** Abre la configuración guardada. Sin registro, no hay IA; un registro que no abre se dice. */
export async function loadAi () {
  const record = await readAiRecord()
  loaded = true
  if (!record) {
    config = null
    return aiStatus()
  }
  const id = await getIdentity()
  let plaintext
  try {
    plaintext = await id.openContent(record.envelope)
  } catch (e) {
    config = null
    throw codeError('ai-seal-unopenable', `the saved AI key cannot be opened with the account key on this device: ${e?.message || e}`, { cause: e })
  }
  config = JSON.parse(plaintext)
  return aiStatus()
}

/** Prueba la configuración con una pregunta mínima. Lanza con el código de @dotrino/ai. */
export async function testAi (cfg) {
  const ai = makeClient(cfg)
  await ai.ask({ prompt: 'Reply with the single word: ok', maxTokens: 16, effort: 'low' })
  return ai.info
}

/** Sella y guarda. Antes de devolver, abre el sello: si no abre aquí, no abrirá nunca. */
export async function saveAi (cfg) {
  const clean = {
    provider: cfg.provider,
    apiKey: String(cfg.apiKey || '').trim(),
    model: String(cfg.model || '').trim(),
    baseUrl: String(cfg.baseUrl || '').trim(),
  }
  makeClient(clean)   // valida: proveedor, llave, servidor
  const id = await getIdentity()
  if (!await id.contentKey()) throw codeError('seal-no-profile-key', 'this device does not hold the account content key yet')
  const plaintext = JSON.stringify(clean)
  const envelope = await id.sealContent(plaintext)
  if (await id.openContent(envelope) !== plaintext) throw codeError('seal-check-failed', 'the sealed AI key could not be opened right after sealing it')
  await saveAiRecord({ provider: clean.provider, envelope })
  config = clean
  return aiStatus()
}

export async function forgetAi () {
  await removeAiRecord()
  config = null
}

function makeClient (cfg) {
  return createAI({
    provider: cfg.provider,
    apiKey: cfg.apiKey,
    model: cfg.model || undefined,
    baseUrl: cfg.baseUrl || undefined,
  })
}

function client () {
  if (!loaded) throw codeError('ai-not-loaded', 'the AI settings were not loaded yet')
  if (!config) throw codeError('ai-not-configured', 'no AI key is configured')
  return makeClient(config)
}

// ---------- frase → movimiento ----------

/**
 * @param {string} text
 * @param {{ today: string, categories: object[], lang: 'es'|'en' }} ctx
 * @returns {Promise<{ amount:number, type:string, category:string, note:string, date:string }>}
 */
export async function parseWithAi (text, { today, categories, lang }) {
  const ai = client()
  const keys = categories.map((c) => c.key)
  const list = categories.map((c) => `${c.key} — ${categoryLabel(c, lang)} (${c.kind})`).join('\n')
  const schema = {
    type: 'object',
    properties: {
      amount: { type: 'string' },
      type: { type: 'string', enum: ['expense', 'income'] },
      category: { type: 'string', enum: keys },
      note: { type: 'string' },
      date: { type: 'string' },
    },
    required: ['amount', 'type', 'category', 'note', 'date'],
    additionalProperties: false,
  }
  const system = [
    'You turn one short personal-finance note into one movement of a monthly expense diary.',
    `Today is ${today}. Resolve relative dates ("yesterday", "ayer", "el 5") against it; without a date, use today.`,
    'Answer with JSON: amount (a decimal number as text, without currency symbol, "" if the note has no amount),',
    'type ("expense" or "income"), category (exactly one key from the list, matching the type),',
    `note (what it was, a few words, in ${lang === 'es' ? 'Spanish' : 'English'}, without the amount or the date), date (YYYY-MM-DD).`,
    'Categories (key — label (kind)):',
    list,
  ].join('\n')
  const answer = await ai.askJson({ system, prompt: text, schema, maxTokens: 300, temperature: 0, effort: 'low' })
  return checkMovement(answer, { today, categories })
}

// ---------- un aviso del banco → movimiento ----------

/**
 * Lo mismo que la frase, para un correo del banco pegado (o traído del buzón). Al proveedor va
 * el texto del correo, recortado; el usuario lo sabe porque lo dice Ajustes → Tu IA.
 * Devuelve null si el modelo dice que el correo no es una operación (saldo, publicidad).
 */
export async function parseMailWithAi (text, { today, categories, lang }) {
  const ai = client()
  const keys = categories.map((c) => c.key)
  const list = categories.map((c) => `${c.key} — ${categoryLabel(c, lang)} (${c.kind})`).join('\n')
  const schema = {
    type: 'object',
    properties: {
      amount: { type: 'string' },
      type: { type: 'string', enum: ['expense', 'income'] },
      category: { type: 'string', enum: keys },
      note: { type: 'string' },
      date: { type: 'string' },
      bank: { type: 'string' },
    },
    required: ['amount', 'type', 'category', 'note', 'date', 'bank'],
    additionalProperties: false,
  }
  const system = [
    'You read one notification email from a bank and extract the single money movement it reports.',
    `Today is ${today}. Use the date of the operation written in the email (YYYY-MM-DD); without one, use today.`,
    'Answer with JSON: amount (the amount of the OPERATION as a decimal number in text, never the balance or the credit limit;',
    '"" if the email reports no operation, e.g. a balance notice or an advertisement), type ("expense" if money left the account',
    `or was charged to a card, "income" if it came in), category (exactly one key from the list, matching the type), note (the merchant`,
    `or the person, a few words, in ${lang === 'es' ? 'Spanish' : 'English'}), bank (the bank's name, "" if unknown).`,
    'Categories (key — label (kind)):',
    list,
  ].join('\n')
  const answer = await ai.askJson({ system, prompt: text.slice(0, 6000), schema, maxTokens: 300, temperature: 0, effort: 'low' })
  let m
  try {
    m = checkMovement(answer, { today, categories })
  } catch (e) {
    if (e.code === 'ai-no-amount') return null
    throw e
  }
  return { ...m, bank: String(answer.bank || '').trim().slice(0, 40) }
}

// ---------- la voz → texto (el dictado con el proveedor) ----------

/** Lo que pasa <dotrino-dictation engine="provider"> como `.transcriber`. */
export async function transcribeWithAi (audio, { language } = {}) {
  return client().transcribe(audio, { language })
}

// ---------- el mes en palabras ----------

/**
 * Tres o cuatro frases sobre el mes. Al proveedor va SOLO esto: los totales por categoría de
 * este mes y del anterior. Ni notas, ni fechas, ni nada que el usuario escribió.
 */
export async function describeMonth ({ month, prevMonth, current, previous, currency, lang }) {
  const ai = client()
  const fmt = (rows) => rows.map((r) => `- ${r.name}: ${r.total}`).join('\n') || '- (none)'
  const prompt = [
    `Currency: ${currency}.`,
    `Month ${month} — income ${current.income}, expenses ${current.expense}.`,
    'Expenses by category:', fmt(current.expenses),
    'Income by category:', fmt(current.incomes),
    `Previous month ${prevMonth} — income ${previous.income}, expenses ${previous.expense}.`,
    'Expenses by category:', fmt(previous.expenses),
  ].join('\n')
  const system = [
    `Describe this person's month in ${lang === 'es' ? 'Spanish, using "tú" (never "vos")' : 'English'}, in 3 or 4 short plain sentences.`,
    'Say where most of the money went and what changed against the previous month. Use the numbers given; do not invent any.',
    'Do not give financial advice, do not judge, do not suggest products. No lists, no headings.',
  ].join('\n')
  return (await ai.ask({ system, prompt, maxTokens: 400, temperature: 0.3, effort: 'low' })).trim()
}
