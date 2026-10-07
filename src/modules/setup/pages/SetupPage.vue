<script setup lang="ts">
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { PATHS } from '@/lib/router/paths'
import { internationalPhone, required } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const tenant = useTenantStore()
const router = useRouter()
const toast = useToast()
const form = ref()

const name = ref('')
const city = ref('')
const phone = ref('+237 ')
const address = ref('')

// Seul un compte « restaurateur » peut ouvrir un restaurant ; un employé attend d'être ajouté.
const canCreate = computed(() => session.user?.role === 'restaurant')

const { submit: create, pending, message, apiError } = useSubmit(async () => {
  await container.account.createRestaurant({
    name: name.value.trim(),
    city: city.value.trim() || undefined,
    country: 'Cameroun',
    phone: phone.value.trim().length > 4 ? phone.value : undefined,
    address: address.value.trim() || undefined,
  })
  await tenant.reload()
  toast.success('Votre restaurant est créé.')
  await router.replace(PATHS.home)
})

const { submit: recheck, pending: rechecking } = useSubmit(async () => {
  await tenant.reload()

  if (tenant.hasRestaurant)
    await router.replace(PATHS.home)
  else
    toast.info('Toujours aucun restaurant rattaché à ce compte.')
})

async function logout() {
  await session.logout()
  await router.replace(PATHS.login)
}

async function onSubmit() {
  if ((await form.value?.validate())?.valid)
    await create()
}

// Quelqu'un qui revient ici alors qu'il a déjà un restaurant n'a rien à y faire.
onMounted(async () => {
  try {
    await tenant.load()
  }
  catch {
    return
  }

  if (tenant.hasRestaurant)
    router.replace(PATHS.home)
})

const fieldError = (field: string) => apiError.value?.fieldMessage(field)
</script>

<template>
  <AuthShell
    v-if="canCreate"
    title="Ouvrez votre restaurant 🍽️"
    subtitle="Ces informations s'affichent sur vos tickets et vos factures. Vous pourrez les modifier plus tard."
  >
    <VForm
      ref="form"
      validate-on="submit"
      @submit.prevent="onSubmit"
    >
      <VRow>
        <VCol cols="12">
          <VTextField
            v-model="name"
            label="Nom du restaurant"
            autofocus
            :rules="[required]"
            :error-messages="fieldError('name')"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="city"
            label="Ville"
            :error-messages="fieldError('city')"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="phone"
            label="Téléphone"
            type="tel"
            :rules="[internationalPhone]"
            :error-messages="fieldError('phone')"
          />
        </VCol>
        <VCol cols="12">
          <VTextField
            v-model="address"
            label="Adresse"
            :error-messages="fieldError('address')"
          />
        </VCol>

        <VCol
          v-if="message"
          cols="12"
        >
          <VAlert
            type="error"
            variant="tonal"
          >
            {{ message }}
          </VAlert>
        </VCol>

        <VCol cols="12">
          <VBtn
            type="submit"
            block
            size="large"
            :loading="pending"
          >
            Créer mon restaurant
          </VBtn>
        </VCol>
      </VRow>
    </VForm>

    <template #footer>
      <a
        class="text-primary cursor-pointer"
        @click="logout"
      >Se déconnecter</a>
    </template>
  </AuthShell>

  <AuthShell
    v-else
    title="Aucun restaurant rattaché"
    subtitle="Votre compte n'est lié à aucun restaurant pour l'instant."
  >
    <p class="text-body-1 mb-6">
      Demandez au responsable de votre restaurant de vous ajouter à son équipe, puis revenez ici.
    </p>
    <VBtn
      block
      size="large"
      :loading="rechecking"
      prepend-icon="ri-refresh-line"
      @click="recheck"
    >
      Vérifier à nouveau
    </VBtn>

    <template #footer>
      <a
        class="text-primary cursor-pointer"
        @click="logout"
      >Se déconnecter</a>
    </template>
  </AuthShell>
</template>
