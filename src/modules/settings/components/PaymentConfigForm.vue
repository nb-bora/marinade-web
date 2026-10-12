<script setup lang="ts">
import { settingsApi } from '../api'
import { emptyToNull } from '../labels'
import type { PaymentConfiguration, Restaurant } from '../types'
import { container } from '@/container'
import { useAsyncData } from '@/composables/useAsyncData'
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

// Lecture --------------------------------------------------------------------------------------

const { data: config, loading, error, reload, refresh } = useAsyncData<PaymentConfiguration | null>(
  signal => settingsApi.paymentConfiguration(props.restaurant.id, signal),
  { watch: [() => props.restaurant.id] },
)

/** Adresse que l'opérateur doit enregistrer chez Easy Transact pour recevoir les notifications. */
const notificationAddress = computed(() => {
  const configured = container.config.apiBaseUrl
  const base = configured.startsWith('http') ? configured : `${window.location.origin}${configured}`

  return `${base.replace(/\/$/, '')}/v1/payments/easytransact/webhook/${props.restaurant.id}`
})

const variables = computed(() => {
  if (!config.value)
    return []

  return [
    { label: 'Jeton d’API', name: config.value.credential_env_key, icon: 'ri-key-2-line' },
    { label: 'Secret des notifications', name: config.value.webhook_secret_env_key, icon: 'ri-shield-keyhole-line' },
  ]
})

const urls = computed(() => {
  if (!config.value)
    return []

  return [
    { label: 'Paiement réussi', value: config.value.success_url, icon: 'ri-checkbox-circle-line' },
    { label: 'Paiement échoué', value: config.value.failure_url, icon: 'ri-close-circle-line' },
    { label: 'Notifications (adresse choisie)', value: config.value.webhook_url, icon: 'ri-notification-3-line' },
  ]
})

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copié.`)
  }
  catch {
    toast.warning('Copie impossible : sélectionnez le texte et recopiez-le à la main.')
  }
}

const revealed = ref(false)

// Reconfiguration -------------------------------------------------------------------------------

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

const draftOf = (source: PaymentConfiguration | null): Draft => ({
  enabled: source?.enabled ?? true,
  service_code: source?.service_code ?? 'DEPOSIT',
  provider_account_ref: source?.provider_account_ref ?? '',
  success_url: source?.success_url ?? '',
  failure_url: source?.failure_url ?? '',
  webhook_url: source?.webhook_url ?? '',
  credential_env_key: source?.credential_env_key ?? DEFAULT_CREDENTIAL_KEY,
  webhook_secret_env_key: source?.webhook_secret_env_key ?? DEFAULT_WEBHOOK_KEY,
})

const dialog = ref(false)
const draft = ref<Draft>(draftOf(null))

const canChooseKeys = computed(() => session.isPlatformAdmin)

const { submit: send, pending, apiError, message: failure, reset } = useSubmit(async () => {
  config.value = await settingsApi.savePaymentConfiguration({
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
  dialog.value = false
  toast.success('Configuration des paiements enregistrée.')
})

function openDialog() {
  draft.value = draftOf(config.value)
  reset()
  dialog.value = true
}

const httpsUrl = (value: unknown) =>
  String(value ?? '').trim() === '' || /^https:\/\/[^\s/][^\s./]*\.[^\s/]\S*$/i.test(String(value).trim()) || 'Saisissez une adresse complète qui commence par https://.'

const keyRule = (base: string) => (value: unknown) =>
  new RegExp(`^${base}(?:_[A-Z0-9]+)*$`).test(String(value ?? ''))
  || `Le nom doit être ${base} ou ${base}_SUFFIXE (majuscules, chiffres).`

const errorMessage = computed(() =>
  apiError.value?.kind === 'forbidden'
    ? 'Vous n\'avez pas le droit de modifier cette configuration. Les variables des identifiants secrets sont réservées à l\'administrateur de la plateforme.'
    : failure.value,
)

const unchanged = computed(() =>
  config.value !== null && JSON.stringify(draft.value) === JSON.stringify(draftOf(config.value)),
)

async function submit() {
  if (unchanged.value) {
    dialog.value = false
    toast.info('Aucune modification à enregistrer.')

    return
  }

  const accepted = await confirm({
    title: 'Remplacer la configuration ?',
    text: 'Cette configuration remplace la précédente : les paiements Mobile Money de ce restaurant suivront ces nouveaux réglages dès maintenant. Une erreur peut bloquer les encaissements.',
    confirmLabel: 'Remplacer la configuration',
    danger: true,
  })

  if (!accepted)
    return

  await send()

  if (failure.value)
    toast.error(errorMessage.value)
}

defineExpose({
  dirty: false,
  pending,
  invalid: false,
  submit: async () => {},
  cancel: () => {},
})
</script>

<template>
  <VSkeletonLoader
    v-if="loading && !config"
    type="card, card"
  />

  <AppErrorState
    v-else-if="error && !config"
    :error="error"
    @retry="reload"
  />

  <div v-else>
    <VRow>
      <VCol
        cols="12"
        lg="7"
      >
        <VCard class="mb-6">
          <VCardItem>
            <template #prepend>
              <VAvatar
                variant="tonal"
                rounded
                :color="config ? (config.enabled ? 'success' : 'secondary') : 'error'"
              >
                <VIcon icon="ri-lock-line" />
              </VAvatar>
            </template>
            <VCardTitle>Easy Transact</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Orange Money et MTN MoMo, encaissés par Easy Transact.
            </VCardSubtitle>
            <template #append>
              <AppStatusChip
                v-if="config"
                :label="config.enabled ? 'Configuré' : 'Configuré, désactivé'"
                :tone="config.enabled ? 'success' : 'warning'"
                :icon="config.enabled ? 'ri-checkbox-circle-line' : 'ri-pause-circle-line'"
              />
              <AppStatusChip
                v-else
                label="Non configuré"
                tone="error"
                icon="ri-error-warning-line"
              />
            </template>
          </VCardItem>

          <VCardText v-if="config">
            <p class="text-body-2 text-medium-emphasis mb-4">
              Dernière mise à jour le {{ formatDateTime(config.updated_at) }} · créée le {{ formatDateTime(config.created_at) }}.
            </p>

            <div class="text-caption text-medium-emphasis">
              Préfixe de référence (attribué par le serveur, jamais modifié)
            </div>
            <div class="d-flex align-center gap-2 mb-5">
              <code class="text-subtitle-1 settings-mono flex-grow-1">{{ config.vendor_reference_prefix }}</code>
              <IconBtn
                aria-label="Copier le préfixe de référence"
                @click="copy(config.vendor_reference_prefix, 'Préfixe')"
              >
                <VIcon icon="ri-file-copy-line" />
              </IconBtn>
            </div>

            <div class="d-flex flex-wrap gap-6">
              <div>
                <div class="text-caption text-medium-emphasis">
                  Code du service
                </div>
                <div class="text-body-1">
                  {{ config.service_code }}
                </div>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">
                  Compte marchand
                </div>
                <div class="text-body-1">
                  {{ config.provider_account_ref || 'Non renseigné' }}
                </div>
              </div>
            </div>
          </VCardText>

          <VCardText v-else>
            <VAlert
              type="warning"
              variant="tonal"
              icon="ri-error-warning-line"
            >
              <div class="font-weight-medium">
                Aucune configuration pour ce restaurant
              </div>
              Tant qu'Easy Transact n'est pas configuré, vos clients ne peuvent pas payer par Mobile Money.
              <span v-if="!canEdit">Demandez au propriétaire de le configurer.</span>
            </VAlert>
          </VCardText>

          <VDivider />
          <VCardActions class="px-6 py-4 flex-wrap gap-2">
            <VBtn
              variant="text"
              color="secondary"
              prepend-icon="ri-refresh-line"
              :loading="loading"
              @click="refresh"
            >
              Actualiser
            </VBtn>
            <VSpacer />
            <VBtn
              v-if="canEdit"
              :color="config ? 'error' : 'primary'"
              :variant="config ? 'outlined' : 'flat'"
              :prepend-icon="config ? 'ri-settings-4-line' : 'ri-add-line'"
              @click="openDialog"
            >
              {{ config ? 'Reconfigurer' : 'Configurer Easy Transact' }}
            </VBtn>
          </VCardActions>
        </VCard>

        <VCard v-if="config">
          <VCardItem>
            <template #prepend>
              <VAvatar
                variant="tonal"
                rounded
                color="primary"
              >
                <VIcon icon="ri-link" />
              </VAvatar>
            </template>
            <VCardTitle>Adresses de redirection</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Où vos clients arrivent après le paiement.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <div
              v-for="item in urls"
              :key="item.label"
              class="mb-4"
            >
              <div class="text-caption text-medium-emphasis">
                {{ item.label }}
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  :icon="item.icon"
                  size="18"
                  class="text-medium-emphasis"
                />
                <span
                  class="settings-mono text-body-2 flex-grow-1"
                  :class="{ 'text-disabled': !item.value }"
                >{{ item.value || 'Non renseignée' }}</span>
                <IconBtn
                  v-if="item.value"
                  :aria-label="`Copier l'adresse : ${item.label}`"
                  @click="copy(item.value, 'Adresse')"
                >
                  <VIcon icon="ri-file-copy-line" />
                </IconBtn>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="5"
      >
        <VCard
          v-if="config"
          class="mb-6"
        >
          <VCardItem>
            <template #prepend>
              <VAvatar
                variant="tonal"
                rounded
                color="primary"
              >
                <VIcon icon="ri-key-2-line" />
              </VAvatar>
            </template>
            <VCardTitle>Variables d'environnement</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Les secrets restent sur le serveur : seuls leurs noms sont visibles.
            </VCardSubtitle>
            <template #append>
              <VBtn
                size="small"
                variant="text"
                color="secondary"
                :prepend-icon="revealed ? 'ri-eye-off-line' : 'ri-eye-line'"
                @click="revealed = !revealed"
              >
                {{ revealed ? 'Masquer' : 'Afficher' }}
              </VBtn>
            </template>
          </VCardItem>
          <VCardText>
            <div
              v-for="item in variables"
              :key="item.label"
              class="mb-4"
            >
              <div class="text-caption text-medium-emphasis">
                {{ item.label }}
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  :icon="item.icon"
                  size="18"
                  class="text-medium-emphasis"
                />
                <code class="settings-mono text-body-2 flex-grow-1">{{ revealed ? item.name : '•'.repeat(Math.min(item.name.length, 24)) }}</code>
                <IconBtn
                  :aria-label="`Copier le nom de la variable : ${item.label}`"
                  @click="copy(item.name, 'Nom de la variable')"
                >
                  <VIcon icon="ri-file-copy-line" />
                </IconBtn>
              </div>
            </div>
            <p class="text-caption text-medium-emphasis mb-0">
              La valeur du jeton et du secret ne passe jamais par cet écran. Seul l'administrateur de la
              plateforme peut désigner d'autres variables.
            </p>
          </VCardText>
        </VCard>

        <VCard>
          <VCardItem>
            <template #prepend>
              <VAvatar
                variant="tonal"
                rounded
                color="primary"
              >
                <VIcon icon="ri-notification-3-line" />
              </VAvatar>
            </template>
            <VCardTitle>Adresse de notification de Marinade</VCardTitle>
            <VCardSubtitle class="text-wrap">
              À communiquer à Easy Transact pour suivre les paiements.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex align-center gap-2">
              <code class="settings-mono text-body-2 flex-grow-1">{{ notificationAddress }}</code>
              <IconBtn
                aria-label="Copier l'adresse de notification"
                @click="copy(notificationAddress, 'Adresse')"
              >
                <VIcon icon="ri-file-copy-line" />
              </IconBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <AppFormDialog
      v-model="dialog"
      :title="config ? 'Reconfigurer' : 'Configurer'"
      subtitle="Easy Transact : l'enregistrement remplace la configuration précédente."
      icon="ri-lock-line"
      submit-label="Enregistrer la configuration"
      :loading="pending"
      :error="errorMessage"
      :confirm="false"
      max-width="640"
      @submit="submit"
    >
      <VAlert
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-5"
      >
        Une erreur ici peut bloquer les paiements Mobile Money. Une confirmation vous sera demandée.
      </VAlert>

      <VSwitch
        v-model="draft.enabled"
        color="primary"
        hide-details
        class="mb-4"
        :label="draft.enabled ? 'Paiements activés' : 'Paiements désactivés'"
      />

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
          />
        </VCol>
        <template v-if="canChooseKeys">
          <VCol cols="12">
            <VTextField
              v-model="draft.credential_env_key"
              label="Variable du jeton d'API"
              prepend-inner-icon="ri-key-2-line"
              :rules="[keyRule(DEFAULT_CREDENTIAL_KEY)]"
            />
          </VCol>
          <VCol cols="12">
            <VTextField
              v-model="draft.webhook_secret_env_key"
              label="Variable du secret des notifications"
              prepend-inner-icon="ri-key-2-line"
              :rules="[keyRule(DEFAULT_WEBHOOK_KEY)]"
            />
          </VCol>
        </template>
      </VRow>
    </AppFormDialog>
  </div>
</template>
