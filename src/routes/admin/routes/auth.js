import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

const router = express.Router()

router.post('/login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    const q1 = await client.query(`SELECT * FROM users WHERE admin = true AND uid = $1`, [uid])
    const u = q1.rows[0]

    if (!u) {
      // Simuler une vérification afin d'éviter une faille de sécurité basée sur le temps de réponse
      await bcrypt.compare(password, '$2b$12$xhpvflnGo7ajmPMp97U2Geq9yBPOXnLUc.wj/LEU291SstVuzOrSO')

      logger.warn({ message: "Login failed", reason: "Unknown user", uid })

      return res.sendStatus(401)
    }

    await client.query(`UPDATE users SET last_login = NOW() WHERE uid = $1`, [u.uid])

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

export default router