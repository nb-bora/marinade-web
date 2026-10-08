<script setup lang="ts">
import { stockApi } from '../api'
import { downloadCsv, toCsv } from '../csv'
import { formatQty } from '../labels'
import type { ProcurementSuggestions } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatDateTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()

const { data, loading, error, reload } = useAsyncData(
  signal => tenant.currentId
    ? stockApi.procurement(tenant.currentId, signal)
    : Promise.resolve(null as ProcurementSuggestions | null),
  { watch: [() => tenant.currentId] },
)

const items = computed(() => (data.value?.items ?? [])
  .slice()
  .sort((a, b) => a.composant_name.localeCompare(b.composant_name, 'fr')))

const loadedOnce = computed(() => data.value !== null)
const pager = useClientPagination(items, 10)

const strip = computed(() => [
  { label: 'Composants à commander', value: String(items.value.length), icon: 'ri-shopping-basket-2-line' },
  {
    label: 'Proposition établie',
    value: data.value ? formatDateTime(data.value.generated_at) : '—',
    icon: 'ri-time-line',
    hint: 'Calculée à l\'ouverture de la page',
  },
])

function exportCsv() {
  const content = toCsv(
    ['Composant', 'Stock actuel', 'Seuil d\'alerte', 'Quantité à commander', 'Unité'],
    items.value.map(item => [
      item.composant_name,
      formatQty(item.current_stock),
      formatQty(item.seuil_alerte),
      formatQty(item.suggested_order_qty),
      item.unit,
    ]),
  )

  const day = new Date().toISOString().slice(0, 10)

  downloadCsv(`bon-de-commande-${day}.csv`, content)
  toast.success('Bon de commande exporté.')
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Approvisionnement"
      subtitle="Les composants passés sous leur seuil d'alerte, avec la quantité à commander pour revenir à un niveau confortable."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Recalculer
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-download-2-line"
          :disabled="items.length === 0"
          @click="exportCsv"
        >
          Exporter en CSV
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="strip"
      :loading="!loadedOnce && !error"
    />

    <VCard class="mt-6">
      <VCardItem>
        <VCardTitle>Proposition de bon de commande</VCardTitle>
        <VCardSubtitle>Une ligne par composant à réapprovisionner</VCardSubtitle>
      </VCardItem>

      <VDivider />

      <AppErrorState
        v-if="error && !loadedOnce"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="!loadedOnce"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="items.length === 0"
        icon="ri-shield-check-line"
        title="Rien à commander"
        text="Aucun composant n'est sous son seuil d'alerte. Fixez des seuils depuis la page Stock pour être prévenu à temps."
      >
        <VBtn
          variant="outlined"
          to="/stock"
        >
          Aller au stock
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable hover>
          <thead>
            <tr>
              <th>Composant</th>
              <th class="text-end">
                En stock
              </th>
              <th class="text-end d-none d-sm-table-cell">
                Seuil
              </th>
              <th class="text-end">
                À commander
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in pager.rows.value"
              :key="item.composant_id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    color="warning"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon icon="ri-shopping-basket-2-line" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                      {{ item.composant_name }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      en {{ item.unit }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-end tabular-nums">
                {{ formatQty(item.current_stock) }}
              </td>
              <td class="text-end tabular-nums text-medium-emphasis d-none d-sm-table-cell">
                {{ formatQty(item.seuil_alerte) }}
              </td>
              <td class="text-end">
                <VChip
                  color="primary"
                  label
                  class="font-weight-semibold tabular-nums"
                >
                  {{ formatQty(item.suggested_order_qty) }} {{ item.unit }}
                </VChip>
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
  </div>
</template>
