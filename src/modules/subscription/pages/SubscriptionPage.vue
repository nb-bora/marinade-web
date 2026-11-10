<script setup lang="ts">
import { subscriptionApi } from '../api'
import BalanceHistoryCard from '../components/BalanceHistoryCard.vue'
import CurrentPlanCard from '../components/CurrentPlanCard.vue'
import DailyGaugeCard from '../components/DailyGaugeCard.vue'
import PlansComparison from '../components/PlansComparison.vue'
import RecordPurchaseDialog from '../components/RecordPurchaseDialog.vue'
import TransactionDrawer from '../components/TransactionDrawer.vue'
import { useSubscription } from '../composables/useSubscription'
import { explainError } from '../labels'
import type { SubscriptionTransaction } from '../types'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const data = useSubscription()

const selected = ref<SubscriptionTransaction | null>(null)
const recording = ref(false)

const { overview, subscription, tier, transactions, pager } = data

// L'historique complet ne se relit que si la consommation a changé : voir `refreshLive`.
useLive(() => data.refreshLive())

const loadedOnce = computed(() => overview.data.value !== null)
const canRecord = computed(() => tenant.can('cash_desk') && subscription.value?.status === 'active')

/** Sans solde ouvert aujourd'hui, ou une fois le plafond atteint, le back refuserait l'imputation. */
const recordBlocked = computed(() => overview.data.value?.today == null || data.remaining.value === 0)

const recordHint = computed(() => {
  if (overview.data.value?.today == null)
    return 'Aucun solde n\'est ouvert aujourd\'hui.'

  return data.remaining.value === 0 ? 'Le plafond du jour est atteint.' : undefined
})

// Recherche par identifiant du terminal de paiement -----------------------------------

const posId = ref('')
const posMessage = ref('')

const { submit: searchPos, pending: searching } = useSubmit(async () => {
  const wanted = posId.value.trim()

  posMessage.value = ''
  if (!wanted)
    return

  try {
    const found = await subscriptionApi.byPosId(wanted)

    if (found)
      selected.value = found
    else
      posMessage.value = 'Aucune transaction ne porte cet identifiant dans ce restaurant.'
  }
  catch (cause) {
    posMessage.value = explainError(cause)
  }
})

watch(posId, () => {
  posMessage.value = ''
})
</script>

<template>
  <div>
    <AppHero
      eyebrow="Abonnement"
      title="Mon abonnement"
      subtitle="Votre offre, ce qu'il reste à consommer aujourd'hui et l'historique de vos achats."
      live
    >
      <template
        v-if="tier"
        #eyebrow-extra
      >
        · Offre {{ tier.name }}
      </template>
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="overview.loading.value || transactions.loading.value"
          @click="data.reloadAll()"
        >
          Actualiser
        </VBtn>
        <VBtn
          v-if="canRecord"
          color="primary"
          prepend-icon="ri-shopping-bag-3-line"
          :disabled="recordBlocked"
          :title="recordHint"
          @click="recording = true"
        >
          Imputer un achat
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="overview.error.value && !loadedOnce"
      class="mt-5"
      :error="overview.error.value"
      @retry="overview.reload()"
    />

    <template v-else-if="!loadedOnce">
      <VRow class="mt-0">
        <VCol
          cols="12"
          md="8"
        >
          <VSkeletonLoader
            type="heading, list-item-two-line, list-item-two-line"
            class="rounded-lg"
          />
        </VCol>
        <VCol
          cols="12"
          md="4"
        >
          <VSkeletonLoader
            type="image"
            height="260"
            class="rounded-lg"
          />
        </VCol>
      </VRow>
    </template>

    <template v-else-if="subscription">
      <VRow class="mt-0">
        <VCol
          cols="12"
          md="8"
        >
          <CurrentPlanCard
            :subscription="subscription"
            :tier="tier"
          />
        </VCol>
        <VCol
          cols="12"
          md="4"
        >
          <DailyGaugeCard
            :limit="data.dailyLimit.value"
            :used="data.used.value"
            :remaining="data.remaining.value"
            :percent="data.usedPercent.value"
            :open="overview.data.value?.today != null"
          />
        </VCol>
      </VRow>

      <div class="mt-6">
        <BalanceHistoryCard :balances="overview.data.value?.balances ?? []" />
      </div>

      <VCard class="mt-6 tx-card">
        <VCardItem class="pb-2">
          <VCardTitle>Transactions</VCardTitle>
          <VCardSubtitle>Les achats imputés sur votre plafond, du plus récent au plus ancien</VCardSubtitle>
        </VCardItem>

        <VAlert
          v-if="data.truncated.value"
          type="info"
          variant="tonal"
          density="compact"
          class="mx-4 mb-2"
        >
          Seuls les {{ pager.total.value }} achats les plus récents sont chargés : les plus anciens ne figurent pas dans cette liste.
        </VAlert>

        <VCardText v-if="tenant.can('cash_desk')">
          <VTextField
            v-model="posId"
            label="Retrouver un achat"
            placeholder="Identifiant du terminal de paiement"
            prepend-inner-icon="ri-search-line"
            clearable
            autocomplete="off"
            :loading="searching"
            :error-messages="posMessage"
            hide-details="auto"
            class="pos-search"
            @keydown.enter.prevent="searchPos"
            @click:clear="posMessage = ''"
          >
            <template #append-inner>
              <VBtn
                size="small"
                variant="tonal"
                :disabled="!posId.trim() || searching"
                @click="searchPos"
              >
                Chercher
              </VBtn>
            </template>
          </VTextField>
        </VCardText>

        <VDivider />

        <AppErrorState
          v-if="transactions.error.value && !transactions.data.value"
          class="ma-4"
          :error="transactions.error.value"
          @retry="transactions.reload()"
        />

        <VSkeletonLoader
          v-else-if="transactions.loading.value && !transactions.data.value"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="pager.total.value === 0"
          icon="ri-exchange-funds-line"
          title="Aucune transaction"
          text="Les achats imputés sur votre plafond journalier apparaîtront ici."
        />

        <template v-else>
          <VTable
            hover
            class="transactions-table"
          >
            <thead>
              <tr>
                <th>Transaction</th>
                <th class="d-none d-md-table-cell">
                  Terminal de paiement
                </th>
                <th class="text-end">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in pager.rows.value"
                :key="item.id"
                class="cursor-pointer"
                tabindex="0"
                :aria-label="`Ouvrir l'achat : ${item.description || 'sans description'}`"
                @click="selected = item"
                @keydown.enter="selected = item"
                @keydown.space.prevent="selected = item"
              >
                <td>
                  <div class="d-flex align-center gap-3 py-2">
                    <VAvatar
                      variant="tonal"
                      rounded
                      size="38"
                      color="primary"
                    >
                      <VIcon
                        icon="ri-shopping-bag-3-line"
                        size="20"
                      />
                    </VAvatar>
                    <div class="min-w-0">
                      <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate description-cell">
                        {{ item.description || 'Achat sans description' }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis text-no-wrap">
                        {{ formatDateTime(item.created_at) }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="d-none d-md-table-cell text-medium-emphasis font-mono">
                  {{ item.pos_transaction_id || '—' }}
                </td>
                <td class="text-end font-weight-semibold text-high-emphasis">
                  <AppMoney :amount="item.amount_fcfa" />
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
    </template>

    <VCard
      v-else
      class="mt-5"
    >
      <AppEmptyState
        icon="ri-vip-crown-2-line"
        title="Aucun abonnement actif pour ce restaurant"
        text="Votre compte n'a pas d'abonnement actif sur ce restaurant. Choisissez une offre ci-dessous et rapprochez-vous de l'équipe Marinade pour la souscrire."
      />
    </VCard>

    <div
      v-if="loadedOnce && overview.data.value && overview.data.value.tiers.length"
      class="mt-8"
    >
      <PlansComparison
        :tiers="overview.data.value.tiers"
        :current-id="subscription?.tier_id ?? null"
      />
    </div>

    <TransactionDrawer v-model="selected" />

    <RecordPurchaseDialog
      v-if="subscription"
      v-model="recording"
      :subscription="subscription"
      :remaining="data.remaining.value"
      @recorded="data.reload()"
    />
  </div>
</template>

<style scoped>
.tx-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.transactions-table tbody tr:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.pos-search {
  max-inline-size: 32rem;
}

.description-cell {
  max-inline-size: 22rem;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
}
</style>
