// Identidad = vault id.dotrino.com (@dotrino/identity), única fuente de identidad del
// ecosistema. Aquí es imprescindible, no un adorno: el almacén se separa por perfil (dos
// personas en el mismo aparato no mezclan sus gastos) y la llave de IA del usuario se sella
// con la llave de su cuenta. Sin identidad no se sigue.
import { Identity } from '@dotrino/identity'
import { codeError } from '../lib/errors.js'

/** @type {Promise<Identity> | null} */
let connecting = null

/**
 * La identidad del ecosistema, conectada una vez. Lanza `identity-unreachable` si el iframe
 * no contesta (y el siguiente intento vuelve a probar).
 * @returns {Promise<Identity>}
 */
export function getIdentity () {
  if (!connecting) {
    connecting = Identity.connect(identityOptions()).catch((e) => {
      connecting = null
      throw codeError('identity-unreachable', `identity vault unreachable: ${e?.message || e}`, { cause: e })
    })
  }
  return connecting
}

/**
 * En desarrollo y en las pruebas de dotrino-test la identidad se puede apuntar a un iframe
 * LOCAL con `?vault=<url>`. Solo si la página se sirve desde localhost: sin ese cerrojo, un
 * enlace a expenses.dotrino.com podría apuntar tu identidad a un iframe ajeno. (El mismo que
 * la terminal y la consola de la bóveda.)
 */
function identityOptions () {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  const url = local ? new URLSearchParams(location.search).get('vault') : null
  return url ? { vaultUrl: url } : {}
}
