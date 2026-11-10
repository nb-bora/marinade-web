<script setup lang="ts">
import PaymentSummaryCards from '../components/PaymentSummaryCards.vue'
import PaymentAvatar from '../components/PaymentAvatar.vue'
import PaymentStatusChip from '../components/PaymentStatusChip.vue'
import TransactionDetailDrawer from '../components/TransactionDetailDrawer.vue'
import { RANGES, rangeFor } from '../ranges'
import type { RangeId } from '../ranges'
import { STATUS_GROUPS, countOfGroup, statusesOfGroup } from '../statuses'
import type { StatusGroupId } from '../statuses'
import { formatDateTime } from '@/lib/format'
import type { PaymentSummary, PaymentTransaction } from '@/lib/api/types'
import { useLive } from '@/composables/useLive'
import { usePagedCursor } from '@/composables/usePagedCursor'
import { container } from '@/container'

const rangeId = ref<RangeId>('7d')
const group = ref<StatusGroupId>('all')
const reference = ref('')
const referenceDebounced = refDebounced(reference, 350)
const selectedId = ref<string | null>(null)

const range = computed(() => rangeFor(rangeId.value))
const statuses = computed(() => statusesOfGroup(group.value))
const hasFilters = computed(() => group.value !== 'all' || reference.value.trim() !== '')

const list = usePagedCursor<PaymentTransaction>(
  (cursor, limit, signal) => container.payments.transactions({
    status: statuses.value,
    from: range.value.from,
    to: range.value.to,
    reference: referenceDebounced.value.trim() || undefined,
    cursor,
    limit,
  }, signal),
  10,
)

// Tout changement de filtre repart de la première page.
watch([rangeId, group, referenceDebounced], () => list.reset(), { immediate: true })

// Résumé de la période : il donne les compteurs des filtres et le total exact du tableau.
const summary = ref<PaymentSummary | null>(null)

watch(rangeId, () => {
  summary.value = null
})

const groupOptions = computed(() => STATUS_GROUPS.map(item => ({
  value: item.id,
  title: summary.value ? `${item.title} (${countOfGroup(summary.value.by_status, item.id)})` : item.title,
})))

// Total exact tant que la recherche par référence ne le fausse pas : le résumé sait compter chaque statut.
const total = computed(() => {
  if (!summary.value || referenceDebounced.value.trim())
    return null

  return countOfGroup(summary.value.by_status, group.value)
})

// Les lignes arrivées en direct se signalent un instant. Seule l'actualisation automatique de la
// première page compte : changer de page, de filtre ou de période n'est pas une « arrivée ».
const known = new Set<string>()
const fresh = ref(new Set<string>())
let watchingArrivals = false
let fadeTimer: ReturnType<typeof setTimeout> | undefined

watch(list.items, items => {
  const arrivals = watchingArrivals ? items.filter(item => !known.has(item.id)).map(item => item.id) : []

  if (known.size > 0 && arrivals.length) {
    fresh.value = new Set(arrivals)
    clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
      fresh.value = new Set()
    }, 3000)
  }

  items.forEach(item => known.add(item.id))
}, { flush: 'sync' })

onScopeDispose(() => clearTimeout(fadeTimer))

// « En direct » : la page 1 se met à jour seule ; les pages plus anciennes ne bougent pas.
const { isLive } = useLive(async () => {
  if (list.page.value !== 1)
    return

  watchingArrivals = true
  try {
    await list.refresh()
  }
  finally {
    watchingArrivals = false
  }
})

function clearFilters() {
  group.value = 'all'
  reference.value = ''
}

const cards = ref<InstanceType<typeof PaymentSummaryCards>>()

function afterChange() {
  list.refresh()
  cards.value?.reload()
}

const sourceOf = (item: PaymentTransaction) => item.commande_id ? 'Commande' : item.subscription_id ? 'Abonnement' : null
</script>

<template>
  <div>
    <AppHero
      eyebrow="Finance"
      title="Transactions"
      subtitle="Les paiements Mobile Money reçus par votre restaurant, mis à jour en continu."
      :live="isLive"
    >
      <template #eyebrow-extra>
        · {{ isLive ? 'en direct' : 'en pause' }}
      </template>
      <template #actions>
        <AppSegmented
          v-model="rangeId"
          :options="RANGES.map(option => ({ value: option.id, title: option.title }))"
          label="Période"
        />
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="list.loading.value"
          @click="list.reset(); cards?.reload()"
        >
          Actualiser
        </VBtn>
      </template>
    </AppHero>

    <div class="mt-5 mb-6">
      <PaymentSummaryCards
        ref="cards"
        :range="range"
        @loaded="summary = $event"
      />
    </div>

    <div class="payments-toolbar mb-4">
      <AppSegmented
        v-model="group"
        :options="groupOptions"
        label="Filtrer les transactions par statut"
      />
      <VTextField
        v-model="reference"
        class="payments-toolbar__search"
        label="Rechercher une référence"
        placeholder="MRD-…"
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

    <VCard class="payments-card">
      <div
        v-if="list.loadedOnce.value && (hasFilters || total !== null)"
        class="d-flex flex-wrap align-center gap-3 px-5 py-3"
        aria-live="polite"
      >
        <span class="text-body-2 text-medium-emphasis">
          <template v-if="total !== null">
            {{ total }} transaction{{ total > 1 ? 's' : '' }}<template v-if="group === 'all'">
              sur la période
            </template>
          </template>
          <template v-else>
            Résultats de la recherche
          </template>
        </span>
        <VSpacer />
        <VBtn
          v-if="hasFilters"
          size="small"
          variant="text"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
      </div>

      <VDivider v-if="list.loadedOnce.value && (hasFilters || total !== null)" />

      <AppErrorState
        v-if="list.error.value && !list.loadedOnce.value"
        class="ma-4"
        :error="list.error.value"
        @retry="list.reset()"
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
          ? 'Essayez un autre statut, une autre référence ou une période plus large.'
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
              <th scope="col">
                Transaction
              </th>
              <th
                scope="col"
                class="text-end"
              >
                Montant
              </th>
              <th
                scope="col"
                class="text-end d-none d-md-table-cell"
              >
                Frais
              </th>
              <th
                scope="col"
                class="text-end d-none d-md-table-cell"
              >
                Net
              </th>
              <th scope="col">
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in list.items.value"
              :key="item.id"
              class="cursor-pointer"
              :class="{ 'row-new': fresh.has(item.id), 'row-selected': selectedId === item.id }"
              @click="selectedId = item.id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <PaymentAvatar
                    :status="item.status"
                    :size="38"
                  />
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-no-wrap">
                      {{ formatDateTime(item.created_at) }}
                    </div>
                    <div class="d-flex align-center gap-2 min-w-0">
                      <!-- Le bouton est le point d'entrée au clavier ; toute la ligne reste cliquable à la souris. -->
                      <button
                        type="button"
                        class="reference-cell text-medium-emphasis"
                        :aria-label="`Voir la transaction ${item.reference}`"
                        @click.stop="selectedId = item.id"
                      >
                        {{ item.reference }}
                      </button>
                      <span
                        v-if="sourceOf(item)"
                        class="source-tag"
                      >{{ sourceOf(item) }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-end font-weight-semibold text-high-emphasis">
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

        <AppTablePagination
          :page="list.page.value"
          :page-size="list.pageSize.value"
          :count="list.items.value.length"
          :total="total"
          :pages="list.knownPages.value"
          :has-next="list.hasNext.value"
          :loading="list.loading.value"
          @update:page="list.goTo"
          @update:page-size="list.pageSize.value = $event"
        />
      </template>
    </VCard>

    <TransactionDetailDrawer
      v-model="selectedId"
      @changed="afterChange"
    />
  </div>
</template>

<style scoped>
.payments-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.payments-toolbar__search {
  flex: 0 1 340px;
  min-inline-size: 220px;
}

.payments-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.reference-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  max-inline-size: 16rem;
  overflow: hidden;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference-cell:hover {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}

.reference-cell:focus-visible {
  border-radius: 4px;
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.source-tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.6875rem;
  font-weight: 600;
}

.row-new {
  animation: arrival 3s ease-out;
}

.row-selected {
  background: rgba(var(--v-theme-primary), 0.06);
}

@keyframes arrival {
  from {
    background: rgba(var(--v-theme-success), 0.25);
  }
}

@media (max-width: 599px) {
  .payments-toolbar > * {
    flex: 1 1 100%;
  }

  .payments-toolbar :deep(.app-segmented) {
    display: flex;
    overflow-x: auto;
  }

  .payments-toolbar :deep(.app-segmented__item) {
    flex: 1 0 auto;
    padding-inline: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .row-new {
    animation: none;
  }
}
</style>
