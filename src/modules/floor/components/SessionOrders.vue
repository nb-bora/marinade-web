<!-- Commandes déjà envoyées depuis cet appareil pour la session. -->
<script setup lang="ts">
import { ORDER_STATUS, STATION_LABEL, present } from '../labels'
import type { SentOrder } from '../types'
import { formatTime } from '@/lib/format'

defineProps<{ orders: SentOrder[] }>()
</script>

<template>
  <VCard>
    <VCardItem class="pb-2">
      <VCardTitle>Commandes envoyées</VCardTitle>
      <VCardSubtitle>Depuis cet appareil</VCardSubtitle>
    </VCardItem>

    <AppEmptyState
      v-if="!orders.length"
      icon="ri-list-check-2"
      title="Rien d'envoyé ici"
      text="Les commandes passées depuis cet appareil s'affichent ici. L'addition ci-dessus compte toutes celles de la table."
    />

    <ul
      v-else
      class="orders"
    >
      <li
        v-for="order in orders"
        :key="order.id"
        class="order"
      >
        <div class="d-flex align-center justify-space-between gap-2 mb-2">
          <span class="text-body-1 font-weight-medium">Envoyée à {{ formatTime(order.sentAt) }}</span>
          <AppStatusChip v-bind="present(ORDER_STATUS, order.status)" />
        </div>
        <div
          v-for="(line, index) in order.lines"
          :key="index"
          class="d-flex gap-2 py-1"
        >
          <span class="font-weight-semibold tabular-nums">{{ line.quantity }} ×</span>
          <div class="min-w-0 flex-grow-1">
            <span class="text-wrap order__name">{{ line.name }}</span>
            <span class="text-body-2 text-medium-emphasis"> · {{ STATION_LABEL[line.station] }}</span>
            <div
              v-if="line.notes"
              class="text-body-2 text-medium-emphasis font-italic"
            >
              {{ line.notes }}
            </div>
          </div>
        </div>
        <div class="d-flex justify-space-between mt-2 text-body-2 text-medium-emphasis">
          <span>Total taxes comprises</span>
          <AppMoney :amount="order.total" />
        </div>
      </li>
    </ul>
  </VCard>
</template>

<style scoped>
.orders {
  margin: 0;
  padding: 0;
  list-style: none;
}

.order {
  padding: 12px 16px;
}

.order + .order,
.orders {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.order__name {
  overflow-wrap: anywhere;
}
</style>
