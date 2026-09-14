import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

// POST /sensor - Record sensor confirmation
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user
  const { timestamp } = req.body
  const measurementDate = timestamp ? dayjs(timestamp).toISOString() : dayjs().toISOString()

  const client = await pool.getClient()

  try {
    await client.query(
      `INSERT INTO sensor (user_id, measurement_date) VALUES ($1, $2)`,
      [user.id, measurementDate]
    )

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
      `SELECT COUNT(*) FROM sensor WHERE user_id = $1 AND measurement_date >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
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
