export interface ApiErrorPayload {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export class ApiClientError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

const maybeParseJson = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

export const apiFetch = async <T>(
  input: string,
  init?: RequestInit,
): Promise<T> => {
  const isFormDataBody =
    typeof FormData !== 'undefined' && init?.body instanceof FormData

  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers: {
      ...(init?.body && !isFormDataBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await maybeParseJson(response)) as ApiErrorPayload | null
    if (payload?.error) {
      throw new ApiClientError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      )
    }

    throw new ApiClientError(response.status, 'HTTP_ERROR', response.statusText)
  }

  const data = await maybeParseJson(response)
  return data as T
}
