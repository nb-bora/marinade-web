<script setup lang="ts">
import { formatElapsed, linesOf, nextAction, orderNumber, placeOf, recallRemainingMs, ticketTime, urgencyOf } from '../labels'
import type { Ticket } from '../types'

const props = defineProps<{
  ticket: Ticket

  /** Heure courante en millisecondes : un seul minuteur pour toutes les cartes. */
  now: number
  fresh?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  advance: []
  recall: []
  togglePriority: []
}>()

const lines = computed(() => linesOf(props.ticket))
const number = computed(() => orderNumber(props.ticket))
const place = computed(() => placeOf(props.ticket))
const action = computed(() => nextAction(props.ticket))

const isOpenTicket = computed(() => props.ticket.status === 'QUEUED' || props.ticket.status === 'IN_PREPARATION')
const isReady = computed(() => props.ticket.status === 'READY')
const isServed = computed(() => props.ticket.status === 'SERVED')

const elapsed = computed(() => Math.max(0, props.now - ticketTime(props.ticket.created_at)))

// Seul le travail à faire vire de couleur. Un plat prêt ou servi n'est plus une urgence.
const urgency = computed(() => (isOpenTicket.value ? urgencyOf(elapsed.value) : 'normal'))

const readySince = computed(() => (props.ticket.ready_at ? Math.max(0, props.now - ticketTime(props.ticket.ready_at)) : null))
const recallLeft = computed(() => recallRemainingMs(props.ticket, props.now))
const canRecall = computed(() => isServed.value && recallLeft.value > 0)
const urgent = computed(() => props.ticket.priority > 0)
const hasNotes = computed(() => lines.value.some(line => line.notes))

const summary = computed(() => {
  const count = lines.value.reduce((sum, line) => sum + line.quantity, 0)

  return `${place.value}, ${count} article${count > 1 ? 's' : ''}`
})

const timerText = computed(() => {
  if (isReady.value && readySince.value !== null)
    return `Prêt · ${formatElapsed(readySince.value)}`

  return formatElapsed(elapsed.value)
})

/** Entrée sur la carte elle-même (pas sur un bouton, qui a déjà son propre effet). */
function onEnter() {
  if (action.value && !props.busy)
    emit('advance')
}
</script>

<template>
  <article
    class="ticket"
    :class="[
      `ticket--${urgency}`,
      {
        'ticket--fresh': fresh,
        'ticket--urgent': urgent,
        'ticket--ready': isReady,
        'ticket--served': isServed,
      },
    ]"
    tabindex="0"
    role="group"
    :aria-label="`Commande ${number}, ${summary}${urgent ? ', urgente' : ''}`"
    @keydown.enter.self.prevent="onEnter"
  >
    <header class="ticket__head">
      <div class="min-w-0">
        <div class="ticket__number">
          Commande {{ number }}
        </div>
        <div class="ticket__place">
          <VIcon
            icon="ri-map-pin-line"
            size="18"
            aria-hidden="true"
          />
          <span>{{ place }}</span>
        </div>
        <div class="ticket__badges">
          <VChip
            v-if="urgent"
            color="error"
            size="small"
            label
            class="font-weight-semibold"
          >
            Urgent
          </VChip>
          <VChip
            v-if="fresh"
            color="primary"
            size="small"
            label
            class="font-weight-semibold"
          >
            Nouveau
          </VChip>
        </div>
      </div>

      <div
        v-if="!isServed"
        class="ticket__timer"
        :class="`ticket__timer--${urgency}`"
        :aria-label="timerText"
      >
        <VIcon
          icon="ri-timer-line"
          size="20"
          aria-hidden="true"
        />
        <span class="tabular-nums">{{ timerText }}</span>
      </div>
    </header>

    <ul class="ticket__lines">
      <li
        v-for="(line, index) in lines"
        :key="index"
        class="ticket__line"
      >
        <span class="ticket__qty tabular-nums">{{ line.quantity }}×</span>
        <div class="min-w-0">
          <div class="ticket__name">
            {{ line.name }}
          </div>
          <div
            v-if="line.notes"
            class="ticket__note"
          >
            <VIcon
              icon="ri-sticky-note-line"
              size="18"
              aria-hidden="true"
            />
            <span>{{ line.notes }}</span>
          </div>
        </div>
      </li>
    </ul>

    <footer class="ticket__actions">
      <VBtn
        v-if="isOpenTicket"
        class="ticket__urgent"
        variant="tonal"
        :color="urgent ? 'error' : 'secondary'"
        prepend-icon="ri-alarm-warning-line"
        :aria-pressed="urgent"
        :disabled="busy"
        :aria-label="`${urgent ? 'Retirer l\'urgence' : 'Marquer urgent'} : commande ${number}`"
        @click="emit('togglePriority')"
      >
        {{ urgent ? 'Retirer l\'urgence' : 'Marquer urgent' }}
      </VBtn>

      <VBtn
        v-if="action"
        class="ticket__action"
        size="x-large"
        :color="isOpenTicket && ticket.status === 'QUEUED' ? 'info' : isOpenTicket ? 'warning' : 'success'"
        :prepend-icon="action.icon"
        :loading="busy"
        :disabled="busy"
        :aria-label="`${action.label} : commande ${number}${hasNotes ? ', avec notes' : ''}`"
        @click="emit('advance')"
      >
        {{ action.label }}
      </VBtn>

      <VBtn
        v-if="canRecall"
        class="ticket__recall"
        size="large"
        variant="outlined"
        color="warning"
        prepend-icon="ri-arrow-go-back-line"
        :loading="busy"
        :disabled="busy"
        :aria-label="`Rappeler la commande ${number} : encore ${Math.ceil(recallLeft / 1000)} secondes`"
        @click="emit('recall')"
      >
        Rappeler
        <span class="ticket__countdown tabular-nums">{{ Math.ceil(recallLeft / 1000) }} s</span>
      </VBtn>
    </footer>
  </article>
</template>

<style scoped>
.ticket {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1rem 1.125rem 1.125rem;
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-inline-start: 6px solid rgb(var(--v-theme-info));
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}

.ticket:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.ticket--warning {
  border-inline-start-color: rgb(var(--v-theme-warning));
}

.ticket--alert {
  border-inline-start-color: rgb(var(--v-theme-error));
}

.ticket--ready {
  border-inline-start-color: rgb(var(--v-theme-success));
}

.ticket--served {
  border-inline-start-color: rgba(var(--v-theme-on-surface), 0.3);
  opacity: 0.85;
}

.ticket--urgent {
  box-shadow: 0 0 0 1px rgba(var(--v-theme-error), 0.35), 0 2px 8px rgba(var(--v-theme-error), 0.12);
}

.ticket--fresh {
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.ticket__head {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: space-between;
}

.ticket__number {
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.ticket__place {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  display: flex;
  font-size: 0.9375rem;
  gap: 0.25rem;
  margin-block-start: 0.125rem;
}

.ticket__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-block-start: 0.375rem;
}

.ticket__timer {
  align-items: center;
  border-radius: 10px;
  display: flex;
  flex-shrink: 0;
  font-size: 1.125rem;
  font-weight: 700;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  white-space: nowrap;
}

.ticket__timer--normal {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.ticket__timer--warning {
  background: rgba(var(--v-theme-warning), 0.16);
  color: rgb(var(--v-theme-warning));
}

.ticket__timer--alert {
  background: rgba(var(--v-theme-error), 0.14);
  color: rgb(var(--v-theme-error));
}

.ticket__lines {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.ticket__line {
  align-items: flex-start;
  display: flex;
  gap: 0.75rem;
}

.ticket__qty {
  flex-shrink: 0;
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.5rem;
  min-inline-size: 2.5rem;
}

.ticket__name {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5rem;
  overflow-wrap: anywhere;
}

/* Les notes sont la première chose à lire : fond ambré et icône, pas une simple ligne grise. */
.ticket__note {
  align-items: flex-start;
  background: rgba(var(--v-theme-warning), 0.14);
  border-radius: 8px;
  color: rgb(var(--v-theme-warning));
  display: flex;
  font-size: 0.9375rem;
  font-weight: 600;
  gap: 0.375rem;
  margin-block-start: 0.25rem;
  padding: 0.25rem 0.5rem;
  overflow-wrap: anywhere;
}

.ticket__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ticket__action {
  flex: 1 1 12rem;
  min-block-size: 56px;
}

.ticket__urgent,
.ticket__recall {
  min-block-size: 48px;
}

.ticket__countdown {
  font-weight: 500;
  margin-inline-start: 0.375rem;
  opacity: 0.8;
}
</style>
