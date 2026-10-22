<script setup>
// «Por confirmar»: lo que llega del correo. Aquí se pega un aviso del banco, se lee (con la IA
// del usuario si la hay, si no con el lector genérico) y queda en la bandeja hasta que el
// usuario lo acepta, lo corrige o lo descarta. Nada de esto entra solo al registro.
import { ref } from 'vue'
import { t, lang, errorText, formatDate } from '../i18n.js'
import { state, categories, categoryName, categoryIcon, money, refreshInbox, toast } from '../state.js'
import { addToInbox, acceptInboxItem, closeInboxItem } from '../lib/repo.js'
import { parseBankMail, mailText, mailFingerprint } from '../lib/mail.js'
import { parseMailWithAi } from '../lib/ai.js'
import { dayToDate, localDay } from '../lib/dates.js'
import MovementForm from './MovementForm.vue'

const info = ref(false)
const pasted = ref('')
const busy = ref(false)
const problem = ref('')
const open = ref(null)        // id de la entrada con el correo a la vista
const editing = ref(null)     // { item, movement } en el formulario

async function read () {
  problem.value = ''
  const raw = pasted.value.trim()
  if (!raw) return
  busy.value = true
  try {
    const text = mailText(raw)
    const today = localDay()
    let found = null
    let engine = 'rules'
    if (state.ai.configured) {
      try {
        found = await parseMailWithAi(text, { today, categories: categories(), lang: lang.value })
        engine = 'ai'
      } catch (e) {
        console.error('[expenses] ai mail parse:', e)
        toast(t('ai.fellBack', { label: state.ai.label, reason: errorText(e) }), 'error')
      }
    }
    if (engine === 'rules') {
      const parsed = parseBankMail(text, { today })
      if (parsed) {
        const { hints, ...rest } = parsed
        found = rest
      }
    }
    if (!found) {
      problem.value = t('inbox.noMovement')
      return
    }
    const { bank, ...movement } = found
    const res = await addToInbox({ fingerprint: await mailFingerprint(text), source: 'paste', movement, bank, excerpt: text, engine })
    if (!res.added) {
      problem.value = t(`inbox.already.${res.status}`)
      return
    }
    pasted.value = ''
    await refreshInbox()
    toast(t('inbox.added'))
  } catch (e) {
    console.error('[expenses] read mail:', e)
    toast(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}

async function accept (item, movement) {
  try {
    await acceptInboxItem(item, movement)
    await refreshInbox()
    toast(t('inbox.accepted'))
  } catch (e) {
    console.error('[expenses] accept mail:', e)
    toast(errorText(e), 'error')
  }
}

async function discard (item) {
  try {
    await closeInboxItem(item, 'discarded')
    await refreshInbox()
  } catch (e) {
    console.error('[expenses] discard mail:', e)
    toast(errorText(e), 'error')
  }
}

function review (item) {
  editing.value = { item, movement: { ...item.movement, source: 'mail', review: true } }
}

// El formulario guarda el movimiento él mismo; aquí solo se cierra la entrada de la bandeja.
async function onReviewed () {
  const { item } = editing.value
  editing.value = null
  try {
    await closeInboxItem(item, 'accepted')
    await refreshInbox()
    toast(t('inbox.accepted'))
  } catch (e) {
    console.error('[expenses] close reviewed mail:', e)
    toast(errorText(e), 'error')
  }
}
</script>

<template>
  <section class="stack" data-testid="inbox-view">
    <div class="card stack">
      <h2 class="label-row">
        <span>{{ t('inbox.pasteTitle') }}</span>
        <button type="button" class="i" :aria-expanded="info" :aria-label="t('settings.info')" @click="info = !info">i</button>
      </h2>
      <p v-if="info" class="info-text">{{ t('inbox.info') }}</p>
      <textarea v-model="pasted" rows="5" :placeholder="t('inbox.pastePlaceholder')" data-testid="mail-paste"></textarea>
      <p v-if="state.ai.configured" class="banner warn small" data-testid="mail-ai-note">{{ t('inbox.aiNote', { label: state.ai.label }) }}</p>
      <p v-if="problem" class="problem" role="alert" data-testid="mail-problem">{{ problem }}</p>
      <div class="actions">
        <button type="button" class="btn primary" :disabled="!pasted.trim() || busy" data-testid="mail-read" @click="read">{{ busy ? t('ai.thinking') : t('inbox.read') }}</button>
      </div>
    </div>

    <h3>{{ t('inbox.pending') }}</h3>
    <p v-if="!state.inbox.length" class="muted" data-testid="inbox-empty">{{ t('inbox.empty') }}</p>

    <ul class="movements" data-testid="inbox-list">
      <li v-for="item in state.inbox" :key="item.id" class="stack-tight">
        <div class="movement pending" :data-inbox-id="item.id" data-testid="inbox-item">
          <span class="ico" aria-hidden="true">{{ categoryIcon(item.movement.category) }}</span>
          <span class="body">
            <span class="note">{{ item.movement.note || categoryName(item.movement.category) }}</span>
            <span class="meta">
              <span>{{ formatDate(dayToDate(item.movement.date), { day: 'numeric', month: 'short', timeZone: 'UTC' }) }}</span>
              <span>· {{ categoryName(item.movement.category) }}</span>
              <span v-if="item.bank" class="chip">{{ item.bank }}</span>
              <span class="chip">{{ item.engine === 'ai' ? t('inbox.byAi') : t('inbox.byRules') }}</span>
            </span>
          </span>
          <span class="amount" :class="item.movement.type" data-testid="inbox-amount">{{ money(item.movement.type === 'income' ? item.movement.amount : -item.movement.amount, { signed: true }) }}</span>
        </div>
        <div class="row wrap">
          <button type="button" class="btn small primary" data-testid="inbox-accept" @click="accept(item)">{{ t('inbox.accept') }}</button>
          <button type="button" class="btn small" data-testid="inbox-review" @click="review(item)">{{ t('inbox.review') }}</button>
          <button type="button" class="btn small ghost" data-testid="inbox-discard" @click="discard(item)">{{ t('inbox.discard') }}</button>
          <span class="grow"></span>
          <button v-if="item.excerpt" type="button" class="btn small ghost" :aria-expanded="open === item.id" data-testid="inbox-show" @click="open = open === item.id ? null : item.id">{{ t('inbox.showMail') }}</button>
        </div>
        <pre v-if="open === item.id" class="excerpt" data-testid="inbox-excerpt">{{ item.excerpt }}</pre>
      </li>
    </ul>

    <MovementForm v-if="editing" :movement="editing.movement" @saved="onReviewed" @close="editing = null" />
  </section>
</template>

<style scoped>
textarea { width: 100%; font: inherit; border: 1px solid var(--dt-line); border-radius: var(--dt-radius-sm); padding: .6rem; background: var(--dt-surface); color: var(--dt-text); resize: vertical; }
.stack-tight { display: flex; flex-direction: column; gap: .35rem; }
.row.wrap { flex-wrap: wrap; }
.excerpt { white-space: pre-wrap; font-family: var(--dt-font-mono); font-size: .78rem; background: var(--dt-surface-2); border-radius: var(--dt-radius-sm); padding: .6rem; margin: 0; max-height: 14rem; overflow: auto; }
</style>
