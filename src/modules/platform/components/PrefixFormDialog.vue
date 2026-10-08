<!-- Ajout et modification d'un préfixe d'opérateur mobile. -->
<script setup lang="ts">
import { platformApi } from '../api'
import type { OperatorPrefix } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ prefix: OperatorPrefix | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()

const nationalPrefix = ref('')
const countryCode = ref('+237')
const operatorCode = ref('')
const operatorName = ref('')
const active = ref(true)

const isEdit = computed(() => props.prefix !== null)

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  if (props.prefix) {
    // Le serveur ne modifie que le nom de l'opérateur et l'activation.
    await platformApi.updatePrefix(props.prefix.id, { operator_name: operatorName.value.trim(), is_active: active.value })
  }
  else {
    await platformApi.createPrefix({
      national_prefix: nationalPrefix.value.trim(),
      country_code: countryCode.value.trim(),
      operator_code: operatorCode.value.trim().toUpperCase(),
      operator_name: operatorName.value.trim(),
      is_active: active.value,
    })
  }

  toast.success(isEdit.value ? 'Préfixe modifié.' : 'Préfixe ajouté.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  nationalPrefix.value = props.prefix?.national_prefix ?? ''
  countryCode.value = props.prefix?.country_code ?? '+237'
  operatorCode.value = props.prefix?.operator_code ?? ''
  operatorName.value = props.prefix?.operator_name ?? ''
  active.value = props.prefix?.is_active ?? true
})

const prefixRules = [
  (value: string) => value.trim().length > 0 || 'Saisissez le préfixe.',
  (value: string) => /^\d{2,4}$/.test(value.trim()) || 'Le préfixe compte de 2 à 4 chiffres (ex. 65).',
]

const countryRules = [(value: string) => /^\+\d{3}$/.test(value.trim()) || 'Format attendu : +237.']
const codeRules = [(value: string) => value.trim().length >= 2 || 'Le code compte au moins 2 caractères (ex. MTN).']
const nameRules = [(value: string) => value.trim().length >= 2 || 'Le nom compte au moins 2 caractères.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier le préfixe' : 'Nouveau préfixe'"
    :subtitle="isEdit ? 'Seuls le nom de l\'opérateur et l\'activation peuvent changer.' : 'Un préfixe permet de reconnaître l\'opérateur d\'un numéro mobile.'"
    icon="ri-sim-card-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol
        cols="12"
        sm="4"
      >
        <VTextField
          v-model="countryCode"
          label="Indicatif pays"
          :disabled="isEdit"
          :rules="countryRules"
          :error-messages="apiError?.fieldMessage('country_code')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="8"
      >
        <VTextField
          v-model="nationalPrefix"
          label="Préfixe du numéro"
          placeholder="65"
          inputmode="numeric"
          :disabled="isEdit"
          :rules="prefixRules"
          :error-messages="apiError?.fieldMessage('national_prefix')"
          :autofocus="!isEdit"
        />
      </VCol>
      <VCol
        cols="12"
        sm="4"
      >
        <VTextField
          v-model="operatorCode"
          label="Code"
          placeholder="MTN"
          :disabled="isEdit"
          :rules="codeRules"
          :error-messages="apiError?.fieldMessage('operator_code')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="8"
      >
        <VTextField
          v-model="operatorName"
          label="Nom de l'opérateur"
          placeholder="MTN Cameroun"
          :rules="nameRules"
          :error-messages="apiError?.fieldMessage('operator_name')"
          :autofocus="isEdit"
        />
      </VCol>
      <VCol cols="12">
        <VSwitch
          v-model="active"
          label="Préfixe actif"
          hint="Un préfixe inactif n'est plus reconnu lors de la saisie d'un numéro."
          persistent-hint
          color="primary"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
