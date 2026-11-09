/** Coordonnées de l'éditeur, lues une fois depuis l'environnement (facultatives). */
export interface LegalInfo {

  /** Raison sociale, ou `null` : les textes parlent alors de « l'éditeur de Marinade ». */
  entityName: string | null

  /** Adresse e-mail de contact, ou `null` : les textes renvoient vers l'espace Marinade. */
  contactEmail: string | null
}

const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export function readLegalInfo(env: ImportMetaEnv = import.meta.env): LegalInfo {
  const email = env.VITE_LEGAL_CONTACT_EMAIL?.trim() ?? ''
  const name = env.VITE_LEGAL_ENTITY_NAME?.trim() ?? ''

  return {
    entityName: name || null,
    contactEmail: EMAIL.test(email) ? email : null,
  }
}

/** « Marinade, édité par X » ou simplement « l'éditeur de Marinade ». */
export function publisherLabel(info: LegalInfo): string {
  return info.entityName ? `**${info.entityName}** (« l'éditeur »)` : '**l\'éditeur de Marinade** (« l\'éditeur »)'
}

/** La phrase de contact, avec un lien `mailto:` quand une adresse est configurée. */
export function contactSentence(info: LegalInfo, subject: string): string {
  if (info.contactEmail)
    return `${subject} : écrivez-nous à [${info.contactEmail}](mailto:${info.contactEmail}).`

  return `${subject} : contactez l'éditeur depuis votre espace Marinade (menu **Paramètres**), ou par les coordonnées communiquées lors de votre souscription.`
}
