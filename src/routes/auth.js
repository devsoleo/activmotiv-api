import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.post('/first-login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    const q1 = await client.query(`UPDATE users SET password = $1 WHERE uid = $2 AND password IS NULL`, [bcrypt.hashSync(password, 12), uid])

    if (q1.rowCount == 0) {
      logger.warn({ message: 'Password hasn\'t been created', uid })

      return res.sendStatus(500)
    }

    logger.info({ message: 'Password created', uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.post('/reset-password', authenticateToken, async (req, res) => {
  const user = req.user
  const { current_password, new_password } = req.body

  if ((!current_password || !new_password) || (current_password == new_password)) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    const q1 = await client.query(`SELECT password FROM users WHERE uid = $1`, [user.uid])
    const u = q1.rows[0]

    const validPassword = await bcrypt.compare(current_password, u.password)

    if (!validPassword) {
      logger.warn({ message: "Password reset failed", reason: "Wrong current password", uid: user.uid })

      return res.sendStatus(401)
    }

    await client.query(`UPDATE users SET password = $1 WHERE uid = $2`, [bcrypt.hashSync(new_password, 12), user.uid])

    logger.info({ message: 'Password reset', uid: user.uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
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
    const q1 = await client.query('SELECT * FROM users WHERE uid = $1', [uid])
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

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1y' })

    logger.info({ message: "Login successful", uid: u.uid })

    return res.status(200).json({ accessToken })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/onboarding-status', authenticateToken, async (req, res) => {
  const user = req.user
  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT COUNT(*) FROM sam WHERE user_id = $1', [user.id])
    const count = Number.parseInt(q1.rows[0].count, 20)

    // If count > 0, they have already rated their images (onboarded)
    return res.status(200).json({ onboarded: count > 0 })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router