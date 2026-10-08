<script setup lang="ts">
import { useRestaurantUpdate } from '../composables/useRestaurantUpdate'
import { emptyToNull } from '../labels'
import type { Restaurant } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { CAMEROON_CITIES } from '@/lib/phone'
import { required } from '@/lib/validation'

const props = defineProps<{
  restaurant: Restaurant
  canEdit: boolean
}>()

const emit = defineEmits<{ saved: [restaurant: Restaurant] }>()

const confirm = useConfirm()

interface Draft {
  name: string
  description: string
  logo_url: string
  is_active: boolean
  phone: string
  address: string
  city: string
  country: string
}

const draftOf = (restaurant: Restaurant): Draft => ({
  name: restaurant.name,
  description: restaurant.description ?? '',
  logo_url: restaurant.logo_url ?? '',
  is_active: restaurant.is_active,
  phone: restaurant.phone ?? '',
  address: restaurant.address ?? '',
  city: restaurant.city ?? '',
  country: restaurant.country ?? '',
})

const draft = ref<Draft>(draftOf(props.restaurant))
const form = ref()

// Un restaurant rechargé (changement d'établissement, enregistrement) remplace le brouillon.
watch(() => props.restaurant, restaurant => {
  draft.value = draftOf(restaurant)
})

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(draftOf(props.restaurant)))

const { save, pending, errorMessage, reset } = useRestaurantUpdate(
  () => props.restaurant.id,
  restaurant => emit('saved', restaurant),
)

const httpsUrl = (value: unknown) =>
  String(value ?? '').trim() === '' || /^https?:\/\/\S+$/i.test(String(value).trim()) || 'Adresse web invalide (https://…).'

const logoFailed = ref(false)

watch(() => draft.value.logo_url, () => {
  logoFailed.value = false
})

const logoPreview = computed(() => {
  const url = draft.value.logo_url.trim()

  return httpsUrl(url) === true && url !== '' && !logoFailed.value ? url : ''
})

async function submit() {
  if (!(await form.value?.validate())?.valid)
    return

  if (props.restaurant.is_active && !draft.value.is_active) {
    const accepted = await confirm({
      title: 'Désactiver le restaurant ?',
      text: 'Le restaurant sera marqué comme inactif. Vous pourrez le réactiver à tout moment.',
      confirmLabel: 'Désactiver',
      danger: true,
    })

    if (!accepted)
      return
  }

  await save({
    name: draft.value.name.trim(),
    description: emptyToNull(draft.value.description),
    logo_url: emptyToNull(draft.value.logo_url),
    is_active: draft.value.is_active,
    phone: emptyToNull(draft.value.phone),
    address: emptyToNull(draft.value.address),
    city: emptyToNull(draft.value.city),
    country: emptyToNull(draft.value.country),
  }, 'Informations de l\'établissement enregistrées.')
}

function cancel() {
  draft.value = draftOf(props.restaurant)
  reset()
  form.value?.resetValidation()
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
        <VCard class="mb-6">
          <VCardItem>
            <VCardTitle>Identité</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Le nom et la présentation que vos équipes et vos clients voient.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="draft.name"
                  label="Nom du restaurant"
                  maxlength="255"
                  :rules="[required]"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="draft.description"
                  label="Description"
                  rows="3"
                  auto-grow
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol cols="12">
                <VSwitch
                  v-model="draft.is_active"
                  label="Restaurant actif"
                  color="primary"
                  hide-details
                  :readonly="!canEdit"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>

        <VCard>
          <VCardItem>
            <VCardTitle>Coordonnées et adresse</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Comment vous joindre et où vous trouver.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <AppPhoneField
                  v-model="draft.phone"
                  label="Téléphone"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VCombobox
                  :model-value="draft.city"
                  :items="CAMEROON_CITIES"
                  label="Ville"
                  maxlength="100"
                  :readonly="!canEdit"
                  @update:model-value="(value: string | null) => draft.city = value ?? ''"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="draft.address"
                  label="Adresse"
                  placeholder="Rue, quartier, repère"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="draft.country"
                  label="Pays"
                  maxlength="100"
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
        <VCard>
          <VCardItem>
            <VCardTitle>Logo</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Collez l'adresse web d'une image de votre logo.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex align-center gap-4 mb-4">
              <VAvatar
                size="96"
                rounded
                variant="tonal"
                color="primary"
              >
                <VImg
                  v-if="logoPreview"
                  :src="logoPreview"
                  alt="Aperçu du logo"
                  cover
                  @error="logoFailed = true"
                />
                <VIcon
                  v-else
                  icon="ri-restaurant-2-line"
                  size="40"
                />
              </VAvatar>
              <div class="min-w-0">
                <div class="text-subtitle-1 text-truncate">
                  {{ draft.name || 'Votre restaurant' }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ logoFailed ? 'Image introuvable à cette adresse.' : logoPreview ? 'Aperçu du logo' : 'Aucun logo' }}
                </div>
              </div>
            </div>
            <VTextField
              v-model="draft.logo_url"
              label="Adresse du logo"
              placeholder="https://…/logo.png"
              type="url"
              :rules="[httpsUrl]"
              :readonly="!canEdit"
            />
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
      class="d-flex flex-wrap justify-end gap-3 mt-6"
    >
      <VBtn
        variant="outlined"
        color="secondary"
        :disabled="!dirty || pending"
        @click="cancel"
      >
        Annuler les modifications
      </VBtn>
      <VBtn
        type="submit"
        :loading="pending"
        :disabled="!dirty"
      >
        Enregistrer
      </VBtn>
    </div>
  </VForm>
</template>
