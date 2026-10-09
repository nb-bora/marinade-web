<!-- Détail de la table choisie sur le plan : session, durée, montant et actions possibles. -->
<script setup lang="ts">
import type { PlanState } from '../labels'
import { PLAN_STATE, SESSION_STATUS, plural, present } from '../labels'
import { locationOf, serviceOf } from '../service'
import type { TableView } from '../types'
import { formatDateTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const props = defineProps<{
  view: TableView
  state: PlanState
  now: Date
}>()

defineEmits<{
  close: []
  openSession: []
  release: []
}>()

const tenant = useTenantStore()

const session = computed(() => props.view.session)
const look = computed(() => PLAN_STATE[props.state])

/** Session soldée mais pas clôturée : la table en garde l'identifiant. */
const settledSessionId = computed(() => props.state === 'settled' ? serviceOf(props.view.table).session_id ?? null : null)
const sessionLink = computed(() => session.value?.id ?? settledSessionId.value)

const canCashDesk = computed(() => tenant.can('cash_desk'))

/** « 25 min », « 1 h 05 » : depuis combien de temps la table est occupée. */
const duration = computed(() => {
  if (!session.value)
    return null

  const minutes = Math.max(0, Math.floor((props.now.getTime() - new Date(session.value.opened_at).getTime()) / 60_000))

  if (minutes < 60)
    return `${minutes} min`

  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
})

const sessionLook = computed(() => session.value ? present(SESSION_STATUS, session.value.status) : null)

const rows = computed(() => {
  const { view } = props

  if (!session.value)
    return []

  return [
    { label: 'Couverts', icon: 'ri-group-line', text: view.covers ? String(view.covers) : 'Non précisé' },
    { label: 'Durée', icon: 'ri-time-line', text: duration.value ?? '', hint: `Ouverte à ${formatDateTime(session.value.opened_at)}` },
  ]
})

const tone = computed(() => `rgb(var(--v-theme-${look.value.color}))`)
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
      <VCardSubtitle>{{ locationOf(view.table) }} · {{ plural(view.table.capacite, 'place') }}</VCardSubtitle>
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

      <template v-if="session">
        <dl class="table-panel__rows">
          <div
            v-for="row in rows"
            :key="row.label"
            class="table-panel__row"
            :title="row.hint"
          >
            <dt class="d-flex align-center gap-2 text-medium-emphasis">
              <VIcon
                :icon="row.icon"
                size="18"
              />{{ row.label }}
            </dt>
            <dd class="tabular-nums font-weight-medium">
              {{ row.text }}
            </dd>
          </div>
          <div class="table-panel__row">
            <dt class="d-flex align-center gap-2 text-medium-emphasis">
              <VIcon
                icon="ri-receipt-line"
                size="18"
              />Montant partiel
            </dt>
            <dd class="tabular-nums font-weight-medium">
              <AppMoney
                v-if="view.total !== null"
                :amount="view.total"
              />
              <span
                v-else
                class="text-medium-emphasis"
              >Aucune commande</span>
            </dd>
          </div>
          <div
            v-if="view.amountDue !== null && view.amountDue !== view.total"
            class="table-panel__row"
          >
            <dt class="d-flex align-center gap-2 text-medium-emphasis">
              <VIcon
                icon="ri-hand-coin-line"
                size="18"
              />Reste à payer
            </dt>
            <dd class="tabular-nums font-weight-bold">
              <AppMoney :amount="view.amountDue" />
            </dd>
          </div>
        </dl>

        <p
          v-if="state === 'paying'"
          class="text-body-2 text-medium-emphasis mt-4 mb-0"
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

<style scoped>
.table-panel {
  border-block-start: 4px solid var(--tone);
}

.table-panel__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 52px;
  max-inline-size: 96px;
  block-size: 52px;
  padding-inline: 8px;
  border-radius: 8px;
  background: var(--tone);
  color: #fff;
  font-size: 1.25rem;
  font-weight: 700;
  margin-inline-end: 12px;
  overflow: hidden;
}

.table-panel__rows {
  display: grid;
  margin: 0;
  gap: 2px;
}

.table-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-block: 10px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.table-panel__row:last-child {
  border-block-end: none;
}

.table-panel__row dd {
  margin: 0;
  text-align: end;
}
</style>
