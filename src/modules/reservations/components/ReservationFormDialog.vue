<!-- Création et modification d'une réservation. -->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { fromInputs, toDateInput, toTimeInput } from '../calendar'
import { DURATION_OPTIONS, SOURCE_OPTIONS, tableLabel } from '../labels'
import type { Reservation, Table } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{

  /** Réservation à modifier ; `null` pour en créer une. */
  reservation: Reservation | null

  /** Date et heure proposées à la création (clic sur un créneau, jour choisi). */
  initialDate: Date
  tables: Table[]
}>()

const emit = defineEmits<{ saved: [reservation: Reservation] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

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
const phoneKey = ref(0)

const isEdit = computed(() => props.reservation !== null)

const tableItems = computed(() => props.tables.map(table => ({
  value: table.id,
  title: `${tableLabel(table.numero)} · ${table.capacite} place${table.capacite > 1 ? 's' : ''}`,
})))

// Avertit (sans bloquer) quand le groupe dépasse la table choisie.
const tableHint = computed(() => {
  const table = props.tables.find(item => item.id === tableId.value)

  return table && Number(partySize.value) > table.capacite
    ? `Cette table a ${table.capacite} place${table.capacite > 1 ? 's' : ''} : le groupe est plus grand.`
    : ''
})

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  const when = fromInputs(date.value, time.value).toISOString()

  const common = {
    customer_name: name.value.trim(),
    customer_phone: phone.value || null,
    customer_email: email.value.trim() || null,
    party_size: Number(partySize.value),
    reservation_date: when,
    duration_minutes: duration.value,
    table_id: tableId.value,
    source: source.value,
    notes: notes.value.trim() || null,
  }

  const saved = props.reservation
    ? await reservationsApi.update(props.reservation.id, common)
    : tenant.currentId ? await reservationsApi.create(tenant.currentId, common) : null

  if (!saved)
    return

  toast.success(isEdit.value ? 'Réservation modifiée.' : 'Réservation enregistrée.')
  open.value = false
  emit('saved', saved)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()

  const current = props.reservation
  const start = current ? new Date(current.reservation_date) : props.initialDate

  name.value = current?.customer_name ?? ''
  phone.value = current?.customer_phone ?? ''
  email.value = current?.customer_email ?? ''
  date.value = toDateInput(start)
  time.value = toTimeInput(start)
  partySize.value = current?.party_size ?? 2
  duration.value = current?.duration_minutes ?? 90
  tableId.value = current?.table_id ?? null
  source.value = current?.source ?? 'POS'
  notes.value = current?.notes ?? ''
  phoneKey.value++
})

const rules = {
  name: [(value: string) => value.trim().length > 0 || 'Indiquez le nom du client.'],
  date: [(value: string) => Boolean(value) || 'Choisissez un jour.'],
  time: [(value: string) => Boolean(value) || 'Choisissez une heure.'],
  party: [(value: number | string) => (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 200) || 'Entre 1 et 200 couverts.'],
}
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la réservation' : 'Nouvelle réservation'"
    subtitle="Le client, le jour, l'heure et le nombre de couverts suffisent ; la table peut être choisie plus tard."
    submit-label="Enregistrer"
    icon="ri-calendar-event-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
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
          :hint="tableHint"
          :persistent-hint="Boolean(tableHint)"
          :error-messages="apiError?.fieldMessage('table_id')"
        />
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
    </VRow>
  </AppFormDialog>
</template>
