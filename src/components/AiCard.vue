<script setup>
// La llave de IA del usuario: elegir proveedor, ponerla, probarla, guardarla sellada, quitarla.
// La llave escrita vive solo en este formulario mientras está abierto; guardada, va sellada.
import { ref, computed } from 'vue'
import { t, errorText } from '../i18n.js'
import { state, refreshAi, toast } from '../state.js'
import { PROVIDERS, PROVIDER_KEYS, testAi, saveAi, forgetAi } from '../lib/ai.js'

const info = ref(false)
const editing = ref(false)
const form = ref(null)
const busy = ref('')          // '' | 'test' | 'save' | 'remove'
const problem = ref('')

const preset = computed(() => form.value ? PROVIDERS[form.value.provider] : null)
const needsKey = computed(() => preset.value && !preset.value.keyless)
const showBaseUrl = computed(() => form.value?.provider === 'custom' || form.value?.provider === 'ollama')
const label = computed(() => preset.value?.label || '')

function open () {
  form.value = { provider: state.ai.provider || 'openai', apiKey: '', model: '', baseUrl: '' }
  problem.value = ''
  editing.value = true
}

function close () {
  editing.value = false
  form.value = null
  problem.value = ''
}

async function run (kind, fn) {
  busy.value = kind
  problem.value = ''
  try {
    await fn()
  } catch (e) {
    console.error(`[expenses] ai ${kind}:`, e)
    problem.value = errorText(e)
  } finally {
    busy.value = ''
  }
}

const test = () => run('test', async () => {
  const info = await testAi(form.value)
  toast(t('ai.testOk', { label: info.label }))
})

const save = () => run('save', async () => {
  await saveAi(form.value)
  await refreshAi()
  toast(t('ai.saved'))
  close()
})

const remove = () => run('remove', async () => {
  await forgetAi()
  await refreshAi()
  toast(t('ai.removed'))
  close()
})
</script>

<template>
  <section class="card stack" data-testid="ai-card">
    <h2 class="label-row">
      <span>{{ t('ai.title') }}</span>
      <button type="button" class="i" :aria-expanded="info" :aria-label="t('settings.info')" @click="info = !info">i</button>
    </h2>
    <p v-if="info" class="info-text">{{ t('ai.info') }}</p>

    <p v-if="state.aiError" class="banner error" data-testid="ai-error">{{ errorText(state.aiError) }}</p>

    <div v-if="!editing" class="row between">
      <span data-testid="ai-status">{{ state.ai.configured ? t('ai.active', { label: state.ai.label, model: state.ai.model }) : t('ai.none') }}</span>
      <button type="button" class="btn small" data-testid="ai-edit" @click="open">{{ state.ai.configured ? t('ai.change') : t('ai.configure') }}</button>
    </div>

    <form v-else class="stack" data-testid="ai-form" @submit.prevent="save">
      <div class="grid">
        <label class="field">
          <span>{{ t('ai.provider') }}</span>
          <select v-model="form.provider" data-testid="ai-provider">
            <option v-for="k in PROVIDER_KEYS" :key="k" :value="k">{{ PROVIDERS[k].label }}</option>
          </select>
        </label>
        <label v-if="needsKey" class="field">
          <span>{{ t('ai.apiKey') }}</span>
          <input v-model="form.apiKey" type="password" autocomplete="off" spellcheck="false" data-testid="ai-key" />
        </label>
        <label class="field">
          <span>{{ t('ai.model') }}</span>
          <input v-model="form.model" :placeholder="preset?.model || ''" autocomplete="off" spellcheck="false" data-testid="ai-model" />
        </label>
        <label v-if="showBaseUrl" class="field wide">
          <span>{{ t('ai.baseUrl') }}</span>
          <input v-model="form.baseUrl" :placeholder="preset?.baseUrl || 'https://…/v1'" inputmode="url" spellcheck="false" data-testid="ai-base-url" />
        </label>
      </div>
      <p v-if="preset?.keyUrl" class="small"><a :href="preset.keyUrl" target="_blank" rel="noopener">{{ t('ai.getKey') }}</a></p>
      <p class="banner warn small" data-testid="ai-warning">{{ t('ai.warning', { label }) }}</p>
      <p v-if="form.provider === 'ollama'" class="info-text">{{ t('ai.ollamaHint') }}</p>
      <p v-if="problem" class="problem" role="alert" data-testid="ai-problem">{{ problem }}</p>

      <div class="actions">
        <button v-if="state.ai.configured" type="button" class="btn ghost danger" :disabled="!!busy" data-testid="ai-remove" @click="remove">{{ t('ai.remove') }}</button>
        <span class="grow"></span>
        <button type="button" class="btn ghost" :disabled="!!busy" @click="close">{{ t('form.cancel') }}</button>
        <button type="button" class="btn" :disabled="!!busy || (needsKey && !form.apiKey.trim())" data-testid="ai-test" @click="test">{{ busy === 'test' ? t('ai.testing') : t('ai.test') }}</button>
        <button type="submit" class="btn primary" :disabled="!!busy || (needsKey && !form.apiKey.trim())" data-testid="ai-save">{{ t('ai.save') }}</button>
      </div>
    </form>
  </section>
</template>
