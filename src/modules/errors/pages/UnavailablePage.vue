<script setup lang="ts">
const router = useRouter()

function retry() {
  router.replace('/')
}
</script>

<template>
  <AppFullPageMessage
    icon="ri-wifi-off-line"
    tone="error"
    title="Service indisponible"
    text="Impossible de joindre Marinade pour le moment. Vérifiez votre connexion, puis réessayez."
  >
    <VBtn
      prepend-icon="ri-refresh-line"
      @click="retry"
    >
      Réessayer
    </VBtn>
  </AppFullPageMessage>
</template>
