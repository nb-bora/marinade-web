<!--
  Détail de la table choisie sur le plan : état, places (assises et libres), durée avec son niveau
  d'attention, addition et avancement du paiement, puis les actions possibles.
-->
<script setup lang="ts">
import { elapsedTone, formatElapsed, minutesSince } from '../composables/useFloorMetrics'
import type { PlanState } from '../labels'
import { PLAN_STATE, SESSION_STATUS, plural, present } from '../labels'
import { freeSeats } from '../layout'
import { locationOf, serviceOf } from '../service'
import type { TableView } from '../types'
import SeatRow from './SeatRow.vue'
import { formatDateTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const props = defineProps<{
  view: TableView
  state: PlanState
  now: Date

  /** Nom du niveau, affiché seulement quand le restaurant en a plusieurs. */
  levelName?: string
}>()

defineEmits<{
  close: []
  openSession: []
  release: []
  editCovers: []
}>()

const tenant = useTenantStore()

const session = computed(() => props.view.session)
const look = computed(() => PLAN_STATE[props.state])
const tone = computed(() => `rgb(var(--v-theme-${look.value.color}))`)

/** Session soldée mais pas clôturée : la table en garde l'identifiant. */
const settledSessionId = computed(() => props.state === 'settled' ? serviceOf(props.view.table).session_id ?? null : null)
const sessionLink = computed(() => session.value?.id ?? settledSessionId.value)

const canCashDesk = computed(() => tenant.can('cash_desk'))
const sessionLook = computed(() => session.value ? present(SESSION_STATUS, session.value.status) : null)

// Places ------------------------------------------------------------------------------------

const capacity = computed(() => props.view.table.capacite)
const covers = computed(() => session.value ? props.view.covers : null)
const free = computed(() => freeSeats(props.view))

const seatSentence = computed(() => {
  if (!session.value)
    return plural(capacity.value, 'place')

  if (covers.value === null)
    return `${plural(capacity.value, 'place')} · couverts non précisés`

  if (covers.value > capacity.value)
    return `${plural(covers.value, 'couvert')} pour ${plural(capacity.value, 'place')} : table dépassée`

  return free.value === 0
    ? `${plural(covers.value, 'couvert')} · table complète`
    : `${plural(covers.value, 'couvert')} · ${plural(free.value, 'place libre', 'places libres')}`
})

// Durée ---------------------------------------------------------------------------------------

const minutes = computed(() => session.value ? minutesSince(session.value.opened_at, props.now) : null)
const durationTone = computed(() => minutes.value === null ? 'ok' : elapsedTone(minutes.value))

/** La barre se remplit jusqu'à 2 h : au-delà la table est « trop longue ». */
const durationPercent = computed(() => minutes.value === null ? 0 : Math.min(100, Math.round(100 * minutes.value / 120)))

const DURATION_COLOR = { ok: 'success', warn: 'warning', late: 'error' } as const
const DURATION_HINT = { ok: 'Dans les temps', warn: 'À surveiller', late: 'Occupée depuis longtemps' } as const

// Addition ------------------------------------------------------------------------------------

const total = computed(() => props.view.total)
const due = computed(() => props.view.amountDue)
const paid = computed(() => total.value !== null && due.value !== null ? Math.max(0, total.value - due.value) : 0)
const paidPercent = computed(() => total.value ? Math.min(100, Math.round(100 * paid.value / total.value)) : 0)
</script>

<template>
  <VCard
    class="table-panel"
    :style="{ '--tone': tone }"
  >
    <VCardItem>
      <template #prepend>
        <span class="table-panel__badge">{{ view.table.numero }}</span>
      </template>
      <VCardTitle>Table {{ view.table.numero }}</VCardTitle>
      <VCardSubtitle class="text-wrap">
        {{ locationOf(view.table) }}<template v-if="levelName">
          · {{ levelName }}
        </template>
      </VCardSubtitle>
      <template #append>
        <VBtn
          icon="ri-close-line"
          variant="text"
          size="small"
          aria-label="Fermer le détail de la table"
          @click="$emit('close')"
        />
      </template>
    </VCardItem>

    <VCardText class="pt-0">
      <div class="d-flex flex-wrap align-center gap-2 mb-4">
        <VChip
          :color="look.color"
          variant="tonal"
          size="small"
          label
        >
          {{ look.label }}
        </VChip>
        <AppStatusChip
          v-if="sessionLook"
          v-bind="sessionLook"
        />
      </div>

      <!-- Places : une pastille par chaise, pleine si prise, vide si libre -->
      <section
        class="block"
        aria-label="Places de la table"
      >
        <div class="block__head">
          <span class="block__title">Places</span>
          <span
            v-if="session && covers !== null"
            class="block__value tabular-nums"
          ><strong>{{ free }}</strong> libre{{ free > 1 ? 's' : '' }} sur {{ capacity }}</span>
          <span
            v-else
            class="block__value tabular-nums"
          ><strong>{{ capacity }}</strong> place{{ capacity > 1 ? 's' : '' }}</span>
        </div>
        <SeatRow
          role="img"
          :aria-label="seatSentence"
          :capacity="capacity"
          :taken="covers"
          :color="tone"
          :max="20"
        />
        <div class="d-flex align-center justify-space-between gap-2 mt-2">
          <p
            class="text-body-2 text-medium-emphasis mb-0"
            :class="{ 'text-success': session && covers !== null && free > 0 }"
          >
            {{ seatSentence }}
          </p>
          <VBtn
            v-if="session"
            size="x-small"
            variant="tonal"
            prepend-icon="ri-user-add-line"
            @click="$emit('editCovers')"
          >
            Couverts
          </VBtn>
        </div>
      </section>

      <template v-if="session">
        <!-- Durée -->
        <section class="block">
          <div class="block__head">
            <span class="block__title">Durée</span>
            <span
              class="block__value tabular-nums"
              :title="`Ouverte à ${formatDateTime(session.opened_at)}`"
            ><strong>{{ formatElapsed(minutes ?? 0) }}</strong></span>
          </div>
          <VProgressLinear
            :model-value="durationPercent"
            :color="DURATION_COLOR[durationTone]"
            height="6"
            rounded
            bg-opacity="0.16"
          />
          <p class="text-caption text-medium-emphasis mt-1 mb-0">
            {{ DURATION_HINT[durationTone] }} · ouverte à {{ formatDateTime(session.opened_at) }}
          </p>
        </section>

        <!-- Addition -->
        <section class="block">
          <div class="block__head">
            <span class="block__title">Addition</span>
            <span class="block__value tabular-nums">
              <AppMoney
                v-if="total !== null"
                :amount="total"
              />
              <span
                v-else
                class="text-medium-emphasis"
              >Aucune commande</span>
            </span>
          </div>
          <template v-if="total !== null && due !== null">
            <VProgressLinear
              :model-value="paidPercent"
              color="success"
              height="6"
              rounded
              bg-opacity="0.16"
            />
            <div class="d-flex justify-space-between text-caption mt-1">
              <span class="text-medium-emphasis">Réglé : <AppMoney :amount="paid" /></span>
              <span :class="due > 0 ? 'font-weight-bold' : 'text-success'">
                <template v-if="due > 0">Reste : <AppMoney :amount="due" /></template>
                <template v-else>Soldée</template>
              </span>
            </div>
          </template>
        </section>

        <p
          v-if="state === 'paying'"
          class="text-body-2 text-medium-emphasis mb-0"
        >
          Le client a demandé l'addition : elle se règle à la caisse.
        </p>
      </template>

      <p
        v-else
        class="text-body-1 text-medium-emphasis mb-0"
      >
        <template v-if="state === 'free'">
          Cette table est libre. Ouvrez une session pour accueillir des clients et prendre leur commande.
        </template>
        <template v-else-if="state === 'reserved'">
          Cette table est réservée. Ouvrez la session à l'arrivée des clients.
        </template>
        <template v-else-if="state === 'settled'">
          L'addition est réglée. Libérez la table pour qu'elle redevienne disponible.
        </template>
        <template v-else>
          Cette table est hors service : elle n'est pas proposée aux clients.
        </template>
      </p>
    </VCardText>

    <VCardActions class="flex-column align-stretch gap-2 px-4 pb-4">
      <template v-if="session">
        <VBtn
          v-if="state === 'paying' && canCashDesk"
          color="error"
          variant="flat"
          size="large"
          block
          prepend-icon="ri-bank-card-line"
          :to="`/caisse/sessions/${session.id}`"
        >
          Aller à la caisse
        </VBtn>
        <VBtn
          :color="state === 'paying' ? undefined : 'primary'"
          :variant="state === 'paying' ? 'tonal' : 'flat'"
          size="large"
          block
          prepend-icon="ri-restaurant-2-line"
          :to="`/salle/sessions/${session.id}`"
        >
          Commandes et articles
        </VBtn>
        <VBtn
          v-if="state !== 'paying' && canCashDesk"
          variant="outlined"
          size="large"
          block
          prepend-icon="ri-bank-card-line"
          :to="`/caisse/sessions/${session.id}`"
        >
          Aller à la caisse
        </VBtn>
      </template>

      <template v-else>
        <VBtn
          v-if="state === 'free' || state === 'reserved'"
          color="primary"
          size="large"
          block
          prepend-icon="ri-door-open-line"
          @click="$emit('openSession')"
        >
          Ouvrir une session
        </VBtn>
        <VBtn
          v-if="settledSessionId && sessionLink"
          variant="tonal"
          size="large"
          block
          prepend-icon="ri-file-list-3-line"
          :to="`/salle/sessions/${sessionLink}`"
        >
          Voir la session
        </VBtn>
        <VBtn
          v-if="state === 'settled' || state === 'maintenance'"
          :color="state === 'settled' ? 'primary' : undefined"
          :variant="state === 'settled' ? 'flat' : 'tonal'"
          size="large"
          block
          :prepend-icon="state === 'settled' ? 'ri-checkbox-circle-line' : 'ri-tools-line'"
          @click="$emit('release')"
        >
          {{ state === 'settled' ? 'Libérer la table' : 'Remettre en service' }}
        </VBtn>
      </template>
    </VCardActions>
  </VCard>
</template>

<style scoped lang="scss">
.table-panel {
  border-block-start: 4px solid var(--tone);
}

.table-panel__badge {
  align-items: center;
  background: var(--tone);
  border-radius: 12px;
  color: #fff;
  display: inline-flex;
  font-size: 1.25rem;
  font-weight: 700;
  block-size: 52px;
  inline-size: auto;
  justify-content: center;
  margin-inline-end: 12px;
  max-inline-size: 96px;
  min-inline-size: 52px;
  overflow: hidden;
  padding-inline: 8px;
}

.block {
  border-block-start: 1px solid rgba(var(--v-border-color), 0.12);
  padding-block: 0.9rem;

  &:first-of-type {
    border-block-start: 0;
    padding-block-start: 0;
  }
}

.block__head {
  align-items: baseline;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  margin-block-end: 0.5rem;
}

.block__title {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.block__value {
  font-size: 0.95rem;
}
</style>
