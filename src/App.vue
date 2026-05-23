<template>
  <AppLayout
    @openSettings="showSettings = true"
  />
  <SettingsDialog
    :visible="showSettings"
    @close="showSettings = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/common/AppLayout.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useSettingsStore } from '@/stores/settings'
import { useI18nStore } from '@/stores/i18n'
import { useBookStore } from '@/stores/book'

const showSettings = ref(false)
const { locale } = useI18n()
const settingsStore = useSettingsStore()
const i18nStore = useI18nStore()
const bookStore = useBookStore()

locale.value = i18nStore.locale as 'zh-CN' | 'en-US'

onMounted(async () => {
  await settingsStore.loadProviders()
  await settingsStore.refreshKeyStatus()

  await bookStore.loadFromDisk()

  if (bookStore.books.length === 0) {
    bookStore.createBook('我的第一本书')
  }
})
</script>
