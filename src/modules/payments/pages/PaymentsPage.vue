<script setup lang="ts">
import PaymentSummaryCards from '../components/PaymentSummaryCards.vue'
import PaymentStatusChip from '../components/PaymentStatusChip.vue'
import TransactionDetailDrawer from '../components/TransactionDetailDrawer.vue'
import { RANGES, rangeFor } from '../ranges'
import type { RangeId } from '../ranges'
import { STATUS_OPTIONS } from '../statuses'
import { formatDateTime } from '@/lib/format'
import type { PaymentStatus, PaymentTransaction } from '@/lib/api/types'
import { useLive } from '@/composables/useLive'
import { useCursorList } from '@/composables/useCursorList'
import { container } from '@/container'

const PAGE_SIZE = 50

const rangeId = ref<RangeId>('7d')
const statuses = ref<PaymentStatus[]>([])
const reference = ref('')
const referenceDebounced = refDebounced(reference, 350)
const selectedId = ref<string | null>(null)

const range = computed(() => rangeFor(rangeId.value))
const hasFilters = computed(() => statuses.value.length > 0 || reference.value.trim() !== '')

const list = useCursorList<PaymentTransaction>(
  (cursor, signal) => container.payments.transactions({
    status: statuses.value,
    from: range.value.from,
    to: range.value.to,
    reference: referenceDebounced.value.trim() || undefined,
    cursor,
    limit: PAGE_SIZE,
  }, signal),
  { keyOf: item => item.id },
)

// Tout changement de filtre repart de la première page.
watch([rangeId, statuses, referenceDebounced], () => list.reload(), { immediate: true })

// « En direct » : la tête de liste se met à jour seule, sans faire sauter la liste déroulée.
const { isLive } = useLive(() => list.refreshHead())

// Les lignes arrivées APRÈS l'affichage initial se signalent un instant.
const known = new Set<string>()
const fresh = ref(new Set<string>())

watch(list.items, items => {
  const arrivals = items.filter(item => !known.has(item.id)).map(item => item.id)

  if (known.size > 0 && arrivals.length) {
    fresh.value = new Set(arrivals)
    setTimeout(() => {
      fresh.value = new Set()
    }, 3000)
  }

  items.forEach(item => known.add(item.id))
})

function clearFilters() {
  statuses.value = []
  reference.value = ''
}

const summary = ref<InstanceType<typeof PaymentSummaryCards>>()

function afterChange() {
  list.refreshHead()
  summary.value?.reload()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Transactions"
      subtitle="Les paiements Mobile Money reçus par votre restaurant, mis à jour en continu."
    >
      <template #actions>
        <VChip
          :color="isLive ? 'success' : 'secondary'"
          variant="tonal"
          size="small"
          label
        >
          <span
            class="live-dot me-2"
            :class="{ 'live-dot--on': isLive }"
          />
          {{ isLive ? 'En direct' : 'En pause' }}
        </VChip>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="list.loading.value"
          @click="list.reload()"
        >
          Actualiser
        </VBtn>
      </template>
    </AppPageHeader>

    <AppSegmented
      v-model="rangeId"
      :options="RANGES.map(option => ({ value: option.id, title: option.title }))"
      label="Période"
      class="mb-4"
    />

    <PaymentSummaryCards
      ref="summary"
      class="mb-2"
      :range="range"
    />

    <VCard class="mt-4">
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="5"
          >
            <VSelect
              v-model="statuses"
              :items="STATUS_OPTIONS"
              label="Statut"
              multiple
              chips
              closable-chips
              clearable
              placeholder="Tous les statuts"
            />
          </VCol>
          <VCol
            cols="12"
            md="5"
          >
            <VTextField
              v-model="reference"
              label="Référence"
              placeholder="MRD-…"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
            />
          </VCol>
          <VCol
            cols="12"
            md="2"
            class="d-flex align-center"
          >
            <VBtn
              v-if="hasFilters"
              variant="text"
              color="secondary"
              block
              @click="clearFilters"
            >
              Effacer
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <AppErrorState
        v-if="list.error.value && !list.loadedOnce.value"
        class="ma-4"
        :error="list.error.value"
        @retry="list.reload()"
      />

      <VSkeletonLoader
        v-else-if="!list.loadedOnce.value"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="list.items.value.length === 0"
        icon="ri-bank-card-line"
        :title="hasFilters ? 'Aucune transaction ne correspond' : 'Aucune transaction sur cette période'"
        :text="hasFilters
          ? 'Essayez d\'autres filtres ou une période plus large.'
          : 'Les paiements Mobile Money de vos clients apparaîtront ici dès leur réception.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="transactions-table"
        >
          <thead>
            <tr>
              <th>Date</th>
              <th>Référence</th>
              <th class="text-end">
                Montant
              </th>
              <th class="text-end d-none d-md-table-cell">
                Frais
              </th>
              <th class="text-end d-none d-md-table-cell">
                Net
              </th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in list.items.value"
              :key="item.id"
              class="cursor-pointer"
              :class="{ 'row-new': fresh.has(item.id) }"
              tabindex="0"
              @click="selectedId = item.id"
              @keydown.enter="selectedId = item.id"
            >
              <td class="text-no-wrap">
                {{ formatDateTime(item.created_at) }}
              </td>
              <td class="reference-cell">
                {{ item.reference }}
              </td>
              <td class="text-end font-weight-medium">
                <AppMoney
                  :amount="item.amount_fcfa"
                  :currency="item.currency"
                />
              </td>
              <td class="text-end d-none d-md-table-cell text-medium-emphasis">
                <AppMoney
                  :amount="item.fees_fcfa"
                  :currency="item.currency"
                />
              </td>
              <td class="text-end d-none d-md-table-cell">
                <AppMoney
                  :amount="item.net_amount_fcfa"
                  :currency="item.currency"
                />
              </td>
              <td>
                <PaymentStatusChip :status="item.status" />
              </td>
            </tr>
          </tbody>
        </VTable>

        <VDivider />

        <div class="d-flex align-center justify-center pa-4 gap-3 text-body-2 text-medium-emphasis">
          <VBtn
            v-if="list.hasMore.value"
            variant="tonal"
            :loading="list.loadingMore.value"
            @click="list.loadMore()"
          >
            Charger plus
          </VBtn>
          <span v-else>
            {{ list.items.value.length }} transaction{{ list.items.value.length > 1 ? 's' : '' }} — fin de la liste
          </span>
        </div>
      </template>
    </VCard>

    <TransactionDetailDrawer
      v-model="selectedId"
      @changed="afterChange"
    />
  </div>
</template>

<style scoped>
.reference-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  max-inline-size: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-dot {
  display: inline-block;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: currentcolor;
}

.live-dot--on {
  animation: pulse 2s ease-in-out infinite;
}

.row-new {
  animation: arrival 3s ease-out;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@keyframes arrival {
  from {
    background: rgba(var(--v-theme-success), 0.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot--on,
  .row-new {
    animation: none;
  }
}
</style>
