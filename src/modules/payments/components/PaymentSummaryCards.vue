<script setup lang="ts">
import type { DateRange } from '../ranges'
import { container } from '@/container'
import type { PaymentSummary } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { useLive } from '@/composables/useLive'

const props = withDefaults(defineProps<{
  range: DateRange
  hint?: string
  live?: boolean
}>(), { live: true })

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

watch(() => [props.range.from?.getTime(), props.range.to?.getTime()], () => load(), { immediate: true })

if (props.live)
  useLive(() => load(true))

onScopeDispose(() => controller?.abort())

const successCount = computed(() => summary.value?.by_status.success?.count ?? 0)

const successRate = computed(() => {
  const total = summary.value?.transactions ?? 0

  return total === 0 ? '—' : `${Math.round((successCount.value / total) * 100)} %`
})

const currency = computed(() => summary.value?.currency ?? 'XAF')

defineExpose({ reload: () => load(true) })
</script>

<template>
  <AppErrorState
    v-if="error"
    :error="error"
    @retry="load"
  />

  <VRow v-else>
    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <AppKpiCard
        label="Encaissé"
        icon="ri-money-dollar-circle-line"
        color="success"
        :loading="loading"
        :value="formatMoney(summary?.collected_fcfa, currency)"
        :hint="hint"
      />
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <AppKpiCard
        label="Net à recevoir"
        icon="ri-wallet-3-line"
        color="primary"
        :loading="loading"
        :value="formatMoney(summary?.net_collected_fcfa, currency)"
        :hint="summary && Number(summary.fees_fcfa) > 0 ? `dont ${formatMoney(summary.fees_fcfa, currency)} de frais` : 'Frais déduits'"
      />
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <AppKpiCard
        label="Transactions"
        icon="ri-exchange-funds-line"
        color="info"
        :loading="loading"
        :value="String(summary?.transactions ?? 0)"
        :hint="`${successCount} réussie${successCount > 1 ? 's' : ''}`"
      />
    </VCol>

    <VCol
      cols="12"
      sm="6"
      lg="3"
    >
      <AppKpiCard
        label="Taux de réussite"
        icon="ri-percent-line"
        :color="successRate === '—' ? 'secondary' : 'warning'"
        :loading="loading"
        :value="successRate"
      />
    </VCol>
  </VRow>
</template>
