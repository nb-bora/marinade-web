<script setup lang="ts">
import { formatMoney } from '@/lib/format'

defineProps<{
  amount: number | string | null | undefined
  currency?: string
}>()
</script>

<template>
  <span class="tabular-nums text-no-wrap">{{ formatMoney(amount, currency) }}</span>
</template>
