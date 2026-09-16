import dayjs from 'dayjs'

export const PHASES_BY_TEAM = {
  1: [
    { startDays: 1, endDays: 1 + 7 },                                                                        // Phase 1: 1 -> 8
    { startDays: 1 + 7 + 7 + 7, endDays: 1 + 7 + 7 + 7 + 7 },                                                // Phase 2: 22 -> 29
    { startDays: 1 + 7 + 7 + 7 + 7 + 7 + 7, endDays: 1 + 7 + 7 + 7 + 7 + 7 + 7 + 7 }                        // Phase 3: 43 -> 50
  ],
  2: [
    { startDays: 1 + 7, endDays: 1 + 7 + 7 },                                                                // Phase 1: 8 -> 15
    { startDays: 1 + 7 + 7 + 7 + 7, endDays: 1 + 7 + 7 + 7 + 7 + 7 },                                        // Phase 2: 29 -> 36
    { startDays: 1 + 7 + 7 + 7 + 7 + 7 + 7 + 7, endDays: 1 + 7 + 7 + 7 + 7 + 7 + 7 + 7 + 7 }                // Phase 3: 50 -> 57
  ],
  3: [
    { startDays: 1 + 7 + 7, endDays: 1 + 7 + 7 + 7 },                                                        // Phase 1: 15 -> 22
    { startDays: 1 + 7 + 7 + 7 + 7 + 7, endDays: 1 + 7 + 7 + 7 + 7 + 7 + 7 },                                // Phase 2: 36 -> 43
    { startDays: 1 + 7 + 7 + 7 + 7 + 7 + 7 + 7 + 7, endDays: 1 + 7 + 7 + 7 + 7 + 7 + 7 + 7 + 7 + 7 }        // Phase 3: 57 -> 64
  ]
}

export function isUserInActivePhase(user) {
  if (!user || !user.created_at || user.team == null) {
    return false
  }

  const team = parseInt(user.team, 10)
  const teamPhases = PHASES_BY_TEAM[team]

  if (!teamPhases) {
    return false
  }

  const now = Date.now()

  for (const phase of teamPhases) {
    const debut = dayjs(user.created_at).tz().startOf('day').add(phase.startDays, 'day')
    const fin = dayjs(user.created_at).tz().add(phase.endDays, 'day').endOf('day')

    if (now >= debut.valueOf() && now <= fin.valueOf()) {
      return true
    }
  }

  return false
}

export function getNextQuestionnaireDate(user) {
  if (!user || !user.created_at || user.team == null) {
    return null
  }

  const team = parseInt(user.team, 10)
  const teamPhases = PHASES_BY_TEAM[team]

  if (!teamPhases) {
    return null
  }

  const now = Date.now()

  for (const phase of teamPhases) {
    const debut = dayjs(user.created_at).tz().startOf('day').add(phase.startDays, 'day')

    if (now < debut.valueOf()) {
      return debut.toISOString()
    }
  }

  return null
}
