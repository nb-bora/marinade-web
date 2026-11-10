<script setup lang="ts">
import { stockApi } from '../api'
import ItemCell from '../components/ItemCell.vue'
import RecipeLineDialog from '../components/RecipeLineDialog.vue'
import RecipeReplaceDialog from '../components/RecipeReplaceDialog.vue'
import StockCard from '../components/StockCard.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { recettesImport } from '../imports'
import { STATE_INFO, componentTypeLabel, formatQty, portionsFor } from '../labels'
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

// La fiche garde l'identifiant du plat qu'elle décrit : en changeant de plat, les lignes de l'ancien ne restent pas
// affichées sous le nouveau pendant le chargement.
const recipe = useAsyncData(
  async signal => {
    const id = platId.value

    return id ? { platId: id, lines: await stockApi.recipe(id, signal) } : { platId: null, lines: [] as PlatComposant[] }
  },
  { watch: [platId] },
)

const recipeReady = computed(() => recipe.data.value !== null && recipe.data.value.platId === platId.value)

const composants = computed(() => overview.rows.value.map(row => row.composant))
const rowById = computed(() => new Map(overview.rows.value.map(row => [row.composant.id, row])))
const nameOf = (id: string) => rowById.value.get(id)?.composant.nom ?? 'Composant supprimé'

const lines = computed(() => (recipeReady.value ? recipe.data.value?.lines ?? [] : [])
  .slice()
  .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || nameOf(a.composant_id).localeCompare(nameOf(b.composant_id), 'fr')))

const usedIds = computed(() => lines.value.map(line => line.composant_id))

// Portions encore réalisables avec le stock disponible, ligne par ligne ; la plus basse limite le plat.
const portions = computed(() => new Map(lines.value.map(line => {
  const row = rowById.value.get(line.composant_id)

  return [line.id, row ? portionsFor(line, row.stock, row.composant.stock_unite) : null] as const
})))

const limiting = computed(() => {
  let best: { line: PlatComposant; count: number } | null = null

  for (const line of lines.value) {
    const count = portions.value.get(line.id)

    if (count !== null && count !== undefined && (!best || count < best.count))
      best = { line, count }
  }

  return best
})

// Une ligne qu'on ne sait pas convertir (unité de comptage différente) rend le calcul partiel : on le dit.
const unknownCount = computed(() => lines.value.filter(line => portions.value.get(line.id) === null).length)

const lineDialog = ref(false)
const editingLine = ref<PlatComposant | null>(null)
const replaceDialog = ref(false)

function openLine(line: PlatComposant | null) {
  editingLine.value = line
  lineDialog.value = true
}

const remove = useSubmit(async (line: PlatComposant) => {
  const name = nameOf(line.composant_id)

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
    <AppHero
      eyebrow="Stock"
      title="Fiches techniques"
      subtitle="Ce que consomme chaque plat : le stock des composants baisse automatiquement à chaque commande."
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          variant="tonal"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="loadError && !ready"
      class="mt-5"
      :error="loadError"
      @retry="retry"
    />

    <VSkeletonLoader
      v-else-if="!ready"
      class="mt-5"
      type="card, table"
    />

    <AppEmptyState
      v-else-if="platOptions.length === 0"
      class="mt-5"
      icon="ri-restaurant-line"
      title="Aucun plat dans la carte"
      text="Créez d'abord des plats dans votre carte : vous pourrez ensuite décrire leur fiche technique ici."
    >
      <VBtn
        color="primary"
        to="/catalog/plats"
      >
        Aller aux plats
      </VBtn>
    </AppEmptyState>

    <template v-else>
      <StockCard class="mt-5">
        <div class="pa-5">
          <VAutocomplete
            v-model="platId"
            :items="platOptions"
            label="Plat"
            prepend-inner-icon="ri-restaurant-line"
            variant="solo-filled"
            flat
            rounded="lg"
            hide-details
            no-data-text="Aucun plat ne correspond."
          />
        </div>
      </StockCard>

      <AppMetricGrid
        v-if="plat"
        class="my-6"
      >
        <AppMetricTile
          hero
          label="Prix de vente"
          icon="ri-price-tag-3-line"
          :hint="plat.disponible ? 'Plat proposé à la carte' : 'Plat indisponible'"
        >
          {{ formatMoney(plat.prix, plat.devise) }}
        </AppMetricTile>
        <AppMetricTile
          label="Composants"
          icon="ri-stack-line"
          color="info"
          :hint="lines.length ? 'Pour une portion' : 'Fiche vide'"
        >
          <AppAnimatedNumber
            v-slot="{ current }"
            :value="lines.length"
          >
            {{ Math.round(current) }}
          </AppAnimatedNumber>
        </AppMetricTile>
        <AppMetricTile
          label="Portions possibles"
          icon="ri-restaurant-2-line"
          :color="limiting ? (limiting.count === 0 ? 'error' : 'success') : 'secondary'"
        >
          <template v-if="limiting">
            {{ formatQty(limiting.count) }}
          </template>
          <template v-else>
            —
          </template>
          <template #hint>
            <template v-if="!recipeReady">
              Calcul en cours…
            </template>
            <template v-else-if="lines.length === 0">
              Aucune fiche : le stock n'est pas décompté
            </template>
            <template v-else-if="!limiting">
              Unités à convertir pour calculer
            </template>
            <template v-else>
              Limité par {{ nameOf(limiting.line.composant_id) }}{{ unknownCount ? ` (calcul partiel : ${unknownCount} ligne${unknownCount > 1 ? 's' : ''} non convertible${unknownCount > 1 ? 's' : ''})` : '' }}
            </template>
          </template>
        </AppMetricTile>
      </AppMetricGrid>

      <StockCard
        title="Nomenclature"
        :subtitle="recipeReady ? `${lines.length} composant${lines.length > 1 ? 's' : ''} pour une portion de « ${plat?.nom} »` : undefined"
      >
        <template
          v-if="canWrite"
          #actions
        >
          <VBtn
            variant="tonal"
            color="secondary"
            prepend-icon="ri-file-edit-line"
            :disabled="!plat || !recipeReady"
            @click="replaceDialog = true"
          >
            Remplacer toute la fiche
          </VBtn>
          <VBtn
            color="primary"
            prepend-icon="ri-add-line"
            :disabled="!plat || !recipeReady"
            @click="openLine(null)"
          >
            Ajouter un composant
          </VBtn>
        </template>

        <AppErrorState
          v-if="recipe.error.value && !recipeReady"
          class="ma-4"
          :error="recipe.error.value"
          @retry="recipe.reload()"
        />

        <VSkeletonLoader
          v-else-if="!recipeReady"
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
          aria-label="Composants consommés par une portion"
        >
          <thead>
            <tr>
              <th>Composant</th>
              <th class="text-end">
                Par portion
              </th>
              <th class="d-none d-md-table-cell">
                Stock disponible
              </th>
              <th class="text-end d-none d-sm-table-cell">
                Portions
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
              :class="rowById.get(line.composant_id) ? `row--${rowById.get(line.composant_id)!.state}` : undefined"
            >
              <td>
                <ItemCell
                  icon="ri-stack-line"
                  :title="nameOf(line.composant_id)"
                  :subtitle="componentTypeLabel(rowById.get(line.composant_id)?.composant.type ?? 'autre')"
                  hide-avatar-on-mobile
                />
              </td>
              <td class="text-end tabular-nums text-no-wrap font-weight-medium">
                {{ formatQty(line.quantite) }} <span class="text-medium-emphasis font-weight-regular">{{ line.unite }}</span>
              </td>
              <td class="d-none d-md-table-cell">
                <template v-if="rowById.get(line.composant_id)">
                  <AppStatusChip
                    :label="`${formatQty(rowById.get(line.composant_id)?.stock.disponible)} ${rowById.get(line.composant_id)?.composant.stock_unite}`"
                    :tone="STATE_INFO[rowById.get(line.composant_id)!.state].tone"
                    :icon="STATE_INFO[rowById.get(line.composant_id)!.state].icon"
                  />
                </template>
                <span
                  v-else
                  class="text-medium-emphasis"
                >—</span>
              </td>
              <td class="text-end d-none d-sm-table-cell text-no-wrap">
                <template v-if="portions.get(line.id) !== null && portions.get(line.id) !== undefined">
                  <span class="tabular-nums font-weight-medium">{{ formatQty(portions.get(line.id)) }}</span>
                  <VChip
                    v-if="limiting?.line.id === line.id && lines.length > 1"
                    size="x-small"
                    label
                    variant="tonal"
                    color="warning"
                    class="ms-2"
                  >
                    Limitant
                  </VChip>
                </template>
                <VTooltip
                  v-else
                  location="top"
                >
                  <template #activator="{ props: tip }">
                    <span
                      v-bind="tip"
                      class="text-medium-emphasis"
                      tabindex="0"
                    >—</span>
                  </template>
                  Unité de la ligne et unité de stock non convertibles ici
                </VTooltip>
              </td>
              <td
                v-if="canWrite"
                class="text-end text-no-wrap"
              >
                <IconBtn
                  :aria-label="`Modifier la quantité de ${nameOf(line.composant_id)}`"
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
                  :aria-label="`Retirer ${nameOf(line.composant_id)} de la fiche`"
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
      </StockCard>
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
