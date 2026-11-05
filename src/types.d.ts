// Las formas de datos de la app (docs/DISENO.md §3). Solo tipos: el código es JS con JSDoc.

export type Lang = 'es' | 'en'
export type MovementType = 'expense' | 'income'
export type MovementSource = 'manual' | 'recurring' | 'mail' | 'text' | 'ai' | (string & {})

/** Un movimiento del diario. El importe va en centavos (entero). */
export interface Movement {
  id: string
  /** 'aaaa-mm-dd' */
  date: string
  amount: number
  type: MovementType
  category: string
  note: string
  source: MovementSource
  recurringId?: string
  pending: boolean
  ts: number
}

/** Lo que el formulario manda a guardar: sin id (nuevo) ni ts. */
export interface MovementDraft {
  id?: string
  date: string
  amount: number
  type: MovementType
  category: string
  note?: string
  source?: MovementSource
  recurringId?: string
  pending?: boolean
  ts?: number
}

/** Lo que propone un lector (frase, correo, IA) para que el usuario lo revise. */
export interface ProposedMovement {
  amount: number
  type: MovementType
  category: string
  note: string
  date: string
}

/** Una regla que se repite cada mes. */
export interface RecurringRule {
  id: string
  name: string
  amount: number
  type: MovementType
  category: string
  /** 1-31; en un mes más corto, su último día. */
  day: number
  /** 'aaaa-mm' */
  startMonth: string
  endMonth?: string
  /** Meses ('aaaa-mm') descartados: ahí no se genera. */
  skipped?: string[]
}

export type RecurringDraft = Omit<RecurringRule, 'id'> & { id?: string }

export type CategoryKind = MovementType | 'both'

export interface Category {
  key: string
  kind: CategoryKind
  icon?: string
  label: string | { es?: string, en?: string }
}

export interface Prefs {
  currency: string
  dictation: 'off' | 'local' | 'provider'
}

/** La configuración de IA abierta. Nunca sale de lib/ai.js. */
export interface AiConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

/** Lo que la pantalla sabe de la IA: si hay y de quién. Nunca la llave. */
export type AiStatus =
  | { configured: false }
  | { configured: true, provider: string, label: string, model: string, canTranscribe: boolean }

export type InboxStatus = 'pending' | 'accepted' | 'discarded'

/** Una entrada de la bandeja «Por confirmar» (lo que llegó del correo). */
export interface InboxItem {
  id: string
  ts: number
  status: InboxStatus
  source: 'paste' | 'imap' | 'gmail'
  engine: 'rules' | 'ai'
  bank: string
  excerpt: string
  movement: ProposedMovement
  movementId?: string
}

/** Un error con `code`: se decide por el código, no por la frase. */
export interface CodedError extends Error {
  code: string
  problems?: string[]
  [extra: string]: unknown
}

/** Totales de un día del calendario. */
export interface DayTotals {
  income: number
  expense: number
  pending: number
  count: number
}

export interface CategoryTotal {
  category: string
  total: number
  count: number
  share: number
}

/** Un correo que trae el agente del PC. */
export interface AgentMail {
  id: string
  from: string
  subject: string
  date?: string
  text: string
}

export type AgentStatus =
  | { configured: true, mailbox: { host: string, user: string, folder: string, from: string }, version: string }
  | { configured: false, code?: string, version: string }

export interface AgentPull {
  mails: AgentMail[]
  cursor: unknown
}

/** Una sesión abierta con el agente del correo (lib/mailbox.js). */
export interface AgentSession {
  status (): Promise<AgentStatus>
  pull (cursor?: unknown): Promise<AgentPull>
  close (): Promise<void>
}

export interface Toast {
  message: string
  kind: 'info' | 'error' | (string & {})
}

export type RemindersSync =
  | { state: 'syncing' }
  | { state: 'ok', scheduled: number }
  | { state: 'error', error: unknown }

/** Lo que abre el formulario: un movimiento (nuevo o guardado), y si viene a revisarse. */
export interface FormMovement extends MovementDraft {
  /** Vino de una frase o de un correo: el título dice que se revisa. */
  review?: boolean
  /** En qué se apoyó el lector (lib/parse.js); el formulario no lo guarda. */
  hints?: string[]
}
