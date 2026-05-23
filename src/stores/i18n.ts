import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export type Locale = 'zh-CN' | 'en-US'

export const useI18nStore = defineStore('i18n', () => {
  const locale = ref<Locale>(
    (localStorage.getItem('quillforge-locale') as Locale) || 'zh-CN',
  )

  function setLocale(l: Locale) {
    locale.value = l
    localStorage.setItem('quillforge-locale', l)
  }

  function toggleLocale() {
    locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
    localStorage.setItem('quillforge-locale', locale.value)
  }

  return { locale, setLocale, toggleLocale }
})
