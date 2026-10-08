<script setup lang="ts">
import RecoveryCodesGrid from './RecoveryCodesGrid.vue'
import { container } from '@/container'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const toast = useToast()
const askConfirm = useConfirm()

const enabled = computed(() => session.user?.two_factor_enabled === true)

const showDialog = ref(false)
const password = ref('')
const codes = ref<string[]>([])
const savedCodes = ref(false)

const { submit: regenerate, pending, apiError, message, reset } = useSubmit(async () => {
  if (!(await askConfirm({
    title: 'Générer de nouveaux codes de secours ?',
    text: 'Les anciens codes cesseront de fonctionner immédiatement.',
    confirmLabel: 'Supprimer',
    danger: true,
  })))
    return

  const result = await container.auth.regenerateRecoveryCodes(password.value)

  codes.value = result.recovery_codes
  password.value = ''
  savedCodes.value = false
  toast.success('Nouveaux codes de secours générés.')
})

const errorMessage = computed(() =>
  apiError.value && (apiError.value.kind === 'validation' || apiError.value.kind === 'client')
    ? 'Mot de passe incorrect.'
    : message.value,
)

function open() {
  codes.value = []
  password.value = ''
  savedCodes.value = false
  reset()
  showDialog.value = true
}

function close() {
  showDialog.value = false
  codes.value = []
  password.value = ''
}
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Codes de secours</VCardTitle>
      <VCardSubtitle class="text-wrap">
        Pour vous connecter si vous perdez l'accès à votre application d'authentification.
      </VCardSubtitle>
    </VCardItem>

    <VCardText>
      <p class="text-body-2 mb-4">
        {{ enabled
          ? 'Chaque code ne sert qu\'une fois. Générer de nouveaux codes invalide immédiatement les précédents.'
          : 'Les codes de secours sont créés à l\'activation de la double authentification.' }}
      </p>

      <VBtn
        variant="outlined"
        prepend-icon="ri-key-2-line"
        :disabled="!enabled"
        @click="open"
      >
        Générer de nouveaux codes
      </VBtn>
    </VCardText>

    <VDialog
      v-model="showDialog"
      max-width="480"
      :persistent="codes.length > 0 || pending"
    >
      <VCard>
        <VCardTitle class="pt-5 px-6">
          {{ codes.length ? 'Vos nouveaux codes de secours' : 'Générer de nouveaux codes de secours' }}
        </VCardTitle>

        <VCardText
          v-if="codes.length"
          class="px-6"
        >
          <VAlert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            Ces codes ne seront plus affichés. Conservez-les maintenant, en lieu sûr.
          </VAlert>
          <RecoveryCodesGrid :codes="codes" />
          <VCheckbox
            v-model="savedCodes"
            label="J'ai conservé mes codes de secours"
            class="mt-2"
            hide-details
          />
        </VCardText>

        <VCardText
          v-else
          class="px-6"
        >
          <p class="text-body-2 mb-4">
            Les anciens codes cesseront de fonctionner. Confirmez avec votre mot de passe.
          </p>
          <AppPasswordField
            v-model="password"
            label="Mot de passe"
            autocomplete="current-password"
            autofocus
            @keydown.enter.prevent="password && regenerate()"
          />
          <VAlert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mt-3"
          >
            {{ errorMessage }}
          </VAlert>
        </VCardText>

        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <template v-if="codes.length">
            <VBtn
              variant="flat"
              :disabled="!savedCodes"
              @click="close"
            >
              Terminé
            </VBtn>
          </template>
          <template v-else>
            <VBtn
              variant="text"
              color="secondary"
              :disabled="pending"
              @click="close"
            >
              Annuler
            </VBtn>
            <VBtn
              variant="flat"
              :disabled="!password"
              :loading="pending"
              @click="regenerate"
            >
              Générer
            </VBtn>
          </template>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>
