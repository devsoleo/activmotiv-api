import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.post('/toggle', authenticateToken, async (req, res) => {
  const user = req.user
  const { weekDayIndex } = req.body

  const client = await pool.getClient()

  const formattedDate = dayjs().tz().startOf('isoWeek').add(weekDayIndex, 'day').format('YYYY-MM-DD')

  try {
    await pool.query(
      `WITH deleted AS (
        DELETE FROM sensor WHERE user_id = $1 AND day = $2 RETURNING 1
      )
      INSERT INTO sensor (user_id, day)
      SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM deleted)`,
      [user.id, formattedDate]
    )

     return res.status(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/today', authenticateToken, async (req, res) => {
  const user = req.user
  const client = await pool.getClient()

  try {
    const result = await client.query(
      `SELECT COUNT(*) FROM sensor WHERE user_id = $1 AND confirmed IS TRUE AND updated_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
      [user.id]
    )

    const confirmed = Number.parseInt(result.rows[0].count, 10) > 0
    return res.status(200).json({ confirmed })
  } catch (err) {
    logger.error("Error checking sensor status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
