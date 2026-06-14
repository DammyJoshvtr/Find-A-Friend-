export function calculateMatchScore(
  myInterests: string[],
  theirInterests: string[]
): number {
  if (!myInterests.length || !theirInterests.length) return 0

  const mySet = new Set(myInterests.map(i => i.toLowerCase()))
  const theirSet = new Set(theirInterests.map(i => i.toLowerCase()))

  let matches = 0
  mySet.forEach(interest => {
    if (theirSet.has(interest)) matches++
  })

  const union = new Set<string>()
  mySet.forEach(i => union.add(i))
  theirSet.forEach(i => union.add(i))
  const score = Math.round((matches / union.size) * 100)

  return score
}

export function getInitials(name: any): string {
  if (!name || typeof name !== 'string') return '??'
  return (
    name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??'
  )
}

export function getTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}