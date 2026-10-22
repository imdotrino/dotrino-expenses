// El buzón por el agente del PC (@dotrino/expenses-agent, docs/DISENO.md §4, F4).
//
// La PWA no ve nunca las credenciales del correo: las tiene la bóveda y las usa el agente. Aquí
// se busca el agente entre los aparatos de la cuenta (preguntándoles qué son), se abre una
// sesión cifrada con él (@dotrino/remote-agent) y se le pide lo nuevo desde el cursor guardado
// en el almacén. Con el PC apagado no pasa nada: no llega correo nuevo, y la app sigue igual.

import { linkFromIdentity } from '@dotrino/remote-agent/browser-link'
import { listAgentsByLabel, probeAgents } from '@dotrino/remote-agent/discover'
import { RemoteAgentClient } from '@dotrino/remote-agent/client'
import { getIdentity } from '../services/identity.js'
import { codeError } from './errors.js'

export const AGENT_KIND = 'expenses-agent'
const PULL_TIMEOUT_MS = 90_000
const STATUS_TIMEOUT_MS = 30_000

/**
 * Los agentes de Expenses ENCENDIDOS de la cuenta.
 * @returns {Promise<{ state: 'unpaired' } | { state: 'found', link: object, agents: Array<{ sub:string, label:string }> }>}
 *   `agents` vacío = ninguno contesta ahora (apagado, o no hay ninguno).
 */
export async function findAgents () {
  const id = await getIdentity()
  const link = await linkFromIdentity(id)
  if (!link.paired) return { state: 'unpaired', expired: !!link.expired }
  const members = await listAgentsByLabel(id)
  if (!members.length) return { state: 'found', link, agents: [] }
  const { WebSocketProxyClient } = await import('@dotrino/proxy-client')
  const probe = new WebSocketProxyClient({ url: link.proxy, enableWebRTC: false, autoReconnect: false })
  try {
    await probe.connect()
    const alive = await probeAgents(probe, members.map((m) => m.sub))
    return { state: 'found', link, agents: members.filter((m) => alive.get(m.sub)?.kind === AGENT_KIND) }
  } finally {
    probe.close?.()
  }
}

/** Una sesión con un agente: `status()` y `pull(cursor)`. Se cierra con `close()`. */
export async function openAgent (link, agent) {
  const rc = new RemoteAgentClient(link, { agentPubkey: agent.sub })
  const waiting = new Map()   // re → { resolve, reject, timer }
  rc.on('message', (p) => {
    const w = p && waiting.get(p.re)
    if (!w) return
    waiting.delete(p.re)
    clearTimeout(w.timer)
    if (p.type === 'fail') w.reject(codeError(p.code || 'agent-failed', p.message || 'the agent failed'))
    else w.resolve(p)
  })
  rc.on('error', (e) => {
    for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(e) }
    waiting.clear()
  })
  try {
    await rc.connect()
  } catch (e) {
    throw codeError('agent-unreachable', `could not open a session with the agent: ${e?.message || e}`, { cause: e })
  }

  function call (payload, timeoutMs) {
    const re = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(re)
        reject(codeError('agent-timeout', `the agent did not answer ${payload.type} in time`))
      }, timeoutMs)
      waiting.set(re, { resolve, reject, timer })
      rc.send({ ...payload, re }).catch((e) => {
        clearTimeout(timer)
        waiting.delete(re)
        reject(codeError('agent-unreachable', `could not send to the agent: ${e?.message || e}`, { cause: e }))
      })
    })
  }

  return {
    /** { configured, mailbox?: { host, user, folder, from }, version } */
    status: () => call({ type: 'status' }, STATUS_TIMEOUT_MS),
    /** { mails: [{ id, from, subject, date, text }], cursor } */
    pull: (cursor) => call({ type: 'pull', cursor: cursor || null }, PULL_TIMEOUT_MS),
    close: () => rc.close(),
  }
}
