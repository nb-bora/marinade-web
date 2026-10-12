<!-- Fiche d'une zone du plan : type, couleur, machines rattachées, modification et suppression. -->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import { pressingApi } from '../api'
import { pressingError } from '../labels'
import type { PlanMachine, Zone } from '../types'
import ZoneSheet from './ZoneSheet.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  machines: PlanMachine[]
  zones: Zone[]
  canWrite: boolean
}>()

const emit = defineEmits<{
  changed: []
  edit: [zone: Zone]
  openMachine: [id: string]
}>()

/** Identifiant de la zone affichée ; `null` ferme la fiche. */
const zoneId = defineModel<string | null>({ required: true })

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const { smAndDown } = useDisplay()

const zone = computed(() => props.zones.find(item => item.id === zoneId.value) ?? null)
const attached = computed(() => props.machines.filter(machine => machine.zone_id === zoneId.value))

const isOpen = computed({
  get: () => zoneId.value !== null && zone.value !== null,
  set: open => {
    if (!open)
      zoneId.value = null
  },
})

onKeyStroke('Escape', () => {
  if (isOpen.value)
    isOpen.value = false
})

const removal = useSubmit(async () => {
  const current = zone.value

  if (!current || !tenant.currentId)
    return

  // Le bouton est désactivé dans ce cas ; le serveur refuserait de toute façon (409).
  if (attached.value.length)
    return

  const accepted = await confirm({
    title: 'Supprimer cette zone ?',
    text: `La zone « ${current.nom} » sera retirée du plan. Aucune machine n'y est rattachée.`,
    confirmLabel: 'Supprimer',
    danger: true,
  })

  if (!accepted)
    return

  await pressingApi.deleteZone(tenant.currentId, current.id)
  toast.success(`La zone « ${current.nom} » est supprimée.`)
  zoneId.value = null
  emit('changed')
})

const blocked = computed(() => attached.value.length > 0)

const removalError = computed(() => removal.error.value ? pressingError(removal.error.value) : '')
</script>

<template>
  <VBottomSheet
    v-if="smAndDown"
    v-model="isOpen"
    inset
    scrollable
  >
    <ZoneSheet
      v-if="zone"
      :zone="zone"
      :attached="attached"
      :can-write="canWrite"
      :blocked="blocked"
      :removing="removal.pending.value"
      :removal-error="removalError"
      compact
      @close="isOpen = false"
      @edit="emit('edit', $event)"
      @remove="removal.submit()"
      @open-machine="emit('openMachine', $event)"
    />
  </VBottomSheet>

  <VNavigationDrawer
    v-else
    v-model="isOpen"
    location="end"
    temporary
    width="420"
  >
    <ZoneSheet
      v-if="zone"
      :zone="zone"
      :attached="attached"
      :can-write="canWrite"
      :blocked="blocked"
      :removing="removal.pending.value"
      :removal-error="removalError"
      :compact="false"
      @close="isOpen = false"
      @edit="emit('edit', $event)"
      @remove="removal.submit()"
      @open-machine="emit('openMachine', $event)"
    />
  </VNavigationDrawer>
</template>
