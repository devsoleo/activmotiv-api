import express from 'express'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.get('/status', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const q1 = await client.query(`SELECT * FROM questionnaires WHERE user_id = $1 AND completed_at >= NOW() - ($2)::interval`, [user.id, `${process.env.TASK_DAYS_INTERVAL} days`])

    const questionnaires = q1.rows

    const open_fsus = questionnaires.filter(i => i.label == 'fsus').length <= 0
    const open_generic = questionnaires.filter(i => i.label == 'generic').length <= 0

    return res.status(200).json({ status: { 't1': open_fsus, 't2': open_generic, 't3': true } })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router