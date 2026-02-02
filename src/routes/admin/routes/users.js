import express from 'express'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { isAdmin } from '@/middlewares/auth.js'

const router = express.Router()

router.post('/create', async (req, res) => {
  const { account_uid, account_is_admin } = req.body

  if (!account_uid || !account_is_admin) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query('INSERT INTO users(uid, admin) VALUES($1, $2)', [account_uid, account_is_admin])

    logger.info({ message: "User created", uid: account_uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/list', isAdmin, async (req, res) => {
  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT id, uid, admin, last_login, created_at FROM users', [])

    return res.status(200).json({ users: q1.rows })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router