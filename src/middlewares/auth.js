import jwt from 'jsonwebtoken'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

export const isAdmin = async (req, res, next) => {
  if (!req.user || !req.user.id) return res.sendStatus(401)

  try {
    const { rows } = await pool.query('SELECT admin FROM users WHERE id = $1', [req.user.id])
    if (!rows[0] || !rows[0].admin) {
      logger.warn({ message: "Admin check failed in DB", userId: req.user.id })
      return res.sendStatus(403)
    }
    req.user.admin = true
    next()
  } catch (err) {
    logger.error("Error verifying admin status in DB:", err)
    return res.sendStatus(500)
  }
}

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.error("Error :", err)
      return res.sendStatus(403)
    }

    req.user = user

    next()
  })
}