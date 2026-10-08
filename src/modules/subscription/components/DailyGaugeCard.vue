<script setup lang="ts">
import { gaugeColor } from '../labels'
import { formatMoney } from '@/lib/format'

const props = defineProps<{

  /** Plafond du jour ; `null` si on ne le connaît pas. */
  limit: number | null
  used: number
  remaining: number | null
  percent: number

  /** Un solde est-il ouvert pour aujourd'hui ? */
  open: boolean
}>()

const color = computed(() => gaugeColor(props.percent))
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Solde du jour</VCardTitle>
      <VCardSubtitle>Ce qu'il reste à consommer aujourd'hui</VCardSubtitle>
    </VCardItem>

    <VCardText class="d-flex flex-column align-center text-center">
      <template v-if="open && limit !== null">
        <VProgressCircular
          :model-value="percent"
          :color="color"
          size="164"
          width="14"
          :aria-label="`${percent} % du plafond du jour consommé`"
        >
          <div>
            <div class="text-h4 font-weight-semibold tabular-nums">
              {{ percent }} %
            </div>
            <div class="text-body-2 text-medium-emphasis">
              consommé
            </div>
          </div>
        </VProgressCircular>

        <div class="text-h5 font-weight-semibold tabular-nums mt-5">
          {{ formatMoney(remaining) }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          disponibles sur {{ formatMoney(limit) }}
        </div>
        <VChip
          class="mt-3"
          :color="color"
          variant="tonal"
          size="small"
          label
        >
          {{ formatMoney(used) }} déjà consommés
        </VChip>
      </template>

      <AppEmptyState
        v-else
        icon="ri-wallet-3-line"
        title="Aucun solde ouvert aujourd'hui"
        :text="limit !== null
          ? `Le plafond de ${formatMoney(limit)} s'ouvre à la prochaine réinitialisation quotidienne.`
          : 'Le solde de la journée s\'ouvre à la prochaine réinitialisation quotidienne.'"
      />
    </VCardText>
  </VCard>
</template>
