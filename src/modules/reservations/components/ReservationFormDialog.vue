<!--
  Création et modification d'une réservation, dans le fuseau du restaurant. Les créneaux viennent
  du serveur (tables assez grandes et libres sur toute la durée). Un refus métier s'affiche tel
  quel. La gestion peut forcer un refus de capacité, d'horaires ou de date passée, après
  confirmation ; un chevauchement sur une table ne se force pas.
-->
<script setup lang="ts">
import { useAvailability } from '../composables/useAvailability'
import { useClientSearch } from '../composables/useClientSearch'
import { reservationsApi } from '../api'
import { fromInputs, toDateInput, toTimeInput } from '../calendar'
import { DURATION_OPTIONS, SOURCE_OPTIONS, isForcable, messageOf, tableLabel } from '../labels'
import type { ClientMatch, ClientSummary, Reservation, ReservationCreate, Table } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{

  /** Réservation à modifier ; `null` pour en créer une. */
  reservation: Reservation | null

  /** Instant proposé à la création (clic sur la grille, jour affiché). */
  initialDate: Date
  tables: Table[]

  /** Fuseau IANA du restaurant. */
  zone: string
  canForce: boolean
}>()

const emit = defineEmits<{ saved: [reservation: Reservation] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()
const askConfirm = useConfirm()

const name = ref('')
const phone = ref('')
const email = ref('')
const date = ref('')
const time = ref('')
const partySize = ref<number | string>(2)
const duration = ref(90)
const tableId = ref<string | null>(null)
const source = ref('POS')
const notes = ref('')
const customerId = ref<string | null>(null)
const phoneKey = ref(0)
const clientSearch = ref('')
const clientSummary = ref<ClientSummary | null>(null)

const isEdit = computed(() => props.reservation !== null)
const isArrived = computed(() => props.reservation?.status === 'checked_in')
const size = computed(() => Math.max(1, Math.floor(Number(partySize.value) || 0)))

// Créneaux -----------------------------------------------------------------------------------

const dateRef = computed(() => date.value)
const sizeRef = computed(() => size.value)
const durationRef = computed(() => duration.value)
const { availability, loading: slotsLoading, error: slotsError } = useAvailability(dateRef, sizeRef, durationRef)

const slots = computed(() => availability.value?.creneaux ?? [])

const chosenMoment = computed(() => (date.value && time.value ? fromInputs(date.value, time.value, props.zone) : null))

/** L'heure choisie figure-t-elle parmi les créneaux proposés ? Sinon le serveur la vérifiera. */
const chosenSlot = computed(() => slots.value.find(slot => slot.heure === time.value) ?? null)

// Tables ---------------------------------------------------------------------------------------

const tableItems = computed(() => props.tables.map(table => {
  const tooSmall = table.capacite < size.value

  return {
    value: table.id,
    title: `${tableLabel(table.numero)} · ${table.capacite} place${table.capacite > 1 ? 's' : ''}${table.emplacement ? ` · ${table.emplacement}` : ''}`,
    props: { disabled: tooSmall && !props.canForce, subtitle: tooSmall ? 'Trop petite pour ce groupe' : undefined },
  }
}))

const tableHint = computed(() => {
  const table = props.tables.find(item => item.id === tableId.value)

  return table && size.value > table.capacite
    ? `Cette table a ${table.capacite} place${table.capacite > 1 ? 's' : ''} : le groupe est plus grand.`
    : ''
})

// Client connu ----------------------------------------------------------------------------------

const { matches, loading: searching } = useClientSearch(clientSearch)

const clientItems = computed(() => matches.value.map((match: ClientMatch) => ({
  value: match.id,
  title: match.name ?? 'Client sans nom',
  subtitle: match.phone ?? match.email ?? '',
})))

async function chooseClient(id: string | null) {
  if (!id || !tenant.currentId) {
    customerId.value = null
    clientSummary.value = null

    return
  }

  const match = matches.value.find(item => item.id === id)

  customerId.value = id
  if (match) {
    name.value = match.name ?? name.value
    phone.value = match.phone ?? ''
    email.value = match.email ?? ''
    phoneKey.value++
  }

  clientSummary.value = await reservationsApi.customerSummary(tenant.currentId, id).catch(() => null)
}

const summaryLine = computed(() => {
  const s = clientSummary.value

  if (!s)
    return ''

  const visits = `${s.visites} visite${s.visites > 1 ? 's' : ''}`
  const absences = s.absences ? ` · ${s.absences} absence${s.absences > 1 ? 's' : ''}` : ''
  const last = s.derniere_visite ? ` · dernière visite le ${new Date(s.derniere_visite).toLocaleDateString('fr-FR')}` : ''

  return `${visits}${absences}${last}`
})

// Enregistrement -------------------------------------------------------------------------------

const forced = ref(false)

function buildBody(): ReservationCreate {
  const when = fromInputs(date.value, time.value, props.zone).toISOString()

  return {
    customer_name: name.value.trim(),
    customer_phone: phone.value || null,
    customer_email: email.value.trim() || null,
    customer_id: customerId.value,
    party_size: size.value,
    reservation_date: when,
    duration_minutes: duration.value,
    table_id: tableId.value,
    source: source.value,
    notes: notes.value.trim() || null,
  }
}

const { submit, pending, apiError, reset } = useSubmit(async (force: boolean) => {
  const body = buildBody()

  const saved = props.reservation
    ? await reservationsApi.update(props.reservation.id, body, force)
    : tenant.currentId ? await reservationsApi.create(tenant.currentId, body, force) : null

  if (!saved)
    return

  toast.success(isEdit.value ? 'Réservation modifiée.' : 'Réservation enregistrée.')
  open.value = false
  emit('saved', saved)
})

const errorMessage = computed(() => (apiError.value ? messageOf(apiError.value) : ''))
const canOfferForce = computed(() => props.canForce && apiError.value !== null && apiError.value.status < 500 && isForcable(errorMessage.value))

async function forceSave() {
  const accepted = await askConfirm({
    title: 'Forcer cette réservation ?',
    text: `${errorMessage.value} En forçant, vous enregistrez malgré ce refus. Le restaurant en répond.`,
    confirmLabel: 'Forcer et enregistrer',
    danger: true,
  })

  if (accepted) {
    forced.value = true
    await submit(true)
  }
}

function onSubmit() {
  forced.value = false
  submit(false)
}

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  forced.value = false

  const current = props.reservation
  const start = current ? new Date(current.reservation_date) : props.initialDate

  name.value = current?.customer_name ?? ''
  phone.value = current?.customer_phone ?? ''
  email.value = current?.customer_email ?? ''
  date.value = toDateInput(start, props.zone)
  time.value = toTimeInput(start, props.zone)
  partySize.value = current?.party_size ?? 2
  duration.value = current?.duration_minutes ?? 90
  tableId.value = current?.table_id ?? null
  source.value = current?.source ?? 'POS'
  notes.value = current?.notes ?? ''
  customerId.value = current?.customer_id ?? null
  clientSearch.value = ''
  clientSummary.value = null
  phoneKey.value++

  if (customerId.value)
    chooseClient(customerId.value)
})

const rules = {
  name: [(value: string) => value.trim().length > 0 || 'Indiquez le nom du client.'],
  date: [(value: string) => Boolean(value) || 'Choisissez un jour.'],
  time: [(value: string) => Boolean(value) || 'Choisissez une heure.'],
  party: [(value: number | string) => (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 200) || 'Entre 1 et 200 couverts.'],
}

const chosenLabel = computed(() => (chosenMoment.value ? `${date.value} à ${time.value}` : ''))
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la réservation' : 'Nouvelle réservation'"
    :subtitle="`Heure du restaurant (${zone}). Le client, le jour, l'heure et le nombre de couverts suffisent.`"
    submit-label="Enregistrer"
    icon="ri-calendar-event-line"
    :loading="pending"
    :error="errorMessage"
    @submit="onSubmit"
  >
    <VRow>
      <VCol cols="12">
        <VAutocomplete
          v-model="customerId"
          v-model:search="clientSearch"
          :items="clientItems"
          :loading="searching"
          item-title="title"
          item-value="value"
          label="Client déjà connu (facultatif)"
          prepend-inner-icon="ri-search-line"
          placeholder="Tapez un nom ou un téléphone"
          no-data-text="Aucun client trouvé : saisissez-le ci-dessous."
          clearable
          hide-details="auto"
          @update:model-value="chooseClient"
        />
        <p
          v-if="summaryLine"
          class="mt-2 text-body-2 text-medium-emphasis"
          role="status"
        >
          Historique : {{ summaryLine }}
        </p>
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="name"
          label="Nom du client"
          prepend-inner-icon="ri-user-line"
          placeholder="Aïcha Mbarga"
          :rules="rules.name"
          :error-messages="apiError?.fieldMessage('customer_name')"
          maxlength="255"
          autofocus
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <AppPhoneField
          :key="phoneKey"
          v-model="phone"
          label="Téléphone (facultatif)"
          :error-messages="apiError?.fieldMessage('customer_phone')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="date"
          label="Jour"
          prepend-inner-icon="ri-calendar-line"
          type="date"
          :rules="rules.date"
          :disabled="isArrived"
          :error-messages="apiError?.fieldMessage('reservation_date')"
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="time"
          label="Heure"
          prepend-inner-icon="ri-time-line"
          type="time"
          :rules="rules.time"
          :disabled="isArrived"
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="partySize"
          label="Couverts"
          prepend-inner-icon="ri-group-line"
          type="number"
          min="1"
          max="200"
          :rules="rules.party"
          :error-messages="apiError?.fieldMessage('party_size')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSelect
          v-model="duration"
          :items="DURATION_OPTIONS"
          label="Durée prévue"
          prepend-inner-icon="ri-timer-line"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSelect
          v-model="tableId"
          :items="tableItems"
          label="Table (facultative)"
          prepend-inner-icon="ri-layout-grid-line"
          placeholder="Choisie à l'arrivée"
          clearable
          :disabled="isArrived"
          :hint="tableHint"
          :persistent-hint="Boolean(tableHint)"
          :error-messages="apiError?.fieldMessage('table_id')"
        />
      </VCol>

      <VCol cols="12">
        <div class="slots">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-subtitle-2">Créneaux disponibles</span>
            <span
              v-if="chosenLabel"
              class="text-caption text-medium-emphasis"
            >Choisi : {{ chosenLabel }}</span>
          </div>
          <div
            v-if="slotsLoading && !slots.length"
            class="text-body-2 text-medium-emphasis"
          >
            Recherche des créneaux…
          </div>
          <div
            v-else-if="slotsError"
            class="text-body-2 text-error"
          >
            Les créneaux n'ont pas pu être chargés.
          </div>
          <div
            v-else-if="!slots.length"
            class="text-body-2 text-medium-emphasis"
          >
            Aucun créneau ce jour-là : le restaurant est fermé ou aucune table n'est assez grande.
          </div>
          <div
            v-else
            class="slots__grid"
            role="group"
            aria-label="Créneaux disponibles"
          >
            <button
              v-for="slot in slots"
              :key="slot.debut"
              type="button"
              class="slot"
              :class="{ 'slot--selected': slot.heure === time, 'slot--full': !slot.disponible }"
              :disabled="isArrived || !slot.disponible"
              :aria-pressed="slot.heure === time"
              :aria-label="slot.disponible ? `${slot.heure}, ${slot.tables_libres} table${slot.tables_libres > 1 ? 's' : ''} libre${slot.tables_libres > 1 ? 's' : ''}` : `${slot.heure}, complet`"
              @click="time = slot.heure"
            >
              <span class="slot__hour">{{ slot.heure }}</span>
              <span class="slot__count">{{ slot.passe ? 'passé' : slot.disponible ? `${slot.tables_libres} table${slot.tables_libres > 1 ? 's' : ''}` : 'complet' }}</span>
            </button>
          </div>
          <p
            v-if="time && !chosenSlot && slots.length"
            class="text-caption text-medium-emphasis mt-2"
          >
            Cette heure n'est pas dans la liste : elle sera vérifiée à l'enregistrement.
          </p>
        </div>
      </VCol>

      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="email"
          label="E-mail (facultatif)"
          prepend-inner-icon="ri-mail-line"
          type="email"
          maxlength="254"
          :error-messages="apiError?.fieldMessage('customer_email')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSelect
          v-model="source"
          :items="SOURCE_OPTIONS"
          label="Réservé"
          prepend-inner-icon="ri-store-2-line"
        />
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="notes"
          label="Notes (facultatives)"
          prepend-inner-icon="ri-file-text-line"
          placeholder="Anniversaire, allergies, table près de la fenêtre..."
          rows="2"
          auto-grow
          maxlength="1000"
        />
      </VCol>

      <VCol
        v-if="canOfferForce"
        cols="12"
      >
        <VAlert
          type="warning"
          variant="tonal"
          density="comfortable"
          role="alert"
        >
          <div class="d-flex flex-wrap align-center justify-space-between ga-3">
            <span>En tant que gestion, vous pouvez enregistrer malgré ce refus.</span>
            <VBtn
              variant="outlined"
              color="warning"
              prepend-icon="ri-shield-check-line"
              :disabled="pending"
              @click="forceSave"
            >
              Forcer l'enregistrement
            </VBtn>
          </div>
        </VAlert>
      </VCol>
    </VRow>
  </AppFormDialog>
</template>

<style scoped>
.slots__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.45);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.slot:hover:not(:disabled) {
  border-color: rgb(var(--v-theme-primary));
}

.slot:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.slot--selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.12);
}

.slot:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.slot__hour {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.slot__count {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface) / 0.7);
}
</style>
