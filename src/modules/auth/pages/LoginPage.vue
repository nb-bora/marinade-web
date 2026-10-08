<script setup lang="ts">
import { useLoginThrottle } from '../composables/useLoginThrottle'
import { useSubmit } from '@/composables/useSubmit'
import { safeRedirect } from '@/lib/router/paths'
import { email as emailRule, required } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const twoFactorCode = ref('')
const remember = ref(true)
const form = ref()
const throttle = useLoginThrottle()

// La 2FA n'est demandée qu'après un premier essai : le serveur répond alors que le code
// est requis, et on affiche le second champ sans perdre ce qui a été saisi.
const needsCode = ref(false)

const justRegistered = computed(() => route.query.registered === '1')
const justReset = computed(() => route.query.reset === '1')

const { submit, pending, message } = useSubmit(async () => {
  try {
    await session.login(
      { email: email.value, password: password.value, twoFactorCode: twoFactorCode.value.replace(/\s/g, '') },
      remember.value,
    )
  }
  catch (error) {
    if ((error as { details?: { two_factor_required?: boolean } }).details?.two_factor_required) {
      needsCode.value = true

      return false
    }

    throttle.recordFailure(error)
    throw error
  }

  throttle.reset()
  await router.replace(safeRedirect(route.query.redirect))

  return true
})

async function onSubmit() {
  if (throttle.locked.value)
    return

  if ((await form.value?.validate())?.valid)
    await submit()
}
</script>

<template>
  <AuthShell
    title="Bienvenue sur Marinade ! 👋"
    subtitle="Connectez-vous pour retrouver votre restaurant."
  >
    <VAlert
      v-if="justRegistered"
      type="success"
      variant="tonal"
      class="mb-4"
    >
      Compte créé. Vous pouvez vous connecter.
    </VAlert>
    <VAlert
      v-if="justReset"
      type="success"
      variant="tonal"
      class="mb-4"
    >
      Mot de passe modifié. Connectez-vous avec le nouveau.
    </VAlert>

    <VForm
      ref="form"
      validate-on="submit"
      @submit.prevent="onSubmit"
    >
      <VRow>
        <VCol cols="12">
          <VTextField
            v-model="email"
            label="Adresse e-mail"
            type="email"
            prepend-inner-icon="ri-mail-line"
            autocomplete="username"
            autofocus
            :readonly="needsCode"
            :rules="[required, emailRule]"
          />
        </VCol>

        <VCol cols="12">
          <AppPasswordField
            v-model="password"
            label="Mot de passe"
            autocomplete="current-password"
            :readonly="needsCode"
            :rules="[required]"
          />
        </VCol>

        <VCol
          v-if="needsCode"
          cols="12"
        >
          <VTextField
            v-model="twoFactorCode"
            label="Code de vérification"
            prepend-inner-icon="ri-shield-keyhole-line"
            hint="Code à 6 chiffres de votre application d'authentification, ou un code de secours."
            persistent-hint
            autocomplete="one-time-code"
            inputmode="numeric"
            autofocus
            :rules="[required]"
          />
        </VCol>

        <VCol cols="12">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2">
            <VCheckbox
              v-model="remember"
              label="Rester connecté"
            />
            <RouterLink
              to="/forgot-password"
              class="text-primary text-body-2"
            >
              Mot de passe oublié ?
            </RouterLink>
          </div>
        </VCol>

        <VCol
          v-if="throttle.locked.value"
          cols="12"
        >
          <VAlert
            type="warning"
            variant="tonal"
            role="alert"
          >
            Trop d'essais. Patientez {{ throttle.remaining.value }} seconde{{ throttle.remaining.value > 1 ? 's' : '' }} avant de réessayer.
          </VAlert>
        </VCol>

        <VCol
          v-else-if="message"
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
            :disabled="throttle.locked.value"
            :loading="pending"
          >
            {{ needsCode ? 'Valider le code' : 'Se connecter' }}
          </VBtn>
        </VCol>
      </VRow>
    </VForm>

    <template #footer>
      <span class="text-medium-emphasis">Pas encore de compte ?</span>
      <RouterLink
        to="/register"
        class="text-primary ms-1"
      >
        Créer un compte
      </RouterLink>
    </template>
  </AuthShell>
</template>
