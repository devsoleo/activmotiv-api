import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.put('/token', authenticateToken, async (req, res) => {
  const user = req.user
  const { fcmToken } = req.body

  const client = await pool.getClient()

  try {
    await client.query(`
      INSERT INTO notifications_token (device_id, fcm_token)
      SELECT id, $1
      FROM devices
      WHERE user_id = $2 AND is_active = true
      LIMIT 1
      ON CONFLICT (device_id)
      DO UPDATE SET fcm_token = EXCLUDED.fcm_token
    `, [
      fcmToken,
      user.id
    ])

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router