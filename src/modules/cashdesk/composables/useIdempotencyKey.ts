/** Identifiant aléatoire : `crypto.randomUUID` n'existe qu'en contexte sécurisé (HTTPS, localhost). */
export function newUuid(): string {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))

  bytes[6] = (bytes[6] & 0x0F) | 0x40
  bytes[8] = (bytes[8] & 0x3F) | 0x80

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Clé d'idempotence d'un encaissement.
 *
 * Tant que ce que l'on envoie ne change pas (même facture, mêmes moyens, mêmes montants), la
 * clé reste la même : un double clic, ou un réseau qui coupe puis un nouvel essai, rejouent la
 * MÊME requête, que le serveur reconnaît et ne paie qu'une fois. Dès que le caissier modifie
 * quelque chose, c'est un autre encaissement : nouvelle clé. Après un succès, `settle()`.
 */
export function useIdempotencyKey() {
  let key = newUuid()
  let lastSignature = ''

  return {

    /** La clé à envoyer pour cet encaissement (`signature` décrit tout ce qui est envoyé). */
    keyFor(signature: string): string {
      if (signature !== lastSignature) {
        key = newUuid()
        lastSignature = signature
      }

      return key
    },

    /** L'encaissement a abouti : le suivant sera un autre encaissement. */
    settle() {
      key = newUuid()
      lastSignature = ''
    },
  }
}
