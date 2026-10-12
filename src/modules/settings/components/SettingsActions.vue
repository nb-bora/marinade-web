<!--
  Pied de chaque onglet : brouillon retrouvé, erreur du serveur, « Annuler les modifications » et
  « Enregistrer ». Le parent fournit l'état ; le bouton « Enregistrer » soumet le VForm englobant.
-->
<script setup lang="ts">
defineProps<{
  canEdit: boolean
  dirty: boolean
  pending: boolean
  restored?: boolean
  errorMessage?: string
  changes?: string[]
  submitLabel?: string
}>()

defineEmits<{ cancel: [] }>()
</script>

<template>
  <div class="mt-6">
    <VAlert
      v-if="restored && dirty && canEdit"
      type="info"
      variant="tonal"
      density="compact"
      icon="ri-draft-line"
      class="mb-4"
    >
      Brouillon retrouvé : vos dernières modifications non enregistrées sont revenues. Enregistrez-les
      ou annulez-les.
    </VAlert>

    <VAlert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
    >
      <div class="font-weight-medium">
        L'enregistrement a échoué
      </div>
      {{ errorMessage }}
      <div class="text-caption mt-1">
        Vos modifications sont conservées : corrigez puis réessayez.
      </div>
    </VAlert>

    <VExpandTransition>
      <div
        v-if="canEdit && dirty && changes?.length"
        class="text-body-2 text-medium-emphasis mb-3 text-end"
      >
        Modifié : {{ changes.join(', ') }}
      </div>
    </VExpandTransition>

    <div
      v-if="canEdit"
      class="d-flex flex-wrap justify-end gap-3"
    >
      <VBtn
        variant="outlined"
        color="secondary"
        prepend-icon="ri-arrow-go-back-line"
        :disabled="!dirty || pending"
        @click="$emit('cancel')"
      >
        Annuler les modifications
      </VBtn>
      <VBtn
        type="submit"
        prepend-icon="ri-save-3-line"
        :loading="pending"
        :disabled="!dirty"
      >
        {{ submitLabel ?? 'Enregistrer' }}
      </VBtn>
    </div>
  </div>
</template>
