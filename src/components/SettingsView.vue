<script setup>
// Ajustes: dónde están los datos, la moneda y las categorías propias.
import { ref, computed } from 'vue'
import { t, lang, errorText } from '../i18n.js'
import { state, categories, refreshSettings, toast } from '../state.js'
import { savePrefs, saveCustomCategory, removeCustomCategory } from '../lib/repo.js'
import { DEFAULT_CATEGORIES, categoryLabel, slugify } from '../lib/categories.js'
import BackupCard from './BackupCard.vue'

const CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'PEN', 'ARS', 'CLP', 'BRL', 'GBP']

const info = ref(false)
const aboutOpen = ref(false)
const newName = ref('')
const newKind = ref('expense')
const newIcon = ref('')
const problem = ref('')

const all = computed(() => categories())
const isCustom = (c) => !DEFAULT_CATEGORIES.some((d) => d.key === c.key)

async function changeCurrency (e) {
  try {
    await savePrefs({ ...state.prefs, currency: e.target.value })
    await refreshSettings()
    toast(t('settings.saved'))
  } catch (err) {
    console.error('[expenses] save prefs:', err)
    toast(errorText(err), 'error')
  }
}

async function addCategory () {
  problem.value = ''
  const name = newName.value.trim()
  const key = slugify(name)
  if (!key) return
  if (all.value.some((c) => c.key === key || categoryLabel(c, lang.value).toLowerCase() === name.toLowerCase())) {
    problem.value = t('settings.categoryExists')
    return
  }
  try {
    await saveCustomCategory({ key, kind: newKind.value, icon: newIcon.value.trim() || '🏷️', label: name })
    await refreshSettings()
    newName.value = ''
    newIcon.value = ''
    toast(t('settings.saved'))
  } catch (e) {
    console.error('[expenses] save category:', e)
    toast(errorText(e), 'error')
  }
}

async function remove (c) {
  try {
    await removeCustomCategory(c.key)
    await refreshSettings()
    toast(t('settings.saved'))
  } catch (e) {
    console.error('[expenses] remove category:', e)
    toast(errorText(e), 'error')
  }
}
</script>

<template>
  <section class="stack" data-testid="settings-view">
    <BackupCard />

    <section class="card stack">
      <h2>{{ t('settings.currency') }}</h2>
      <label class="field">
        <select :value="state.prefs.currency" data-testid="currency" @change="changeCurrency">
          <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <span class="info-text">{{ t('settings.currencyHelp') }}</span>
      </label>
    </section>

    <section class="card stack">
      <h2 class="label-row">
        <span>{{ t('settings.categories') }}</span>
        <button type="button" class="i" :aria-expanded="info" :aria-label="t('settings.info')" @click="info = !info">i</button>
      </h2>
      <p v-if="info" class="info-text">{{ t('settings.categoriesInfo') }}</p>

      <div class="cat-list" data-testid="category-list">
        <span v-for="c in all" :key="c.key" class="cat-chip" :data-category="c.key">
          {{ c.icon }} {{ categoryLabel(c, lang) }}
          <button v-if="isCustom(c)" type="button" :aria-label="t('settings.removeCategory', { name: categoryLabel(c, lang) })" data-testid="category-remove" @click="remove(c)">✕</button>
        </span>
      </div>

      <form class="grid" @submit.prevent="addCategory">
        <label class="field">
          <span>{{ t('settings.categoryName') }}</span>
          <input v-model="newName" data-testid="category-name" />
        </label>
        <label class="field">
          <span>{{ t('settings.categoryKind') }}</span>
          <select v-model="newKind" data-testid="category-kind">
            <option value="expense">{{ t('form.expense') }}</option>
            <option value="income">{{ t('form.income') }}</option>
          </select>
        </label>
        <label class="field">
          <span>{{ t('settings.categoryIcon') }}</span>
          <input v-model="newIcon" maxlength="4" data-testid="category-icon" />
        </label>
        <div class="actions start wide">
          <button type="submit" class="btn" :disabled="!newName.trim()" data-testid="category-add">{{ t('settings.addCategory') }}</button>
          <span v-if="problem" class="problem">{{ problem }}</span>
        </div>
      </form>
    </section>

    <section class="card stack">
      <h2 class="label-row">
        <span>{{ t('settings.about') }}</span>
        <button type="button" class="i" :aria-expanded="aboutOpen" :aria-label="t('settings.info')" @click="aboutOpen = !aboutOpen">i</button>
      </h2>
      <p v-if="aboutOpen" class="info-text">{{ t('settings.aboutText') }}</p>
    </section>
  </section>
</template>
