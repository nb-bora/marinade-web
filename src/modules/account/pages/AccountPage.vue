<script setup lang="ts">
import TwoFactorCard from '../components/TwoFactorCard.vue'
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { accountRoleLabel } from '@/lib/labels'
import { formatDate } from '@/lib/format'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'

const session = useSessionStore()
const toast = useToast()

const { submit: resend, pending: resending } = useSubmit(async () => {
  await container.auth.sendVerificationEmail()
  toast.success('E-mail de vérification envoyé.')
})

const emailVerified = computed(() => Boolean(session.user?.email_verified_at))
</script>

<template>
  <div v-if="session.user">
    <AppPageHeader
      title="Mon compte"
      subtitle="Vos informations et la sécurité de votre connexion."
    />

    <VRow>
      <VCol
        cols="12"
        md="6"
      >
        <VCard class="h-100">
          <VCardItem>
            <VCardTitle>Identité</VCardTitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex align-center gap-4 mb-4">
              <VAvatar
                color="primary"
                variant="tonal"
                size="56"
              >
                <span class="text-h6">{{ session.initials }}</span>
              </VAvatar>
              <div class="min-w-0">
                <div class="text-h6 text-truncate">
                  {{ session.displayName }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ accountRoleLabel(session.user.role) }} · inscrit le {{ formatDate(session.user.created_at) }}
                </div>
              </div>
            </div>

            <VList class="pa-0 bg-transparent">
              <VListItem class="px-0">
                <VListItemSubtitle>Adresse e-mail</VListItemSubtitle>
                <VListItemTitle class="d-flex flex-wrap align-center gap-2">
                  {{ session.user.email }}
                  <AppStatusChip
                    :label="emailVerified ? 'Vérifiée' : 'Non vérifiée'"
                    :tone="emailVerified ? 'success' : 'warning'"
                  />
                </VListItemTitle>
              </VListItem>
              <VListItem class="px-0">
                <VListItemSubtitle>Téléphone</VListItemSubtitle>
                <VListItemTitle>{{ session.user.phone }}</VListItemTitle>
              </VListItem>
            </VList>

            <VAlert
              v-if="!emailVerified"
              type="warning"
              variant="tonal"
              density="compact"
              class="mt-4"
            >
              <div class="d-flex flex-wrap align-center justify-space-between gap-2">
                <span>Vérifiez votre e-mail pour sécuriser la récupération de votre compte.</span>
                <div class="d-flex gap-2">
                  <VBtn
                    size="small"
                    variant="outlined"
                    :loading="resending"
                    @click="resend"
                  >
                    Envoyer le code
                  </VBtn>
                  <VBtn
                    size="small"
                    variant="text"
                    to="/verify-email"
                  >
                    J'ai un code
                  </VBtn>
                </div>
              </div>
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="6"
      >
        <TwoFactorCard />
      </VCol>
    </VRow>
  </div>
</template>
