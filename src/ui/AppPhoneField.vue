<!-- Numéro mobile camerounais : préfixe +237 fixe, saisie des 9 chiffres, opérateur reconnu. -->
<script setup lang="ts">
import { formatNational, isValidCameroonMobile, nationalDigits, operatorOf, toInternational } from '@/lib/phone'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  label?: string
  required?: boolean
  errorMessages?: string | string[]
}>(), { label: 'Téléphone mobile', required: false })

/** Valeur au format international (`+2376…`), ou chaîne vide. */
const model = defineModel<string>({ required: true })

const display = ref(formatNational(nationalDigits(model.value)))
const national = computed(() => nationalDigits(display.value))
const operator = computed(() => operatorOf(national.value))

watch(display, value => {
  const formatted = formatNational(nationalDigits(value))

  if (formatted !== value)
    display.value = formatted

  model.value = national.value ? toInternational(national.value) : ''
})

const rules = [
  () => !props.required || national.value.length > 0 || 'Ce champ est obligatoire.',
  () => national.value.length === 0 || isValidCameroonMobile(national.value) || 'Numéro mobile à 9 chiffres commençant par 6.',
]
</script>

<template>
  <VTextField
    v-bind="$attrs"
    v-model="display"
    :label="label"
    type="tel"
    inputmode="numeric"
    autocomplete="tel-national"
    placeholder="6 55 12 34 56"
    :rules="rules"
    :error-messages="errorMessages"
  >
    <template #prepend-inner>
      <span class="phone-prefix text-body-1 text-high-emphasis me-1">🇨🇲 +237</span>
    </template>
    <template #append-inner>
      <VFadeTransition>
        <VChip
          v-if="operator"
          size="x-small"
          label
          :color="operator === 'MTN' ? 'warning' : 'primary'"
        >
          {{ operator }}
        </VChip>
      </VFadeTransition>
    </template>
  </VTextField>
</template>

<style scoped>
.phone-prefix {
  padding-inline-end: 0.5rem;
  border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
}
</style>
