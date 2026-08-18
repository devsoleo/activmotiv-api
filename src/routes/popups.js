import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

const getPopupStatus = async (req, res) => {
  const client = await pool.getClient()

  try {
    const result = await client.query('SELECT team, created_at FROM users WHERE id = $1', [req.user.id])
    const u = result.rows[0]

    if (!u || !u.created_at) {
      return res.status(200).json({ popups: false })
    }

    // Always allow popups if the account creation was today (same day)
    const isSameDay = dayjs().isSame(dayjs(u.created_at), 'day')
    if (isSameDay) {
      return res.status(200).json({ popups: true })
    }

    if (u.team == null) {
      return res.status(200).json({ popups: false })
    }

    const team = parseInt(u.team, 10)
    let requiredDays = null

    if (team === 1) {
      requiredDays = 7 + 1
    } else if (team === 2) {
      requiredDays = 14 + 1
    } else if (team === 3) {
      requiredDays = 21 + 1
    }

    if (requiredDays === null) {
      return res.status(200).json({ popups: false })
    }

    const targetDate = dayjs(u.created_at).add(requiredDays, 'day')
    const popups = Date.now() >= targetDate.valueOf()

    return res.status(200).json({ popups })
  } catch (err) {
    logger.error("Error checking popups status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
}

router.get('/', authenticateToken, getPopupStatus)
router.get('/status', authenticateToken, getPopupStatus)

export default router
