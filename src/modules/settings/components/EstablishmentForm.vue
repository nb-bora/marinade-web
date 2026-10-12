<script setup lang="ts">
import { useRestaurantUpdate } from '../composables/useRestaurantUpdate'
import { useSettingsDraft } from '../composables/useSettingsDraft'
import { COUNTRIES, CURRENCIES, DEFAULT_COUNTRY, descriptionRule, emptyToNull, logoUrlRule, nameRules } from '../labels'
import type { Restaurant, RestaurantUpdate } from '../types'
import SettingsActions from './SettingsActions.vue'
import { useConfirm } from '@/composables/useConfirm'
import { CAMEROON_CITIES } from '@/lib/phone'

const props = defineProps<{
  restaurant: Restaurant
  canEdit: boolean
}>()

const emit = defineEmits<{ saved: [restaurant: Restaurant] }>()

const confirm = useConfirm()

const draftOf = (restaurant: Restaurant) => ({
  name: restaurant.name,
  description: restaurant.description ?? '',
  logo_url: restaurant.logo_url ?? '',
  is_active: restaurant.is_active,
  phone: restaurant.phone ?? '',
  address: restaurant.address ?? '',
  city: restaurant.city ?? '',
  country: restaurant.country ?? DEFAULT_COUNTRY,
  currency: restaurant.currency,
})

type Draft = ReturnType<typeof draftOf>

const { draft, dirty, changed, changedKeys, restored, discard } = useSettingsDraft('establishment', () => props.restaurant, draftOf)

const form = ref()

const { save, pending, errorMessage, fieldMessage, reset } = useRestaurantUpdate(
  () => props.restaurant.id,
  restaurant => emit('saved', restaurant),
)

const FIELD_LABELS: Record<keyof Draft, string> = {
  name: 'nom',
  description: 'description',
  logo_url: 'logo',
  is_active: 'statut',
  phone: 'téléphone',
  address: 'adresse',
  city: 'ville',
  country: 'pays',
  currency: 'devise',
}

const changes = computed(() => changedKeys.value.map(key => FIELD_LABELS[key]))

const countries = computed(() => COUNTRIES.includes(draft.value.country) || !draft.value.country ? COUNTRIES : [...COUNTRIES, draft.value.country])

const currencies = computed(() =>
  CURRENCIES.some(item => item.value === draft.value.currency)
    ? CURRENCIES
    : [...CURRENCIES, { value: draft.value.currency, title: draft.value.currency }],
)

// Logo ------------------------------------------------------------------------------------------

const logoDialog = ref(false)
const logoInput = ref('')
const logoFailed = ref(false)
const previewFailed = ref(false)

const logoPreview = computed(() => {
  const url = draft.value.logo_url.trim()

  return url !== '' && logoUrlRule(url) === true && !logoFailed.value ? url : ''
})

const dialogPreview = computed(() => {
  const url = logoInput.value.trim()

  return url !== '' && logoUrlRule(url) === true && !previewFailed.value ? url : ''
})

watch(() => draft.value.logo_url, () => {
  logoFailed.value = false
})

watch(logoInput, () => {
  previewFailed.value = false
})

function openLogoDialog() {
  logoInput.value = draft.value.logo_url
  logoDialog.value = true
}

const logoInputValid = computed(() => logoUrlRule(logoInput.value) === true)

function applyLogo() {
  if (!logoInputValid.value)
    return

  draft.value.logo_url = logoInput.value.trim()
  logoDialog.value = false
}

function removeLogo() {
  draft.value.logo_url = ''
  logoDialog.value = false
}

// Enregistrement ----------------------------------------------------------------------------------

async function submit() {
  if (!props.canEdit || !dirty.value)
    return

  if (!(await form.value?.validate())?.valid)
    return

  if (props.restaurant.is_active && !draft.value.is_active) {
    const accepted = await confirm({
      title: 'Désactiver le restaurant ?',
      text: 'Le restaurant sera marqué comme inactif : il n\'apparaîtra plus comme ouvert à la prise de commande. Vous pourrez le réactiver à tout moment.',
      confirmLabel: 'Désactiver',
      danger: true,
    })

    if (!accepted)
      return
  }

  const values: Record<keyof Draft, string | boolean | null> = {
    name: draft.value.name.trim(),
    description: emptyToNull(draft.value.description),
    logo_url: emptyToNull(draft.value.logo_url),
    is_active: draft.value.is_active,
    phone: emptyToNull(draft.value.phone),
    address: emptyToNull(draft.value.address),
    city: emptyToNull(draft.value.city),
    country: emptyToNull(draft.value.country),
    currency: draft.value.currency.trim().toUpperCase(),
  }

  // Seuls les champs modifiés partent : on n'écrase jamais ce qu'un autre onglet vient d'enregistrer.
  const patch = Object.fromEntries(changedKeys.value.map(key => [key, values[key]])) as RestaurantUpdate

  await save(patch, 'Informations de l\'établissement enregistrées.')
}

function cancel() {
  discard()
  reset()
  form.value?.resetValidation()
}

defineExpose({
  dirty,
  pending,
  invalid: computed(() => form.value?.isValid === false),
  submit,
  cancel,
})
</script>

<template>
  <VForm
    ref="form"
    validate-on="input"
    @submit.prevent="submit"
  >
    <VCard class="mb-6">
      <VCardItem>
        <template #prepend>
          <VAvatar
            variant="tonal"
            rounded
            color="primary"
          >
            <VIcon icon="ri-image-line" />
          </VAvatar>
        </template>
        <VCardTitle>Logo</VCardTitle>
        <VCardSubtitle class="text-wrap">
          L'image qui représente votre restaurant.
        </VCardSubtitle>
      </VCardItem>
      <VCardText class="d-flex align-center flex-wrap gap-6">
        <div
          class="logo-box"
          :class="{ 'settings-changed--static': changed('logo_url') }"
        >
          <VImg
            v-if="logoPreview"
            :src="logoPreview"
            alt="Aperçu du logo"
            cover
            class="logo-box__img"
            @error="logoFailed = true"
          />
          <VIcon
            v-else
            icon="ri-restaurant-2-line"
            size="40"
            color="primary"
          />
        </div>
        <div class="min-w-0 flex-1-1">
          <div class="text-subtitle-1 text-truncate">
            {{ draft.name || 'Votre restaurant' }}
          </div>
          <div
            class="text-body-2 mb-3"
            :class="logoFailed ? 'text-error' : 'text-medium-emphasis'"
          >
            {{ logoFailed ? 'Aucune image à cette adresse : vérifiez le lien.' : logoPreview ? 'Aperçu du logo' : 'Aucun logo pour le moment' }}
          </div>
          <div
            v-if="canEdit"
            class="d-flex flex-wrap gap-2"
          >
            <VBtn
              variant="tonal"
              size="small"
              prepend-icon="ri-image-edit-line"
              @click="openLogoDialog"
            >
              Changer
            </VBtn>
            <VBtn
              v-if="draft.logo_url"
              variant="text"
              size="small"
              color="secondary"
              prepend-icon="ri-delete-bin-line"
              @click="removeLogo"
            >
              Retirer
            </VBtn>
          </div>
        </div>
      </VCardText>
      <div
        v-if="fieldMessage('logo_url')"
        class="text-caption text-error px-6 pb-4"
      >
        {{ fieldMessage('logo_url') }}
      </div>
    </VCard>

    <VCard>
      <VCardItem>
        <template #prepend>
          <VAvatar
            variant="tonal"
            rounded
            color="primary"
          >
            <VIcon icon="ri-building-line" />
          </VAvatar>
        </template>
        <VCardTitle>Informations de l'établissement</VCardTitle>
        <VCardSubtitle class="text-wrap">
          Ce que vos équipes et vos clients voient. Les champs modifiés sont surlignés tant qu'ils ne sont pas enregistrés.
        </VCardSubtitle>
      </VCardItem>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="draft.name"
              label="Nom du restaurant"
              prepend-inner-icon="ri-building-line"
              counter="100"
              :rules="nameRules"
              :error-messages="fieldMessage('name')"
              :readonly="!canEdit"
              :class="{ 'settings-changed': changed('name') }"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VSwitch
              v-model="draft.is_active"
              label="Ce restaurant est actif"
              color="primary"
              inset
              :readonly="!canEdit"
              :messages="draft.is_active ? 'Ouvert aux commandes.' : 'Marqué comme inactif.'"
              :class="{ 'settings-changed--static': changed('is_active') }"
              class="px-2"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VTextarea
              v-model="draft.description"
              label="Description"
              prepend-inner-icon="ri-file-text-line"
              rows="5"
              no-resize
              counter="500"
              :rules="[descriptionRule]"
              :error-messages="fieldMessage('description')"
              :readonly="!canEdit"
              :class="{ 'settings-changed': changed('description') }"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VRow>
              <VCol cols="12">
                <AppPhoneField
                  v-model="draft.phone"
                  label="Téléphone"
                  :error-messages="fieldMessage('phone')"
                  :readonly="!canEdit"
                  :class="{ 'settings-changed': changed('phone') }"
                />
              </VCol>
              <VCol cols="12">
                <VCombobox
                  :model-value="draft.city"
                  :items="CAMEROON_CITIES"
                  label="Ville"
                  prepend-inner-icon="ri-map-2-line"
                  hint="Choisissez dans la liste ou saisissez une autre ville."
                  persistent-hint
                  maxlength="100"
                  :readonly="!canEdit"
                  :class="{ 'settings-changed': changed('city') }"
                  @update:model-value="(value: string | null) => draft.city = value ?? ''"
                />
              </VCol>
            </VRow>
          </VCol>
          <VCol cols="12">
            <VTextField
              v-model="draft.address"
              label="Adresse"
              prepend-inner-icon="ri-map-pin-line"
              placeholder="Rue, quartier, repère"
              :error-messages="fieldMessage('address')"
              :readonly="!canEdit"
              :class="{ 'settings-changed': changed('address') }"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VSelect
              v-model="draft.country"
              :items="countries"
              label="Pays"
              prepend-inner-icon="ri-global-line"
              :readonly="!canEdit"
              :class="{ 'settings-changed': changed('country') }"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VSelect
              v-model="draft.currency"
              :items="currencies"
              label="Devise"
              prepend-inner-icon="ri-money-dollar-circle-line"
              :readonly="!canEdit"
              :class="{ 'settings-changed': changed('currency') }"
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <SettingsActions
      :can-edit="canEdit"
      :dirty="dirty"
      :pending="pending"
      :restored="restored"
      :error-message="errorMessage"
      :changes="changes"
      @cancel="cancel"
    />

    <VDialog
      v-model="logoDialog"
      max-width="480"
    >
      <VCard>
        <VCardItem class="pt-6 px-6">
          <VCardTitle class="text-h5">
            Changer le logo
          </VCardTitle>
          <VCardSubtitle class="text-wrap">
            Collez l'adresse web d'une image (PNG, JPG ou SVG).
          </VCardSubtitle>
        </VCardItem>
        <VCardText class="px-6">
          <div class="d-flex justify-center mb-4">
            <div class="logo-box logo-box--dialog">
              <VImg
                v-if="dialogPreview"
                :src="dialogPreview"
                alt="Aperçu du nouveau logo"
                cover
                class="logo-box__img"
                @error="previewFailed = true"
              />
              <VIcon
                v-else
                icon="ri-image-line"
                size="40"
                color="primary"
              />
            </div>
          </div>
          <VTextField
            v-model="logoInput"
            label="Adresse de l'image"
            prepend-inner-icon="ri-link"
            placeholder="https://…/logo.png"
            type="url"
            autofocus
            :rules="[logoUrlRule]"
            :error-messages="previewFailed && logoInputValid ? 'Aucune image à cette adresse : vérifiez le lien.' : undefined"
            @keydown.enter.prevent="applyLogo"
          />
          <p class="text-caption text-medium-emphasis mt-3 mb-0">
            Le téléversement de fichiers n'est pas encore pris en charge : hébergez votre logo (par exemple
            sur votre site) puis collez son adresse.
          </p>
        </VCardText>
        <VCardActions class="px-6 pb-6">
          <VBtn
            variant="text"
            color="secondary"
            @click="logoDialog = false"
          >
            Annuler
          </VBtn>
          <VSpacer />
          <VBtn
            :disabled="!logoInputValid || logoInput.trim() === '' || previewFailed"
            @click="applyLogo"
          >
            Utiliser ce logo
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VForm>
</template>

<style scoped>
.logo-box {
  display: grid;
  place-items: center;
  overflow: hidden;
  inline-size: 200px;
  block-size: 200px;
  flex: none;
  border: 1px dashed rgba(var(--v-border-color), 0.4);
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.logo-box--dialog {
  inline-size: 140px;
  block-size: 140px;
}

.logo-box__img {
  inline-size: 100%;
  block-size: 100%;
}

@media (max-width: 599px) {
  .logo-box {
    inline-size: 100px;
    block-size: 100px;
  }
}
</style>
