<!-- Puce de l'état opérationnel d'une machine : icône, libellé et couleur de l'état. -->
<script setup lang="ts">
import { STATE_INFO } from '../labels'
import type { MachineState } from '../types'

withDefaults(defineProps<{
  state: MachineState
  size?: 'x-small' | 'small' | 'default'
}>(), { size: 'small' })
</script>

<template>
  <VChip
    :color="STATE_INFO[state].color"
    variant="tonal"
    :size="size"
    label
    class="font-weight-medium"
  >
    <VIcon
      :icon="STATE_INFO[state].icon"
      start
      size="14"
    />
    {{ STATE_INFO[state].label }}
  </VChip>
</template>
