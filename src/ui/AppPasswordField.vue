<!-- Champ mot de passe avec bouton « afficher / masquer ». Accepte tous les attributs de VTextField. -->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <VTextField
    v-bind="$attrs"
    v-model="model"
    prepend-inner-icon="ri-lock-line"
    :type="visible ? 'text' : 'password'"
  >
    <template #append-inner>
      <IconBtn
        size="small"
        :aria-label="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        :aria-pressed="visible"
        tabindex="-1"
        @click="visible = !visible"
      >
        <VIcon :icon="visible ? 'ri-eye-off-line' : 'ri-eye-line'" />
      </IconBtn>
    </template>
  </VTextField>
</template>
