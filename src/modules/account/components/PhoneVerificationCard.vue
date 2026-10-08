<script setup lang="ts">
import { phoneVerificationApi } from '../api'
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { formatDate } from '@/lib/format'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const toast = useToast()

const verifiedAt = computed(() => session.user?.phone_verified_at ?? null)
const verified = computed(() => Boolean(verifiedAt.value))

const codeSent = ref(false)
const code = ref('')

// Délai avant de pouvoir demander un nouveau SMS (évite les envois en rafale).
const RESEND_DELAY = 30
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function startCountdown() {
  countdown.value = RESEND_DELAY
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1

    if (countdown.value <= 0)
      clearInterval(timer)
  }, 1000)
}

onBeforeUnmount(() => clearInterval(timer))

const { submit: verify, pending: verifying, apiError: verifyApiError, message: verifyMessage, reset: resetVerify } = useSubmit(async () => {
  await phoneVerificationApi.verify(code.value.replace(/\s/g, ''))
  session.setUser(await container.account.me())
  codeSent.value = false
  code.value = ''
  toast.success('Téléphone vérifié.')
})

const { submit: send, pending: sending, message: sendError } = useSubmit(async () => {
  resetVerify()
  await phoneVerificationApi.sendCode()
  codeSent.value = true
  code.value = ''
  startCountdown()
  toast.success('Code envoyé par SMS.')
})

const verifyError = computed(() =>
  verifyApiError.value && (verifyApiError.value.kind === 'validation' || verifyApiError.value.kind === 'client')
    ? 'Code incorrect ou expiré. Demandez-en un nouveau si besoin.'
    : verifyMessage.value,
)
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Téléphone</VCardTitle>
      <VCardSubtitle class="text-wrap">
        Un numéro vérifié permet de recevoir vos codes par SMS.
      </VCardSubtitle>
      <template #append>
        <AppStatusChip
          :label="verified ? 'Vérifié' : 'Non vérifié'"
          :tone="verified ? 'success' : 'warning'"
          :icon="verified ? 'ri-shield-check-line' : 'ri-error-warning-line'"
        />
      </template>
    </VCardItem>

    <VCardText>
      <div class="text-body-1 font-weight-medium">
        {{ session.user?.phone }}
      </div>
      <div
        v-if="verified"
        class="text-body-2 text-medium-emphasis"
      >
        Vérifié le {{ formatDate(verifiedAt) }}.
      </div>

      <template v-else>
        <p class="text-body-2 mt-2 mb-4">
          Nous envoyons un code à 6 chiffres par SMS à ce numéro. Il reste valable quelques minutes.
        </p>

        <VBtn
          v-if="!codeSent"
          variant="outlined"
          prepend-icon="ri-message-3-line"
          :loading="sending"
          @click="send"
        >
          Envoyer le code par SMS
        </VBtn>

        <form
          v-else
          class="d-flex flex-column gap-3"
          @submit.prevent="verify"
        >
          <VTextField
            v-model="code"
            label="Code reçu par SMS"
            prepend-inner-icon="ri-shield-keyhole-line"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="10"
            autofocus
          />
          <div class="d-flex flex-wrap align-center gap-2">
            <VBtn
              type="submit"
              :loading="verifying"
              :disabled="code.trim().length < 4"
            >
              Vérifier
            </VBtn>
            <VBtn
              variant="text"
              :loading="sending"
              :disabled="countdown > 0"
              @click="send"
            >
              {{ countdown > 0 ? `Renvoyer le code (${countdown} s)` : 'Renvoyer le code' }}
            </VBtn>
          </div>
        </form>

        <VAlert
          v-if="sendError || verifyError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          {{ verifyError || sendError }}
        </VAlert>
      </template>
    </VCardText>
  </VCard>
</template>
