import dayjs from 'dayjs'

export const BASELINES_DURATIONS_BY_TEAM = {
  1: 1,
  2: 2,
  3: 3
}

export const STUDY_PHASES_BY_TEAM = {
  // TEAM ID: [ 0: A, 1: B, 2: A' ] else -1
  1: [ 0, 1, 6 ],
  2: [ 0, 2, 7 ],
  3: [ 0, 3, 8 ]
}

export const QUESTIONNAIRES_PHASES_BY_TEAM = {
  1: [ 0, 3, 6 ],
  2: [ 1, 4, 7 ],
  3: [ 2, 5, 8 ]
}

export function getUserStudyPhase(user, now = dayjs().tz()) {
  if (user?.team == null || user?.created_at == null) return -1

  const { team, created_at } = user

  if (team <= 0) return -1

  const t0 = dayjs(created_at).tz()

  const phase = STUDY_PHASES_BY_TEAM[team].findIndex((current_phase, i) => {
    const next_phase = STUDY_PHASES_BY_TEAM[team][Math.min(i + 1, STUDY_PHASES_BY_TEAM[team].length - 1)]

    const start = t0.add(current_phase * 7, 'day')
    const end = start.add(next_phase * 7, 'day')

    return now.isAfter(start) && now.isBefore(end)
  })

  return phase
}

export const isUserInStudyPhase = (user) => getUserStudyPhase(user) !== -1

export function getUserQPhase(user) {
  if (user?.team == null || user?.created_at == null) return -1

  const { team, created_at } = user

  if (team <= 0) return -1

  const now = dayjs().tz()
  const t0 = dayjs(created_at).tz()

  const phase = QUESTIONNAIRES_PHASES_BY_TEAM[team].findIndex((start_week) => {
    const start = t0.add(start_week * 7, 'day')
    const end = start.add(7, 'day')

    return now.isAfter(start) && now.isBefore(end)
  })

  return phase
}

export const isUserInQPhase = (user) => getUserQPhase(user) !== -1

export const nextUserQPhase = (user) => {
  if (user?.team == null || user?.created_at == null) return null

  const { team, created_at } = user

  if (team <= 0) return null

  const now = dayjs().tz()
  const t0 = dayjs(created_at).tz()

  for (const start_week of QUESTIONNAIRES_PHASES_BY_TEAM[team]) {
    const start = t0.add(start_week * 7, 'day')

    if (now.isBefore(start)) return start.toISOString()
  }

  return null
}

