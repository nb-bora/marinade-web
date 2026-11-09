<!--
  Ajout rapide à la liste d'attente, au comptoir : nom, couverts, téléphone et e-mail facultatifs.
  Pas de confirmation à chaque ajout (ce serait une friction au comptoir) ; la file se met à jour
  tout de suite.
-->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { messageOf } from '../labels'
import type { WaitlistEntry } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const emit = defineEmits<{ added: [entry: WaitlistEntry] }>()

const tenant = useTenantStore()
const toast = useToast()

const name = ref('')
const size = ref<number | string>(2)
const phone = ref('')
const email = ref('')
const phoneKey = ref(0)

const { submit, pending, apiError, reset } = useSubmit(async () => {
  if (!tenant.currentId)
    return

  const entry = await reservationsApi.addToWaitlist(tenant.currentId, {
    customer_name: name.value.trim(),
    party_size: Number(size.value),
    customer_phone: phone.value || null,
    customer_email: email.value.trim() || null,
    source: 'POS',
  })

  toast.success(`${entry.customer_name} ajouté à la file (position ${entry.position}).`)
  name.value = ''
  size.value = 2
  phone.value = ''
  email.value = ''
  phoneKey.value++
  emit('added', entry)
})

const errorMessage = computed(() => (apiError.value ? messageOf(apiError.value) : ''))

async function onSubmit() {
  reset()
  await submit()
}
</script>

<template>
  <form
    class="quick-add"
    aria-label="Ajouter un groupe à la liste d'attente"
    @submit.prevent="onSubmit"
  >
    <div class="quick-add__fields">
      <VTextField
        v-model="name"
        label="Nom du groupe"
        prepend-inner-icon="ri-user-line"
        placeholder="Famille Ngo"
        maxlength="255"
        required
        :error-messages="apiError?.fieldMessage('customer_name')"
        autocomplete="off"
        hide-details="auto"
      />
      <VTextField
        v-model="size"
        label="Couverts"
        prepend-inner-icon="ri-group-line"
        type="number"
        min="1"
        max="200"
        required
        :error-messages="apiError?.fieldMessage('party_size')"
        hide-details="auto"
      />
      <AppPhoneField
        :key="phoneKey"
        v-model="phone"
        label="Téléphone (facultatif)"
        :error-messages="apiError?.fieldMessage('customer_phone')"
      />
      <VTextField
        v-model="email"
        label="E-mail (facultatif)"
        prepend-inner-icon="ri-mail-line"
        type="email"
        maxlength="254"
        :error-messages="apiError?.fieldMessage('customer_email')"
        hide-details="auto"
      />
    </div>
    <div class="d-flex align-center justify-space-between ga-3 mt-3 flex-wrap">
      <p
        v-if="errorMessage"
        class="text-error text-body-2 ma-0"
        role="alert"
      >
        {{ errorMessage }}
      </p>
      <span v-else />
      <VBtn
        type="submit"
        color="primary"
        prepend-icon="ri-add-line"
        :loading="pending"
        :disabled="!name.trim()"
      >
        Ajouter à la file
      </VBtn>
    </div>
  </form>
</template>

<style scoped>
.quick-add {
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.25);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
}

.quick-add__fields {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1.6fr);
  gap: 12px;
}

@media (max-width: 960px) {
  .quick-add__fields {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .quick-add__fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
