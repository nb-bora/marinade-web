<!--
  Chiffres clés de la période choisie : encaissé, net après frais, nombre de transactions et taux de
  réussite (hors paiements encore en route). Même grille de tuiles que la salle et le menu.
-->
<script setup lang="ts">
import { successRate } from '../composables/usePaymentInsights'
import type { DateRange } from '../ranges'
import { countOfGroup } from '../statuses'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import type { PaymentSummary } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'

const props = withDefaults(defineProps<{
  range: DateRange
  hint?: string
  live?: boolean
}>(), { live: true })

const emit = defineEmits<{ loaded: [summary: PaymentSummary] }>()

const summary = ref<PaymentSummary | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

let controller: AbortController | null = null

async function load(silent = false) {
  controller?.abort()

  const current = new AbortController()

  controller = current
  loading.value = !silent && summary.value === null

  try {
    const result = await container.payments.summary(props.range, current.signal)

    if (!current.signal.aborted) {
      summary.value = result
      emit('loaded', result)
      error.value = null
    }
  }
  catch (cause) {
    if (!current.signal.aborted && summary.value === null)
      error.value = cause
  }
  finally {
    if (!current.signal.aborted)
      loading.value = false
  }
}

// Changer de période repart de zéro : les chiffres de l'ancienne période ne doivent pas rester affichés.
watch(() => [props.range.from?.getTime(), props.range.to?.getTime()], () => {
  summary.value = null
  load()
}, { immediate: true })

if (props.live)
  useLive(() => load(true))

onScopeDispose(() => controller?.abort())

const currency = computed(() => summary.value?.currency ?? 'XAF')
const successCount = computed(() => summary.value?.by_status.success?.count ?? 0)
const pendingCount = computed(() => countOfGroup(summary.value?.by_status, 'pending'))
const rate = computed(() => successRate(summary.value))
const fees = computed(() => Number(summary.value?.fees_fcfa ?? 0))

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

defineExpose({ reload: () => load(true) })
</script>

<template>
  <AppErrorState
    v-if="error"
    :error="error"
    @retry="load"
  />

  <AppMetricGrid v-else-if="loading">
    <VSkeletonLoader
      v-for="n in 4"
      :key="n"
      type="article"
      class="metric-skeleton"
    />
  </AppMetricGrid>

  <AppMetricGrid v-else>
    <AppMetricTile
      hero
      label="Encaissé"
      icon="ri-money-dollar-circle-line"
      :hint="hint || `${plural(successCount, 'paiement')} ${successCount > 1 ? 'réussis' : 'réussi'}`"
    >
      <AppAnimatedNumber
        v-slot="{ current }"
        :value="Number(summary?.collected_fcfa ?? 0)"
      >
        {{ formatMoney(current, currency) }}
      </AppAnimatedNumber>
    </AppMetricTile>
    <AppMetricTile
      label="Net à recevoir"
      icon="ri-wallet-3-line"
      color="success"
      :hint="fees > 0 ? `${formatMoney(fees, currency)} de frais` : 'Aucun frais'"
    >
      {{ formatMoney(summary?.net_collected_fcfa, currency) }}
    </AppMetricTile>
    <AppMetricTile
      label="Transactions"
      icon="ri-exchange-funds-line"
      color="info"
      :hint="pendingCount ? `${pendingCount} en attente de confirmation` : 'Toutes confirmées'"
    >
      <AppAnimatedNumber
        v-slot="{ current }"
        :value="summary?.transactions ?? 0"
      >
        {{ current }}
      </AppAnimatedNumber>
    </AppMetricTile>
    <AppMetricTile
      label="Taux de réussite"
      icon="ri-percent-line"
      :color="rate === null || rate >= 80 ? 'warning' : 'error'"
      :gauge="rate ?? undefined"
      :gauge-label="rate === null ? undefined : `${rate} % des paiements terminés ont réussi`"
      :hint="rate === null ? 'Aucun paiement terminé' : 'Des paiements terminés'"
    >
      {{ rate === null ? '—' : `${rate} %` }}
    </AppMetricTile>
  </AppMetricGrid>
</template>

<style scoped>
.metric-skeleton {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
}
</style>
