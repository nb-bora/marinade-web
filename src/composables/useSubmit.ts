import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import type { ApiError } from '@/lib/http/errors'

/**
 * Enveloppe une action de formulaire : état « en cours », erreur lisible, et un seul envoi
 * à la fois (un double clic ne poste pas deux fois).
 *
 * `submit` renvoie le résultat, ou `undefined` si l'action a échoué (l'erreur est alors
 * dans `error` / `message`).
 */
export function useSubmit<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const pending = ref(false)
  const error = ref<unknown>(null)

  const apiError = computed<ApiError | null>(() => isApiError(error.value) ? error.value : null)
  const message = computed(() => error.value ? describeError(error.value) : '')

  async function submit(...args: Args): Promise<Result | undefined> {
    if (pending.value)
      return undefined

    pending.value = true
    error.value = null

    try {
      return await action(...args)
    }
    catch (cause) {
      error.value = cause

      return undefined
    }
    finally {
      pending.value = false
    }
  }

  const reset = () => {
    error.value = null
  }

  return { submit, pending, error, apiError, message, reset }
}
