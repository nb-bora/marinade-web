<script setup lang="ts">
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { required } from '@/lib/validation'
import { useSessionStore } from '@/stores/session.store'

const route = useRoute()
const session = useSessionStore()
const form = ref()

const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const verified = ref(false)

const { submit, pending, message } = useSubmit(async () => {
  await container.auth.verifyEmail(token.value.trim())
  verified.value = true

  // Connecté : on rafraîchit le profil pour que « e-mail vérifié » apparaisse partout.
  if (session.isAuthenticated)
    session.setUser(await container.account.me())
})

async function onSubmit() {
  if ((await form.value?.validate())?.valid)
    await submit()
}

// Un lien complet (`?token=...`) valide sans geste de plus.
onMounted(() => {
  if (token.value)
    submit()
})
</script>

<template>
  <AuthShell
    title="Vérifier mon e-mail"
    subtitle="Confirmez que cette adresse est bien la vôtre."
  >
    <template v-if="verified">
      <VAlert
        type="success"
        variant="tonal"
        class="mb-4"
      >
        Votre adresse e-mail est vérifiée.
      </VAlert>
      <VBtn
        block
        size="large"
        :to="session.isAuthenticated ? '/' : '/login'"
      >
        Continuer
      </VBtn>
    </template>

    <VForm
      v-else
      ref="form"
      validate-on="submit"
      @submit.prevent="onSubmit"
    >
      <VRow>
        <VCol cols="12">
          <VTextField
            v-model="token"
            label="Code de vérification"
            autocomplete="off"
            :autofocus="!token"
            :rules="[required]"
          />
        </VCol>

        <VCol
          v-if="message"
          cols="12"
        >
          <VAlert
            type="error"
            variant="tonal"
          >
            {{ message }}
          </VAlert>
        </VCol>

        <VCol cols="12">
          <VBtn
            type="submit"
            block
            size="large"
            :loading="pending"
          >
            Vérifier
          </VBtn>
        </VCol>
      </VRow>
    </VForm>
  </AuthShell>
</template>
