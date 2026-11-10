<script setup lang="ts">
import { stockApi } from '../api'
import ComposantFormDialog from '../components/ComposantFormDialog.vue'
import ItemCell from '../components/ItemCell.vue'
import StockCard from '../components/StockCard.vue'
import { composantsImport } from '../imports'
import { componentTypeLabel, matchesSearch } from '../labels'
import type { Composant } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

type Status = 'all' | 'on' | 'off'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? stockApi.composants(tenant.currentId, signal) : Promise.resolve([] as Composant[]),
  { watch: [() => tenant.currentId] },
)

const status = ref<Status>('all')
const search = ref('')
const searchDebounced = refDebounced(search, 250)
const importDialog = ref(false)
const importDefinition = composantsImport()
const canWrite = computed(() => tenant.can('management'))
const loadedOnce = computed(() => data.value !== null)

const all = computed(() => data.value ?? [])
const onCount = computed(() => all.value.filter(item => item.disponible).length)
const offCount = computed(() => all.value.length - onCount.value)
const typeCount = computed(() => new Set(all.value.map(item => item.type.toLowerCase())).size)

const statusOptions = computed(() => [
  { value: 'all' as const, title: `Tous (${all.value.length})` },
  { value: 'on' as const, title: `Proposés (${onCount.value})` },
  { value: 'off' as const, title: `Masqués (${offCount.value})` },
])

const hasFilters = computed(() => status.value !== 'all' || search.value.trim() !== '')

const filtered = computed(() => all.value
  .filter(item => status.value === 'all' || (status.value === 'on') === item.disponible)
  .filter(item => matchesSearch(searchDebounced.value, item.nom, item.type, componentTypeLabel(item.type)))
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))

const pager = useClientPagination(filtered, 10)

const editing = ref<Composant | null>(null)
const dialogOpen = ref(false)

function openDialog(composant: Composant | null) {
  editing.value = composant
  dialogOpen.value = true
}

function clearFilters() {
  status.value = 'all'
  search.value = ''
}

// Masquer ou proposer sans ouvrir le formulaire. Masquer un composant bloque la vente des offres qui l'utilisent :
// on le dit avant.
const toggle = useSubmit(async (item: Composant) => {
  if (item.disponible && !await confirm({
    title: 'Masquer ce composant ?',
    text: `« ${item.nom} » ne sera plus proposé, et les combinaisons qui l'utilisent ne seront plus vendables tant qu'il est masqué. Son stock reste suivi.`,
    confirmLabel: 'Masquer',
    danger: true,
  }))
    return

  await stockApi.updateComposant(item.id, { disponible: !item.disponible })
  toast.success(item.disponible ? `« ${item.nom} » est masqué.` : `« ${item.nom} » est de nouveau proposé.`)
  await refresh()
})

watch(toggle.error, cause => {
  if (cause)
    toast.error(cause)
})
</script>

<template>
  <div>
    <AppHero
      eyebrow="Stock"
      title="Composants"
      subtitle="Les bases, sauces, protéines et autres éléments qui composent vos plats et vos combinaisons."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Actualiser
        </VBtn>
        <VBtn
          v-if="canWrite"
          variant="tonal"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="canWrite"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openDialog(null)"
        >
          Nouveau composant
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="error && !loadedOnce"
      class="mt-5"
      :error="error"
      @retry="reload"
    />

    <template v-else>
      <AppMetricGrid class="mt-5 mb-6">
        <template v-if="!loadedOnce">
          <VSkeletonLoader
            v-for="n in 3"
            :key="n"
            type="article"
            class="rounded-lg"
          />
        </template>
        <template v-else>
          <AppMetricTile
            hero
            label="Composants proposés"
            icon="ri-stack-line"
            :hint="offCount ? `${offCount} masqué${offCount > 1 ? 's' : ''} de la carte` : 'Tous sont proposés'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="onCount"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Masqués"
            icon="ri-eye-off-line"
            color="secondary"
            hint="Conservés, mais non proposés"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="offCount"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Catégories"
            icon="ri-price-tag-3-line"
            color="info"
            hint="Bases, sauces, protéines…"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="typeCount"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
        </template>
      </AppMetricGrid>

      <StockCard>
        <template #toolbar>
          <div class="stock-filter">
            <AppSegmented
              v-model="status"
              :options="statusOptions"
              label="Filtrer les composants par statut"
            />
          </div>
          <VTextField
            v-model="search"
            class="stock-search"
            label="Rechercher un composant"
            placeholder="Nom ou catégorie"
            prepend-inner-icon="ri-search-line"
            density="compact"
            variant="solo-filled"
            flat
            rounded="lg"
            hide-details
            clearable
            autocomplete="off"
          />
        </template>

        <VSkeletonLoader
          v-if="!loadedOnce"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="filtered.length === 0"
          icon="ri-stack-line"
          :title="hasFilters ? 'Aucun composant ne correspond' : 'Aucun composant pour l\'instant'"
          :text="hasFilters ? 'Essayez un autre statut ou une autre recherche.' : 'Ajoutez les éléments de vos plats pour suivre leur stock et composer des offres.'"
        >
          <VBtn
            v-if="hasFilters"
            variant="outlined"
            prepend-icon="ri-filter-off-line"
            @click="clearFilters"
          >
            Effacer les filtres
          </VBtn>
          <VBtn
            v-else-if="canWrite"
            color="primary"
            prepend-icon="ri-add-line"
            @click="openDialog(null)"
          >
            Nouveau composant
          </VBtn>
        </AppEmptyState>

        <template v-else>
          <VTable
            hover
            aria-label="Liste des composants"
          >
            <thead>
              <tr>
                <th>Composant</th>
                <th class="d-none d-sm-table-cell">
                  Unité
                </th>
                <th class="text-end d-none d-md-table-cell">
                  Supplément
                </th>
                <th>Statut</th>
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
                v-for="item in pager.rows.value"
                :key="item.id"
                :class="{ 'row--muted': !item.disponible }"
              >
                <td>
                  <ItemCell
                    icon="ri-stack-line"
                    :title="item.nom"
                    :muted="!item.disponible"
                  >
                    <template #subtitle>
                      {{ componentTypeLabel(item.type) }}<span class="d-sm-none"> · {{ item.stock_unite }}</span>
                    </template>
                  </ItemCell>
                </td>
                <td class="d-none d-sm-table-cell text-medium-emphasis">
                  {{ item.stock_unite }}
                </td>
                <td class="text-end d-none d-md-table-cell tabular-nums">
                  {{ Number(item.prix_supplement) > 0 ? `+ ${formatMoney(item.prix_supplement, item.devise)}` : '—' }}
                </td>
                <td>
                  <AppStatusChip
                    :label="item.disponible ? 'Proposé' : 'Masqué'"
                    :tone="item.disponible ? 'success' : 'neutral'"
                    :icon="item.disponible ? 'ri-check-line' : 'ri-eye-off-line'"
                  />
                </td>
                <td
                  v-if="canWrite"
                  class="text-end text-no-wrap"
                >
                  <IconBtn
                    :aria-label="item.disponible ? `Masquer ${item.nom}` : `Proposer de nouveau ${item.nom}`"
                    :disabled="toggle.pending.value"
                    @click="toggle.submit(item)"
                  >
                    <VIcon :icon="item.disponible ? 'ri-eye-off-line' : 'ri-eye-line'" />
                    <VTooltip
                      activator="parent"
                      location="top"
                    >
                      {{ item.disponible ? 'Masquer' : 'Proposer de nouveau' }}
                    </VTooltip>
                  </IconBtn>
                  <IconBtn
                    :aria-label="`Modifier ${item.nom}`"
                    @click="openDialog(item)"
                  >
                    <VIcon icon="ri-edit-line" />
                    <VTooltip
                      activator="parent"
                      location="top"
                    >
                      Modifier
                    </VTooltip>
                  </IconBtn>
                </td>
              </tr>
            </tbody>
          </VTable>

          <VDivider />

          <AppTablePagination
            :page="pager.page.value"
            :page-size="pager.pageSize.value"
            :count="pager.rows.value.length"
            :total="pager.total.value"
            :pages="pager.pages.value"
            :has-next="pager.hasNext.value"
            @update:page="pager.page.value = $event"
            @update:page-size="pager.pageSize.value = $event"
          />
        </template>
      </StockCard>
    </template>

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refresh"
    />

    <ComposantFormDialog
      v-model="dialogOpen"
      :composant="editing"
      @saved="refresh"
    />
  </div>
</template>
