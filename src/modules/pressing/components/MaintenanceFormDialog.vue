<!-- Déclaration d'une intervention sur une machine : entretien, panne ou réparation. -->
<script setup lang="ts">
import { pressingApi } from '../api'
import { MAINTENANCE_INFO, MAINTENANCE_OPTIONS, pressingError } from '../labels'
import type { Machine, Maintenance, MaintenanceType } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ machine: Machine | null }>()

const emit = defineEmits<{ saved: [maintenance: Maintenance] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const type = ref<MaintenanceType>('panne')
const description = ref('')
const debut = ref('')
const finie = ref(false)
const fin = ref('')
const estimee = ref('')

const iso = (local: string) => new Date(local).toISOString()

const { submit, pending, error, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId || !props.machine)
    return

  const saved = await pressingApi.declareMaintenance(restaurantId, props.machine.id, {
    type: type.value,
    description: description.value.trim(),
    debut: debut.value ? iso(debut.value) : undefined,
    fin: finie.value && fin.value ? iso(fin.value) : undefined,
    duree_estimee_min: estimee.value.trim() ? Number(estimee.value) : undefined,
  })

  toast.success(finie.value ? 'L\'intervention est enregistrée dans l\'historique.' : 'Intervention déclarée : la machine est en maintenance.')
  open.value = false
  emit('saved', saved)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  type.value = 'panne'
  description.value = ''
  debut.value = ''
  finie.value = false
  fin.value = ''
  estimee.value = ''
})

const descriptionRules = [(value: string) => (value.trim().length >= 1 && value.trim().length <= 1000) || 'Décrivez l\'intervention en 1000 caractères au plus.']

const estimeeRules = [(value: string) => value.trim() === '' || (/^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= 100000) || 'Durée en minutes entières, au moins 1.']

const endRules = [
  (value: string) => !finie.value || value !== '' || 'Indiquez quand l\'intervention s\'est terminée.',
  (value: string) => !finie.value || !value || !debut.value || new Date(value) >= new Date(debut.value) || 'La fin ne peut pas précéder le début.',
]

const consequence = computed(() => finie.value
  ? 'L\'intervention est déjà terminée : elle est seulement ajoutée à l\'historique, l\'état de la machine ne change pas.'
  : 'Sans date de fin, l\'intervention reste ouverte et la machine passe en maintenance (si elle est libre ou hors service). Clôturez-la une fois terminée.')
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="`Déclarer une intervention${machine ? ` sur ${machine.nom}` : ''}`"
    subtitle="Panne, entretien ou réparation : l'indisponibilité sera mesurée à la clôture."
    submit-label="Déclarer"
    confirm-title="Déclarer cette intervention ?"
    :confirm-text="consequence"
    icon="ri-tools-line"
    :max-width="600"
    :loading="pending"
    :error="error ? pressingError(error) : ''"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VSelect
          v-model="type"
          :items="MAINTENANCE_OPTIONS"
          label="Nature de l'intervention"
          :prepend-inner-icon="MAINTENANCE_INFO[type].icon"
        />
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="description"
          label="Description"
          prepend-inner-icon="ri-file-text-line"
          placeholder="Le tambour ne tourne plus, vidange bouchée, détartrage annuel..."
          rows="3"
          auto-grow
          counter="1000"
          :rules="descriptionRules"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="debut"
          label="Début (facultatif)"
          prepend-inner-icon="ri-calendar-event-line"
          type="datetime-local"
          hint="Vide : maintenant."
          persistent-hint
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="estimee"
          label="Durée estimée (minutes)"
          prepend-inner-icon="ri-timer-line"
          type="number"
          inputmode="numeric"
          min="1"
          :rules="estimeeRules"
          hint="Une prévision, distincte de la durée mesurée."
          persistent-hint
        />
      </VCol>
      <VCol cols="12">
        <VSwitch
          v-model="finie"
          label="L'intervention est déjà terminée"
          color="primary"
          density="compact"
          hide-details
        />
      </VCol>
      <VCol
        v-if="finie"
        cols="12"
      >
        <VTextField
          v-model="fin"
          label="Fin de l'intervention"
          prepend-inner-icon="ri-calendar-check-line"
          type="datetime-local"
          :rules="endRules"
        />
      </VCol>
      <VCol cols="12">
        <VAlert
          type="info"
          variant="tonal"
          density="compact"
          icon="ri-information-line"
        >
          {{ consequence }}
        </VAlert>
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
