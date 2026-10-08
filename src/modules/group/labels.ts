/** Canaux de commande du back (`OrderChannel`). */
const CHANNELS: Record<string, { label: string; icon: string }> = {
  POS: { label: 'Caisse et salle', icon: 'ri-store-2-line' },
  QR: { label: 'QR code à table', icon: 'ri-qr-code-line' },
  WHATSAPP: { label: 'WhatsApp', icon: 'ri-whatsapp-line' },
  KIOSK: { label: 'Borne en libre-service', icon: 'ri-computer-line' },
  WEB: { label: 'Site web', icon: 'ri-global-line' },
  PHONE: { label: 'Téléphone', icon: 'ri-phone-line' },
}

/** Moyens de paiement du back (`RosPaymentMethod`). */
const METHODS: Record<string, { label: string; icon: string }> = {
  CASH: { label: 'Espèces', icon: 'ri-cash-line' },
  MTN_MOMO: { label: 'MTN MoMo', icon: 'ri-smartphone-line' },
  ORANGE_MONEY: { label: 'Orange Money', icon: 'ri-smartphone-line' },
  CARD: { label: 'Carte bancaire', icon: 'ri-bank-card-line' },
  WAVE: { label: 'Wave', icon: 'ri-wallet-3-line' },
  BANK_TRANSFER: { label: 'Virement', icon: 'ri-bank-line' },
}

export const channelView = (code: string) => CHANNELS[code] ?? { label: 'Autre canal', icon: 'ri-question-line' }
export const methodView = (code: string) => METHODS[code] ?? { label: 'Autre moyen', icon: 'ri-question-line' }
