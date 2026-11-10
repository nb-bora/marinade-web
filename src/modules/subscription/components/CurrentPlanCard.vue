<!--
  Offre actuelle : bandeau orange avec le nom de l'offre, son statut et son prix, puis les dates, le
  plafond et l'avancement de la période. Une alerte apparaît quand l'abonnement n'est plus actif
  ou approche de sa fin.
-->
<script setup lang="ts">
import { daysBetween, presentStatus, statusNote } from '../labels'
import type { Subscription, Tier } from '../types'
import { formatDate, formatMoney } from '@/lib/format'

const props = defineProps<{
  subscription: Subscription
  tier: Tier | null
}>()

const status = computed(() => presentStatus(props.subscription.status))
const note = computed(() => statusNote(props.subscription.status))

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

const facts = computed(() => [
  { icon: 'ri-calendar-event-line', label: 'Début', value: formatDate(props.subscription.start_date) },
  { icon: 'ri-calendar-check-line', label: 'Fin', value: props.subscription.end_date ? formatDate(props.subscription.end_date) : 'Sans date de fin' },
  { icon: 'ri-wallet-3-line', label: 'Plafond par jour', value: props.tier ? formatMoney(props.tier.daily_limit_fcfa) : '—' },
  { icon: 'ri-price-tag-3-line', label: 'Prix à l\'année', value: props.tier ? formatMoney(props.tier.annual_price_fcfa) : '—' },
])
</script>

<template>
  <VCard class="plan-card h-100">
    <div class="plan-card__banner">
      <VAvatar
        class="plan-card__crown"
        rounded="lg"
        size="56"
      >
        <VIcon
          icon="ri-vip-crown-2-line"
          size="30"
        />
      </VAvatar>
      <div class="min-w-0 flex-grow-1">
        <div class="plan-card__eyebrow">
          Offre actuelle
        </div>
        <div class="plan-card__name text-truncate">
          {{ tier?.name ?? 'Offre personnalisée' }}
        </div>
        <div
          v-if="tier"
          class="plan-card__price"
        >
          {{ formatMoney(tier.monthly_price_fcfa) }} par mois
        </div>
      </div>
      <AppStatusChip
        class="plan-card__status"
        :label="status.label"
        :tone="status.tone"
        :icon="status.icon"
      />
    </div>

    <VCardText class="pt-5">
      <dl class="plan-facts">
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="plan-fact"
        >
          <VAvatar
            color="primary"
            variant="tonal"
            rounded="lg"
            size="34"
          >
            <VIcon
              :icon="fact.icon"
              size="18"
            />
          </VAvatar>
          <div class="min-w-0">
            <dt class="text-body-2 text-medium-emphasis">
              {{ fact.label }}
            </dt>
            <dd class="text-body-1 font-weight-medium text-truncate">
              {{ fact.value }}
            </dd>
          </div>
        </div>
      </dl>

      <VAlert
        v-if="note"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-5"
      >
        {{ note }}
      </VAlert>

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
          v-if="ending && !note"
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

<style scoped>
.plan-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.plan-card__banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background:
    radial-gradient(circle at 92% -30%, rgba(255, 255, 255, 0.32), transparent 60%),
    linear-gradient(135deg, rgb(var(--v-theme-primary)), #b8470a);
  color: #fff;
}

.plan-card__crown {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.plan-card__eyebrow {
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.plan-card__name {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.25;
}

.plan-card__price {
  color: rgba(255, 255, 255, 0.9);
}

.plan-card__status {
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
}

.plan-facts {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin: 0;
}

.plan-fact {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plan-fact dd {
  margin: 0;
}
</style>
