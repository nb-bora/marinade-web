<script setup lang="ts">
import { container } from '@/container'
import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import { CAMEROON_CITIES } from '@/lib/phone'
import { PATHS } from '@/lib/router/paths'
import { email as emailRule, minLength, required, sameAs } from '@/lib/validation'
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
  phone: '',
  password: '',
  confirmation: '',
})

const restaurant = reactive({
  name: '',
  city: '',
  phone: '',
  address: '',
  samePhone: true,
})

const accepted = ref(false)
const pending = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

const normalizedEmail = computed(() => account.email.trim().toLowerCase())
const restaurantPhone = computed(() => (restaurant.samePhone ? account.phone : restaurant.phone))

// Une erreur du serveur sur un champ disparaît dès que l'on corrige ce champ.
watch(() => [account.email, account.phone], () => {
  fieldErrors.value = {}
})

async function next() {
  const form = step.value === 0 ? accountForm.value : restaurantForm.value

  if ((await form?.validate())?.valid)
    step.value++
}

/**
 * Crée le compte, ouvre la session, puis crée le restaurant. Si le compte existe déjà
 * (e-mail ou téléphone pris), on revient à l'étape 1 sur le champ en cause.
 */
async function finish() {
  if (pending.value || !accepted.value)
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

    // « E-mail déjà utilisé » et « téléphone déjà utilisé » arrivent en 409 : on les place sous le bon champ.
    const message = describeError(cause)

    if (isApiError(cause) && cause.kind === 'conflict')
      fieldErrors.value[cause.message.toLowerCase().includes('phone') ? 'phone' : 'email'] = message
    else
      error.value = message

    step.value = 0

    return
  }

  try {
    await session.login({ email: normalizedEmail.value, password: account.password }, true)
    await container.account.createRestaurant({
      name: restaurant.name.trim(),
      city: restaurant.city?.trim() || undefined,
      country: 'Cameroun',
      phone: restaurantPhone.value || undefined,
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
    subtitle="Trois étapes pour ouvrir votre restaurant sur Marinade. C'est gratuit et sans engagement."
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

    <VWindow
      v-model="step"
      :touch="false"
      class="register-window"
    >
      <!-- 01 Compte -->
      <VWindowItem :value="0">
        <VForm
          ref="accountForm"
          validate-on="submit"
          @submit.prevent="next"
        >
          <h2 class="text-h6 mb-1">
            Informations du compte
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-5">
            Vous vous connecterez avec cet e-mail et ce mot de passe.
          </p>

          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="account.firstName"
                label="Prénom"
                prepend-inner-icon="ri-user-line"
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
            <VCol cols="12">
              <VTextField
                v-model="account.email"
                label="Adresse e-mail"
                type="email"
                prepend-inner-icon="ri-mail-line"
                autocomplete="email"
                :rules="[required, emailRule]"
                :error-messages="fieldErrors.email"
              />
            </VCol>
            <VCol cols="12">
              <AppPhoneField
                v-model="account.phone"
                required
                hint="Utilisé pour vous joindre et sécuriser votre compte."
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
            <VCol
              cols="12"
              class="pt-0"
            >
              <AppPasswordStrength :password="account.password" />
            </VCol>
          </VRow>

          <div class="d-flex justify-end mt-8">
            <VBtn
              type="submit"
              append-icon="ri-arrow-right-line"
            >
              Continuer
            </VBtn>
          </div>
        </VForm>
      </VWindowItem>

      <!-- 02 Restaurant -->
      <VWindowItem :value="1">
        <VForm
          ref="restaurantForm"
          validate-on="submit"
          @submit.prevent="next"
        >
          <h2 class="text-h6 mb-1">
            Votre restaurant
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-5">
            Affiché sur vos tickets et factures. Vous pourrez tout modifier plus tard.
          </p>

          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="restaurant.name"
                label="Nom du restaurant"
                placeholder="Chez Maman Ngo"
                prepend-inner-icon="ri-restaurant-2-line"
                :rules="[required]"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VCombobox
                v-model="restaurant.city"
                :items="CAMEROON_CITIES"
                label="Ville"
                prepend-inner-icon="ri-map-pin-line"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="restaurant.address"
                label="Quartier, rue"
                placeholder="Akwa, rue Joffre"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="restaurant.samePhone"
                label="Le restaurant se joint au même numéro que moi"
              />
            </VCol>
            <VCol
              v-if="!restaurant.samePhone"
              cols="12"
            >
              <AppPhoneField
                v-model="restaurant.phone"
                label="Téléphone du restaurant"
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
              Continuer
            </VBtn>
          </div>
        </VForm>
      </VWindowItem>

      <!-- 03 Confirmation -->
      <VWindowItem :value="2">
        <h2 class="text-h6 mb-1">
          Tout est prêt 🎉
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
                <VSpacer />
                <VBtn
                  size="x-small"
                  variant="text"
                  @click="step = 0"
                >
                  Modifier
                </VBtn>
              </div>
              <div class="text-body-1 text-high-emphasis">
                {{ account.firstName }} {{ account.lastName }}
              </div>
              <div class="text-body-2 text-medium-emphasis text-truncate">
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
                <VSpacer />
                <VBtn
                  size="x-small"
                  variant="text"
                  @click="step = 1"
                >
                  Modifier
                </VBtn>
              </div>
              <div class="text-body-1 text-high-emphasis">
                {{ restaurant.name }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ [restaurant.address, restaurant.city].filter(Boolean).join(', ') || 'Adresse à compléter' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ restaurantPhone || 'Sans téléphone' }} · FCFA
              </div>
            </VCard>
          </VCol>
        </VRow>

        <VCheckbox
          v-model="accepted"
          class="mt-4"
        >
          <template #label>
            <span class="text-body-2">
              J'accepte les conditions d'utilisation de Marinade et le traitement de mes données
              pour la gestion de mon restaurant.
            </span>
          </template>
        </VCheckbox>

        <div class="d-flex justify-space-between mt-6">
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
            :disabled="!accepted"
            append-icon="ri-check-line"
            @click="finish"
          >
            Créer mon restaurant
          </VBtn>
        </div>
      </VWindowItem>
    </VWindow>

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

<style scoped>
/* Les champs et leurs ombres ne doivent pas être rognés pendant la transition. */
.register-window {
  overflow: visible;
}
</style>
