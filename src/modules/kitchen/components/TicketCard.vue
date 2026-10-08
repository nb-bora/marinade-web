<script setup lang="ts">
import { formatElapsed, linesOf, orderNumber, ticketTime, urgencyOf } from '../labels'
import type { LaneInfo } from '../labels'
import type { Ticket } from '../types'

const props = defineProps<{
  ticket: Ticket
  lane: LaneInfo

  /** Heure courante en millisecondes : un seul minuteur pour tous les tickets. */
  now: number
  fresh?: boolean
  busy?: boolean
}>()

defineEmits<{ advance: [] }>()

const lines = computed(() => linesOf(props.ticket))
const elapsed = computed(() => Math.max(0, props.now - ticketTime(props.ticket.created_at)))

// Une fois le plat prêt, l'attente n'est plus un souci : le minuteur redevient neutre.
const urgency = computed(() => (props.lane.value === 'READY' ? 'normal' : urgencyOf(elapsed.value)))
const hasNotes = computed(() => lines.value.some(line => line.notes))
</script>

<template>
  <article
    class="ticket"
    :class="[`ticket--${urgency}`, { 'ticket--fresh': fresh }]"
    :aria-label="`Commande ${orderNumber(ticket)}`"
  >
    <header class="ticket__head">
      <div class="min-w-0">
        <div class="ticket__number">
          Commande n° {{ orderNumber(ticket) }}
        </div>
        <VChip
          v-if="fresh"
          color="primary"
          size="small"
          label
          class="mt-1 font-weight-semibold"
        >
          Nouveau
        </VChip>
      </div>

      <div
        class="ticket__timer"
        :class="`ticket__timer--${urgency}`"
        :aria-label="`En attente depuis ${formatElapsed(elapsed)}`"
      >
        <VIcon
          icon="ri-timer-line"
          size="22"
        />
        <span>{{ formatElapsed(elapsed) }}</span>
      </div>
    </header>

    <ul class="ticket__lines">
      <li
        v-for="(line, index) in lines"
        :key="index"
        class="ticket__line"
      >
        <span class="ticket__qty">{{ line.quantity }}×</span>
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
              size="20"
            />
            <span>{{ line.notes }}</span>
          </div>
        </div>
      </li>
    </ul>

    <VBtn
      block
      size="x-large"
      class="ticket__action"
      :color="lane.color"
      :prepend-icon="lane.action.icon"
      :loading="busy"
      :aria-label="`${lane.action.label} : commande ${orderNumber(ticket)}${hasNotes ? ' (avec notes)' : ''}`"
      @click="$emit('advance')"
    >
      {{ lane.action.label }}
    </VBtn>
  </article>
</template>

<style scoped>
.ticket {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 1.125rem 1.125rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-inline-start: 6px solid rgb(var(--v-theme-secondary));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 8px rgba(var(--v-shadow-key-umbra-color), 0.12);
}

.ticket--warning {
  border-inline-start-color: rgb(var(--v-theme-warning));
}

.ticket--alert {
  border-inline-start-color: rgb(var(--v-theme-error));
}

.ticket--fresh {
  animation: arrival 8s ease-out;
  outline: 2px solid rgb(var(--v-theme-primary));
}

.ticket__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.ticket__number {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.75rem;
}

.ticket__timer {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 2rem;
}

.ticket__timer--warning {
  background: rgb(var(--v-theme-warning));
  color: rgb(var(--v-theme-on-warning));
}

.ticket__timer--alert {
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
}

.ticket__lines {
  display: grid;
  gap: 0.875rem;
  padding: 0;
  list-style: none;
}

.ticket__line {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.ticket__qty {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-inline-size: 3.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.16);
  color: rgb(var(--v-theme-primary));
  font-size: 1.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 2.5rem;
}

.ticket__name {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 2rem;
  overflow-wrap: anywhere;
}

.ticket__note {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin-block-start: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 8px;
  background: rgba(var(--v-theme-warning), 0.22);
  border-inline-start: 4px solid rgb(var(--v-theme-warning));
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.5rem;
  overflow-wrap: anywhere;
}

.ticket__action {
  min-block-size: 4rem;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0;
}

@keyframes arrival {
  from {
    background: rgba(var(--v-theme-primary), 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticket--fresh {
    animation: none;
  }
}
</style>
