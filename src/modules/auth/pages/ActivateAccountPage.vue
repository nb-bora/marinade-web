<script setup lang="ts">
import { useResendCountdown } from '../composables/useResendCountdown'
import { takePendingRestaurant } from '../pendingRestaurant'
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { PATHS } from '@/lib/router/paths'
import { email as emailRule, required } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const CODE_LENGTH = 6
const VALIDITY_MINUTES = 15

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const tenant = useTenantStore()
const toast = useToast()

const emailForm = ref()
const email = ref(typeof route.query.email === 'string' ? route.query.email.trim().toLowerCase() : '')

// On sait où le code est parti dès que l'adresse est connue (inscription, connexion ou lien de l'e-mail).
const hasEmail = ref(email.value !== '')
const code = ref('')

// Remonte le champ du code après une erreur : il se vide et reprend le focus.
const otpKey = ref(0)
const cooldown = useResendCountdown(Number(route.query.wait) || 0)
const resent = ref(false)

const { submit: verify, pending: verifying, message: verifyMessage, apiError: verifyError, reset: resetVerify } = useSubmit(async () => {
  await session.activate(email.value, code.value)

  // L'établissement saisi pendant l'inscription ne pouvait pas être créé avant l'activation.
  const pendingRestaurant = takePendingRestaurant()

  if (pendingRestaurant) {
    try {
      await container.account.createRestaurant(pendingRestaurant)
      await tenant.reload()
    }
    catch {
      toast.warning('Votre compte est activé. Finalisons votre établissement.')
      await router.replace(PATHS.setup)

      return
    }
  }

  toast.success('Compte activé. Bienvenue sur Marinade !')

  // La garde de navigation envoie vers « Finalisons votre établissement » s'il n'y en a pas encore.
  await router.replace(PATHS.home)

  if (pendingRestaurant)
    await startTour()
})

const { submit: resend, pending: resending, message: resendMessage } = useSubmit(async () => {
  const result = await container.auth.resendActivation(email.value)

  cooldown.start(result.resend_available_in_seconds)
  resent.value = true
  resetVerify()
  code.value = ''
  otpKey.value++
})

const attemptsLeft = computed(() => {
  const left = verifyError.value?.details.attempts_left

  return typeof left === 'number' ? left : null
})

const errorText = computed(() => {
  if (!verifyMessage.value)
    return ''

  if (attemptsLeft.value === null)
    return verifyMessage.value

  return `${verifyMessage.value} Il vous reste ${attemptsLeft.value} essai${attemptsLeft.value > 1 ? 's' : ''}.`
})

/** Code périmé ou épuisé : seul un nouveau code peut aider, on met le bouton en avant. */
const needsNewCode = computed(() =>
  ['auth.activation_code_expired', 'auth.activation_too_many_attempts'].includes(verifyError.value?.code ?? ''))

const subtitle = computed(() => hasEmail.value
  ? `Saisissez le code à ${CODE_LENGTH} chiffres envoyé à ${email.value}.`
  : 'Indiquez l\'adresse e-mail de votre compte pour recevoir un code d\'activation.')

async function onFinish() {
  if (code.value.length === CODE_LENGTH)
    await verify()

  // Un code refusé se retape : on vide les cases.
  if (verifyMessage.value) {
    code.value = ''
    otpKey.value++
  }
}

async function onEmailSubmit() {
  if (!(await emailForm.value?.validate())?.valid)
    return

  email.value = email.value.trim().toLowerCase()
  hasEmail.value = true
  await resend()
}

function changeEmail() {
  hasEmail.value = false
  code.value = ''
  resetVerify()
}

/** Propose la visite guidée du tableau de bord, dès que son bouton est affiché par le gabarit. */
async function startTour() {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 150))

    const button = document.querySelector<HTMLElement>('[aria-label="Découvrir cette page"]')

    if (button) {
      button.click()

      return
    }
  }
}
</script>

<template>
  <AuthShell
    title="Activez votre compte ✉️"
    :subtitle="subtitle"
  >
    <VForm
      v-if="!hasEmail"
      ref="emailForm"
      validate-on="submit"
      @submit.prevent="onEmailSubmit"
    >
      <VTextField
        v-model="email"
        label="Adresse e-mail"
        type="email"
        prepend-inner-icon="ri-mail-line"
        autocomplete="email"
        autofocus
        :rules="[required, emailRule]"
      />
      <VBtn
        type="submit"
        block
        size="large"
        class="mt-4"
        :loading="resending"
      >
        Recevoir un code
      </VBtn>
      <VAlert
        v-if="resendMessage"
        type="error"
        variant="tonal"
        class="mt-4"
      >
        {{ resendMessage }}
      </VAlert>
    </VForm>

    <template v-else>
      <VAlert
        type="info"
        variant="tonal"
        density="comfortable"
        icon="ri-mail-send-line"
        class="mb-6"
      >
        {{ resent ? 'Un nouveau code vient d\'être envoyé.' : 'Un code vient de vous être envoyé.' }}
        Il est valable {{ VALIDITY_MINUTES }} minutes. Pensez à regarder dans vos courriers indésirables.
      </VAlert>

      <VOtpInput
        :key="otpKey"
        v-model="code"
        :length="CODE_LENGTH"
        type="number"
        variant="outlined"
        autofocus
        :disabled="verifying"
        :error="!!errorText"
        aria-label="Code d'activation à 6 chiffres"
        @finish="onFinish"
      />

      <VAlert
        v-if="errorText"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mt-4"
      >
        {{ errorText }}
      </VAlert>

      <VAlert
        v-if="resendMessage"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mt-4"
      >
        {{ resendMessage }}
      </VAlert>

      <VBtn
        block
        size="large"
        class="mt-6"
        :loading="verifying"
        :disabled="code.length < CODE_LENGTH"
        @click="onFinish"
      >
        Activer mon compte
      </VBtn>

      <div class="d-flex align-center justify-center flex-wrap gap-1 mt-5">
        <span class="text-body-2 text-medium-emphasis">Vous n'avez rien reçu ?</span>
        <VBtn
          variant="text"
          size="small"
          :color="needsNewCode ? 'primary' : undefined"
          :disabled="!cooldown.ready.value || verifying"
          :loading="resending"
          @click="resend"
        >
          Renvoyer le code
          <template v-if="!cooldown.ready.value">
            &nbsp;({{ cooldown.remaining.value }} s)
          </template>
        </VBtn>
      </div>

      <div class="text-center mt-1">
        <VBtn
          variant="text"
          size="small"
          color="secondary"
          @click="changeEmail"
        >
          Ce n'est pas la bonne adresse ?
        </VBtn>
      </div>
    </template>

    <template #footer>
      <span class="text-medium-emphasis">Compte déjà activé ?</span>
      <RouterLink
        to="/login"
        class="text-primary ms-1"
      >
        Se connecter
      </RouterLink>
    </template>
  </AuthShell>
</template>
