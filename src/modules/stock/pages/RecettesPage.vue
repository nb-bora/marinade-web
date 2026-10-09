<script setup lang="ts">
import { stockApi } from '../api'
import RecipeLineDialog from '../components/RecipeLineDialog.vue'
import RecipeReplaceDialog from '../components/RecipeReplaceDialog.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { recettesImport } from '../imports'
import { STATE_INFO, componentTypeLabel, formatQty } from '../labels'
import type { Plat, PlatComposant } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const canWrite = computed(() => tenant.can('management'))

const overview = useStockOverview()
const importDialog = ref(false)
const importDefinition = recettesImport()

const plats = useAsyncData(
  signal => tenant.currentId ? stockApi.plats(tenant.currentId, signal) : Promise.resolve([] as Plat[]),
  { watch: [() => tenant.currentId] },
)

const platId = ref<string | null>(null)

const platOptions = computed(() => (plats.data.value ?? [])
  .map(item => ({ value: item.id, title: item.nom, subtitle: formatMoney(item.prix, item.devise) }))
  .sort((a, b) => a.title.localeCompare(b.title, 'fr')))

const plat = computed(() => plats.data.value?.find(item => item.id === platId.value) ?? null)

// Le premier plat est choisi d'office ; un changement de restaurant efface le choix.
watch(plats.data, list => {
  if (!list?.some(item => item.id === platId.value))
    platId.value = list?.[0]?.id ?? null
})

const recipe = useAsyncData(
  signal => platId.value ? stockApi.recipe(platId.value, signal) : Promise.resolve([] as PlatComposant[]),
  { watch: [platId] },
)

const composants = computed(() => overview.rows.value.map(row => row.composant))
const rowById = computed(() => new Map(overview.rows.value.map(row => [row.composant.id, row])))

const lines = computed(() => (recipe.data.value ?? [])
  .slice()
  .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (rowById.value.get(a.composant_id)?.composant.nom ?? '').localeCompare(rowById.value.get(b.composant_id)?.composant.nom ?? '', 'fr')))

const usedIds = computed(() => lines.value.map(line => line.composant_id))

const lineDialog = ref(false)
const editingLine = ref<PlatComposant | null>(null)
const replaceDialog = ref(false)

function openLine(line: PlatComposant | null) {
  editingLine.value = line
  lineDialog.value = true
}

const remove = useSubmit(async (line: PlatComposant) => {
  const name = rowById.value.get(line.composant_id)?.composant.nom ?? 'ce composant'

  if (!await confirm({
    title: 'Retirer ce composant ?',
    text: `« ${name} » ne sera plus consommé par ce plat.`,
    confirmLabel: 'Supprimer',
    danger: true,
  }))
    return

  await stockApi.removeRecipeLine(line.plat_id, line.composant_id)
  toast.success('Composant retiré de la fiche.')
  await recipe.refresh()
})

watch(remove.error, cause => {
  if (cause)
    toast.error(cause)
})

const loadError = computed(() => plats.error.value ?? recipe.error.value ?? overview.error.value)
const ready = computed(() => plats.data.value !== null && overview.loadedOnce.value)

function afterImport() {
  plats.refresh()
  recipe.refresh()
  overview.refresh()
}

function retry() {
  plats.reload()
  recipe.reload()
  overview.reload()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Fiches techniques"
      subtitle="Ce que consomme chaque plat : le stock des composants baisse automatiquement à chaque commande."
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="loadError && !ready"
      :error="loadError"
      @retry="retry"
    />

    <VSkeletonLoader
      v-else-if="!ready"
      type="card, table"
    />

    <AppEmptyState
      v-else-if="platOptions.length === 0"
      icon="ri-restaurant-line"
      title="Aucun plat dans la carte"
      text="Créez d'abord des plats dans votre carte : vous pourrez ensuite décrire leur fiche technique ici."
    />

    <template v-else>
      <VCard>
        <VCardText>
          <VRow align="center">
            <VCol
              cols="12"
              md="6"
            >
              <VAutocomplete
                v-model="platId"
                :items="platOptions"
                label="Plat"
                prepend-inner-icon="ri-restaurant-line"
                hide-details
                no-data-text="Aucun plat ne correspond."
              />
            </VCol>
            <VCol
              v-if="plat"
              cols="12"
              md="6"
            >
              <div class="d-flex flex-wrap align-center gap-x-6 gap-y-1">
                <div>
                  <div class="text-body-2 text-medium-emphasis">
                    Prix de vente
                  </div>
                  <div class="text-h6 tabular-nums">
                    {{ formatMoney(plat.prix, plat.devise) }}
                  </div>
                </div>
                <AppStatusChip
                  :label="plat.disponible ? 'Disponible' : 'Indisponible'"
                  :tone="plat.disponible ? 'success' : 'neutral'"
                />
              </div>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VCard class="mt-6">
        <div class="d-flex flex-wrap align-center justify-space-between gap-3 pa-5">
          <div class="min-w-0">
            <h2 class="text-h6">
              Nomenclature
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              {{ lines.length }} composant{{ lines.length > 1 ? 's' : '' }} pour une portion de « {{ plat?.nom }} »
            </p>
          </div>
          <div
            v-if="canWrite"
            class="d-flex flex-wrap gap-2"
          >
            <VBtn
              variant="outlined"
              color="secondary"
              prepend-icon="ri-file-edit-line"
              :disabled="!plat"
              @click="replaceDialog = true"
            >
              Remplacer toute la fiche
            </VBtn>
            <VBtn
              color="primary"
              prepend-icon="ri-add-line"
              :disabled="!plat"
              @click="openLine(null)"
            >
              Ajouter un composant
            </VBtn>
          </div>
        </div>

        <VDivider />

        <AppErrorState
          v-if="recipe.error.value && recipe.data.value === null"
          class="ma-4"
          :error="recipe.error.value"
          @retry="recipe.reload()"
        />

        <VSkeletonLoader
          v-else-if="recipe.data.value === null"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="lines.length === 0"
          icon="ri-list-check-2"
          title="Fiche technique vide"
          text="Ce plat ne consomme encore aucun composant : ses commandes ne font pas baisser le stock."
        >
          <VBtn
            v-if="canWrite"
            color="primary"
            prepend-icon="ri-add-line"
            @click="openLine(null)"
          >
            Ajouter un composant
          </VBtn>
        </AppEmptyState>

        <VTable
          v-else
          hover
        >
          <thead>
            <tr>
              <th>Composant</th>
              <th class="text-end">
                Quantité
              </th>
              <th class="d-none d-md-table-cell">
                Stock disponible
              </th>
              <th
                v-if="canWrite"
                class="text-end"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="line in lines"
              :key="line.id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                    size="38"
                    class="d-none d-sm-flex"
                  >
                    <VIcon icon="ri-stack-line" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                      {{ rowById.get(line.composant_id)?.composant.nom ?? 'Composant supprimé' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ componentTypeLabel(rowById.get(line.composant_id)?.composant.type ?? 'autre') }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-end tabular-nums text-no-wrap font-weight-medium">
                {{ formatQty(line.quantite) }} <span class="text-medium-emphasis font-weight-regular">{{ line.unite }}</span>
              </td>
              <td class="d-none d-md-table-cell">
                <template v-if="rowById.get(line.composant_id)">
                  <AppStatusChip
                    :label="`${formatQty(rowById.get(line.composant_id)?.stock.disponible)} ${rowById.get(line.composant_id)?.composant.stock_unite}`"
                    :tone="STATE_INFO[rowById.get(line.composant_id)!.state].tone"
                  />
                </template>
                <span
                  v-else
                  class="text-medium-emphasis"
                >—</span>
              </td>
              <td
                v-if="canWrite"
                class="text-end text-no-wrap"
              >
                <IconBtn
                  :aria-label="`Modifier la quantité de ${rowById.get(line.composant_id)?.composant.nom ?? 'ce composant'}`"
                  @click="openLine(line)"
                >
                  <VIcon icon="ri-edit-line" />
                  <VTooltip
                    activator="parent"
                    location="top"
                  >
                    Modifier la quantité
                  </VTooltip>
                </IconBtn>
                <IconBtn
                  :aria-label="`Retirer ${rowById.get(line.composant_id)?.composant.nom ?? 'ce composant'} de la fiche`"
                  :disabled="remove.pending.value"
                  @click="remove.submit(line)"
                >
                  <VIcon icon="ri-delete-bin-line" />
                  <VTooltip
                    activator="parent"
                    location="top"
                  >
                    Retirer
                  </VTooltip>
                </IconBtn>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </template>

    <RecipeLineDialog
      v-model="lineDialog"
      :plat="plat"
      :line="editingLine"
      :composants="composants"
      :used-ids="usedIds"
      @saved="recipe.refresh()"
    />
    <RecipeReplaceDialog
      v-model="replaceDialog"
      :plat="plat"
      :lines="lines"
      :composants="composants"
      @saved="recipe.refresh()"
    />
    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="afterImport"
    />
  </div>
</template>
