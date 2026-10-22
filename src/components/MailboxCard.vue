<script setup>
// Tu buzón por el agente del PC. Al abrir la pestaña se buscan los agentes encendidos de la
// cuenta y se les pide lo nuevo; lo que llega cae en «Por confirmar». Las credenciales del
// correo nunca pasan por aquí: las tiene tu bóveda y las usa el agente.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import { t, lang, errorText } from '../i18n.js'
import { state, refreshInbox, toast } from '../state.js'
import { findAgents, openAgent } from '../lib/mailbox.js'
import { importAgentMails } from '../lib/inbox.js'
import { readMailCursor, saveMailCursor } from '../lib/repo.js'

const WIKI = computed(() => lang.value === 'es' ? 'https://wiki.dotrino.com/apps/gastos/#correo' : 'https://wiki.dotrino.com/en/apps/gastos/#email')

const phase = ref('checking')   // checking | unpaired | expired | none | ready | error
const problem = ref('')
const boxes = ref([])           // [{ sub, label, status, busy, note, problem }]
const sessions = new Map()      // sub → sesión abierta (fuera de Vue: lleva llaves)
const busy = ref(false)

async function discover () {
  phase.value = 'checking'
  problem.value = ''
  try {
    const found = await findAgents()
    if (found.state === 'unpaired') {
      phase.value = found.expired ? 'expired' : 'unpaired'
      return
    }
    if (!found.agents.length) {
      phase.value = 'none'
      return
    }
    boxes.value = found.agents.map((a) => ({ sub: a.sub, label: a.label, status: null, busy: false, note: '', problem: '' }))
    phase.value = 'ready'
    for (const box of boxes.value) {
      try {
        const s = await openAgent(found.link, box)
        sessions.set(box.sub, s)
        box.status = await s.status()
      } catch (e) {
        console.error('[expenses] agent status:', e)
        box.problem = errorText(e)
      }
    }
    await pullAll()
  } catch (e) {
    console.error('[expenses] find agents:', e)
    phase.value = 'error'
    problem.value = errorText(e)
  }
}

async function pull (box) {
  const s = sessions.get(box.sub)
  if (!s || !box.status?.configured) return
  box.busy = true
  box.problem = ''
  try {
    const { mails, cursor } = await s.pull(await readMailCursor(box.sub))
    const res = await importAgentMails(mails)
    // El cursor avanza DESPUÉS de meterlos en la bandeja: si algo falla antes, la siguiente
    // vez se vuelven a pedir los mismos.
    await saveMailCursor(box.sub, cursor)
    if (res.aiError) toast(t('ai.fellBack', { label: state.ai.label, reason: errorText(res.aiError) }), 'error')
    box.note = res.added ? t('mailbox.added', { count: res.added }) : t('mailbox.nothingNew')
    if (res.added) await refreshInbox()
  } catch (e) {
    console.error('[expenses] pull mail:', e)
    box.problem = errorText(e)
  } finally {
    box.busy = false
  }
}

async function pullAll () {
  busy.value = true
  try {
    for (const box of boxes.value) await pull(box)
  } finally {
    busy.value = false
  }
}

onMounted(discover)
onBeforeUnmount(() => {
  for (const s of sessions.values()) s.close().catch(() => {})
  sessions.clear()
})
</script>

<template>
  <section class="card stack" data-testid="mailbox-card">
    <h2>{{ t('mailbox.title') }}</h2>

    <p v-if="phase === 'checking'" class="info-text" data-testid="mailbox-checking">{{ t('mailbox.checking') }}</p>
    <p v-else-if="phase === 'unpaired' || phase === 'expired'" class="info-text" data-testid="mailbox-unpaired">
      {{ t(phase === 'expired' ? 'mailbox.expired' : 'mailbox.unpaired') }}
      <a href="https://profile.dotrino.com/" target="_blank" rel="noopener">{{ t('mailbox.linkVault') }}</a>
    </p>
    <p v-else-if="phase === 'none'" class="info-text" data-testid="mailbox-none">
      {{ t('mailbox.none') }} <a :href="WIKI" target="_blank" rel="noopener">{{ t('mailbox.how') }}</a>
    </p>
    <p v-else-if="phase === 'error'" class="problem" role="alert" data-testid="mailbox-error">{{ problem }}</p>

    <template v-else>
      <div v-for="box in boxes" :key="box.sub" class="stack-tight" data-testid="mailbox" :data-agent="box.sub">
        <p v-if="box.status?.configured" data-testid="mailbox-status">
          {{ t('mailbox.reading', { user: box.status.mailbox.user, folder: box.status.mailbox.folder }) }}
          <span v-if="box.label" class="chip">{{ box.label }}</span>
        </p>
        <p v-else-if="box.status" class="info-text" data-testid="mailbox-unconfigured">
          {{ t('mailbox.unconfigured') }} <a :href="WIKI" target="_blank" rel="noopener">{{ t('mailbox.how') }}</a>
        </p>
        <p v-if="box.problem" class="problem" role="alert" data-testid="mailbox-problem">{{ box.problem }}</p>
        <p v-else-if="box.busy" class="info-text">{{ t('mailbox.pulling') }}</p>
        <p v-else-if="box.note" class="info-text" data-testid="mailbox-note">{{ box.note }}</p>
      </div>
    </template>

    <div class="actions">
      <button v-if="phase !== 'ready'" type="button" class="btn small" :disabled="phase === 'checking'" data-testid="mailbox-retry" @click="discover">{{ t('mailbox.retry') }}</button>
      <button v-else type="button" class="btn small primary" :disabled="busy || !boxes.some((b) => b.status?.configured)" data-testid="mailbox-pull" @click="pullAll">{{ busy ? t('mailbox.pulling') : t('mailbox.pull') }}</button>
    </div>
  </section>
</template>

<style scoped>
.stack-tight { display: flex; flex-direction: column; gap: .25rem; }
</style>
