<!-- Contenu de la fiche d'une zone : type, couleur, machines rattachées, modification et suppression. -->
<script setup lang="ts">
import { CATEGORY_INFO, ZONE_ICON, ZONE_INFO, formatCapacity, plural } from '../labels'
import type { PlanMachine, Zone } from '../types'
import MachineStateChip from './MachineStateChip.vue'

defineProps<{
  zone: Zone
  attached: PlanMachine[]
  canWrite: boolean
  blocked: boolean
  removing: boolean
  removalError: string
  compact: boolean
}>()

const emit = defineEmits<{
  close: []
  edit: [zone: Zone]
  remove: []
  openMachine: [id: string]
}>()
</script>

<template>
  <VCard
    :class="compact ? 'zone-drawer__card' : 'zone-drawer__plain'"
    flat
  >
    <div class="d-flex align-start gap-3 pa-5 pb-3">
      <VAvatar
        rounded
        size="48"
        class="zone-sheet__icon"
        :style="{ '--zc': zone.couleur }"
      >
        <VIcon
          :icon="ZONE_ICON[zone.type]"
          size="26"
        />
      </VAvatar>
      <div class="min-w-0 flex-grow-1">
        <h2 class="text-h6 text-truncate">
          {{ zone.nom }}
        </h2>
        <div class="text-body-2 text-medium-emphasis">
          {{ ZONE_INFO[zone.type].label }} · {{ zone.couleur }}
        </div>
      </div>
      <IconBtn
        aria-label="Fermer la fiche de la zone"
        @click="emit('close')"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <VCardText class="pt-2">
      <p class="text-body-2 text-medium-emphasis">
        {{ ZONE_INFO[zone.type].hint }} Elle occupe {{ Math.round(zone.w) }} % de la largeur et {{ Math.round(zone.h) }} % de la hauteur du plan.
      </p>

      <h3 class="text-subtitle-1 font-weight-semibold mt-4 mb-2">
        Machines rattachées
        <span class="text-medium-emphasis font-weight-regular">({{ attached.length }})</span>
      </h3>

      <p
        v-if="!attached.length"
        class="text-body-2 text-medium-emphasis"
      >
        Aucune machine n'est rattachée à cette zone. Une machine posée dans la zone avec « Aménager » lui est rattachée automatiquement.
      </p>
      <VList
        v-else
        density="comfortable"
        class="pa-0 zone-drawer__list"
      >
        <VListItem
          v-for="machine in attached"
          :key="machine.id"
          :title="machine.nom"
          :subtitle="`${CATEGORY_INFO[machine.categorie].label} · ${formatCapacity(machine.capacite_kg)}`"
          rounded="lg"
          @click="emit('openMachine', machine.id)"
        >
          <template #prepend>
            <VAvatar
              :color="CATEGORY_INFO[machine.categorie].color"
              variant="tonal"
              rounded
              size="36"
            >
              <VIcon :icon="CATEGORY_INFO[machine.categorie].icon" />
            </VAvatar>
          </template>
          <template #append>
            <MachineStateChip
              :state="machine.etat_operationnel"
              size="x-small"
            />
          </template>
        </VListItem>
      </VList>

      <VAlert
        v-if="removalError"
        type="error"
        variant="tonal"
        class="mt-4"
      >
        {{ removalError }}
      </VAlert>

      <VAlert
        v-if="canWrite && blocked"
        type="info"
        variant="tonal"
        density="compact"
        class="mt-4"
        icon="ri-information-line"
      >
        Cette zone ne peut pas être supprimée tant que {{ plural(attached.length, 'machine y est rattachée', 'machines y sont rattachées') }} : déplacez-{{ attached.length > 1 ? 'les' : 'la' }} dans une autre zone d'abord.
      </VAlert>
    </VCardText>

    <VCardActions
      v-if="canWrite"
      class="px-5 pb-5 gap-2"
    >
      <VBtn
        variant="outlined"
        color="error"
        prepend-icon="ri-delete-bin-line"
        :disabled="blocked"
        :loading="removing"
        data-testid="zone-supprimer"
        @click="emit('remove')"
      >
        Supprimer
      </VBtn>
      <VSpacer />
      <VBtn
        prepend-icon="ri-edit-line"
        @click="emit('edit', zone)"
      >
        Modifier
      </VBtn>
    </VCardActions>
  </VCard>
</template>

<style scoped>
.zone-sheet__icon {
  background: color-mix(in srgb, var(--zc) 18%, transparent);
  color: var(--zc);
}

.zone-drawer__card {
  max-block-size: 80vh;
  overflow-y: auto;
  border-end-end-radius: 0;
  border-end-start-radius: 0;
}

.zone-drawer__plain {
  block-size: 100%;
  overflow-y: auto;
}
</style>
