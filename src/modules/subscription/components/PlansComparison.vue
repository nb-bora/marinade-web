<script setup lang="ts">
import { monthsOffered } from '../labels'
import type { Tier } from '../types'
import { formatMoney } from '@/lib/format'

const props = defineProps<{
  tiers: Tier[]

  /** Offre du restaurant, si elle est connue. */
  currentId: number | null
}>()

type Billing = 'monthly' | 'annual'

const billing = ref<Billing>('monthly')

const sorted = computed(() => [...props.tiers].sort((a, b) => a.daily_limit_fcfa - b.daily_limit_fcfa))
const current = computed(() => props.tiers.find(tier => tier.id === props.currentId) ?? null)

const price = (tier: Tier) => (billing.value === 'monthly' ? tier.monthly_price_fcfa : tier.annual_price_fcfa)

/** Écart de plafond avec l'offre actuelle, pour situer chaque offre d'un coup d'œil. */
function compared(tier: Tier): string | null {
  if (!current.value || tier.id === current.value.id)
    return null

  const gap = tier.daily_limit_fcfa - current.value.daily_limit_fcfa

  if (gap === 0)
    return null

  return gap > 0
    ? `${formatMoney(gap)} de plus par jour que votre offre`
    : `${formatMoney(Math.abs(gap))} de moins par jour que votre offre`
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-5">
      <div>
        <h2 class="text-h5 font-weight-semibold">
          Comparer les offres
        </h2>
        <p class="text-body-1 text-medium-emphasis mb-0 mt-1">
          Le plafond journalier fixe ce que votre restaurant peut consommer chaque jour.
        </p>
      </div>
      <AppSegmented
        v-model="billing"
        label="Durée de facturation"
        :options="[{ value: 'monthly', title: 'Au mois' }, { value: 'annual', title: 'À l\'année' }]"
      />
    </div>

    <VRow>
      <VCol
        v-for="tier in sorted"
        :key="tier.id"
        cols="12"
        sm="6"
        :lg="sorted.length >= 4 ? 3 : 12 / Math.max(sorted.length, 1)"
      >
        <VCard
          class="h-100 plan-card"
          :class="{ 'plan-card--current': tier.id === currentId }"
          variant="flat"
          border
        >
          <VCardText class="d-flex flex-column h-100">
            <div class="d-flex align-center justify-space-between gap-2 mb-4">
              <h3 class="text-h6 font-weight-semibold">
                {{ tier.name }}
              </h3>
              <VChip
                v-if="tier.id === currentId"
                color="primary"
                size="small"
                label
              >
                Offre actuelle
              </VChip>
            </div>

            <div class="d-flex align-baseline flex-wrap gap-x-2">
              <span class="text-h4 font-weight-semibold tabular-nums">{{ formatMoney(price(tier)) }}</span>
              <span class="text-body-2 text-medium-emphasis">{{ billing === 'monthly' ? 'par mois' : 'par an' }}</span>
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1 plan-card__note">
              <template v-if="billing === 'annual' && monthsOffered(tier) > 0">
                {{ monthsOffered(tier) }} mois offert{{ monthsOffered(tier) > 1 ? 's' : '' }} par rapport au paiement mensuel
              </template>
              <template v-else-if="billing === 'annual'">
                Soit {{ formatMoney(Math.round(tier.annual_price_fcfa / 12)) }} par mois
              </template>
            </div>

            <VDivider class="my-4" />

            <ul class="plan-card__list">
              <li>
                <VIcon
                  icon="ri-checkbox-circle-line"
                  color="primary"
                  size="20"
                />
                <span>Plafond de <strong>{{ formatMoney(tier.daily_limit_fcfa) }}</strong> par jour</span>
              </li>
              <li>
                <VIcon
                  icon="ri-checkbox-circle-line"
                  color="primary"
                  size="20"
                />
                <span>Solde remis à zéro chaque jour</span>
              </li>
              <li v-if="compared(tier)">
                <VIcon
                  :icon="tier.daily_limit_fcfa > (current?.daily_limit_fcfa ?? 0) ? 'ri-arrow-up-circle-line' : 'ri-arrow-down-circle-line'"
                  color="secondary"
                  size="20"
                />
                <span>{{ compared(tier) }}</span>
              </li>
            </ul>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <p class="text-body-2 text-medium-emphasis mt-4 mb-0">
      Le changement d'offre est géré par l'équipe Marinade : rapprochez-vous d'elle pour passer à une autre offre.
    </p>
  </div>
</template>

<style scoped>
.plan-card--current {
  border-color: rgb(var(--v-theme-primary)) !important;
  border-width: 2px !important;
}

.plan-card__note {
  min-block-size: 1.5rem;
}

.plan-card__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.plan-card__list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
</style>
