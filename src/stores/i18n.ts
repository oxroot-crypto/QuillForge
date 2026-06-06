// 国际化 Store——语言偏好持久化到 localStorage，切换时同步 vue-i18n locale。
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Locale } from '@/types'

export const useI18nStore = defineStore('i18n', () => {
  // ===== 核心状态 =====
  /** 当前界面语言——从 localStorage 读取，默认简体中文 */
  const locale = ref<Locale>(
    (localStorage.getItem('quillforge-locale') as Locale) || 'zh-CN',
  )

  // ===== 语言切换 =====
  /** 设置界面语言并持久化 */
  function setLocale(l: Locale) {
    locale.value = l
    localStorage.setItem('quillforge-locale', l)
  }

  /** 中/英文循环切换 */
  function toggleLocale() {
    locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
    localStorage.setItem('quillforge-locale', locale.value)
  }

  // ===== 导出 =====
  return { locale, setLocale, toggleLocale }
})
