<script setup lang="ts">
import type { LaneInfo } from '../labels'
import type { Ticket } from '../types'
import TicketCard from './TicketCard.vue'

defineProps<{
  lane: LaneInfo
  tickets: Ticket[]
  now: number
  fresh: Set<string>
  busy: Set<string>
}>()

defineEmits<{ advance: [ticket: Ticket] }>()
</script>

<template>
  <section
    class="lane"
    :aria-label="lane.title"
  >
    <header class="lane__head">
      <VAvatar
        :color="lane.color"
        variant="tonal"
        rounded
        size="40"
      >
        <VIcon
          :icon="lane.icon"
          size="24"
        />
      </VAvatar>
      <h2 class="lane__title">
        {{ lane.title }}
      </h2>
      <VChip
        :color="lane.color"
        label
        class="lane__count"
      >
        {{ tickets.length }}
      </VChip>
    </header>

    <TransitionGroup
      v-if="tickets.length"
      tag="div"
      name="ticket"
      class="lane__list"
    >
      <TicketCard
        v-for="ticket in tickets"
        :key="ticket.id"
        :ticket="ticket"
        :lane="lane"
        :now="now"
        :fresh="fresh.has(ticket.id)"
        :busy="busy.has(ticket.id)"
        @advance="$emit('advance', ticket)"
      />
    </TransitionGroup>

    <p
      v-else
      class="lane__empty"
    >
      {{ lane.empty }}
    </p>
  </section>
</template>

<style scoped>
.lane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-inline-size: 0;
  padding: 0.875rem;
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.lane__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lane__title {
  flex: 1 1 auto;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.75rem;
}

.lane__count {
  font-size: 1.125rem;
  font-weight: 700;
}

.lane__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lane__empty {
  margin: 0;
  padding: 2rem 1rem;
  border: 2px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 1.0625rem;
  text-align: center;
}

.ticket-enter-active,
.ticket-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.ticket-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.ticket-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .ticket-enter-active,
  .ticket-leave-active {
    transition: none;
  }
}
</style>
