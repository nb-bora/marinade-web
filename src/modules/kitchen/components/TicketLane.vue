<script setup lang="ts">
import type { LaneInfo } from '../labels'
import type { Ticket } from '../types'
import TicketCard from './TicketCard.vue'

defineProps<{
  lane: LaneInfo
  tickets: Ticket[]

  /** Plats servis encore rappelables : affichés sous la colonne « Prêt à servir ». */
  recallable?: Ticket[]
  now: number
  fresh: Set<string>
  busy: Set<string>
}>()

const emit = defineEmits<{
  advance: [ticket: Ticket]
  recall: [ticket: Ticket]
  togglePriority: [ticket: Ticket]
}>()

const list = ref<HTMLElement>()

/** Flèches haut et bas : passe d'un ticket à l'autre dans la colonne (Entrée lance l'action). */
function focusNeighbour(event: KeyboardEvent, step: number) {
  const card = (event.target as HTMLElement | null)?.closest<HTMLElement>('.ticket')

  if (!card || !list.value)
    return

  const cards = [...list.value.querySelectorAll<HTMLElement>('.ticket')]
  const next = cards[cards.indexOf(card) + step]

  if (next) {
    event.preventDefault()
    next.focus()
  }
}
</script>

<template>
  <section
    class="lane"
    :aria-labelledby="`lane-title-${lane.value}`"
  >
    <header class="lane__head">
      <span
        class="lane__icon"
        :class="`lane__icon--${lane.tone}`"
        aria-hidden="true"
      >
        <VIcon
          :icon="lane.icon"
          size="22"
        />
      </span>
      <div class="min-w-0 lane__heading">
        <h2
          :id="`lane-title-${lane.value}`"
          class="lane__title"
        >
          {{ lane.title }}
        </h2>
        <p class="lane__subtitle">
          {{ lane.subtitle }}
        </p>
      </div>
      <span
        class="lane__count tabular-nums"
        :aria-label="`${tickets.length} ticket${tickets.length > 1 ? 's' : ''}`"
      >
        {{ tickets.length }}
      </span>
    </header>

    <div
      ref="list"
      class="lane__list"
      @keydown.down="focusNeighbour($event, 1)"
      @keydown.up="focusNeighbour($event, -1)"
    >
      <TransitionGroup
        tag="div"
        name="ticket"
        class="lane__stack"
      >
        <TicketCard
          v-for="ticket in tickets"
          :key="ticket.id"
          :ticket="ticket"
          :now="now"
          :fresh="fresh.has(ticket.id)"
          :busy="busy.has(ticket.id)"
          @advance="emit('advance', ticket)"
          @recall="emit('recall', ticket)"
          @toggle-priority="emit('togglePriority', ticket)"
        />
      </TransitionGroup>

      <p
        v-if="!tickets.length && !recallable?.length"
        class="lane__empty"
      >
        {{ lane.empty }}
      </p>

      <section
        v-if="recallable?.length"
        class="lane__recall"
        aria-label="Plats servis, rappel possible pendant 2 minutes"
      >
        <h3 class="lane__recall-title">
          Servis à l'instant · rappel possible 2 minutes
        </h3>
        <TicketCard
          v-for="ticket in recallable"
          :key="ticket.id"
          :ticket="ticket"
          :now="now"
          :busy="busy.has(ticket.id)"
          @recall="emit('recall', ticket)"
        />
      </section>
    </div>
  </section>
</template>

<style scoped>
.lane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-inline-size: 0;
  padding: 1rem;
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  background: rgba(var(--v-theme-on-surface), 0.025);
}

.lane__head {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.lane__icon {
  align-items: center;
  border-radius: 12px;
  display: inline-flex;
  flex-shrink: 0;
  block-size: 40px;
  inline-size: 40px;
  justify-content: center;
}

.lane__icon--info {
  background: rgba(var(--v-theme-info), 0.14);
  color: rgb(var(--v-theme-info));
}

.lane__icon--warning {
  background: rgba(var(--v-theme-warning), 0.16);
  color: rgb(var(--v-theme-warning));
}

.lane__icon--success {
  background: rgba(var(--v-theme-success), 0.14);
  color: rgb(var(--v-theme-success));
}

.lane__heading {
  flex: 1 1 auto;
}

.lane__title {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.5rem;
}

.lane__subtitle {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  margin: 0;
}

.lane__count {
  align-items: center;
  background: rgba(var(--v-theme-on-surface), 0.07);
  border-radius: 999px;
  display: inline-flex;
  font-size: 1rem;
  font-weight: 700;
  justify-content: center;
  min-inline-size: 2.25rem;
  padding-block: 0.125rem;
  padding-inline: 0.5rem;
}

.lane__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.lane__stack {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.lane__empty {
  border: 2px dashed rgba(var(--v-border-color), 0.2);
  border-radius: 12px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 1rem;
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
}

.lane__recall {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-block-start: 0.5rem;
  padding-block-start: 1rem;
  border-block-start: 1px dashed rgba(var(--v-border-color), 0.25);
}

.lane__recall-title {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
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
