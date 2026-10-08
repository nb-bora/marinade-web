<script setup lang="ts">
import { settingsApi } from '../api'
import { emptyToNull } from '../labels'
import type { PaymentConfiguration, Restaurant } from '../types'
import { container } from '@/container'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime } from '@/lib/format'
import { required } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  restaurant: Restaurant
  canEdit: boolean
}>()

const session = useSessionStore()
const confirm = useConfirm()
const toast = useToast()

const DEFAULT_CREDENTIAL_KEY = 'EASYTRANSACT_API_TOKEN'
const DEFAULT_WEBHOOK_KEY = 'EASYTRANSACT_WEBHOOK_SECRET'

interface Draft {
  enabled: boolean
  service_code: string
  provider_account_ref: string
  success_url: string
  failure_url: string
  webhook_url: string
  credential_env_key: string
  webhook_secret_env_key: string
}

const initial = (): Draft => ({
  enabled: true,
  service_code: 'DEPOSIT',
  provider_account_ref: '',
  success_url: '',
  failure_url: '',
  webhook_url: '',
  credential_env_key: DEFAULT_CREDENTIAL_KEY,
  webhook_secret_env_key: DEFAULT_WEBHOOK_KEY,
})

const draft = ref<Draft>(initial())
const saved = ref<PaymentConfiguration | null>(null)
const form = ref()

// Changer de restaurant repart d'un formulaire neuf : jamais la configuration d'un autre.
watch(() => props.restaurant.id, () => {
  draft.value = initial()
  saved.value = null
})

/** Seul un administrateur de la plateforme peut désigner d'autres variables que celles par défaut. */
const canChooseKeys = computed(() => session.isPlatformAdmin)

const httpsUrl = (value: unknown) =>
  String(value ?? '').trim() === '' || /^https:\/\/\S+$/i.test(String(value).trim()) || 'L\'adresse doit commencer par https://.'

const credentialKey = (value: unknown) =>
  new RegExp(`^${DEFAULT_CREDENTIAL_KEY}(?:_[A-Z0-9]+)*$`).test(String(value ?? ''))
  || `Le nom doit être ${DEFAULT_CREDENTIAL_KEY} ou ${DEFAULT_CREDENTIAL_KEY}_SUFFIXE.`

const webhookKey = (value: unknown) =>
  new RegExp(`^${DEFAULT_WEBHOOK_KEY}(?:_[A-Z0-9]+)*$`).test(String(value ?? ''))
  || `Le nom doit être ${DEFAULT_WEBHOOK_KEY} ou ${DEFAULT_WEBHOOK_KEY}_SUFFIXE.`

const { submit: send, pending, apiError, message: failure, reset } = useSubmit(async () => {
  saved.value = await settingsApi.savePaymentConfiguration({
    restaurant_id: props.restaurant.id,
    enabled: draft.value.enabled,
    service_code: draft.value.service_code.trim(),
    provider_account_ref: emptyToNull(draft.value.provider_account_ref),
    success_url: emptyToNull(draft.value.success_url),
    failure_url: emptyToNull(draft.value.failure_url),
    webhook_url: emptyToNull(draft.value.webhook_url),
    credential_env_key: draft.value.credential_env_key.trim(),
    webhook_secret_env_key: draft.value.webhook_secret_env_key.trim(),
  })
  toast.success('Configuration des paiements enregistrée.')
})

const errorMessage = computed(() =>
  apiError.value?.kind === 'forbidden'
    ? 'Vous n\'avez pas le droit de modifier cette configuration. Les variables des identifiants secrets sont réservées à l\'administrateur de la plateforme.'
    : failure.value,
)

async function submit() {
  if (!(await form.value?.validate())?.valid)
    return

  if (!await confirm({
    title: 'Enregistrer la configuration des paiements ?',
    text: 'Les paiements du restaurant seront réglés avec ces paramètres.',
    confirmLabel: 'Enregistrer',
  }))
    return

  reset()
  await send()
}

/** Adresse que l'opérateur doit enregistrer chez Easy Transact pour recevoir les notifications. */
const notificationAddress = computed(() => {
  const configured = container.config.apiBaseUrl
  const base = configured.startsWith('http') ? configured : `${window.location.origin}${configured}`

  return `${base.replace(/\/$/, '')}/v1/payments/easytransact/webhook/${props.restaurant.id}`
})

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.info(`${what} copié.`)
  }
  catch {
    toast.warning('Copie impossible : recopiez-le à la main.')
  }
}
</script>

<template>
  <VForm
    ref="form"
    validate-on="submit"
    @submit.prevent="submit"
  >
    <VRow>
      <VCol
        cols="12"
        lg="7"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>Paiement Mobile Money (Easy Transact)</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Orange Money et MTN MoMo, encaissés par Easy Transact.
            </VCardSubtitle>
            <template #append>
              <VSwitch
                v-model="draft.enabled"
                color="primary"
                hide-details
                density="compact"
                :label="draft.enabled ? 'Activé' : 'Désactivé'"
                aria-label="Paiements Easy Transact activés"
                :readonly="!canEdit"
              />
            </template>
          </VCardItem>

          <VCardText>
            <VAlert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-6"
            >
              Le serveur ne renvoie pas la configuration déjà enregistrée : renseignez ici tous les champs.
              L'enregistrement remplace la configuration précédente.
            </VAlert>

            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="draft.service_code"
                  label="Code du service"
                  prepend-inner-icon="ri-code-line"
                  maxlength="50"
                  hint="Fourni par Easy Transact."
                  persistent-hint
                  :rules="[required]"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="draft.provider_account_ref"
                  label="Compte marchand"
                  prepend-inner-icon="ri-bank-line"
                  maxlength="255"
                  hint="Votre référence chez Easy Transact."
                  persistent-hint
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="draft.success_url"
                  label="Page après un paiement réussi"
                  prepend-inner-icon="ri-link"
                  placeholder="https://…"
                  type="url"
                  maxlength="500"
                  :rules="[httpsUrl]"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="draft.failure_url"
                  label="Page après un paiement échoué"
                  prepend-inner-icon="ri-link"
                  placeholder="https://…"
                  type="url"
                  maxlength="500"
                  :rules="[httpsUrl]"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="draft.webhook_url"
                  label="Adresse de notification (optionnelle)"
                  prepend-inner-icon="ri-notification-3-line"
                  placeholder="https://…"
                  type="url"
                  maxlength="500"
                  hint="Laissez vide pour utiliser l'adresse de Marinade."
                  persistent-hint
                  :rules="[httpsUrl]"
                  :readonly="!canEdit"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="5"
      >
        <VCard class="mb-6">
          <VCardItem>
            <VCardTitle>Identifiants secrets</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Jamais saisis ni affichés ici.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <p class="text-body-2 mb-4">
              Le jeton d'API et le secret des notifications sont conservés sur le serveur par l'équipe technique.
              Cet écran ne peut ni les lire ni les modifier.
            </p>

            <template v-if="canChooseKeys">
              <VTextField
                v-model="draft.credential_env_key"
                label="Variable du jeton d'API"
                prepend-inner-icon="ri-key-2-line"
                class="mb-2"
                :rules="[credentialKey]"
                :readonly="!canEdit"
              />
              <VTextField
                v-model="draft.webhook_secret_env_key"
                label="Variable du secret des notifications"
                prepend-inner-icon="ri-key-2-line"
                :rules="[webhookKey]"
                :readonly="!canEdit"
              />
            </template>
            <p
              v-else
              class="text-body-2 text-medium-emphasis mb-0"
            >
              Seul un administrateur de la plateforme peut désigner d'autres identifiants que ceux par défaut.
            </p>
          </VCardText>
        </VCard>

        <VCard class="mb-6">
          <VCardItem>
            <VCardTitle>Adresse de notification de Marinade</VCardTitle>
            <VCardSubtitle class="text-wrap">
              À communiquer à Easy Transact pour suivre les paiements.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex align-center gap-2">
              <code class="text-body-2 text-break flex-grow-1">{{ notificationAddress }}</code>
              <IconBtn
                aria-label="Copier l'adresse de notification"
                @click="copy(notificationAddress, 'Adresse')"
              >
                <VIcon icon="ri-file-copy-line" />
              </IconBtn>
            </div>
          </VCardText>
        </VCard>

        <VCard v-if="saved">
          <VCardItem>
            <VCardTitle>Configuration enregistrée</VCardTitle>
            <VCardSubtitle class="text-wrap">
              {{ formatDateTime(saved.updated_at) }}
            </VCardSubtitle>
            <template #append>
              <AppStatusChip
                :label="saved.enabled ? 'Activée' : 'Désactivée'"
                :tone="saved.enabled ? 'success' : 'neutral'"
              />
            </template>
          </VCardItem>
          <VCardText>
            <div class="text-caption text-medium-emphasis">
              Préfixe de référence (attribué par le serveur)
            </div>
            <div class="d-flex align-center gap-2">
              <code class="text-subtitle-1">{{ saved.vendor_reference_prefix }}</code>
              <IconBtn
                aria-label="Copier le préfixe de référence"
                @click="copy(saved.vendor_reference_prefix, 'Préfixe')"
              >
                <VIcon icon="ri-file-copy-line" />
              </IconBtn>
            </div>
            <p class="text-body-2 text-medium-emphasis mt-2 mb-0">
              Il commence toutes les références de paiement de ce restaurant et ne change jamais.
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VAlert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mt-6"
    >
      {{ errorMessage }}
    </VAlert>

    <div
      v-if="canEdit"
      class="d-flex justify-end mt-6"
    >
      <VBtn
        type="submit"
        :loading="pending"
      >
        Enregistrer la configuration
      </VBtn>
    </div>
  </VForm>
</template>
