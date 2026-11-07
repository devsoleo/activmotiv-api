import express from 'express'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const client = await pool.getClient()

  try {
    const { rows } = await client.query(
      `SELECT 
        f.id,
        f.user_id,
        u.uid AS user_uid,
        f.label,
        f.completed_at,
        f.data
       FROM forms f
       JOIN users u ON f.user_id = u.id
       ORDER BY f.completed_at DESC`
    )

    return res.status(200).json({ forms: rows })
  } catch (err) {
    logger.error("Error fetching forms:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
