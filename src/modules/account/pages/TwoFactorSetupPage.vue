<script setup lang="ts">
import QRCode from 'qrcode'
import RecoveryCodesGrid from '../components/RecoveryCodesGrid.vue'
import { useReauth } from '../composables/useReauth'
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import type { TwoFactorSetup } from '@/lib/api/types'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const toast = useToast()
const router = useRouter()
const reauth = useReauth()

const STEPS = [
  { title: 'Scanner', subtitle: 'Application' },
  { title: 'Vérifier', subtitle: 'Un code' },
  { title: 'Codes de secours', subtitle: 'À conserver' },
  { title: 'Terminé', subtitle: 'Protection active' },
]

const step = ref(0)
const setup = ref<TwoFactorSetup | null>(null)
const qrDataUrl = ref('')
const code = ref('')
const savedCodes = ref(false)

const { submit: start, pending: starting, message: startError } = useSubmit(async () => {
  setup.value = await container.auth.setupTwoFactor()
  qrDataUrl.value = await QRCode.toDataURL(setup.value.qr_code_url, { margin: 1, width: 220 })
})

// La page n'est ouverte qu'après avoir saisi son mot de passe depuis « Mon compte ».
onMounted(() => {
  if (session.user?.two_factor_enabled || !reauth.isRecent())
    router.replace('/account?tab=security')
  else
    start()
})

const { submit: verify, pending: verifying, message: verifyError } = useSubmit(async () => {
  await container.auth.confirmTwoFactor(code.value.replace(/\s/g, ''))
  session.setUser(await container.account.me())
  reauth.forget()
  step.value = 2
})

function finish() {
  toast.success('Authentification à deux facteurs activée.')
  router.replace('/account?tab=security')
}

function onEnter() {
  if (step.value === 1 && code.value.trim().length >= 6)
    verify()
}
</script>

<template>
  <div
    class="mx-auto"
    style="max-inline-size: 640px;"
  >
    <AppPageHeader
      title="Activer la double authentification"
      :subtitle="`Étape ${step + 1} sur ${STEPS.length}`"
    />

    <VCard>
      <VCardText class="pa-6">
        <AppStepper
          :steps="STEPS"
          :current="step"
          class="mb-8"
        />

        <VAlert
          v-if="startError"
          type="error"
          variant="tonal"
        >
          {{ startError }}
        </VAlert>

        <div
          v-else-if="!setup || starting"
          class="text-center pa-8"
        >
          <VProgressCircular indeterminate />
        </div>

        <template v-else>
          <!-- Étape 1 : QR -->
          <div v-if="step === 0">
            <p class="text-body-1 mb-4">
              Ouvrez une application d'authentification (Google Authenticator, Authy, Microsoft Authenticator...)
              et scannez ce code.
            </p>
            <div class="d-flex flex-column align-center gap-2 mb-4">
              <img
                :src="qrDataUrl"
                alt="Code QR de configuration à scanner avec votre application d'authentification"
                width="220"
                height="220"
              >
              <span class="text-caption text-medium-emphasis">Impossible de scanner ? Saisissez cette clé :</span>
              <code class="text-caption text-wrap text-break">{{ setup.secret }}</code>
            </div>
            <div class="d-flex justify-space-between">
              <VBtn
                variant="outlined"
                color="secondary"
                to="/account?tab=security"
              >
                Annuler
              </VBtn>
              <VBtn
                append-icon="ri-arrow-right-line"
                @click="step = 1"
              >
                J'ai scanné le code
              </VBtn>
            </div>
          </div>

          <!-- Étape 2 : code -->
          <div v-else-if="step === 1">
            <p class="text-body-1 mb-4">
              Saisissez le code à 6 chiffres que l'application affiche maintenant.
            </p>
            <VTextField
              v-model="code"
              label="Code à 6 chiffres"
              inputmode="numeric"
              autocomplete="one-time-code"
              autofocus
              @keydown.enter.prevent="onEnter"
            />
            <VAlert
              v-if="verifyError"
              type="error"
              variant="tonal"
              class="mt-3"
            >
              {{ verifyError }}
            </VAlert>
            <div class="d-flex justify-space-between mt-6">
              <VBtn
                variant="outlined"
                color="secondary"
                prepend-icon="ri-arrow-left-line"
                @click="step = 0"
              >
                Précédent
              </VBtn>
              <VBtn
                :disabled="code.trim().length < 6"
                :loading="verifying"
                @click="verify"
              >
                Vérifier le code
              </VBtn>
            </div>
          </div>

          <!-- Étape 3 : codes de secours -->
          <div v-else-if="step === 2">
            <p class="text-body-1 mb-4">
              Conservez ces codes en lieu sûr. Chacun ne sert qu'une fois si vous perdez votre téléphone.
            </p>
            <RecoveryCodesGrid
              :codes="setup.recovery_codes"
              class="mb-4"
            />
            <VCheckbox
              v-model="savedCodes"
              label="J'ai conservé mes codes de secours"
            />
            <div class="d-flex justify-end mt-4">
              <VBtn
                :disabled="!savedCodes"
                append-icon="ri-arrow-right-line"
                @click="step = 3"
              >
                Continuer
              </VBtn>
            </div>
          </div>

          <!-- Étape 4 : confirmation -->
          <div
            v-else
            class="text-center"
          >
            <VAvatar
              color="success"
              variant="tonal"
              size="72"
              class="mb-4"
            >
              <VIcon
                icon="ri-shield-check-line"
                size="36"
              />
            </VAvatar>
            <h2 class="text-h6 mb-2">
              Votre compte est mieux protégé
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-6">
              À chaque connexion, un code de votre application s'ajoutera au mot de passe.
            </p>
            <VBtn @click="finish">
              Retour à mon compte
            </VBtn>
          </div>
        </template>
      </VCardText>
    </VCard>
  </div>
</template>
