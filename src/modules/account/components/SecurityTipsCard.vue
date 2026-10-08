<script setup lang="ts">
const TIPS = [
  {
    icon: 'ri-lock-password-line',
    title: 'Un mot de passe unique',
    text: 'Au moins 12 caractères, différent de celui de vos autres comptes.',
  },
  {
    icon: 'ri-shield-keyhole-line',
    title: 'La double authentification',
    text: 'Même si votre mot de passe fuite, personne ne peut se connecter sans votre téléphone.',
  },
  {
    icon: 'ri-key-2-line',
    title: 'Codes de secours hors de l\'appareil',
    text: 'Imprimez-les ou gardez-les dans un coffre de mots de passe, pas dans vos notes.',
  },
  {
    icon: 'ri-computer-line',
    title: 'Déconnectez-vous des postes partagés',
    text: 'Sur une caisse ou un ordinateur commun, quittez toujours la session après usage.',
  },
]
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Conseils de sécurité</VCardTitle>
    </VCardItem>
    <VCardText>
      <div
        v-for="tip in TIPS"
        :key="tip.title"
        class="d-flex gap-3 tip"
      >
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
          size="36"
        >
          <VIcon
            :icon="tip.icon"
            size="20"
          />
        </VAvatar>
        <div class="min-w-0">
          <div class="text-subtitle-2">
            {{ tip.title }}
          </div>
          <div class="text-body-2 text-medium-emphasis">
            {{ tip.text }}
          </div>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.tip + .tip {
  margin-block-start: 1rem;
}
</style>
