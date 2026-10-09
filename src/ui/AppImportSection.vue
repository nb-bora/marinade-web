<!--
  Import en masse d'un classeur, en trois temps : télécharger le modèle vierge, déposer le fichier
  rempli (aperçu des lignes), puis importer avec une barre de progression et un compte rendu
  (créés, mis à jour, refusés). L'écran fournit les feuilles attendues et la fonction d'envoi.

  <AppImportSection v-bind="platsImport()" @imported="refresh" />
-->
<script setup lang="ts">
import { downloadTemplate } from '@/lib/importTemplate'
import type { ImportData, ImportIssue, ImportResult, ImportSheetSpec, ImportTick } from '@/lib/sheetImport'
import { mapSheet, normalizeKey } from '@/lib/spreadsheet'
import type { MappedSheet, Workbook } from '@/lib/spreadsheet'

const props = defineProps<{
  title: string
  description?: string

  /** Nom du fichier du modèle téléchargé, sans extension. */
  fileName: string
  sheets: ImportSheetSpec[]
  notes?: string[]
  run: (data: ImportData, tick: ImportTick) => Promise<ImportResult>
}>()

const emit = defineEmits<{

  /** Au moins une ligne a été enregistrée : la liste de l'écran peut se recharger. */
  imported: [result: ImportResult]
  done: [result: ImportResult]
}>()

const workbook = ref<Workbook | null>(null)
const dropKey = ref(0)
const importing = ref(false)
const failure = ref('')
const result = ref<ImportResult | null>(null)
const processed = ref(0)

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
  if (item.missingColumns.length > 0 && !(spec.optional && item.records.length === 0)) {
    const plural = item.missingColumns.length > 1

    return [`Feuille « ${spec.name} » : colonne${plural ? 's' : ''} manquante${plural ? 's' : ''} (${item.missingColumns.map(column => column.key).join(', ')}).`]
  }

  return []
}))

const total = computed(() => Object.values(mapped.value).reduce((sum, item) => sum + item.records.length, 0))
const canImport = computed(() => workbook.value !== null && total.value > 0 && problems.value.length === 0 && !importing.value && result.value === null)
const percent = computed(() => total.value ? Math.min(100, Math.round(processed.value / total.value * 100)) : 0)
const issues = computed<ImportIssue[]>(() => result.value?.issues ?? [])
const saved = computed(() => (result.value?.created ?? 0) + (result.value?.updated ?? 0))

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

function onLoaded(loaded: Workbook) {
  workbook.value = loaded
  result.value = null
  failure.value = ''
  processed.value = 0
}

function onCleared() {
  workbook.value = null
  result.value = null
  failure.value = ''
  processed.value = 0
}

/** Repart d'un fichier vierge, sans quitter l'écran. */
function restart() {
  onCleared()
  dropKey.value++
}

async function start() {
  if (!canImport.value)
    return

  importing.value = true
  failure.value = ''
  processed.value = 0

  try {
    const outcome = await props.run(
      Object.fromEntries(Object.entries(mapped.value).map(([key, item]) => [key, item.records])),
      () => { processed.value++ },
    )

    result.value = outcome
    emit('done', outcome)
    if (outcome.created + outcome.updated > 0)
      emit('imported', outcome)
  }
  catch {
    failure.value = 'L\'import a été interrompu. Vérifiez votre connexion puis réessayez : les lignes déjà enregistrées seront simplement mises à jour.'
  }
  finally {
    importing.value = false
  }
}

const tiles = computed(() => [
  { key: 'created', label: 'Créés', value: result.value?.created ?? 0, icon: 'ri-add-circle-line', color: 'success' },
  { key: 'updated', label: 'Mis à jour', value: result.value?.updated ?? 0, icon: 'ri-refresh-line', color: 'info' },
  { key: 'errors', label: 'Refusés', value: issues.value.length, icon: 'ri-error-warning-line', color: issues.value.length ? 'error' : 'secondary' },
])
</script>

<template>
  <VCard class="import-section">
    <VCardItem class="pb-2">
      <template #prepend>
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
        >
          <VIcon icon="ri-file-excel-2-line" />
        </VAvatar>
      </template>
      <VCardTitle class="text-wrap">
        {{ title }}
      </VCardTitle>
      <VCardSubtitle
        v-if="description"
        class="text-wrap"
      >
        {{ description }}
      </VCardSubtitle>
    </VCardItem>

    <VCardText>
      <!-- 1. Modèle -->
      <section class="import-step">
        <div class="import-step__head">
          <VAvatar
            size="28"
            color="primary"
            class="font-weight-bold"
          >
            1
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-body-1 font-weight-medium">
              Téléchargez le modèle
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Un classeur vierge avec les bons titres de colonnes et une feuille d'instructions.
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap align-center gap-3 mt-3">
          <VBtn
            variant="tonal"
            prepend-icon="ri-download-2-line"
            :disabled="importing"
            @click="downloadTemplate(fileName, sheets, notes)"
          >
            Télécharger le modèle
          </VBtn>
          <span class="text-caption text-medium-emphasis">Format Excel (.xlsx), lisible aussi par LibreOffice et Google Sheets.</span>
        </div>

        <div class="import-columns mt-4">
          <div
            v-for="spec in sheets"
            :key="spec.key"
            class="import-columns__sheet"
          >
            <div class="text-body-2 font-weight-medium mb-1">
              Feuille « {{ spec.name }} »
            </div>
            <div class="d-flex flex-wrap gap-1">
              <VChip
                v-for="column in spec.columns"
                :key="column.key"
                size="small"
                label
                :color="column.required ? 'primary' : undefined"
                :variant="column.required ? 'tonal' : 'outlined'"
                :title="column.hint"
              >
                {{ column.key }}{{ column.required ? ' *' : '' }}
              </VChip>
            </div>
          </div>
          <div class="text-caption text-medium-emphasis mt-2">
            * colonne obligatoire
          </div>
        </div>
      </section>

      <!-- 2. Fichier -->
      <section class="import-step mt-6">
        <div class="import-step__head">
          <VAvatar
            size="28"
            color="primary"
            class="font-weight-bold"
          >
            2
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-body-1 font-weight-medium">
              Déposez le fichier rempli
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Vous verrez un aperçu des lignes avant que quoi que ce soit soit enregistré.
            </div>
          </div>
        </div>

        <div class="mt-3">
          <AppFileDropZone
            :key="dropKey"
            :loading="importing"
            @loaded="onLoaded"
            @cleared="onCleared"
          />
        </div>
      </section>

      <!-- 3. Import -->
      <section
        v-if="workbook"
        class="import-step mt-6"
      >
        <div class="import-step__head">
          <VAvatar
            size="28"
            color="primary"
            class="font-weight-bold"
          >
            3
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-body-1 font-weight-medium">
              Vérifiez et importez
            </div>
          </div>
        </div>

        <div class="mt-3">
          <VAlert
            v-for="problem in problems"
            :key="problem"
            type="error"
            variant="tonal"
            class="mb-3"
          >
            {{ problem }}
          </VAlert>

          <div class="d-flex flex-wrap gap-2 mb-4">
            <AppStatusChip
              v-for="spec in sheets"
              :key="spec.key"
              :label="`${spec.name} : ${plural(mapped[spec.key]?.records.length ?? 0, 'ligne')}`"
              :tone="(mapped[spec.key]?.records.length ?? 0) > 0 ? 'info' : 'neutral'"
              icon="ri-table-line"
            />
          </div>

          <VAlert
            v-if="total === 0 && problems.length === 0"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            Aucune ligne à importer : vérifiez que les données commencent à la deuxième ligne et que les feuilles portent les noms du modèle.
          </VAlert>

          <VAlert
            v-if="failure"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ failure }}
          </VAlert>

          <!-- Progression -->
          <div
            v-if="importing"
            class="mb-4"
            role="status"
            aria-live="polite"
          >
            <div class="d-flex justify-space-between text-body-2 mb-2">
              <span class="font-weight-medium">Import en cours...</span>
              <span class="text-medium-emphasis tabular-nums">{{ processed }} / {{ total }} ({{ percent }} %)</span>
            </div>
            <VProgressLinear
              :model-value="percent"
              color="primary"
              height="8"
              rounded
            />
          </div>

          <!-- Compte rendu -->
          <div v-if="result">
            <VAlert
              :type="saved === 0 ? 'error' : issues.length ? 'warning' : 'success'"
              variant="tonal"
              class="mb-4"
            >
              <template v-if="saved === 0">
                Aucune ligne n'a été enregistrée. Corrigez le fichier selon les messages ci-dessous, puis réimportez-le.
              </template>
              <template v-else-if="issues.length">
                {{ plural(saved, 'ligne') }} enregistrée{{ saved > 1 ? 's' : '' }}, {{ plural(issues.length, 'refusée') }}. Corrigez ces lignes dans le fichier puis réimportez-le : celles déjà enregistrées seront simplement mises à jour.
              </template>
              <template v-else>
                Import terminé : tout a été enregistré.
              </template>
            </VAlert>

            <div class="import-tiles mb-4">
              <div
                v-for="tile in tiles"
                :key="tile.key"
                class="import-tile"
              >
                <VAvatar
                  :color="tile.color"
                  variant="tonal"
                  rounded
                  size="40"
                >
                  <VIcon
                    :icon="tile.icon"
                    size="22"
                  />
                </VAvatar>
                <div>
                  <div class="text-h5 font-weight-semibold tabular-nums">
                    {{ tile.value }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ tile.label }}
                  </div>
                </div>
              </div>
            </div>

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
                    <td class="text-no-wrap">
                      {{ issue.sheet }}
                    </td>
                    <td class="tabular-nums">
                      {{ issue.row }}
                    </td>
                    <td>{{ issue.field || '-' }}</td>
                    <td>{{ issue.message }}</td>
                  </tr>
                </tbody>
              </VTable>
            </div>
          </div>

          <div class="d-flex flex-wrap justify-end gap-3">
            <VBtn
              v-if="result"
              variant="tonal"
              color="secondary"
              prepend-icon="ri-restart-line"
              @click="restart"
            >
              Importer un autre fichier
            </VBtn>
            <VBtn
              v-else
              color="primary"
              prepend-icon="ri-upload-2-line"
              :disabled="!canImport"
              :loading="importing"
              @click="start"
            >
              Importer {{ plural(total, 'ligne') }}
            </VBtn>
          </div>
        </div>
      </section>
    </VCardText>
  </VCard>
</template>

<style scoped>
.import-step__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.import-columns {
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.import-columns__sheet + .import-columns__sheet {
  margin-block-start: 10px;
}

.import-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.import-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
}

.import-issues {
  max-block-size: 280px;
  overflow: auto;
}

@media (max-width: 599px) {
  .import-tiles {
    grid-template-columns: 1fr;
  }
}
</style>
