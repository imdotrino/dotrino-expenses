// El transporte del ecosistema (@dotrino/proxy-client), solo para programar los timbres de los
// recordatorios. Una conexión corta por sincronización, identificada con la llave del perfil y
// con `app: 'expenses'`: el timbre suena en esta app y no en las demás del mismo perfil.
import { WebSocketProxyClient } from '@dotrino/proxy-client'
import { APP } from '../lib/reminders.js'

const PROXY_URL = 'wss://proxy.dotrino.com'

export async function connectProxy () {
  const client = new WebSocketProxyClient({ url: PROXY_URL, app: APP, enableWebRTC: false, autoReconnect: false })
  await client.connect()
  return client
}
