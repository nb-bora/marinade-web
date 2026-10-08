<script setup lang="ts">
import SessionTile from '../components/SessionTile.vue'
import ShiftDialogs from '../components/ShiftDialogs.vue'
import { useCashSessions } from '../composables/useCashSessions'
import { useShift } from '../composables/useShift'
import { plural } from '../labels'
import type { Shift } from '../types'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime, formatMoney, formatTime } from '@/lib/format'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'
import { useToast } from '@/stores/toast.store'

const router = useRouter()
const toast = useToast()

const shift = useShift()
const { toCollect, withoutOrder, totalDue, loading, error, rows, reload, refresh } = useCashSessions()

const { isLive } = useLive(refresh)

// L'heure sert aux « il y a 5 minutes » : on la rafraîchit avec les données.
const now = ref(new Date())

watch(rows, () => {
  now.value = new Date()
})

const openDialog = ref(false)
const closeDialog = ref(false)
const resultDialog = ref(false)
const closedShift = ref<Shift | null>(null)

const { submit: openShift, pending: opening, message: openMessage, reset: resetOpen } = useSubmit(async (balance: number) => {
  const outcome = await shift.open(balance)

  openDialog.value = false
  if (outcome === 'opened')
    toast.success('La caisse est ouverte. Bon service !')
  else
    toast.info('Un shift est déjà ouvert pour vous : vous pouvez encaisser.')
})

const { submit: closeShift, pending: closing, message: closeMessage, reset: resetClose } = useSubmit(async (counted: number) => {
  closedShift.value = await shift.close(counted)
  closeDialog.value = false
  resultDialog.value = true
})

watch(openDialog, () => resetOpen())
watch(closeDialog, () => resetClose())

const loadedOnce = computed(() => rows.value !== null)

const shiftLabel = computed(() => {
  if (shift.state.value === 'closed')
    return 'Fermée'

  return 'Ouverte'
})

const shiftHint = computed(() => {
  if (shift.state.value === 'open' && shift.shift.value)
    return `depuis ${formatTime(shift.shift.value.opened_at)}`
  if (shift.state.value === 'open-elsewhere')
    return 'ouverte sur un autre appareil'

  return 'à ouvrir avant d\'encaisser'
})

const stats = computed<StatStripItem[]>(() => [
  {
    label: 'Caisse',
    value: shiftLabel.value,
    icon: shift.isOpen.value ? 'ri-lock-unlock-line' : 'ri-lock-line',
    hint: shiftHint.value,
    hintColor: shift.isOpen.value ? 'success' : 'warning',
  },
  {
    label: 'Fond de caisse',
    value: shift.shift.value ? formatMoney(shift.shift.value.opening_balance) : '—',
    icon: 'ri-safe-2-line',
    hint: shift.shift.value ? `ouvert à ${formatTime(shift.shift.value.opened_at)}` : undefined,
  },
  {
    label: 'À encaisser',
    value: formatMoney(totalDue.value),
    icon: 'ri-hand-coin-line',
    hint: plural(toCollect.value.length, 'addition') + (toCollect.value.length ? ' en attente' : ''),
  },
  {
    label: 'Sessions sans commande',
    value: String(withoutOrder.value),
    icon: 'ri-armchair-line',
    hint: withoutOrder.value ? 'rien à encaisser pour l\'instant' : undefined,
  },
])

const gap = computed(() => shift.lastClosed.value ? Number(shift.lastClosed.value.variance ?? 0) : 0)

const goTo = (sessionId: string) => router.push(`/caisse/sessions/${sessionId}`)
</script>

<template>
  <div>
    <AppPageHeader
      title="Caisse"
      subtitle="Ouvrez votre shift, encaissez les additions et fermez la caisse en fin de service."
    >
      <template #actions>
        <VChip
          v-if="isLive"
          size="small"
          color="success"
          variant="tonal"
          prepend-icon="ri-live-line"
        >
          En direct
        </VChip>
        <IconBtn
          aria-label="Actualiser"
          @click="reload"
        >
          <VIcon icon="ri-refresh-line" />
        </IconBtn>
        <VBtn
          v-if="!shift.isOpen.value"
          color="primary"
          size="large"
          prepend-icon="ri-lock-unlock-line"
          @click="openDialog = true"
        >
          Ouvrir la caisse
        </VBtn>
        <VBtn
          v-else
          color="error"
          variant="outlined"
          size="large"
          prepend-icon="ri-lock-line"
          @click="closeDialog = true"
        >
          Fermer la caisse
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="stats"
      :loading="loading && !loadedOnce"
      class="mb-6"
    />

    <VAlert
      v-if="shift.lastClosed.value"
      :type="gap === 0 ? 'success' : 'warning'"
      variant="tonal"
      class="mb-6"
      closable
      @click:close="shift.dismissLastClosed"
    >
      <div class="font-weight-medium">
        Dernier shift fermé le {{ formatDateTime(shift.lastClosed.value.closed_at) }}
      </div>
      <template v-if="gap === 0">
        La caisse était juste, aucun écart.
      </template>
      <template v-else-if="gap < 0">
        Il manquait {{ formatMoney(Math.abs(gap)) }} : attendu {{ formatMoney(shift.lastClosed.value.closing_balance_expected) }},
        compté {{ formatMoney(shift.lastClosed.value.closing_balance_counted) }}.
      </template>
      <template v-else>
        Il y avait {{ formatMoney(gap) }} de plus que prévu : attendu {{ formatMoney(shift.lastClosed.value.closing_balance_expected) }},
        compté {{ formatMoney(shift.lastClosed.value.closing_balance_counted) }}.
      </template>
    </VAlert>

    <VAlert
      v-if="!shift.isOpen.value"
      type="info"
      variant="tonal"
      class="mb-6"
      icon="ri-information-line"
    >
      Aucun shift n'est ouvert. Vous pouvez encaisser, mais les espèces ne seront comptées dans la caisse qu'à partir de l'ouverture.
    </VAlert>

    <div class="d-flex align-center justify-space-between mb-4">
      <h2 class="text-h5">
        Sessions à encaisser
      </h2>
      <span
        v-if="loadedOnce"
        class="text-body-2 text-medium-emphasis"
      >{{ plural(toCollect.length, 'session') }}</span>
    </div>

    <AppErrorState
      v-if="error && !loadedOnce"
      :error="error"
      @retry="reload"
    />

    <VRow v-else-if="!loadedOnce">
      <VCol
        v-for="n in 3"
        :key="n"
        cols="12"
        md="6"
        xl="4"
      >
        <VSkeletonLoader type="card" />
      </VCol>
    </VRow>

    <VCard v-else-if="toCollect.length === 0">
      <AppEmptyState
        icon="ri-checkbox-circle-line"
        title="Rien à encaisser"
        :text="withoutOrder
          ? `Toutes les additions sont soldées. ${plural(withoutOrder, 'session')} sans commande en attente de leur première commande.`
          : 'Toutes les additions sont soldées. Les nouvelles apparaîtront ici dès qu\'une commande sera passée.'"
      />
    </VCard>

    <VRow v-else>
      <VCol
        v-for="row in toCollect"
        :key="row.session.id"
        cols="12"
        md="6"
        xl="4"
      >
        <SessionTile
          :row="row"
          :now="now"
          @select="goTo(row.session.id)"
        />
      </VCol>
    </VRow>

    <ShiftDialogs
      v-model:open="openDialog"
      v-model:close="closeDialog"
      v-model:result="resultDialog"
      :loading="opening || closing"
      :error="openDialog ? openMessage : closeMessage"
      :result="closedShift"
      @open="openShift"
      @close="closeShift"
    />
  </div>
</template>
