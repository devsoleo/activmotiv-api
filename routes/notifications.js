import express from 'express'

import logger from '../logger/index.js'
import pool from '../database/postgresql/index.js'

import { authenticateToken } from "../auth/token.js"

const router = express.Router()

router.post('/token', authenticateToken, async (req, res) => {
  const user = req.user
  const { token } = req.body

  const client = await pool.getClient()

  try {
    console.log(token.length, user.id)
    await client.query("UPDATE users SET notification_token = $1 WHERE id = $2", [token, user.id])
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router