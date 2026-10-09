/** Petit signal sonore du plan de salle : montant quand une table se prend, descendant quand elle se libère. */
let context: AudioContext | null = null

export function playChime(kind: 'in' | 'out'): void {
  try {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!Audio)
      return

    context ??= new Audio()

    if (context.state === 'suspended')
      void context.resume()

    const notes = kind === 'in' ? [660, 880] : [660, 494]
    const start = context.currentTime

    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator()
      const gain = context!.createGain()
      const at = start + index * 0.14

      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      oscillator.connect(gain).connect(context!.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.24)
    })
  }
  catch {
    // Pas de son possible (navigateur, autorisation) : le plan reste utilisable.
  }
}
