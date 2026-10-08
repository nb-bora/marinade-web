<!-- Ouverture et fermeture du shift de caisse, et résultat de l'audit des écarts. -->
<script setup lang="ts">
import { parseAmount, toNumber } from '../money'
import type { Shift } from '../types'
import { formatDateTime, formatMoney } from '@/lib/format'

defineProps<{
  loading?: boolean
  error?: string

  /** Shift que l'on vient de fermer : affiche le résultat de l'audit. */
  result: Shift | null
}>()

const emit = defineEmits<{
  open: [openingBalance: number]
  close: [countedBalance: number]
}>()

const openDialog = defineModel<boolean>('open', { required: true })
const closeDialog = defineModel<boolean>('close', { required: true })
const resultDialog = defineModel<boolean>('summary', { required: true })

const opening = ref('')
const counted = ref('')

// Chaque ouverture de fenêtre repart d'une saisie vide.
watch(openDialog, isOpen => {
  if (isOpen)
    opening.value = ''
})

watch(closeDialog, isOpen => {
  if (isOpen)
    counted.value = ''
})

const digitsOnly = (value: string) => String(parseAmount(value) || '')

const rules = [(value: string) => value !== '' || 'Saisissez un montant, même s\'il est de 0.']

const variance = (shift: Shift) => toNumber(shift.variance)
</script>

<template>
  <AppFormDialog
    v-model="openDialog"
    title="Ouvrir la caisse"
    subtitle="Comptez le fond de caisse avant de commencer à encaisser."
    icon="ri-lock-unlock-line"
    submit-label="Ouvrir la caisse"
    :loading="loading"
    :error="error"
    @submit="emit('open', parseAmount(opening))"
  >
    <VTextField
      v-model="opening"
      label="Fond de caisse (FCFA)"
      prepend-inner-icon="ri-money-dollar-circle-line"
      inputmode="numeric"
      autocomplete="off"
      autofocus
      persistent-hint
      hint="Les espèces déjà dans le tiroir à l'ouverture. Laissez 0 s'il est vide."
      @update:model-value="opening = digitsOnly($event)"
    >
      <template #append-inner>
        <span class="text-medium-emphasis">FCFA</span>
      </template>
    </VTextField>
    <div
      v-if="opening"
      class="text-h5 font-weight-semibold tabular-nums mt-3"
    >
      {{ formatMoney(parseAmount(opening)) }}
    </div>
  </AppFormDialog>

  <AppFormDialog
    v-model="closeDialog"
    title="Fermer la caisse"
    subtitle="Comptez toutes les espèces du tiroir. Le système calcule l'écart avec ce qui est attendu."
    icon="ri-lock-line"
    submit-label="Fermer la caisse"
    :loading="loading"
    :error="error"
    @submit="emit('close', parseAmount(counted))"
  >
    <VTextField
      v-model="counted"
      label="Montant compté dans le tiroir (FCFA)"
      prepend-inner-icon="ri-money-dollar-circle-line"
      inputmode="numeric"
      autocomplete="off"
      autofocus
      :rules="rules"
      @update:model-value="counted = digitsOnly($event)"
    >
      <template #append-inner>
        <span class="text-medium-emphasis">FCFA</span>
      </template>
    </VTextField>
    <div
      v-if="counted"
      class="text-h5 font-weight-semibold tabular-nums mt-3"
    >
      {{ formatMoney(parseAmount(counted)) }}
    </div>
  </AppFormDialog>

  <VDialog
    v-model="resultDialog"
    max-width="460"
  >
    <VCard v-if="result">
      <VCardText class="pa-6">
        <div class="d-flex flex-column align-center text-center mb-5">
          <VAvatar
            :color="variance(result) === 0 ? 'success' : variance(result) < 0 ? 'error' : 'warning'"
            variant="tonal"
            size="64"
            class="mb-3"
          >
            <VIcon
              :icon="variance(result) === 0 ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'"
              size="34"
            />
          </VAvatar>
          <h2 class="text-h5">
            Caisse fermée
          </h2>
          <p
            class="text-body-1 mb-0 mt-1"
            :class="variance(result) === 0 ? 'text-success' : variance(result) < 0 ? 'text-error' : 'text-warning'"
          >
            <template v-if="variance(result) === 0">
              La caisse est juste, aucun écart.
            </template>
            <template v-else-if="variance(result) < 0">
              Il manque {{ formatMoney(Math.abs(variance(result))) }} dans le tiroir.
            </template>
            <template v-else>
              Il y a {{ formatMoney(variance(result)) }} de plus que prévu dans le tiroir.
            </template>
          </p>
        </div>

        <div class="d-flex justify-space-between py-1">
          <span class="text-medium-emphasis">Fond de caisse</span>
          <span class="tabular-nums">{{ formatMoney(result.opening_balance) }}</span>
        </div>
        <div class="d-flex justify-space-between py-1">
          <span class="text-medium-emphasis">Attendu (fond + espèces encaissées)</span>
          <span class="tabular-nums">{{ formatMoney(result.closing_balance_expected) }}</span>
        </div>
        <div class="d-flex justify-space-between py-1">
          <span class="text-medium-emphasis">Compté</span>
          <span class="tabular-nums">{{ formatMoney(result.closing_balance_counted) }}</span>
        </div>
        <VDivider class="my-2" />
        <div class="d-flex justify-space-between align-center py-1">
          <span class="font-weight-medium">Écart</span>
          <span
            class="text-h5 font-weight-bold tabular-nums"
            :class="variance(result) === 0 ? 'text-success' : variance(result) < 0 ? 'text-error' : 'text-warning'"
          >
            {{ variance(result) > 0 ? '+' : '' }}{{ formatMoney(variance(result)) }}
          </span>
        </div>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-3">
          Ouvert le {{ formatDateTime(result.opened_at) }}, fermé le {{ formatDateTime(result.closed_at) }}.
          L'écart est enregistré dans le journal d'audit.
        </p>
      </VCardText>
      <VCardActions class="px-6 pb-6">
        <VBtn
          block
          color="primary"
          size="large"
          @click="resultDialog = false"
        >
          Terminé
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
