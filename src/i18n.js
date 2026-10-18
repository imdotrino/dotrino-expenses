// Textos es/en. Español neutro, con tuteo. El idioma lo decide el toggle de
// <dotrino-topbar> (clave común 'dotrino.lang'); aquí solo se sigue su evento.
import { ref } from 'vue'

const messages = {
  es: {
    tabs: { month: 'Mes', summary: 'Resumen', recurring: 'Cada mes', settings: 'Ajustes' },
    boot: { loading: 'Abriendo tu almacén…', retry: 'Reintentar' },
    month: {
      prev: 'Mes anterior',
      next: 'Mes siguiente',
      income: 'Ingresos',
      expense: 'Gastos',
      balance: 'Balance',
      pending: '{count} por confirmar',
      weekdays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
      allMonth: 'Todo el mes',
      dayEmpty: 'Nada anotado este día.',
      monthEmpty: 'Nada anotado este mes. Añade tu primer movimiento con el botón +.',
      add: 'Añadir movimiento',
      quick: 'Escribe una frase',
      quickPlaceholder: 'Por ejemplo: almuerzo 4.50 · cobré 1200 del sueldo · taxi 3 ayer',
      quickHelp: 'Pon el importe y una o dos palabras. Puedes añadir «ayer» o un día («el 5»). Lo revisas antes de guardar.',
      quickNoAmount: 'No encuentro el importe en la frase.',
      confirm: 'Confirmar',
      discard: 'Descartar',
      pendingTag: 'Por confirmar',
      recurringTag: 'Cada mes',
    },
    form: {
      new: 'Nuevo movimiento',
      edit: 'Editar movimiento',
      review: 'Revisa lo que entendí',
      expense: 'Gasto',
      income: 'Ingreso',
      amount: 'Importe',
      date: 'Fecha',
      category: 'Categoría',
      note: 'Nota',
      notePlaceholder: 'Qué fue (opcional)',
      save: 'Guardar',
      cancel: 'Cancelar',
      remove: 'Eliminar',
      removeConfirm: 'Sí, eliminar',
      removeBody: 'Se quita del registro. No se puede deshacer.',
      saved: 'Guardado.',
      removed: 'Eliminado.',
      confirmed: 'Confirmado.',
      problems: { date: 'La fecha no es válida.', amount: 'El importe tiene que ser mayor que cero.', type: 'Elige gasto o ingreso.', category: 'Elige una categoría.' },
    },
    summary: {
      title: 'Resumen de {month}',
      empty: 'Todavía no hay movimientos confirmados en este mes.',
      expenses: 'En qué se fue',
      incomes: 'De dónde entró',
      vsPrev: 'Frente a {month}',
      more: '{amount} más que el mes anterior',
      less: '{amount} menos que el mes anterior',
      same: 'Igual que el mes anterior',
      noPrev: 'Sin datos del mes anterior',
      export: 'Descargar CSV del mes',
      exported: 'CSV descargado.',
      count: '{count} movimientos',
      count1: '1 movimiento',
    },
    recurring: {
      title: 'Lo que se repite cada mes',
      info: 'Cada regla anota sola su movimiento al empezar el mes, marcado «por confirmar». Lo confirmas o lo descartas desde el calendario; descartado, ese mes no se vuelve a generar.',
      empty: 'Aún no hay movimientos recurrentes. Un sueldo, el arriendo, una suscripción…',
      add: 'Añadir regla',
      new: 'Nueva regla',
      edit: 'Editar regla',
      name: 'Nombre',
      namePlaceholder: 'Arriendo, Sueldo, Netflix…',
      day: 'Día del mes',
      dayHelp: 'Si el mes es más corto, cae en su último día.',
      startMonth: 'Desde',
      endMonth: 'Hasta (opcional)',
      every: 'El día {day} de cada mes',
      from: 'desde {month}',
      until: 'hasta {month}',
      remove: 'Quitar',
      removeBody: 'Los movimientos ya anotados se conservan.',
      removeConfirm: 'Sí, quitar',
      saved: 'Regla guardada.',
      removed: 'Regla quitada.',
      problems: { name: 'Ponle un nombre.', amount: 'El importe tiene que ser mayor que cero.', type: 'Elige gasto o ingreso.', category: 'Elige una categoría.', day: 'El día va del 1 al 31.', startMonth: 'Indica desde qué mes.', endMonth: 'El mes final no puede ser anterior al inicial.' },
    },
    settings: {
      info: 'Qué es esto',
      saved: 'Guardado.',
      currency: 'Moneda',
      currencyHelp: 'Solo cambia cómo se muestran los importes.',
      categories: 'Tus categorías',
      categoriesInfo: 'Las categorías de la app no se borran. Aquí añades las tuyas y las quitas cuando quieras; lo ya anotado con ellas se conserva.',
      addCategory: 'Añadir categoría',
      categoryName: 'Nombre',
      categoryKind: 'Para',
      categoryIcon: 'Icono (un emoji, opcional)',
      categoryExists: 'Ya existe una categoría con ese nombre.',
      removeCategory: 'Quitar {name}',
      custom: 'Tuya',
      about: 'Qué guarda la app y dónde',
      aboutText: 'Tus movimientos, tus reglas y tus categorías se guardan en este navegador, dentro de tu perfil. Si tu perfil está enlazado a tu bóveda, se copian allí cifrados. Nada de lo que anotas sale a ningún servidor de Dotrino.',
    },
    backup: {
      title: 'Dónde están tus datos',
      info: 'Movimientos, reglas y categorías se guardan en este navegador. Si tu perfil está enlazado a tu bóveda, además se copian allí, cifrados, y los recuperas desde otro aparato de tu cuenta.',
      checking: 'Comprobando…',
      syncing: 'Sincronizando con tu bóveda…',
      saving: 'Copiando los cambios a tu bóveda…',
      backed: 'Respaldado en tu bóveda',
      localOnly: 'Solo en este navegador',
      syncNow: 'Sincronizar ahora',
      lastSync: 'Última copia: {when}',
      pending: 'Cambios sin respaldar: {count}',
      tooLarge: '{count} registros son demasiado grandes para copiarlos a la bóveda.',
      howToLink: 'Cómo enlazar tu bóveda',
      off: {
        'no-identity': 'La app no tiene perfil activo.',
        'not-paired': 'Este perfil no está enlazado a una bóveda.',
        revoked: 'Este aparato ya no pertenece a la cuenta.',
        destroyed: 'El almacén se cerró.',
        starting: 'Comprobando…',
      },
      errors: {
        'no-content-key': 'Este aparato todavía no tiene la llave de tu cuenta para cifrar lo que guarda. La recibe cuando otro aparato de tu cuenta se conecta.',
        'vault-no-reply': 'Tu bóveda no responde. Comprueba que está encendida.',
        'vault-outdated': 'Tu bóveda necesita actualizarse para guardar estos datos.',
        'not-paired': 'Este perfil no está enlazado a una bóveda.',
        'vault-off': 'Este perfil no está enlazado a una bóveda.',
        other: 'No se pudo copiar a tu bóveda: {message}',
      },
    },
    errors: {
      'identity-unreachable': 'No se pudo abrir tu identidad. Revisa la conexión e inténtalo de nuevo.',
      'store-unreachable': 'No se pudo abrir tu almacén. Revisa la conexión e inténtalo de nuevo.',
      'store-no-profile': 'No hay un perfil activo. Crea uno o elige uno desde el botón de perfil.',
      'store-identity-mismatch': 'El almacén quedó abierto con otro perfil. Recarga la página.',
      'store-profile-mismatch': 'El almacén no corresponde al perfil activo. Recarga la página.',
      'bad-amount': 'El importe no es válido.',
      'bad-movement': 'Faltan datos del movimiento.',
      'bad-category': 'La categoría necesita un nombre.',
      unknown: 'Algo falló: {message}',
    },
  },
  en: {
    tabs: { month: 'Month', summary: 'Summary', recurring: 'Monthly', settings: 'Settings' },
    boot: { loading: 'Opening your storage…', retry: 'Retry' },
    month: {
      prev: 'Previous month',
      next: 'Next month',
      income: 'Income',
      expense: 'Expenses',
      balance: 'Balance',
      pending: '{count} to confirm',
      weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      allMonth: 'Whole month',
      dayEmpty: 'Nothing recorded on this day.',
      monthEmpty: 'Nothing recorded this month. Add your first movement with the + button.',
      add: 'Add movement',
      quick: 'Type a sentence',
      quickPlaceholder: 'For example: lunch 4.50 · salary 1200 received · taxi 3 yesterday',
      quickHelp: 'Write the amount and a word or two. You can add “yesterday” or a day (“the 5th”). You review it before saving.',
      quickNoAmount: 'I cannot find the amount in the sentence.',
      confirm: 'Confirm',
      discard: 'Discard',
      pendingTag: 'To confirm',
      recurringTag: 'Monthly',
    },
    form: {
      new: 'New movement',
      edit: 'Edit movement',
      review: 'Check what I understood',
      expense: 'Expense',
      income: 'Income',
      amount: 'Amount',
      date: 'Date',
      category: 'Category',
      note: 'Note',
      notePlaceholder: 'What it was (optional)',
      save: 'Save',
      cancel: 'Cancel',
      remove: 'Delete',
      removeConfirm: 'Yes, delete',
      removeBody: 'It is removed from the record. This cannot be undone.',
      saved: 'Saved.',
      removed: 'Deleted.',
      confirmed: 'Confirmed.',
      problems: { date: 'The date is not valid.', amount: 'The amount must be greater than zero.', type: 'Choose expense or income.', category: 'Choose a category.' },
    },
    summary: {
      title: 'Summary of {month}',
      empty: 'No confirmed movements in this month yet.',
      expenses: 'Where it went',
      incomes: 'Where it came from',
      vsPrev: 'Compared with {month}',
      more: '{amount} more than the previous month',
      less: '{amount} less than the previous month',
      same: 'Same as the previous month',
      noPrev: 'No data for the previous month',
      export: 'Download the month as CSV',
      exported: 'CSV downloaded.',
      count: '{count} movements',
      count1: '1 movement',
    },
    recurring: {
      title: 'What repeats every month',
      info: 'Each rule records its movement by itself when the month starts, marked “to confirm”. You confirm or discard it from the calendar; once discarded, that month is not generated again.',
      empty: 'No recurring movements yet. A salary, the rent, a subscription…',
      add: 'Add rule',
      new: 'New rule',
      edit: 'Edit rule',
      name: 'Name',
      namePlaceholder: 'Rent, Salary, Netflix…',
      day: 'Day of the month',
      dayHelp: 'If the month is shorter, it falls on its last day.',
      startMonth: 'From',
      endMonth: 'Until (optional)',
      every: 'On day {day} of every month',
      from: 'from {month}',
      until: 'until {month}',
      remove: 'Remove',
      removeBody: 'Movements already recorded are kept.',
      removeConfirm: 'Yes, remove',
      saved: 'Rule saved.',
      removed: 'Rule removed.',
      problems: { name: 'Give it a name.', amount: 'The amount must be greater than zero.', type: 'Choose expense or income.', category: 'Choose a category.', day: 'The day goes from 1 to 31.', startMonth: 'Say from which month.', endMonth: 'The last month cannot be before the first one.' },
    },
    settings: {
      info: 'What is this',
      saved: 'Saved.',
      currency: 'Currency',
      currencyHelp: 'Only changes how amounts are displayed.',
      categories: 'Your categories',
      categoriesInfo: 'The app’s categories cannot be deleted. Here you add your own and remove them whenever you want; what was recorded with them is kept.',
      addCategory: 'Add category',
      categoryName: 'Name',
      categoryKind: 'For',
      categoryIcon: 'Icon (an emoji, optional)',
      categoryExists: 'A category with that name already exists.',
      removeCategory: 'Remove {name}',
      custom: 'Yours',
      about: 'What the app keeps, and where',
      aboutText: 'Your movements, rules and categories are kept in this browser, inside your profile. If your profile is linked to your vault, they are also copied there, encrypted. Nothing you record goes to any Dotrino server.',
    },
    backup: {
      title: 'Where your data is',
      info: 'Movements, rules and categories are kept in this browser. If your profile is linked to your vault, they are also copied there, encrypted, and you get them back from another device of your account.',
      checking: 'Checking…',
      syncing: 'Syncing with your vault…',
      saving: 'Copying the changes to your vault…',
      backed: 'Backed up in your vault',
      localOnly: 'Only in this browser',
      syncNow: 'Sync now',
      lastSync: 'Last copy: {when}',
      pending: 'Changes not backed up: {count}',
      tooLarge: '{count} records are too large to copy to the vault.',
      howToLink: 'How to link your vault',
      off: {
        'no-identity': 'The app has no active profile.',
        'not-paired': 'This profile is not linked to a vault.',
        revoked: 'This device no longer belongs to the account.',
        destroyed: 'The storage was closed.',
        starting: 'Checking…',
      },
      errors: {
        'no-content-key': 'This device does not have your account key yet to encrypt what it stores. It gets it when another device of your account connects.',
        'vault-no-reply': 'Your vault is not answering. Check that it is on.',
        'vault-outdated': 'Your vault needs an update to store this data.',
        'not-paired': 'This profile is not linked to a vault.',
        'vault-off': 'This profile is not linked to a vault.',
        other: 'Could not copy to your vault: {message}',
      },
    },
    errors: {
      'identity-unreachable': 'Your identity could not be opened. Check the connection and try again.',
      'store-unreachable': 'Your storage could not be opened. Check the connection and try again.',
      'store-no-profile': 'There is no active profile. Create or choose one from the profile button.',
      'store-identity-mismatch': 'The storage was opened with another profile. Reload the page.',
      'store-profile-mismatch': 'The storage does not match the active profile. Reload the page.',
      'bad-amount': 'The amount is not valid.',
      'bad-movement': 'The movement is missing data.',
      'bad-category': 'The category needs a name.',
      unknown: 'Something failed: {message}',
    },
  },
}

export const lang = ref(initialLang())

function initialLang () {
  try {
    const saved = localStorage.getItem('dotrino.lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch { /* modo privado */ }
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en'
}

/** Una fecha en el idioma activo (es-EC / en-US). `opts` son los de Intl.DateTimeFormat. */
export function formatDate (value, opts) {
  return new Intl.DateTimeFormat(lang.value === 'es' ? 'es-EC' : 'en-US', opts).format(value instanceof Date ? value : new Date(value))
}

/** 'aaaa-mm' → «octubre de 2026» / «October 2026». */
export function monthName (month) {
  const [y, m] = month.split('-').map(Number)
  const text = formatDate(new Date(Date.UTC(y, m - 1, 1)), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function setLang (l) {
  if (l !== 'es' && l !== 'en') throw new Error(`unsupported language: ${l}`)
  lang.value = l
}

export function t (path, vars) {
  const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), messages[lang.value])
  if (typeof value !== 'string') throw new Error(`missing translation: ${lang.value}.${path}`)
  return vars ? value.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : value
}

/** Una lista de textos (los días de la semana). */
export function tl (path) {
  const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), messages[lang.value])
  if (!Array.isArray(value)) throw new Error(`missing translation list: ${lang.value}.${path}`)
  return value
}

/** ¿Hay texto para esta clave? Para códigos que vienen de fuera y pueden ser nuevos. */
export function hasText (path) {
  return typeof path.split('.').reduce((o, k) => (o == null ? o : o[k]), messages[lang.value]) === 'string'
}

/** Mensaje para un error con `code`; los desconocidos dicen lo que pasó, tal cual. */
export function errorText (e) {
  const code = e?.code
  const known = code && messages[lang.value].errors[code]
  return known || t('errors.unknown', { message: e?.message || String(e) })
}
