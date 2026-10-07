<script setup lang="ts">
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { minLength, required, sameAs } from '@/lib/validation'

const route = useRoute()
const router = useRouter()
const form = ref()

// Le message du serveur contient le code : il peut arriver par lien (`?token=`) ou être collé.
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const password = ref('')
const confirmation = ref('')

const { submit, pending, message } = useSubmit(async () => {
  await container.auth.resetPassword(token.value.trim(), password.value)
  await router.replace({ path: '/login', query: { reset: '1' } })
})

async function onSubmit() {
  if ((await form.value?.validate())?.valid)
    await submit()
}
</script>

<template>
  <AuthShell
    title="Nouveau mot de passe 🔑"
    subtitle="Collez le code reçu par e-mail, puis choisissez votre nouveau mot de passe."
  >
    <VForm
      ref="form"
      validate-on="submit"
      @submit.prevent="onSubmit"
    >
      <VRow>
        <VCol cols="12">
          <VTextField
            v-model="token"
            label="Code reçu par e-mail"
            autocomplete="off"
            :autofocus="!token"
            :rules="[required]"
          />
        </VCol>

        <VCol cols="12">
          <AppPasswordField
            v-model="password"
            label="Nouveau mot de passe"
            autocomplete="new-password"
            hint="12 caractères au minimum."
            persistent-hint
            :rules="[required, minLength(12)]"
          />
        </VCol>

        <VCol cols="12">
          <AppPasswordField
            v-model="confirmation"
            label="Confirmer le mot de passe"
            autocomplete="new-password"
            :rules="[required, sameAs(() => password, 'Les mots de passe ne correspondent pas.')]"
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
            Modifier le mot de passe
          </VBtn>
        </VCol>
      </VRow>
    </VForm>

    <template #footer>
      <RouterLink
        to="/login"
        class="text-primary"
      >
        Retour à la connexion
      </RouterLink>
    </template>
  </AuthShell>
</template>
