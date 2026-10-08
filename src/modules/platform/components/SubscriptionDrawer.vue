<!-- Détail d'un abonnement : statut, propriétaire, soldes quotidiens. -->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { platformApi } from '../api'
import type { TrackedSubscription } from '../composables/useTrackedSubscriptions'
import { SUBSCRIPTION_STATUS_OPTIONS, presentSubscriptionStatus } from '../labels'
import type { DailyBalance, SubscriptionStatus, Tier } from '../types'
import BalanceFormDialog from './BalanceFormDialog.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDate, formatMoney } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ entries: TrackedSubscription[]; tiers: Tier[] }>()
const emit = defineEmits<{ changed: []; forget: [id: string] }>()

/** Identifiant de l'abonnement affiché ; `null` ferme le tiroir. */
const subscriptionId = defineModel<string | null>({ required: true })

const toast = useToast()
const confirm = useConfirm()
const balanceDialog = ref(false)

const isOpen = computed({
  get: () => subscriptionId.value !== null,
  set: open => {
    if (!open)
      subscriptionId.value = null
  },
})

onKeyStroke('Escape', () => {
  if (isOpen.value && !balanceDialog.value)
    isOpen.value = false
})

const entry = computed(() => props.entries.find(item => item.subscription.id === subscriptionId.value) ?? null)
const subscription = computed(() => entry.value?.subscription ?? null)
const tier = computed(() => props.tiers.find(item => item.id === subscription.value?.tier_id) ?? null)
const status = computed(() => subscription.value ? presentSubscriptionStatus(subscription.value.status) : null)

// Propriétaire du compte et soldes
const { data: owner } = useAsyncData(
  async signal => subscription.value ? await platformApi.user(subscription.value.user_id, signal).catch(() => null) : null,
  { watch: [subscriptionId] },
)

const { data: balances, loading, error, reload, refresh } = useAsyncData(async signal => {
  const id = subscriptionId.value

  if (!id)
    return { current: null, history: [] as DailyBalance[] }

  // Le solde du jour se lit dans l'historique : `GET .../balances/current` répond 404 (une erreur
  // dans la console du navigateur) tant qu'il n'existe pas.
  const history = [...await platformApi.balances(id, signal)].sort((a, b) => b.balance_date.localeCompare(a.balance_date))
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return { current: history.find(balance => balance.balance_date === today) ?? null, history }
}, { watch: [subscriptionId] })

const current = computed(() => balances.value?.current ?? null)
const history = computed(() => balances.value?.history ?? [])

const usedPercent = computed(() => {
  const value = current.value

  return value && value.initial_balance_fcfa > 0 ? Math.min(100, Math.round((value.used_balance_fcfa / value.initial_balance_fcfa) * 100)) : 0
})

// Changement de statut
const newStatus = ref<SubscriptionStatus>('active')

watch(subscription, value => {
  if (value)
    newStatus.value = value.status as SubscriptionStatus
}, { immediate: true })

const statusChange = useSubmit(async (value: SubscriptionStatus) => {
  if (!subscription.value || value === subscription.value.status)
    return

  const needsConfirm = value === 'cancelled' || value === 'suspended' || value === 'expired'

  if (needsConfirm && !await confirm({
    title: `Passer l'abonnement en « ${presentSubscriptionStatus(value).label.toLowerCase()} » ?`,
    text: 'Le restaurant peut perdre l\'accès à ses encaissements. Vous pourrez rétablir le statut ensuite.',
    confirmLabel: 'Confirmer',
    danger: true,
  })) {
    newStatus.value = subscription.value.status as SubscriptionStatus

    return
  }

  await platformApi.setSubscriptionStatus(subscription.value.id, value)
  toast.success('Statut mis à jour.')
  emit('changed')
})

watch(statusChange.error, cause => {
  if (cause) {
    toast.error(cause)
    if (subscription.value)
      newStatus.value = subscription.value.status as SubscriptionStatus
  }
})

// Soldes
const reset = useSubmit(async () => {
  if (!subscription.value)
    return

  const accepted = await confirm({
    title: 'Réinitialiser le solde du jour ?',
    text: `Le solde d'aujourd'hui repart au plafond de l'offre (${formatMoney(tier.value?.daily_limit_fcfa)}), sans rien consommé.`,
    confirmLabel: 'Réinitialiser',
    danger: true,
  })

  if (!accepted)
    return

  await platformApi.resetBalance(subscription.value.id)
  toast.success('Solde du jour réinitialisé.')
  await refresh()
})

watch(reset.error, cause => {
  if (cause)
    toast.error(cause)
})

async function copyId() {
  if (!subscription.value)
    return

  try {
    await navigator.clipboard.writeText(subscription.value.id)
    toast.info('Identifiant copié.')
  }
  catch {
    toast.warning('Copie impossible : sélectionnez l\'identifiant à la main.')
  }
}
</script>

<template>
  <VNavigationDrawer
    v-model="isOpen"
    location="end"
    temporary
    width="440"
    aria-label="Détail de l'abonnement"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Abonnement
      </h2>
      <IconBtn
        aria-label="Fermer"
        @click="isOpen = false"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <div
      v-if="subscription && status"
      class="px-4 pb-6"
    >
      <div class="d-flex align-center gap-3 mb-4">
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
          size="48"
        >
          <VIcon icon="ri-store-2-line" />
        </VAvatar>
        <div class="min-w-0">
          <div class="text-h6 text-truncate">
            {{ entry?.restaurantName }}
          </div>
          <AppStatusChip
            :label="status.label"
            :tone="status.tone"
            :icon="status.icon"
          />
        </div>
      </div>

      <VList
        density="compact"
        class="py-0"
      >
        <VListItem
          title="Offre"
          :subtitle="tier ? `${tier.name}, ${formatMoney(tier.monthly_price_fcfa)} par mois` : 'Offre inconnue'"
        />
        <VListItem
          title="Propriétaire du compte"
          :subtitle="owner ? `${owner.first_name} ${owner.last_name}` : '—'"
        />
        <VListItem
          title="Période"
          :subtitle="`Depuis le ${formatDate(subscription.start_date)}${subscription.end_date ? `, jusqu'au ${formatDate(subscription.end_date)}` : ', sans date de fin'}`"
        />
        <VListItem
          title="Identifiant"
          :subtitle="subscription.id"
        >
          <template #append>
            <IconBtn
              size="small"
              aria-label="Copier l'identifiant"
              @click="copyId"
            >
              <VIcon icon="ri-file-copy-line" />
            </IconBtn>
          </template>
        </VListItem>
      </VList>

      <VSelect
        v-model="newStatus"
        :items="SUBSCRIPTION_STATUS_OPTIONS"
        label="Statut de l'abonnement"
        class="mt-4"
        :loading="statusChange.pending.value"
        :disabled="statusChange.pending.value"
        @update:model-value="statusChange.submit($event)"
      />

      <VDivider class="my-4" />

      <div class="d-flex align-center justify-space-between gap-2 mb-3">
        <h3 class="text-subtitle-1 font-weight-semibold">
          Solde du jour
        </h3>
        <VBtn
          size="small"
          variant="tonal"
          prepend-icon="ri-add-line"
          @click="balanceDialog = true"
        >
          Créer un solde
        </VBtn>
      </div>

      <AppErrorState
        v-if="error && balances === null"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="loading && balances === null"
        type="list-item-two-line, list-item-two-line"
      />

      <template v-else>
        <VCard
          v-if="current"
          variant="tonal"
          color="primary"
        >
          <VCardText>
            <div class="d-flex justify-space-between align-baseline">
              <span class="text-h5 font-weight-semibold tabular-nums">
                <AppMoney :amount="current.initial_balance_fcfa - current.used_balance_fcfa" />
              </span>
              <span class="text-body-2">restant sur <AppMoney :amount="current.initial_balance_fcfa" /></span>
            </div>
            <VProgressLinear
              :model-value="usedPercent"
              color="primary"
              height="8"
              rounded
              class="mt-3"
              :aria-label="`${usedPercent} % du solde consommé`"
            />
            <div class="text-body-2 mt-2">
              {{ usedPercent }} % consommé aujourd'hui
            </div>
          </VCardText>
        </VCard>
        <AppEmptyState
          v-else
          icon="ri-wallet-3-line"
          title="Pas de solde aujourd'hui"
          text="Créez le solde du jour, ou réinitialisez-le au plafond de l'offre."
        />

        <VBtn
          class="mt-3"
          variant="outlined"
          color="warning"
          block
          prepend-icon="ri-restart-line"
          :loading="reset.pending.value"
          @click="reset.submit()"
        >
          Réinitialiser le solde du jour
        </VBtn>

        <h3 class="text-subtitle-1 font-weight-semibold mt-6 mb-2">
          Historique
        </h3>
        <VTable
          v-if="history.length"
          density="compact"
        >
          <thead>
            <tr>
              <th>Jour</th>
              <th class="text-end">
                Départ
              </th>
              <th class="text-end">
                Consommé
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="balance in history.slice(0, 15)"
              :key="balance.id"
            >
              <td class="text-no-wrap">
                {{ formatDate(balance.balance_date) }}
              </td>
              <td class="text-end">
                <AppMoney :amount="balance.initial_balance_fcfa" />
              </td>
              <td class="text-end">
                <AppMoney :amount="balance.used_balance_fcfa" />
              </td>
            </tr>
          </tbody>
        </VTable>
        <p
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Aucun solde enregistré pour cet abonnement.
        </p>
      </template>

      <VBtn
        class="mt-6"
        variant="text"
        color="secondary"
        size="small"
        prepend-icon="ri-eye-off-line"
        @click="emit('forget', subscription.id); isOpen = false"
      >
        Ne plus suivre dans cette liste
      </VBtn>
    </div>

    <BalanceFormDialog
      v-model="balanceDialog"
      :subscription="subscription"
      :tier="tier"
      @saved="refresh"
    />
  </VNavigationDrawer>
</template>
