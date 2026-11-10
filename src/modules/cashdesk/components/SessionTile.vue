<!--
  Une session à encaisser : table, ancienneté (qui vire à l'orange puis au rouge quand le client
  attend), reste dû, part déjà réglée. Toute la tuile ouvre l'encaissement.
-->
<script setup lang="ts">
import { SESSION_STATUS, present } from '../labels'
import type { CashSession } from '../types'
import { formatMoney, formatRelative } from '@/lib/format'

const props = defineProps<{
  row: CashSession
  now: Date
}>()

const emit = defineEmits<{ select: [] }>()

/** Au-delà de ces durées, l'addition attend depuis trop longtemps : on le signale. */
const WARN_MINUTES = 45
const LATE_MINUTES = 90

const name = computed(() => {
  if (props.row.table)
    return `Table ${props.row.table.numero}`

  return props.row.session.table_context || 'Sans table'
})

// Le contexte de la session dit déjà « 4 couverts · Terrasse » ; sans lui, l'emplacement de la table.
const detail = computed(() => props.row.table
  ? props.row.session.table_context || props.row.table.emplacement || ''
  : '')

const minutes = computed(() => Math.max(0, Math.floor((props.now.getTime() - new Date(props.row.session.opened_at).getTime()) / 60_000)))
const waiting = computed(() => minutes.value >= LATE_MINUTES ? 'late' : minutes.value >= WARN_MINUTES ? 'warn' : 'ok')

const total = computed(() => Number(props.row.invoice?.total_amount ?? 0))
const paid = computed(() => Number(props.row.invoice?.amount_paid ?? 0))

// Part déjà réglée de l'addition : une barre n'apparaît que s'il y a eu un paiement partiel.
const paidShare = computed(() => total.value > 0 ? Math.min(Math.round(paid.value / total.value * 100), 100) : 0)
const partlyPaid = computed(() => paid.value > 0)

function open(event: KeyboardEvent) {
  // Espace défile la page : on l'intercepte comme Entrée, comme le ferait un vrai bouton.
  event.preventDefault()
  emit('select')
}
</script>

<template>
  <article
    class="session-tile"
    :class="`session-tile--${waiting}`"
    tabindex="0"
    role="link"
    :aria-label="`Encaisser ${name}, reste dû ${formatMoney(row.invoice?.amount_due)}`"
    @click="emit('select')"
    @keydown.enter="open"
    @keydown.space="open"
  >
    <div class="d-flex align-center gap-3">
      <span class="session-tile__badge">
        <VIcon
          icon="ri-restaurant-2-line"
          size="24"
        />
      </span>
      <div class="min-w-0">
        <h3 class="text-h6 font-weight-bold text-truncate">
          {{ name }}
        </h3>
        <div class="text-body-2 text-medium-emphasis text-truncate">
          {{ detail || 'Table à encaisser' }}
        </div>
      </div>
      <VSpacer />
      <AppStatusChip v-bind="present(SESSION_STATUS, row.session.status)" />
    </div>

    <div class="session-tile__wait text-caption">
      <VIcon
        :icon="waiting === 'ok' ? 'ri-time-line' : 'ri-alarm-warning-line'"
        size="14"
      />
      Ouverte {{ formatRelative(row.session.opened_at, now) }}
      <template v-if="waiting !== 'ok'">
        · le client attend
      </template>
    </div>

    <div class="d-flex justify-space-between align-end gap-3 mt-auto">
      <div class="min-w-0">
        <div class="text-body-2 text-medium-emphasis">
          Reste dû
        </div>
        <div class="session-tile__due tabular-nums text-no-wrap">
          <AppMoney :amount="row.invoice?.amount_due" />
        </div>
      </div>
      <span class="session-tile__cta">
        Encaisser
        <VIcon
          icon="ri-arrow-right-line"
          size="18"
        />
      </span>
    </div>

    <div class="session-tile__summary text-body-2 text-medium-emphasis">
      <span>Total <strong class="tabular-nums"><AppMoney :amount="row.invoice?.total_amount" /></strong></span>
      <span v-if="partlyPaid">Déjà payé <strong class="tabular-nums text-success"><AppMoney :amount="row.invoice?.amount_paid" /></strong></span>
    </div>
    <VProgressLinear
      v-if="partlyPaid"
      :model-value="paidShare"
      color="success"
      bg-color="secondary"
      bg-opacity="0.2"
      height="6"
      rounded
      :aria-label="`${paidShare} % déjà réglé`"
    />
  </article>
</template>

<style scoped>
.session-tile {
  --accent: var(--v-theme-primary);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  block-size: 100%;
  padding: 18px 20px 18px 24px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

/* Liseré d'ancienneté : orange de la marque tant que tout va bien, puis alerte. */
.session-tile::before {
  position: absolute;
  content: "";
  inset-block: 0;
  inset-inline-start: 0;
  inline-size: 6px;
  background: rgb(var(--accent));
}

.session-tile--warn {
  --accent: var(--v-theme-warning);
}

.session-tile--late {
  --accent: var(--v-theme-error);
}

.session-tile:hover,
.session-tile:focus-visible {
  border-color: rgba(var(--accent), 0.5);
  box-shadow: 0 12px 28px -14px rgba(var(--accent), 0.55);
  transform: translateY(-2px);
}

.session-tile:focus-visible {
  outline: 2px solid rgb(var(--accent));
  outline-offset: 2px;
}

.session-tile__badge {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 48px;
  block-size: 48px;
  border-radius: 14px;
  background: rgba(var(--accent), 0.12);
  color: rgb(var(--accent));
}

.session-tile__wait {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-weight: 500;
}

.session-tile--warn .session-tile__wait,
.session-tile--late .session-tile__wait {
  background: rgba(var(--accent), 0.14);
  color: rgb(var(--accent));
  font-weight: 600;
}

.session-tile__due {
  color: rgb(var(--v-theme-primary));
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.15;
}

.session-tile__cta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), #b8470a);
  color: #fff;
  font-weight: 600;
  transition: transform 0.2s ease;
}

.session-tile:hover .session-tile__cta {
  transform: translateX(2px);
}

.session-tile__summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
  padding-block-start: 10px;
  border-block-start: 1px solid rgba(var(--v-border-color), 0.3);
}

.session-tile__summary strong {
  color: rgb(var(--v-theme-on-surface));
}

@media (max-width: 599px) {
  .session-tile__due {
    font-size: 1.65rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-tile,
  .session-tile__cta {
    transition: none;
  }

  .session-tile:hover,
  .session-tile:focus-visible,
  .session-tile:hover .session-tile__cta {
    transform: none;
  }
}
</style>
