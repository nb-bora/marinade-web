<!-- Ajout rapide d'un groupe à la liste d'attente, sans ouvrir de fenêtre. -->
<script setup lang="ts">
import { reservationsApi } from '../api'
import type { WaitlistEntry } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const emit = defineEmits<{ added: [entry: WaitlistEntry] }>()

const tenant = useTenantStore()
const toast = useToast()

const form = ref()
const name = ref('')
const partySize = ref<number | string>(2)
const phone = ref('')
const estimate = ref<number | string>('')
const phoneKey = ref(0)

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  if (!tenant.currentId)
    return

  const entry = await reservationsApi.addToWaitlist(tenant.currentId, {
    customer_name: name.value.trim(),
    customer_phone: phone.value || null,
    party_size: Number(partySize.value),
    estimated_wait_minutes: estimate.value === '' ? null : Number(estimate.value),
    source: 'POS',
  })

  toast.success(`${entry.customer_name} est sur la liste d'attente.`)
  name.value = ''
  phone.value = ''
  estimate.value = ''
  partySize.value = 2
  phoneKey.value++
  await nextTick()
  form.value?.resetValidation()
  reset()
  emit('added', entry)
})

async function onSubmit() {
  if ((await form.value?.validate())?.valid)
    submit()
}

const rules = {
  name: [(value: string) => value.trim().length > 0 || 'Indiquez un nom.'],
  party: [(value: number | string) => (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 200) || 'Entre 1 et 200.'],
  estimate: [(value: number | string) => value === '' || (Number.isInteger(Number(value)) && Number(value) >= 0) || 'Un nombre de minutes.'],
}
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Ajouter un groupe</VCardTitle>
      <VCardSubtitle>Un nom et un nombre de couverts suffisent.</VCardSubtitle>
    </VCardItem>
    <VCardText>
      <VForm
        ref="form"
        validate-on="submit"
        @submit.prevent="onSubmit"
      >
        <VRow>
          <VCol
            cols="12"
            sm="6"
            lg="3"
          >
            <VTextField
              v-model="name"
              label="Nom"
              placeholder="Famille Ngono"
              :rules="rules.name"
              :error-messages="apiError?.fieldMessage('customer_name')"
              maxlength="255"
            />
          </VCol>
          <VCol
            cols="6"
            sm="3"
            lg="2"
          >
            <VTextField
              v-model="partySize"
              label="Couverts"
              type="number"
              min="1"
              :rules="rules.party"
              :error-messages="apiError?.fieldMessage('party_size')"
            />
          </VCol>
          <VCol
            cols="6"
            sm="3"
            lg="2"
          >
            <VTextField
              v-model="estimate"
              label="Attente (min)"
              type="number"
              min="0"
              placeholder="15"
              :rules="rules.estimate"
              :error-messages="apiError?.fieldMessage('estimated_wait_minutes')"
            />
          </VCol>
          <VCol
            cols="12"
            sm="8"
            lg="3"
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
            sm="4"
            lg="2"
          >
            <VBtn
              type="submit"
              block
              size="large"
              prepend-icon="ri-add-line"
              :loading="pending"
            >
              Ajouter
            </VBtn>
          </VCol>
        </VRow>

        <VAlert
          v-if="message"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-2"
        >
          {{ message }}
        </VAlert>
      </VForm>
    </VCardText>
  </VCard>
</template>
