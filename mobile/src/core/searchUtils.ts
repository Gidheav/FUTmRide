export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[^a-z0-9\s]+/gi, ' ')
    .replace(/(\w)\1+/g, '$1')
    .trim()
    .toLowerCase()

export const damerauLevenshteinDistance = (a: string, b: string) => {
  const lenA = a.length
  const lenB = b.length
  const dp: number[][] = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0))

  for (let i = 0; i <= lenA; i += 1) dp[i][0] = i
  for (let j = 0; j <= lenB; j += 1) dp[0][j] = j

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
      }
    }
  }

  return dp[lenA][lenB]
}

export const isFuzzyMatch = (query: string, value: string) => {
  const normalizedQuery = normalizeText(query)
  const normalizedValue = normalizeText(value)
  if (!normalizedQuery || !normalizedValue) return false
  if (normalizedValue.includes(normalizedQuery)) return true

  const queryWords = normalizedQuery.split(/\s+/)
  const targetWords = normalizedValue.split(/\s+/)

  return queryWords.every((queryWord) => {
    if (queryWord.length === 0) return true
    return targetWords.some((targetWord) => {
      if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) return true

      const maxDistance = Math.max(1, Math.ceil(Math.min(targetWord.length, queryWord.length) * 0.45))
      if (damerauLevenshteinDistance(queryWord, targetWord) <= maxDistance) {
        return true
      }

      const prefixMatch = targetWord.startsWith(queryWord.slice(0, 2)) || queryWord.startsWith(targetWord.slice(0, 2))
      return prefixMatch && Math.abs(targetWord.length - queryWord.length) <= 2
    })
  })
}
