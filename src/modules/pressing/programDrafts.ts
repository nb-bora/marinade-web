import type { Programme } from './types'

/** Étape d'un programme telle qu'on la saisit (la durée reste du texte jusqu'à l'envoi). */
export interface StepDraft {
  uid: number
  nom: string
  duree: string
}

/** Programme en cours de saisie dans le formulaire d'une machine. */
export interface ProgramDraft {
  uid: number
  nom: string
  duree: string
  types: string[]
  humaine: boolean
  etapes: StepDraft[]
}

let counter = 0

export const nextUid = () => ++counter

export const newProgram = (): ProgramDraft => ({ uid: nextUid(), nom: '', duree: '', types: [], humaine: false, etapes: [] })

export function toDrafts(programmes: Programme[]): ProgramDraft[] {
  return programmes.map(programme => ({
    uid: nextUid(),
    nom: programme.nom,
    duree: String(programme.duree_min),
    types: [...(programme.types_linge ?? [])],
    humaine: programme.intervention_humaine,
    etapes: (programme.etapes ?? []).map(etape => ({ uid: nextUid(), nom: etape.nom, duree: String(etape.duree_min) })),
  }))
}

export function toProgrammes(drafts: ProgramDraft[]): Programme[] {
  return drafts.map(draft => ({
    nom: draft.nom.trim(),
    duree_min: Number(draft.duree),
    types_linge: draft.types,
    intervention_humaine: draft.humaine,
    etapes: draft.etapes.length
      ? draft.etapes.map(etape => ({ nom: etape.nom.trim(), duree_min: Number(etape.duree) }))
      : null,
  }))
}
