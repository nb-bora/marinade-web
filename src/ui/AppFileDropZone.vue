<!--
  Zone de dépôt d'un classeur (.xlsx, .xls, .csv) : glisser-déposer ou clic pour parcourir.
  Le fichier est lu dans le navigateur ; on émet le classeur lu et on en montre un aperçu.
-->
<script setup lang="ts">
import { SpreadsheetError, readWorkbook } from '@/lib/spreadsheet'
import type { Workbook } from '@/lib/spreadsheet'

const props = withDefaults(defineProps<{
  accept?: string

  /** Un envoi est en cours : la zone est figée et affiche un indicateur. */
  loading?: boolean
  previewRows?: number
}>(), {
  accept: '.xlsx,.xls,.csv',
  loading: false,
  previewRows: 8,
})

const emit = defineEmits<{ loaded: [workbook: Workbook]; cleared: [] }>()

const workbook = ref<Workbook | null>(null)
const activeSheet = ref(0)
const dragging = ref(false)
const reading = ref(false)
const error = ref('')
const input = ref<HTMLInputElement>()

const sheet = computed(() => workbook.value?.sheets[activeSheet.value])
const header = computed(() => sheet.value?.rows[0] ?? [])
const body = computed(() => (sheet.value?.rows.slice(1, props.previewRows + 1) ?? []))
const columnCount = computed(() => Math.max(0, ...(sheet.value?.rows.slice(0, props.previewRows + 1).map(row => row.length) ?? [])))
const hiddenRows = computed(() => Math.max(0, (sheet.value?.rows.length ?? 0) - 1 - props.previewRows))

async function open(file: File | undefined) {
  if (!file || props.loading)
    return

  reading.value = true
  error.value = ''

  try {
    workbook.value = await readWorkbook(file)
    activeSheet.value = 0
    emit('loaded', workbook.value)
  }
  catch (cause) {
    workbook.value = null
    error.value = cause instanceof SpreadsheetError ? cause.message : 'Ce fichier n\'a pas pu être lu. Vérifiez qu\'il n\'est pas endommagé.'
    emit('cleared')
  }
  finally {
    reading.value = false
    if (input.value)
      input.value.value = ''
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  open(event.dataTransfer?.files[0])
}

function clear() {
  workbook.value = null
  error.value = ''
  emit('cleared')
}

function browse() {
  if (!props.loading)
    input.value?.click()
}
</script>

<template>
  <div class="file-drop-zone">
    <div
      class="file-drop-zone__target pa-8 text-center"
      :class="{ 'file-drop-zone__target--active': dragging, 'file-drop-zone__target--busy': loading }"
      role="button"
      tabindex="0"
      aria-label="Déposer un fichier ou parcourir vos dossiers"
      @click="browse"
      @keydown.enter.prevent="browse"
      @keydown.space.prevent="browse"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <VProgressCircular
        v-if="reading || loading"
        indeterminate
        color="primary"
        class="mb-3"
      />
      <VIcon
        v-else
        icon="ri-upload-cloud-2-line"
        size="40"
        color="primary"
        class="mb-3"
      />
      <div class="text-body-1 font-weight-medium">
        {{ loading ? 'Import en cours...' : 'Glissez votre fichier ici, ou cliquez pour le choisir' }}
      </div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        Formats acceptés : Excel (.xlsx) et CSV (.csv)
      </div>
      <input
        ref="input"
        type="file"
        class="d-none"
        :accept="accept"
        tabindex="-1"
        aria-label="Choisir un fichier"
        @change="open(($event.target as HTMLInputElement).files?.[0])"
      >
    </div>

    <VAlert
      v-if="error"
      type="error"
      variant="tonal"
      class="mt-4"
    >
      {{ error }}
    </VAlert>

    <div
      v-if="workbook"
      class="mt-5"
    >
      <div class="d-flex align-center flex-wrap gap-2 mb-3">
        <VIcon icon="ri-file-excel-2-line" />
        <span class="font-weight-medium text-truncate">{{ workbook.fileName }}</span>
        <VSpacer />
        <VBtn
          size="small"
          variant="text"
          color="secondary"
          :disabled="loading"
          @click="clear"
        >
          Retirer
        </VBtn>
      </div>

      <VTabs
        v-if="workbook.sheets.length > 1"
        v-model="activeSheet"
        density="compact"
        class="mb-2"
      >
        <VTab
          v-for="(item, index) in workbook.sheets"
          :key="item.name"
          :value="index"
        >
          {{ item.name }}
        </VTab>
      </VTabs>

      <div class="file-drop-zone__scroll">
        <VTable density="compact">
          <thead>
            <tr>
              <th
                v-for="column in columnCount"
                :key="column"
              >
                {{ header[column - 1] }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in body"
              :key="rowIndex"
            >
              <td
                v-for="column in columnCount"
                :key="column"
                class="text-no-wrap"
              >
                {{ row[column - 1] }}
              </td>
            </tr>
            <tr v-if="body.length === 0">
              <td
                :colspan="Math.max(columnCount, 1)"
                class="text-medium-emphasis text-center"
              >
                Cette feuille ne contient aucune ligne.
              </td>
            </tr>
          </tbody>
        </VTable>
      </div>
      <p
        v-if="hiddenRows > 0"
        class="text-caption text-medium-emphasis mt-2 mb-0"
      >
        ... et {{ hiddenRows }} autre{{ hiddenRows > 1 ? 's' : '' }} ligne{{ hiddenRows > 1 ? 's' : '' }}.
      </p>
    </div>
  </div>
</template>

<style scoped>
.file-drop-zone__target {
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.file-drop-zone__target:hover,
.file-drop-zone__target:focus-visible,
.file-drop-zone__target--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
  outline: none;
}

.file-drop-zone__target--busy {
  pointer-events: none;
  opacity: 0.7;
}

.file-drop-zone__scroll {
  overflow-x: auto;
}
</style>
