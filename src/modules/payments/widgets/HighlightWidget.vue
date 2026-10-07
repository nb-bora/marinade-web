<script setup lang="ts">
import { usePaymentInsights } from '../composables/usePaymentInsights'
import { formatMoney } from '@/lib/format'
import { useSessionStore } from '@/stores/session.store'

const session = useSessionStore()
const { today, days, loading } = usePaymentInsights()

const yesterday = computed(() => days.value.at(-2)?.collected ?? 0)
const collected = computed(() => today.value?.collected ?? 0)

// Variation par rapport à la veille ; rien à comparer si hier était vide.
const trend = computed(() => {
  if (yesterday.value === 0)
    return null

  return Math.round(((collected.value - yesterday.value) / yesterday.value) * 100)
})
</script>

<template>
  <VCard class="highlight h-100">
    <VCardText class="d-flex h-100">
      <div class="highlight__text">
        <h2 class="text-h5 font-weight-semibold">
          {{ collected > 0 ? `Bravo ${session.user?.first_name ?? ''} ! 🎉` : `Prêt pour le service ! 🍽️` }}
        </h2>
        <p class="text-body-2 text-medium-emphasis mb-3">
          Encaissé aujourd'hui
        </p>

        <VSkeletonLoader
          v-if="loading"
          type="heading"
          width="160"
          class="bg-transparent"
        />
        <div
          v-else
          class="text-h4 font-weight-semibold text-primary tabular-nums text-no-wrap"
        >
          {{ formatMoney(collected) }}
        </div>

        <p
          v-if="!loading"
          class="text-body-2 mb-4 mt-1"
        >
          <template v-if="trend !== null">
            <span :class="trend >= 0 ? 'text-success' : 'text-error'">
              {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend) }} %
            </span>
            <span class="text-medium-emphasis"> par rapport à hier</span>
          </template>
          <span
            v-else
            class="text-medium-emphasis"
          >{{ today?.transactions ?? 0 }} paiement(s) aujourd'hui</span>
        </p>

        <VBtn
          to="/payments"
          size="small"
        >
          Voir les ventes
        </VBtn>
      </div>

      <TrophyIllustration class="highlight__trophy" />
    </VCardText>
  </VCard>
</template>

<style scoped>
.highlight__text {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.highlight__trophy {
  flex: none;
  align-self: flex-end;
  inline-size: 5.5rem;
  margin-inline-start: 0.5rem;
}
</style>
