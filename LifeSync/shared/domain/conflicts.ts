export interface ConflictCandidate {
  date: string
  startTime: string
  endTime: string
}

export interface ConflictActivity extends ConflictCandidate {
  id: number
}

export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && startB < endA
}

export function findConflicts<T extends ConflictActivity>(
  candidate: ConflictCandidate,
  activities: T[],
  excludeId?: number
): T[] {
  return activities.filter((activity) => {
    if (excludeId !== undefined && activity.id === excludeId) return false
    if (activity.date !== candidate.date) return false
    return intervalsOverlap(
      candidate.startTime,
      candidate.endTime,
      activity.startTime,
      activity.endTime
    )
  })
}

export function findAllConflictIds<T extends ConflictActivity>(activities: T[]): Set<number> {
  const result = new Set<number>()
  const byDate = new Map<string, T[]>()

  for (const activity of activities) {
    const list = byDate.get(activity.date) ?? []
    list.push(activity)
    byDate.set(activity.date, list)
  }

  for (const list of byDate.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime))
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const first = list[i]
        const second = list[j]
        if (second.startTime >= first.endTime) break
        if (intervalsOverlap(first.startTime, first.endTime, second.startTime, second.endTime)) {
          result.add(first.id)
          result.add(second.id)
        }
      }
    }
  }

  return result
}
