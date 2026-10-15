import express from 'express'
import dayjs from 'dayjs'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { getUserCurrentPhase, getUserPhaseOnDate } from '@/utils/phases.js'

const router = express.Router()

const TARGET_PARTICIPANTS = 18

// GET /admin/analytics/global
router.get('/global', async (req, res) => {
  const client = await pool.getClient()

  try {
    const result = await client.query(
      'SELECT id, uid, team, created_at FROM users ORDER BY id ASC'
    )

    const allUsers = result.rows
    const participants = []

    for (const u of allUsers) {
      if (u.team === 0 || u.uid === 'adminacc') {
        continue
      }

      if (u.team != null && parseInt(u.team, 10) > 0) {
        participants.push(u)
      }
    }

    const baselineUsers = []
    const interventionUsers = []
    const suiviUsers = []

    for (const user of participants) {
      const phase = getUserCurrentPhase(user)
      if (phase === 'baseline') baselineUsers.push(user)
      else if (phase === 'intervention') interventionUsers.push(user)
      else if (phase === 'suivi') suiviUsers.push(user)
    }

    const total = participants.length
    const toInclude = Math.max(0, TARGET_PARTICIPANTS - total)

    // Calculate alerts for the last 3 days
    const d0 = dayjs().tz().startOf('day')
    const d1 = dayjs().tz().subtract(1, 'day').startOf('day')
    const d2 = dayjs().tz().subtract(2, 'days').startOf('day')
    const last3Days = [d0, d1, d2]

    const startDate = d2.toDate()
    const endDate = d0.endOf('day').toDate()

    const sensorRes = await client.query(
      'SELECT user_id, updated_at FROM sensor WHERE confirmed IS TRUE AND updated_at >= $1 AND updated_at <= $2',
      [startDate, endDate]
    )

    const questRes = await client.query(
      'SELECT user_id, completed_at FROM questionnaires WHERE completed_at >= $1 AND completed_at <= $2',
      [startDate, endDate]
    )

    const alerts = []

    for (const user of participants) {
      const userCreatedStart = dayjs(user.created_at).tz().startOf('day')

      for (const d of last3Days) {
        if (d.valueOf() < userCreatedStart.valueOf()) continue

        const phase = getUserPhaseOnDate(user, d)
        if (!phase) continue

        // Check sensor task on date d
        const hasSensor = sensorRes.rows.some(s =>
          s.user_id === user.id &&
          dayjs(s.updated_at).tz().isSame(d, 'day')
        )

        if (!hasSensor) {
          alerts.push({
            id: `${user.id}-sensor-${d.format('YYYY-MM-DD')}`,
            uid: user.uid,
            type: 'capteur non porté',
            date: d.format('DD/MM/YYYY'),
            dateLabel: d.isSame(d0, 'day') ? "Aujourd'hui" : d.isSame(d1, 'day') ? "Hier" : d.format('DD/MM'),
            timestamp: d.valueOf()
          })
        }

        // Check questionnaire task on date d
        const hasQuest = questRes.rows.some(q =>
          q.user_id === user.id &&
          dayjs(q.completed_at).tz().isSame(d, 'day')
        )

        if (!hasQuest) {
          alerts.push({
            id: `${user.id}-quest-${d.format('YYYY-MM-DD')}`,
            uid: user.uid,
            type: 'questionnaire non rempli',
            date: d.format('DD/MM/YYYY'),
            dateLabel: d.isSame(d0, 'day') ? "Aujourd'hui" : d.isSame(d1, 'day') ? "Hier" : d.format('DD/MM'),
            timestamp: d.valueOf()
          })
        }
      }
    }

    // Sort alerts by date descending (most recent date first) then by UID
    alerts.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp
      }
      return a.uid.localeCompare(b.uid)
    })

    return res.status(200).json({
      total,
      baseline: baselineUsers.length,
      intervention: interventionUsers.length,
      suivi: suiviUsers.length,
      toInclude,
      baselineUsers,
      interventionUsers,
      suiviUsers,
      alerts
    })
  } catch (err) {
    logger.error("Error fetching global analytics:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
