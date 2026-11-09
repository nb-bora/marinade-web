<!--
  Installer un groupe de la liste d'attente à une table. Seules les tables libres sont
  proposées ; une table trop petite se voit mais ne se choisit qu'à la gestion, après
  confirmation. Le serveur refait tous les contrôles : une table prise entre-temps est refusée.
-->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { isForcable, messageOf, tableLabel } from '../labels'
import type { Table, WaitlistEntry } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  entry: WaitlistEntry | null
  tables: Table[]
  canForce: boolean
}>()

const emit = defineEmits<{ seated: [entry: WaitlistEntry] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const askConfirm = useConfirm()
const selected = ref<string | null>(null)

type Availability = { state: 'free' } | { state: 'small' } | { state: 'busy'; reason: string }

function availabilityOf(table: Table): Availability {
  if (table.statut === 'libre')
    return table.capacite >= (props.entry?.party_size ?? 1) ? { state: 'free' } : { state: 'small' }

  const reason = table.statut === 'occupee' ? 'Occupée' : table.statut === 'reservee' ? 'Réservée' : 'Hors service'

  return { state: 'busy', reason }
}

const rows = computed(() => [...props.tables]
  .sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
  .map(table => ({ table, availability: availabilityOf(table) })))

const freeCount = computed(() => rows.value.filter(row => row.availability.state === 'free').length)

const chosen = computed(() => rows.value.find(row => row.table.id === selected.value) ?? null)
const needsForce = computed(() => chosen.value?.availability.state === 'small')

const { submit, pending, apiError, reset } = useSubmit(async (force: boolean) => {
  if (!props.entry || !selected.value)
    return

  const saved = await reservationsApi.seat(props.entry.id, selected.value, force)

  toast.success(`${saved.customer_name} installé.`)
  open.value = false
  emit('seated', saved)
})

const errorMessage = computed(() => (apiError.value ? messageOf(apiError.value) : ''))
const offerForce = computed(() => props.canForce && apiError.value !== null && isForcable(errorMessage.value))

async function onSubmit() {
  if (needsForce.value) {
    const accepted = await askConfirm({
      title: 'Installer malgré la capacité ?',
      text: `La table ${chosen.value?.table.numero} est trop petite pour ${props.entry?.party_size} couverts. Vous en répondez.`,
      confirmLabel: 'Installer quand même',
      danger: true,
    })

    if (accepted)
      await submit(true)

    return
  }

  await submit(false)
}

async function forceSeat() {
  const accepted = await askConfirm({
    title: 'Forcer l\'installation ?',
    text: `${errorMessage.value} En forçant, vous installez malgré ce refus.`,
    confirmLabel: 'Forcer l\'installation',
    danger: true,
  })

  if (accepted)
    await submit(true)
}

watch(open, isOpen => {
  if (isOpen) {
    selected.value = null
    reset()
  }
})

const label = computed(() => (chosen.value ? `Installer à ${tableLabel(chosen.value.table.numero)}` : 'Choisissez une table'))
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="entry ? `Installer ${entry.customer_name}` : 'Installer'"
    :subtitle="entry ? `${entry.party_size} couvert${entry.party_size > 1 ? 's' : ''} · position ${entry.position}` : ''"
    :submit-label="label"
    icon="ri-restaurant-line"
    :confirm="false"
    :loading="pending"
    :error="errorMessage"
    :max-width="620"
    @submit="onSubmit"
  >
    <p class="text-body-2 text-medium-emphasis mb-3">
      {{ freeCount ? `${freeCount} table${freeCount > 1 ? 's' : ''} libre${freeCount > 1 ? 's' : ''}` : 'Aucune table libre pour le moment.' }}
    </p>

    <div
      role="radiogroup"
      aria-label="Tables de la salle"
      class="seat-grid"
    >
      <button
        v-for="row in rows"
        :key="row.table.id"
        type="button"
        role="radio"
        class="seat-card"
        :class="{
          'seat-card--selected': selected === row.table.id,
          'seat-card--small': row.availability.state === 'small',
          'seat-card--busy': row.availability.state === 'busy',
        }"
        :aria-checked="selected === row.table.id"
        :disabled="row.availability.state === 'busy' || (row.availability.state === 'small' && !canForce)"
        :aria-describedby="row.availability.state !== 'free' ? `seat-note-${row.table.id}` : undefined"
        @click="selected = row.table.id"
      >
        <span class="seat-card__title">{{ tableLabel(row.table.numero) }}</span>
        <span class="seat-card__meta">{{ row.table.capacite }} place{{ row.table.capacite > 1 ? 's' : '' }}{{ row.table.emplacement ? ` · ${row.table.emplacement}` : '' }}</span>
        <span
          v-if="row.availability.state !== 'free'"
          :id="`seat-note-${row.table.id}`"
          class="seat-card__note"
        >
          {{ row.availability.state === 'busy' ? row.availability.reason : 'Trop petite pour ce groupe' }}
        </span>
      </button>
    </div>

    <VAlert
      v-if="offerForce"
      type="warning"
      variant="tonal"
      density="comfortable"
      class="mt-4"
      role="alert"
    >
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        <span>En tant que gestion, vous pouvez installer malgré ce refus.</span>
        <VBtn
          variant="outlined"
          color="warning"
          prepend-icon="ri-shield-check-line"
          @click="forceSeat"
        >
          Forcer l'installation
        </VBtn>
      </div>
    </VAlert>
  </AppFormDialog>
</template>

<style scoped>
.seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.seat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.35);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  text-align: left;
  cursor: pointer;
}

.seat-card:hover:not(:disabled) {
  border-color: rgb(var(--v-theme-primary));
}

.seat-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.seat-card--selected {
  border: 2px solid rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.1);
}

.seat-card--small {
  border-style: dashed;
}

.seat-card--busy {
  opacity: 0.55;
  cursor: not-allowed;
}

.seat-card:disabled {
  cursor: not-allowed;
}

.seat-card__title {
  font-weight: 600;
}

.seat-card__meta {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-on-surface) / 0.7);
}

.seat-card__note {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-error));
}
</style>
