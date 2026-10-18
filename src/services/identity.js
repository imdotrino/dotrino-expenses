// Identidad = vault id.dotrino.com (@dotrino/identity), única fuente de identidad del
// ecosistema. Aquí es imprescindible, no un adorno: el almacén se separa por perfil (dos
// personas en el mismo aparato no mezclan sus gastos) y la llave de IA del usuario se sella
// con la llave de su cuenta. Sin identidad no se sigue.
import { Identity } from '@dotrino/identity'

let connecting = null

export function getIdentity () {
  if (!connecting) {
    connecting = Identity.connect().catch((e) => {
      connecting = null
      const err = new Error(`identity vault unreachable: ${e?.message || e}`, { cause: e })
      err.code = 'identity-unreachable'
      throw err
    })
  }
  return connecting
}
