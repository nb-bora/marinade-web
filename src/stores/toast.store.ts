import { defineStore } from 'pinia'
import { describeError } from '@/lib/http/errorMessages'

export type ToastColor = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  text: string
  color: ToastColor
}

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])

  function dismiss(id: number): void {
    items.value = items.value.filter(toast => toast.id !== id)
  }

  function push(text: string, color: ToastColor): void {
    // Au plus trois à l'écran : les plus anciens cèdent la place.
    items.value = [...items.value.slice(-2), { id: nextId++, text, color }]
  }

  return { items, push, dismiss }
})

/** Notifications éphémères : `const toast = useToast(); toast.success('Enregistré')`. */
export function useToast() {
  const store = useToastStore()

  return {
    success: (text: string) => store.push(text, 'success'),
    info: (text: string) => store.push(text, 'info'),
    warning: (text: string) => store.push(text, 'warning'),

    /** Accepte un message ou n'importe quelle erreur (traduite en français). */
    error: (cause: unknown) => store.push(typeof cause === 'string' ? cause : describeError(cause), 'error'),
  }
}
