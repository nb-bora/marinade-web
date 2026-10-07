<script setup lang="ts">
import QRCode from 'qrcode'
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import type { TwoFactorSetup } from '@/lib/api/types'
import { required } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const toast = useToast()

const enabled = computed(() => session.user?.two_factor_enabled === true)

// --- Activation -------------------------------------------------------------
const setup = ref<TwoFactorSetup | null>(null)
const qrDataUrl = ref('')
const code = ref('')
const savedCodes = ref(false)

const showSetup = computed({
  get: () => setup.value !== null,
  set: open => {
    if (!open)
      setup.value = null
  },
})

const { submit: start, pending: starting, message: startError } = useSubmit(async () => {
  setup.value = await container.auth.setupTwoFactor()
  qrDataUrl.value = await QRCode.toDataURL(setup.value.qr_code_url, { margin: 1, width: 220 })
  code.value = ''
  savedCodes.value = false
})

const { submit: confirm, pending: confirming, message: confirmError } = useSubmit(async () => {
  await container.auth.confirmTwoFactor(code.value.replace(/\s/g, ''))
  session.setUser(await container.account.me())
  setup.value = null
  toast.success('Authentification à deux facteurs activée.')
})

async function copyCodes() {
  try {
    await navigator.clipboard.writeText(setup.value?.recovery_codes.join('\n') ?? '')
    toast.info('Codes copiés.')
  }
  catch {
    toast.warning('Copie impossible : recopiez les codes à la main.')
  }
}

// --- Désactivation ----------------------------------------------------------
const showDisable = ref(false)
const password = ref('')

const { submit: disable, pending: disabling, message: disableError } = useSubmit(async () => {
  await container.auth.disableTwoFactor(password.value)
  session.setUser(await container.account.me())
  showDisable.value = false
  password.value = ''
  toast.success('Authentification à deux facteurs désactivée.')
})
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Authentification à deux facteurs</VCardTitle>
      <VCardSubtitle>Un code de votre téléphone s'ajoute au mot de passe à chaque connexion.</VCardSubtitle>
    </VCardItem>

    <VCardText>
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <AppStatusChip
          :label="enabled ? 'Activée' : 'Désactivée'"
          :tone="enabled ? 'success' : 'neutral'"
          :icon="enabled ? 'ri-shield-check-line' : 'ri-shield-line'"
        />

        <VBtn
          v-if="enabled"
          color="error"
          variant="outlined"
          @click="showDisable = true"
        >
          Désactiver
        </VBtn>
        <VBtn
          v-else
          :loading="starting"
          @click="start"
        >
          Activer
        </VBtn>
      </div>

      <VAlert
        v-if="startError"
        type="error"
        variant="tonal"
        class="mt-4"
      >
        {{ startError }}
      </VAlert>
    </VCardText>

    <!-- Activation -->
    <VDialog
      v-model="showSetup"
      max-width="520"
      persistent
    >
      <VCard v-if="setup">
        <VCardTitle class="pt-5 px-6">
          Activer la double authentification
        </VCardTitle>
        <VCardText class="px-6">
          <ol class="text-body-2 ps-4 mb-4">
            <li>Scannez ce code avec une application d'authentification (Google Authenticator, Authy...).</li>
            <li>Conservez les codes de secours ci-dessous, en lieu sûr : chacun ne sert qu'une fois.</li>
            <li>Saisissez le code à 6 chiffres affiché par l'application.</li>
          </ol>

          <div class="d-flex flex-column align-center gap-2 mb-4">
            <img
              :src="qrDataUrl"
              alt="Code QR de configuration"
              width="220"
              height="220"
            >
            <code class="text-caption text-wrap text-break">{{ setup.secret }}</code>
          </div>

          <VCard
            variant="tonal"
            class="pa-3 mb-4"
          >
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">Codes de secours</span>
              <VBtn
                size="x-small"
                variant="text"
                prepend-icon="ri-file-copy-line"
                @click="copyCodes"
              >
                Copier
              </VBtn>
            </div>
            <div class="recovery-grid">
              <code
                v-for="item in setup.recovery_codes"
                :key="item"
              >{{ item }}</code>
            </div>
          </VCard>

          <VCheckbox
            v-model="savedCodes"
            label="J'ai conservé mes codes de secours"
          />

          <VTextField
            v-model="code"
            label="Code à 6 chiffres"
            inputmode="numeric"
            autocomplete="one-time-code"
            :disabled="!savedCodes"
            :rules="[required]"
            @keydown.enter.prevent="savedCodes && confirm()"
          />

          <VAlert
            v-if="confirmError"
            type="error"
            variant="tonal"
            class="mt-3"
          >
            {{ confirmError }}
          </VAlert>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            color="secondary"
            @click="showSetup = false"
          >
            Annuler
          </VBtn>
          <VBtn
            variant="flat"
            :disabled="!savedCodes || code.trim().length < 6"
            :loading="confirming"
            @click="confirm"
          >
            Activer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Désactivation -->
    <VDialog
      v-model="showDisable"
      max-width="440"
    >
      <VCard>
        <VCardTitle class="pt-5 px-6">
          Désactiver la double authentification
        </VCardTitle>
        <VCardText class="px-6">
          <p class="text-body-2 mb-4">
            Confirmez avec votre mot de passe. Votre compte sera moins protégé.
          </p>
          <AppPasswordField
            v-model="password"
            label="Mot de passe"
            autocomplete="current-password"
            autofocus
            @keydown.enter.prevent="disable"
          />
          <VAlert
            v-if="disableError"
            type="error"
            variant="tonal"
            class="mt-3"
          >
            {{ disableError }}
          </VAlert>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            color="secondary"
            @click="showDisable = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            variant="flat"
            :disabled="!password"
            :loading="disabling"
            @click="disable"
          >
            Désactiver
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>

<style scoped>
.recovery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 1rem;
  font-size: 0.8125rem;
}
</style>
