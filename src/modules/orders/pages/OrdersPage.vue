<script setup lang="ts">
import { useNow } from '@vueuse/core'
import NewOrderDialog from '../components/NewOrderDialog.vue'
import OrderDetailDrawer from '../components/OrderDetailDrawer.vue'
import OrderStatusChip from '../components/OrderStatusChip.vue'
import { useOrders } from '../composables/useOrders'
import { commandesImport } from '../imports'
import { bucketOf, presentOrder } from '../labels'
import type { OrderBucket } from '../labels'
import { hasPendingRefund, pendingOf, refundedOf } from '../refunds'
import type { Commande } from '../types'
import { useClientPagination } from '@/composables/useClientPagination'
import { useLive } from '@/composables/useLive'
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

/** Une commande en cours depuis plus longtemps que cela mérite qu'on aille voir. */
const SLOW_AFTER_MINUTES = 45

const tenant = useTenantStore()
const data = useOrders()

const tab = ref<OrderBucket>('active')
const search = ref('')
const searchDebounced = refDebounced(search, 250)
const onlyPending = ref(false)
const selectedId = ref<string | null>(null)
const creating = ref(false)
const importDialog = ref(false)
const importDefinition = commandesImport()

useLive(() => data.reload())

const loadedOnce = computed(() => data.orders.data.value !== null)

// Une horloge qui avance toutes les 30 s : « il y a 12 minutes » ne reste pas figé entre deux actualisations.
const now = useNow({ interval: 30_000 })

const shortRef = (order: Commande) => `N° ${order.id.slice(0, 8).toUpperCase()}`

const tableLabel = (order: Commande) =>
  order.table_id ? `Table ${data.tableNames.value.get(order.table_id) ?? '—'}` : 'Sans table'

const isSlow = (order: Commande) =>
  order.statut === 'en_cours' && now.value.getTime() - Date.parse(order.created_at) > SLOW_AFTER_MINUTES * 60_000

// Liste affichée ----------------------------------------------------------------------------

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const byTab = computed(() => ({
  active: data.active.value,
  paying: data.paying.value,
  history: data.history.value,
}))

const rows = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return byTab.value[tab.value]
    .filter(order => !onlyPending.value || hasPendingRefund(order))
    .filter(order => !term || normalize(`${shortRef(order)} ${tableLabel(order)} ${presentOrder(order.statut).label}`).includes(term))
})

const pager = useClientPagination(rows, 10)

const hasFilters = computed(() => onlyPending.value || search.value.trim() !== '')

function clearFilters() {
  onlyPending.value = false
  search.value = ''
}

const tabOptions = computed(() => [
  { value: 'active' as const, title: `Actives (${data.active.value.length})` },
  { value: 'paying' as const, title: `En paiement (${data.paying.value.length})` },
  { value: 'history' as const, title: `Historique (${data.history.value.length})` },
])

/** Montre les demandes de remboursement à traiter, dans le premier onglet qui en contient. */
function showPendingRefunds() {
  const found = (['active', 'paying', 'history'] as const).find(key => byTab.value[key].some(hasPendingRefund))

  search.value = ''
  onlyPending.value = true
  if (found)
    tab.value = found
}

// Indicateurs --------------------------------------------------------------------------

const inProgress = computed(() => data.active.value.filter(order => order.statut === 'en_cours').length)
const served = computed(() => data.active.value.length - inProgress.value)

/** Ce que le restaurant a encore à encaisser : les commandes ouvertes et celles dont le paiement est lancé. */
const openAmount = computed(() => [...data.active.value, ...data.paying.value].reduce((sum, order) => sum + Number(order.total), 0))
const pendingCount = computed(() => data.pendingRefunds.value.length)

function onCreated(order: Commande) {
  data.reload()
  clearFilters()
  tab.value = bucketOf(order.statut)
  selectedId.value = order.id
}

const emptyText = computed(() => ({
  active: 'Les commandes en cours ou servies, pas encore payées, apparaîtront ici.',
  paying: 'Les commandes dont le paiement est lancé, en attente de confirmation, apparaîtront ici.',
  history: 'Les commandes payées ou annulées apparaîtront ici.',
}[tab.value]))
</script>

<template>
  <div>
    <AppHero
      eyebrow="Ancien circuit"
      title="Commandes"
      subtitle="Les commandes de l'ancien circuit, leur paiement et leurs remboursements."
      live
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="data.orders.loading.value"
          @click="data.orders.reload()"
        >
          Actualiser
        </VBtn>
        <VBtn
          v-if="tenant.can('front_of_house')"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="tenant.can('front_of_house')"
          color="primary"
          prepend-icon="ri-add-line"
          @click="creating = true"
        >
          Nouvelle commande
        </VBtn>
      </template>
    </AppHero>

    <AppMetricGrid class="mt-5 mb-6">
      <AppMetricTile
        hero
        label="Commandes actives"
        icon="ri-file-list-3-line"
        :hint="`${inProgress} en cours · ${served} servie${served > 1 ? 's' : ''}`"
      >
        <VSkeletonLoader
          v-if="!loadedOnce"
          type="heading"
          width="60"
          class="bg-transparent"
        />
        <AppAnimatedNumber
          v-else
          v-slot="{ current }"
          :value="data.active.value.length"
        >
          {{ current }}
        </AppAnimatedNumber>
      </AppMetricTile>
      <AppMetricTile
        label="Reste à encaisser"
        icon="ri-money-dollar-circle-line"
        color="info"
        :hint="data.paying.value.length ? `Dont ${data.paying.value.length} en cours de paiement` : 'Commandes pas encore payées'"
      >
        <VSkeletonLoader
          v-if="!loadedOnce"
          type="heading"
          width="120"
          class="bg-transparent"
        />
        <template v-else>
          {{ formatMoney(openAmount) }}
        </template>
      </AppMetricTile>
      <AppMetricTile
        label="Remboursements à traiter"
        icon="ri-time-line"
        :color="pendingCount > 0 ? 'warning' : 'success'"
      >
        <VSkeletonLoader
          v-if="!loadedOnce"
          type="heading"
          width="60"
          class="bg-transparent"
        />
        <AppAnimatedNumber
          v-else
          v-slot="{ current }"
          :value="pendingCount"
        >
          {{ current }}
        </AppAnimatedNumber>
        <template #hint>
          <button
            v-if="pendingCount > 0"
            type="button"
            class="tile-action"
            @click="showPendingRefunds"
          >
            En attente d'un manager · Les voir
          </button>
          <template v-else>
            Aucune demande
          </template>
        </template>
      </AppMetricTile>
      <AppMetricTile
        label="Déjà remboursé"
        icon="ri-refund-2-line"
        color="success"
        hint="Demandes approuvées"
      >
        <VSkeletonLoader
          v-if="!loadedOnce"
          type="heading"
          width="120"
          class="bg-transparent"
        />
        <template v-else>
          {{ formatMoney(data.refundedTotal.value) }}
        </template>
      </AppMetricTile>
    </AppMetricGrid>

    <div class="orders-toolbar mb-5">
      <div class="orders-toolbar__filters">
        <AppSegmented
          v-model="tab"
          :options="tabOptions"
          label="Filtrer les commandes par état"
        />
        <VChip
          v-if="onlyPending"
          color="warning"
          variant="tonal"
          label
          closable
          prepend-icon="ri-time-line"
          @click:close="onlyPending = false"
        >
          Remboursement à traiter
        </VChip>
        <span
          v-if="hasFilters"
          class="text-body-2 text-medium-emphasis"
          aria-live="polite"
        >
          {{ rows.length }} résultat{{ rows.length > 1 ? 's' : '' }}
        </span>
      </div>
      <VTextField
        v-model="search"
        class="orders-toolbar__search"
        label="Rechercher une commande"
        placeholder="N° ou table"
        prepend-inner-icon="ri-search-line"
        density="compact"
        variant="solo-filled"
        flat
        rounded="lg"
        hide-details
        clearable
        autocomplete="off"
      />
    </div>

    <VCard class="orders-card">
      <AppErrorState
        v-if="data.orders.error.value && !loadedOnce"
        class="ma-4"
        :error="data.orders.error.value"
        @retry="data.orders.reload()"
      />

      <VSkeletonLoader
        v-else-if="!loadedOnce"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="rows.length === 0"
        :icon="hasFilters ? 'ri-search-line' : tab === 'history' ? 'ri-archive-line' : 'ri-file-list-3-line'"
        :title="hasFilters ? 'Aucune commande ne correspond' : tab === 'active' ? 'Aucune commande active' : tab === 'paying' ? 'Aucun paiement en cours' : 'Aucune commande dans l\'historique'"
        :text="hasFilters ? 'Essayez une autre recherche, ou un autre onglet.' : emptyText"
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
          v-else-if="tab === 'active' && tenant.can('front_of_house')"
          prepend-icon="ri-add-line"
          @click="creating = true"
        >
          Nouvelle commande
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="orders-table"
        >
          <thead>
            <tr>
              <th>Commande</th>
              <th class="d-none d-md-table-cell">
                Table
              </th>
              <th class="text-end">
                Total
              </th>
              <th class="text-end d-none d-sm-table-cell">
                Remboursé
              </th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in pager.rows.value"
              :key="order.id"
              class="cursor-pointer"
              :class="{ 'orders-row--selected': selectedId === order.id }"
              tabindex="0"
              :aria-label="`Ouvrir la commande ${shortRef(order)}`"
              @click="selectedId = order.id"
              @keydown.enter="selectedId = order.id"
              @keydown.space.prevent="selectedId = order.id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    variant="tonal"
                    rounded
                    size="38"
                    :color="presentOrder(order.statut).tone === 'neutral' ? 'secondary' : presentOrder(order.statut).tone"
                  >
                    <VIcon
                      :icon="presentOrder(order.statut).icon"
                      size="20"
                    />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-no-wrap">
                      {{ tab === 'history' ? formatDateTime(order.created_at) : formatRelative(order.created_at, now) }}
                      <VChip
                        v-if="isSlow(order)"
                        size="x-small"
                        color="warning"
                        variant="tonal"
                        label
                        class="ms-2"
                      >
                        Longue attente
                      </VChip>
                    </div>
                    <div class="reference-cell text-medium-emphasis">
                      {{ shortRef(order) }}
                      <template v-if="tab !== 'history'">
                        · {{ formatDateTime(order.created_at) }}
                      </template>
                      <span class="d-md-none">· {{ tableLabel(order) }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="d-none d-md-table-cell">
                {{ tableLabel(order) }}
              </td>
              <td class="text-end font-weight-semibold text-high-emphasis">
                <AppMoney :amount="order.total" />
              </td>
              <td class="text-end d-none d-sm-table-cell">
                <AppMoney
                  v-if="refundedOf(order.remboursements) > 0"
                  :amount="refundedOf(order.remboursements)"
                />
                <span
                  v-else
                  class="text-disabled"
                >—</span>
                <VChip
                  v-if="pendingOf(order.remboursements) > 0"
                  size="x-small"
                  color="warning"
                  variant="tonal"
                  label
                  class="ms-2"
                >
                  À traiter
                </VChip>
              </td>
              <td>
                <OrderStatusChip :status="order.statut" />
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
    </VCard>

    <p class="text-body-2 text-medium-emphasis mt-4 mb-0">
      Cet écran suit l'ancien circuit de commande. Les nouvelles commandes se prennent depuis le plan de salle
      et s'encaissent à la caisse.
    </p>

    <AppImportDialog
      v-if="tenant.can('front_of_house')"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="data.reload()"
    />
    <NewOrderDialog
      v-model="creating"
      @created="onCreated"
    />

    <OrderDetailDrawer
      v-model="selectedId"
      :table-names="data.tableNames.value"
      @changed="data.reload()"
    />
  </div>
</template>

<style scoped>
.orders-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.orders-toolbar__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.orders-toolbar__search {
  flex: 0 1 320px;
  min-inline-size: 220px;
}

.orders-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.orders-table tbody tr:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.orders-row--selected {
  background: rgba(var(--v-theme-primary), 0.08);
}

.reference-cell {
  font-size: 0.8125rem;
  max-inline-size: 22rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-action {
  color: rgb(var(--v-theme-warning));
  cursor: pointer;
  font-weight: 600;
  text-align: start;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tile-action:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}

@media (max-width: 599px) {
  .orders-toolbar > * {
    flex: 1 1 100%;
  }

  .orders-toolbar :deep(.app-segmented) {
    display: flex;
  }

  .orders-toolbar :deep(.app-segmented__item) {
    flex: 1 1 0;
    padding-inline: 6px;
    text-align: center;
  }
}
</style>
