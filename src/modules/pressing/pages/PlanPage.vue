<script setup lang="ts">
import { pressingApi } from '../api'
import MachineDrawer from '../components/MachineDrawer.vue'
import MachineFormDialog from '../components/MachineFormDialog.vue'
import PressingPlan from '../components/PressingPlan.vue'
import type { LayoutPayload } from '../components/PressingPlan.vue'
import ZoneDrawer from '../components/ZoneDrawer.vue'
import ZoneFormDialog from '../components/ZoneFormDialog.vue'
import { machineBody } from '../composables/usePressingPlan'
import { plural, pressingError } from '../labels'
import type { Machine, Zone } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const canWrite = computed(() => tenant.can('management'))

const { data: plan, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? pressingApi.plan(tenant.currentId, false, signal) : Promise.resolve(null),
  { watch: [() => tenant.currentId] },
)

const zones = computed(() => plan.value?.zones ?? [])
const machines = computed(() => plan.value?.machines ?? [])
const isEmpty = computed(() => plan.value !== null && !zones.value.length && !machines.value.length)

// Le plan se met à jour seul, sauf pendant un aménagement : le brouillon ne doit pas bouger sous les doigts.
const editing = ref(false)
const planRef = ref<InstanceType<typeof PressingPlan> | null>(null)

// --- Sélection et formulaires ---------------------------------------------------------------------

const machineId = ref<string | null>(null)
const zoneId = ref<string | null>(null)
const revision = ref(0)

const machineForm = ref(false)
const editedMachine = ref<Machine | null>(null)
const newCategory = ref<Machine['categorie'] | undefined>(undefined)
const zoneForm = ref(false)
const editedZone = ref<Zone | null>(null)

watch(machineId, id => {
  if (id)
    zoneId.value = null
})

watch(zoneId, id => {
  if (id)
    machineId.value = null
})

function newMachine() {
  editedMachine.value = null
  newCategory.value = undefined
  machineForm.value = true
}

function editMachine(machine: Machine) {
  editedMachine.value = machine
  machineForm.value = true
}

function newZone() {
  editedZone.value = null
  zoneForm.value = true
}

function editZone(zone: Zone) {
  editedZone.value = zone
  zoneForm.value = true
}

async function onMachineSaved() {
  revision.value++
  await refresh()
}

async function onZoneSaved() {
  await refresh()
}

function openMachineFromZone(id: string) {
  machineId.value = id
}

// --- Enregistrer l'aménagement ----------------------------------------------------------------------

const layoutSubmit = useSubmit(async (payload: LayoutPayload) => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const moved = plural(payload.machines.length, 'machine')
  const resized = plural(payload.zones.length, 'zone')

  const accepted = await confirm({
    title: 'Enregistrer l\'aménagement ?',
    text: `${[payload.machines.length ? moved : '', payload.zones.length ? resized : ''].filter(Boolean).join(' et ')} seront mises à jour. Une machine posée dans une zone lui est rattachée ; posée hors de toute zone, elle n'est plus rattachée à aucune.`,
    confirmLabel: 'Enregistrer',
  })

  if (!accepted)
    return

  let done = 0
  const total = payload.zones.length + payload.machines.length

  try {
    for (const change of payload.zones) {
      const zone = zones.value.find(item => item.id === change.id)

      if (!zone)
        continue

      await pressingApi.updateZone(restaurantId, zone.id, {
        nom: zone.nom,
        type: zone.type,
        couleur: zone.couleur,
        x: change.rect.x,
        y: change.rect.y,
        w: change.rect.w,
        h: change.rect.h,
      })
      done++
    }

    for (const change of payload.machines) {
      // La fiche complète est relue juste avant l'envoi : PUT remplace tous les champs de saisie.
      const machine = await pressingApi.machine(restaurantId, change.id)

      await pressingApi.updateMachine(restaurantId, change.id, machineBody(machine, { position_x: change.x, position_y: change.y, zone_id: change.zoneId }))
      done++
    }
  }
  catch (cause) {
    await refresh()

    // On garde le brouillon : ce qui est déjà enregistré reste identique, le reste peut être retenté.
    throw Object.assign(cause instanceof Error ? cause : new Error('save'), { partial: `${done} sur ${total}` })
  }

  await refresh()
  planRef.value?.finishEditing()
  revision.value++
  toast.success('L\'aménagement est enregistré.')
})

const layoutError = computed(() => {
  if (!layoutSubmit.error.value)
    return ''

  const partial = (layoutSubmit.error.value as { partial?: string }).partial

  return `${pressingError(layoutSubmit.error.value)}${partial ? ` (${partial} modifications enregistrées avant l'erreur.)` : ''}`
})

useLive(() => {
  if (!editing.value && !layoutSubmit.pending.value)
    refresh()
})

const subtitle = computed(() => {
  if (!plan.value)
    return 'Le local vu du dessus, avec l\'état de chaque machine.'

  return `${plural(machines.value.length, 'machine')} et ${plural(zones.value.length, 'zone')}, actualisées automatiquement.`
})

const unplaced = computed(() => machines.value.filter(machine => machine.position_x == null || machine.position_y == null).length)
</script>

<template>
  <div>
    <AppPageHeader
      title="Plan du pressing"
      :subtitle="subtitle"
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-layout-grid-line"
          data-tour="plan-new-zone"
          data-testid="nouvelle-zone"
          @click="newZone"
        >
          Nouvelle zone
        </VBtn>
        <VBtn
          prepend-icon="ri-add-line"
          data-tour="plan-new-machine"
          data-testid="nouvelle-machine"
          @click="newMachine"
        >
          Nouvelle machine
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="loading && !plan">
      <VCardText>
        <VSkeletonLoader type="image, list-item-two-line" />
      </VCardText>
    </VCard>

    <AppErrorState
      v-else-if="error && !plan"
      :error="error"
      @retry="reload"
    />

    <VCard v-else-if="isEmpty">
      <AppEmptyState
        icon="ri-layout-grid-line"
        title="Votre plan est vide"
        :text="canWrite
          ? 'Commencez par dessiner les zones du local (lavage, séchage, réception...), puis ajoutez vos machines et posez-les sur le plan.'
          : 'Aucune zone ni machine n\'a encore été ajoutée. La direction peut dessiner le plan du local.'"
      >
        <div
          v-if="canWrite"
          class="d-flex flex-wrap justify-center gap-3"
        >
          <VBtn
            variant="outlined"
            prepend-icon="ri-layout-grid-line"
            @click="newZone"
          >
            Créer une zone
          </VBtn>
          <VBtn
            prepend-icon="ri-add-line"
            @click="newMachine"
          >
            Ajouter une machine
          </VBtn>
        </div>
      </AppEmptyState>
    </VCard>

    <template v-else>
      <VAlert
        v-if="layoutError"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
      >
        {{ layoutError }}
      </VAlert>

      <VAlert
        v-if="canWrite && unplaced > 0 && !editing"
        type="info"
        variant="tonal"
        class="mb-4"
        icon="ri-drag-move-2-line"
      >
        {{ plural(unplaced, 'machine n\'a pas encore de position', 'machines n\'ont pas encore de position') }} : {{ unplaced > 1 ? 'elles sont dessinées' : 'elle est dessinée' }} en pointillés. Utilisez « Aménager » pour {{ unplaced > 1 ? 'les' : 'la' }} poser où vous voulez.
      </VAlert>

      <PressingPlan
        ref="planRef"
        :plan="plan"
        :can-edit="canWrite"
        :selected-machine-id="machineId"
        :selected-zone-id="zoneId"
        :saving="layoutSubmit.pending.value"
        @editing-change="editing = $event"
        @select-machine="machineId = $event"
        @select-zone="zoneId = $event"
        @save="layoutSubmit.submit($event)"
      />
    </template>

    <MachineDrawer
      v-model="machineId"
      :zones="zones"
      :can-write="canWrite"
      :revision="revision"
      @changed="refresh"
      @edit="editMachine"
    />

    <ZoneDrawer
      v-model="zoneId"
      :machines="machines"
      :zones="zones"
      :can-write="canWrite"
      @changed="refresh"
      @edit="editZone"
      @open-machine="openMachineFromZone"
    />

    <MachineFormDialog
      v-model="machineForm"
      :machine="editedMachine"
      :zones="zones"
      :default-category="newCategory"
      @saved="onMachineSaved"
    />

    <ZoneFormDialog
      v-model="zoneForm"
      :zone="editedZone"
      :zones="zones"
      @saved="onZoneSaved"
    />
  </div>
</template>
