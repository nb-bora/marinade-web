<script setup lang="ts">
import NewOrderDialog from '../components/NewOrderDialog.vue'
import OrderDetailDrawer from '../components/OrderDetailDrawer.vue'
import OrderStatusChip from '../components/OrderStatusChip.vue'
import { pendingOf, refundedOf, useOrders } from '../composables/useOrders'
import { presentOrder } from '../labels'
import type { Commande } from '../types'
import { useClientPagination } from '@/composables/useClientPagination'
import { useLive } from '@/composables/useLive'
import { formatDateTime, formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'

type Tab = 'active' | 'history'

const tenant = useTenantStore()
const data = useOrders()

const tab = ref<Tab>('active')
const selectedId = ref<string | null>(null)
const creating = ref(false)

const rows = computed(() => (tab.value === 'active' ? data.active.value : data.history.value))
const pager = useClientPagination(rows, 10)

watch(tab, () => {
  pager.page.value = 1
})

const loadedOnce = computed(() => data.orders.data.value !== null)

useLive(() => data.orders.refresh())

const shortRef = (order: Commande) => `N° ${order.id.slice(0, 8).toUpperCase()}`

const tableLabel = (order: Commande) =>
  order.table_id ? `Table ${data.tableNames.value.get(order.table_id) ?? '—'}` : 'Sans table'

const refundable = (order: Commande) => order.statut === 'servie' || order.statut === 'payee'

// Indicateurs --------------------------------------------------------------------------

const inProgress = computed(() => data.active.value.filter(order => order.statut === 'en_cours').length)
const served = computed(() => data.active.value.length - inProgress.value)
const openAmount = computed(() => data.active.value.reduce((sum, order) => sum + Number(order.total), 0))
const pendingCount = computed(() => data.pendingRefunds.value.length)

const stripItems = computed<StatStripItem[]>(() => [
  {
    label: 'Commandes actives',
    icon: 'ri-file-list-3-line',
    value: String(data.active.value.length),
    hint: `${inProgress.value} en cours · ${served.value} servie${served.value > 1 ? 's' : ''}`,
  },
  {
    label: 'Montant des commandes actives',
    icon: 'ri-money-dollar-circle-line',
    value: formatMoney(openAmount.value),
    hint: 'Pas encore payé',
  },
  {
    label: 'Remboursements à traiter',
    icon: 'ri-time-line',
    value: String(pendingCount.value),
    hint: pendingCount.value > 0 ? 'En attente d\'un manager' : 'Aucune demande',
    hintColor: pendingCount.value > 0 ? 'warning' : 'success',
  },
  {
    label: 'Déjà remboursé',
    icon: 'ri-refund-2-line',
    value: formatMoney(data.refundedTotal.value),
    hint: data.ledgerPartial.value ? 'Sur les 100 commandes les plus récentes' : undefined,
  },
])

function onCreated(order: Commande) {
  data.reload()
  tab.value = 'active'
  selectedId.value = order.id
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Commandes"
      subtitle="Les commandes de l'ancien circuit et leurs remboursements."
    >
      <template #actions>
        <VChip
          size="small"
          variant="tonal"
          color="secondary"
          label
          prepend-icon="ri-history-line"
        >
          Ancien circuit
        </VChip>
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
          prepend-icon="ri-add-line"
          @click="creating = true"
        >
          Nouvelle commande
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="stripItems"
      :loading="!loadedOnce"
    />

    <VCard class="mt-6">
      <VTabs
        v-model="tab"
        class="px-2"
      >
        <VTab value="active">
          Actives
          <VChip
            size="x-small"
            class="ms-2"
            variant="tonal"
            color="primary"
          >
            {{ data.active.value.length }}
          </VChip>
        </VTab>
        <VTab value="history">
          Historique
          <VChip
            size="x-small"
            class="ms-2"
            variant="tonal"
            color="secondary"
          >
            {{ data.history.value.length }}
          </VChip>
        </VTab>
      </VTabs>

      <VDivider />

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
        :icon="tab === 'active' ? 'ri-file-list-3-line' : 'ri-archive-line'"
        :title="tab === 'active' ? 'Aucune commande active' : 'Aucune commande dans l\'historique'"
        :text="tab === 'active'
          ? 'Les commandes en cours ou servies, pas encore payées, apparaîtront ici.'
          : 'Les commandes payées ou annulées apparaîtront ici.'"
      >
        <VBtn
          v-if="tab === 'active' && tenant.can('front_of_house')"
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
              tabindex="0"
              @click="selectedId = order.id"
              @keydown.enter="selectedId = order.id"
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
                      {{ formatDateTime(order.created_at) }}
                    </div>
                    <div class="reference-cell text-medium-emphasis">
                      {{ shortRef(order) }}
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
                <template v-if="refundable(order) && data.ledger.value[order.id]">
                  <AppMoney
                    v-if="refundedOf(data.ledger.value[order.id]) > 0"
                    :amount="refundedOf(data.ledger.value[order.id])"
                  />
                  <span
                    v-else
                    class="text-disabled"
                  >—</span>
                  <VChip
                    v-if="pendingOf(data.ledger.value[order.id]) > 0"
                    size="x-small"
                    color="warning"
                    variant="tonal"
                    label
                    class="ms-2"
                  >
                    À traiter
                  </VChip>
                </template>
                <span
                  v-else
                  class="text-disabled"
                >—</span>
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

    <NewOrderDialog
      v-model="creating"
      @created="onCreated"
    />

    <OrderDetailDrawer
      v-model="selectedId"
      :table-names="data.tableNames.value"
      @changed="data.reload()"
      @refunds="data.setRefunds"
    />
  </div>
</template>

<style scoped>
.reference-cell {
  font-size: 0.8125rem;
  max-inline-size: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
