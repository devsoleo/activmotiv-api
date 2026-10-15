import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

// POST /sensor/toggle - Toggle sensor confirmation for a specific day of the current week or date
router.post('/toggle', authenticateToken, async (req, res) => {
  const user = req.user
  const { dayIndex, date } = req.body

  const client = await pool.getClient()

  try {
    let dayStart, dayEnd
    let isToday = false

    if (typeof dayIndex === 'number') {
      if (dayIndex < 0 || dayIndex > 6) {
        return res.status(400).json({ error: "dayIndex doit être entre 0 et 6" })
      }

      const qDow = await client.query(
        `SELECT EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) AS dow`
      )
      const currentDow = parseInt(qDow.rows[0].dow, 10)
      const currentDayIndex = currentDow - 1

      if (user.team !== 0 && !user.admin && dayIndex > currentDayIndex) {
        return res.status(400).json({ error: "Impossible de valider un jour futur" })
      }

      isToday = (dayIndex === currentDayIndex)

      const qMonday = await client.query(
        `SELECT date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) AS monday`
      )
      const mondayStr = qMonday.rows[0].monday
      dayStart = dayjs(mondayStr).add(dayIndex, 'day').startOf('day').toISOString()
      dayEnd = dayjs(mondayStr).add(dayIndex, 'day').endOf('day').toISOString()
    } else if (date) {
      dayStart = dayjs(date).tz().startOf('day').toISOString()
      dayEnd = dayjs(date).tz().endOf('day').toISOString()
      isToday = dayjs(date).tz().isSame(dayjs().tz(), 'day')
    } else {
      dayStart = dayjs().tz().startOf('day').toISOString()
      dayEnd = dayjs().tz().endOf('day').toISOString()
      isToday = true
    }

    const checkResult = await client.query(
      `SELECT id, confirmed FROM sensor WHERE user_id = $1 AND updated_at >= $2 AND updated_at <= $3 ORDER BY updated_at DESC LIMIT 1`,
      [user.id, dayStart, dayEnd]
    )

    let confirmed = false

    if (checkResult.rows.length > 0) {
      const existingRow = checkResult.rows[0]
      confirmed = !existingRow.confirmed

      await client.query(
        `UPDATE sensor SET confirmed = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [confirmed, existingRow.id]
      )
    } else {
      const measurementDate = isToday ? dayjs().toISOString() : dayjs(dayStart).add(12, 'hour').toISOString()
      confirmed = true
      await client.query(
        `INSERT INTO sensor (user_id, updated_at, confirmed, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [user.id, measurementDate, confirmed]
      )
    }

    return res.status(200).json({
      success: true,
      confirmed
    })
  } catch (err) {
    logger.error("Error toggling sensor status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// POST /sensor - Record sensor confirmation
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user
  const { timestamp } = req.body
  const measurementDate = timestamp ? dayjs(timestamp).toISOString() : dayjs().toISOString()
  const dayStart = dayjs(measurementDate).tz().startOf('day').toISOString()
  const dayEnd = dayjs(measurementDate).tz().endOf('day').toISOString()

  const client = await pool.getClient()

  try {
    const checkResult = await client.query(
      `SELECT id FROM sensor WHERE user_id = $1 AND updated_at >= $2 AND updated_at <= $3 ORDER BY updated_at DESC LIMIT 1`,
      [user.id, dayStart, dayEnd]
    )

    if (checkResult.rows.length > 0) {
      const existingId = checkResult.rows[0].id
      await client.query(
        `UPDATE sensor SET confirmed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [existingId]
      )
    } else {
      await client.query(
        `INSERT INTO sensor (user_id, updated_at, confirmed, updated_at) VALUES ($1, $2, true, CURRENT_TIMESTAMP)`,
        [user.id, measurementDate]
      )
    }

    logger.info({ message: `Sensor confirmation recorded for user ${user.id}` })
    return res.status(200).json({ success: true, message: "Port du capteur enregistré" })
  } catch (err) {
    logger.error("Error recording sensor:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// GET /sensor/today - Check if sensor was already confirmed today
router.get('/today', authenticateToken, async (req, res) => {
  const user = req.user
  const client = await pool.getClient()

  try {
    const result = await client.query(
      `SELECT COUNT(*) FROM sensor WHERE user_id = $1 AND confirmed IS TRUE AND updated_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
      [user.id]
    )

    const confirmed = parseInt(result.rows[0].count, 10) > 0
    return res.status(200).json({ confirmed })
  } catch (err) {
    logger.error("Error checking sensor status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
