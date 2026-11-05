// Tipos de los pilares que todavía no publican su .d.ts (@dotrino/ai, @dotrino/dictation,
// @dotrino/remote-agent). Solo lo que usa esta app, copiado de su JSDoc. Cuando el pilar traiga
// sus tipos, esto se borra.

declare module '@dotrino/ai' {
  export interface ProviderPreset {
    family: string
    label: string
    baseUrl: string
    model: string
    transcribeModel?: string
    keyless?: boolean
    browser: boolean
    keyUrl?: string
  }
  export const PROVIDERS: Readonly<Record<string, ProviderPreset>>

  export interface AiInfo {
    provider: string
    label: string
    model: string
    baseUrl: string
    canTranscribe: boolean
  }
  export interface AskRequest {
    system?: string
    prompt?: string
    messages?: { role: 'user' | 'assistant', content: string }[]
    temperature?: number
    maxTokens?: number
    effort?: 'low' | 'medium' | 'high'
  }
  export interface AI {
    info: AiInfo
    ask (req: AskRequest): Promise<string>
    askJson (req: AskRequest & { schema?: object }): Promise<unknown>
    transcribe (audio: Blob, opts?: { language?: string, prompt?: string }): Promise<string>
  }
  export function createAI (opts: {
    provider: string
    apiKey?: string
    model?: string
    baseUrl?: string
    fetch?: typeof fetch
    timeoutMs?: number
  }): AI
}

declare module '@dotrino/dictation' {
  export const LOCAL_MODEL: Readonly<{ id: string, sizeMB: number, source: string }>
}

declare module '@dotrino/remote-agent/browser-link' {
  export type BrowserLink =
    | { paired: false, id: unknown, expired?: boolean, exp?: number }
    | { paired: true, id: unknown, cert: unknown, iss: string, proxy: string, deviceId: string, scope: string[] }
  export function linkFromIdentity (id: unknown): Promise<BrowserLink>
}

declare module '@dotrino/remote-agent/discover' {
  export interface AgentMember { sub: string, label: string, cn: string | null }
  export function listAgentsByLabel (id: unknown, label?: string): Promise<AgentMember[]>
  export function probeAgents (
    client: { on: Function, sendByPubkey: Function },
    subs: string[],
    opts?: { timeoutMs?: number },
  ): Promise<Map<string, { kind: string | null }>>
}

declare module '@dotrino/remote-agent/client' {
  export class RemoteAgentClient {
    constructor (link: object, opts: { agentPubkey: string, proxyUrl?: string })
    on (ev: 'message', cb: (payload: unknown) => void): () => void
    on (ev: 'error', cb: (err: Error & { code?: string }) => void): () => void
    on (ev: 'resumed', cb: () => void): () => void
    connect (): Promise<void>
    send (payload: object): Promise<void>
    close (): Promise<void>
  }
}
