import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { isUserInFormPhase, nextFormDate } from '@/utils/phases.js'

describe('isUserInFormPhase', () => {
  it('retourne false pour l\'équipe 0 (admin)', () => {
    expect(isUserInFormPhase({ team: 0, created_at: '2026-01-01' })).toBe(false)
  })

  it('retourne false si l\'utilisateur est invalide', () => {
    expect(isUserInFormPhase(null)).toBe(false)
    expect(isUserInFormPhase({ team: -1 })).toBe(false)
  })

  it('retourn false si l\'utilisateur n\'est pas en QPhase', () => {
    expect(isUserInFormPhase({ team: 1, created_at: '2026-01-01' })).toBe(false)
  })

  it('valide la semaine 0 (Semaines 0, 3, 6) pour l\'Équipe 1', () => {
    const createdAt = dayjs().tz().startOf('day').subtract(2, 'day').toISOString()
    expect(isUserInFormPhase({ team: 1, created_at: createdAt })).toBe(true)
  })

  it('invalide la semaine 1 pour l\'Équipe 1 et la valide pour l\'Équipe 2', () => {
    const createdAt = dayjs().tz().startOf('day').subtract(10, 'day').toISOString()
    expect(isUserInFormPhase({ team: 1, created_at: createdAt })).toBe(false)
    expect(isUserInFormPhase({ team: 2, created_at: createdAt })).toBe(true)
  })
})

describe('nextFormDate', () => {
  it('retourne null si l\'utilisateur est nul ou admin', () => {
    expect(nextFormDate(null)).toBeNull()
    expect(nextFormDate({ team: 0, created_at: '2026-01-01' })).toBeNull()
  })

  it('retourne la date de début de la prochaine phase quand hors phase', () => {
    const createdAt = '2026-01-01T00:00:00.000Z'
    // Semaine 1 pour team 1 (start_week = 3 est la prochaine phase)
    const now = dayjs('2026-01-08T10:00:00.000Z')
    const nextDate = nextFormDate({ team: 1, created_at: createdAt }, now)
    expect(nextDate).not.toBeNull()
    // 2026-01-01 + 21 jours (week 3) = 2026-01-22
    expect(nextDate.format('YYYY-MM-DD')).toBe('2026-01-22')
  })
})