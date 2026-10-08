<script setup lang="ts">
import { daysBetween, presentStatus } from '../labels'
import type { Subscription, Tier } from '../types'
import { formatDate, formatMoney } from '@/lib/format'

const props = defineProps<{
  subscription: Subscription
  tier: Tier | null
}>()

const status = computed(() => presentStatus(props.subscription.status))

const today = computed(() => new Date().toLocaleDateString('sv-SE'))

/** Jours de la période (début → fin) et jours restants ; `null` pour un abonnement sans date de fin. */
const period = computed(() => {
  const end = props.subscription.end_date

  if (!end)
    return null

  const total = Math.max(1, daysBetween(props.subscription.start_date, end))
  const left = Math.max(0, daysBetween(today.value, end))
  const elapsed = Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100)))

  return { total, left, elapsed }
})

const ending = computed(() => period.value !== null && period.value.left <= 14)
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Offre actuelle</VCardTitle>
      <VCardSubtitle>Ce que votre restaurant a souscrit</VCardSubtitle>
      <template #append>
        <AppStatusChip
          :label="status.label"
          :tone="status.tone"
          :icon="status.icon"
        />
      </template>
    </VCardItem>

    <VCardText>
      <div class="d-flex align-center gap-4 mb-6">
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
          size="56"
        >
          <VIcon
            icon="ri-vip-crown-2-line"
            size="30"
          />
        </VAvatar>
        <div class="min-w-0">
          <div class="text-h4 font-weight-semibold text-truncate">
            {{ tier?.name ?? 'Offre personnalisée' }}
          </div>
          <div
            v-if="tier"
            class="text-body-1 text-medium-emphasis"
          >
            {{ formatMoney(tier.monthly_price_fcfa) }} par mois
          </div>
        </div>
      </div>

      <VRow>
        <VCol
          cols="6"
          md="3"
        >
          <div class="text-body-2 text-medium-emphasis">
            Début
          </div>
          <div class="text-body-1 font-weight-medium">
            {{ formatDate(subscription.start_date) }}
          </div>
        </VCol>
        <VCol
          cols="6"
          md="3"
        >
          <div class="text-body-2 text-medium-emphasis">
            Fin
          </div>
          <div class="text-body-1 font-weight-medium">
            {{ subscription.end_date ? formatDate(subscription.end_date) : 'Sans date de fin' }}
          </div>
        </VCol>
        <VCol
          cols="6"
          md="3"
        >
          <div class="text-body-2 text-medium-emphasis">
            Plafond par jour
          </div>
          <div class="text-body-1 font-weight-medium">
            {{ tier ? formatMoney(tier.daily_limit_fcfa) : '—' }}
          </div>
        </VCol>
        <VCol
          cols="6"
          md="3"
        >
          <div class="text-body-2 text-medium-emphasis">
            Prix à l'année
          </div>
          <div class="text-body-1 font-weight-medium">
            {{ tier ? formatMoney(tier.annual_price_fcfa) : '—' }}
          </div>
        </VCol>
      </VRow>

      <template v-if="period">
        <div class="d-flex justify-space-between text-body-2 mt-6 mb-2">
          <span class="font-weight-medium">Période en cours</span>
          <span class="text-medium-emphasis">
            {{ period.left === 0 ? 'Terminée' : `${period.left} jour${period.left > 1 ? 's' : ''} restant${period.left > 1 ? 's' : ''}` }}
          </span>
        </div>
        <VProgressLinear
          :model-value="period.elapsed"
          :color="ending ? 'warning' : 'primary'"
          height="10"
          rounded
          aria-label="Avancement de la période d'abonnement"
        />
        <VAlert
          v-if="ending"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          {{ period.left === 0
            ? 'Votre période d\'abonnement est terminée.'
            : `Votre abonnement se termine dans ${period.left} jour${period.left > 1 ? 's' : ''}.` }}
          Rapprochez-vous de l'équipe Marinade pour le renouveler.
        </VAlert>
      </template>
    </VCardText>
  </VCard>
</template>
