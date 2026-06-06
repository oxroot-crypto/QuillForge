// 国际化 Store——语言偏好持久化到 localStorage，切换时同步 vue-i18n locale。
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
