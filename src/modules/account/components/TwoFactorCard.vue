<script setup lang="ts">
import { useReauth } from '../composables/useReauth'
import { container } from '@/container'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const toast = useToast()
const askConfirm = useConfirm()

const enabled = computed(() => session.user?.two_factor_enabled === true)

// --- Activation -------------------------------------------------------------
// Le mot de passe est redemandé, puis l'assistant en 4 étapes prend le relais (/2fa/setup).
const router = useRouter()
const reauth = useReauth()
const showStart = ref(false)
const startPassword = ref('')

const { submit: start, pending: starting, message: startError } = useSubmit(async () => {
  await reauth.verify(startPassword.value)
  startPassword.value = ''
  showStart.value = false
  await router.push('/2fa/setup')
})

// --- Désactivation ----------------------------------------------------------
const showDisable = ref(false)
const password = ref('')

const { submit: disable, pending: disabling, message: disableError } = useSubmit(async () => {
  if (!(await askConfirm({
    title: 'Désactiver l\'authentification à deux facteurs ?',
    text: 'Votre compte ne sera plus protégé que par votre mot de passe.',
    confirmLabel: 'Supprimer',
    danger: true,
  })))
    return

  await container.auth.disableTwoFactor(password.value)
  session.setUser(await container.account.me())
  showDisable.value = false
  password.value = ''
  toast.success('Authentification à deux facteurs désactivée.')
})
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Authentification à deux facteurs</VCardTitle>
      <VCardSubtitle class="text-wrap">
        Un code de votre téléphone s'ajoute au mot de passe à chaque connexion.
      </VCardSubtitle>
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
          @click="showStart = true"
        >
          Activer la 2FA
        </VBtn>
      </div>
    </VCardText>

    <!-- Activation : confirmation par mot de passe -->
    <VDialog
      v-model="showStart"
      max-width="440"
    >
      <VCard>
        <VCardTitle class="pt-5 px-6">
          Activer la double authentification
        </VCardTitle>
        <VCardText class="px-6">
          <p class="text-body-2 mb-4">
            Confirmez votre identité avec votre mot de passe pour continuer.
          </p>
          <AppPasswordField
            v-model="startPassword"
            label="Mot de passe"
            autocomplete="current-password"
            autofocus
            @keydown.enter.prevent="start"
          />
          <VAlert
            v-if="startError"
            type="error"
            variant="tonal"
            class="mt-3"
          >
            {{ startError }}
          </VAlert>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn
            variant="text"
            color="secondary"
            @click="showStart = false"
          >
            Annuler
          </VBtn>
          <VBtn
            variant="flat"
            :disabled="!startPassword"
            :loading="starting"
            @click="start"
          >
            Continuer
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
