import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.get('/status', authenticateToken, async (req, res) => {
  const client = await pool.getClient()

  try {
    const result = await client.query('SELECT team, created_at FROM users WHERE id = $1', [req.user.id])
    const u = result.rows[0]

    const isSameDay = dayjs().tz().isSame(dayjs(u.created_at).tz(), 'day')
    if (isSameDay) return res.status(200).json({ popups: true })

    if (u.team == null)  return res.status(200).json({ popups: false })

    const team = Number.parseInt(u.team)
    let requiredDays = team * 7 + 1

    const startDate = dayjs(u.created_at).tz().add(requiredDays, 'day')
    const endDate = startDate.add(5 * 7, 'day')

    const now = Date.now()
    const popups = now >= startDate.valueOf() && now < endDate.valueOf()

    return res.status(200).json({ popups })
  } catch (err) {
    logger.error("Error checking popups status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
