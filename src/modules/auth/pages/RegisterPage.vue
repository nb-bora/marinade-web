<script setup lang="ts">
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import { email as emailRule, internationalPhone, minLength, required, sameAs } from '@/lib/validation'

const router = useRouter()
const form = ref()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('+237 ')
const password = ref('')
const confirmation = ref('')

const { submit, pending, message, apiError } = useSubmit(async () => {
  await container.auth.register({
    first_name: firstName.value.trim(),
    last_name: lastName.value.trim(),
    email: email.value.trim().toLowerCase(),
    phone: phone.value,
    password: password.value,

    // Un compte créé ici ouvre son propre restaurant ; le personnel est ajouté ensuite.
    role: 'restaurant',
  })

  await router.replace({ path: '/login', query: { registered: '1', email: email.value.trim().toLowerCase() } })
})

async function onSubmit() {
  if ((await form.value?.validate())?.valid)
    await submit()
}

const fieldError = (field: string) => apiError.value?.fieldMessage(field)
</script>

<template>
  <AuthShell
    title="Créer votre compte"
    subtitle="Quelques informations pour ouvrir votre restaurant sur Marinade."
  >
    <VForm
      ref="form"
      validate-on="submit"
      @submit.prevent="onSubmit"
    >
      <VRow>
        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="firstName"
            label="Prénom"
            autocomplete="given-name"
            autofocus
            :rules="[required]"
            :error-messages="fieldError('first_name')"
          />
        </VCol>

        <VCol
          cols="12"
          sm="6"
        >
          <VTextField
            v-model="lastName"
            label="Nom"
            autocomplete="family-name"
            :rules="[required]"
            :error-messages="fieldError('last_name')"
          />
        </VCol>

        <VCol cols="12">
          <VTextField
            v-model="email"
            label="Adresse e-mail"
            type="email"
            autocomplete="email"
            :rules="[required, emailRule]"
            :error-messages="fieldError('email')"
          />
        </VCol>

        <VCol cols="12">
          <VTextField
            v-model="phone"
            label="Téléphone"
            type="tel"
            autocomplete="tel"
            hint="Format international, par exemple +237 6 55 00 00 00."
            :rules="[required, internationalPhone]"
            :error-messages="fieldError('phone')"
          />
        </VCol>

        <VCol cols="12">
          <AppPasswordField
            v-model="password"
            label="Mot de passe"
            autocomplete="new-password"
            hint="12 caractères au minimum."
            persistent-hint
            :rules="[required, minLength(12)]"
            :error-messages="fieldError('password')"
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
            Créer mon compte
          </VBtn>
        </VCol>
      </VRow>
    </VForm>

    <template #footer>
      <span class="text-medium-emphasis">Déjà un compte ?</span>
      <RouterLink
        to="/login"
        class="text-primary ms-1"
      >
        Se connecter
      </RouterLink>
    </template>
  </AuthShell>
</template>
