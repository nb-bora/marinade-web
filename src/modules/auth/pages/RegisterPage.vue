<script setup lang="ts">
import { registrationApi } from '../api'
import type { PublicTier } from '../api'
import { container } from '@/container'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import { CAMEROON_CITIES } from '@/lib/phone'
import { PATHS } from '@/lib/router/paths'
import { email as emailRule, minLength, positiveNumber, required, sameAs } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const tenant = useTenantStore()
const router = useRouter()
const toast = useToast()

const STEPS = [
  { title: 'Bienvenue', subtitle: 'Votre rôle' },
  { title: 'Compte', subtitle: 'Vos identifiants' },
  { title: 'Restaurant', subtitle: 'Votre établissement' },
  { title: 'Abonnement', subtitle: 'Votre offre' },
  { title: 'Confirmation', subtitle: 'Vérifier et créer' },
]

// Après la confirmation : vérification du téléphone (hors de la barre de progression).
const PHONE_STEP = STEPS.length

const CUISINES = ['Camerounaise', 'Africaine', 'Française', 'Fusion', 'Italienne', 'Libanaise', 'Asiatique', 'Grillades et braise', 'Fruits de mer', 'Rapide (fast-food)', 'Pâtisserie et café']

const CURRENCIES = [
  { title: 'FCFA (CEMAC)', value: 'XAF' },
  { title: 'FCFA (UEMOA)', value: 'XOF' },
  { title: 'Euro', value: 'EUR' },
  { title: 'Dollar américain', value: 'USD' },
]

const ROLES = [
  { value: 'owner', title: 'Je suis propriétaire', text: 'Je possède le restaurant et je gère mon abonnement.', icon: 'ri-store-2-line' },
  { value: 'manager', title: 'Je suis manager', text: 'Je dirige le restaurant au quotidien pour son propriétaire.', icon: 'ri-user-star-line' },
] as const

const step = ref(0)
const accountForm = ref()
const restaurantForm = ref()

const declaredRole = ref<'owner' | 'manager'>('owner')

const account = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmation: '',
})

const restaurant = reactive({
  logoUrl: '',
  name: '',
  description: '',
  cuisine: '',
  city: '',
  phone: '',
  address: '',
  samePhone: true,
  tables: '',
  currency: 'XAF',
  several: false,
})

const tierId = ref<number | null>(null)
const showConfirmation = ref(false)
const accepted = ref(false)
const pending = ref(false)
const error = ref('')
const logoError = ref('')
const fieldErrors = ref<Record<string, string>>({})

const normalizedEmail = computed(() => account.email.trim().toLowerCase())
const restaurantPhone = computed(() => (restaurant.samePhone ? account.phone : restaurant.phone))
const roleLabel = computed(() => ROLES.find(item => item.value === declaredRole.value)?.title ?? '')

/** « Étape 2 sur 4 » : la bienvenue n'est pas comptée. */
const progress = computed(() => step.value >= 1 && step.value <= 4 ? `Étape ${step.value} sur 4` : '')

// Une erreur du serveur sur un champ disparaît dès que l'on corrige ce champ.
watch(() => [account.email, account.phone], () => {
  fieldErrors.value = {}
})

// --- Offres ----------------------------------------------------------------------------------

const { data: tiersData, loading: tiersLoading, error: tiersError, reload: reloadTiers } = useAsyncData(signal => registrationApi.tiers(signal))

const tiers = computed<PublicTier[]>(() =>
  (tiersData.value ?? []).filter(item => item.is_active).sort((a, b) => a.monthly_price_fcfa - b.monthly_price_fcfa).slice(0, 3))

const chosenTier = computed(() => tiers.value.find(item => item.id === tierId.value) ?? null)

// --- Logo ------------------------------------------------------------------------------------

/** Le logo envoyé est réduit à 256 px : l'API le stocke tel quel, il doit rester léger. */
async function onLogo(files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files

  logoError.value = ''
  if (!file)
    return

  if (!file.type.startsWith('image/')) {
    logoError.value = 'Choisissez une image (PNG, JPG ou WebP).'

    return
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')

    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    restaurant.logoUrl = canvas.toDataURL('image/png')
  }
  catch {
    logoError.value = 'Cette image n\'a pas pu être lue.'
  }
}

// --- Navigation ------------------------------------------------------------------------------

async function next() {
  if (step.value === 1) {
    // La confirmation du mot de passe n'apparaît qu'à la demande : on la montre avant de continuer.
    if (!showConfirmation.value) {
      showConfirmation.value = true
      await nextTick()
      await accountForm.value?.validate()

      return
    }

    if (!accepted.value) {
      error.value = 'Acceptez les conditions d\'utilisation pour continuer.'

      return
    }

    error.value = ''
  }

  const form = step.value === 1 ? accountForm.value : step.value === 2 ? restaurantForm.value : null

  if (form && !(await form.validate())?.valid)
    return

  if (step.value < 4)
    step.value++
}

function back() {
  error.value = ''
  step.value = Math.max(0, step.value - 1)
}

// --- Création --------------------------------------------------------------------------------

/**
 * Crée le compte, ouvre la session, puis crée le restaurant. Si le compte existe déjà
 * (e-mail ou téléphone pris), on revient à l'étape « Compte » sur le champ en cause.
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

    step.value = 1

    return
  }

  try {
    await session.login({ email: normalizedEmail.value, password: account.password }, true)
    await container.account.createRestaurant({
      name: restaurant.name.trim(),
      description: restaurant.description.trim() || undefined,
      logo_url: restaurant.logoUrl.trim() || undefined,
      city: restaurant.city?.trim() || undefined,
      country: 'Cameroun',
      currency: restaurant.currency,
      phone: restaurantPhone.value || undefined,
      address: restaurant.address.trim() || undefined,

      // Le serveur n'a pas de champ dédié pour ces choix : on les garde dans la configuration libre.
      config_jsonb: {
        type_cuisine: restaurant.cuisine.trim() || undefined,
        nombre_tables: restaurant.tables ? Number(restaurant.tables) : undefined,
        plusieurs_restaurants: restaurant.several,
        role_declare: declaredRole.value,
        offre_souhaitee: chosenTier.value ? { id: chosenTier.value.id, nom: chosenTier.value.name } : undefined,
      },
    })
    await tenant.reload()
    step.value = PHONE_STEP
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

// --- Vérification du téléphone ---------------------------------------------------------------

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const codeSent = ref(false)
const codeReceived = ref(false)
const devCode = ref('')
const smsCode = ref('')

/** Entre dans l'application, puis propose la visite guidée du tableau de bord. */
async function enter() {
  toast.success(`Bienvenue sur Marinade, ${account.firstName.trim()} !`)
  await router.replace(PATHS.home)

  // La visite appartient au gabarit de l'application : on déclenche son bouton dès qu'il est affiché.
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 150))

    const button = document.querySelector<HTMLElement>('[aria-label="Découvrir cette page"]')

    if (button) {
      button.click()

      return
    }
  }
}

const { submit: sendCode, pending: sending, message: sendError } = useSubmit(async () => {
  const response = await registrationApi.sendPhoneCode()

  devCode.value = isLocal ? response.verification_code ?? '' : ''
  codeSent.value = true
})

const { submit: verifyCode, pending: verifying, message: verifyError } = useSubmit(async () => {
  await registrationApi.verifyPhone(smsCode.value.replace(/\s/g, ''))
  session.setUser(await container.account.me())
  toast.success('Téléphone vérifié.')
  await enter()
})
</script>

<template>
  <AuthShell
    title="L'aventure commence ici 🚀"
    subtitle="Quelques minutes pour ouvrir votre restaurant sur Marinade. C'est gratuit et sans engagement."
    wide
  >
    <VAlert
      v-if="step < PHONE_STEP"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-6"
      icon="ri-login-circle-line"
    >
      Déjà inscrit ?
      <RouterLink
        to="/login"
        class="text-primary font-weight-medium"
      >
        Se connecter
      </RouterLink>
    </VAlert>

    <template v-if="step < PHONE_STEP">
      <AppStepper
        :steps="STEPS"
        :current="step"
        class="mb-2"
      />
      <p
        class="text-caption text-medium-emphasis text-center mb-6"
        aria-live="polite"
      >
        {{ progress || 'Bienvenue' }}
      </p>
    </template>

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
      <!-- 00 Bienvenue -->
      <VWindowItem :value="0">
        <div class="text-center mb-6">
          <div
            class="welcome-art mx-auto mb-4"
            aria-hidden="true"
          >
            <VIcon
              icon="ri-restaurant-2-line"
              size="44"
              color="primary"
            />
            <VIcon
              icon="ri-bar-chart-box-line"
              size="22"
              color="success"
              class="welcome-art__orbit welcome-art__orbit--1"
            />
            <VIcon
              icon="ri-qr-code-line"
              size="22"
              color="warning"
              class="welcome-art__orbit welcome-art__orbit--2"
            />
            <VIcon
              icon="ri-wallet-3-line"
              size="22"
              color="info"
              class="welcome-art__orbit welcome-art__orbit--3"
            />
          </div>
          <h2 class="text-h6 mb-1">
            Gérez votre restaurant sereinement
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Salle, cuisine, caisse, stock et réservations au même endroit, du téléphone à l'écran de la caisse.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Votre rôle"
        >
          <VRow>
            <VCol
              v-for="role in ROLES"
              :key="role.value"
              cols="12"
              sm="6"
            >
              <VCard
                :variant="declaredRole === role.value ? 'tonal' : 'outlined'"
                :color="declaredRole === role.value ? 'primary' : undefined"
                class="pa-4 h-100 role-card"
                role="radio"
                :aria-checked="declaredRole === role.value"
                tabindex="0"
                @click="declaredRole = role.value"
                @keydown.enter.prevent="declaredRole = role.value"
                @keydown.space.prevent="declaredRole = role.value"
              >
                <VIcon
                  :icon="role.icon"
                  size="28"
                  class="mb-2"
                />
                <div class="text-subtitle-1 font-weight-semibold">
                  {{ role.title }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ role.text }}
                </div>
              </VCard>
            </VCol>
          </VRow>
        </div>

        <div class="d-flex justify-end mt-8">
          <VBtn
            append-icon="ri-arrow-right-line"
            @click="step = 1"
          >
            Commencer
          </VBtn>
        </div>
      </VWindowItem>

      <!-- 01 Compte -->
      <VWindowItem :value="1">
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
                aria-label="Prénom"
                prepend-inner-icon="ri-user-line"
                autocomplete="given-name"
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
                aria-label="Nom"
                prepend-inner-icon="ri-user-line"
                autocomplete="family-name"
                :rules="[required]"
                :error-messages="fieldErrors.last_name"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="account.email"
                label="Adresse e-mail"
                aria-label="Adresse e-mail"
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
                aria-label="Téléphone mobile"
                required
                hint="Utilisé pour vous joindre et sécuriser votre compte."
                :error-messages="fieldErrors.phone"
              />
            </VCol>
            <VCol cols="12">
              <AppPasswordStrength
                :password="account.password"
                class="mb-3"
              />
              <AppPasswordField
                v-model="account.password"
                label="Mot de passe"
                aria-label="Mot de passe"
                autocomplete="new-password"
                :rules="[required, minLength(12)]"
                :error-messages="fieldErrors.password"
              />
            </VCol>
            <VCol cols="12">
              <VBtn
                v-if="!showConfirmation"
                variant="text"
                size="small"
                prepend-icon="ri-lock-password-line"
                :disabled="!account.password"
                @click="showConfirmation = true"
              >
                Confirmer le mot de passe
              </VBtn>
              <AppPasswordField
                v-else
                v-model="account.confirmation"
                label="Confirmer le mot de passe"
                aria-label="Confirmer le mot de passe"
                autocomplete="new-password"
                autofocus
                :rules="[required, sameAs(() => account.password, 'Les mots de passe ne correspondent pas.')]"
              />
            </VCol>
            <VCol
              cols="12"
              class="pt-0"
            >
              <VCheckbox
                v-model="accepted"
                density="compact"
                hide-details
              >
                <template #label>
                  <span class="text-body-2">
                    J'accepte les
                    <RouterLink
                      to="/terms"
                      target="_blank"
                      class="text-primary"
                      @click.stop
                    >conditions d'utilisation</RouterLink>
                    et la
                    <RouterLink
                      to="/privacy"
                      target="_blank"
                      class="text-primary"
                      @click.stop
                    >politique de confidentialité</RouterLink>.
                  </span>
                </template>
              </VCheckbox>
            </VCol>
          </VRow>

          <div class="d-flex justify-space-between mt-8">
            <VBtn
              variant="outlined"
              color="secondary"
              prepend-icon="ri-arrow-left-line"
              @click="back"
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

      <!-- 02 Restaurant -->
      <VWindowItem :value="2">
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
            <VCol
              cols="12"
              class="d-flex align-center gap-4"
            >
              <VAvatar
                size="64"
                rounded
                color="primary"
                variant="tonal"
              >
                <VImg
                  v-if="restaurant.logoUrl"
                  :src="restaurant.logoUrl"
                  alt="Logo du restaurant"
                />
                <VIcon
                  v-else
                  icon="ri-image-add-line"
                  size="28"
                />
              </VAvatar>
              <VFileInput
                label="Logo (image)"
                aria-label="Logo du restaurant, image"
                accept="image/*"
                prepend-icon=""
                prepend-inner-icon="ri-upload-2-line"
                hide-details="auto"
                :error-messages="logoError"
                @update:model-value="onLogo"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model.trim="restaurant.logoUrl"
                label="ou adresse web du logo"
                aria-label="Adresse web du logo"
                placeholder="https://..."
                prepend-inner-icon="ri-link"
                type="url"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="restaurant.name"
                label="Nom du restaurant"
                aria-label="Nom du restaurant"
                placeholder="Chez Maman Ngo"
                prepend-inner-icon="ri-restaurant-2-line"
                :rules="[required]"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="restaurant.description"
                label="Description"
                aria-label="Description du restaurant"
                rows="2"
                auto-grow
                counter="300"
                maxlength="300"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VCombobox
                v-model="restaurant.cuisine"
                :items="CUISINES"
                label="Type de cuisine"
                aria-label="Type de cuisine"
                prepend-inner-icon="ri-service-line"
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
                aria-label="Ville"
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
                aria-label="Adresse du restaurant"
                prepend-inner-icon="ri-map-2-line"
                placeholder="Akwa, rue Joffre"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="restaurant.tables"
                label="Nombre de tables"
                aria-label="Nombre de tables"
                type="number"
                min="1"
                inputmode="numeric"
                prepend-inner-icon="ri-table-line"
                :rules="[positiveNumber]"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="restaurant.currency"
                :items="CURRENCIES"
                label="Devise"
                aria-label="Devise"
                prepend-inner-icon="ri-money-dollar-circle-line"
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
                aria-label="Téléphone du restaurant"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="restaurant.several"
                label="Je compte créer plusieurs restaurants"
                hint="Vous pourrez les gérer ensemble avec la vue « Groupe »."
                persistent-hint
              />
            </VCol>
          </VRow>

          <div class="d-flex justify-space-between mt-8">
            <VBtn
              variant="outlined"
              color="secondary"
              prepend-icon="ri-arrow-left-line"
              @click="back"
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

      <!-- 03 Abonnement -->
      <VWindowItem :value="3">
        <h2 class="text-h6 mb-1">
          Choisissez votre offre
        </h2>
        <p class="text-body-2 text-medium-emphasis mb-5">
          Le plafond est le montant maximum que vous pouvez encaisser chaque jour. Vous pourrez changer d'offre plus tard.
        </p>

        <VSkeletonLoader
          v-if="tiersLoading && !tiersData"
          type="card"
        />
        <VAlert
          v-else-if="tiersError"
          type="warning"
          variant="tonal"
        >
          Les offres ne se chargent pas pour le moment. Vous pouvez continuer : l'offre se choisit aussi après l'inscription.
          <VBtn
            size="small"
            variant="text"
            class="ms-2"
            @click="reloadTiers"
          >
            Réessayer
          </VBtn>
        </VAlert>
        <div
          v-else
          role="radiogroup"
          aria-label="Offres d'abonnement"
        >
          <VRow>
            <VCol
              v-for="tier in tiers"
              :key="tier.id"
              cols="12"
              sm="4"
            >
              <VCard
                :variant="tierId === tier.id ? 'tonal' : 'outlined'"
                :color="tierId === tier.id ? 'primary' : undefined"
                class="pa-4 h-100 role-card"
                role="radio"
                :aria-checked="tierId === tier.id"
                tabindex="0"
                @click="tierId = tier.id"
                @keydown.enter.prevent="tierId = tier.id"
                @keydown.space.prevent="tierId = tier.id"
              >
                <div class="text-subtitle-1 font-weight-semibold mb-1">
                  {{ tier.name }}
                </div>
                <div class="text-h5 mb-1">
                  {{ formatMoney(tier.monthly_price_fcfa) }}
                  <span class="text-caption text-medium-emphasis">/ mois</span>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Jusqu'à {{ formatMoney(tier.daily_limit_fcfa) }} encaissés par jour
                </div>
                <div class="text-caption text-medium-emphasis mt-2">
                  {{ formatMoney(tier.annual_price_fcfa) }} par an
                </div>
              </VCard>
            </VCol>
          </VRow>
          <p
            v-if="tiers.length === 0"
            class="text-body-2 text-medium-emphasis"
          >
            Aucune offre n'est proposée pour le moment.
          </p>
        </div>

        <div class="d-flex justify-space-between align-center flex-wrap gap-2 mt-8">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            @click="back"
          >
            Précédent
          </VBtn>
          <div class="d-flex gap-2">
            <VBtn
              variant="text"
              @click="step = 4"
            >
              Passer
            </VBtn>
            <VBtn
              append-icon="ri-arrow-right-line"
              :disabled="tierId === null"
              @click="step = 4"
            >
              Créer un compte avec cette offre
            </VBtn>
          </div>
        </div>
      </VWindowItem>

      <!-- 04 Confirmation -->
      <VWindowItem :value="4">
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
                  @click="step = 1"
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
              <div class="text-body-2 text-medium-emphasis">
                {{ roleLabel }}
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
                  @click="step = 2"
                >
                  Modifier
                </VBtn>
              </div>
              <div class="text-body-1 text-high-emphasis">
                {{ restaurant.name }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ [restaurant.cuisine, restaurant.city].filter(Boolean).join(' · ') || 'Cuisine et ville à compléter' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ restaurant.address || 'Adresse à compléter' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ restaurantPhone || 'Sans téléphone' }} · {{ restaurant.currency === 'XAF' || restaurant.currency === 'XOF' ? 'FCFA' : restaurant.currency }}
              </div>
            </VCard>
          </VCol>
          <VCol cols="12">
            <VCard
              variant="tonal"
              class="pa-4"
            >
              <div class="d-flex align-center gap-2">
                <VIcon icon="ri-price-tag-3-line" />
                <span class="font-weight-semibold">Offre</span>
                <VSpacer />
                <VBtn
                  size="x-small"
                  variant="text"
                  @click="step = 3"
                >
                  Modifier
                </VBtn>
              </div>
              <div class="text-body-2 mt-2">
                {{ chosenTier ? `${chosenTier.name} · ${formatMoney(chosenTier.monthly_price_fcfa)} par mois` : 'Aucune offre choisie pour le moment' }}
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
              J'accepte les
              <RouterLink
                to="/terms"
                target="_blank"
                class="text-primary"
                @click.stop
              >conditions d'utilisation</RouterLink>
              de Marinade et le traitement de mes données pour la gestion de mon restaurant.
            </span>
          </template>
        </VCheckbox>

        <div class="d-flex justify-space-between mt-6">
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            :disabled="pending"
            @click="back"
          >
            Précédent
          </VBtn>
          <VBtn
            :loading="pending"
            :disabled="!accepted"
            append-icon="ri-check-line"
            @click="finish"
          >
            Créer mon compte
          </VBtn>
        </div>
      </VWindowItem>

      <!-- Vérification du téléphone -->
      <VWindowItem :value="PHONE_STEP">
        <div class="text-center mb-5">
          <VAvatar
            color="success"
            variant="tonal"
            size="64"
            class="mb-3"
          >
            <VIcon
              icon="ri-smartphone-line"
              size="32"
            />
          </VAvatar>
          <h2 class="text-h6 mb-1">
            Vérifier votre téléphone
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Votre compte est créé. Confirmez le numéro {{ account.phone }} pour recevoir vos codes par SMS.
          </p>
        </div>

        <VAlert
          v-if="devCode"
          type="info"
          variant="tonal"
          class="mb-4"
        >
          Mode développement : le code est <strong>{{ devCode }}</strong>.
        </VAlert>

        <div
          class="d-flex flex-column gap-3 mx-auto"
          style="max-inline-size: 360px;"
        >
          <VBtn
            v-if="!codeSent"
            :loading="sending"
            prepend-icon="ri-message-3-line"
            @click="sendCode"
          >
            Envoyer le code par SMS
          </VBtn>

          <template v-else>
            <VBtn
              v-if="!codeReceived"
              variant="outlined"
              @click="codeReceived = true"
            >
              J'ai reçu un code
            </VBtn>
            <form
              v-else
              class="d-flex flex-column gap-3"
              @submit.prevent="verifyCode"
            >
              <VTextField
                v-model="smsCode"
                label="Code reçu par SMS"
                aria-label="Code reçu par SMS"
                prepend-inner-icon="ri-shield-keyhole-line"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="10"
                autofocus
              />
              <VBtn
                type="submit"
                :loading="verifying"
                :disabled="smsCode.trim().length < 4"
              >
                Vérifier
              </VBtn>
            </form>
          </template>

          <VAlert
            v-if="sendError || verifyError"
            type="error"
            variant="tonal"
            density="compact"
          >
            {{ sendError || verifyError }}
          </VAlert>

          <VBtn
            variant="text"
            color="secondary"
            @click="enter"
          >
            Plus tard
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

.role-card {
  cursor: pointer;
}

.role-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Animation d'accueil : le restaurant au centre, trois pictos qui tournent autour. */
.welcome-art {
  position: relative;
  display: grid;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.08);
  block-size: 120px;
  inline-size: 120px;
  place-items: center;
}

.welcome-art__orbit {
  position: absolute;
  animation: welcome-orbit 9s linear infinite;
  inset-block-start: 50%;
  inset-inline-start: 50%;
}

.welcome-art__orbit--2 {
  animation-delay: -3s;
}

.welcome-art__orbit--3 {
  animation-delay: -6s;
}

@keyframes welcome-orbit {
  from {
    transform: rotate(0deg) translateX(58px) rotate(0deg) translate(-50%, -50%);
  }

  to {
    transform: rotate(360deg) translateX(58px) rotate(-360deg) translate(-50%, -50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-art__orbit {
    animation: none;
  }

  .welcome-art__orbit--1 {
    transform: translate(52px, -30px);
  }

  .welcome-art__orbit--2 {
    transform: translate(-52px, -30px);
  }

  .welcome-art__orbit--3 {
    transform: translate(0, 60px);
  }
}
</style>
