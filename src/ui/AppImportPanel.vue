<!--
  Parcours d'import d'un classeur : dépôt du fichier, contrôle des feuilles et colonnes attendues,
  bouton « Importer », puis compte rendu avec les lignes refusées (feuille, ligne, champ, message).
  L'écran fournit les feuilles attendues et la fonction qui envoie les lignes au serveur.
-->
<script setup lang="ts">
import type { ImportData, ImportIssue, ImportResult, ImportSheetSpec } from '@/lib/sheetImport'
import { mapSheet, normalizeKey } from '@/lib/spreadsheet'
import type { MappedSheet, Workbook } from '@/lib/spreadsheet'

const props = defineProps<{
  sheets: ImportSheetSpec[]
  run: (data: ImportData) => Promise<ImportResult>
}>()

const emit = defineEmits<{ done: [result: ImportResult] }>()

const workbook = ref<Workbook | null>(null)
const importing = ref(false)
const failure = ref('')
const result = ref<ImportResult | null>(null)

/** Associe chaque feuille attendue à celle du classeur ; un CSV (une seule feuille) vaut pour la première attendue. */
const mapped = computed<Record<string, MappedSheet>>(() => {
  const book = workbook.value

  return Object.fromEntries(props.sheets.map((spec, index) => {
    const found = book?.sheets.find(sheet => normalizeKey(sheet.name) === normalizeKey(spec.name))
      ?? (book?.sheets.length === 1 && book.sheets[0]?.name === 'CSV' && index === 0 ? book.sheets[0] : undefined)

    return [spec.key, mapSheet(found, spec.columns)]
  }))
})

const problems = computed(() => props.sheets.flatMap(spec => {
  const item = mapped.value[spec.key]

  if (!workbook.value || !item)
    return []
  if (item.missingColumns.length > 0 && !(spec.optional && item.records.length === 0))
    return [`Feuille « ${spec.name} » : colonne${item.missingColumns.length > 1 ? 's' : ''} manquante${item.missingColumns.length > 1 ? 's' : ''} (${item.missingColumns.map(column => column.label).join(', ')}).`]

  return []
}))

const total = computed(() => Object.values(mapped.value).reduce((sum, item) => sum + item.records.length, 0))
const canImport = computed(() => workbook.value !== null && total.value > 0 && problems.value.length === 0 && !importing.value)

function onLoaded(loaded: Workbook) {
  workbook.value = loaded
  result.value = null
  failure.value = ''
}

function onCleared() {
  workbook.value = null
  result.value = null
  failure.value = ''
}

async function start() {
  if (!canImport.value)
    return

  importing.value = true
  failure.value = ''
  result.value = null

  try {
    result.value = await props.run(Object.fromEntries(Object.entries(mapped.value).map(([key, item]) => [key, item.records])))
    emit('done', result.value)
  }
  catch {
    failure.value = 'L\'import a été interrompu. Vérifiez votre connexion puis réessayez.'
  }
  finally {
    importing.value = false
  }
}

const issues = computed<ImportIssue[]>(() => result.value?.issues ?? [])
</script>

<template>
  <div>
    <VCard class="mb-6">
      <VCardItem>
        <VCardTitle>1. Choisissez votre fichier</VCardTitle>
        <VCardSubtitle class="text-wrap">
          Le classeur doit contenir
          <template
            v-for="(spec, index) in sheets"
            :key="spec.key"
          >
            <strong>{{ spec.name }}</strong>{{ index < sheets.length - 1 ? ', ' : '' }}
          </template>
          ; la première ligne de chaque feuille donne les titres des colonnes.
        </VCardSubtitle>
      </VCardItem>
      <VCardText>
        <div class="mb-5">
          <div
            v-for="spec in sheets"
            :key="spec.key"
            class="text-body-2 mb-1"
          >
            <span class="font-weight-medium">{{ spec.name }}</span> :
            <span
              v-for="(column, index) in spec.columns"
              :key="column.key"
            >
              <span :class="column.required ? 'text-high-emphasis' : 'text-medium-emphasis'">{{ column.label }}{{ column.required ? ' *' : '' }}</span>{{ index < spec.columns.length - 1 ? ', ' : '' }}
            </span>
          </div>
          <div class="text-caption text-medium-emphasis">
            * colonne obligatoire
          </div>
        </div>

        <AppFileDropZone
          :loading="importing"
          @loaded="onLoaded"
          @cleared="onCleared"
        />
      </VCardText>
    </VCard>

    <VCard v-if="workbook">
      <VCardItem>
        <VCardTitle>2. Vérifiez et importez</VCardTitle>
      </VCardItem>
      <VCardText>
        <VAlert
          v-for="problem in problems"
          :key="problem"
          type="error"
          variant="tonal"
          class="mb-3"
        >
          {{ problem }}
        </VAlert>

        <div class="d-flex flex-wrap gap-3 mb-4">
          <AppStatusChip
            v-for="spec in sheets"
            :key="spec.key"
            :label="`${spec.name} : ${mapped[spec.key]?.records.length ?? 0} ligne${(mapped[spec.key]?.records.length ?? 0) > 1 ? 's' : ''}`"
            :tone="(mapped[spec.key]?.records.length ?? 0) > 0 ? 'info' : 'neutral'"
            icon="ri-table-line"
          />
        </div>

        <VAlert
          v-if="failure"
          type="error"
          variant="tonal"
          class="mb-4"
        >
          {{ failure }}
        </VAlert>

        <VAlert
          v-if="result && result.created > 0 && issues.length === 0"
          type="success"
          variant="tonal"
          class="mb-4"
        >
          Import terminé : {{ result.created }} ligne{{ result.created > 1 ? 's' : '' }} enregistrée{{ result.created > 1 ? 's' : '' }}.
        </VAlert>
        <VAlert
          v-else-if="result"
          :type="result.created > 0 ? 'warning' : 'error'"
          variant="tonal"
          class="mb-4"
        >
          {{ result.created }} ligne{{ result.created > 1 ? 's' : '' }} enregistrée{{ result.created > 1 ? 's' : '' }},
          {{ issues.length }} refusée{{ issues.length > 1 ? 's' : '' }}. Corrigez ces lignes dans le fichier puis réimportez-les.
        </VAlert>

        <div
          v-if="issues.length > 0"
          class="import-issues mb-4"
        >
          <VTable density="compact">
            <thead>
              <tr>
                <th>Feuille</th>
                <th>Ligne</th>
                <th>Champ</th>
                <th>Problème</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(issue, index) in issues"
                :key="index"
              >
                <td>{{ issue.sheet }}</td>
                <td>{{ issue.row }}</td>
                <td>{{ issue.field || '-' }}</td>
                <td>{{ issue.message }}</td>
              </tr>
            </tbody>
          </VTable>
        </div>

        <div class="d-flex justify-end">
          <VBtn
            color="primary"
            prepend-icon="ri-upload-2-line"
            :disabled="!canImport"
            :loading="importing"
            @click="start"
          >
            Importer {{ total }} ligne{{ total > 1 ? 's' : '' }}
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.import-issues {
  overflow-x: auto;
}
</style>
