<!--
  Éditeur de programmes d'une machine : le cœur de sa fiche technique. Chaque programme a un nom, une
  durée, des types de linge, une case « intervention humaine » et, au besoin, des étapes. Les règles
  du serveur (au moins un programme pour un sèche-linge, intervention humaine seulement sur une
  machine semi-automatique) sont expliquées ici, au moment où elles comptent.
-->
<script setup lang="ts">
import { LINEN_SUGGESTIONS, formatMinutes } from '../labels'
import { newProgram, nextUid } from '../programDrafts'
import type { ProgramDraft, StepDraft } from '../programDrafts'
import type { MachineCategory, MachineMode } from '../types'

const props = defineProps<{
  category: MachineCategory
  mode: MachineMode
}>()

const emit = defineEmits<{ makeSemi: [] }>()

const programs = defineModel<ProgramDraft[]>({ required: true })

const DURATIONS = [30, 45, 60, 90]

/** Ouverture des cartes : toutes si la liste est courte, sinon seule la dernière ajoutée. */
const opened = ref<Set<number>>(new Set(programs.value.length <= 2 ? programs.value.map(program => program.uid) : []))

function isOpen(program: ProgramDraft) {
  return opened.value.has(program.uid)
}

function toggle(program: ProgramDraft) {
  const next = new Set(opened.value)

  if (next.has(program.uid))
    next.delete(program.uid)
  else
    next.add(program.uid)

  opened.value = next
}

function add() {
  const program = newProgram()

  programs.value = [...programs.value, program]
  opened.value = new Set([...opened.value, program.uid])
}

function duplicate(program: ProgramDraft) {
  const copy: ProgramDraft = {
    ...program,
    uid: nextUid(),
    nom: `${program.nom} (copie)`.slice(0, 80),
    types: [...program.types],
    etapes: program.etapes.map(step => ({ ...step, uid: nextUid() })),
  }

  const index = programs.value.findIndex(item => item.uid === program.uid)

  programs.value = [...programs.value.slice(0, index + 1), copy, ...programs.value.slice(index + 1)]
  opened.value = new Set([...opened.value, copy.uid])
}

function remove(program: ProgramDraft) {
  programs.value = programs.value.filter(item => item.uid !== program.uid)
}

function addStep(program: ProgramDraft) {
  program.etapes.push({ uid: nextUid(), nom: '', duree: '' })
}

function removeStep(program: ProgramDraft, step: StepDraft) {
  program.etapes = program.etapes.filter(item => item.uid !== step.uid)
}

const minutes = (value: string): number | null => /^\d+$/.test(value.trim()) ? Number(value.trim()) : null

const nameRules = [(value: string) => (value.trim().length >= 1 && value.trim().length <= 80) || 'Donnez un nom au programme, de 1 à 80 caractères.']

const durationRules = [(value: string) => {
  const number = minutes(value)

  return (number !== null && number >= 1 && number <= 720) || 'Durée en minutes entières, de 1 à 720.'
}]

function stepsTotal(program: ProgramDraft): number {
  return program.etapes.reduce((sum, step) => sum + (minutes(step.duree) ?? 0), 0)
}

/** Les types de linge saisis à la main sont nettoyés et dédoublonnés. */
function setTypes(program: ProgramDraft, values: string[]) {
  program.types = [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))]
}

const conflict = computed(() => props.mode !== 'semi_automatique' && programs.value.some(program => program.humaine))

const missing = computed(() => props.category === 'seche_linge' && programs.value.length === 0)

/** Un programme dont le nom ou la durée manque est signalé même replié. */
const incomplete = (program: ProgramDraft) => {
  const duration = minutes(program.duree)

  return program.nom.trim() === '' || duration === null || duration < 1 || duration > 720
}

const summary = (program: ProgramDraft) => {
  const parts = [program.duree && minutes(program.duree) ? formatMinutes(minutes(program.duree)) : 'Durée à saisir']

  if (program.types.length)
    parts.push(program.types.join(', '))

  if (program.humaine)
    parts.push('intervention humaine')

  return parts.join(' · ')
}
</script>

<template>
  <div class="program-editor">
    <!-- Règles transversales : intégrées à la validation du formulaire. -->
    <VInput
      :model-value="programs.length"
      :rules="[() => !missing || 'Un sèche-linge doit avoir au moins un programme : ajoutez-en un ci-dessous.']"
      hide-details="auto"
      class="program-editor__rule"
    />
    <VInput
      :model-value="conflict"
      :rules="[() => !conflict || 'Une intervention humaine n\'est possible que sur une machine semi-automatique.']"
      hide-details="auto"
      class="program-editor__rule"
    />

    <VAlert
      v-if="conflict"
      type="warning"
      variant="tonal"
      class="mb-4"
      icon="ri-error-warning-line"
    >
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <span>Un programme demande une intervention humaine : la machine doit alors être semi-automatique, car une machine automatique mène son cycle seule.</span>
        <VBtn
          size="small"
          variant="outlined"
          color="warning"
          @click="emit('makeSemi')"
        >
          Passer en semi-automatique
        </VBtn>
      </div>
    </VAlert>

    <div
      v-if="programs.length === 0"
      class="program-editor__empty"
      :class="{ 'program-editor__empty--required': missing }"
    >
      <VAvatar
        variant="tonal"
        color="primary"
        size="48"
      >
        <VIcon
          icon="ri-list-check-3"
          size="26"
        />
      </VAvatar>
      <div class="text-subtitle-1 font-weight-medium">
        Aucun programme pour l'instant
      </div>
      <p class="text-body-2 text-medium-emphasis mb-0 program-editor__empty-text">
        {{ category === 'seche_linge'
          ? 'Un sèche-linge a besoin d\'au moins un programme : sa durée sert à prévoir la fin du séchage.'
          : 'Les programmes (coton, délicat...) donnent la durée d\'un cycle. Vous pouvez en ajouter plus tard.' }}
      </p>
      <VBtn
        prepend-icon="ri-add-line"
        @click="add"
      >
        Ajouter un programme
      </VBtn>
    </div>

    <TransitionGroup
      v-else
      tag="div"
      name="program-list"
      class="d-flex flex-column gap-3"
    >
      <VCard
        v-for="(program, index) in programs"
        :key="program.uid"
        variant="outlined"
        class="program-card"
        :class="{ 'program-card--incomplete': incomplete(program) }"
      >
        <div class="program-card__head d-flex align-center gap-3 pa-3">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded
            size="36"
          >
            <span class="text-subtitle-2 font-weight-semibold">{{ index + 1 }}</span>
          </VAvatar>
          <button
            type="button"
            class="program-card__title text-start flex-grow-1 min-w-0"
            :aria-expanded="isOpen(program)"
            @click="toggle(program)"
          >
            <div class="text-subtitle-1 font-weight-medium text-truncate">
              {{ program.nom.trim() || 'Programme sans nom' }}
            </div>
            <div
              class="text-body-2 text-truncate"
              :class="incomplete(program) ? 'text-warning' : 'text-medium-emphasis'"
            >
              {{ incomplete(program) ? 'À compléter : ' : '' }}{{ summary(program) }}
            </div>
          </button>
          <IconBtn
            :aria-label="`Dupliquer le programme ${program.nom || index + 1}`"
            @click="duplicate(program)"
          >
            <VIcon icon="ri-file-copy-line" />
          </IconBtn>
          <IconBtn
            :aria-label="`Supprimer le programme ${program.nom || index + 1}`"
            @click="remove(program)"
          >
            <VIcon
              icon="ri-delete-bin-line"
              color="error"
            />
          </IconBtn>
          <IconBtn
            :aria-label="isOpen(program) ? 'Replier le programme' : 'Déplier le programme'"
            @click="toggle(program)"
          >
            <VIcon :icon="isOpen(program) ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
          </IconBtn>
        </div>

        <!-- Toujours rendu (v-show) pour que ses règles comptent dans la validation du formulaire. -->
        <div
          v-show="isOpen(program)"
          class="px-4 pb-4"
        >
          <VRow>
            <VCol
              cols="12"
              sm="7"
            >
              <VTextField
                v-model="program.nom"
                label="Nom du programme"
                prepend-inner-icon="ri-file-list-3-line"
                placeholder="Coton 60 °C, Délicat, Drap..."
                :rules="nameRules"
                maxlength="80"
              />
            </VCol>
            <VCol
              cols="12"
              sm="5"
            >
              <VTextField
                v-model="program.duree"
                label="Durée (minutes)"
                prepend-inner-icon="ri-timer-line"
                type="number"
                inputmode="numeric"
                min="1"
                max="720"
                :rules="durationRules"
              />
              <div class="d-flex flex-wrap gap-1 mt-1">
                <VChip
                  v-for="value in DURATIONS"
                  :key="value"
                  size="x-small"
                  variant="tonal"
                  :color="program.duree === String(value) ? 'primary' : undefined"
                  @click="program.duree = String(value)"
                >
                  {{ formatMinutes(value) }}
                </VChip>
              </div>
            </VCol>
            <VCol cols="12">
              <VCombobox
                :model-value="program.types"
                label="Types de linge"
                prepend-inner-icon="ri-t-shirt-line"
                :items="LINEN_SUGGESTIONS"
                multiple
                chips
                closable-chips
                hint="Choisissez dans la liste ou tapez un type puis Entrée."
                persistent-hint
                @update:model-value="setTypes(program, $event as string[])"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="program.humaine"
                label="Une personne doit intervenir pendant le cycle"
                color="primary"
                density="compact"
                hide-details
              />
              <p
                v-if="program.humaine && mode !== 'semi_automatique'"
                class="text-caption text-warning mt-1 mb-0"
              >
                Cette option exige une machine semi-automatique.
              </p>
            </VCol>

            <VCol cols="12">
              <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                <div class="text-subtitle-2">
                  Étapes <span class="text-medium-emphasis font-weight-regular">(facultatif)</span>
                </div>
                <VBtn
                  size="small"
                  variant="text"
                  prepend-icon="ri-add-line"
                  @click="addStep(program)"
                >
                  Ajouter une étape
                </VBtn>
              </div>
              <p
                v-if="!program.etapes.length"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                Détaillez par exemple prélavage, lavage et rinçage avec la durée de chacun.
              </p>
              <div
                v-for="(step, stepIndex) in program.etapes"
                :key="step.uid"
                class="d-flex align-start gap-2 mt-2"
              >
                <VTextField
                  v-model="step.nom"
                  :label="`Étape ${stepIndex + 1}`"
                  prepend-inner-icon="ri-footprint-line"
                  density="compact"
                  maxlength="80"
                  :rules="[(value: string) => value.trim().length >= 1 || 'Nommez l\'étape.']"
                />
                <VTextField
                  v-model="step.duree"
                  label="Minutes"
                  prepend-inner-icon="ri-timer-line"
                  density="compact"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max="720"
                  class="program-card__step-minutes"
                  :rules="durationRules"
                />
                <IconBtn
                  :aria-label="`Retirer l'étape ${stepIndex + 1}`"
                  class="mt-1"
                  @click="removeStep(program, step)"
                >
                  <VIcon icon="ri-close-line" />
                </IconBtn>
              </div>
              <p
                v-if="program.etapes.length && stepsTotal(program) !== minutes(program.duree)"
                class="text-caption text-medium-emphasis mt-2 mb-0"
              >
                Les étapes totalisent {{ formatMinutes(stepsTotal(program)) }}
                <template v-if="minutes(program.duree)">
                  pour un programme de {{ formatMinutes(minutes(program.duree)) }}
                </template>.
              </p>
            </VCol>
          </VRow>
        </div>
      </VCard>
    </TransitionGroup>

    <VBtn
      v-if="programs.length"
      variant="tonal"
      prepend-icon="ri-add-line"
      class="mt-3"
      block
      @click="add"
    >
      Ajouter un programme
    </VBtn>
  </div>
</template>

<style scoped>
.program-editor__rule {
  min-block-size: 0;
}

.program-editor__rule :deep(.v-input__control) {
  display: none;
}

.program-editor__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  border: 1px dashed rgba(var(--v-border-color), 0.4);
  border-radius: 12px;
  text-align: center;
}

.program-editor__empty--required {
  border-color: rgba(var(--v-theme-warning), 0.7);
  background: rgba(var(--v-theme-warning), 0.05);
}

.program-editor__empty-text {
  max-inline-size: 30rem;
}

.program-card--incomplete {
  border-color: rgba(var(--v-theme-warning), 0.6);
}

.program-card__title {
  cursor: pointer;
  border-radius: 6px;
}

.program-card__title:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.program-card__step-minutes {
  max-inline-size: 8rem;
}

.program-list-enter-active,
.program-list-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.program-list-enter-from,
.program-list-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .program-list-enter-active,
  .program-list-leave-active {
    transition: none;
  }
}
</style>
