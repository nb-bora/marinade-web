<script setup lang="ts">
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { email as emailRule, required } from '@/lib/validation'

const form = ref()
const email = ref('')
const sent = ref(false)

const { submit, pending, message } = useSubmit(async () => {
  await container.auth.forgotPassword(email.value.trim().toLowerCase())

  // Le serveur répond pareil que le compte existe ou non : on ne révèle rien non plus.
  sent.value = true
})

async function onSubmit() {
  if ((await form.value?.validate())?.valid)
    await submit()
}
</script>

<template>
  <AuthShell
    title="Mot de passe oublié"
    subtitle="Nous vous envoyons de quoi choisir un nouveau mot de passe."
  >
    <template v-if="sent">
      <VAlert
        type="success"
        variant="tonal"
        class="mb-4"
      >
        Si un compte existe pour {{ email }}, un message vient d'y être envoyé. Il contient le code
        à saisir sur la page suivante.
      </VAlert>
      <VBtn
        block
        size="large"
        to="/reset-password"
      >
        J'ai reçu le code
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
            v-model="email"
            label="Adresse e-mail"
            type="email"
            autocomplete="email"
            autofocus
            :rules="[required, emailRule]"
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
            Envoyer
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
