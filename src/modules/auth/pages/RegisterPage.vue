<script setup lang="ts">
import { container } from '@/container'
import { isApiError } from '@/lib/http/errors'
import { describeError } from '@/lib/http/errorMessages'
import { PATHS } from '@/lib/router/paths'
import { email as emailRule, internationalPhone, minLength, required, sameAs } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const tenant = useTenantStore()
const router = useRouter()
const toast = useToast()

const STEPS = [
  { title: 'Compte', subtitle: 'Vos identifiants' },
  { title: 'Restaurant', subtitle: 'Votre établissement' },
  { title: 'Confirmation', subtitle: 'Vérifier et créer' },
]

const step = ref(0)
const accountForm = ref()
const restaurantForm = ref()

const account = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '+237 ',
  password: '',
  confirmation: '',
})

const restaurant = reactive({
  name: '',
  city: '',
  phone: '',
  address: '',
})

const pending = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

const normalizedEmail = computed(() => account.email.trim().toLowerCase())

async function next() {
  const form = step.value === 0 ? accountForm.value : restaurantForm.value

  if ((await form?.validate())?.valid) {
    // Le téléphone du restaurant reprend celui du compte s'il n'est pas précisé.
    if (step.value === 0 && restaurant.phone.trim().length <= 4)
      restaurant.phone = account.phone

    step.value++
  }
}

/**
 * Crée le compte, ouvre la session, puis crée le restaurant. Si le compte existe déjà
 * (e-mail ou téléphone pris), on revient à l'étape 1 avec le champ en cause.
 */
async function finish() {
  if (pending.value)
    return

  pending.value = true
  error.value = ''
  fieldErrors.value = {}

  try {
    await container.auth.register({
      first_name: account.firstName.trim(),
      last_name: account.lastName.trim(),
      email: normalizedEmail.value,
      phone: account.phone,
      password: account.password,
      role: 'restaurant',
    })
  }
  catch (cause) {
    pending.value = false
    fieldErrors.value = Object.fromEntries((isApiError(cause) ? cause.fieldErrors : []).map(item => [item.field, item.message]))
    error.value = describeError(cause)
    step.value = 0

    return
  }

  try {
    await session.login({ email: normalizedEmail.value, password: account.password }, true)
    await container.account.createRestaurant({
      name: restaurant.name.trim(),
      city: restaurant.city.trim() || undefined,
      country: 'Cameroun',
      phone: restaurant.phone.trim().length > 4 ? restaurant.phone : undefined,
      address: restaurant.address.trim() || undefined,
    })
    await tenant.reload()
    toast.success(`Bienvenue sur Marinade, ${account.firstName.trim()} !`)
    await router.replace(PATHS.home)
  }
  catch {
    // Le compte existe : on termine l'ouverture du restaurant depuis la page dédiée.
    toast.warning('Votre compte est créé. Finalisons votre restaurant.')
    await router.replace(session.isAuthenticated ? PATHS.setup : { path: PATHS.login, query: { registered: '1' } })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <AuthShell
    title="L'aventure commence ici 🚀"
    subtitle="Trois étapes pour ouvrir votre restaurant sur Marinade."
    wide
  >
    <AppStepper
      :steps="STEPS"
      :current="step"
      class="mb-8"
    />

    <VAlert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
    >
      {{ error }}
    </VAlert>

    <!-- 01 Compte -->
    <VForm
      v-show="step === 0"
      ref="accountForm"
      validate-on="submit"
      @submit.prevent="next"
    >
      <h2 class="text-h6 mb-1">
        Informations du compte
      </h2>
      <p class="text-body-2 text-medium-emphasis mb-5">
        Ce sont vos identifiants de connexion.
      </p>

      <VRow>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="account.firstName"
            label="Prénom"
            autocomplete="given-name"
            autofocus
            :rules="[required]"
            :error-messages="fieldErrors.first_name"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="account.lastName"
            label="Nom"
            autocomplete="family-name"
            :rules="[required]"
            :error-messages="fieldErrors.last_name"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="account.email"
            label="Adresse e-mail"
            type="email"
            autocomplete="email"
            :rules="[required, emailRule]"
            :error-messages="fieldErrors.email"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="account.phone"
            label="Téléphone"
            type="tel"
            autocomplete="tel"
            :rules="[required, internationalPhone]"
            :error-messages="fieldErrors.phone"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <AppPasswordField
            v-model="account.password"
            label="Mot de passe"
            autocomplete="new-password"
            hint="12 caractères au minimum."
            persistent-hint
            :rules="[required, minLength(12)]"
            :error-messages="fieldErrors.password"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <AppPasswordField
            v-model="account.confirmation"
            label="Confirmer le mot de passe"
            autocomplete="new-password"
            :rules="[required, sameAs(() => account.password, 'Les mots de passe ne correspondent pas.')]"
          />
        </VCol>
      </VRow>

      <div class="d-flex justify-end mt-8">
        <VBtn
          type="submit"
          append-icon="ri-arrow-right-line"
        >
          Suivant
        </VBtn>
      </div>
    </VForm>

    <!-- 02 Restaurant -->
    <VForm
      v-show="step === 1"
      ref="restaurantForm"
      validate-on="submit"
      @submit.prevent="next"
    >
      <h2 class="text-h6 mb-1">
        Votre restaurant
      </h2>
      <p class="text-body-2 text-medium-emphasis mb-5">
        Affiché sur vos tickets et factures. Modifiable à tout moment.
      </p>

      <VRow>
        <VCol cols="12">
          <VTextField
            v-model="restaurant.name"
            label="Nom du restaurant"
            :rules="[required]"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="restaurant.city"
            label="Ville"
          />
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="restaurant.phone"
            label="Téléphone du restaurant"
            type="tel"
            :rules="[internationalPhone]"
          />
        </VCol>
        <VCol cols="12">
          <VTextField
            v-model="restaurant.address"
            label="Adresse"
          />
        </VCol>
      </VRow>

      <div class="d-flex justify-space-between mt-8">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-arrow-left-line"
          @click="step = 0"
        >
          Précédent
        </VBtn>
        <VBtn
          type="submit"
          append-icon="ri-arrow-right-line"
        >
          Suivant
        </VBtn>
      </div>
    </VForm>

    <!-- 03 Confirmation -->
    <div v-show="step === 2">
      <h2 class="text-h6 mb-1">
        Tout est prêt
      </h2>
      <p class="text-body-2 text-medium-emphasis mb-5">
        Vérifiez vos informations avant de créer votre espace.
      </p>

      <VRow>
        <VCol
          cols="12"
          sm="6"
        >
          <VCard
            variant="tonal"
            color="primary"
            class="pa-4 h-100"
          >
            <div class="d-flex align-center gap-2 mb-3">
              <VIcon icon="ri-user-line" />
              <span class="font-weight-semibold">Compte</span>
            </div>
            <div class="text-body-1 text-high-emphasis">
              {{ account.firstName }} {{ account.lastName }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ normalizedEmail }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ account.phone }}
            </div>
          </VCard>
        </VCol>
        <VCol
          cols="12"
          sm="6"
        >
          <VCard
            variant="tonal"
            color="primary"
            class="pa-4 h-100"
          >
            <div class="d-flex align-center gap-2 mb-3">
              <VIcon icon="ri-restaurant-2-line" />
              <span class="font-weight-semibold">Restaurant</span>
            </div>
            <div class="text-body-1 text-high-emphasis">
              {{ restaurant.name }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ [restaurant.address, restaurant.city].filter(Boolean).join(', ') || 'Adresse à compléter' }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Monnaie : FCFA
            </div>
          </VCard>
        </VCol>
      </VRow>

      <div class="d-flex justify-space-between mt-8">
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-arrow-left-line"
          :disabled="pending"
          @click="step = 1"
        >
          Précédent
        </VBtn>
        <VBtn
          :loading="pending"
          append-icon="ri-check-line"
          @click="finish"
        >
          Créer mon restaurant
        </VBtn>
      </div>
    </div>

    <template #footer>
      <span class="text-medium-emphasis">Déjà un compte ?</span>
      <RouterLink
        to="/login"
        class="text-primary ms-1"
      >
        Se connecter
      </RouterLink>
    </template>
  </AuthShell>
</template>
