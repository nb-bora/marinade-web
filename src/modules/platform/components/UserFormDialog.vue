<!-- Création et modification d'un compte utilisateur. -->
<script setup lang="ts">
import { platformApi } from '../api'
import { ROLE_OPTIONS } from '../labels'
import type { PlatformUser, UserRoleId } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ user: PlatformUser | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const role = ref<UserRoleId>('restaurant')

const isEdit = computed(() => props.user !== null)

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  if (props.user) {
    await platformApi.updateUser(props.user.id, {
      first_name: firstName.value.trim(),
      last_name: lastName.value.trim(),
      email: email.value.trim(),
      phone: phone.value,

      // Un rôle que cette liste ne propose pas (ex. livreur) n'est jamais réécrit.
      ...(role.value !== props.user.role ? { role: role.value } : {}),
    })
  }
  else {
    await platformApi.createUser({
      first_name: firstName.value.trim(),
      last_name: lastName.value.trim(),
      email: email.value.trim(),
      phone: phone.value,
      password: password.value,
      role: role.value,
    })
  }

  toast.success(isEdit.value ? 'Utilisateur modifié.' : 'Utilisateur créé.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  firstName.value = props.user?.first_name ?? ''
  lastName.value = props.user?.last_name ?? ''
  email.value = props.user?.email ?? ''
  phone.value = props.user?.phone ?? ''
  password.value = ''
  role.value = (props.user?.role as UserRoleId | undefined) ?? 'restaurant'
})

const required = (text: string) => [(value: string) => value.trim().length > 0 || text]

const emailRules = [
  (value: string) => value.trim().length > 0 || 'Saisissez l\'adresse e-mail.',
  (value: string) => /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value.trim()) || 'Cette adresse e-mail n\'est pas valide.',
]

const passwordRules = [
  (value: string) => value.length > 0 || 'Choisissez un mot de passe.',
  (value: string) => value.length >= 12 || 'Au moins 12 caractères.',
]
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'"
    :subtitle="isEdit ? undefined : 'Le compte est utilisable tout de suite avec ce mot de passe.'"
    icon="ri-user-add-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="firstName"
          label="Prénom"
          prepend-inner-icon="ri-user-line"
          :rules="required('Saisissez le prénom.')"
          :error-messages="apiError?.fieldMessage('first_name')"
          maxlength="100"
          autofocus
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="lastName"
          label="Nom"
          prepend-inner-icon="ri-user-line"
          :rules="required('Saisissez le nom.')"
          :error-messages="apiError?.fieldMessage('last_name')"
          maxlength="100"
        />
      </VCol>
      <VCol cols="12">
        <VTextField
          v-model="email"
          label="Adresse e-mail"
          prepend-inner-icon="ri-mail-line"
          type="email"
          autocomplete="off"
          :rules="emailRules"
          :error-messages="apiError?.fieldMessage('email')"
        />
      </VCol>
      <VCol cols="12">
        <AppPhoneField
          v-model="phone"
          label="Téléphone mobile"
          required
          :error-messages="apiError?.fieldMessage('phone')"
        />
      </VCol>
      <VCol
        v-if="!isEdit"
        cols="12"
      >
        <AppPasswordField
          v-model="password"
          label="Mot de passe"
          autocomplete="new-password"
          :rules="passwordRules"
          :error-messages="apiError?.fieldMessage('password')"
        />
        <AppPasswordStrength
          :password="password"
          class="mt-2"
        />
      </VCol>
      <VCol cols="12">
        <VSelect
          v-model="role"
          :items="ROLE_OPTIONS"
          label="Rôle"
          prepend-inner-icon="ri-shield-user-line"
          :error-messages="apiError?.fieldMessage('role')"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
