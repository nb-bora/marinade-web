<!-- Codes de secours affichés en grille, avec copie et téléchargement. -->
<script setup lang="ts">
import { useRecoveryCodesExport } from '../composables/useRecoveryCodesExport'
import { useSessionStore } from '@/stores/session.store'

const props = defineProps<{
  codes: string[]
}>()

const session = useSessionStore()
const { copy, download } = useRecoveryCodesExport(() => props.codes, () => session.user?.email ?? '')
</script>

<template>
  <VCard
    variant="tonal"
    class="pa-3"
  >
    <div class="d-flex flex-wrap align-center justify-space-between gap-2 mb-2">
      <span class="text-subtitle-2">Codes de secours</span>
      <div class="d-flex gap-1">
        <VBtn
          size="small"
          variant="text"
          prepend-icon="ri-file-copy-line"
          @click="copy"
        >
          Copier
        </VBtn>
        <VBtn
          size="small"
          variant="text"
          prepend-icon="ri-download-2-line"
          @click="download"
        >
          Télécharger
        </VBtn>
      </div>
    </div>
    <div class="recovery-grid">
      <code
        v-for="item in codes"
        :key="item"
      >{{ item }}</code>
    </div>
  </VCard>
</template>

<style scoped>
.recovery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 1rem;
  font-size: 0.8125rem;
}
</style>
