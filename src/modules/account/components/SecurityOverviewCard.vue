<!-- Niveau de sécurité du compte : trois protections, un coup d'œil. -->
<script setup lang="ts">
import { useSessionStore } from '@/stores/session.store'

const session = useSessionStore()

interface Check {
  id: string
  label: string
  done: boolean
  icon: string
}

const checks = computed<Check[]>(() => [
  { id: 'email', label: 'E-mail vérifié', done: Boolean(session.user?.email_verified_at), icon: 'ri-mail-check-line' },
  { id: 'phone', label: 'Téléphone vérifié', done: Boolean(session.user?.phone_verified_at), icon: 'ri-smartphone-line' },
  { id: 'two-factor', label: 'Double authentification', done: session.user?.two_factor_enabled === true, icon: 'ri-shield-keyhole-line' },
])

const doneCount = computed(() => checks.value.filter(check => check.done).length)
const percent = computed(() => Math.round(doneCount.value / checks.value.length * 100))

interface Level {
  label: string
  color: 'success' | 'warning' | 'error'
}

const level = computed<Level>(() => {
  if (doneCount.value === checks.value.length)
    return { label: 'Excellent', color: 'success' }

  return doneCount.value === 0 ? { label: 'À renforcer', color: 'error' } : { label: 'Correct', color: 'warning' }
})
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Niveau de sécurité</VCardTitle>
      <VCardSubtitle class="text-wrap">
        {{ doneCount }} protection{{ doneCount > 1 ? 's' : '' }} sur {{ checks.length }} en place.
      </VCardSubtitle>
      <template #append>
        <AppStatusChip
          :label="level.label"
          :tone="level.color"
        />
      </template>
    </VCardItem>

    <VCardText>
      <VProgressLinear
        :model-value="percent"
        :color="level.color"
        height="8"
        rounded
        class="mb-4"
        :aria-label="`Niveau de sécurité : ${percent} %`"
      />
      <div class="d-flex flex-wrap gap-x-6 gap-y-2">
        <div
          v-for="check in checks"
          :key="check.id"
          class="d-flex align-center gap-2"
        >
          <VAvatar
            :color="check.done ? 'success' : 'secondary'"
            variant="tonal"
            size="28"
          >
            <VIcon
              :icon="check.done ? 'ri-check-line' : check.icon"
              size="16"
            />
          </VAvatar>
          <span
            class="text-body-2"
            :class="{ 'text-medium-emphasis': !check.done }"
          >{{ check.label }}</span>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>
