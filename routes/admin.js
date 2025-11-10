import express from 'express'
import jwt from 'jsonwebtoken'

import logger from '../logger/index.js'
import pool from '../database/postgresql/index.js'

import { authenticateToken } from "../auth/token.js"

const router = express.Router()

router.post('/create-account', authenticateToken, async (req, res) => {
  const user = req.user
  const { account_uid, account_is_admin } = req.body

  if (!user.admin) return res.sendStatus(403)
  if (!account_uid || !account_is_admin) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query('INSERT INTO users(uid, admin) VALUES($1, $2)', [account_uid, account_is_admin])

    logger.info({ message: "User created", uid: account_uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.post('/login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT * FROM users WHERE admin = true AND uid = $1', [uid])
    const u = q1.rows[0]

    if (!u) {
      // Simuler une vérification afin d'éviter une faille de sécurité basée sur le temps de réponse
      await bcrypt.compare(password, '$2b$12$xhpvflnGo7ajmPMp97U2Geq9yBPOXnLUc.wj/LEU291SstVuzOrSO')

      logger.warn({ message: "Login failed", reason: "Unknown user", uid })

      return res.sendStatus(401)
    }

    await client.query('UPDATE users SET last_login = NOW() WHERE uid = $1', [u.uid])

    const validPassword = await bcrypt.compare(password, u.password)

    if (!validPassword) {
      logger.warn({ message: "Login failed", reason: "Wrong password", uid })

      return res.sendStatus(401)
    }

    const payload = {
      id: u.id,
      uid: u.uid,
      admin: u.admin
    }

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN })

    logger.info({ message: "Login successful", uid: u.uid })

    return res.status(200).json({ accessToken })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router