<script setup lang="ts">
import type { DateRange } from '../ranges'
import { container } from '@/container'
import type { PaymentSummary } from '@/lib/api/types'
import { formatMoney } from '@/lib/format'
import { useLive } from '@/composables/useLive'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'

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

const items = computed<StatStripItem[]>(() => {
  const value = summary.value
  const fees = Number(value?.fees_fcfa ?? 0)

  return [
    { label: 'Encaissé', icon: 'ri-money-dollar-circle-line', value: formatMoney(value?.collected_fcfa, currency.value), hint: props.hint },
    {
      label: 'Net à recevoir',
      icon: 'ri-wallet-3-line',
      value: formatMoney(value?.net_collected_fcfa, currency.value),
      hint: fees > 0 ? `${formatMoney(fees, currency.value)} de frais` : 'Aucun frais',
      hintColor: fees > 0 ? 'warning' : 'success',
    },
    {
      label: 'Transactions',
      icon: 'ri-exchange-funds-line',
      value: String(value?.transactions ?? 0),
      hint: `${successCount.value} réussie${successCount.value > 1 ? 's' : ''}`,
      hintColor: 'success',
    },
    { label: 'Taux de réussite', icon: 'ri-percent-line', value: successRate.value },
  ]
})

defineExpose({ reload: () => load(true) })
</script>

<template>
  <AppErrorState
    v-if="error"
    :error="error"
    @retry="load"
  />

  <AppStatStrip
    v-else
    :items="items"
    :loading="loading"
  />
</template>
