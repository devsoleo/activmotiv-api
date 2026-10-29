import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

export const isAdmin = async (req, res, next) => {
  if (!req.user?.id) return res.sendStatus(401)

  try {
    const { rows } = await pool.query('SELECT team FROM users WHERE id = $1', [req.user.id])

    if (rows[0]?.team !== 0) return res.sendStatus(403)

    req.user.team = 0
    next()
  } catch (err) {
    logger.error("Error verifying admin status in DB:", err)
    return res.sendStatus(500)
  }
}

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (!token) return res.sendStatus(401)

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.uid, u.team, u.created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    )

    if (!rows[0] || rows[0].team === -1) return res.sendStatus(403)

    req.user = rows[0]
    next()
  } catch (err) {
    logger.error("Error verifying session in authenticateToken:", err)
    return res.sendStatus(500)
  }
}
