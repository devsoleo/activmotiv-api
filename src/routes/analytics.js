import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.get('/popup', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    // 1. Get total count and total duration of popups
    const qStats = await client.query(
      `SELECT COALESCE(COUNT(*), 0) AS amount, COALESCE(SUM(duration), 0) AS total_duration FROM popups WHERE user_id = $1`,
      [user.id]
    )
    const amount = parseInt(qStats.rows[0].amount, 10)
    const total_duration = parseInt(qStats.rows[0].total_duration, 10)

    // 2. Get daily opening count for the current week (Monday to Sunday)
    const qWeekly = await client.query(
      `SELECT 
        EXTRACT(ISODOW FROM measured_at AT TIME ZONE 'Europe/Paris') AS dow,
        COUNT(*) AS count
       FROM popups 
       WHERE user_id = $1 
         AND measured_at >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris'))
         AND measured_at < date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) + INTERVAL '1 week'
       GROUP BY dow`,
      [user.id]
    )

    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    const opening = labels.map((label, index) => ({
      label,
      value: 0
    }))

    for (const row of qWeekly.rows) {
      const dow = parseInt(row.dow, 10) // 1 = Monday, 7 = Sunday
      const index = dow - 1
      if (index >= 0 && index < 7) {
        opening[index].value = parseInt(row.count, 10)
      }
    }

    return res.status(200).json({
      amount,
      duration: total_duration,
      opening
    })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.put('/popup', authenticateToken, async (req, res) => {
  const user = req.user
  const { timestamp, images, duration } = req.body

  if (!duration) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query(`INSERT INTO popups (user_id, duration, image_top, image_bottom, measured_at) VALUES ($1, $2,  $3, $4, $5)`, [user.id, duration, images.top, images.bottom, dayjs(timestamp).toISOString()])

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router