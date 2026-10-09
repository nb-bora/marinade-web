<!--
  `AppImportSection` dans une fenêtre : le bouton « Importer » d'une liste l'ouvre, sans quitter l'écran.
  La fenêtre ne peut pas être fermée pendant l'envoi (Échap et clic à côté sont ignorés).
-->
<script setup lang="ts">
import { useDisplay } from 'vuetify'
import type { ImportData, ImportResult, ImportSheetSpec, ImportTick } from '@/lib/sheetImport'

defineProps<{
  title: string
  description?: string
  fileName: string
  sheets: ImportSheetSpec[]
  notes?: string[]
  run: (data: ImportData, tick: ImportTick) => Promise<ImportResult>
}>()

const emit = defineEmits<{ imported: [result: ImportResult] }>()

const open = defineModel<boolean>({ required: true })
const { smAndDown } = useDisplay()
const busy = ref(false)

async function guarded(runner: () => Promise<ImportResult>) {
  busy.value = true
  try {
    return await runner()
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <VDialog
    v-model="open"
    max-width="900"
    :fullscreen="smAndDown"
    :persistent="busy"
    scrollable
  >
    <div class="import-dialog">
      <IconBtn
        class="import-dialog__close"
        aria-label="Fermer la fenêtre d'import"
        :disabled="busy"
        @click="open = false"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
      <AppImportSection
        class="import-dialog__card"
        :title="title"
        :description="description"
        :file-name="fileName"
        :sheets="sheets"
        :notes="notes"
        :run="(data, tick) => guarded(() => run(data, tick))"
        @imported="emit('imported', $event)"
      />
    </div>
  </VDialog>
</template>

<style scoped>
.import-dialog {
  position: relative;
  overflow: auto;
  max-block-size: 100%;
}

.import-dialog__close {
  position: absolute;
  z-index: 2;
  inset-block-start: 14px;
  inset-inline-end: 14px;
}

.import-dialog__card {
  min-block-size: 100%;
}
</style>
