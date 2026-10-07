<!-- Jauge de solidité d'un mot de passe, avec les critères attendus. -->
<script setup lang="ts">
const props = defineProps<{ password: string }>()

const criteria = computed(() => [
  { label: '12 caractères', met: props.password.length >= 12 },
  { label: 'Une majuscule', met: /[A-Z]/.test(props.password) },
  { label: 'Un chiffre', met: /\d/.test(props.password) },
  { label: 'Un symbole', met: /[^A-Z0-9]/i.test(props.password) },
])

const score = computed(() => criteria.value.filter(item => item.met).length)

const level = computed(() => {
  if (props.password.length === 0)
    return { label: '', color: 'secondary' }
  if (props.password.length < 12 || score.value <= 1)
    return { label: 'Faible', color: 'error' }
  if (score.value <= 3)
    return { label: 'Correct', color: 'warning' }

  return { label: 'Solide', color: 'success' }
})
</script>

<template>
  <div
    class="password-strength"
    aria-live="polite"
  >
    <div class="d-flex gap-1 mb-2">
      <span
        v-for="index in 4"
        :key="index"
        class="password-strength__bar"
        :class="index <= score && password ? `bg-${level.color}` : ''"
      />
    </div>
    <div class="d-flex flex-wrap align-center gap-x-4 gap-y-1 text-caption">
      <span
        v-if="level.label"
        :class="`text-${level.color} font-weight-semibold`"
      >{{ level.label }}</span>
      <span
        v-for="item in criteria"
        :key="item.label"
        class="d-inline-flex align-center gap-1"
        :class="item.met ? 'text-success' : 'text-medium-emphasis'"
      >
        <VIcon
          :icon="item.met ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
          size="14"
        />
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.password-strength__bar {
  flex: 1;
  border-radius: 3px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  block-size: 4px;
  transition: background-color 0.2s ease;
}
</style>
