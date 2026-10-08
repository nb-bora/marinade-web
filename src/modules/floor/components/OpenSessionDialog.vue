<!-- Ouvrir une session sur une table libre : couverts et client (facultatif). -->
<script setup lang="ts">
import { floorApi } from '../api'
import { markEmpty } from '../composables/invoices'
import { CUSTOMER_TYPE_LABEL, plural } from '../labels'
import { contextFor, occupy } from '../service'
import type { CustomerType, ServiceSession, Table } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { email as emailRule, required } from '@/lib/validation'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ table: Table | null }>()
const emit = defineEmits<{ opened: [session: ServiceSession] }>()

const open = defineModel<boolean>({ required: true })

type Choice = 'NONE' | CustomerType

const CHOICES: { value: Choice; title: string }[] = [
  { value: 'NONE', title: 'Sans client' },
  { value: 'GUEST', title: CUSTOMER_TYPE_LABEL.GUEST },
  { value: 'VIP', title: CUSTOMER_TYPE_LABEL.VIP },
  { value: 'BUSINESS', title: CUSTOMER_TYPE_LABEL.BUSINESS },
  { value: 'REGISTERED', title: CUSTOMER_TYPE_LABEL.REGISTERED },
]

const tenant = useTenantStore()
const toast = useToast()

const covers = ref(2)
const choice = ref<Choice>('NONE')
const name = ref('')
const phone = ref('')
const email = ref('')

// Un nom est exigé dès que le client est « connu » ; pour un invité il reste facultatif.
const nameRequired = computed(() => choice.value !== 'NONE' && choice.value !== 'GUEST')
const overCapacity = computed(() => props.table !== null && covers.value > props.table.capacite)

const step = (delta: number) => {
  covers.value = Math.min(99, Math.max(1, covers.value + delta))
}

const { submit, pending, message, reset } = useSubmit(async () => {
  const table = props.table
  const restaurantId = tenant.currentId

  if (!table || !restaurantId)
    return

  const customer = choice.value === 'NONE'
    ? null
    : await floorApi.createCustomer(restaurantId, {
      customer_type: choice.value,
      name: name.value.trim() || null,
      phone: phone.value || null,
      email: email.value.trim() || null,
    })

  const session = await floorApi.openSession(restaurantId, {
    table_id: table.id,
    customer_id: customer?.id ?? null,
    table_context: contextFor(covers.value, table.emplacement),
  })

  markEmpty(session.id)

  // La session est ouverte : si la mise à jour de la table échoue, le plan se corrigera
  // de lui-même (une session ouverte sur la table prime sur son statut).
  try {
    await floorApi.updateTable(table.id, occupy(table, session.id, covers.value))
  }
  catch {
    toast.warning('Session ouverte, mais la table n\'a pas pu être marquée occupée.')
  }

  toast.success(`Table ${table.numero} ouverte.`)
  open.value = false
  emit('opened', session)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  covers.value = Math.min(2, props.table?.capacite ?? 2)
  choice.value = 'NONE'
  name.value = ''
  phone.value = ''
  email.value = ''
  reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="`Ouvrir la table ${table?.numero ?? ''}`"
    :subtitle="table ? `${plural(table.capacite, 'place')}${table.emplacement ? ` · ${table.emplacement}` : ''}` : undefined"
    icon="ri-restaurant-2-line"
    submit-label="Ouvrir la session"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <div class="text-subtitle-2 mb-2">
      Nombre de couverts
    </div>
    <div class="d-flex align-center gap-4 mb-1">
      <VBtn
        icon="ri-subtract-line"
        variant="tonal"
        size="large"
        aria-label="Un couvert de moins"
        :disabled="covers <= 1"
        @click="step(-1)"
      />
      <div
        class="text-h4 font-weight-bold tabular-nums covers-value"
        aria-live="polite"
      >
        {{ covers }}
      </div>
      <VBtn
        icon="ri-add-line"
        variant="tonal"
        size="large"
        aria-label="Un couvert de plus"
        @click="step(1)"
      />
    </div>
    <p
      class="text-body-2 mb-5"
      :class="overCapacity ? 'text-warning' : 'text-medium-emphasis'"
    >
      {{ overCapacity ? `Cette table compte ${plural(table?.capacite ?? 0, 'place')} : vérifiez le nombre de couverts.` : 'Vous pourrez ajouter des commandes à tout moment.' }}
    </p>

    <div class="text-subtitle-2 mb-2">
      Client
    </div>
    <VChipGroup
      v-model="choice"
      mandatory
      column
      selected-class="text-primary"
      class="mb-4"
      aria-label="Type de client"
    >
      <VChip
        v-for="option in CHOICES"
        :key="option.value"
        :value="option.value"
        role="radio"
        :aria-checked="choice === option.value"
        size="large"
        variant="tonal"
        filter
      >
        {{ option.title }}
      </VChip>
    </VChipGroup>

    <template v-if="choice !== 'NONE'">
      <VTextField
        v-model="name"
        :label="nameRequired ? 'Nom du client' : 'Nom du client (facultatif)'"
        prepend-inner-icon="ri-user-line"
        :rules="nameRequired ? [required] : []"
        autocomplete="off"
        class="mb-2"
      />
      <VRow dense>
        <VCol
          cols="12"
          sm="6"
        >
          <AppPhoneField
            v-model="phone"
            label="Téléphone (facultatif)"
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
            :rules="[emailRule]"
            autocomplete="off"
          />
        </VCol>
      </VRow>
    </template>
  </AppFormDialog>
</template>

<style scoped>
.covers-value {
  min-inline-size: 3rem;
  text-align: center;
}
</style>
