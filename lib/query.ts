export const searchParamsToObject = (searchParams: URLSearchParams) => {
  const result: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    result[key] = value
  })

  return result
}

export const parseCsvParam = (value: string | null | undefined) => {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
