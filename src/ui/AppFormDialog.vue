<!--
  Fenêtre de formulaire (créer, modifier) : titre, champs, erreurs du serveur, Annuler / Enregistrer.
  Le parent fournit les champs en slot et reçoit `submit` seulement si le formulaire est valide.
-->
<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  submitLabel?: string
  loading?: boolean

  /** Message d'erreur global (souvent `useSubmit().message`). */
  error?: string
  maxWidth?: number | string
  icon?: string
  danger?: boolean

  /** Demande une confirmation après validation du formulaire (désactivable). */
  confirm?: boolean
  confirmTitle?: string
  confirmText?: string
}>(), {
  confirm: true,
  submitLabel: 'Enregistrer',
  loading: false,
  maxWidth: 900,
})

const emit = defineEmits<{ submit: [] }>()

const open = defineModel<boolean>({ required: true })
const form = ref()
const askConfirm = useConfirm()

// Boutons de confirmation : « Supprimer » pour le dangereux, « Créer » ou « Enregistrer » sinon.
const confirmLabel = computed(() => {
  if (props.danger)
    return 'Supprimer'

  return /^(créer|ajouter)/i.test(props.submitLabel) ? 'Créer' : 'Enregistrer'
})

async function onSubmit() {
  if (props.loading)
    return

  if (!(await form.value?.validate())?.valid)
    return

  if (props.confirm) {
    const accepted = await askConfirm({
      title: props.confirmTitle ?? (props.danger ? 'Confirmer la suppression ?' : 'Confirmer l’enregistrement ?'),
      text: props.confirmText ?? (props.danger ? 'Cette action ne peut pas être annulée.' : 'Les informations saisies seront enregistrées.'),
      confirmLabel: confirmLabel.value,
      danger: props.danger,
    })

    if (!accepted)
      return
  }

  emit('submit')
}

// À la réouverture, le formulaire repart sans erreurs de validation affichées.
watch(open, isOpen => {
  if (isOpen)
    nextTick(() => form.value?.resetValidation())
})
</script>

<template>
  <VDialog
    v-model="open"
    :max-width="maxWidth"
    :persistent="loading"
    scrollable
  >
    <VCard>
      <VForm
        ref="form"
        validate-on="submit"
        @submit.prevent="onSubmit"
      >
        <VCardItem class="pt-6 px-6">
          <template
            v-if="icon"
            #prepend
          >
            <VAvatar
              :color="danger ? 'error' : 'primary'"
              variant="tonal"
              rounded
            >
              <VIcon :icon="icon" />
            </VAvatar>
          </template>
          <VCardTitle class="text-h5">
            {{ title }}
          </VCardTitle>
          <VCardSubtitle
            v-if="subtitle"
            class="text-wrap"
          >
            {{ subtitle }}
          </VCardSubtitle>
          <template #append>
            <IconBtn
              aria-label="Fermer"
              :disabled="loading"
              @click="open = false"
            >
              <VIcon icon="ri-close-line" />
            </IconBtn>
          </template>
        </VCardItem>

        <VCardText class="px-6 pt-4">
          <slot />

          <VAlert
            v-if="error"
            type="error"
            variant="tonal"
            class="mt-5"
          >
            {{ error }}
          </VAlert>
        </VCardText>

        <VCardActions class="px-6 pb-6">
          <VSpacer />
          <VBtn
            variant="outlined"
            color="secondary"
            :disabled="loading"
            @click="open = false"
          >
            Annuler
          </VBtn>
          <VBtn
            type="submit"
            variant="flat"
            :color="danger ? 'error' : 'primary'"
            :loading="loading"
          >
            {{ submitLabel }}
          </VBtn>
        </VCardActions>
      </VForm>
    </VCard>
  </VDialog>
</template>
