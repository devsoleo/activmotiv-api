import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

import formsRouter from '@/routes/forms.js'
import pool from '@/database/postgresql/index.js'

const app = express()
app.use(express.json())
app.use('/forms', formsRouter)

describe('GET /forms/status', () => {
  let mockClient

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ count: '0', team: 1, created_at: new Date().toISOString() }] }),
      release: vi.fn(),
    }
    pool.getClient.mockResolvedValue(mockClient)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retourne les infos de statut pour un utilisateur', async () => {
    vi.setSystemTime(new Date('2026-01-01T12:00:00+02:00'))

    mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] })
    mockClient.query.mockResolvedValueOnce({ rows: [{ team: 1, created_at: '2026-01-01' }] })

    const userHeader = JSON.stringify({ id: 1, team: 1 })
    const res = await request(app)
      .get('/forms/status')
      .set('x-test-user', userHeader)

    expect(res.status).toBe(200)
    expect(res.body.inPhase).toBe(true)
    expect(res.body.inTimeWindow).toBe(true)
    expect(res.body.doneToday).toBe(false)
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('contourne les vérifications d\'horaires et de complétion pour la team 0 (admin)', async () => {
    vi.setSystemTime(new Date('2026-01-01T14:00:00+02:00'))

    const userHeader = JSON.stringify({ id: 1, team: 0 })
    const res = await request(app)
      .get('/forms/status')
      .set('x-test-user', userHeader)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ inPhase: true, nextDate: null })
  })

  it('renvoie un statut 500 en cas d\'erreur de base de données', async () => {
    vi.setSystemTime(new Date('2026-01-01T12:00:00+02:00')) // 01/01/26 à 12h00

    mockClient.query.mockRejectedValueOnce(new Error('DB Connection Error'))

    const userHeader = JSON.stringify({ id: 1, team: 1 })
    const res = await request(app)
      .get('/forms/status')
      .set('x-test-user', userHeader)

    expect(res.status).toBe(500)
    expect(mockClient.release).toHaveBeenCalled()
  })
})
