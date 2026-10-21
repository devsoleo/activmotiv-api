import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { isUserInQPhase } from '@/utils/phases.js'

describe('isUserInQPhase', () => {
  it('retourne false pour l\'équipe 0 (admin)', () => {
    expect(isUserInQPhase({ team: 0, created_at: '2026-01-01' })).toBe(false)
  })

  it('retourne false si l\'utilisateur est invalide', () => {
    expect(isUserInQPhase(null)).toBe(false)
    expect(isUserInQPhase({ team: -1 })).toBe(false)
  })

  it('retourn false si l\'utilisateur n\'est pas en QPhase', () => {
    expect(isUserInQPhase({ team: 1, created_at: '2026-01-01' })).toBe(false)
  })

  it('valide la semaine 0 (Semaines 0, 3, 6) pour l\'Équipe 1', () => {
    const createdAt = dayjs().tz().startOf('day').subtract(2, 'day').toISOString()
    expect(isUserInQPhase({ team: 1, created_at: createdAt })).toBe(true)
  })

  it('invalide la semaine 1 pour l\'Équipe 1 et la valide pour l\'Équipe 2', () => {
    const createdAt = dayjs().tz().startOf('day').subtract(10, 'day').toISOString()
    expect(isUserInQPhase({ team: 1, created_at: createdAt })).toBe(false)
    expect(isUserInQPhase({ team: 2, created_at: createdAt })).toBe(true)
  })
})