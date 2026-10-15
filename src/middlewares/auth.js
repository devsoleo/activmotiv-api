import jwt from 'jsonwebtoken'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

export const isAdmin = async (req, res, next) => {
  if (!req.user || !req.user.id) return res.sendStatus(401)

  try {
    const { rows } = await pool.query('SELECT team FROM users WHERE id = $1', [req.user.id])
    if (!rows[0] || rows[0].team !== 0) {
      logger.warn({ message: "Admin check failed in DB (team != 0)", userId: req.user.id })
      return res.sendStatus(403)
    }
    req.user.team = 0
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

  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      logger.error("Error :", err)
      return res.sendStatus(403)
    }

    try {
      const { rows } = await pool.query('SELECT team FROM users WHERE id = $1', [decodedUser.id])
      if (!rows[0] || rows[0].team === -1) {
        logger.warn({ message: "Access denied: account disabled or deleted", userId: decodedUser.id })
        return res.status(403).json({ error: "Compte désactivé" })
      }

      req.user = {
        ...decodedUser,
        team: rows[0].team,
        admin: rows[0].team === 0
      }
      next()
    } catch (dbErr) {
      logger.error("Error fetching user team in authenticateToken:", dbErr)
      return res.sendStatus(500)
    }
  })
}
