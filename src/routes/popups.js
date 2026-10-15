import express from 'express'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.get('/status', authenticateToken, async (req, res) => {
  if (req.user && (req.user.team === 0 || req.user.admin)) {
    return res.status(200).json({ popups: true })
  }

  const client = await pool.getClient()

  try {
    const result = await client.query('SELECT team, created_at FROM users WHERE id = $1', [req.user.id])
    const user = result.rows[0]

    if (isUserInPPhase(user) || user?.team == 0) return res.status(200).json({ popups: true })

    return res.status(200).json({ popups: false })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
