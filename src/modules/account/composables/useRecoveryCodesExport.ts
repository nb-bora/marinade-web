import { formatDateTime } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

/** Copie et téléchargement (.txt) d'un jeu de codes de secours. */
export function useRecoveryCodesExport(codes: () => string[], owner: () => string) {
  const toast = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes().join('\n'))
      toast.info('Codes copiés.')
    }
    catch {
      toast.warning('Copie impossible : recopiez les codes à la main.')
    }
  }

  function download() {
    const content = [
      'Marinade - codes de secours de la double authentification',
      `Compte : ${owner()}`,
      `Généré le : ${formatDateTime(new Date())}`,
      '',
      'Chaque code ne sert qu\'une seule fois, à la place du code de l\'application d\'authentification.',
      'Conservez ce fichier en lieu sûr, hors de cet appareil si possible.',
      '',
      ...codes(),
      '',
    ].join('\r\n')

    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')

    link.href = url
    link.download = 'marinade-codes-de-secours.txt'
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return { copy, download }
}
