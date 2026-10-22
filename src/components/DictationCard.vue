<script setup>
// Dictado: apagado, Whisper en este aparato, o la IA del usuario. Cada opción dice adónde va
// la voz. «Con tu IA» se ve siempre, deshabilitada con el motivo cuando no se puede.
import { ref, computed } from 'vue'
import { LOCAL_MODEL } from '@dotrino/dictation'
import { t, errorText } from '../i18n.js'
import { state, refreshSettings, toast } from '../state.js'
import { savePrefs } from '../lib/repo.js'

const info = ref(false)
const busy = ref(false)

const providerBlock = computed(() => {
  if (!state.ai.configured) return t('dictation.providerNoAi')
  if (!state.ai.canTranscribe) return t('dictation.providerCannot', { label: state.ai.label })
  return ''
})

const help = computed(() => {
  if (state.prefs.dictation === 'local') return t('dictation.localHelp', { size: LOCAL_MODEL.sizeMB })
  if (state.prefs.dictation === 'provider') return providerBlock.value || t('dictation.providerHelp', { label: state.ai.label })
  return ''
})

async function choose (mode) {
  if (mode === state.prefs.dictation || busy.value) return
  busy.value = true
  try {
    await savePrefs({ ...state.prefs, dictation: mode })
    await refreshSettings()
    toast(t('dictation.saved', { mode: t(`dictation.${mode}`) }))
  } catch (e) {
    console.error('[expenses] save dictation:', e)
    toast(errorText(e), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card stack" data-testid="dictation-card">
    <h2 class="label-row">
      <span>{{ t('dictation.title') }}</span>
      <button type="button" class="i" :aria-expanded="info" :aria-label="t('settings.info')" @click="info = !info">i</button>
    </h2>
    <p v-if="info" class="info-text">{{ t('dictation.info') }}</p>

    <div class="seg" role="radiogroup" :aria-label="t('dictation.title')">
      <button
        v-for="mode in ['off', 'local', 'provider']"
        :key="mode"
        type="button"
        role="radio"
        :aria-checked="state.prefs.dictation === mode"
        :class="{ on: state.prefs.dictation === mode }"
        :disabled="busy || (mode === 'provider' && !!providerBlock)"
        :title="mode === 'provider' ? providerBlock : ''"
        :data-testid="`dictation-${mode}`"
        @click="choose(mode)"
      >{{ t(`dictation.${mode}`) }}</button>
    </div>
    <p v-if="help" class="info-text" data-testid="dictation-help">{{ help }}</p>
    <p v-else-if="providerBlock" class="info-text small">{{ t('dictation.provider') }}: {{ providerBlock }}</p>
  </section>
</template>

<style scoped>
.seg { display: flex; flex-wrap: wrap; gap: .4rem; }
.seg button {
  border: 1px solid var(--dt-line); background: var(--dt-surface); color: var(--dt-text);
  border-radius: var(--dt-radius-pill); padding: .4rem .9rem; font: inherit; cursor: pointer;
}
.seg button.on { background: var(--dt-accent); border-color: var(--dt-accent); color: var(--dt-accent-ink); }
.seg button:disabled { opacity: .5; cursor: not-allowed; }
</style>
